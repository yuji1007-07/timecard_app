import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { requireProductManager } from "@/lib/session";
import { BrandBadge } from "@/components/badges";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { yen } from "@/lib/constants";
import { ProductForm } from "./product-form";
import { CsvImport } from "./csv-import";
import { SizeSplitButton } from "./size-split-button";
import { deleteProduct } from "./actions";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  await requireProductManager();
  const [products, brands, categories] = await Promise.all([
    prisma.product.findMany({ include: { brand: true }, orderBy: [{ brand: { sortOrder: "asc" } }, { sortOrder: "asc" }] }),
    prisma.brand.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  const catNames = categories.map((c) => c.name);

  return (
    <div>
      <PageHeader
        title="商品マスタ"
        description="ブランド・税率・税抜/税込価格を管理。CSVで一括投入できます。"
        action={
          <div className="flex flex-wrap gap-2">
            <SizeSplitButton />
            <CsvImport />
            <ProductForm brands={brands} categories={catNames} />
          </div>
        }
      />
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">ブランド</th>
              <th className="px-3 py-2 text-left">商品名</th>
              <th className="px-3 py-2 text-left">サイズ</th>
              <th className="px-3 py-2 text-left">カテゴリ</th>
              <th className="px-3 py-2 text-right">税率</th>
              <th className="px-3 py-2 text-right">通常(税抜/税込)</th>
              <th className="px-3 py-2 text-right">卸(税抜/税込)</th>
              <th className="px-3 py-2 text-right">最小在庫</th>
              <th className="px-3 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className={`border-t ${p.active ? "" : "opacity-50"}`}>
                <td className="px-3 py-2"><BrandBadge name={p.brand.name} color={p.brand.colorHex} /></td>
                <td className="px-3 py-2 font-medium">{p.name}{!p.active && <span className="ml-1 text-xs text-muted-foreground">(無効)</span>}</td>
                <td className="px-3 py-2">{p.size ? <span className="rounded bg-navy/10 px-1.5 py-0.5 text-xs text-navy">{p.size}</span> : "-"}</td>
                <td className="px-3 py-2 text-muted-foreground">{p.category ?? "-"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{p.taxRate}%</td>
                <td className="px-3 py-2 text-right tabular-nums">{yen(p.normalPriceExcl)} / {yen(p.normalPriceIncl)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{yen(p.wholesalePriceExcl)} / {yen(p.wholesalePriceIncl)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{p.minStock} {p.unit}</td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-2">
                    <ProductForm brands={brands} categories={catNames} product={p} />
                    <form action={deleteProduct}>
                      <input type="hidden" name="id" value={p.id} />
                      <ConfirmSubmit message={`「${p.name}」を削除しますか？（取引履歴がある場合は無効化されます）`}>削除</ConfirmSubmit>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="mt-3 text-xs text-muted-foreground">商品数: {products.length}点</p>
    </div>
  );
}
