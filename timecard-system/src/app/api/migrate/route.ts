import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchFromOldApp, fetchFromOldDatabase, importOldData } from "@/lib/migrate-from-render";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 旧システム（Render）からのデータ移行をブラウザから実行する。
 * 取り込み元は次のどちらか（Vercel の環境変数で指定）:
 *  A. OLD_APP_URL + OLD_ADMIN_ID + OLD_ADMIN_PASSWORD … 旧アプリの /api/export-all から取得（おすすめ・DBに直接繋がない）
 *  B. OLD_DATABASE_URL … 旧DBへ直接接続
 * 使い方: /api/migrate?key=<AUTH_SECRET>
 * 何度実行しても安全（既存データは更新、無いものは追加。削除はしない）。
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = (url.searchParams.get("key") || "").replace(/ /g, "+").trim();
  const expected = (process.env.AUTH_SECRET || "").trim().replace(/^['"`]+/, "").replace(/['"`]+$/, "");
  if (!expected) return NextResponse.json({ ok: false, error: "AUTH_SECRET が未設定です。" }, { status: 500 });
  if (key !== expected) return NextResponse.json({ ok: false, error: "認証エラー: ?key= に AUTH_SECRET を指定してください。" }, { status: 401 });

  const clean = (v: string | undefined) => (v || "").trim().replace(/^['"`]+/, "").replace(/['"`]+$/, "");
  const oldAppUrl = clean(process.env.OLD_APP_URL);
  const oldAdminId = clean(process.env.OLD_ADMIN_ID);
  const oldAdminPassword = clean(process.env.OLD_ADMIN_PASSWORD);
  const oldDbUrl = clean(process.env.OLD_DATABASE_URL);

  const steps: string[] = [];
  try {
    let data;
    if (oldAppUrl && oldAdminId && oldAdminPassword) {
      data = await fetchFromOldApp(oldAppUrl, oldAdminId, oldAdminPassword);
      steps.push(`旧アプリ(${oldAppUrl})からデータを取得しました。`);
    } else if (oldDbUrl) {
      data = await fetchFromOldDatabase(oldDbUrl);
      steps.push("旧DBに接続しました。");
    } else {
      return NextResponse.json(
        { ok: false, error: "環境変数 OLD_APP_URL / OLD_ADMIN_ID / OLD_ADMIN_PASSWORD（または OLD_DATABASE_URL）を設定してから再度開いてください。" },
        { status: 400 }
      );
    }
    const result = await importOldData(prisma, data, (m) => steps.push(m));
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
