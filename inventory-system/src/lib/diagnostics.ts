import { prisma } from "@/lib/prisma";
import { TX_SIGN } from "@/lib/constants";
import { baselineOf, keepLatest, isAfterStocktake, isLateOrder, jstDayKey, stocktakeDay, type Baseline } from "@/lib/stock";
import { isSheetsConfigured } from "@/lib/integrations/sheets";

/**
 * 在庫診断：在庫数が合わない原因になりうるデータを、本番データから機械的に洗い出す。
 * 在庫の計算は在庫一覧と同じ関数（baselineOf / keepLatest / isAfterStocktake）を使う。
 * ここでは何も書き換えない（読み取りのみ）。
 */

const DUP_WINDOW_MS = 2 * 60 * 1000; // 2分以内に同じ内容が並んでいたら二重登録の疑い
const PAIR_WINDOW_DAYS = 3; // 移動入庫と発注が3日以内に同じ数量であれば二重計上の疑い

export type DupGroup = {
  productId: string;
  productName: string;
  type: string;
  quantity: number;
  date: string;
  count: number; // 並んでいる件数（1件を残すなら count-1 件が余分）
  enteredAt: string[]; // 入力日時（ISO）
  inStock: boolean; // 現在の在庫数に影響しているか（棚卸に含まれる分は影響しない）
};
export type StocktakeRow = {
  targetMonth: string;
  countedDay: string;
  confirmedAt: string;
  itemCount: number;
  suspicious: boolean; // それ以前の棚卸より商品数が大きく減っている
};
export type BackdatedRow = {
  productId: string;
  productName: string;
  type: string;
  signed: number;
  date: string;
  enteredAt: string;
  stocktakeDay: string;
  memo: string | null;
};
export type NegativeRow = { productId: string; productName: string; stock: number };
export type PairRow = { productId: string; productName: string; quantity: number; transferDate: string; orderDate: string };

export type StoreDiagnosis = {
  storeId: string;
  storeName: string;
  duplicates: DupGroup[];
  stocktakes: StocktakeRow[];
  backdated: BackdatedRow[];
  backdatedNet: number; // 過去日付のため足していない取引の合計（符号つき）
  lateOrders: BackdatedRow[]; // 棚卸の後に入力された、棚卸日より前の日付の入荷（在庫に足している）
  negatives: NegativeRow[];
  transferOrderPairs: PairRow[];
};

export type Diagnostics = {
  generatedAt: string;
  sheetsConfigured: boolean;
  duplicateProducts: { brandName: string; name: string; size: string | null; productIds: string[] }[];
  stores: StoreDiagnosis[];
  totals: {
    duplicateGroups: number;
    duplicateExtra: number;
    suspiciousStocktakes: number;
    backdated: number;
    lateOrders: number;
    negatives: number;
    transferOrderPairs: number;
    duplicateProducts: number;
  };
};

async function loadAll() {
  const [stores, products, stocktakes, txs] = await Promise.all([
    prisma.store.findMany({ where: { isHeadquarters: false }, orderBy: { sortOrder: "asc" } }),
    prisma.product.findMany({ include: { brand: { select: { name: true } } } }),
    prisma.stocktake.findMany({
      select: {
        id: true,
        storeId: true,
        targetMonth: true,
        countedOn: true,
        confirmedAt: true,
        items: {
          select: {
            productId: true,
            theoreticalQty: true,
            actualQty: true,
            diff: true,
            countedOn: true,
            confirmedAt: true,
          },
        },
      },
    }),
    prisma.transaction.findMany({
      select: {
        id: true,
        storeId: true,
        productId: true,
        type: true,
        quantity: true,
        date: true,
        createdAt: true,
        memo: true,
        supplier: true,
        toStoreId: true,
        transferGroupId: true,
      },
    }),
  ]);
  return { stores, products, stocktakes, txs };
}

export async function getDiagnostics(): Promise<Diagnostics> {
  const { stores, products, stocktakes, txs } = await loadAll();

  const pname = new Map(products.map((p) => [p.id, `${p.name}${p.size ? `（${p.size}）` : ""}`]));
  const nameOf = (id: string) => pname.get(id) ?? "（削除された商品）";

  // 店舗×商品ごとの最新の基準
  const key = (s: string, p: string) => `${s}|${p}`;
  const baseline = new Map<string, Baseline>();
  for (const st of stocktakes)
    for (const it of st.items) keepLatest(baseline, key(st.storeId, it.productId), baselineOf(it, st));

  // 在庫数
  const stock = new Map<string, number>();
  for (const [k, b] of baseline) stock.set(k, b.base);
  const counted = new Set<string>(); // 在庫に反映している取引ID
  for (const t of txs) {
    const k = key(t.storeId, t.productId);
    const b = baseline.get(k);
    if (b && !isAfterStocktake(t, b)) continue;
    counted.add(t.id);
    stock.set(k, (stock.get(k) ?? 0) + (TX_SIGN[t.type] ?? 0) * t.quantity);
  }

  const txByStore = new Map<string, typeof txs>();
  for (const t of txs) {
    let a = txByStore.get(t.storeId);
    if (!a) txByStore.set(t.storeId, (a = []));
    a.push(t);
  }

  const result: StoreDiagnosis[] = [];
  for (const s of stores) {
    const mine = txByStore.get(s.id) ?? [];

    // ① 二重登録の疑い
    const groups = new Map<string, typeof txs>();
    for (const t of mine) {
      const g = `${t.productId}|${t.type}|${t.quantity}|${jstDayKey(t.date)}`;
      let a = groups.get(g);
      if (!a) groups.set(g, (a = []));
      a.push(t);
    }
    const duplicates: DupGroup[] = [];
    for (const arr of groups.values()) {
      if (arr.length < 2) continue;
      arr.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      let run = [arr[0]];
      const flush = () => {
        if (run.length >= 2) {
          duplicates.push({
            productId: run[0].productId,
            productName: nameOf(run[0].productId),
            type: run[0].type,
            quantity: run[0].quantity,
            date: jstDayKey(run[0].date),
            count: run.length,
            enteredAt: run.map((r) => r.createdAt.toISOString()),
            inStock: run.some((r) => counted.has(r.id)),
          });
        }
      };
      for (let i = 1; i < arr.length; i++) {
        if (arr[i].createdAt.getTime() - arr[i - 1].createdAt.getTime() <= DUP_WINDOW_MS) run.push(arr[i]);
        else {
          flush();
          run = [arr[i]];
        }
      }
      flush();
    }
    duplicates.sort((a, b) => (a.enteredAt[0] < b.enteredAt[0] ? 1 : -1));

    // ② 棚卸の一覧（商品数が大きく減った月に印）
    const sts = stocktakes
      .filter((st) => st.storeId === s.id)
      .sort((a, b) => (a.targetMonth < b.targetMonth ? -1 : 1));
    let maxBefore = 0;
    const stocktakeRows: StocktakeRow[] = sts.map((st) => {
      const itemCount = st.items.length;
      const suspicious = maxBefore >= 6 && itemCount < maxBefore / 2;
      maxBefore = Math.max(maxBefore, itemCount);
      return {
        targetMonth: st.targetMonth,
        countedDay: jstDayKey(st.countedOn ?? st.confirmedAt),
        confirmedAt: st.confirmedAt.toISOString(),
        itemCount,
        suspicious,
      };
    });

    // ③ 棚卸の確定後に入力されたが、取引日が棚卸日以前のため足していない取引
    const backdated: BackdatedRow[] = [];
    let backdatedNet = 0;
    for (const t of mine) {
      const b = baseline.get(key(s.id, t.productId));
      if (!b || counted.has(t.id)) continue;
      if (t.createdAt.getTime() <= b.confirmedAt.getTime()) continue; // 確定前に入力済み＝通常の扱い
      const signed = (TX_SIGN[t.type] ?? 0) * t.quantity;
      backdatedNet += signed;
      backdated.push({
        productId: t.productId,
        productName: nameOf(t.productId),
        type: t.type,
        signed,
        date: jstDayKey(t.date),
        enteredAt: t.createdAt.toISOString(),
        stocktakeDay: stocktakeDay(b),
        memo: t.memo,
      });
    }
    backdated.sort((a, b) => (a.enteredAt < b.enteredAt ? 1 : -1));

    // ③' 棚卸の確定後に入力された、棚卸日より前の日付の入荷。在庫に足している。
    //    棚卸のときにもう棚にあった分なら二重になるので、確認できるように一覧する
    const lateOrders: BackdatedRow[] = [];
    for (const t of mine) {
      const b = baseline.get(key(s.id, t.productId));
      if (!b || !isLateOrder(t, b)) continue;
      lateOrders.push({
        productId: t.productId,
        productName: nameOf(t.productId),
        type: t.type,
        signed: (TX_SIGN[t.type] ?? 0) * t.quantity,
        date: jstDayKey(t.date),
        enteredAt: t.createdAt.toISOString(),
        stocktakeDay: stocktakeDay(b),
        memo: t.memo,
      });
    }
    lateOrders.sort((a, b) => (a.enteredAt < b.enteredAt ? 1 : -1));

    // ④ マイナス在庫
    const negatives: NegativeRow[] = [];
    for (const [k, v] of stock) {
      if (v >= 0 || !k.startsWith(`${s.id}|`)) continue;
      const pid = k.slice(s.id.length + 1);
      negatives.push({ productId: pid, productName: nameOf(pid), stock: v });
    }
    negatives.sort((a, b) => a.stock - b.stock);

    // ⑤ 移動入庫と発注の二重計上の疑い
    const transferOrderPairs: PairRow[] = [];
    const ins = mine.filter((t) => t.type === "TRANSFER_IN");
    const orders = mine.filter((t) => t.type === "ORDER");
    const used = new Set<string>();
    for (const tin of ins) {
      const hit = orders.find(
        (o) =>
          !used.has(o.id) &&
          o.productId === tin.productId &&
          o.quantity === tin.quantity &&
          Math.abs(o.date.getTime() - tin.date.getTime()) <= PAIR_WINDOW_DAYS * 86400000
      );
      if (!hit) continue;
      used.add(hit.id);
      transferOrderPairs.push({
        productId: tin.productId,
        productName: nameOf(tin.productId),
        quantity: tin.quantity,
        transferDate: jstDayKey(tin.date),
        orderDate: jstDayKey(hit.date),
      });
    }

    result.push({
      storeId: s.id,
      storeName: s.name,
      duplicates,
      stocktakes: stocktakeRows,
      backdated,
      backdatedNet,
      lateOrders,
      negatives,
      transferOrderPairs,
    });
  }

  // 同名・同サイズの重複商品（有効な商品のみ）
  const byName = new Map<string, typeof products>();
  for (const p of products) {
    if (!p.active) continue;
    const k = `${p.brandId}|${p.name.replace(/\s+/g, "")}|${p.size ?? ""}`;
    let a = byName.get(k);
    if (!a) byName.set(k, (a = []));
    a.push(p);
  }
  const duplicateProducts = [...byName.values()]
    .filter((a) => a.length >= 2)
    .map((a) => ({ brandName: a[0].brand.name, name: a[0].name, size: a[0].size, productIds: a.map((p) => p.id) }));

  return {
    generatedAt: new Date().toISOString(),
    sheetsConfigured: isSheetsConfigured(),
    duplicateProducts,
    stores: result,
    totals: {
      duplicateGroups: result.reduce((n, s) => n + s.duplicates.length, 0),
      duplicateExtra: result.reduce((n, s) => n + s.duplicates.reduce((m, d) => m + d.count - 1, 0), 0),
      suspiciousStocktakes: result.reduce((n, s) => n + s.stocktakes.filter((x) => x.suspicious).length, 0),
      backdated: result.reduce((n, s) => n + s.backdated.length, 0),
      lateOrders: result.reduce((n, s) => n + s.lateOrders.length, 0),
      negatives: result.reduce((n, s) => n + s.negatives.length, 0),
      transferOrderPairs: result.reduce((n, s) => n + s.transferOrderPairs.length, 0),
      duplicateProducts: duplicateProducts.length,
    },
  };
}

/**
 * 診断データ（ダウンロード用）。原因の特定に必要な在庫データだけを含める。
 * 担当者名・相手の名前・理由・ユーザー情報は含めない。
 */
export async function getDiagnosticsExport() {
  const [diag, raw] = await Promise.all([getDiagnostics(), loadAll()]);
  return {
    version: 1,
    generatedAt: diag.generatedAt,
    diagnostics: diag,
    stores: raw.stores.map((s) => ({ id: s.id, name: s.name, status: s.status })),
    products: raw.products.map((p) => ({
      id: p.id,
      brand: p.brand.name,
      name: p.name,
      size: p.size,
      active: p.active,
      allStores: p.allStores,
    })),
    stocktakes: raw.stocktakes.map((st) => ({
      id: st.id,
      storeId: st.storeId,
      targetMonth: st.targetMonth,
      countedOn: st.countedOn,
      confirmedAt: st.confirmedAt,
      items: st.items,
    })),
    transactions: raw.txs,
  };
}
