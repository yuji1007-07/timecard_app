import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { QuizStats, type VideoStat } from "./quiz-stats";

export const dynamic = "force-dynamic";

export default async function QuizStatsPage() {
  await requireAdmin();
  const [videos, grouped, attemptStats, passers] = await Promise.all([
    prisma.video.findMany({
      where: { questions: { some: {} } },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: { questions: { orderBy: { sortOrder: "asc" } } },
    }),
    prisma.quizAnswer.groupBy({ by: ["questionId", "selectedIndex"], _count: { _all: true } }),
    prisma.quizAttempt.groupBy({ by: ["videoId"], _count: { _all: true }, _avg: { percent: true } }),
    prisma.quizAttempt.findMany({ where: { passed: true }, select: { videoId: true, userId: true }, distinct: ["videoId", "userId"] }),
  ]);
  const testers = await prisma.quizAttempt.findMany({ select: { videoId: true, userId: true }, distinct: ["videoId", "userId"] });

  const stats: VideoStat[] = videos.map((v) => {
    const a = attemptStats.find((s) => s.videoId === v.id);
    return {
      id: v.id,
      title: v.title,
      attempts: a?._count._all ?? 0,
      average: a?._avg.percent != null ? Math.round(a._avg.percent) : null,
      testers: testers.filter((t) => t.videoId === v.id).length,
      passers: passers.filter((t) => t.videoId === v.id).length,
      questions: v.questions.map((q, i) => {
        const counts = q.choices.map((_, ci) => grouped.find((g) => g.questionId === q.id && g.selectedIndex === ci)?._count._all ?? 0);
        const total = counts.reduce((x, y) => x + y, 0);
        return {
          id: q.id,
          no: i + 1,
          text: q.text,
          choices: q.choices,
          correctIndex: q.correctIndex,
          counts,
          total,
          rate: total > 0 ? Math.round((counts[q.correctIndex] / total) * 100) : null,
        };
      }),
    };
  });

  return (
    <div>
      <PageHeader title="テストの正答率" description="問題ごとの正答率と、どの選択肢が選ばれたかを確認できます（受け直しを含む全受験を集計）。正答率が低い問題が、つまずいているところです。" />
      <QuizStats stats={stats} />
    </div>
  );
}
