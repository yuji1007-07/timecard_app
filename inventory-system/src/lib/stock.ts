import { prisma } from "@/lib/prisma";
import { TX_SIGN } from "@/lib/constants";

/**
 * 在庫は「取引履歴の積み上げ」で算出する（在庫数を直接書き換えない設計）。
 * 棚卸が確定すると、その時点の実在庫が以降の基準（ベースライン）になる。
 *
 * computeStock(店舗, 商品):
 *   1. 最新の確定棚卸（その商品の StocktakeItem）を探す
 *   2. あれば actualQty を基準 base、confirmedAt を境界 cutoff とする
 *   3. cutoff 以降（無ければ全期間）の取引の符号付き合計を base に足す
 */

type TxLite = { type: string; quantity: number };

function sumEffect(txs: TxLite[]): number {
  let s = 0;
  for (const t of txs) s += (TX_SIGN[t.type] ?? 0) * t.quantity;
  return s;
}

/** 単一商品の在庫数 */
export async function computeStock(storeId: string, productId: string): Promise<number> {
  const latest = await prisma.stocktakeItem.findFirst({
    where: { productId, stocktake: { storeId } },
    orderBy: { stocktake: { confirmedAt: "desc" } },
    include: { stocktake: true },
  });

  const base = latest?.actualQty ?? 0;
  const cutoff = latest?.stocktake.confirmedAt;

  const txs = await prisma.transaction.findMany({
    where: { storeId, productId, ...(cutoff ? { createdAt: { gt: cutoff } } : {}) },
    select: { type: true, quantity: true },
  });

  return base + sumEffect(txs);
}

export type StockRow = {
  productId: string;
  stock: number;
};

/**
 * 店舗内・全商品の在庫を一括算出（ダッシュボード/一覧用に効率化）。
 * 商品ごとに「最新棚卸の actualQty + それ以降の取引」を集計する。
 */
export async function computeStoreStocks(storeId: string): Promise<Map<string, number>> {
  // 各商品の最新棚卸ベースライン
  const items = await prisma.stocktakeItem.findMany({
    where: { stocktake: { storeId } },
    include: { stocktake: { select: { confirmedAt: true } } },
    orderBy: { stocktake: { confirmedAt: "asc" } },
  });
  // 最後に来たものが最新（asc なので上書き）
  const baseline = new Map<string, { base: number; cutoff: Date }>();
  for (const it of items) {
    baseline.set(it.productId, { base: it.actualQty, cutoff: it.stocktake.confirmedAt });
  }

  const txs = await prisma.transaction.findMany({
    where: { storeId },
    select: { productId: true, type: true, quantity: true, createdAt: true },
  });

  const result = new Map<string, number>();
  for (const [pid, b] of baseline) result.set(pid, b.base);

  for (const t of txs) {
    const b = baseline.get(t.productId);
    if (b && t.createdAt <= b.cutoff) continue; // ベースライン以前は無視
    const cur = result.get(t.productId) ?? 0;
    result.set(t.productId, cur + (TX_SIGN[t.type] ?? 0) * t.quantity);
  }

  return result;
}

/** 店舗が取り扱う商品（allStores or ProductStore で指定。店舗別オフは除外）を返す */
export async function getStoreProducts(storeId: string) {
  return prisma.product.findMany({
    where: {
      active: true,
      OR: [{ allStores: true }, { productStores: { some: { storeId } } }],
      // 各店舗で「使わない」とオフにした商品は除外
      NOT: { disabledStores: { some: { storeId } } },
    },
    include: { brand: true },
    orderBy: [{ brand: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }],
  });
}
