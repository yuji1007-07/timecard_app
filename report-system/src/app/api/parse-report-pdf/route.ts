import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { parsePdfTable } from "@/lib/pdf-table";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// スプレッドシートを印刷したPDFをアップロードすると、表を解析して
// { columns: 列情報, rows: 行（項目名＋列ごとの数値） } を返す。
// フォーム側で「どの列を実績/予測として取り込むか」を選んで反映する。
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "ログインが必要です。" }, { status: 401 });
  }

  let file: File | null = null;
  try {
    const fd = await req.formData();
    const f = fd.get("file");
    if (f instanceof File) file = f;
  } catch {
    // fallthrough
  }
  if (!file) {
    return NextResponse.json({ ok: false, error: "PDFファイルを指定してください。" }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ ok: false, error: "ファイルが大きすぎます（10MBまで）。" }, { status: 400 });
  }

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const table = await parsePdfTable(buf);
    if (table.rows.length === 0) {
      return NextResponse.json(
        { ok: false, error: "表を読み取れませんでした。画像（スキャン）PDFの場合は、スプレッドシートから直接PDF出力したものをお使いください。" },
        { status: 422 }
      );
    }
    return NextResponse.json({ ok: true, ...table });
  } catch (e) {
    console.error("parse-report-pdf failed:", e);
    return NextResponse.json({ ok: false, error: "PDFの解析に失敗しました。" }, { status: 500 });
  }
}
