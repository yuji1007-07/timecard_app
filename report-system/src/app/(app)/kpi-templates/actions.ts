"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAreaManager } from "@/lib/session";
import { guessUnit, guessDirection } from "@/lib/kpi-guess";

const boolFromForm = (v: FormDataEntryValue | null) => v === "on" || v === "true";

const kpiSchema = z.object({
  name: z.string().min(1, "KPI名は必須です"),
  unit: z.string().min(1),
  inputType: z.enum(["NUMBER", "PERCENT", "TEXT"]),
  goodDirection: z.enum(["UP", "DOWN"]),
});

/**
 * 大枠カテゴリを決める。明示指定があればそれを使い、無ければ名前の接頭辞（"会員-…"→"会員"）から推定。
 * 接頭辞も無ければ null（未分類＝報告フォームでは「その他」にまとまる）。
 */
function resolveCategory(explicit: string | null | undefined, name: string): string | null {
  const c = (explicit ?? "").trim();
  if (c) return c;
  const i = name.indexOf("-");
  if (i > 0) return name.slice(0, i).trim() || null;
  return null;
}

type Scope = { businessType?: string | null; storeId?: string | null; departmentId?: string | null };

function scopeFromForm(formData: FormData): Scope {
  const level = String(formData.get("level"));
  if (level === "store") return { storeId: String(formData.get("scopeKey")) };
  if (level === "department") return { departmentId: String(formData.get("scopeKey")) };
  return { businessType: String(formData.get("scopeKey")) };
}

/** フォームの「並び順（番号）」。1始まりの位置を返し、空欄・不正値は null（＝最後に追加） */
function positionFromForm(formData: FormData): number | null {
  const raw = String(formData.get("position") ?? "").trim();
  if (!raw) return null;
  const n = Math.round(Number(raw));
  return Number.isFinite(n) && n >= 1 ? n : null;
}

/** 追加した項目を pos 番目（1始まり）から並べ、スコープ内の並び順を振り直す */
async function placeAt(scope: Scope, ids: string[], pos: number) {
  const siblings = await prisma.kpiItem.findMany({ where: scope, orderBy: { sortOrder: "asc" }, select: { id: true } });
  const added = new Set(ids);
  const arr = siblings.map((s) => s.id).filter((id) => !added.has(id));
  arr.splice(Math.min(arr.length, pos - 1), 0, ...ids);
  await prisma.$transaction(arr.map((id, i) => prisma.kpiItem.update({ where: { id }, data: { sortOrder: i } })));
}

export async function createKpiItem(_prev: unknown, formData: FormData) {
  await requireAreaManager();
  const parsed = kpiSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const scope = scopeFromForm(formData);
  const count = await prisma.kpiItem.count({ where: scope });
  const created = await prisma.kpiItem.create({
    data: {
      ...parsed.data,
      ...scope,
      category: resolveCategory(formData.get("category") as string | null, parsed.data.name),
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
  // 番号を指定したときはその位置に差し込む（空欄なら最後のまま）
  const pos = positionFromForm(formData);
  if (pos != null && pos <= count) await placeAt(scope, [created.id], pos);
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
      category: resolveCategory(formData.get("category") as string | null, parsed.data.name),
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

/** 選択中スコープのKPI項目をすべて削除する（入れ替え用）。 */
export async function deleteAllKpiItems(formData: FormData) {
  await requireAreaManager();
  const scope = scopeFromForm(formData);
  await prisma.kpiItem.deleteMany({ where: scope });
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

/** 位置番号を直接指定して並び替える（例: 「5」を入れると5番目へ移動）。 */
export async function reorderKpiItem(formData: FormData) {
  await requireAreaManager();
  const id = String(formData.get("id"));
  const pos = Number(formData.get("pos"));
  const item = await prisma.kpiItem.findUnique({ where: { id } });
  if (!item || !Number.isFinite(pos)) return;
  const scope = { businessType: item.businessType, storeId: item.storeId, departmentId: item.departmentId };
  const siblings = await prisma.kpiItem.findMany({ where: scope, orderBy: { sortOrder: "asc" } });
  const arr = siblings.filter((s) => s.id !== id);
  const newIdx = Math.max(0, Math.min(arr.length, Math.round(pos) - 1)); // 1始まり→0始まり
  arr.splice(newIdx, 0, item);
  await prisma.$transaction(arr.map((s, i) => prisma.kpiItem.update({ where: { id: s.id }, data: { sortOrder: i } })));
  revalidatePath("/kpi-templates");
}

/** 名前の接頭辞（"会員-…"等）から、カテゴリ未設定のKPIにカテゴリを一括で補完する。 */
export async function autoFillCategories(formData: FormData) {
  await requireAreaManager();
  const scope = scopeFromForm(formData);
  const items = await prisma.kpiItem.findMany({ where: scope });
  const updates = items
    .map((it) => ({ id: it.id, cat: resolveCategory(null, it.name) }))
    .filter((u) => u.cat && u.cat !== items.find((i) => i.id === u.id)?.category);
  if (updates.length > 0) {
    await prisma.$transaction(updates.map((u) => prisma.kpiItem.update({ where: { id: u.id }, data: { category: u.cat } })));
  }
  revalidatePath("/kpi-templates");
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

  const bulkCategory = String(formData.get("category") || "").trim();
  const count = await prisma.kpiItem.count({ where: scope });
  // 並び順を後から差し込めるよう、作成したIDを受け取る（createMany は ID を返さないため1件ずつ）
  const created = await prisma.$transaction(
    names.map((name, i) => {
      const unit = unitChoice === "AUTO" ? guessUnit(name) : unitChoice;
      return prisma.kpiItem.create({
        data: {
          name,
          unit,
          inputType: unit === "%" ? "PERCENT" : "NUMBER",
          goodDirection: guessDirection(name),
          category: resolveCategory(bulkCategory || null, name),
          ...scope,
          sortOrder: count + i,
        },
        select: { id: true },
      });
    })
  );
  // 番号を指定したときは、入力した順番のままその位置から差し込む
  const pos = positionFromForm(formData);
  if (pos != null && pos <= count) await placeAt(scope, created.map((c) => c.id), pos);
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
