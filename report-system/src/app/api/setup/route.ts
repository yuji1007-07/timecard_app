import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { seedDatabase } from "@/lib/seed-data";
import { SCHEMA_SQL } from "@/lib/schema-sql";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 初期セットアップ / 安全マイグレーション用エンドポイント。
 * 重要: データは絶対に消さない。
 *  - テーブルが無ければ作成
 *  - 追加カラムを非破壊で適用（ADD COLUMN IF NOT EXISTS）
 *  - データが空のときだけ初期データを投入。既にデータがあれば一切変更しない。
 *
 * 使い方: /api/setup?key=<AUTH_SECRET>
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = (url.searchParams.get("key") || "").replace(/ /g, "+").trim();
  const expected = (process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "")
    .trim()
    .replace(/^['"`]+/, "")
    .replace(/['"`]+$/, "");

  if (!expected) {
    return NextResponse.json({ ok: false, error: "AUTH_SECRET が未設定です。" }, { status: 500 });
  }
  if (key !== expected) {
    return NextResponse.json(
      { ok: false, error: "認証エラー: ?key= に AUTH_SECRET を指定してください。" },
      { status: 401 }
    );
  }

  const steps: string[] = [];
  try {
    // 1) テーブルが無ければスキーマ作成（既存ならスキップ）
    let tablesExist = false;
    try {
      await prisma.$queryRawUnsafe('SELECT 1 FROM "User" LIMIT 1');
      tablesExist = true;
    } catch {
      tablesExist = false;
    }

    if (tablesExist) {
      steps.push("schema: 既存のためスキップ");
    } else {
      const cleaned = SCHEMA_SQL.replace(/^\s*--.*$/gm, "");
      const statements = cleaned
        .split(";")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      for (const stmt of statements) {
        await prisma.$executeRawUnsafe(stmt);
      }
      steps.push(`schema: ${statements.length}件作成`);
    }

    // 2) 追加カラムのマイグレーション（既存DBにも非破壊で適用。データは消えない）
    const migrations = [
      `ALTER TABLE "ReportAction" ADD COLUMN IF NOT EXISTS "baseValue" DOUBLE PRECISION`,
      `ALTER TABLE "ReportAction" ADD COLUMN IF NOT EXISTS "targetValue" DOUBLE PRECISION`,
      `ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "originalText" TEXT`,
      `ALTER TABLE "KpiItem" ADD COLUMN IF NOT EXISTS "category" TEXT`,
      `ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "hiddenKpis" TEXT`,
      `ALTER TABLE "Department" ADD COLUMN IF NOT EXISTS "hiddenKpis" TEXT`,
    ];
    for (const m of migrations) {
      try {
        await prisma.$executeRawUnsafe(m);
      } catch {
        // 既に適用済みなどは無視
      }
    }
    steps.push("migrations: 適用");

    // 3) データが空のときだけ初期データを投入（既存データは絶対に消さない）
    const userCount = await prisma.user.count().catch(() => 0);
    if (userCount > 0) {
      return NextResponse.json({
        ok: true,
        message: "アップデートを適用しました（既存データはそのまま保持されています）。",
        steps,
        note: "このエンドポイントはデータを消しません。初期データ投入はDBが空のときのみ行います。",
        userCount,
      });
    }

    const counts = await seedDatabase(prisma, { withSampleReports: false });
    steps.push("seed: 初期データ投入（空DBのため）");

    return NextResponse.json({
      ok: true,
      message: "初期セットアップ完了。admin@example.com / password123 でログインできます。",
      steps,
      counts,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message, steps }, { status: 500 });
  }
}
