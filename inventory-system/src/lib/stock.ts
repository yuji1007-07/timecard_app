import { prisma } from "@/lib/prisma";
import { TX_SIGN } from "@/lib/constants";

/**
 * 在庫は「取引履歴の積み上げ」で算出する（在庫数を直接書き換えない設計）。
 * 棚卸が確定すると、その時点の実在庫が以降の基準（ベースライン）になる。
 *
 * ベースラインより後かどうかは「取引日(date)」で判定する。
 * 入力日時(createdAt)で判定すると、あとから遡って入力した取引
 * （例: 店舗間移動を翌月に記録した場合の移動先の入庫）が、
 * すでに実地カウントに含まれているのに再度積み上がって二重計上になる。
 */

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * 日本時間での「日」キー（YYYY-MM-DD）。
 * 日付入力由来の値（UTC午前0時）も、日時そのもの（now）も、同じ基準で日に落とせる。
 */
export function jstDayKey(d: Date): string {
  return new Date(d.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10);
}

/** 棚卸ベースライン。countedOn（棚卸日）が無い既存行は confirmedAt の日を棚卸日とみなす。 */
export type Baseline = {
  base: number;
  countedOn: Date | null;
  confirmedAt: Date;
};

/** 棚卸日（表示・判定に使う日）。 */
export function stocktakeDay(b: { countedOn: Date | null; confirmedAt: Date }): string {
  return jstDayKey(b.countedOn ?? b.confirmedAt);
}

/**
 * この取引を棚卸ベースラインに積み上げるか。
 *
 * - 棚卸日より後の日付の取引 → 積み上げる
 * - 棚卸日より前の日付の取引 → 実地カウントに含まれているので無視
 * - 棚卸日と同じ日付の取引   → 確定ボタンより後に入力されたものだけ積み上げる
 *   （確定後にその日のうちに記録した販売を落とさないため）
 */
export function isAfterStocktake(tx: { date: Date; createdAt: Date }, b: Baseline): boolean {
  const txDay = jstDayKey(tx.date);
  const cntDay = stocktakeDay(b);
  if (txDay !== cntDay) return txDay > cntDay;
  return tx.createdAt > b.confirmedAt;
}

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

  const baseline: Baseline | null = latest
    ? {
        base: latest.actualQty,
        countedOn: latest.stocktake.countedOn,
        confirmedAt: latest.stocktake.confirmedAt,
      }
    : null;

  // 取引日で判定するため、SQLでは絞り込まず取得してから判定する
  const txs = await prisma.transaction.findMany({
    where: { storeId, productId },
    select: { type: true, quantity: true, date: true, createdAt: true },
  });

  if (!baseline) return sumEffect(txs);
  return baseline.base + sumEffect(txs.filter((t) => isAfterStocktake(t, baseline)));
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
    include: { stocktake: { select: { confirmedAt: true, countedOn: true } } },
    orderBy: { stocktake: { confirmedAt: "asc" } },
  });
  // 最後に来たものが最新（asc なので上書き）
  const baseline = new Map<string, Baseline>();
  for (const it of items) {
    baseline.set(it.productId, {
      base: it.actualQty,
      countedOn: it.stocktake.countedOn,
      confirmedAt: it.stocktake.confirmedAt,
    });
  }

  const txs = await prisma.transaction.findMany({
    where: { storeId },
    select: { productId: true, type: true, quantity: true, date: true, createdAt: true },
  });

  const result = new Map<string, number>();
  for (const [pid, b] of baseline) result.set(pid, b.base);

  for (const t of txs) {
    const b = baseline.get(t.productId);
    if (b && !isAfterStocktake(t, b)) continue; // 棚卸に含まれている分は無視
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
