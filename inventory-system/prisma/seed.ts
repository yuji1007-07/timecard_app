import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  SEED_STORES,
  SEED_BRANDS,
  SEED_CATEGORIES,
  SEED_PRODUCTS,
} from "../src/lib/seed-data";
import { resolvePrices } from "../src/lib/pricing";
import { DEFAULT_SETTINGS } from "../src/lib/settings";
import { getStoreInventory } from "../src/lib/inventory";

const prisma = new PrismaClient();

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function thisMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

async function main() {
  console.log("🌱 シード開始");

  // 既存データを掃除（依存順）
  await prisma.stocktakeItem.deleteMany();
  await prisma.stocktake.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.productStore.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.brand.deleteMany();
  await prisma.user.deleteMany();
  await prisma.store.deleteMany();
  await prisma.setting.deleteMany();

  // ===== 設定 =====
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await prisma.setting.create({ data: { key, value } });
  }

  // ===== 本部（仮想店舗 兼 フラグ） =====
  const hq = await prisma.store.create({
    data: { name: "本部（エリア管理）", businessType: "COMPLEX", isHeadquarters: true, sortOrder: 0, status: "ACTIVE" },
  });

  // ===== 店舗 =====
  const stores: Record<string, string> = {};
  let order = 1;
  for (const s of SEED_STORES) {
    const created = await prisma.store.create({
      data: {
        name: s.name,
        businessType: s.businessType,
        directorName: s.directorName ?? null,
        pinCode: s.pin ?? null,
        sortOrder: order++,
        status: "ACTIVE",
        openDate: daysAgo(365 * 2),
      },
    });
    stores[s.name] = created.id;
  }

  // ===== ブランド =====
  const brands: Record<string, string> = {};
  let bOrder = 0;
  for (const b of SEED_BRANDS) {
    const created = await prisma.brand.create({
      data: { name: b.name, colorHex: b.colorHex, sortOrder: bOrder++ },
    });
    brands[b.name] = created.id;
  }

  // ===== カテゴリ =====
  let cOrder = 0;
  for (const c of SEED_CATEGORIES) {
    await prisma.category.create({ data: { name: c, sortOrder: cOrder++ } });
  }

  // ===== 商品 =====
  const products: { id: string; wholesaleIncl: number; normalIncl: number }[] = [];
  let pOrder = 0;
  for (const p of SEED_PRODUCTS) {
    const modeN = p.priceModeNormal ?? "BOTH";
    const modeW = p.priceModeWholesale ?? "BOTH";
    const normal = resolvePrices(modeN, p.normalExcl, p.normalIncl, p.taxRate);
    const wholesale = resolvePrices(modeW, p.wholesaleExcl, p.wholesaleIncl, p.taxRate);
    const created = await prisma.product.create({
      data: {
        brandId: brands[p.brand],
        name: p.name,
        category: p.category,
        normalPriceExcl: normal.excl,
        normalPriceIncl: normal.incl,
        wholesalePriceExcl: wholesale.excl,
        wholesalePriceIncl: wholesale.incl,
        taxRate: p.taxRate,
        priceModeNormal: modeN,
        priceModeWholesale: modeW,
        unit: p.unit,
        minStock: p.minStock,
        allStores: true,
        sortOrder: pOrder++,
      },
    });
    products.push({ id: created.id, wholesaleIncl: wholesale.incl, normalIncl: normal.incl });
  }

  // ===== ユーザー =====
  const hash = (pw: string) => bcrypt.hashSync(pw, 10);
  await prisma.user.create({
    data: {
      email: "hq@example.com",
      passwordHash: hash("password"),
      name: "本部 管理者",
      role: "AREA_MANAGER",
    },
  });
  // 代表店舗スタッフ（メールログイン用）
  const staffStores = ["青葉台駅前院", "溝の口本院", "エステ青葉台店", "鍼灸町田店"];
  for (let i = 0; i < staffStores.length; i++) {
    await prisma.user.create({
      data: {
        email: `staff${i + 1}@example.com`,
        passwordHash: hash("password"),
        name: `${staffStores[i]} スタッフ`,
        role: "STORE_STAFF",
        storeId: stores[staffStores[i]],
      },
    });
  }

  // ===== ダミー取引 =====
  // 重要: 在庫は履歴の積み上げ＋棚卸ベースラインで算出される。
  // computeStock は「最新棚卸の confirmedAt より後(createdAt)の取引」のみを基準に足す。
  // そのため、シードでも createdAt を論理日付(date)に合わせ、棚卸より前の取引が
  // ベースラインに二重計上されないようにする。
  const tx = (data: Parameters<typeof prisma.transaction.create>[0]["data"], d: Date) =>
    prisma.transaction.create({ data: { ...data, date: d, createdAt: d } });

  // 全店に各商品を発注して初期在庫を作る（30日前）
  const orderDay = daysAgo(30);
  for (const name of Object.keys(stores)) {
    const sid = stores[name];
    for (const p of products) {
      await tx(
        { storeId: sid, productId: p.id, type: "ORDER", quantity: 12, unitPriceIncl: p.wholesaleIncl, supplier: "メーカー直送", assignee: "発注担当" },
        orderDay
      );
    }
  }

  // 消耗（販売）— 一部店舗・一部商品
  for (const name of ["青葉台駅前院", "溝の口本院", "エステ青葉台店", "鍼灸町田店"]) {
    const sid = stores[name];
    for (let i = 0; i < 4; i++) {
      const p = products[i];
      await tx({ storeId: sid, productId: p.id, type: "CONSUME", quantity: 3, unitPriceIncl: p.normalIncl, assignee: "販売担当" }, daysAgo(18));
    }
  }

  // 在庫不足アラート確認用: 青葉台で特定商品を多めに消耗して最小在庫を割らせる
  await tx({ storeId: stores["青葉台駅前院"], productId: products[10].id, type: "CONSUME", quantity: 12, unitPriceIncl: products[10].normalIncl, assignee: "販売担当", memo: "セール大量販売" }, daysAgo(12));

  // 社販・プレゼント
  await tx({ storeId: stores["青葉台駅前院"], productId: products[1].id, type: "EMPLOYEE_SALE", quantity: 1, unitPriceIncl: products[1].wholesaleIncl, counterpart: "スタッフA", assignee: "店長" }, daysAgo(10));
  await tx({ storeId: stores["溝の口本院"], productId: products[2].id, type: "GIFT", quantity: 1, counterpart: "常連顧客", reason: "キャンペーン特典", assignee: "店長" }, daysAgo(8));

  // 店舗間移動（青葉台駅前院 → エステ青葉台店）OUT/IN ペア
  const groupId = "seed-transfer-1";
  const moveDay = daysAgo(6);
  await tx({ storeId: stores["青葉台駅前院"], productId: products[5].id, type: "TRANSFER_OUT", quantity: 3, toStoreId: stores["エステ青葉台店"], transferGroupId: groupId, assignee: "店長", memo: "在庫融通" }, moveDay);
  await tx({ storeId: stores["エステ青葉台店"], productId: products[5].id, type: "TRANSFER_IN", quantity: 3, toStoreId: stores["エステ青葉台店"], transferGroupId: groupId, assignee: "店長", memo: "在庫融通" }, moveDay);

  // ===== 棚卸（青葉台駅前院・溝の口本院は実施。ズレを意図的に作る） =====
  // 棚卸確定はすべての取引より後(2日前)。確定後の理論在庫を実数として確定し、
  // 一部商品で実数をずらして在庫ズレを再現する。
  const month = thisMonth();
  const confirmDay = daysAgo(2);
  for (const name of ["青葉台駅前院", "溝の口本院"]) {
    const sid = stores[name];
    const inv = await getStoreInventory(sid); // この時点＝棚卸前の理論在庫
    const invMap = new Map(inv.map((r) => [r.productId, r]));

    let diffCount = 0;
    let diffAmount = 0;
    const items: { productId: string; theoreticalQty: number; actualQty: number; diff: number; diffAmount: number }[] = [];
    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      const row = invMap.get(p.id);
      if (!row) continue;
      const theoretical = row.stock;
      // 商品0,2 は棚卸でマイナスのズレ（紛失）を再現、他は一致
      const actual = i === 0 ? theoretical - 2 : i === 2 ? theoretical - 1 : theoretical;
      const diff = actual - theoretical;
      const amount = diff * row.wholesaleIncl;
      if (diff !== 0) {
        diffCount++;
        diffAmount += amount;
      }
      items.push({ productId: p.id, theoreticalQty: theoretical, actualQty: actual, diff, diffAmount: amount });
    }
    await prisma.stocktake.create({
      data: {
        storeId: sid,
        targetMonth: month,
        assigneeName: `${name} 棚卸担当`,
        confirmedAt: confirmDay,
        createdAt: confirmDay,
        diffCount,
        diffAmount,
        items: { create: items },
      },
    });
  }

  console.log(`✅ 完了: 店舗${SEED_STORES.length + 1} / ブランド${SEED_BRANDS.length} / 商品${SEED_PRODUCTS.length}`);
  console.log("   本部ログイン: hq@example.com / password");
  console.log("   店舗ログイン: staff1@example.com / password（青葉台駅前院）");
  console.log("   店舗PIN例: 青葉台駅前院 = 1001");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
