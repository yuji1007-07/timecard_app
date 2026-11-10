import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BrandBadge, TxTypeBadge } from "@/components/badges";
import { prisma } from "@/lib/prisma";
import { requireUser, canAccessStore } from "@/lib/session";
import { getStockBreakdown, jstDayKey } from "@/lib/stock";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function jstDateTime(d: Date): string {
  return d.toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

/**
 * 在庫の内訳：1商品の在庫数が「どの棚卸を基準に、どの取引を足し引きして」出たのかを示す。
 * 計算は在庫一覧と同じ関数（getStockBreakdown）なので、表示と在庫数は必ず一致する。
 */
export default async function StockBreakdownPage({
  searchParams,
}: {
  searchParams: Promise<{ store?: string; product?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const storeId = sp.store ?? "";
  const productId = sp.product ?? "";
  if (!storeId || !productId) notFound();
  if (!canAccessStore(user, storeId)) redirect("/inventory");

  const [store, product, bd] = await Promise.all([
    prisma.store.findUnique({ where: { id: storeId }, select: { name: true } }),
    prisma.product.findUnique({ where: { id: productId }, include: { brand: true } }),
    getStockBreakdown(storeId, productId),
  ]);
  if (!store || !product) notFound();

  const unit = product.unit;
  const skipped = bd.txs.filter((t) => !t.counted).length;

  return (
    <div>
      <PageHeader
        title="在庫の内訳"
        description={`${store.name}｜この在庫数がどの棚卸と取引から計算されたかを表示します。`}
        action={
          <Button asChild size="sm" variant="outline">
            <Link href={`/inventory?store=${storeId}`}>在庫一覧へ戻る</Link>
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <BrandBadge name={product.brand.name} color={product.brand.colorHex} />
        <span className="text-lg font-bold">{product.name}</span>
        {product.size && (
          <span className="rounded bg-navy/10 px-1.5 py-0.5 text-sm font-semibold text-navy">{product.size}</span>
        )}
      </div>

      {/* 計算式 */}
      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-center gap-3 text-lg tabular-nums">
          <div className="rounded-md bg-secondary/60 px-3 py-2">
            <div className="text-xs text-muted-foreground">
              {bd.baseline ? "基準の棚卸" : "棚卸なし"}
            </div>
            <div className="font-bold">
              {bd.baseQty}
              <span className="ml-0.5 text-sm font-normal">{unit}</span>
            </div>
          </div>
          <span className="text-muted-foreground">＋</span>
          <div className="rounded-md bg-secondary/60 px-3 py-2">
            <div className="text-xs text-muted-foreground">その後の取引</div>
            <div className={cn("font-bold", bd.addedQty < 0 ? "text-red-600" : bd.addedQty > 0 ? "text-green-700" : "")}>
              {signed(bd.addedQty)}
              <span className="ml-0.5 text-sm font-normal">{unit}</span>
            </div>
          </div>
          <span className="text-muted-foreground">＝</span>
          <div className="rounded-md border-2 border-navy px-3 py-2">
            <div className="text-xs text-muted-foreground">現在庫</div>
            <div className="font-bold text-navy">
              {bd.stock}
              <span className="ml-0.5 text-sm font-normal">{unit}</span>
            </div>
          </div>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          {bd.baseline ? (
            <>
              基準: <span className="font-medium text-foreground">{bd.baseline.targetMonth} の棚卸</span>（棚卸日{" "}
              {jstDayKey(bd.baseline.countedOn ?? bd.baseline.confirmedAt)}・確定 {jstDateTime(bd.baseline.confirmedAt)}）で数えた{" "}
              {bd.baseQty}
              {unit}。それより後の取引を足し引きしています。
            </>
          ) : (
            <>この店舗ではこの商品の棚卸がまだ無いため、すべての取引の合計を在庫数にしています。</>
          )}
          {skipped > 0 && <> 棚卸の数に含まれる取引 {skipped}件は足していません（下の表で薄く表示）。</>}
        </p>
      </Card>

      {/* 取引 */}
      <Card className="mb-4 overflow-x-auto">
        <div className="border-b px-4 py-2 text-sm font-semibold">取引（取引日の古い順）</div>
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">取引日</th>
              <th className="px-3 py-2 text-left">入力日時</th>
              <th className="px-3 py-2 text-left">種別</th>
              <th className="px-3 py-2 text-right">数量</th>
              <th className="px-3 py-2 text-left">在庫への反映</th>
              <th className="px-3 py-2 text-left">担当/相手/メモ</th>
            </tr>
          </thead>
          <tbody>
            {bd.txs.map((t) => (
              <tr key={t.id} className={cn("border-t align-top", !t.counted && "bg-muted/40 text-muted-foreground")}>
                <td className="whitespace-nowrap px-3 py-2">{jstDayKey(t.date)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-xs">{jstDateTime(t.createdAt)}</td>
                <td className="px-3 py-2"><TxTypeBadge type={t.type} /></td>
                <td
                  className={cn(
                    "px-3 py-2 text-right font-semibold tabular-nums",
                    t.counted && (t.signed < 0 ? "text-red-600" : "text-green-700")
                  )}
                >
                  {signed(t.signed)}
                </td>
                <td className="px-3 py-2 text-xs">
                  {t.counted ? (
                    <span className="font-medium text-foreground">反映</span>
                  ) : (
                    <>
                      <span className="font-medium">足していない</span>
                      <div>{t.reason}</div>
                    </>
                  )}
                </td>
                <td className="px-3 py-2 text-xs">
                  {[
                    t.assignee && `担当: ${t.assignee}`,
                    t.counterpart && `相手: ${t.counterpart}`,
                    t.toStoreName && t.type === "TRANSFER_OUT" && `→ ${t.toStoreName}`,
                    t.supplier && `仕入: ${t.supplier}`,
                    t.memo,
                  ]
                    .filter(Boolean)
                    .join(" / ")}
                </td>
              </tr>
            ))}
            {bd.txs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                  この店舗でのこの商品の取引はありません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {/* 棚卸の履歴 */}
      <Card className="overflow-x-auto">
        <div className="border-b px-4 py-2 text-sm font-semibold">この商品の棚卸の履歴</div>
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">対象月</th>
              <th className="px-3 py-2 text-left">棚卸日</th>
              <th className="px-3 py-2 text-left">確定日時</th>
              <th className="px-3 py-2 text-right">数えた数</th>
              <th className="px-3 py-2 text-left"></th>
            </tr>
          </thead>
          <tbody>
            {bd.history.map((h, i) => (
              <tr key={i} className="border-t">
                <td className="px-3 py-2">{h.targetMonth}</td>
                <td className="px-3 py-2">{jstDayKey(h.countedOn)}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{jstDateTime(h.confirmedAt)}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {h.actualQty} {unit}
                </td>
                <td className="px-3 py-2">
                  {h.latest && (
                    <span className="rounded-full bg-navy/10 px-2 py-0.5 text-xs font-medium text-navy">今の基準</span>
                  )}
                </td>
              </tr>
            ))}
            {bd.history.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                  棚卸の記録はありません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
