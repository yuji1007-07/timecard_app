"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAreaManager } from "@/lib/session";

const boolFromForm = (v: FormDataEntryValue | null) => v === "on" || v === "true";

const schema = z.object({
  name: z.string().min(1, "条件名は必須です"),
  targetType: z.enum(["ALL", "SEIKOTSU", "SHINKYU", "ESTHE", "STORE", "DEPARTMENT"]),
  storeId: z.string().optional(),
  departmentId: z.string().optional(),
  targetKpi: z.string().optional(),
  operator: z.enum(["GTE", "LTE", "LT", "GT", "INCREASED", "DECREASED", "BELOW_TARGET", "NOT_SUBMITTED", "ACTION_NOT_DONE"]),
  threshold: z.string().optional(),
  color: z.enum(["RED", "YELLOW", "BLUE"]),
  priority: z.enum(["HIGH", "MID", "LOW"]),
});

function dataFromForm(formData: FormData) {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message as string };
  const d = parsed.data;
  return {
    data: {
      name: d.name,
      targetType: d.targetType,
      storeId: d.targetType === "STORE" ? d.storeId || null : null,
      departmentId: d.targetType === "DEPARTMENT" ? d.departmentId || null : null,
      targetKpi: d.targetKpi || null,
      operator: d.operator,
      threshold: d.threshold && d.threshold.trim() !== "" ? Number(d.threshold) : null,
      color: d.color,
      priority: d.priority,
      notify: boolFromForm(formData.get("notify")),
      enabled: boolFromForm(formData.get("enabled")),
    },
  };
}

export async function createAlert(_prev: unknown, formData: FormData) {
  await requireAreaManager();
  const res = dataFromForm(formData);
  if (res.error) return { error: res.error };
  const count = await prisma.alertCondition.count();
  await prisma.alertCondition.create({ data: { ...res.data!, sortOrder: count + 1 } });
  revalidatePath("/alerts");
  return { success: true };
}

export async function updateAlert(_prev: unknown, formData: FormData) {
  await requireAreaManager();
  const id = String(formData.get("id"));
  const res = dataFromForm(formData);
  if (res.error) return { error: res.error };
  await prisma.alertCondition.update({ where: { id }, data: res.data! });
  revalidatePath("/alerts");
  return { success: true };
}

export async function deleteAlert(formData: FormData) {
  await requireAreaManager();
  await prisma.alertCondition.delete({ where: { id: String(formData.get("id")) } });
  revalidatePath("/alerts");
}

export async function toggleAlert(formData: FormData) {
  await requireAreaManager();
  const id = String(formData.get("id"));
  const enabled = String(formData.get("enabled")) === "true";
  await prisma.alertCondition.update({ where: { id }, data: { enabled } });
  revalidatePath("/alerts");
}
