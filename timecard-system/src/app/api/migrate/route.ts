import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { migrateFromRender } from "@/lib/migrate-from-render";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 旧システム（Render）からのデータ移行をブラウザから実行する。
 * 事前に Vercel の環境変数 OLD_DATABASE_URL（Render の External Database URL）を設定しておく。
 * 使い方: /api/migrate?key=<AUTH_SECRET>
 * 何度実行しても安全（既存データは更新、無いものは追加。削除はしない）。
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = (url.searchParams.get("key") || "").replace(/ /g, "+").trim();
  const expected = (process.env.AUTH_SECRET || "").trim().replace(/^['"`]+/, "").replace(/['"`]+$/, "");
  if (!expected) return NextResponse.json({ ok: false, error: "AUTH_SECRET が未設定です。" }, { status: 500 });
  if (key !== expected) return NextResponse.json({ ok: false, error: "認証エラー: ?key= に AUTH_SECRET を指定してください。" }, { status: 401 });

  const oldUrl = (process.env.OLD_DATABASE_URL || "").trim().replace(/^['"`]+/, "").replace(/['"`]+$/, "");
  if (!oldUrl) {
    return NextResponse.json({ ok: false, error: "環境変数 OLD_DATABASE_URL（Render の External Database URL）を設定してから再度開いてください。" }, { status: 400 });
  }

  const steps: string[] = [];
  try {
    const result = await migrateFromRender(prisma, oldUrl, (m) => steps.push(m));
    return NextResponse.json({
      ok: true,
      message: `移行完了。店舗 ${result.stores} 件 / スタッフ ${result.users} 名 / 担当店舗 ${result.permissions} 件 / 打刻 ${result.attendance} 件を取り込みました。スタッフは今までと同じ ID・パスワードでログインできます。`,
      steps,
      result,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message, steps }, { status: 500 });
  }
}
