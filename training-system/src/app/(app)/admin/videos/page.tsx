import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AUDIENCES, CATEGORIES, REQUIRED_SCOPES, label } from "@/lib/constants";
import { fmtDueDate, fmtDuration } from "@/lib/time";
import { youtubeId } from "@/lib/youtube";
import { NewVideoForm } from "./video-form";

export const dynamic = "force-dynamic";

export default async function AdminVideosPage() {
  await requireAdmin();
  const videos = await prisma.video.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { questions: true } } },
  });
  return (
    <div>
      <PageHeader title="動画・テスト管理" description="研修動画とテスト問題の登録・編集ができます。YouTube の URL を入れると、スタッフが視聴できるようになります。" />
      <div className="mb-6">
        <NewVideoForm />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>動画一覧（{videos.length}本）</CardTitle>
        </CardHeader>
        <CardContent className="divide-y p-0">
          {videos.map((v) => (
            <div key={v.id} className="flex flex-wrap items-center gap-3 px-5 py-4" data-testid="admin-video-row">
              <div className="min-w-0 flex-1 basis-64">
                <div className="font-semibold text-navy">{v.title}</div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline">{label(CATEGORIES, v.category)}</Badge>
                  <Badge variant="outline">対象: {v.audience === "ALL" ? "全員" : "責任者"}</Badge>
                  {v.requiredScope !== "NONE" && <Badge variant="bad">{label(REQUIRED_SCOPES, v.requiredScope)}</Badge>}
                  {youtubeId(v.youtubeUrl) ? <Badge variant="good">URL登録済み</Badge> : <Badge variant="warn">準備中（URL未登録）</Badge>}
                  {!v.isPublished && <Badge variant="muted">非公開</Badge>}
                </div>
                <div className="mt-1.5 text-xs text-muted-foreground">
                  長さ {fmtDuration(v.durationSec)}・テスト {v._count.questions}問{v.dueDate ? `・期限 ${fmtDueDate(v.dueDate)}` : ""}・並び順 {v.sortOrder}
                  <span className="hidden">{label(AUDIENCES, v.audience)}</span>
                </div>
              </div>
              <Button asChild variant="outline">
                <Link href={`/admin/videos/${v.id}`} prefetch={false}>
                  編集・テスト問題
                </Link>
              </Button>
            </div>
          ))}
          {videos.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">動画がまだありません。</div>}
        </CardContent>
      </Card>
    </div>
  );
}
