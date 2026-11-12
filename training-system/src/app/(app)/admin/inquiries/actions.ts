"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

const schema = z.object({
  id: z.string().min(1),
  answer: z.string().trim().min(1, "回答を入力してください").max(2000, "2000文字以内で入力してください"),
});

/** 質問への回答（本部のみ）。回答すると動画ページの Q&A に表示される */
export async function answerInquiry(_prev: unknown, formData: FormData) {
  const me = await requireAdmin();
  const parsed = schema.safeParse({ id: formData.get("id"), answer: formData.get("answer") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const inquiry = await prisma.inquiry.findUnique({ where: { id: parsed.data.id } });
  if (!inquiry) return { error: "質問が見つかりません。" };
  await prisma.inquiry.update({
    where: { id: inquiry.id },
    data: { answer: parsed.data.answer, answeredAt: inquiry.answeredAt ?? new Date(), answeredById: me.id },
  });
  return { success: true, message: "回答を保存しました。" };
}
