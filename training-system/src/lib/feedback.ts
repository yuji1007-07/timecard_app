// フィードバック一覧のデータ取得。本部は全員分、店長は自店舗分（storeId を必ずサーバー側で固定して渡す）。

import { prisma } from "@/lib/prisma";
import { fmtDate } from "@/lib/time";

export type FeedbackRow = {
  id: string;
  videoId: string;
  videoTitle: string;
  videoOrder: number;
  series: string;
  userName: string;
  position: string;
  storeId: string;
  storeName: string;
  brand: string;
  impression: string;
  action: string;
  date: string;
};

export async function getFeedbackRows(scope: { storeId?: string } = {}): Promise<FeedbackRow[]> {
  const list = await prisma.reflection.findMany({
    where: scope.storeId ? { user: { storeId: scope.storeId } } : {},
    include: { user: { include: { store: true } }, video: { select: { id: true, title: true, sortOrder: true, series: true } } },
    orderBy: { updatedAt: "desc" },
  });
  return list.map((r) => ({
    id: r.id,
    videoId: r.video.id,
    videoTitle: r.video.title,
    videoOrder: r.video.sortOrder,
    series: r.video.series,
    userName: r.user.name,
    position: r.user.position,
    storeId: r.user.storeId ?? "",
    storeName: r.user.store?.name ?? "（店舗なし）",
    brand: r.user.store?.brand ?? "（店舗なし）",
    impression: r.impression,
    action: r.action,
    date: fmtDate(r.updatedAt),
  }));
}
