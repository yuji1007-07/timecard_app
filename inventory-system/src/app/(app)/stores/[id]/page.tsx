import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/stat-card";
import { prisma } from "@/lib/prisma";
import { requireUser, canAccessStore } from "@/lib/session";
import { getStoreInventory } from "@/lib/inventory";
import { InventoryAccordion } from "@/components/inventory-accordion";
import { DiffTrendChart } from "@/components/inventory-charts";
import { BusinessTypeBadge, StoreStatusBadge, TxTypeBadge, BrandBadge } from "@/components/badges";
import { yen } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function StoreKartePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!canAccessStore(user, id)) redirect("/dashboard");

  const store = await prisma.store.findUnique({ where: { id } });
  if (!store) notFound();

  const [inv, txs, stocktakes] = await Promise.all([
    getStoreInventory(id),
    prisma.transaction.findMany({
      where: { storeId: id },
      include: { product: { include: { brand: true } }, toStore: true },
      orderBy: { date: "desc" },
      take: 50,
    }),
    prisma.stocktake.findMany({ where: { storeId: id }, orderBy: { targetMonth: "asc" }, include: { items: true } }),
  ]);

  const totalValue = inv.reduce((s, r) => s + r.stockValueWholesale, 0);
  const lowRows = inv.filter((r) => r.low);
  const trend = stocktakes.map((s) => ({ month: s.targetMonth, diffCount: s.diffCount, diffAmount: Math.abs(s.diffAmount) }));

  return (
    <div>
      <PageHeader
        title={`店舗カルテ — ${store.name}`}
        description="基本情報・在庫・取引履歴・棚卸履歴・ズレ推移をまとめて確認できます。"
        action={
          <Link href="/stores" className="text-sm text-navy hover:underline">← 店舗管理へ</Link>
        }
      />

      {/* 基本情報 + サマリー */}
      <div className="mb-4 grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader><CardTitle className="text-base">基本情報</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">業態</span><BusinessTypeBadge type={store.businessType} /></div>
            <div className="flex justify-between"><span className="text-muted-foreground">院長・責任者</span><span>{store.directorName ?? "-"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">開院日</span><span>{store.openDate ? new Date(store.openDate).toISOString().slice(0, 10) : "-"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">ステータス</span><StoreStatusBadge status={store.status} /></div>
          </CardContent>
        </Card>
        <div className="grid grid-cols-2 gap-3 md:col-span-2">
          <StatCard label="在庫金額（卸）" value={yen(totalValue)} />
          <StatCard label="商品数" value={`${inv.length}`} />
          <StatCard label="在庫不足" value={`${lowRows.length}`} tone={lowRows.length > 0 ? "bad" : "good"} />
          <StatCard label="棚卸回数" value={`${stocktakes.length}`} />
        </div>
      </div>

      {/* ズレ推移 */}
      <Card className="mb-4">
        <CardHeader><CardTitle className="text-base">在庫ズレ推移</CardTitle></CardHeader>
        <CardContent><DiffTrendChart data={trend} /></CardContent>
      </Card>

      {/* 棚卸履歴 */}
      <Card className="mb-4">
        <CardHeader><CardTitle className="text-base">棚卸履歴</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">対象月</th>
                <th className="px-3 py-2 text-left">確定日</th>
                <th className="px-3 py-2 text-left">担当</th>
                <th className="px-3 py-2 text-right">ズレ件数</th>
                <th className="px-3 py-2 text-right">ズレ金額</th>
              </tr>
            </thead>
            <tbody>
              {[...stocktakes].reverse().map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="px-3 py-2 font-medium">{s.targetMonth}</td>
                  <td className="px-3 py-2 text-muted-foreground">{new Date(s.confirmedAt).toISOString().slice(0, 10)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{s.assigneeName ?? "-"}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${s.diffCount > 0 ? "text-red-600" : ""}`}>{s.diffCount}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${s.diffAmount !== 0 ? "text-red-600" : ""}`}>{yen(s.diffAmount)}</td>
                </tr>
              ))}
              {stocktakes.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">棚卸履歴がありません。</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* 取引履歴 */}
      <Card className="mb-4">
        <CardHeader><CardTitle className="text-base">取引履歴（直近50件）</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">日付</th>
                <th className="px-3 py-2 text-left">種別</th>
                <th className="px-3 py-2 text-left">商品</th>
                <th className="px-3 py-2 text-right">数量</th>
                <th className="px-3 py-2 text-left">担当/移動先</th>
              </tr>
            </thead>
            <tbody>
              {txs.map((t) => (
                <tr key={t.id} className="border-t">
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{new Date(t.date).toISOString().slice(0, 10)}</td>
                  <td className="px-3 py-2"><TxTypeBadge type={t.type} /></td>
                  <td className="px-3 py-2"><div className="flex items-center gap-2"><BrandBadge name={t.product.brand.name} color={t.product.brand.colorHex} />{t.product.name}</div></td>
                  <td className="px-3 py-2 text-right tabular-nums">{t.quantity}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{t.assignee ?? ""}{t.toStore && t.type === "TRANSFER_OUT" ? ` → ${t.toStore.name}` : ""}</td>
                </tr>
              ))}
              {txs.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">取引履歴がありません。</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* 現在在庫 */}
      <h2 className="mb-2 mt-6 text-sm font-semibold text-muted-foreground">現在の在庫（ブランド別）</h2>
      <InventoryAccordion rows={inv} />
    </div>
  );
}
