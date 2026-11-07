"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { SETTING_ALLOW_STORE_EDIT } from "@/lib/constants";

const hqSchema = z.object({
  loginId: z.string().min(1, "管理IDを入力してください。"),
  password: z.string().min(1, "新しいパスワードを入力してください。"),
  password2: z.string(),
});

/** 本部ログイン情報（ID・パスワード）の変更 = ログイン中の本部アカウントを更新する */
export async function saveHqSettings(_prev: unknown, formData: FormData) {
  const me = await requireAdmin();
  const parsed = hqSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { loginId: rawId, password, password2 } = parsed.data;
  const loginId = rawId.trim();
  if (!loginId) return { error: "管理IDを入力してください。" };
  if (password.length < 6) return { error: "パスワードは6文字以上にしてください。" };
  if (password !== password2) return { error: "確認用パスワードが一致しません。" };

  const dup = await prisma.user.findUnique({ where: { loginId } });
  if (dup && dup.id !== me.id) return { error: `ユーザーID「${loginId}」は他のアカウントが使用しています。` };

  await prisma.user.update({ where: { id: me.id }, data: { loginId, passwordHash: await bcrypt.hash(password, 10) } });
  return { success: true, message: "✅ 保存しました。次回のログインから新しいID・パスワードをお使いください。" };
}

/** 店舗アカウントの編集許可 ON/OFF */
export async function setStoreEditPermission(_prev: unknown, formData: FormData) {
  await requireAdmin();
  const on = String(formData.get("allow")) === "1";
  await prisma.setting.upsert({
    where: { key: SETTING_ALLOW_STORE_EDIT },
    create: { key: SETTING_ALLOW_STORE_EDIT, value: on ? "1" : "0" },
    update: { value: on ? "1" : "0" },
  });
  return {
    success: true,
    allow: on,
    message: on ? "✅ 店舗アカウントの編集を「許可」に変更しました。" : "✅ 店舗アカウントの編集を「不可」に変更しました。",
  };
}
