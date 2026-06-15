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
import { esc, nl2br, formatDateJa, go, showLoading, showError } from "../util.js";

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

// --- A4の申込書HTMLを組み立てる ---
function paperHtml(d) {
  // 患者情報の行（値が入っているものだけ）
  const infoRows = (d.fields || [])
    .filter((f) => (d.fieldValues[f.id] || "").trim() !== "")
    .map(
      (f) => `
      <tr>
        <th class="paper-th">${esc(f.label)}</th>
        <td class="paper-td">${esc(d.fieldValues[f.id])}</td>
      </tr>`
    )
    .join("");

  // プラン・料金の表（あれば）
  const planTable =
    d.planName || d.monthlyFee || d.initialFee
      ? `
      <h2 class="paper-h2">お申し込みプラン・料金</h2>
      <table class="paper-table">
        ${d.planName ? `<tr><th class="paper-th">プラン名</th><td class="paper-td">${esc(d.planName)}</td></tr>` : ""}
        ${d.monthlyFee ? `<tr><th class="paper-th">月額料金</th><td class="paper-td">${esc(d.monthlyFee)} 円（税込）</td></tr>` : ""}
        ${d.initialFee ? `<tr><th class="paper-th">初回費用</th><td class="paper-td">${esc(d.initialFee)} 円（税込）</td></tr>` : ""}
      </table>`
      : "";

  // 確認チェック（チェック済みのものに✓）
  const checkList = (d.checks || [])
    .map((c) => {
      const checked = (d.checkedItems || []).includes(c.id);
      return `<div class="paper-check">${checked ? "☑" : "☐"} ${esc(c.label)}</div>`;
    })
    .join("");

  // サイン画像
  const signature = d.signatureDataUrl
    ? `<img src="${d.signatureDataUrl}" class="paper-sign-img" alt="署名" />`
    : `<span class="paper-sign-empty">（未署名）</span>`;

  return `
  <div class="paper">
    <div class="paper-header">
      <h1 class="paper-title">${esc(d.templateName)}</h1>
      <div class="paper-date">申込日：${esc(formatDateJa(d.applyDate))}</div>
    </div>

    ${d.bodySnapshot ? `<p class="paper-body">${nl2br(d.bodySnapshot)}</p>` : ""}

    <table class="paper-table">
      <tr><th class="paper-th">店舗名</th><td class="paper-td">${esc(d.storeName || "")}</td></tr>
      ${infoRows}
    </table>

    ${planTable}

    ${d.termsSnapshot ? `
    <h2 class="paper-h2">規約・注意事項</h2>
    <div class="paper-terms">${nl2br(d.termsSnapshot)}</div>` : ""}

    <h2 class="paper-h2">ご確認事項</h2>
    <div class="paper-checks">${checkList}</div>

    <div class="paper-sign-area">
      <div class="paper-sign-block">
        <div class="paper-sign-label">ご署名</div>
        <div class="paper-sign-line">${signature}</div>
      </div>
      <div class="paper-staff">
        <div>店舗：${esc(d.storeName || "")}</div>
        <div>担当者：${esc(d.staffName || "")}</div>
      </div>
    </div>
  </div>`;
}
