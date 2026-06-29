"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAreaManager } from "@/lib/session";
import { resolvePrices, type Rounding } from "@/lib/pricing";
import { getSetting } from "@/lib/settings";

const schema = z.object({
  brandId: z.string().min(1),
  name: z.string().min(1),
  category: z.string().optional(),
  taxRate: z.coerce.number().int(),
  priceModeNormal: z.enum(["EXCL", "INCL", "BOTH"]),
  priceModeWholesale: z.enum(["EXCL", "INCL", "BOTH"]),
  normalExcl: z.coerce.number().default(0),
  normalIncl: z.coerce.number().default(0),
  wholesaleExcl: z.coerce.number().default(0),
  wholesaleIncl: z.coerce.number().default(0),
  unit: z.string().default("個"),
  minStock: z.coerce.number().int().default(0),
  allStores: z.boolean().optional(),
  active: z.boolean().optional(),
});

async function buildData(formData: FormData) {
  const d = schema.parse({
    brandId: formData.get("brandId"),
    name: formData.get("name"),
    category: formData.get("category") || undefined,
    taxRate: formData.get("taxRate"),
    priceModeNormal: formData.get("priceModeNormal"),
    priceModeWholesale: formData.get("priceModeWholesale"),
    normalExcl: formData.get("normalExcl") || 0,
    normalIncl: formData.get("normalIncl") || 0,
    wholesaleExcl: formData.get("wholesaleExcl") || 0,
    wholesaleIncl: formData.get("wholesaleIncl") || 0,
    unit: formData.get("unit") || "個",
    minStock: formData.get("minStock") || 0,
    allStores: formData.get("allStores") === "on",
    active: formData.get("active") !== "off",
  });
  const rounding = ((await getSetting("taxRounding")) ?? "ROUND") as Rounding;
  const normal = resolvePrices(d.priceModeNormal, d.normalExcl, d.normalIncl, d.taxRate, rounding);
  const wholesale = resolvePrices(d.priceModeWholesale, d.wholesaleExcl, d.wholesaleIncl, d.taxRate, rounding);
  return {
    brandId: d.brandId,
    name: d.name,
    category: d.category ?? null,
    taxRate: d.taxRate,
    priceModeNormal: d.priceModeNormal,
    priceModeWholesale: d.priceModeWholesale,
    normalPriceExcl: normal.excl,
    normalPriceIncl: normal.incl,
    wholesalePriceExcl: wholesale.excl,
    wholesalePriceIncl: wholesale.incl,
    unit: d.unit,
    minStock: d.minStock,
    allStores: d.allStores ?? true,
    active: d.active ?? true,
  };
}

export async function createProduct(formData: FormData) {
  await requireAreaManager();
  const data = await buildData(formData);
  const count = await prisma.product.count();
  await prisma.product.create({ data: { ...data, sortOrder: count } });
  revalidatePath("/products");
  revalidatePath("/inventory");
}

export async function updateProduct(id: string, formData: FormData) {
  await requireAreaManager();
  const data = await buildData(formData);
  await prisma.product.update({ where: { id }, data });
  revalidatePath("/products");
  revalidatePath("/inventory");
}

export async function deleteProduct(formData: FormData) {
  await requireAreaManager();
  const id = String(formData.get("id"));
  const txCount = await prisma.transaction.count({ where: { productId: id } });
  if (txCount > 0) {
    await prisma.product.update({ where: { id }, data: { active: false } });
  } else {
    await prisma.product.delete({ where: { id } });
  }
  revalidatePath("/products");
  revalidatePath("/inventory");
}

/**
 * CSVインポート。列: ブランド名, 商品名, 通常価格(税抜), 通常価格(税込),
 * 卸価格(税抜), 卸価格(税込), 税率, カテゴリ, 単位
 * 片方しか無い価格は税率から補完。卸価格0はそのまま0。
 */
export async function importCsv(_prev: string | undefined, formData: FormData): Promise<string> {
  await requireAreaManager();
  const text = String(formData.get("csv") ?? "").trim();
  if (!text) return "CSVが空です。";

  const rounding = ((await getSetting("taxRounding")) ?? "ROUND") as Rounding;
  const lines = text.split(/\r?\n/).filter((l) => l.trim());

  const brands = await prisma.brand.findMany();
  const brandByName = new Map(brands.map((b) => [b.name.trim(), b.id]));

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];
  let order = await prisma.product.count();

  for (let i = 0; i < lines.length; i++) {
    // カンマ区切り・タブ区切り（スプレッドシートからの直接貼り付け）の両方に対応
    const delim = lines[i].includes("\t") ? "\t" : ",";
    const cols = lines[i].split(delim).map((c) => c.trim());
    if (cols.length < 2 || !cols[0] || !cols[1]) {
      skipped++;
      continue;
    }
    const [brandName, name, nExcl, nIncl, wExcl, wIncl, tax, category, unit] = cols;
    // タイトル行・見出し行はどの位置にあってもスキップ
    if (brandName === "ブランド名" || brandName === "ブランド" || name === "商品名" || name === "商品") {
      skipped++;
      continue;
    }
    let brandId = brandByName.get(brandName);
    if (!brandId) {
      // 未知ブランドは自動作成
      const b = await prisma.brand.create({ data: { name: brandName, sortOrder: brands.length } });
      brandByName.set(brandName, b.id);
      brandId = b.id;
    }
    const taxRate = Number(tax) === 8 ? 8 : 10;
    const normal = resolvePrices("BOTH", Number(nExcl) || 0, Number(nIncl) || 0, taxRate, rounding);
    const wholesale = resolvePrices("BOTH", Number(wExcl) || 0, Number(wIncl) || 0, taxRate, rounding);

    try {
      const existing = await prisma.product.findFirst({ where: { brandId, name } });
      const data = {
        brandId,
        name,
        category: category || null,
        taxRate,
        priceModeNormal: "BOTH",
        priceModeWholesale: "BOTH",
        normalPriceExcl: normal.excl,
        normalPriceIncl: normal.incl,
        wholesalePriceExcl: wholesale.excl,
        wholesalePriceIncl: wholesale.incl,
        unit: unit || "個",
      };
      if (existing) {
        await prisma.product.update({ where: { id: existing.id }, data });
        updated++;
      } else {
        await prisma.product.create({ data: { ...data, allStores: true, sortOrder: order++ } });
        created++;
      }
    } catch (e) {
      errors.push(`${name}: ${(e as Error).message}`);
    }
  }

  revalidatePath("/products");
  revalidatePath("/inventory");
  let msg = `インポート完了: 新規${created}件 / 更新${updated}件 / スキップ${skipped}件`;
  if (errors.length) msg += ` / エラー${errors.length}件`;
  return msg;
}
