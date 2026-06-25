import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { seedDatabase } from "@/lib/seed-data";
import { SCHEMA_SQL } from "@/lib/schema-sql";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 初期セットアップ用エンドポイント。
 * アプリ自身が接続しているDB（=本番のDATABASE_URL）に対して、
 * テーブル作成 + 初期データ投入を行う。接続文字列の取り違えに関係なく確実にセットアップできる。
 *
 * 使い方: /api/setup?key=<AUTH_SECRET>
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  // URLのクエリでは '+' が空白に変換されるため元に戻す。前後の引用符・空白も吸収。
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
      const cleaned = SCHEMA_SQL.replace(/^\s*--.*$/gm, ""); // コメント行を除去
      const statements = cleaned
        .split(";")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      for (const stmt of statements) {
        await prisma.$executeRawUnsafe(stmt);
      }
      steps.push(`schema: ${statements.length}件作成`);
    }

    // 2) 既存データを一括クリア（部分実行・再実行の残骸も確実に消す）
    try {
      await prisma.$executeRawUnsafe(
        `TRUNCATE TABLE "User","Store","Department","KpiItem","KdiItem","Report","ReportKpiValue","ReportInflow","ReportKdi","ReportAction","ActionProgress","AlertCondition","Feedback","SuccessAction","Setting" RESTART IDENTITY CASCADE`
      );
      steps.push("既存データをクリア");
    } catch {
      // テーブル未作成などは無視
    }

    // 3) 初期データ投入
    const counts = await seedDatabase(prisma);
    steps.push("seed: 完了");

    return NextResponse.json({
      ok: true,
      message: "セットアップ完了。admin@example.com / password123 でログインできます。",
      steps,
      counts,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message, steps },
      { status: 500 }
    );
  }
}
