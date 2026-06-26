import { prisma } from "./prisma";
import { KPI_PRESETS } from "./kpi-presets";

/**
 * アプリ起動時（最初のDBアクセス時）に一度だけ実行される非破壊マイグレーション。
 * 重要: データは絶対に消さない。列の追加と、既存KPIのカテゴリ補完のみ。
 * これにより /api/setup を手動で叩かなくても新機能が有効になる。
 */

let ran: Promise<void> | null = null;

// 追加カラム（既に存在すれば何もしない）
const COLUMN_MIGRATIONS = [
  `ALTER TABLE "ReportAction" ADD COLUMN IF NOT EXISTS "baseValue" DOUBLE PRECISION`,
  `ALTER TABLE "ReportAction" ADD COLUMN IF NOT EXISTS "targetValue" DOUBLE PRECISION`,
  `ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "originalText" TEXT`,
  `ALTER TABLE "KpiItem" ADD COLUMN IF NOT EXISTS "category" TEXT`,
  `ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "hiddenKpis" TEXT`,
  `ALTER TABLE "Department" ADD COLUMN IF NOT EXISTS "hiddenKpis" TEXT`,
];

// カテゴリ補完を二度実行しないためのフラグ（Settingテーブル）
const CATEGORIZE_FLAG = "schema_auto_categorized_v1";

async function autoCategorize() {
  const flag = await prisma.setting.findUnique({ where: { key: CATEGORIZE_FLAG } }).catch(() => null);
  if (flag) return; // 既に実施済み

  // 業態テンプレートのKPI: 業態 × 名前 でカテゴリを補完（カテゴリ未設定のものだけ）
  for (const preset of KPI_PRESETS) {
    const byCat = new Map<string, string[]>();
    for (const g of preset.groups) {
      for (const n of g.names) {
        if (!byCat.has(g.category)) byCat.set(g.category, []);
        byCat.get(g.category)!.push(n);
      }
    }
    for (const [cat, names] of byCat) {
      await prisma.kpiItem
        .updateMany({ where: { businessType: preset.businessType, category: null, name: { in: names } }, data: { category: cat } })
        .catch(() => {});
    }
  }

  // 店舗/部門の上書きKPI（businessType=null）も名前で best-effort 補完
  const globalMap = new Map<string, string>();
  for (const preset of KPI_PRESETS) {
    for (const g of preset.groups) {
      for (const n of g.names) if (!globalMap.has(n)) globalMap.set(n, g.category);
    }
  }
  const globalByCat = new Map<string, string[]>();
  for (const [name, cat] of globalMap) {
    if (!globalByCat.has(cat)) globalByCat.set(cat, []);
    globalByCat.get(cat)!.push(name);
  }
  for (const [cat, names] of globalByCat) {
    await prisma.kpiItem
      .updateMany({ where: { businessType: null, category: null, name: { in: names } }, data: { category: cat } })
      .catch(() => {});
  }

  await prisma.setting.create({ data: { key: CATEGORIZE_FLAG, value: new Date().toISOString() } }).catch(() => {});
}

async function run() {
  for (const sql of COLUMN_MIGRATIONS) {
    try {
      await prisma.$executeRawUnsafe(sql);
    } catch {
      // 既に適用済みなどは無視
    }
  }
  try {
    await autoCategorize();
  } catch {
    // カテゴリ補完は致命的ではないので失敗しても続行
  }
}

export function ensureMigrations(): Promise<void> {
  if (!ran) ran = run().catch(() => {});
  return ran;
}
