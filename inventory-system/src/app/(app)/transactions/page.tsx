import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { TxTypeBadge, BrandBadge } from "@/components/badges";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { TX_TYPES, TX_SIGN, yen } from "@/lib/constants";
import { cancelTransaction } from "./actions";

export const dynamic = "force-dynamic";

type SP = { store?: string; type?: string };

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const isArea = user.role === "AREA_MANAGER";

  const stores = await prisma.store.findMany({
    where: { isHeadquarters: false },
    select: { id: true, name: true },
    orderBy: { sortOrder: "asc" },
  });

  const storeFilter = isArea ? (sp.store || undefined) : (user.storeId ?? "__none__");

  const txs = await prisma.transaction.findMany({
    where: {
      ...(storeFilter ? { storeId: storeFilter } : {}),
      ...(sp.type ? { type: sp.type } : {}),
    },
    include: { product: { include: { brand: true } }, store: true, toStore: true },
    orderBy: { date: "desc" },
    take: 200,
  });

  const sel = "h-9 rounded-md border border-input bg-background px-2 text-sm";

  return (
    <div>
      <PageHeader
        title="取引履歴"
        description="発注・消耗・移動・社販・プレゼントの記録。取り消すと在庫が自動補正されます。"
        action={
          <Button asChild size="sm">
            <Link href="/transactions/new">＋ 取引を記録</Link>
          </Button>
        }
      />

      <form method="GET" className="mb-4 flex flex-wrap items-end gap-2 rounded-lg border bg-card p-3">
        {isArea && (
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            店舗
            <select name="store" defaultValue={sp.store ?? ""} className={sel}>
              <option value="">全店</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
        )}
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          種別
          <select name="type" defaultValue={sp.type ?? ""} className={sel}>
            <option value="">全て</option>
            {Object.entries(TX_TYPES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="h-9 rounded-md bg-navy px-4 text-sm text-white">絞り込み</button>
      </form>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">日付</th>
              {isArea && <th className="px-3 py-2 text-left">店舗</th>}
              <th className="px-3 py-2 text-left">種別</th>
              <th className="px-3 py-2 text-left">商品</th>
              <th className="px-3 py-2 text-right">数量</th>
              <th className="px-3 py-2 text-right">金額</th>
              <th className="px-3 py-2 text-left">担当/相手/移動先</th>
              <th className="px-3 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {txs.map((t) => {
              const sign = TX_SIGN[t.type] ?? 1;
              const amount = (t.unitPriceIncl ?? 0) * t.quantity;
              return (
                <tr key={t.id} className="border-t align-top">
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{new Date(t.date).toISOString().slice(0, 10)}</td>
                  {isArea && <td className="px-3 py-2">{t.store.name}</td>}
                  <td className="px-3 py-2"><TxTypeBadge type={t.type} /></td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <BrandBadge name={t.product.brand.name} color={t.product.brand.colorHex} />
                      <span className="font-medium">{t.product.name}</span>
                    </div>
                  </td>
                  <td className={`px-3 py-2 text-right font-semibold tabular-nums ${sign > 0 ? "text-green-600" : "text-red-600"}`}>
                    {sign > 0 ? "+" : "-"}{t.quantity}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{amount > 0 ? yen(amount) : "-"}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {t.assignee && <div>担当: {t.assignee}</div>}
                    {t.counterpart && <div>相手: {t.counterpart}</div>}
                    {t.toStore && t.type === "TRANSFER_OUT" && <div>→ {t.toStore.name}</div>}
                    {t.supplier && <div>仕入: {t.supplier}</div>}
                    {t.memo && <div>{t.memo}</div>}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end">
                      <form action={cancelTransaction}>
                        <input type="hidden" name="id" value={t.id} />
                        <ConfirmSubmit message="この取引を取り消しますか？在庫が自動補正されます。" size="sm">取消</ConfirmSubmit>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
            {txs.length === 0 && (
              <tr><td colSpan={isArea ? 8 : 7} className="px-3 py-8 text-center text-muted-foreground">取引履歴がありません。</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
