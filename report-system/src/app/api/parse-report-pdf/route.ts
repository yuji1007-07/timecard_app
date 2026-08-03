import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { parsePdfTable } from "@/lib/pdf-table";
import { parseImageTable } from "@/lib/image-table";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_SIZE = 10 * 1024 * 1024;
const MAX_IMAGES = 4;
const isImage = (f: File) => f.type.startsWith("image/") || /\.(png|jpe?g|webp|heic|heif)$/i.test(f.name);

// スプレッドシートを印刷したPDF、またはシートのスクリーンショット／写真をアップロードすると、
// 表を解析して { columns: 列情報, rows: 行（項目名＋列ごとの数値） } を返す。
// フォーム側で「どの列を実績/予測として取り込むか」を選んで反映する。
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "ログインが必要です。" }, { status: 401 });
  }

  const files: File[] = [];
  try {
    const fd = await req.formData();
    for (const f of fd.getAll("file")) {
      if (f instanceof File && f.size > 0) files.push(f);
    }
  } catch {
    // fallthrough
  }
  if (files.length === 0) {
    return NextResponse.json({ ok: false, error: "PDFまたは画像ファイルを指定してください。" }, { status: 400 });
  }
  if (files.some((f) => f.size > MAX_SIZE)) {
    return NextResponse.json({ ok: false, error: "ファイルが大きすぎます（1件10MBまで）。" }, { status: 400 });
  }

  try {
    // 画像だけが渡された場合は視覚モデルで読み取る。PDFが含まれる場合は先頭のPDFを解析する。
    const pdf = files.find((f) => !isImage(f));
    if (!pdf) {
      const images = await Promise.all(
        files.slice(0, MAX_IMAGES).map(async (f) => ({
          buffer: Buffer.from(await f.arrayBuffer()),
          mime: f.type && f.type.startsWith("image/") ? f.type : "image/png",
        }))
      );
      const result = await parseImageTable(images);
      if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 422 });
      return NextResponse.json({ ok: true, source: "image", ...result.table });
    }

    const buf = Buffer.from(await pdf.arrayBuffer());
    const table = await parsePdfTable(buf);
    if (table.rows.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "表を読み取れませんでした。スキャン画像のPDFの場合は、シートのスクリーンショット（画像）を選ぶと読み取れることがあります。",
        },
        { status: 422 }
      );
    }
    return NextResponse.json({ ok: true, source: "pdf", ...table });
  } catch (e) {
    console.error("parse-report-pdf failed:", e);
    return NextResponse.json({ ok: false, error: "ファイルの解析に失敗しました。" }, { status: 500 });
  }
}
