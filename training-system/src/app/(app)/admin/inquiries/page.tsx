import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { fmtDateTime } from "@/lib/time";
import { InquiryBox, type InquiryRow } from "./inquiry-box";

export const dynamic = "force-dynamic";

export default async function InquiriesPage() {
  await requireAdmin();
  const list = await prisma.inquiry.findMany({
    include: { user: { include: { store: true } }, video: { select: { id: true, title: true } } },
    orderBy: { createdAt: "desc" },
  });
  const rows: InquiryRow[] = list.map((q) => ({
    id: q.id,
    videoId: q.video.id,
    videoTitle: q.video.title,
    positionSec: q.positionSec,
    body: q.body,
    answer: q.answer ?? "",
    answered: !!q.answeredAt,
    userName: q.user.name,
    storeName: q.user.store?.name ?? "（店舗なし）",
    showName: q.showName,
    createdAt: fmtDateTime(q.createdAt),
    answeredAt: q.answeredAt ? fmtDateTime(q.answeredAt) : null,
  }));
  return (
    <div>
      <PageHeader title="質問箱" description="スタッフからの質問に回答します。回答すると、その動画のページに Q&A として表示されます。" />
      <InquiryBox rows={rows} />
    </div>
  );
}
