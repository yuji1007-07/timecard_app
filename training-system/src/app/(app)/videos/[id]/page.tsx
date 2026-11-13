import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Clock, Lock } from "lucide-react";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { CATEGORIES, QUIZ_PASS_RATIO, WATCH_COMPLETE_RATIO, label } from "@/lib/constants";
import { dueStateOf, effectiveDueDate, isRequiredFor, isVideoVisibleTo, statusOf } from "@/lib/videos";
import { getAssignment } from "@/lib/assignments";
import { fmtDueDate, fmtDuration, todayJst } from "@/lib/time";
import { youtubeId } from "@/lib/youtube";
import { VideoPlayer } from "./player";
import { QuizSection, type QuizQuestionView } from "./quiz-section";
import { ReflectionForm } from "./reflection-form";
import { InquiryForm } from "./inquiry-form";

export const dynamic = "force-dynamic";

function shuffle<T>(list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default async function VideoPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const viewer = { role: user.role, position: user.position, brand: user.storeBrand };

  const video = await prisma.video.findUnique({ where: { id }, include: { questions: { orderBy: { sortOrder: "asc" } } } });
  // 対象外の動画は「存在しない」扱い（URL を直接開いても見られない）
  const assignment = video ? await getAssignment(user.id, id) : null;
  if (!video || !isVideoVisibleTo(video, viewer, !!assignment)) notFound();

  // 自分の記録だけを読む
  const [progress, attempts, reflection, inquiries] = await Promise.all([
    prisma.viewProgress.findUnique({ where: { userId_videoId: { userId: user.id, videoId: id } } }),
    prisma.quizAttempt.findMany({ where: { userId: user.id, videoId: id }, select: { percent: true, passed: true } }),
    prisma.reflection.findUnique({ where: { userId_videoId: { userId: user.id, videoId: id } } }),
    // Q&A: 回答済みは全員に表示。未回答は投稿した本人にだけ表示
    prisma.inquiry.findMany({
      where: { videoId: id, OR: [{ answeredAt: { not: null } }, { userId: user.id }] },
      orderBy: [{ positionSec: "asc" }, { createdAt: "asc" }],
      include: { user: { select: { name: true } } },
    }),
  ]);

  const ytId = youtubeId(video.youtubeUrl);
  const ready = !!ytId && video.durationSec > 0;
  const completed = !!progress?.completedAt;
  const passed = attempts.some((a) => a.passed);
  const status = statusOf(progress, passed);
  const bestScore = attempts.length ? Math.max(...attempts.map((a) => a.percent)) : null;
  const required = isRequiredFor(video, viewer, assignment);
  const dueDate = effectiveDueDate(video, assignment);
  const dueState = dueStateOf(dueDate, todayJst());
  const hasQuiz = video.questions.length > 0;
  const completePercent = Math.round(WATCH_COMPLETE_RATIO * 100);
  const passPercent = Math.round(QUIZ_PASS_RATIO * 100);

  // 続きから再生。ほぼ最後まで見ていたら頭から
  const last = progress?.lastPosition ?? 0;
  const startAt = last > video.durationSec - 5 ? 0 : last;

  // 正解番号はブラウザに渡さない。問題と選択肢の並びは開くたびにシャッフル
  const questions: QuizQuestionView[] = shuffle(video.questions).map((q) => ({
    id: q.id,
    text: q.text,
    choices: shuffle(q.choices.map((text, index) => ({ index, text }))),
  }));

  // 名前を伏せた質問は、名前そのものをブラウザに渡さない
  const qa = inquiries.map((q) => ({
    id: q.id,
    positionSec: q.positionSec,
    body: q.body,
    answer: q.answer,
    answered: !!q.answeredAt,
    mine: q.userId === user.id,
    name: q.showName ? q.user.name : null,
  }));

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/dashboard" prefetch={false} className="mb-3 inline-flex h-10 items-center gap-1 text-sm text-muted-foreground hover:text-navy">
        <ChevronLeft className="h-4 w-4" />
        研修動画の一覧へ
      </Link>

      <div className="mb-4">
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          {required && <Badge variant="bad">必修</Badge>}
          {assignment && <Badge className="border-transparent bg-purple-100 text-purple-800">あなたに指定</Badge>}
          <Badge variant="outline">{label(CATEGORIES, video.category)}</Badge>
          <StatusBadge status={status} percent={progress?.percent ?? 0} />
          {!video.isPublished && <Badge variant="muted">非公開</Badge>}
        </div>
        <h1 className="text-xl font-bold leading-snug text-navy md:text-2xl">{video.title}</h1>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span>長さ {fmtDuration(video.durationSec)}</span>
          {dueDate && (
            <span className={status === "PASSED" ? "" : dueState === "OVERDUE" ? "font-medium text-red-600" : dueState === "SOON" ? "font-medium text-yellow-700" : ""}>
              期限 {fmtDueDate(dueDate)}
            </span>
          )}
          {progress?.viewCount ? <span>視聴 {progress.viewCount}回</span> : null}
        </div>
      </div>

      <div className="space-y-5">
        {/* 1. 動画 */}
        <Card className="overflow-hidden">
          {ready ? (
            <VideoPlayer
              videoId={video.id}
              youtubeId={ytId!}
              durationSec={video.durationSec}
              startAt={startAt}
              initialPercent={progress?.percent ?? 0}
              initialCompleted={completed}
              completePercent={completePercent}
            />
          ) : (
            <div className="flex aspect-video flex-col items-center justify-center gap-2 bg-navy/90 text-white">
              <Clock className="h-10 w-10" />
              <div className="text-lg font-semibold">準備中</div>
              <div className="px-6 text-center text-sm text-white/70">動画を準備しています。公開までしばらくお待ちください。</div>
            </div>
          )}
          {video.description && (
            <CardContent className="whitespace-pre-wrap border-t pt-4 text-sm leading-relaxed">{video.description}</CardContent>
          )}
        </Card>

        {/* 2. 理解度テスト */}
        {hasQuiz && (
          <Card id="quiz">
            <CardHeader>
              <CardTitle>理解度テスト</CardTitle>
              <CardDescription>
                4択 {video.questions.length}問・{passPercent}点以上で合格。何回でも受け直せます。
                {attempts.length > 0 && (
                  <span className="mt-1 block font-medium text-navy">
                    これまでの最高 {bestScore}点（受験 {attempts.length}回）{passed ? "・合格済み" : ""}
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {completed ? (
                <QuizSection videoId={video.id} questions={questions} passPercent={passPercent} />
              ) : (
                <div className="flex items-center gap-3 rounded-lg bg-muted/60 p-4 text-sm text-muted-foreground" data-testid="quiz-locked">
                  <Lock className="h-5 w-5 shrink-0" />
                  動画を {completePercent}%以上 視聴すると、テストを受けられます。
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 3. ふりかえり */}
        {completed && (!hasQuiz || attempts.length > 0) && (
          <Card id="reflection">
            <CardHeader>
              <CardTitle>ふりかえり</CardTitle>
              <CardDescription>自己評価と、明日からやることを1行で書いてください。</CardDescription>
            </CardHeader>
            <CardContent>
              <ReflectionForm videoId={video.id} initialRating={reflection?.selfRating ?? null} initialAction={reflection?.action ?? ""} />
            </CardContent>
          </Card>
        )}

        {/* 4. 質問と Q&A */}
        <Card id="qa">
          <CardHeader>
            <CardTitle>質問・Q&amp;A</CardTitle>
            <CardDescription>分からないところは、その場で質問できます。本部が回答すると、ここに Q&amp;A として表示されます。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {ready && <InquiryForm videoId={video.id} />}
            {qa.length === 0 ? (
              <p className="text-sm text-muted-foreground">まだ Q&amp;A はありません。</p>
            ) : (
              <ul className="space-y-3">
                {qa.map((q) => (
                  <li key={q.id} className="rounded-lg border p-3 text-sm" data-testid="qa-item">
                    <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="rounded bg-navy px-1.5 py-0.5 font-medium tabular-nums text-white">{fmtDuration(q.positionSec)}</span>
                      <span>{q.name ?? "匿名"}</span>
                      {q.mine && <Badge variant="outline">自分の質問</Badge>}
                      {!q.answered && <Badge variant="warn">回答待ち</Badge>}
                    </div>
                    <p className="whitespace-pre-wrap font-medium leading-relaxed">Q. {q.body}</p>
                    {q.answered && (
                      <p className="mt-2 whitespace-pre-wrap rounded-md bg-green-50 p-2.5 leading-relaxed text-green-900">A. {q.answer}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
