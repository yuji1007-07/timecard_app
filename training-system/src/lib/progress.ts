// 進捗表（スタッフ×動画）のデータ取得。本部の進捗表・店長の自店舗進捗・未完了者リスト・CSV が共用する。
// 必ず呼び出し側で requireAdmin / requireStoreManager を通し、店長には storeId を固定して渡すこと。

import { prisma } from "@/lib/prisma";
import { POSITION_ORDER } from "@/lib/constants";
import { effectiveDueDate, isDone, isRequiredFor, isVideoVisibleTo, statusOf, type ProgressStatus } from "@/lib/videos";
import { getAssignmentsForUsers } from "@/lib/assignments";
import { fmtDate } from "@/lib/time";

export type MatrixUser = {
  id: string;
  name: string;
  loginId: string;
  position: string;
  storeId: string | null;
  storeName: string;
  brand: string;
};

export type MatrixVideo = {
  id: string;
  title: string;
  category: string;
  dueDate: string | null;
  hasQuiz: boolean;
};

export type MatrixCell = {
  target: boolean; // この人が対象の動画か
  required: boolean;
  assigned: boolean; // 個人指定されているか
  dueDate: string | null; // その人にとっての期限（個人の期限 → 無ければ動画の期限）
  status: ProgressStatus;
  done: boolean; // 研修として完了（テストがあれば合格、無ければ視聴完了）
  percent: number; // 視聴％
  bestScore: number | null; // テスト最高点（％）
  attempts: number;
  completedOn: string | null; // 初回視聴完了日
  lastViewedOn: string | null;
  viewCount: number;
};

export type ProgressMatrix = {
  users: MatrixUser[];
  videos: MatrixVideo[];
  cells: Record<string, Record<string, MatrixCell>>; // cells[userId][videoId]
};

export async function getProgressMatrix(scope: { storeId?: string } = {}): Promise<ProgressMatrix> {
  const [users, videos] = await Promise.all([
    prisma.user.findMany({
      where: { role: "STAFF", isActive: true, ...(scope.storeId ? { storeId: scope.storeId } : {}) },
      include: { store: true },
    }),
    prisma.video.findMany({
      where: { isPublished: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: { _count: { select: { questions: true } } },
    }),
  ]);
  const userIds = users.map((u) => u.id);
  const [progresses, attempts] = await Promise.all([
    prisma.viewProgress.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, videoId: true, percent: true, completedAt: true, lastViewedAt: true, viewCount: true },
    }),
    prisma.quizAttempt.groupBy({
      by: ["userId", "videoId"],
      where: { userId: { in: userIds } },
      _max: { percent: true },
      _count: { _all: true },
    }),
  ]);
  const passedRows = await prisma.quizAttempt.findMany({
    where: { userId: { in: userIds }, passed: true },
    select: { userId: true, videoId: true },
    distinct: ["userId", "videoId"],
  });

  const assignmentMap = await getAssignmentsForUsers(userIds);

  const key = (u: string, v: string) => `${u}:${v}`;
  const progressMap = new Map(progresses.map((p) => [key(p.userId, p.videoId), p]));
  const attemptMap = new Map(attempts.map((a) => [key(a.userId, a.videoId), a]));
  const passedSet = new Set(passedRows.map((a) => key(a.userId, a.videoId)));

  const sortedUsers = [...users].sort((a, b) => {
    const sa = a.store?.sortOrder ?? 9999;
    const sb = b.store?.sortOrder ?? 9999;
    if (sa !== sb) return sa - sb;
    const pa = POSITION_ORDER.indexOf(a.position as (typeof POSITION_ORDER)[number]);
    const pb = POSITION_ORDER.indexOf(b.position as (typeof POSITION_ORDER)[number]);
    if (pa !== pb) return pa - pb;
    return a.name.localeCompare(b.name, "ja");
  });

  const cells: ProgressMatrix["cells"] = {};
  for (const u of sortedUsers) {
    const viewer = { role: u.role, position: u.position, brand: u.store?.brand ?? null };
    cells[u.id] = {};
    for (const v of videos) {
      const p = progressMap.get(key(u.id, v.id));
      const a = attemptMap.get(key(u.id, v.id));
      const hasQuiz = v._count.questions > 0;
      const asg = assignmentMap.get(key(u.id, v.id)) ?? null;
      const status = statusOf(p, passedSet.has(key(u.id, v.id)));
      cells[u.id][v.id] = {
        target: isVideoVisibleTo(v, viewer, !!asg),
        required: isRequiredFor(v, viewer, asg),
        assigned: !!asg,
        dueDate: effectiveDueDate(v, asg),
        status,
        done: isDone(status, hasQuiz),
        percent: p?.percent ?? 0,
        bestScore: a?._max.percent ?? null,
        attempts: a?._count._all ?? 0,
        completedOn: p?.completedAt ? fmtDate(p.completedAt) : null,
        lastViewedOn: p?.lastViewedAt ? fmtDate(p.lastViewedAt) : null,
        viewCount: p?.viewCount ?? 0,
      };
    }
  }

  return {
    users: sortedUsers.map((u) => ({
      id: u.id,
      name: u.name,
      loginId: u.loginId,
      position: u.position,
      storeId: u.storeId,
      storeName: u.store?.name ?? "（店舗なし）",
      brand: u.store?.brand ?? "（店舗なし）",
    })),
    videos: videos.map((v) => ({
      id: v.id,
      title: v.title,
      category: v.category,
      dueDate: v.dueDate,
      hasQuiz: v._count.questions > 0,
    })),
    cells,
  };
}
