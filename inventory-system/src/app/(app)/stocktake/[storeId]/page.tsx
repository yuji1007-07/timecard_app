import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { requireUser, canAccessStore } from "@/lib/session";
import { getStoreInventory } from "@/lib/inventory";
import { jstDayKey, isAfterStocktake } from "@/lib/stock";
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

  const [inv, existing, storeTxs, stPids] = await Promise.all([
    getStoreInventory(storeId),
    // 既存の同月棚卸（あれば実数を初期表示）
    prisma.stocktake.findUnique({
      where: { storeId_targetMonth: { storeId, targetMonth: month } },
      include: { items: true },
    }),
    // この店舗の取引（記録の有無・棚卸日以降の件数の算出に使う）
    prisma.transaction.findMany({ where: { storeId }, select: { productId: true, date: true, createdAt: true } }),
    // この店舗で棚卸されたことがある商品
    prisma.stocktakeItem.findMany({
      where: { stocktake: { storeId } },
      select: { productId: true },
      distinct: ["productId"],
    }),
  ]);

  const prevMap = new Map((existing?.items ?? []).map((i) => [i.productId, i.actualQty]));

  // 入荷も棚卸も一度も記録が無い商品＝「在庫0」ではなく「まだ登録しただけ」
  const hasRecord = new Set([...storeTxs.map((t) => t.productId), ...stPids.map((s) => s.productId)]);

  const rows = inv.map((r) => ({
    productId: r.productId,
    name: r.name,
    size: r.size,
    brandName: r.brandName,
    brandColor: r.brandColor,
    unit: r.unit,
    theoretical: r.stock,
    noRecord: !hasRecord.has(r.productId),
    prevActual: prevMap.has(r.productId) ? prevMap.get(r.productId)! : null,
  }));

  // 取引日ごとの件数（棚卸日を過去にしたとき「その後の取引◯件が上乗せされる」と示すため）
  const txCountByDay: Record<string, number> = {};
  for (const t of storeTxs) {
    const d = jstDayKey(t.date);
    txCountByDay[d] = (txCountByDay[d] ?? 0) + 1;
  }

  let already: {
    countedDays: string[];
    confirmedAt: string;
    assigneeName: string | null;
    txSince: number;
  } | null = null;
  if (existing) {
    const base = { base: 0, countedOn: existing.countedOn, confirmedAt: existing.confirmedAt };
    // この月の棚卸で使われている棚卸日（一部の商品だけ別の日に数え直していれば複数）
    const days = new Set(
      existing.items.map((i) => jstDayKey(i.countedOn ?? existing.countedOn ?? existing.confirmedAt))
    );
    if (days.size === 0) days.add(jstDayKey(existing.countedOn ?? existing.confirmedAt));
    already = {
      countedDays: [...days].sort(),
      confirmedAt: new Date(existing.confirmedAt).toLocaleString("ja-JP", {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }),
      assigneeName: existing.assigneeName,
      txSince: storeTxs.filter((t) => isAfterStocktake(t, base)).length,
    };
  }

  return (
    <div>
      <PageHeader
        title={`棚卸入力 — ${store.name}`}
        description={`対象月: ${month}｜理論在庫を確認しながら、実際に数えた在庫を入力してください。`}
      />
      <StocktakeForm
        storeId={storeId}
        month={month}
        rows={rows}
        assigneeDefault={user.name ?? ""}
        todayJst={jstDayKey(new Date())}
        txCountByDay={txCountByDay}
        already={already}
      />
    </div>
  );
}
