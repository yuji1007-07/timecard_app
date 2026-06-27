import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/stat-card";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getAllStoresInventorySummary, getStoreInventory } from "@/lib/inventory";
import { BrandValuePie, StoreValueBar } from "@/components/inventory-charts";
import { InventoryAccordion } from "@/components/inventory-accordion";
import { ActionButtons } from "./action-buttons";
import { yen } from "@/lib/constants";

export const dynamic = "force-dynamic";

function monthRange(): { start: Date; end: Date; month: string } {
  const d = new Date();
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  return { start, end, month };
}

async function txSummary(where: object) {
  const { start, end } = monthRange();
  const txs = await prisma.transaction.findMany({
    where: { ...where, date: { gte: start, lt: end } },
    select: { type: true, quantity: true, unitPriceIncl: true },
  });
  const map = new Map<string, { count: number; amount: number }>();
  for (const t of txs) {
    // 移動はOUT側だけ数える（二重計上を避ける）
    if (t.type === "TRANSFER_IN") continue;
    const key = t.type === "TRANSFER_OUT" ? "TRANSFER" : t.type;
    const cur = map.get(key) ?? { count: 0, amount: 0 };
    cur.count++;
    cur.amount += (t.unitPriceIncl ?? 0) * t.quantity;
    map.set(key, cur);
  }
  return map;
}

const SUMMARY_TYPES: { key: string; label: string }[] = [
  { key: "ORDER", label: "発注" },
  { key: "CONSUME", label: "消耗" },
  { key: "TRANSFER", label: "移動" },
  { key: "EMPLOYEE_SALE", label: "社販" },
  { key: "GIFT", label: "プレゼント" },
];

export default async function DashboardPage() {
  const user = await requireUser();
  const { month } = monthRange();

  if (user.role === "AREA_MANAGER") {
    return <AreaDashboard month={month} />;
  }
  return <StoreDashboard storeId={user.storeId} month={month} userName={user.name ?? ""} />;
}

async function AreaDashboard({ month }: { month: string }) {
  const [summary, stores, stocktakes, txMap] = await Promise.all([
    getAllStoresInventorySummary(),
    prisma.store.findMany({ where: { isHeadquarters: false, status: "ACTIVE" }, orderBy: { sortOrder: "asc" } }),
    prisma.stocktake.findMany({ where: { targetMonth: month } }),
    txSummary({}),
  ]);

  const stMap = new Map(stocktakes.map((s) => [s.storeId, s]));
  const notDone = stores.filter((s) => !stMap.has(s.id));
  const diffStores = stocktakes.filter((s) => s.diffCount > 0);
  const totalDiffAmount = stocktakes.reduce((a, s) => a + s.diffAmount, 0);
  const topDiff = [...diffStores].sort((a, b) => b.diffCount - a.diffCount)[0];
  const topDiffStore = topDiff ? stores.find((s) => s.id === topDiff.storeId)?.name : null;

  return (
    <div>
      <PageHeader title="本部ダッシュボード" description={`${month}｜全店舗の在庫・棚卸・ズレを横断確認できます。`} />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="棚卸 未実施店舗" value={`${notDone.length}`} sub={`${stores.length}店舗中`} tone={notDone.length > 0 ? "bad" : "good"} />
        <StatCard label="在庫ズレ発生店舗" value={`${diffStores.length}`} sub={`ズレ総額 ${yen(totalDiffAmount)}`} tone={diffStores.length > 0 ? "warn" : "good"} />
        <StatCard label="在庫不足 商品数" value={`${summary.totalLow}`} tone={summary.totalLow > 0 ? "bad" : "good"} />
        <StatCard label="全店在庫金額（卸）" value={yen(summary.totalWholesale)} sub={`通常 ${yen(summary.totalNormal)}`} />
      </div>

      {/* 棚卸状況・ズレ・操作 */}
      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle className="text-base">棚卸状況（{month}）</CardTitle></CardHeader>
          <CardContent>
            {notDone.length === 0 ? (
              <p className="text-sm text-green-600">全店舗が棚卸済みです。</p>
            ) : (
              <div>
                <p className="mb-2 text-sm font-medium text-red-600">未実施 {notDone.length}店舗</p>
                <div className="flex flex-wrap gap-1">
                  {notDone.map((s) => (
                    <span key={s.id} className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-700">{s.name}</span>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader><CardTitle className="text-base">在庫ズレサマリー</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">ズレ発生店舗</span><span className="font-semibold">{diffStores.length}店舗</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">ズレ総額</span><span className="font-semibold">{yen(totalDiffAmount)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">ズレ件数トップ</span><span className="font-semibold">{topDiffStore ?? "-"}{topDiff ? `（${topDiff.diffCount}件）` : ""}</span></div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader><CardTitle className="text-base">アラート操作</CardTitle></CardHeader>
          <CardContent><ActionButtons /></CardContent>
        </Card>
      </div>

      {/* 取引サマリー */}
      <Card className="mb-4">
        <CardHeader><CardTitle className="text-base">今月の取引サマリー</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {SUMMARY_TYPES.map((t) => {
              const v = txMap.get(t.key) ?? { count: 0, amount: 0 };
              return (
                <div key={t.key} className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">{t.label}</div>
                  <div className="text-xl font-bold tabular-nums text-navy">{v.count}<span className="ml-1 text-xs font-normal text-muted-foreground">件</span></div>
                  <div className="text-xs text-muted-foreground">{yen(v.amount)}</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 在庫金額グラフ */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">ブランド別 在庫金額（卸ベース）</CardTitle></CardHeader>
          <CardContent>
            <BrandValuePie data={summary.brandTotals.map((b) => ({ name: b.name, color: b.color, wholesale: b.wholesale }))} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">店舗別 在庫金額（卸ベース）</CardTitle></CardHeader>
          <CardContent>
            <StoreValueBar data={summary.perStore.map((p) => ({ storeName: p.storeName, valueWholesale: p.valueWholesale }))} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

async function StoreDashboard({ storeId, month, userName }: { storeId: string | null; month: string; userName: string }) {
  if (!storeId) {
    return (
      <div>
        <PageHeader title="店舗ダッシュボード" />
        <Card className="p-6 text-center text-sm text-muted-foreground">店舗が割り当てられていません。本部にお問い合わせください。</Card>
      </div>
    );
  }
  const [store, inv, stocktake, txMap] = await Promise.all([
    prisma.store.findUnique({ where: { id: storeId } }),
    getStoreInventory(storeId),
    prisma.stocktake.findUnique({ where: { storeId_targetMonth: { storeId, targetMonth: month } } }),
    txSummary({ storeId }),
  ]);

  const lowRows = inv.filter((r) => r.low);
  const totalValue = inv.reduce((s, r) => s + r.stockValueWholesale, 0);

  return (
    <div>
      <PageHeader
        title={`${store?.name ?? "店舗"} ダッシュボード`}
        description={`${month}｜${userName} さん`}
        action={
          <Button asChild size="sm"><Link href="/transactions/new">＋ 取引を記録</Link></Button>
        }
      />

      {/* 棚卸ステータス */}
      {!stocktake && (
        <div className="mb-4 flex items-center justify-between rounded-lg border-2 border-red-200 bg-red-50 px-4 py-3">
          <div className="text-sm font-medium text-red-700">今月（{month}）の棚卸が未実施です。</div>
          <Button asChild size="sm"><Link href={`/stocktake/${storeId}?month=${month}`}>棚卸する</Link></Button>
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="在庫金額（卸）" value={yen(totalValue)} />
        <StatCard label="在庫不足" value={`${lowRows.length}`} tone={lowRows.length > 0 ? "bad" : "good"} />
        <StatCard label="棚卸ステータス" value={stocktake ? "済" : "未"} tone={stocktake ? "good" : "bad"} />
        <StatCard label="今月の取引" value={`${[...txMap.values()].reduce((a, v) => a + v.count, 0)}`} sub="件" />
      </div>

      {/* クイック入力 */}
      <div className="mb-4 flex flex-wrap gap-2">
        {[
          { t: "ORDER", l: "発注" },
          { t: "CONSUME", l: "消耗" },
          { t: "TRANSFER", l: "移動" },
          { t: "EMPLOYEE_SALE", l: "社販" },
          { t: "GIFT", l: "プレゼント" },
        ].map((q) => (
          <Button key={q.t} asChild size="sm" variant="outline">
            <Link href={`/transactions/new?type=${q.t}`}>{q.l}を記録</Link>
          </Button>
        ))}
      </div>

      {/* 取引サマリー */}
      <Card className="mb-4">
        <CardHeader><CardTitle className="text-base">今月の取引</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {SUMMARY_TYPES.map((t) => {
              const v = txMap.get(t.key) ?? { count: 0, amount: 0 };
              return (
                <div key={t.key} className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">{t.label}</div>
                  <div className="text-xl font-bold tabular-nums text-navy">{v.count}<span className="ml-1 text-xs font-normal text-muted-foreground">件</span></div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 在庫不足 */}
      {lowRows.length > 0 && (
        <Card className="mb-4 border-red-200">
          <CardHeader><CardTitle className="text-base text-red-700">在庫不足アラート（{lowRows.length}件）</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {lowRows.map((r) => (
                <span key={r.productId} className="rounded-full bg-red-100 px-3 py-1 text-xs text-red-700">
                  {r.brandName} {r.name}：在庫{r.stock}（最小{r.minStock}）
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 在庫一覧 */}
      <h2 className="mb-2 mt-6 text-sm font-semibold text-muted-foreground">在庫一覧（ブランド別）</h2>
      <InventoryAccordion rows={inv} />
    </div>
  );
}
