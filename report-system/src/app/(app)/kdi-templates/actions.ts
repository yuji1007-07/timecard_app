"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAreaManager } from "@/lib/session";

const boolFromForm = (v: FormDataEntryValue | null) => v === "on" || v === "true";

const kdiSchema = z.object({
  name: z.string().min(1, "KDI名は必須です"),
  category: z.string().optional(),
  relatedKpiName: z.string().optional(),
  recommendedFrequency: z.enum(["DAILY", "WEEKLY1", "WEEKLY2", "MONTHLY1", "ANY"]),
  note: z.string().optional(),
});

function scopeFromForm(formData: FormData) {
  const level = String(formData.get("level"));
  if (level === "store") return { storeId: String(formData.get("scopeKey")) };
  if (level === "department") return { departmentId: String(formData.get("scopeKey")) };
  return { businessType: String(formData.get("scopeKey")) };
}

function flags(formData: FormData) {
  return {
    hasAssignee: boolFromForm(formData.get("hasAssignee")),
    hasDeadline: boolFromForm(formData.get("hasDeadline")),
    hasCount: boolFromForm(formData.get("hasCount")),
    hasTargetPerson: boolFromForm(formData.get("hasTargetPerson")),
    hasStatus: boolFromForm(formData.get("hasStatus")),
  };
}

export async function createKdiItem(_prev: unknown, formData: FormData) {
  await requireAreaManager();
  const parsed = kdiSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const scope = scopeFromForm(formData);
  const count = await prisma.kdiItem.count({ where: scope });
  await prisma.kdiItem.create({
    data: {
      name: parsed.data.name,
      category: parsed.data.category || null,
      relatedKpiName: parsed.data.relatedKpiName || null,
      recommendedFrequency: parsed.data.recommendedFrequency,
      note: parsed.data.note || null,
      ...flags(formData),
      ...scope,
      sortOrder: count,
    },
  });
  revalidatePath("/kdi-templates");
  return { success: true };
}

export async function updateKdiItem(_prev: unknown, formData: FormData) {
  await requireAreaManager();
  const id = String(formData.get("id"));
  const parsed = kdiSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await prisma.kdiItem.update({
    where: { id },
    data: {
      name: parsed.data.name,
      category: parsed.data.category || null,
      relatedKpiName: parsed.data.relatedKpiName || null,
      recommendedFrequency: parsed.data.recommendedFrequency,
      note: parsed.data.note || null,
      ...flags(formData),
    },
  });
  revalidatePath("/kdi-templates");
  return { success: true };
}

export async function deleteKdiItem(formData: FormData) {
  await requireAreaManager();
  await prisma.kdiItem.delete({ where: { id: String(formData.get("id")) } });
  revalidatePath("/kdi-templates");
}

export async function copyKdiTemplate(formData: FormData) {
  await requireAreaManager();
  const fromBusinessType = String(formData.get("fromBusinessType"));
  const level = String(formData.get("level"));
  const scopeKey = String(formData.get("scopeKey"));
  const target = level === "store" ? { storeId: scopeKey } : { departmentId: scopeKey };
  const base = await prisma.kdiItem.findMany({
    where: { businessType: fromBusinessType, storeId: null, departmentId: null },
    orderBy: { sortOrder: "asc" },
  });
  await prisma.$transaction(
    base.map((b) =>
      prisma.kdiItem.create({
        data: {
          name: b.name,
          category: b.category,
          relatedKpiName: b.relatedKpiName,
          recommendedFrequency: b.recommendedFrequency,
          hasAssignee: b.hasAssignee,
          hasDeadline: b.hasDeadline,
          hasCount: b.hasCount,
          hasTargetPerson: b.hasTargetPerson,
          hasStatus: b.hasStatus,
          note: b.note,
          sortOrder: b.sortOrder,
          ...target,
        },
      })
    )
  );
  revalidatePath("/kdi-templates");
}
