"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAreaManager } from "@/lib/session";

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["AREA_MANAGER", "STORE_STAFF"]),
  storeId: z.string().optional(),
  lineUserId: z.string().optional(),
});

export async function createUser(_prev: string | undefined, formData: FormData): Promise<string | undefined> {
  await requireAreaManager();
  const parsed = schema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role"),
    storeId: formData.get("storeId") || undefined,
    lineUserId: formData.get("lineUserId") || undefined,
  });
  if (!parsed.success) return "入力内容を確認してください。";
  const password = String(formData.get("password") ?? "");
  if (password.length < 6) return "パスワードは6文字以上にしてください。";

  const exists = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (exists) return "このメールアドレスは既に登録されています。";

  await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      role: parsed.data.role,
      storeId: parsed.data.role === "STORE_STAFF" ? parsed.data.storeId || null : null,
      lineUserId: parsed.data.lineUserId || null,
      passwordHash: await bcrypt.hash(password, 10),
    },
  });
  revalidatePath("/users");
  return "OK";
}

export async function updateUserLine(formData: FormData) {
  await requireAreaManager();
  const id = String(formData.get("id"));
  await prisma.user.update({ where: { id }, data: { lineUserId: String(formData.get("lineUserId") ?? "") || null } });
  revalidatePath("/users");
}

export async function resetPassword(formData: FormData) {
  await requireAreaManager();
  const id = String(formData.get("id"));
  const pw = String(formData.get("password") ?? "");
  if (pw.length < 6) return;
  await prisma.user.update({ where: { id }, data: { passwordHash: await bcrypt.hash(pw, 10) } });
  revalidatePath("/users");
}

export async function deleteUser(formData: FormData) {
  await requireAreaManager();
  const id = String(formData.get("id"));
  await prisma.user.delete({ where: { id } });
  revalidatePath("/users");
}
