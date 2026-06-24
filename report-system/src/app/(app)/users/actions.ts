"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAreaManager } from "@/lib/session";

const schema = z.object({
  email: z.string().email("正しいメールアドレスを入力してください"),
  name: z.string().min(1, "氏名は必須です"),
  password: z.string().min(6, "パスワードは6文字以上にしてください"),
  role: z.enum(["AREA_MANAGER", "STORE_MANAGER", "DEPARTMENT_MANAGER"]),
  storeId: z.string().optional(),
  departmentId: z.string().optional(),
  lineUserId: z.string().optional(),
});

export async function createUser(_prev: unknown, formData: FormData) {
  await requireAreaManager();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const exists = await prisma.user.findUnique({ where: { email: d.email } });
  if (exists) return { error: "このメールアドレスは既に登録されています。" };

  await prisma.user.create({
    data: {
      email: d.email,
      name: d.name,
      passwordHash: await bcrypt.hash(d.password, 10),
      role: d.role,
      storeId: d.role === "AREA_MANAGER" ? null : d.storeId || null,
      departmentId: d.role === "DEPARTMENT_MANAGER" ? d.departmentId || null : null,
      lineUserId: d.lineUserId || null,
    },
  });
  revalidatePath("/users");
  return { success: true };
}

export async function deleteUser(formData: FormData) {
  await requireAreaManager();
  await prisma.user.delete({ where: { id: String(formData.get("id")) } });
  revalidatePath("/users");
}
