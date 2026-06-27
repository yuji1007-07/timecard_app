import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { prisma } from "@/lib/prisma";
import { requireAreaManager } from "@/lib/session";
import { BrandBadge } from "@/components/badges";
import { ConfirmSubmit, SubmitButton } from "@/components/confirm-submit";
import { BrandEditForm } from "./brand-form";
import { createBrand, deleteBrand, createCategory, deleteCategory } from "./actions";

export const dynamic = "force-dynamic";

export default async function BrandsPage() {
  await requireAreaManager();
  const [brands, categories, productCounts] = await Promise.all([
    prisma.brand.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.product.groupBy({ by: ["brandId"], _count: true }),
  ]);
  const countMap = new Map(productCounts.map((c) => [c.brandId, c._count]));

  return (
    <div>
      <PageHeader title="ブランド・カテゴリ管理" description="商品が属するブランドと、分類カテゴリを管理します。" />
      <div className="grid gap-4 lg:grid-cols-2">
        {/* ブランド */}
        <Card>
          <CardHeader>
            <CardTitle>ブランド（{brands.length}）</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <form action={createBrand} className="flex flex-wrap items-center gap-2">
              <Input name="name" placeholder="新しいブランド名" className="h-9 w-44" required />
              <input name="colorHex" type="color" defaultValue="#1e3a5f" className="h-9 w-10 rounded border" />
              <SubmitButton size="sm">＋ 追加</SubmitButton>
            </form>
            <div className="divide-y">
              {brands.map((b) => (
                <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div className="flex items-center gap-2">
                    <BrandBadge name={b.name} color={b.colorHex} />
                    {!b.active && <span className="text-xs text-muted-foreground">(無効)</span>}
                    <span className="text-xs text-muted-foreground">商品{countMap.get(b.id) ?? 0}点</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <BrandEditForm brand={b} />
                    <form action={deleteBrand}>
                      <input type="hidden" name="id" value={b.id} />
                      <ConfirmSubmit message={`「${b.name}」を削除しますか？（商品がある場合は無効化されます）`}>削除</ConfirmSubmit>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* カテゴリ */}
        <Card>
          <CardHeader>
            <CardTitle>カテゴリ（{categories.length}）</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <form action={createCategory} className="flex items-center gap-2">
              <Input name="name" placeholder="新しいカテゴリ名" className="h-9 w-44" required />
              <SubmitButton size="sm">＋ 追加</SubmitButton>
            </form>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <div key={c.id} className="flex items-center gap-1 rounded-full border bg-secondary/50 py-1 pl-3 pr-1 text-sm">
                  {c.name}
                  <form action={deleteCategory}>
                    <input type="hidden" name="id" value={c.id} />
                    <ConfirmSubmit message={`カテゴリ「${c.name}」を削除しますか？`} variant="ghost" size="sm" className="h-6 px-2 text-muted-foreground">×</ConfirmSubmit>
                  </form>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
