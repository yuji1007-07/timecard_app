import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QUIZ_PASS_RATIO } from "@/lib/constants";
import { fmtDuration } from "@/lib/time";
import { EditVideoForm } from "../video-form";
import { NewQuestionForm, QuestionEditor } from "./question-form";
import { AssignmentPanel } from "./assignment-panel";
import { POSITIONS, label } from "@/lib/constants";
import { fmtDueDate } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function AdminVideoEditPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const video = await prisma.video.findUnique({ where: { id }, include: { questions: { orderBy: { sortOrder: "asc" } } } });
  if (!video) notFound();

  const [assignments, staff] = await Promise.all([
    prisma.videoAssignment.findMany({ where: { videoId: id }, include: { user: { include: { store: true } } }, orderBy: { createdAt: "asc" } }),
    prisma.user.findMany({ where: { role: "STAFF", isActive: true }, include: { store: true }, orderBy: [{ store: { sortOrder: "asc" } }, { name: "asc" }] }),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/admin/videos" prefetch={false} className="mb-3 inline-flex h-10 items-center gap-1 text-sm text-muted-foreground hover:text-navy">
        <ChevronLeft className="h-4 w-4" />
        動画・テスト管理へ
      </Link>
      <PageHeader
        title={video.title}
        description="動画の内容とテスト問題を編集します。"
        action={
          <Button asChild variant="outline">
            <Link href={`/videos/${video.id}`} prefetch={false}>
              スタッフの画面で確認
            </Link>
          </Button>
        }
      />
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>動画の内容</CardTitle>
          </CardHeader>
          <CardContent>
            <EditVideoForm
              video={{
                id: video.id,
                title: video.title,
                youtubeUrl: video.youtubeUrl,
                duration: fmtDuration(video.durationSec),
                category: video.category,
                audience: video.audience,
                requiredScope: video.requiredScope,
                dueDate: video.dueDate ?? "",
                description: video.description,
                sortOrder: video.sortOrder,
                isPublished: video.isPublished,
              }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>個人指定（{assignments.length}名）</CardTitle>
            <CardDescription>
              ブランド・役職の対象とは別に、この動画を見てほしいスタッフを1人ずつ指定できます。指定された人には、対象外の動画でも一覧に表示されます。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AssignmentPanel
              videoId={video.id}
              assigned={assignments.map((a) => ({
                id: a.id,
                userId: a.userId,
                name: a.user.name,
                sub: `${a.user.store?.name ?? "（店舗なし）"} / ${label(POSITIONS, a.user.position)}`,
                required: a.required,
                due: a.dueDate ? fmtDueDate(a.dueDate) : null,
              }))}
              staff={staff.map((u) => ({
                id: u.id,
                name: u.name,
                position: label(POSITIONS, u.position),
                storeId: u.storeId ?? "",
                storeName: u.store?.name ?? "（店舗なし）",
              }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>テスト問題（{video.questions.length}問）</CardTitle>
            <CardDescription>
              4択問題です。{Math.round(QUIZ_PASS_RATIO * 100)}%以上の正解で合格になります（5問なら4問以上）。問題が0問の動画は、視聴完了だけで「完了」になります。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {video.questions.map((q, i) => (
              <QuestionEditor
                key={q.id}
                videoId={video.id}
                no={i + 1}
                q={{ id: q.id, sortOrder: q.sortOrder, text: q.text, choices: q.choices, correctIndex: q.correctIndex, explanation: q.explanation }}
              />
            ))}
            <NewQuestionForm videoId={video.id} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
