// ============================================================
// pdfPreview.js … PDFプレビュー / 印刷画面
// 申込書をA4縦の紙の見た目で表示します。
// 「印刷」ボタンでブラウザの印刷（iPadならAirPrint・PDF保存）を呼びます。
//
// この画面は2通りで使われます:
//  ・#/preview        … 作成直後（下書きデータを表示）
//  ・#/print/:appId   … 履歴から開いた時（保存済みデータを表示）
// ============================================================

import { getDraft, getApplication, clearDraft } from "../storage.js";
import { go, showLoading, showError } from "../util.js";
import { paperHtml } from "../paper.js";

export async function render(container, params) {
  // 表示するデータを決める（履歴から or 作成直後）
  const fromHistory = !!params.appId;
  let data;
  if (fromHistory) {
    showLoading(container);
    try {
      data = await getApplication(params.appId);
    } catch (e) {
      showError(container, e);
      return;
    }
  } else {
    data = getDraft();
  }

  if (!data) {
    container.innerHTML = `<div class="empty-box"><p>申込書データが見つかりません。</p><a href="#/" class="btn">ホームへ</a></div>`;
    return;
  }

  container.innerHTML = `
    <div class="preview-toolbar no-print">
      <div class="preview-toolbar__left">
        <h1 class="preview-toolbar__title">PDFプレビュー</h1>
        <span class="preview-toolbar__hint">印刷ボタン → 「PDFとして保存」も選べます（AirPrint対応）</span>
      </div>
      <div class="preview-toolbar__right">
        ${fromHistory
          ? `<a href="#/history" class="btn btn--ghost">← 履歴へ</a>`
          : `<a href="#/" class="btn btn--ghost">完了してホームへ</a>`}
        <button id="printBtn" class="btn btn--primary btn--lg">🖨 印刷する</button>
      </div>
    </div>

    <!-- ここがA4の紙にあたる部分。印刷時はこの中身だけが出ます -->
    <div class="paper-scroll">
      ${paperHtml(data)}
    </div>
  `;

  // 印刷ボタン
  container.querySelector("#printBtn").addEventListener("click", () => {
    window.print();
  });

  // 作成直後にプレビューを開いた場合、下書きはもう保存済みなので消しておく
  if (!fromHistory) {
    clearDraft();
  }
}

