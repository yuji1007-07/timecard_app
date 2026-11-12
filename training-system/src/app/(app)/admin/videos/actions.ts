"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { AUDIENCES, CATEGORIES, REQUIRED_SCOPES } from "@/lib/constants";
import { parseDuration } from "@/lib/time";
import { youtubeId } from "@/lib/youtube";

const keys = <T extends Record<string, string>>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];

const videoSchema = z.object({
  title: z.string().trim().min(1, "タイトルは必須です").max(200),
  youtubeUrl: z.string().trim().max(500),
  duration: z.string().trim().min(1, "動画の長さを入力してください（例: 5:15）"),
  category: z.enum(keys(CATEGORIES)),
  audience: z.enum(keys(AUDIENCES)),
  requiredScope: z.enum(keys(REQUIRED_SCOPES)),
  dueDate: z.string().trim(),
  description: z.string().trim().max(4000),
  sortOrder: z.coerce.number().int().min(0).max(100000).catch(0),
  isPublished: z.enum(["1", "0"]),
});

function parseVideo(formData: FormData) {
  const parsed = videoSchema.safeParse({
    title: formData.get("title") ?? "",
    youtubeUrl: formData.get("youtubeUrl") ?? "",
    duration: formData.get("duration") ?? "",
    category: formData.get("category"),
    audience: formData.get("audience"),
    requiredScope: formData.get("requiredScope"),
    dueDate: formData.get("dueDate") ?? "",
    description: formData.get("description") ?? "",
    sortOrder: formData.get("sortOrder") ?? 0,
    isPublished: formData.get("isPublished") ?? "1",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const durationSec = parseDuration(d.duration);
  if (durationSec === null || durationSec <= 0) return { error: "動画の長さは「分:秒」で入力してください（例: 5:15）" };
  if (d.youtubeUrl && !youtubeId(d.youtubeUrl)) return { error: "YouTube の URL を読み取れません。共有ボタンでコピーした URL を貼ってください。" };
  if (d.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(d.dueDate)) return { error: "期限の日付が正しくありません。" };
  return {
    data: {
      title: d.title,
      youtubeUrl: d.youtubeUrl,
      durationSec,
      category: d.category,
      audience: d.audience,
      requiredScope: d.requiredScope,
      dueDate: d.dueDate || null,
      description: d.description,
      sortOrder: d.sortOrder,
      isPublished: d.isPublished === "1",
    },
  };
}

export async function createVideo(_prev: unknown, formData: FormData) {
  await requireAdmin();
  const r = parseVideo(formData);
  if ("error" in r) return { error: r.error };
  const video = await prisma.video.create({ data: r.data });
  return { success: true, message: "動画を登録しました。続けてテスト問題を登録できます。", id: video.id };
}

export async function updateVideo(_prev: unknown, formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const r = parseVideo(formData);
  if ("error" in r) return { error: r.error };
  const exists = await prisma.video.findUnique({ where: { id } });
  if (!exists) return { error: "動画が見つかりません。" };
  await prisma.video.update({ where: { id }, data: r.data });
  return { success: true, message: "動画を更新しました。" };
}

const questionSchema = z.object({
  videoId: z.string().min(1),
  text: z.string().trim().min(1, "問題文は必須です").max(500),
  choices: z.array(z.string().trim().min(1, "選択肢は4つとも入力してください").max(300)).length(4, "選択肢は4つ必要です"),
  correctIndex: z.coerce.number().int().min(0, "正解の選択肢を選んでください").max(3),
  explanation: z.string().trim().max(1000),
  sortOrder: z.coerce.number().int().min(0).max(100000).catch(0),
});

/** テスト問題の追加・更新（id があれば更新） */
export async function saveQuestion(_prev: unknown, formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const parsed = questionSchema.safeParse({
    videoId: formData.get("videoId"),
    text: formData.get("text") ?? "",
    choices: [0, 1, 2, 3].map((i) => String(formData.get(`choice${i}`) ?? "")),
    correctIndex: formData.get("correctIndex") ?? -1,
    explanation: formData.get("explanation") ?? "",
    sortOrder: formData.get("sortOrder") ?? 0,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { videoId, ...data } = parsed.data;
  if (new Set(data.choices).size !== 4) return { error: "同じ内容の選択肢があります。" };

  if (id) {
    const q = await prisma.quizQuestion.findUnique({ where: { id } });
    if (!q || q.videoId !== videoId) return { error: "問題が見つかりません。" };
    await prisma.quizQuestion.update({ where: { id }, data });
    return { success: true, message: "問題を更新しました。" };
  }
  const video = await prisma.video.findUnique({ where: { id: videoId } });
  if (!video) return { error: "動画が見つかりません。" };
  const last = await prisma.quizQuestion.findFirst({ where: { videoId }, orderBy: { sortOrder: "desc" } });
  await prisma.quizQuestion.create({ data: { videoId, ...data, sortOrder: data.sortOrder || (last?.sortOrder ?? 0) + 1 } });
  return { success: true, message: "問題を追加しました。" };
}

/** テスト問題の削除（この問題への回答記録も消える） */
export async function deleteQuestion(_prev: unknown, formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const q = await prisma.quizQuestion.findUnique({ where: { id } });
  if (!q) return { error: "問題が見つかりません。" };
  await prisma.quizQuestion.delete({ where: { id } });
  return { success: true, message: "問題を削除しました。" };
}
