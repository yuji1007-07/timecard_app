/**
 * getAllStoresInventorySummary の最適化（店舗ループ廃止→一括取得）が
 * 旧実装と完全に同じ結果になることを検証する。
 */
import { PrismaClient } from "@prisma/client";
import { TX_SIGN } from "../src/lib/constants";
import { getAllStoresInventorySummary } from "../src/lib/inventory";

const prisma = new PrismaClient();

// ---------- 旧実装（店舗ごとにループしてクエリ） ----------
async function getStoreProductsOld(storeId: string) {
  return prisma.product.findMany({
    where: {
      active: true,
      OR: [{ allStores: true }, { productStores: { some: { storeId } } }],
      NOT: { disabledStores: { some: { storeId } } },
    },
    include: { brand: true },
    orderBy: [{ brand: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }],
  });
}

async function computeStoreStocksOld(storeId: string) {
  const items = await prisma.stocktakeItem.findMany({
    where: { stocktake: { storeId } },
    include: { stocktake: { select: { confirmedAt: true } } },
    orderBy: { stocktake: { confirmedAt: "asc" } },
  });
  const baseline = new Map<string, { base: number; cutoff: Date }>();
  for (const it of items) baseline.set(it.productId, { base: it.actualQty, cutoff: it.stocktake.confirmedAt });

  const txs = await prisma.transaction.findMany({
    where: { storeId },
    select: { productId: true, type: true, quantity: true, createdAt: true },
  });
  const result = new Map<string, number>();
  for (const [pid, b] of baseline) result.set(pid, b.base);
  for (const t of txs) {
    const b = baseline.get(t.productId);
    if (b && t.createdAt <= b.cutoff) continue;
    result.set(t.productId, (result.get(t.productId) ?? 0) + (TX_SIGN[t.type] ?? 0) * t.quantity);
  }
  return result;
}

async function oldSummary() {
  const stores = await prisma.store.findMany({
    where: { isHeadquarters: false, status: "ACTIVE" },
    orderBy: { sortOrder: "asc" },
  });
  const perStore: any[] = [];
  const brandTotals = new Map<string, { name: string; color: string; wholesale: number; normal: number }>();
  let totalLow = 0;

  for (const s of stores) {
    const [products, stocks] = await Promise.all([getStoreProductsOld(s.id), computeStoreStocksOld(s.id)]);
    let vw = 0, vn = 0, low = 0;
    for (const p of products) {
      const stock = stocks.get(p.id) ?? 0;
      const svw = stock * p.wholesalePriceIncl;
      const svn = stock * p.normalPriceIncl;
      vw += svw; vn += svn;
      if (p.minStock > 0 && stock < p.minStock) { low++; totalLow++; }
      const bt = brandTotals.get(p.brandId) ?? { name: p.brand.name, color: p.brand.colorHex, wholesale: 0, normal: 0 };
      bt.wholesale += svw; bt.normal += svn;
      brandTotals.set(p.brandId, bt);
    }
    perStore.push({ storeId: s.id, storeName: s.name, businessType: s.businessType, valueWholesale: vw, valueNormal: vn, lowCount: low });
  }
  return {
    perStore,
    brandTotals: Array.from(brandTotals.values()).sort((a, b) => b.wholesale - a.wholesale),
    totalLow,
    totalWholesale: perStore.reduce((s, p) => s + p.valueWholesale, 0),
    totalNormal: perStore.reduce((s, p) => s + p.valueNormal, 0),
  };
}

// ---------- テストデータ（エッジケース込み） ----------
const D = (s: string) => new Date(s);

async function seed() {
  // 安全装置: このスクリプトは全データを削除するのでローカルDB以外では絶対に動かさない
  const url = process.env.DATABASE_URL ?? "";
  if (!/(localhost|127\.0\.0\.1)/.test(url) || /supabase|pooler|neon/i.test(url)) {
    throw new Error(
      "verify-summary.ts はローカル検証用です。DATABASE_URL がローカルDBではないため中止しました。"
    );
  }

  await prisma.transaction.deleteMany();
  await prisma.stocktakeItem.deleteMany();
  await prisma.stocktake.deleteMany();
  await prisma.storeProductDisable.deleteMany();
  await prisma.productStore.deleteMany();
  await prisma.product.deleteMany();
  await prisma.brand.deleteMany();
  await prisma.store.deleteMany();

  const b1 = await prisma.brand.create({ data: { name: "ReD", colorHex: "#e11", sortOrder: 0 } });
  const b2 = await prisma.brand.create({ data: { name: "プロラボ", colorHex: "#0a0", sortOrder: 1 } });

  // 店舗: 通常2, 休止1(集計対象外), 本部1(対象外)
  const s1 = await prisma.store.create({ data: { name: "A店", sortOrder: 0 } });
  const s2 = await prisma.store.create({ data: { name: "B店", sortOrder: 1 } });
  await prisma.store.create({ data: { name: "休止店", sortOrder: 2, status: "SUSPENDED" } });
  await prisma.store.create({ data: { name: "本部", sortOrder: 3, isHeadquarters: true } });

  const mk = (n: string, brandId: string, o: any = {}) =>
    prisma.product.create({
      data: { name: n, brandId, wholesalePriceIncl: 1000, normalPriceIncl: 2000, minStock: 0, ...o },
    });

  const p1 = await mk("全店共通A", b1.id, { minStock: 5 });           // 在庫不足判定あり
  const p2 = await mk("全店共通B", b1.id);
  const p3 = await mk("一部店舗のみ", b2.id, { allStores: false });    // ProductStore で A店のみ
  const p4 = await mk("無効商品", b2.id, { active: false });           // 集計対象外
  const p5 = await mk("B店でオフ", b2.id, { minStock: 3 });            // A店のみ表示

  await prisma.productStore.create({ data: { productId: p3.id, storeId: s1.id } });
  await prisma.storeProductDisable.create({ data: { productId: p5.id, storeId: s2.id } });

  // A店: 棚卸ベースラインあり（cutoff 前後の取引を混在）
  const st = await prisma.stocktake.create({
    data: { storeId: s1.id, targetMonth: "2026-06", confirmedAt: D("2026-06-30T00:00:00Z") },
  });
  await prisma.stocktakeItem.createMany({
    data: [
      { stocktakeId: st.id, productId: p1.id, theoreticalQty: 0, actualQty: 10 },
      { stocktakeId: st.id, productId: p3.id, theoreticalQty: 0, actualQty: 4 },
    ],
  });
  // 同じ商品で「より古い棚卸」も入れて、最新が勝つことを確認
  const stOld = await prisma.stocktake.create({
    data: { storeId: s1.id, targetMonth: "2026-05", confirmedAt: D("2026-05-31T00:00:00Z") },
  });
  await prisma.stocktakeItem.create({
    data: { stocktakeId: stOld.id, productId: p1.id, theoreticalQty: 0, actualQty: 999 },
  });

  const tx = (storeId: string, productId: string, type: string, quantity: number, createdAt: Date) =>
    prisma.transaction.create({ data: { storeId, productId, type, quantity, createdAt, date: createdAt } });

  // cutoff 以前（無視されるべき）／cutoff ちょうど（無視）／cutoff 以降（加算）
  await tx(s1.id, p1.id, "ORDER", 50, D("2026-06-01T00:00:00Z"));
  await tx(s1.id, p1.id, "ORDER", 7, D("2026-06-30T00:00:00Z")); // ちょうど = 無視
  await tx(s1.id, p1.id, "ORDER", 3, D("2026-07-01T00:00:00Z"));
  await tx(s1.id, p1.id, "CONSUME", 1, D("2026-07-02T00:00:00Z"));
  await tx(s1.id, p3.id, "GIFT", 2, D("2026-07-03T00:00:00Z"));
  // 棚卸ベースラインが無い商品（全期間集計）
  await tx(s1.id, p2.id, "ORDER", 20, D("2026-01-01T00:00:00Z"));
  await tx(s1.id, p2.id, "EMPLOYEE_SALE", 5, D("2026-07-04T00:00:00Z"));
  // A店でのみオフでない p5
  await tx(s1.id, p5.id, "ORDER", 1, D("2026-07-05T00:00:00Z"));
  // B店（棚卸なし）
  await tx(s2.id, p1.id, "ORDER", 8, D("2026-07-01T00:00:00Z"));
  await tx(s2.id, p2.id, "TRANSFER_IN", 6, D("2026-07-02T00:00:00Z"));
  await tx(s2.id, p2.id, "TRANSFER_OUT", 2, D("2026-07-03T00:00:00Z"));
  // B店でオフの商品にも取引がある（集計に出てはいけない）
  await tx(s2.id, p5.id, "ORDER", 100, D("2026-07-06T00:00:00Z"));
  // 無効商品の取引（集計対象外）
  await tx(s1.id, p4.id, "ORDER", 77, D("2026-07-07T00:00:00Z"));
}

function norm(o: any) {
  return JSON.stringify(o, (_k, v) => (typeof v === "number" ? Math.round(v * 1e6) / 1e6 : v), 2);
}

async function main() {
  await seed();
  const [oldR, newR] = [await oldSummary(), await getAllStoresInventorySummary()];

  const a = norm(oldR);
  const b = norm(newR);
  console.log("--- 新実装の結果 ---");
  console.log(b);

  if (a === b) {
    console.log("\n✅ PASS: 旧実装と新実装の結果が完全一致");
  } else {
    console.log("\n❌ FAIL: 差異あり");
    console.log("--- 旧 ---\n" + a);
    process.exitCode = 1;
  }

  // 期待値の手計算チェック（最新棚卸=10, cutoff後 +3 -1 = 12）
  const a1 = newR.perStore.find((p) => p.storeName === "A店")!;
  const expA =
    12 * 1000 + // p1: 10 + 3 - 1
    15 * 1000 + // p2: 20 - 5（棚卸なし=全期間）
    2 * 1000 +  // p3: 4 - 2
    1 * 1000;   // p5: 1
  console.log(`\nA店 卸在庫金額: 実測 ${a1.valueWholesale} / 手計算 ${expA}`);
  if (a1.valueWholesale !== expA) {
    console.log("❌ FAIL: A店の手計算と不一致");
    process.exitCode = 1;
  } else {
    console.log("✅ 手計算とも一致");
  }

  const b1 = newR.perStore.find((p) => p.storeName === "B店")!;
  const expB = 8 * 1000 + 4 * 1000; // p1:8, p2:+6-2=4, p5はオフなので0
  console.log(`B店 卸在庫金額: 実測 ${b1.valueWholesale} / 手計算 ${expB}（オフ商品100個が除外されること）`);
  if (b1.valueWholesale !== expB) {
    console.log("❌ FAIL: B店の手計算と不一致");
    process.exitCode = 1;
  } else {
    console.log("✅ 手計算とも一致");
  }

  console.log(`\n休止店・本部が含まれないこと: 店舗数=${newR.perStore.length}（期待2）`);
  if (newR.perStore.length !== 2) process.exitCode = 1;

  await prisma.$disconnect();
}

main();
