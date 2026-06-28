import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/stat-card";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getStoreInventory } from "@/lib/inventory";
import { InventoryAccordion } from "@/components/inventory-accordion";
import { yen } from "@/lib/constants";

export const dynamic = "force-dynamic";

type SP = { store?: string; brand?: string; category?: string; q?: string; low?: string; tax?: string };

export default async function InventoryPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const isArea = user.role === "AREA_MANAGER";

  const stores = await prisma.store.findMany({
    where: { isHeadquarters: false },
    select: { id: true, name: true },
    orderBy: { sortOrder: "asc" },
  });

  // 対象店舗の決定
  const storeId = isArea ? sp.store || stores[0]?.id : user.storeId ?? "";
  const store = stores.find((s) => s.id === storeId);

  const [brands, categories] = await Promise.all([
    prisma.brand.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  let rows = storeId ? await getStoreInventory(storeId) : [];

  // フィルタ
  if (sp.brand) rows = rows.filter((r) => r.brandId === sp.brand);
  if (sp.category) rows = rows.filter((r) => r.category === sp.category);
  if (sp.q) rows = rows.filter((r) => r.name.includes(sp.q!));
  if (sp.tax) rows = rows.filter((r) => r.taxRate === Number(sp.tax));
  if (sp.low === "1") rows = rows.filter((r) => r.low);

  const totalValue = rows.reduce((s, r) => s + r.stockValueWholesale, 0);
  const totalValueNormal = rows.reduce((s, r) => s + r.stockValueNormal, 0);
  const lowCount = rows.filter((r) => r.low).length;

  const sel = "h-9 rounded-md border border-input bg-background px-2 text-sm";

  return (
    <div>
      <PageHeader
        title="在庫一覧"
        description={store ? `${store.name} の在庫（ブランド別）` : "店舗を選択してください"}
      />

      <form method="GET" className="mb-4 flex flex-wrap items-end gap-2 rounded-lg border bg-card p-3">
        {isArea && (
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            店舗
            <select name="store" defaultValue={storeId} className={sel}>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
        )}
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          ブランド
          <select name="brand" defaultValue={sp.brand ?? ""} className={sel}>
            <option value="">全て</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          カテゴリ
          <select name="category" defaultValue={sp.category ?? ""} className={sel}>
            <option value="">全て</option>
            {categories.map((c) => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          税率
          <select name="tax" defaultValue={sp.tax ?? ""} className={sel}>
            <option value="">全て</option>
            <option value="8">8%</option>
            <option value="10">10%</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          商品名
          <input name="q" defaultValue={sp.q ?? ""} placeholder="部分一致" className={sel} />
        </label>
        <label className="flex items-center gap-1 pb-1 text-sm">
          <input type="checkbox" name="low" value="1" defaultChecked={sp.low === "1"} className="h-4 w-4" /> 在庫不足のみ
        </label>
        <button type="submit" className="h-9 rounded-md bg-navy px-4 text-sm text-white">絞り込み</button>
      </form>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="商品数" value={`${rows.length}`} />
        <StatCard label="在庫金額（卸）" value={yen(totalValue)} />
        <StatCard label="在庫金額（通常）" value={yen(totalValueNormal)} />
        <StatCard label="在庫不足" value={`${lowCount}`} tone={lowCount > 0 ? "bad" : "good"} />
      </div>

      {storeId ? (
        <InventoryAccordion rows={rows} />
      ) : (
        <Card className="p-6 text-center text-sm text-muted-foreground">店舗が割り当てられていません。</Card>
      )}
    </div>
  );
}
