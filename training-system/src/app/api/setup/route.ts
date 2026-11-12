import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEFAULT_ADMIN_LOGIN_ID, DEFAULT_ADMIN_PASSWORD, seedDatabase } from "@/lib/seed-data";
import { SCHEMA_SQL } from "@/lib/schema-sql";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 初期セットアップ用エンドポイント（他の業務アプリと同じ方式）。
 * 重要: データは絶対に消さない。
 *  - テーブルが無ければ作成
 *  - 店舗マスタ・admin・初期動画が無ければ投入（既にあればそのまま）
 *
 * 使い方: /api/setup?key=<AUTH_SECRET>
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = (url.searchParams.get("key") || "").replace(/ /g, "+").trim();
  const expected = (process.env.AUTH_SECRET || "").trim().replace(/^['"`]+/, "").replace(/['"`]+$/, "");

  if (!expected) return NextResponse.json({ ok: false, error: "AUTH_SECRET が未設定です。" }, { status: 500 });
  if (key !== expected) {
    return NextResponse.json({ ok: false, error: "認証エラー: ?key= に AUTH_SECRET を指定してください。" }, { status: 401 });
  }

  const steps: string[] = [];
  try {
    let tablesExist = false;
    try {
      await prisma.$queryRawUnsafe('SELECT 1 FROM "training"."User" LIMIT 1');
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

    const counts = await seedDatabase(prisma);
    steps.push(`seed: 店舗 ${counts.stores} 件追加、動画 ${counts.videos} 本追加${counts.admin ? "、admin 作成" : ""}`);

    return NextResponse.json({
      ok: true,
      message: counts.admin
        ? `初期セットアップ完了。${DEFAULT_ADMIN_LOGIN_ID} / ${DEFAULT_ADMIN_PASSWORD} でログインできます。`
        : "セットアップ確認完了（既存データはそのまま保持されています）。",
      steps,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message, steps }, { status: 500 });
  }
}
