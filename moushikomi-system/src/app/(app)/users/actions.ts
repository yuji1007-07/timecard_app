"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

const createSchema = z.object({
  name: z.string().min(1, "氏名・表示名は必須です"),
  loginId: z.string().min(1, "ユーザーIDは必須です"),
  password: z.string().min(4, "初期パスワードは4文字以上にしてください"),
  role: z.enum(["ADMIN", "STAFF"]),
  storeId: z.string().optional(),
});

export async function createUser(_prev: unknown, formData: FormData) {
  await requireAdmin();
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (d.role === "STAFF" && !d.storeId) return { error: "店舗担当には所属店舗を選択してください。" };

  const loginId = d.loginId.trim();
  const exists = await prisma.user.findUnique({ where: { loginId } });
  if (exists) return { error: `ユーザーID「${loginId}」は既に使われています。` };

  await prisma.user.create({
    data: {
      loginId,
      name: d.name.trim(),
      passwordHash: await bcrypt.hash(d.password, 10),
      role: d.role,
      storeId: d.role === "STAFF" ? d.storeId : null,
    },
  });
  return { success: true };
}

const updateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, "氏名・表示名は必須です"),
  loginId: z.string().min(1, "ユーザーIDは必須です"),
  role: z.enum(["ADMIN", "STAFF"]),
  storeId: z.string().optional(),
  password: z.string().optional(),
  isActive: z.string().optional(),
});

export async function updateUser(_prev: unknown, formData: FormData) {
  const me = await requireAdmin();
  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (d.role === "STAFF" && !d.storeId) return { error: "店舗担当には所属店舗を選択してください。" };

  const loginId = d.loginId.trim();
  const dup = await prisma.user.findUnique({ where: { loginId } });
  if (dup && dup.id !== d.id) return { error: `ユーザーID「${loginId}」は他のアカウントが使用しています。` };

  if (d.id === me.id && d.role !== "ADMIN") return { error: "自分自身の権限を本部から変更することはできません。" };

  const data: { loginId: string; name: string; role: string; storeId: string | null; isActive: boolean; passwordHash?: string } = {
    loginId,
    name: d.name.trim(),
    role: d.role,
    storeId: d.role === "STAFF" ? (d.storeId ?? null) : null,
    isActive: d.id === me.id ? true : d.isActive === "1",
  };
  if (d.password && d.password.trim() !== "") {
    if (d.password.length < 4) return { error: "パスワードは4文字以上にしてください。" };
    data.passwordHash = await bcrypt.hash(d.password, 10);
  }

  await prisma.user.update({ where: { id: d.id }, data });
  return { success: true };
}

export async function deleteUser(_prev: unknown, formData: FormData): Promise<{ ok: boolean; message: string }> {
  const me = await requireAdmin();
  const id = String(formData.get("id"));
  if (id === me.id) return { ok: false, message: "ログイン中の自分自身は削除できません。" };
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return { ok: false, message: "対象アカウントが見つかりません。" };
  await prisma.user.delete({ where: { id } });
  return { ok: true, message: `${user.name}（${user.loginId}）を削除しました。` };
}
