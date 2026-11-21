import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { CATEGORIES, QUIZ_ENABLED, REQUIRED_SCOPES, label } from "@/lib/constants";
import { fmtDueDate, fmtDuration } from "@/lib/time";
import { youtubeId } from "@/lib/youtube";
import { NewVideoForm } from "./video-form";
import { VideoAdminList, type AdminVideoRow } from "./video-admin-list";

export const dynamic = "force-dynamic";

export default async function AdminVideosPage() {
  await requireAdmin();
  const videos = await prisma.video.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { questions: true, assignments: true } } },
  });
  const seriesOptions = [...new Set(videos.map((v) => v.series).filter(Boolean))];
  const rows: AdminVideoRow[] = videos.map((v) => ({
    id: v.id,
    title: v.title,
    series: v.series,
    categoryLabel: label(CATEGORIES, v.category),
    audienceLabel: v.audience === "ALL" ? "全員" : v.audience === "ASSIGNED" ? "個人指定のみ" : "責任者",
    requiredLabel: v.requiredScope !== "NONE" ? label(REQUIRED_SCOPES, v.requiredScope) : null,
    assignments: v._count.assignments,
    hasUrl: !!youtubeId(v.youtubeUrl),
    isPublished: v.isPublished,
    meta: [
      `長さ ${fmtDuration(v.durationSec)}`,
      ...(QUIZ_ENABLED ? [`テスト ${v._count.questions}問`] : []),
      ...(v.dueDate ? [`期限 ${fmtDueDate(v.dueDate)}`] : []),
      `並び順 ${v.sortOrder}`,
    ].join("・"),
  }));
  return (
    <div>
      <PageHeader
        title={QUIZ_ENABLED ? "動画・テスト管理" : "動画管理"}
        description="研修動画の登録・編集ができます。YouTube の URL を入れると、スタッフが視聴できるようになります。「シリーズ」を付けると、一覧をタブでまとめられます。"
      />
      <div className="mb-6">
        <NewVideoForm seriesOptions={seriesOptions} />
      </div>
      <VideoAdminList videos={rows} editLabel={QUIZ_ENABLED ? "編集・テスト問題" : "編集・個人指定"} />
    </div>
  );
}
