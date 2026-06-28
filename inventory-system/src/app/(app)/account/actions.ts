"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, realUserId } from "@/lib/session";

export async function changePassword(
  _prev: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const user = await requireUser();
  const uid = realUserId(user);
  if (!uid) return "店舗共通(PIN)アカウントではパスワード変更できません。";

  const parsed = z
    .object({
      current: z.string().min(1),
      next: z.string().min(6, "新しいパスワードは6文字以上にしてください。"),
    })
    .safeParse({ current: formData.get("current"), next: formData.get("next") });
  if (!parsed.success) return parsed.error.issues[0].message;

  const dbUser = await prisma.user.findUnique({ where: { id: uid } });
  if (!dbUser) return "ユーザーが見つかりません。";

  const ok = await bcrypt.compare(parsed.data.current, dbUser.passwordHash);
  if (!ok) return "現在のパスワードが正しくありません。";

  await prisma.user.update({
    where: { id: uid },
    data: { passwordHash: await bcrypt.hash(parsed.data.next, 10) },
  });
  return "OK";
}
