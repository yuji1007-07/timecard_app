import { Download } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { fmtDate } from "@/lib/time";
import { ReflectionList, type ReflectionRow } from "./reflection-list";

export const dynamic = "force-dynamic";

export default async function ReflectionsPage() {
  await requireAdmin();
  const list = await prisma.reflection.findMany({
    include: { user: { include: { store: true } }, video: { select: { id: true, title: true, sortOrder: true } } },
    orderBy: { updatedAt: "desc" },
  });
  const rows: ReflectionRow[] = list.map((r) => ({
    id: r.id,
    videoId: r.video.id,
    videoTitle: r.video.title,
    videoOrder: r.video.sortOrder,
    userName: r.user.name,
    position: r.user.position,
    storeName: r.user.store?.name ?? "（店舗なし）",
    brand: r.user.store?.brand ?? "（店舗なし）",
    selfRating: r.selfRating,
    action: r.action,
    date: fmtDate(r.updatedAt),
  }));
  return (
    <div>
      <PageHeader
        title="ふりかえり一覧"
        description="スタッフの自己評価（1〜5）と「明日からやること」です。"
        action={
          <Button asChild variant="outline">
            <a href="/api/export/reflections" download>
              <Download />
              ふりかえりCSV
            </a>
          </Button>
        }
      />
      <ReflectionList rows={rows} />
    </div>
  );
}
