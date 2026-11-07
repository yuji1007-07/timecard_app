"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

/** 申込書の削除。店舗担当は自店のものだけ削除できる */
export async function deleteApplication(_prev: unknown, formData: FormData): Promise<{ ok: boolean; message: string }> {
  const me = await requireUser();
  const id = String(formData.get("id") ?? "");
  const row = await prisma.application.findUnique({ where: { id } });
  if (!row) return { ok: false, message: "対象の申込書が見つかりません。" };
  if (!me.isAdmin && row.storeId !== me.storeId) return { ok: false, message: "この申込書を削除する権限がありません。" };
  await prisma.application.delete({ where: { id } });
  return { ok: true, message: "削除しました。" };
}
