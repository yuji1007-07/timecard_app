import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getStoreProducts, jstDayKey } from "@/lib/stock";
import { TransactionForm } from "./transaction-form";

export const dynamic = "force-dynamic";

export default async function NewTransactionPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;

  const [products, stores, stocktakes] = await Promise.all([
    // 店舗スタッフ/マネージャーは自店舗で「オフ」にした商品を除外。本部は全商品。
    user.storeId
      ? getStoreProducts(user.storeId)
      : prisma.product.findMany({ where: { active: true }, include: { brand: true }, orderBy: [{ brand: { sortOrder: "asc" } }, { sortOrder: "asc" }] }),
    prisma.store.findMany({ where: { isHeadquarters: false, status: "ACTIVE" }, select: { id: true, name: true }, orderBy: { sortOrder: "asc" } }),
    // 店舗ごとの直近の棚卸日（これ以前の日付で記録しても在庫は動かないため注意表示に使う）
    prisma.stocktake.findMany({ select: { storeId: true, countedOn: true, confirmedAt: true } }),
  ]);

  const lastStocktakeDay: Record<string, string> = {};
  for (const st of stocktakes) {
    const day = jstDayKey(st.countedOn ?? st.confirmedAt);
    const cur = lastStocktakeDay[st.storeId];
    if (!cur || day > cur) lastStocktakeDay[st.storeId] = day;
  }

  const productOpts = products.map((p) => ({
    id: p.id,
    brandId: p.brandId,
    name: p.name,
    brandName: p.brand.name,
    size: p.size,
    taxRate: p.taxRate,
    unit: p.unit,
    normalIncl: p.normalPriceIncl,
    wholesaleIncl: p.wholesalePriceIncl,
  }));

  return (
    <div>
      <PageHeader title="取引を記録" description="発注・消耗・店舗間移動・社販・プレゼントを記録します。在庫は履歴の積み上げで自動計算されます。" />
      <TransactionForm
        products={productOpts}
        stores={stores}
        fixedStoreId={user.role === "AREA_MANAGER" ? null : user.storeId}
        defaultType={sp.type}
        lastStocktakeDay={lastStocktakeDay}
        todayJst={jstDayKey(new Date())}
      />
    </div>
  );
}
