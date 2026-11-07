"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { detectBrandAndStore, normalizeText } from "@/lib/stores";

export async function createStore(_prev: unknown, formData: FormData) {
  await requireAdmin();
  const name = normalizeText(String(formData.get("name") ?? ""));
  if (!name) return { error: "店舗名を入力してください。" };
  const { brand, shortName } = detectBrandAndStore(name);

  const existing = await prisma.store.findUnique({ where: { name } });
  if (existing) {
    await prisma.store.update({ where: { id: existing.id }, data: { isActive: true } });
    return { success: true, message: "既存店舗を再有効化しました。" };
  }
  const count = await prisma.store.count();
  await prisma.store.create({ data: { name, brand, shortName, isActive: true, sortOrder: count + 1 } });
  return { success: true, message: "店舗を追加しました。" };
}

const updateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, "店舗名を入力してください"),
  isActive: z.string().optional(),
});

export async function updateStore(_prev: unknown, formData: FormData) {
  await requireAdmin();
  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const name = normalizeText(parsed.data.name);
  if (!name) return { error: "店舗名を入力してください。" };
  const dup = await prisma.store.findUnique({ where: { name } });
  if (dup && dup.id !== parsed.data.id) return { error: "同じ名前の店舗が既にあります。" };
  const { brand, shortName } = detectBrandAndStore(name);
  await prisma.store.update({
    where: { id: parsed.data.id },
    data: { name, brand, shortName, isActive: parsed.data.isActive === "1" },
  });
  return { success: true, message: "店舗情報を更新しました。" };
}
