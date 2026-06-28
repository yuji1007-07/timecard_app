import { prisma } from "@/lib/prisma";
import { requireAreaManager } from "@/lib/session";
import { getStoreInventory } from "@/lib/inventory";
import { TX_TYPES, label, yen } from "@/lib/constants";
import { PrintToolbar } from "./print-toolbar";

export const dynamic = "force-dynamic";

type SP = {
  type?: string;
  store?: string;
  period?: string;
  month?: string;
  year?: string;
  from?: string;
  to?: string;
};

function dateRange(sp: SP): { start?: Date; end?: Date; descr: string } {
  if (sp.period === "month" && sp.month) {
    const [y, m] = sp.month.split("-").map(Number);
    return { start: new Date(y, m - 1, 1), end: new Date(y, m, 1), descr: `${sp.month}` };
  }
  if (sp.period === "year" && sp.year) {
    const y = Number(sp.year);
    return { start: new Date(y, 0, 1), end: new Date(y + 1, 0, 1), descr: `${y}年` };
  }
  if (sp.period === "range" && (sp.from || sp.to)) {
    return {
      start: sp.from ? new Date(sp.from) : undefined,
      end: sp.to ? new Date(new Date(sp.to).getTime() + 86400000) : undefined,
      descr: `${sp.from ?? ""}〜${sp.to ?? ""}`,
    };
  }
  return { descr: "全期間" };
}

export default async function PrintPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireAreaManager();
  const sp = await searchParams;
  const type = sp.type ?? "stocktake";
  const { start, end, descr } = dateRange(sp);

  const stores = await prisma.store.findMany({
    where: { isHeadquarters: false, ...(sp.store ? { id: sp.store } : {}) },
    orderBy: { sortOrder: "asc" },
  });

  const typeLabel = type === "transaction" ? "取引履歴" : type === "snapshot" ? "在庫スナップショット" : "棚卸履歴";
  const dateFilter = start || end ? { ...(start ? { gte: start } : {}), ...(end ? { lt: end } : {}) } : undefined;

  return (
    <div className="mx-auto max-w-4xl p-6">
      <PrintToolbar title={`${typeLabel}｜${descr}｜${sp.store ? stores[0]?.name ?? "" : "全店舗"}`} />

      <div className="mb-6">
        <h1 className="text-xl font-bold">販売品在庫管理システム — {typeLabel}バックアップ</h1>
        <p className="text-sm text-gray-600">期間: {descr}｜出力日: {new Date().toISOString().slice(0, 10)}</p>
      </div>

      {stores.map((store, idx) => (
        <section key={store.id} className={idx > 0 ? "page-break mt-8" : "mt-4"}>
          <h2 className="mb-2 border-b-2 border-navy pb-1 text-lg font-bold">{store.name}</h2>

          <StoreSection type={type} storeId={store.id} dateFilter={dateFilter} />
        </section>
      ))}

      {stores.length === 0 && <p className="text-sm text-gray-500">対象店舗がありません。</p>}
    </div>
  );
}

async function StoreSection({
  type,
  storeId,
  dateFilter,
}: {
  type: string;
  storeId: string;
  dateFilter?: { gte?: Date; lt?: Date };
}) {
  if (type === "snapshot") {
    const inv = (await getStoreInventory(storeId)).filter((r) => r.stock !== 0);
    const total = inv.reduce((s, r) => s + r.stockValueWholesale, 0);
    return (
      <>
        <table className="print-table">
          <thead>
            <tr>
              <th>ブランド</th><th>商品名</th><th>在庫</th><th>卸価格(税込)</th><th>在庫金額</th>
            </tr>
          </thead>
          <tbody>
            {inv.map((r) => (
              <tr key={r.productId}>
                <td>{r.brandName}</td><td>{r.name}</td>
                <td>{r.stock} {r.unit}</td><td>{yen(r.wholesaleIncl)}</td><td>{yen(r.stockValueWholesale)}</td>
              </tr>
            ))}
            {inv.length === 0 && <tr><td colSpan={5}>在庫なし</td></tr>}
          </tbody>
        </table>
        <p className="mt-1 text-right text-sm font-semibold">在庫金額合計: {yen(total)}</p>
      </>
    );
  }

  if (type === "transaction") {
    const txs = await prisma.transaction.findMany({
      where: { storeId, ...(dateFilter ? { date: dateFilter } : {}) },
      include: { product: { include: { brand: true } }, toStore: true },
      orderBy: { date: "asc" },
    });
    return (
      <table className="print-table">
        <thead>
          <tr>
            <th>日付</th><th>種別</th><th>ブランド</th><th>商品名</th><th>数量</th><th>単価(税込)</th><th>担当/移動先/メモ</th>
          </tr>
        </thead>
        <tbody>
          {txs.map((t) => (
            <tr key={t.id}>
              <td>{new Date(t.date).toISOString().slice(0, 10)}</td>
              <td>{label(TX_TYPES, t.type)}</td>
              <td>{t.product.brand.name}</td>
              <td>{t.product.name}</td>
              <td>{t.quantity}</td>
              <td>{t.unitPriceIncl ? yen(t.unitPriceIncl) : "-"}</td>
              <td>{[t.assignee, t.toStore && t.type === "TRANSFER_OUT" ? `→${t.toStore.name}` : "", t.counterpart, t.memo].filter(Boolean).join(" / ")}</td>
            </tr>
          ))}
          {txs.length === 0 && <tr><td colSpan={7}>取引なし</td></tr>}
        </tbody>
      </table>
    );
  }

  // stocktake
  const sts = await prisma.stocktake.findMany({
    where: { storeId, ...(dateFilter ? { confirmedAt: dateFilter } : {}) },
    include: { items: { include: { product: { include: { brand: true } } } } },
    orderBy: { targetMonth: "asc" },
  });
  return (
    <>
      {sts.map((st) => (
        <div key={st.id} className="mb-4">
          <h3 className="mb-1 text-sm font-semibold">
            {st.targetMonth}（確定 {new Date(st.confirmedAt).toISOString().slice(0, 10)}／担当 {st.assigneeName ?? "-"}）
            ｜ズレ {st.diffCount}件 / {yen(st.diffAmount)}
          </h3>
          <table className="print-table">
            <thead>
              <tr><th>ブランド</th><th>商品名</th><th>理論在庫</th><th>実在庫</th><th>ズレ</th><th>ズレ金額</th></tr>
            </thead>
            <tbody>
              {st.items.map((it) => (
                <tr key={it.id}>
                  <td>{it.product.brand.name}</td><td>{it.product.name}</td>
                  <td>{it.theoreticalQty}</td><td>{it.actualQty}</td>
                  <td>{it.diff > 0 ? `+${it.diff}` : it.diff}</td><td>{yen(it.diffAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      {sts.length === 0 && <p className="text-sm text-gray-500">棚卸記録なし</p>}
    </>
  );
}
