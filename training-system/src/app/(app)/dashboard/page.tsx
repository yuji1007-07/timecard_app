import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { dueStateOf, isDone, isRequiredFor, isVideoVisibleTo, statusOf } from "@/lib/videos";
import { todayJst } from "@/lib/time";
import { youtubeThumbnail } from "@/lib/youtube";
import { VideoList, type VideoItem } from "./video-list";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const viewer = { role: user.role, position: user.position, brand: user.storeBrand };
  const today = todayJst();

  // 自分の記録だけを読む（userId は必ずログイン中の本人）
  const [videos, progresses, attempts] = await Promise.all([
    prisma.video.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: { _count: { select: { questions: true } } },
    }),
    prisma.viewProgress.findMany({ where: { userId: user.id } }),
    prisma.quizAttempt.findMany({ where: { userId: user.id }, select: { videoId: true, percent: true, passed: true } }),
  ]);
  const progressMap = new Map(progresses.map((p) => [p.videoId, p]));

  const items: VideoItem[] = videos
    .filter((v) => isVideoVisibleTo(v, viewer))
    .map((v) => {
      const mine = attempts.filter((a) => a.videoId === v.id);
      const passed = mine.some((a) => a.passed);
      const p = progressMap.get(v.id);
      const status = statusOf(p, passed);
      const hasQuiz = v._count.questions > 0;
      const done = isDone(status, hasQuiz);
      const required = isRequiredFor(v, viewer);
      const dueState = dueStateOf(v.dueDate, today);
      // 期限が過ぎた・近い必修（未完了）を一番上に出す
      const priority = required && !done ? (dueState === "OVERDUE" ? 0 : dueState === "SOON" ? 1 : 2) : done ? 4 : 3;
      return {
        id: v.id,
        title: v.title,
        category: v.category,
        durationSec: v.durationSec,
        thumbnail: youtubeThumbnail(v.youtubeUrl),
        ready: !!youtubeThumbnail(v.youtubeUrl) && v.durationSec > 0,
        isPublished: v.isPublished,
        required,
        dueDate: v.dueDate,
        dueState,
        status,
        percent: p?.percent ?? 0,
        bestScore: mine.length ? Math.max(...mine.map((a) => a.percent)) : null,
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
            : "あなたが対象の動画です。視聴 → 理解度テスト → ふりかえり の順に進めてください。"
        }
      />
      <VideoList items={items} />
    </div>
  );
}
