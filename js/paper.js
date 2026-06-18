// ============================================================
// paper.js … A4の申込書HTMLを組み立てる共通部品
// PDFプレビュー画面と、バックアップ(ZIP保存)の両方で使います。
// ============================================================

import { esc, nl2br, formatDateJa } from "./util.js";

// 申込データ d から「紙の申込書」HTMLを作って返す
export function paperHtml(d) {
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

  // 確認チェック（チェック済みのものに☑）
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
