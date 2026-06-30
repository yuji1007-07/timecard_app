import { prisma } from "./prisma";
import { KPI_PRESETS } from "./kpi-presets";

/**
 * アプリ起動時（最初のDBアクセス時）に一度だけ実行される非破壊マイグレーション。
 * 重要: データは絶対に消さない。列の追加と、既存KPIのカテゴリ補完のみ。
 * これにより /api/setup を手動で叩かなくても新機能が有効になる。
 *
 * 速度対策: 完了フラグ(Setting)を立て、移行済みのDBではチェック1回(SELECT)で即終了する。
 * さらにプロセス内ではメモ化し、ウォームな関数では一切DBに触れない。
 */

let ran: Promise<void> | null = null;

// マイグレーションのバージョン。新しい列やテーブルを足したらここを上げる。
const DONE_FLAG = "schema_migration_v3";

// 追加カラム・テーブル（既に存在すれば何もしない。各文はtry/catchで実行）
const COLUMN_MIGRATIONS = [
  `ALTER TABLE "ReportAction" ADD COLUMN IF NOT EXISTS "baseValue" DOUBLE PRECISION`,
  `ALTER TABLE "ReportAction" ADD COLUMN IF NOT EXISTS "targetValue" DOUBLE PRECISION`,
  `ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "originalText" TEXT`,
  `ALTER TABLE "KpiItem" ADD COLUMN IF NOT EXISTS "category" TEXT`,
  `ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "hiddenKpis" TEXT`,
  `ALTER TABLE "Department" ADD COLUMN IF NOT EXISTS "hiddenKpis" TEXT`,
  // 月次の3ヶ月予測テーブル
  `CREATE TABLE IF NOT EXISTS "ReportProjection" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "kpiName" TEXT NOT NULL,
    "targetMonth" TEXT NOT NULL,
    "budget" DOUBLE PRECISION,
    "forecast" DOUBLE PRECISION,
    CONSTRAINT "ReportProjection_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "ReportProjection_reportId_idx" ON "ReportProjection"("reportId")`,
  `ALTER TABLE "ReportProjection" ADD CONSTRAINT "ReportProjection_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
];

async function autoCategorize() {
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
}

async function run() {
  // 既に移行済みなら SELECT 1回で即終了（ページ表示を遅くしない）
  const done = await prisma.setting.findUnique({ where: { key: DONE_FLAG } }).catch(() => null);
  if (done) return;

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
  await prisma.setting.create({ data: { key: DONE_FLAG, value: new Date().toISOString() } }).catch(() => {});
}

export function ensureMigrations(): Promise<void> {
  if (!ran) ran = run().catch(() => {});
  return ran;
}
