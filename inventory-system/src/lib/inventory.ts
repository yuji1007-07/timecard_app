import { prisma } from "@/lib/prisma";
import { computeStoreStocks, getStoreProducts } from "@/lib/stock";
import { TX_SIGN } from "@/lib/constants";

export type InventoryRow = {
  productId: string;
  name: string;
  size: string | null;
  brandId: string;
  brandName: string;
  brandColor: string;
  category: string | null;
  unit: string;
  taxRate: number;
  stock: number;
  minStock: number;
  normalExcl: number;
  normalIncl: number;
  wholesaleExcl: number;
  wholesaleIncl: number;
  stockValueWholesale: number; // 在庫金額（卸価格ベース）
  stockValueNormal: number; // 在庫金額（通常価格ベース）
  low: boolean;
};

export async function getStoreInventory(storeId: string): Promise<InventoryRow[]> {
  const [products, stocks] = await Promise.all([
    getStoreProducts(storeId),
    computeStoreStocks(storeId),
  ]);

  return products.map((p) => {
    const stock = stocks.get(p.id) ?? 0;
    return {
      productId: p.id,
      name: p.name,
      size: p.size,
      brandId: p.brandId,
      brandName: p.brand.name,
      brandColor: p.brand.colorHex,
      category: p.category,
      unit: p.unit,
      taxRate: p.taxRate,
      stock,
      minStock: p.minStock,
      normalExcl: p.normalPriceExcl,
      normalIncl: p.normalPriceIncl,
      wholesaleExcl: p.wholesalePriceExcl,
      wholesaleIncl: p.wholesalePriceIncl,
      stockValueWholesale: stock * p.wholesalePriceIncl,
      stockValueNormal: stock * p.normalPriceIncl,
      low: p.minStock > 0 && stock < p.minStock,
    };
  });
}

/**
 * 全店の在庫金額・在庫不足を集計（本部ダッシュボード用）。
 *
 * 店舗ごとにループしてクエリを投げると
 * 「21店舗 × (商品取得 + 在庫算出)」で数十回の往復が発生し、
 * Supabase のプーラー（connection_limit=1）では直列に待たされて非常に遅い。
 * そのため必要なデータを数回のクエリでまとめて取得し、集計はメモリ上で行う。
 */
export async function getAllStoresInventorySummary() {
  const [stores, products, disables, productStores, stItems, txs] = await Promise.all([
    prisma.store.findMany({
      where: { isHeadquarters: false, status: "ACTIVE" },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.product.findMany({
      where: { active: true },
      include: { brand: true },
    }),
    prisma.storeProductDisable.findMany({ select: { storeId: true, productId: true } }),
    prisma.productStore.findMany({ select: { storeId: true, productId: true } }),
    prisma.stocktakeItem.findMany({
      select: {
        productId: true,
        actualQty: true,
        stocktake: { select: { storeId: true, confirmedAt: true } },
      },
      orderBy: { stocktake: { confirmedAt: "asc" } },
    }),
    prisma.transaction.findMany({
      select: { storeId: true, productId: true, type: true, quantity: true, createdAt: true },
    }),
  ]);

  // 店舗ごとの「取扱オフ」商品 / 個別取扱商品
  const disabledByStore = new Map<string, Set<string>>();
  for (const d of disables) {
    let s = disabledByStore.get(d.storeId);
    if (!s) disabledByStore.set(d.storeId, (s = new Set()));
    s.add(d.productId);
  }
  const allowedByStore = new Map<string, Set<string>>();
  for (const ps of productStores) {
    let s = allowedByStore.get(ps.storeId);
    if (!s) allowedByStore.set(ps.storeId, (s = new Set()));
    s.add(ps.productId);
  }

  // 棚卸ベースライン（confirmedAt 昇順なので後勝ちで最新になる）
  const key = (storeId: string, productId: string) => `${storeId}|${productId}`;
  const baseline = new Map<string, { base: number; cutoff: Date }>();
  for (const it of stItems) {
    baseline.set(key(it.stocktake.storeId, it.productId), {
      base: it.actualQty,
      cutoff: it.stocktake.confirmedAt,
    });
  }

  // 在庫 = ベースライン + それ以降の取引の符号付き合計
  const stocks = new Map<string, number>();
  for (const [k, b] of baseline) stocks.set(k, b.base);
  for (const t of txs) {
    const k = key(t.storeId, t.productId);
    const b = baseline.get(k);
    if (b && t.createdAt <= b.cutoff) continue; // ベースライン以前は無視
    stocks.set(k, (stocks.get(k) ?? 0) + (TX_SIGN[t.type] ?? 0) * t.quantity);
  }

  const perStore: {
    storeId: string;
    storeName: string;
    businessType: string;
    valueWholesale: number;
    valueNormal: number;
    lowCount: number;
  }[] = [];

  const brandTotals = new Map<string, { name: string; color: string; wholesale: number; normal: number }>();
  let totalLow = 0;

  for (const s of stores) {
    const disabled = disabledByStore.get(s.id);
    const allowed = allowedByStore.get(s.id);
    let vw = 0;
    let vn = 0;
    let low = 0;

    for (const p of products) {
      // 取扱判定（getStoreProducts と同じ条件）
      if (!(p.allStores || allowed?.has(p.id))) continue;
      if (disabled?.has(p.id)) continue;

      const stock = stocks.get(key(s.id, p.id)) ?? 0;
      const valueWholesale = stock * p.wholesalePriceIncl;
      vw += valueWholesale;
      vn += stock * p.normalPriceIncl;
      if (p.minStock > 0 && stock < p.minStock) {
        low++;
        totalLow++;
      }

      const bt = brandTotals.get(p.brandId) ?? {
        name: p.brand.name,
        color: p.brand.colorHex,
        wholesale: 0,
        normal: 0,
      };
      bt.wholesale += valueWholesale;
      bt.normal += stock * p.normalPriceIncl;
      brandTotals.set(p.brandId, bt);
    }

    perStore.push({
      storeId: s.id,
      storeName: s.name,
      businessType: s.businessType,
      valueWholesale: vw,
      valueNormal: vn,
      lowCount: low,
    });
  }

  return {
    perStore,
    brandTotals: Array.from(brandTotals.values()).sort((a, b) => b.wholesale - a.wholesale),
    totalLow,
    totalWholesale: perStore.reduce((s, p) => s + p.valueWholesale, 0),
    totalNormal: perStore.reduce((s, p) => s + p.valueNormal, 0),
  };
}
