// 動画の個人指定の読み出し。
// テーブル追加前の本番DB（/api/setup をまだ開き直していない状態）でも画面が落ちないよう、
// 「テーブルが無い」エラーのときは「個人指定なし」として扱う。

import { prisma } from "@/lib/prisma";
import type { AssignmentRule } from "@/lib/videos";

function isMissingTable(e: unknown): boolean {
  const code = (e as { code?: string })?.code;
  return code === "P2021" || code === "P2010" || /VideoAssignment/.test(String((e as Error)?.message ?? ""));
}

/** その人に個人指定されている動画（動画ID → 設定） */
export async function getAssignmentsForUser(userId: string): Promise<Map<string, AssignmentRule>> {
  try {
    const rows = await prisma.videoAssignment.findMany({ where: { userId }, select: { videoId: true, required: true, dueDate: true } });
    return new Map(rows.map((r) => [r.videoId, { required: r.required, dueDate: r.dueDate }]));
  } catch (e) {
    if (isMissingTable(e)) return new Map();
    throw e;
  }
}

/** その人×その動画の個人指定（無ければ null） */
export async function getAssignment(userId: string, videoId: string): Promise<AssignmentRule | null> {
  try {
    const r = await prisma.videoAssignment.findUnique({ where: { videoId_userId: { videoId, userId } }, select: { required: true, dueDate: true } });
    return r ? { required: r.required, dueDate: r.dueDate } : null;
  } catch (e) {
    if (isMissingTable(e)) return null;
    throw e;
  }
}

/** 複数スタッフ分の個人指定（進捗表用）。キーは `${userId}:${videoId}` */
export async function getAssignmentsForUsers(userIds: string[]): Promise<Map<string, AssignmentRule>> {
  try {
    const rows = await prisma.videoAssignment.findMany({ where: { userId: { in: userIds } }, select: { userId: true, videoId: true, required: true, dueDate: true } });
    return new Map(rows.map((r) => [`${r.userId}:${r.videoId}`, { required: r.required, dueDate: r.dueDate }]));
  } catch (e) {
    if (isMissingTable(e)) return new Map();
    throw e;
  }
}
