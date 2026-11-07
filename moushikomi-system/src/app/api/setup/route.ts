import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { seedDatabase } from "@/lib/seed-data";
import { DEFAULT_ADMIN_LOGIN_ID, DEFAULT_ADMIN_PASSWORD } from "@/lib/constants";
import { SCHEMA_SQL } from "@/lib/schema-sql";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 初期セットアップ用エンドポイント（勤怠管理システムと同じ方式）。
 * 重要: データは絶対に消さない。
 *  - テーブルが無ければ作成
 *  - 店舗マスタ・店舗アカウント・本部アカウント・初期テンプレートが無ければ投入（既にあればそのまま）
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
      await prisma.$queryRawUnsafe('SELECT 1 FROM "moushikomi"."User" LIMIT 1');
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
    steps.push(
      `seed: 店舗 ${counts.stores} 件追加、店舗アカウント ${counts.storeUsers} 件追加、テンプレート ${counts.templates} 件追加${counts.admin ? "、本部アカウント作成" : ""}`
    );

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
