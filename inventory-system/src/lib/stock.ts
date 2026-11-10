import { prisma } from "@/lib/prisma";
import { TX_SIGN } from "@/lib/constants";

/**
 * 在庫は「取引履歴の積み上げ」で算出する（在庫数を直接書き換えない設計）。
 * 棚卸が確定すると、その商品の実在庫が以降の基準（ベースライン）になる。
 *
 * - 基準より後かどうかは「取引日(date)」で判定する。入力日時(createdAt)で判定すると、
 *   あとから遡って入力した取引が、すでに実地カウントに含まれているのに再度積み上がる。
 * - 基準の日付（棚卸日・確定時刻）は商品ごとに持つ。棚卸のやり直しで一部の商品だけ
 *   別の日に数え直すことがあるため。空の既存明細は棚卸全体の日付を使う。
 * - 「最新の基準」は棚卸日→確定時刻の順で選ぶ。確定し直した時刻で選ぶと、
 *   古い月を後から直したときに古い数が採用されてしまう。
 */

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * 日本時間での「日」キー（YYYY-MM-DD）。
 * 日付入力由来の値（UTC午前0時）も、日時そのもの（now）も、同じ基準で日に落とせる。
 */
export function jstDayKey(d: Date): string {
  return new Date(d.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10);
}

/** 在庫計算の基準（ある商品の、ある時点の実在庫）。 */
export type Baseline = {
  base: number;
  countedOn: Date | null; // 数えた日（空なら confirmedAt の日）
  confirmedAt: Date; // 数を確定した時刻
};

type ItemLike = { actualQty: number; countedOn: Date | null; confirmedAt: Date | null };
type StocktakeLike = { countedOn: Date | null; confirmedAt: Date };

/** 棚卸明細 → 在庫計算の基準。明細の日付が空の既存データは棚卸全体の日付を使う。 */
export function baselineOf(item: ItemLike, stocktake: StocktakeLike): Baseline {
  return {
    base: item.actualQty,
    countedOn: item.countedOn ?? stocktake.countedOn ?? stocktake.confirmedAt,
    confirmedAt: item.confirmedAt ?? stocktake.confirmedAt,
  };
}

/** 棚卸日（表示・判定に使う日）。 */
export function stocktakeDay(b: { countedOn: Date | null; confirmedAt: Date }): string {
  return jstDayKey(b.countedOn ?? b.confirmedAt);
}

/** a が b より新しい基準か。棚卸日 → 確定時刻 の順で比べる。 */
export function isNewerBaseline(a: Baseline, b: Baseline): boolean {
  const da = stocktakeDay(a);
  const db = stocktakeDay(b);
  if (da !== db) return da > db;
  return a.confirmedAt.getTime() > b.confirmedAt.getTime();
}

/** key ごとに最新の基準だけを残す。 */
export function keepLatest(map: Map<string, Baseline>, key: string, b: Baseline): void {
  const cur = map.get(key);
  if (!cur || isNewerBaseline(b, cur)) map.set(key, b);
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

const ITEM_SELECT = {
  stocktakeId: true,
  productId: true,
  actualQty: true,
  countedOn: true,
  confirmedAt: true,
  stocktake: { select: { storeId: true, targetMonth: true, countedOn: true, confirmedAt: true } },
} as const;

// ===== 内訳（1商品の在庫がどう計算されたか） =====

export type BreakdownTx = {
  id: string;
  type: string;
  quantity: number;
  signed: number; // 在庫への増減（符号つき）
  date: Date;
  createdAt: Date;
  counted: boolean; // 在庫に反映したか
  reason: string | null; // 反映していない理由
  assignee: string | null;
  counterpart: string | null;
  supplier: string | null;
  memo: string | null;
  toStoreName: string | null;
};

export type StockBreakdown = {
  baseline: (Baseline & { targetMonth: string }) | null;
  history: { targetMonth: string; actualQty: number; countedOn: Date; confirmedAt: Date; latest: boolean }[];
  txs: BreakdownTx[];
  baseQty: number;
  addedQty: number;
  stock: number;
};

/** 1商品の在庫の内訳。在庫一覧の数と同じ規則で計算する。 */
export async function getStockBreakdown(storeId: string, productId: string): Promise<StockBreakdown> {
  const [items, rawTxs] = await Promise.all([
    prisma.stocktakeItem.findMany({
      where: { productId, stocktake: { storeId } },
      select: ITEM_SELECT,
    }),
    prisma.transaction.findMany({
      where: { storeId, productId },
      include: { toStore: { select: { name: true } } },
    }),
  ]);

  // 最新の基準
  let latest: (Baseline & { targetMonth: string }) | null = null;
  const all = items.map((it) => ({ ...baselineOf(it, it.stocktake), targetMonth: it.stocktake.targetMonth }));
  for (const b of all) if (!latest || isNewerBaseline(b, latest)) latest = b;

  const history = all
    .map((b) => ({
      targetMonth: b.targetMonth,
      actualQty: b.base,
      countedOn: b.countedOn ?? b.confirmedAt,
      confirmedAt: b.confirmedAt,
      latest: b === latest,
    }))
    .sort((a, b) => (jstDayKey(a.countedOn) < jstDayKey(b.countedOn) ? 1 : -1));

  const sorted = [...rawTxs].sort(
    (a, b) => a.date.getTime() - b.date.getTime() || a.createdAt.getTime() - b.createdAt.getTime()
  );

  const txs: BreakdownTx[] = sorted.map((t) => {
    const signed = (TX_SIGN[t.type] ?? 0) * t.quantity;
    let counted = true;
    let reason: string | null = null;
    if (latest && !isAfterStocktake(t, latest)) {
      counted = false;
      const cnt = stocktakeDay(latest);
      reason =
        jstDayKey(t.date) < cnt
          ? `棚卸日（${cnt}）より前の取引のため、棚卸で数えた数に含まれています`
          : `棚卸日（${cnt}）当日、棚卸を確定する前に入力されたため、棚卸で数えた数に含まれています`;
    }
    return {
      id: t.id,
      type: t.type,
      quantity: t.quantity,
      signed,
      date: t.date,
      createdAt: t.createdAt,
      counted,
      reason,
      assignee: t.assignee,
      counterpart: t.counterpart,
      supplier: t.supplier,
      memo: t.memo,
      toStoreName: t.toStore?.name ?? null,
    };
  });

  const baseQty = latest?.base ?? 0;
  const addedQty = txs.filter((t) => t.counted).reduce((s, t) => s + t.signed, 0);
  return { baseline: latest, history, txs, baseQty, addedQty, stock: baseQty + addedQty };
}

/** 単一商品の在庫数（内訳と同じ計算） */
export async function computeStock(storeId: string, productId: string): Promise<number> {
  return (await getStockBreakdown(storeId, productId)).stock;
}

/**
 * 棚卸で数えた時点の理論在庫（商品ごと）。ズレの記録に使う。
 * 「数えた時点より前の最新の基準」＋「その基準より後で、数えた時点までの取引」。
 * 今の在庫数を使うと、過去の棚卸日で確定したときに、その後の販売分が架空のズレになる。
 *
 * excludeStocktakeId: 確定し直す棚卸自身の明細は「前の基準」に使わない（置き換える対象のため）。
 */
export async function computeTheoreticalAt(
  storeId: string,
  at: { countedOn: Date; confirmedAt: Date },
  excludeStocktakeId?: string
): Promise<Map<string, number>> {
  const point: Baseline = { base: 0, countedOn: at.countedOn, confirmedAt: at.confirmedAt };
  const [items, txs] = await Promise.all([
    prisma.stocktakeItem.findMany({ where: { stocktake: { storeId } }, select: ITEM_SELECT }),
    prisma.transaction.findMany({
      where: { storeId },
      select: { productId: true, type: true, quantity: true, date: true, createdAt: true },
    }),
  ]);

  const prior = new Map<string, Baseline>();
  for (const it of items) {
    if (excludeStocktakeId && it.stocktakeId === excludeStocktakeId) continue;
    const b = baselineOf(it, it.stocktake);
    if (!isNewerBaseline(point, b)) continue; // 今回の棚卸より新しい基準は使わない
    keepLatest(prior, it.productId, b);
  }

  const result = new Map<string, number>();
  for (const [pid, b] of prior) result.set(pid, b.base);
  for (const t of txs) {
    const b = prior.get(t.productId);
    if (b && !isAfterStocktake(t, b)) continue; // 前の基準に含まれる
    if (isAfterStocktake(t, point)) continue; // 今回数えた時点より後
    result.set(t.productId, (result.get(t.productId) ?? 0) + (TX_SIGN[t.type] ?? 0) * t.quantity);
  }
  return result;
}

export type StockRow = {
  productId: string;
  stock: number;
};

/**
 * 店舗内・全商品の在庫を一括算出（ダッシュボード/一覧用に効率化）。
 * 商品ごとに「最新の棚卸の実数 + それ以降の取引」を集計する。
 */
export async function computeStoreStocks(storeId: string): Promise<Map<string, number>> {
  const [items, txs] = await Promise.all([
    prisma.stocktakeItem.findMany({ where: { stocktake: { storeId } }, select: ITEM_SELECT }),
    prisma.transaction.findMany({
      where: { storeId },
      select: { productId: true, type: true, quantity: true, date: true, createdAt: true },
    }),
  ]);

  const baseline = new Map<string, Baseline>();
  for (const it of items) keepLatest(baseline, it.productId, baselineOf(it, it.stocktake));

  const result = new Map<string, number>();
  for (const [pid, b] of baseline) result.set(pid, b.base);

  for (const t of txs) {
    const b = baseline.get(t.productId);
    if (b && !isAfterStocktake(t, b)) continue; // 棚卸に含まれている分は無視
    result.set(t.productId, (result.get(t.productId) ?? 0) + (TX_SIGN[t.type] ?? 0) * t.quantity);
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
