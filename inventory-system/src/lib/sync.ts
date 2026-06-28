import { prisma } from "@/lib/prisma";
import { appendRows, SHEET_NAMES } from "@/lib/integrations/sheets";
import { TX_TYPES, TX_SIGN, label } from "@/lib/constants";
import { getStoreInventory } from "@/lib/inventory";

function fmtDate(d: Date): string {
  return new Date(d).toISOString().slice(0, 10);
}

/** 取引を1件（移動はグループID）スプレッドシートへ出力。OFF/未設定ならドライランで何もしない。 */
export async function syncTransaction(idOrGroup: string) {
  const txs = await prisma.transaction.findMany({
    where: { OR: [{ id: idOrGroup }, { transferGroupId: idOrGroup }] },
    include: { product: { include: { brand: true } }, store: true, toStore: true },
  });
  if (txs.length === 0) return;

  const rows = txs.map((t) => {
    const amount = (t.unitPriceIncl ?? 0) * t.quantity * (TX_SIGN[t.type] ?? 1);
    return [
      fmtDate(t.date),
      t.store.name,
      label(TX_TYPES, t.type),
      t.product.brand.name,
      t.product.name,
      t.quantity,
      t.unitPriceExcl ?? "",
      t.unitPriceIncl ?? "",
      amount,
      t.assignee ?? "",
      t.toStore?.name ?? "",
      t.memo ?? "",
    ];
  });
  await appendRows(SHEET_NAMES.TRANSACTIONS, rows).catch(() => {});
}

/** 棚卸確定をスプレッドシートへ出力。 */
export async function syncStocktake(stocktakeId: string) {
  const st = await prisma.stocktake.findUnique({
    where: { id: stocktakeId },
    include: { store: true, items: { include: { product: { include: { brand: true } } } } },
  });
  if (!st) return;
  const rows = st.items.map((it) => [
    fmtDate(st.confirmedAt),
    st.targetMonth,
    st.store.name,
    it.product.brand.name,
    it.product.name,
    it.theoreticalQty,
    it.actualQty,
    it.diff,
    it.diffAmount,
    st.assigneeName ?? "",
  ]);
  await appendRows(SHEET_NAMES.STOCKTAKE, rows).catch(() => {});
}

/** 全店の現在在庫スナップショットを出力（管理者の手動同期）。 */
export async function syncSnapshot(): Promise<{ count: number }> {
  const stores = await prisma.store.findMany({ where: { isHeadquarters: false, status: "ACTIVE" }, orderBy: { sortOrder: "asc" } });
  const today = fmtDate(new Date());
  const rows: (string | number)[][] = [];
  for (const s of stores) {
    const inv = await getStoreInventory(s.id);
    for (const r of inv) {
      if (r.stock === 0) continue;
      rows.push([today, s.name, r.brandName, r.name, r.stock, r.wholesaleIncl, r.stockValueWholesale]);
    }
  }
  if (rows.length) await appendRows(SHEET_NAMES.SNAPSHOT, rows).catch(() => {});
  return { count: rows.length };
}
