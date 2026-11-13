"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, type CurrentUser } from "@/lib/session";
import { isVideoVisibleTo } from "@/lib/videos";
import { getAssignment } from "@/lib/assignments";
import { QUIZ_PASS_RATIO } from "@/lib/constants";

/** ログイン中の本人が見られる動画だけ返す（対象外なら null） */
async function loadVisibleVideo(user: CurrentUser, videoId: string) {
  const video = await prisma.video.findUnique({ where: { id: videoId } });
  if (!video) return null;
  const assigned = !!(await getAssignment(user.id, videoId));
  if (!isVideoVisibleTo(video, { role: user.role, position: user.position, brand: user.storeBrand }, assigned)) return null;
  return video;
}

export type QuizResult = {
  success: true;
  correct: number;
  total: number;
  percent: number;
  passed: boolean;
  /** 問題ID → 選んだ選択肢・正解・解説 */
  results: Record<string, { selectedIndex: number; correctIndex: number; explanation: string }>;
};

/** 理解度テストの採点。視聴完了していないと受けられない */
export async function submitQuiz(_prev: unknown, formData: FormData): Promise<QuizResult | { error: string }> {
  const user = await requireUser();
  const videoId = String(formData.get("videoId") ?? "");
  const video = await loadVisibleVideo(user, videoId);
  if (!video) return { error: "動画が見つかりません。" };

  const progress = await prisma.viewProgress.findUnique({ where: { userId_videoId: { userId: user.id, videoId } } });
  if (!progress?.completedAt) return { error: "動画を最後まで視聴するとテストを受けられます。" };

  const questions = await prisma.quizQuestion.findMany({ where: { videoId }, orderBy: { sortOrder: "asc" } });
  if (questions.length === 0) return { error: "この動画にはテストがありません。" };

  const results: QuizResult["results"] = {};
  const answers: { questionId: string; selectedIndex: number; isCorrect: boolean }[] = [];
  for (const q of questions) {
    const raw = formData.get(`q_${q.id}`);
    const selectedIndex = raw === null ? NaN : Number(raw);
    if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= q.choices.length) {
      return { error: "まだ答えていない問題があります。すべて選んでから採点してください。" };
    }
    const isCorrect = selectedIndex === q.correctIndex;
    answers.push({ questionId: q.id, selectedIndex, isCorrect });
    results[q.id] = { selectedIndex, correctIndex: q.correctIndex, explanation: q.explanation };
  }

  const correct = answers.filter((a) => a.isCorrect).length;
  const total = questions.length;
  const percent = Math.round((correct / total) * 100);
  const passed = correct / total >= QUIZ_PASS_RATIO;

  await prisma.quizAttempt.create({
    data: { userId: user.id, videoId, correct, total, percent, passed, answers: { create: answers } },
  });
  return { success: true, correct, total, percent, passed, results };
}

const reflectionSchema = z.object({
  videoId: z.string().min(1),
  selfRating: z.coerce.number().int().min(1, "自己評価を選んでください").max(5),
  action: z.string().trim().min(1, "「明日からやること」を入力してください").max(200, "200文字以内で入力してください"),
});

/** ふりかえり（自己評価と「明日からやること」）。テストを1回以上受けたあとに書ける */
export async function saveReflection(_prev: unknown, formData: FormData) {
  const user = await requireUser();
  const parsed = reflectionSchema.safeParse({
    videoId: formData.get("videoId"),
    selfRating: formData.get("selfRating") ?? 0,
    action: formData.get("action") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { videoId, selfRating } = parsed.data;
  const action = parsed.data.action.replace(/\s*\n+\s*/g, " ");

  const video = await loadVisibleVideo(user, videoId);
  if (!video) return { error: "動画が見つかりません。" };
  const [attempts, questionCount, progress] = await Promise.all([
    prisma.quizAttempt.count({ where: { userId: user.id, videoId } }),
    prisma.quizQuestion.count({ where: { videoId } }),
    prisma.viewProgress.findUnique({ where: { userId_videoId: { userId: user.id, videoId } } }),
  ]);
  if (!progress?.completedAt) return { error: "動画の視聴が完了してから入力してください。" };
  if (questionCount > 0 && attempts === 0) return { error: "先に理解度テストを受けてください。" };

  await prisma.reflection.upsert({
    where: { userId_videoId: { userId: user.id, videoId } },
    create: { userId: user.id, videoId, selfRating, action },
    update: { selfRating, action },
  });
  return { success: true, message: "ふりかえりを保存しました。" };
}

const inquirySchema = z.object({
  videoId: z.string().min(1),
  body: z.string().trim().min(1, "質問を入力してください").max(1000, "1000文字以内で入力してください"),
  positionSec: z.coerce.number().min(0).catch(0),
});

/** 質問の投稿（そのときの再生位置つき） */
export async function postInquiry(_prev: unknown, formData: FormData) {
  const user = await requireUser();
  const parsed = inquirySchema.safeParse({
    videoId: formData.get("videoId"),
    body: formData.get("body") ?? "",
    positionSec: formData.get("positionSec") ?? 0,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const video = await loadVisibleVideo(user, parsed.data.videoId);
  if (!video) return { error: "動画が見つかりません。" };

  await prisma.inquiry.create({
    data: {
      userId: user.id,
      videoId: video.id,
      body: parsed.data.body,
      positionSec: Math.min(Math.floor(parsed.data.positionSec), Math.max(video.durationSec, 0)),
      showName: formData.get("showName") === "on",
    },
  });
  return { success: true, message: "質問を送りました。本部からの回答をお待ちください。" };
}
