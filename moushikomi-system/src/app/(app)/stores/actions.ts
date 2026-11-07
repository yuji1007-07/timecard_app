"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { DEPARTMENTS } from "@/lib/constants";

const deptSchema = z.enum(DEPARTMENTS as unknown as [string, ...string[]], { message: "部門を選択してください" });

const createSchema = z.object({
  name: z.string().min(1, "店舗名を入力してください"),
  department: deptSchema,
  pinCode: z.string().optional(),
});

export async function createStore(_prev: unknown, formData: FormData) {
  await requireAdmin();
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const name = parsed.data.name.trim();
  if (!name) return { error: "店舗名を入力してください。" };

  const existing = await prisma.store.findUnique({ where: { name } });
  if (existing) {
    await prisma.store.update({ where: { id: existing.id }, data: { isActive: true, department: parsed.data.department } });
    return { success: true, message: "既存店舗を再有効化しました。" };
  }
  const count = await prisma.store.count();
  await prisma.store.create({
    data: { name, department: parsed.data.department, pinCode: parsed.data.pinCode?.trim() || null, isActive: true, sortOrder: count + 1 },
  });
  return { success: true, message: "店舗を追加しました。" };
}

const updateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, "店舗名を入力してください"),
  department: deptSchema,
  pinCode: z.string().optional(),
  isActive: z.string().optional(),
});

export async function updateStore(_prev: unknown, formData: FormData) {
  await requireAdmin();
  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const name = parsed.data.name.trim();
  if (!name) return { error: "店舗名を入力してください。" };
  const dup = await prisma.store.findUnique({ where: { name } });
  if (dup && dup.id !== parsed.data.id) return { error: "同じ名前の店舗が既にあります。" };
  await prisma.store.update({
    where: { id: parsed.data.id },
    data: { name, department: parsed.data.department, pinCode: parsed.data.pinCode?.trim() || null, isActive: parsed.data.isActive === "1" },
  });
  // 申込書に記録している店舗名も追従させる
  await prisma.application.updateMany({ where: { storeId: parsed.data.id }, data: { storeName: name, department: parsed.data.department } });
  return { success: true, message: "店舗情報を更新しました。" };
}
