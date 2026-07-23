import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { requireUser, canAccessStore } from "@/lib/session";
import { getStoreInventory } from "@/lib/inventory";
import { StocktakeForm } from "./stocktake-form";

export const dynamic = "force-dynamic";

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function StocktakeEntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ storeId: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const user = await requireUser();
  const { storeId } = await params;
  const sp = await searchParams;
  const month = sp.month || currentMonth();

  if (!canAccessStore(user, storeId)) redirect("/stocktake");

  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store) notFound();

  const inv = await getStoreInventory(storeId);

  // 既存の同月棚卸（あれば実数を初期表示）
  const existing = await prisma.stocktake.findUnique({
    where: { storeId_targetMonth: { storeId, targetMonth: month } },
    include: { items: true },
  });
  const prevMap = new Map((existing?.items ?? []).map((i) => [i.productId, i.actualQty]));

  const rows = inv.map((r) => ({
    productId: r.productId,
    name: r.name,
    size: r.size,
    brandName: r.brandName,
    brandColor: r.brandColor,
    unit: r.unit,
    theoretical: r.stock,
    prevActual: prevMap.has(r.productId) ? prevMap.get(r.productId)! : null,
  }));

  return (
    <div>
      <PageHeader
        title={`棚卸入力 — ${store.name}`}
        description={`対象月: ${month}｜理論在庫を確認しながら、実際に数えた在庫を入力してください。`}
      />
      <StocktakeForm storeId={storeId} month={month} rows={rows} assigneeDefault={user.name ?? ""} />
    </div>
  );
}
