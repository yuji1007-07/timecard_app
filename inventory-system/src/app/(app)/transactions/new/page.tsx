import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { TransactionForm } from "./transaction-form";

export const dynamic = "force-dynamic";

export default async function NewTransactionPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;

  const [products, stores] = await Promise.all([
    prisma.product.findMany({ where: { active: true }, include: { brand: true }, orderBy: [{ brand: { sortOrder: "asc" } }, { sortOrder: "asc" }] }),
    prisma.store.findMany({ where: { isHeadquarters: false, status: "ACTIVE" }, select: { id: true, name: true }, orderBy: { sortOrder: "asc" } }),
  ]);

  const productOpts = products.map((p) => ({
    id: p.id,
    brandId: p.brandId,
    name: p.name,
    brandName: p.brand.name,
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
      />
    </div>
  );
}
