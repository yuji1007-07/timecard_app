"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAreaManager } from "@/lib/session";

const boolFromForm = (v: FormDataEntryValue | null) => v === "on" || v === "true";

const kpiSchema = z.object({
  name: z.string().min(1, "KPI名は必須です"),
  unit: z.string().min(1),
  inputType: z.enum(["NUMBER", "PERCENT", "TEXT"]),
  goodDirection: z.enum(["UP", "DOWN"]),
});

type Scope = { businessType?: string | null; storeId?: string | null; departmentId?: string | null };

function scopeFromForm(formData: FormData): Scope {
  const level = String(formData.get("level"));
  if (level === "store") return { storeId: String(formData.get("scopeKey")) };
  if (level === "department") return { departmentId: String(formData.get("scopeKey")) };
  return { businessType: String(formData.get("scopeKey")) };
}

export async function createKpiItem(_prev: unknown, formData: FormData) {
  await requireAreaManager();
  const parsed = kpiSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const scope = scopeFromForm(formData);
  const count = await prisma.kpiItem.count({ where: scope });
  await prisma.kpiItem.create({
    data: {
      ...parsed.data,
      ...scope,
      hasTarget: boolFromForm(formData.get("hasTarget")),
      hasCurrent: boolFromForm(formData.get("hasCurrent")),
      hasForecast: boolFromForm(formData.get("hasForecast")),
      hasComparison: boolFromForm(formData.get("hasComparison")),
      showGraph: boolFromForm(formData.get("showGraph")),
      showDashboard: boolFromForm(formData.get("showDashboard")),
      required: boolFromForm(formData.get("required")),
      sortOrder: count,
    },
  });
  revalidatePath("/kpi-templates");
  return { success: true };
}

export async function updateKpiItem(_prev: unknown, formData: FormData) {
  await requireAreaManager();
  const id = String(formData.get("id"));
  const parsed = kpiSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await prisma.kpiItem.update({
    where: { id },
    data: {
      ...parsed.data,
      hasTarget: boolFromForm(formData.get("hasTarget")),
      hasCurrent: boolFromForm(formData.get("hasCurrent")),
      hasForecast: boolFromForm(formData.get("hasForecast")),
      hasComparison: boolFromForm(formData.get("hasComparison")),
      showGraph: boolFromForm(formData.get("showGraph")),
      showDashboard: boolFromForm(formData.get("showDashboard")),
      required: boolFromForm(formData.get("required")),
    },
  });
  revalidatePath("/kpi-templates");
  return { success: true };
}

export async function deleteKpiItem(formData: FormData) {
  await requireAreaManager();
  const id = String(formData.get("id"));
  await prisma.kpiItem.delete({ where: { id } });
  revalidatePath("/kpi-templates");
}

export async function moveKpiItem(formData: FormData) {
  await requireAreaManager();
  const id = String(formData.get("id"));
  const dir = String(formData.get("dir")); // up | down | top | bottom
  const item = await prisma.kpiItem.findUnique({ where: { id } });
  if (!item) return;
  const scope = { businessType: item.businessType, storeId: item.storeId, departmentId: item.departmentId };
  const siblings = await prisma.kpiItem.findMany({ where: scope, orderBy: { sortOrder: "asc" } });
  const idx = siblings.findIndex((s) => s.id === id);
  if (idx < 0) return;

  const arr = siblings.filter((s) => s.id !== id);
  let newIdx = idx;
  if (dir === "up") newIdx = Math.max(0, idx - 1);
  else if (dir === "down") newIdx = Math.min(arr.length, idx + 1);
  else if (dir === "top") newIdx = 0;
  else if (dir === "bottom") newIdx = arr.length;
  arr.splice(newIdx, 0, item);

  await prisma.$transaction(arr.map((s, i) => prisma.kpiItem.update({ where: { id: s.id }, data: { sortOrder: i } })));
  revalidatePath("/kpi-templates");
}

/** KPI名から単位を推定する。 */
function guessUnit(name: string): string {
  if (/率$/.test(name)) return "%";
  if (/単価/.test(name)) return "円";
  if (/頻度|回数/.test(name)) return "回";
  if (/枚数/.test(name)) return "枚";
  if (/件$/.test(name)) return "件";
  if (/数$/.test(name)) return "人";
  return "円";
}

/** KPI名から良化方向を推定する（離反・退会・休会・解約系は減ると良い）。 */
function guessDirection(name: string): "UP" | "DOWN" {
  return /離反|退会|休会|解約|キャンセル|未達|未提出/.test(name) ? "DOWN" : "UP";
}

/** KPI名を複数行まとめて一括追加する。unit が "AUTO" のときは名前から自動判定。 */
export async function bulkCreateKpiItems(_prev: unknown, formData: FormData) {
  await requireAreaManager();
  const scope = scopeFromForm(formData);
  const unitChoice = String(formData.get("unit") || "AUTO");
  const namesRaw = String(formData.get("names") || "");
  const names = Array.from(
    new Set(
      namesRaw
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean)
    )
  );
  if (names.length === 0) return { error: "KPI名を1行に1つずつ入力してください。" };

  const count = await prisma.kpiItem.count({ where: scope });
  await prisma.kpiItem.createMany({
    data: names.map((name, i) => {
      const unit = unitChoice === "AUTO" ? guessUnit(name) : unitChoice;
      return {
        name,
        unit,
        inputType: unit === "%" ? "PERCENT" : "NUMBER",
        goodDirection: guessDirection(name),
        ...scope,
        sortOrder: count + i,
      };
    }),
  });
  revalidatePath("/kpi-templates");
  return { success: true, added: names.length };
}

/** 業態テンプレートを店舗/部門スコープにコピーして上書きの土台を作る。 */
export async function copyKpiTemplate(formData: FormData) {
  await requireAreaManager();
  const fromBusinessType = String(formData.get("fromBusinessType"));
  const level = String(formData.get("level"));
  const scopeKey = String(formData.get("scopeKey"));
  const target: Scope = level === "store" ? { storeId: scopeKey } : { departmentId: scopeKey };

  const base = await prisma.kpiItem.findMany({
    where: { businessType: fromBusinessType, storeId: null, departmentId: null },
    orderBy: { sortOrder: "asc" },
  });
  await prisma.$transaction(
    base.map((b) =>
      prisma.kpiItem.create({
        data: {
          name: b.name,
          unit: b.unit,
          inputType: b.inputType,
          goodDirection: b.goodDirection,
          hasTarget: b.hasTarget,
          hasCurrent: b.hasCurrent,
          hasForecast: b.hasForecast,
          hasComparison: b.hasComparison,
          showGraph: b.showGraph,
          showDashboard: b.showDashboard,
          required: b.required,
          sortOrder: b.sortOrder,
          ...target,
        },
      })
    )
  );
  revalidatePath("/kpi-templates");
}
