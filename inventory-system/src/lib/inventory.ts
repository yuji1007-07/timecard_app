import { prisma } from "@/lib/prisma";
import { computeStoreStocks, getStoreProducts } from "@/lib/stock";

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

/** 全店の在庫金額・在庫不足を集計（本部ダッシュボード用） */
export async function getAllStoresInventorySummary() {
  const stores = await prisma.store.findMany({
    where: { isHeadquarters: false, status: "ACTIVE" },
    orderBy: { sortOrder: "asc" },
  });

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
    const rows = await getStoreInventory(s.id);
    let vw = 0;
    let vn = 0;
    let low = 0;
    for (const r of rows) {
      vw += r.stockValueWholesale;
      vn += r.stockValueNormal;
      if (r.low) {
        low++;
        totalLow++;
      }
      const bt = brandTotals.get(r.brandId) ?? { name: r.brandName, color: r.brandColor, wholesale: 0, normal: 0 };
      bt.wholesale += r.stockValueWholesale;
      bt.normal += r.stockValueNormal;
      brandTotals.set(r.brandId, bt);
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
