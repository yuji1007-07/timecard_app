import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { requireProductManager } from "@/lib/session";
import { BrandBadge } from "@/components/badges";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { StoreSelect } from "./store-select";
import { ProductToggle } from "./toggle";
import { enableAllForStore } from "./actions";

export const dynamic = "force-dynamic";

export default async function StoreProductsPage({ searchParams }: { searchParams: Promise<{ store?: string }> }) {
  const user = await requireProductManager();
  const sp = await searchParams;

  // 本部は全店舗、店舗マネージャーは自店舗のみ管理できる
  const stores = await prisma.store.findMany({
    where:
      user.role === "AREA_MANAGER"
        ? { isHeadquarters: false, status: "ACTIVE" }
        : { id: user.storeId ?? "__none__" },
    select: { id: true, name: true },
    orderBy: { sortOrder: "asc" },
  });

  if (stores.length === 0) {
    return (
      <div>
        <PageHeader title="店舗別 取扱設定" description="各店舗で「使わない商品」をオフにできます。" />
        <Card className="p-6 text-sm text-muted-foreground">管理できる店舗がありません。</Card>
      </div>
    );
  }

  const selectedStoreId = stores.find((s) => s.id === sp.store)?.id ?? stores[0].id;
  const selectedStore = stores.find((s) => s.id === selectedStoreId)!;

  const [products, disabled] = await Promise.all([
    prisma.product.findMany({
      where: { active: true },
      include: { brand: true },
      orderBy: [{ brand: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.storeProductDisable.findMany({ where: { storeId: selectedStoreId }, select: { productId: true } }),
  ]);
  const disabledSet = new Set(disabled.map((d) => d.productId));
  const offCount = disabledSet.size;

  // ブランドごとにまとめる
  const groups = new Map<string, { brandName: string; brandColor: string; items: typeof products }>();
  for (const p of products) {
    const g = groups.get(p.brandId) ?? { brandName: p.brand.name, brandColor: p.brand.colorHex, items: [] as typeof products };
    g.items.push(p);
    groups.set(p.brandId, g);
  }

  return (
    <div>
      <PageHeader
        title="店舗別 取扱設定"
        description="各店舗で「使わない商品」をオフにできます。商品マスタ（大元）は本部で管理し、ここでは店舗ごとの表示だけを切り替えます。オフにすると、その店舗の在庫一覧・取引記録・棚卸に出てこなくなります。"
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        {user.role === "AREA_MANAGER" ? (
          <StoreSelect stores={stores} selected={selectedStoreId} />
        ) : (
          <div className="rounded-md border bg-secondary/40 px-3 py-2 text-sm font-medium">{selectedStore.name}</div>
        )}
        <span className="text-sm text-muted-foreground">
          全{products.length}点中 <span className="font-medium text-foreground">{products.length - offCount}</span> 点オン / {offCount} 点オフ
        </span>
        {offCount > 0 && (
          <form action={enableAllForStore}>
            <input type="hidden" name="storeId" value={selectedStoreId} />
            <ConfirmSubmit variant="ghost" size="sm" message={`${selectedStore.name} の全商品をオンに戻しますか？`}>
              全てオンに戻す
            </ConfirmSubmit>
          </form>
        )}
      </div>

      <div className="space-y-4">
        {Array.from(groups.values()).map((g) => (
          <Card key={g.brandName} className="overflow-hidden">
            <div className="border-b bg-secondary/40 px-4 py-2">
              <BrandBadge name={g.brandName} color={g.brandColor} />
            </div>
            <div className="divide-y">
              {g.items.map((p) => {
                const on = !disabledSet.has(p.id);
                return (
                  <div key={p.id} className={`flex items-center justify-between gap-3 px-4 py-2.5 ${on ? "" : "bg-muted/30"}`}>
                    <div className="min-w-0">
                      <span className={`font-medium ${on ? "" : "text-muted-foreground line-through"}`}>{p.name}</span>
                      {p.size && <span className="ml-2 rounded bg-navy/10 px-1.5 py-0.5 text-xs text-navy">{p.size}</span>}
                      {p.category && <span className="ml-2 text-xs text-muted-foreground">{p.category}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs ${on ? "text-emerald-600" : "text-muted-foreground"}`}>{on ? "オン" : "オフ"}</span>
                      <ProductToggle storeId={selectedStoreId} productId={p.id} enabled={on} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
