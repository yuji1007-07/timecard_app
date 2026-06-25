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
  const key = url.searchParams.get("key");
  const expected = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;

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
    // 1) スキーマ作成（テーブルが無ければ作成。既存ならスキップ）
    const cleaned = SCHEMA_SQL.replace(/^\s*--.*$/gm, ""); // コメント行を除去
    const statements = cleaned
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    let created = 0;
    let skipped = 0;
    for (const stmt of statements) {
      try {
        await prisma.$executeRawUnsafe(stmt);
        created++;
      } catch (e) {
        const msg = (e as Error).message || "";
        if (/already exists|duplicate/i.test(msg)) skipped++;
        else throw e;
      }
    }
    steps.push(`schema: ${created}件作成 / ${skipped}件は既存のためスキップ`);

    // 2) 初期データ投入
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
