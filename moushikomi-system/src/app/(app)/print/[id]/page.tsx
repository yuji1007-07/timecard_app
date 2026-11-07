import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getApplicationFor } from "@/lib/data";
import { paperHtml } from "@/lib/paper";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";

/**
 * PDFプレビュー / 印刷画面（旧アプリ pdfPreview.js の移植）
 * 申込書をA4縦の紙の見た目で表示します。「印刷」ボタンでブラウザの印刷（iPadならAirPrint・PDF保存）を呼びます。
 *  - /print/:id?done=1 … 作成直後（「完了してホームへ」を表示）
 *  - /print/:id        … 履歴から開いた時
 */
export default async function PrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ done?: string }>;
}) {
  const { id } = await params;
  const { done } = await searchParams;
  const user = await requireUser();
  const data = await getApplicationFor(user, decodeURIComponent(id));

  if (!data) {
    return (
      <div className="empty-box">
        <p>申込書データが見つかりません。</p>
        <Link href="/home" className="btn">
          ホームへ
        </Link>
      </div>
    );
  }

  const fromHistory = done !== "1";

  return (
    <div>
      <div className="preview-toolbar no-print">
        <div className="preview-toolbar__left">
          <h1 className="preview-toolbar__title">PDFプレビュー</h1>
          <span className="preview-toolbar__hint">印刷ボタン → 「PDFとして保存」も選べます（AirPrint対応）</span>
        </div>
        <div className="preview-toolbar__right">
          {fromHistory ? (
            <Link href="/history" className="btn btn--ghost">
              ← 履歴へ
            </Link>
          ) : (
            <Link href="/home" className="btn btn--ghost">
              完了してホームへ
            </Link>
          )}
          <PrintButton />
        </div>
      </div>

      {/* ここがA4の紙にあたる部分。印刷時はこの中身だけが出ます（paperHtml 内は esc 済み） */}
      <div className="paper-scroll" dangerouslySetInnerHTML={{ __html: paperHtml(data) }} />
    </div>
  );
}
