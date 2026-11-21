import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { dueStateOf, effectiveDueDate, isDone, isRequiredFor, isVideoVisibleTo, statusOf } from "@/lib/videos";
import { getAssignmentsForUser } from "@/lib/assignments";
import { todayJst } from "@/lib/time";
import { youtubeThumbnail } from "@/lib/youtube";
import { VideoList, type VideoItem } from "./video-list";
import { QUIZ_ENABLED } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const viewer = { role: user.role, position: user.position, brand: user.storeBrand };
  const today = todayJst();

  // 自分の記録だけを読む（userId は必ずログイン中の本人）
  const [videos, progresses, attempts, assignments, feedbacks] = await Promise.all([
    prisma.video.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: { _count: { select: { questions: true } } },
    }),
    prisma.viewProgress.findMany({ where: { userId: user.id } }),
    prisma.quizAttempt.findMany({ where: { userId: user.id }, select: { videoId: true, percent: true, passed: true } }),
    getAssignmentsForUser(user.id),
    prisma.reflection.findMany({ where: { userId: user.id }, select: { videoId: true } }),
  ]);
  const feedbackSet = new Set(feedbacks.map((f) => f.videoId));
  const progressMap = new Map(progresses.map((p) => [p.videoId, p]));

  const items: VideoItem[] = videos
    .filter((v) => isVideoVisibleTo(v, viewer, assignments.has(v.id)))
    .map((v) => {
      const mine = attempts.filter((a) => a.videoId === v.id);
      const passed = mine.some((a) => a.passed);
      const p = progressMap.get(v.id);
      const hasQuiz = QUIZ_ENABLED && v._count.questions > 0;
      const status = statusOf(p, { passed, hasQuiz, hasFeedback: feedbackSet.has(v.id) });
      const done = isDone(status);
      const assignment = assignments.get(v.id) ?? null;
      const required = isRequiredFor(v, viewer, assignment);
      const dueDate = effectiveDueDate(v, assignment);
      const dueState = dueStateOf(dueDate, today);
      // 期限が過ぎた・近い必修（未完了）を一番上に出す
      const priority = required && !done ? (dueState === "OVERDUE" ? 0 : dueState === "SOON" ? 1 : 2) : done ? 4 : 3;
      return {
        id: v.id,
        title: v.title,
        category: v.category,
        series: v.series,
        durationSec: v.durationSec,
        thumbnail: youtubeThumbnail(v.youtubeUrl),
        ready: !!youtubeThumbnail(v.youtubeUrl) && v.durationSec > 0,
        isPublished: v.isPublished,
        required,
        assigned: !!assignment,
        dueDate,
        dueState,
        status,
        percent: p?.percent ?? 0,
        bestScore: QUIZ_ENABLED && mine.length ? Math.max(...mine.map((a) => a.percent)) : null,
        hasQuiz,
        done,
        priority,
      };
    })
    .sort((a, b) => a.priority - b.priority || (a.priority <= 1 ? (a.dueDate ?? "").localeCompare(b.dueDate ?? "") : 0));

  return (
    <div>
      <PageHeader
        title="研修動画"
        description={
          user.isAdmin
            ? "本部はすべての動画を確認できます（スタッフには対象の動画だけが表示されます）。"
            : "あなたが対象の動画です。視聴したあと、感想と今後の実用法（フィードバック）を書くと完了になります。"
        }
      />
      <VideoList items={items} />
    </div>
  );
}
