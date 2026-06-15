// ============================================================
// patientConfirm.js … 患者様確認画面
// 患者様にiPadを見せる画面です。文字大きめ・余白広めで見やすく。
// 内容を確認 → チェック → サイン画面へ進みます。
// ============================================================

import { getDraft, setDraft } from "../storage.js";
import { esc, nl2br, formatDateJa, go } from "../util.js";

export function render(container) {
  const draft = getDraft();
  if (!draft) {
    container.innerHTML = `<div class="empty-box"><p>入力データがありません。</p><a href="#/select" class="btn">最初から</a></div>`;
    return;
  }

  // 患者情報を「項目名: 値」の行で表示
  const infoRows = draft.fields
    .filter((f) => (draft.fieldValues[f.id] || "").trim() !== "")
    .map(
      (f) => `
      <div class="confirm-row">
        <div class="confirm-row__label">${esc(f.label)}</div>
        <div class="confirm-row__value">${esc(draft.fieldValues[f.id])}</div>
      </div>`
    )
    .join("");

  // プラン・料金（あれば表示）
  const planRows =
    draft.planName || draft.monthlyFee || draft.initialFee
      ? `
      <div class="confirm-block">
        <h3 class="confirm-block__title">プラン・料金</h3>
        ${draft.planName ? rowHtml("プラン", draft.planName) : ""}
        ${draft.monthlyFee ? rowHtml("月額料金", draft.monthlyFee + " 円") : ""}
        ${draft.initialFee ? rowHtml("初回費用", draft.initialFee + " 円") : ""}
      </div>`
      : "";

  // 確認チェック項目
  const checkboxes = (draft.checks || [])
    .map(
      (c) => `
      <label class="confirm-check">
        <input type="checkbox" class="confirm-check__box" data-check="${esc(c.id)}"
          ${(draft.checkedItems || []).includes(c.id) ? "checked" : ""} />
        <span class="confirm-check__text">${esc(c.label)}</span>
      </label>`
    )
    .join("");

  container.innerHTML = `
    <div class="confirm-paper">
      <div class="confirm-paper__header">
        <h1 class="confirm-paper__title">${esc(draft.templateName)}</h1>
        <div class="confirm-paper__date">申込日：${esc(formatDateJa(draft.applyDate))}</div>
      </div>

      ${draft.bodySnapshot ? `<p class="confirm-body">${nl2br(draft.bodySnapshot)}</p>` : ""}

      <div class="confirm-block">
        <h3 class="confirm-block__title">お申し込み内容</h3>
        ${rowHtml("店舗", draft.storeName)}
        ${draft.staffName ? rowHtml("担当者", draft.staffName) : ""}
        ${infoRows}
      </div>

      ${planRows}

      ${draft.termsSnapshot ? `
      <div class="confirm-block confirm-terms">
        <h3 class="confirm-block__title">規約・注意事項</h3>
        <div class="confirm-terms__text">${nl2br(draft.termsSnapshot)}</div>
      </div>` : ""}

      <div class="confirm-checks">
        ${checkboxes}
      </div>
    </div>

    <div class="confirm-actions no-print">
      <a href="#/form/${encodeURIComponent(draft.templateId)}" class="btn btn--ghost">← 入力に戻る</a>
      <button id="toSign" class="btn btn--primary btn--lg">サイン欄へ進む →</button>
    </div>
    <p id="confirmError" class="form-error"></p>
  `;

  // チェック状態を下書きに反映（戻っても消えないように）
  container.querySelectorAll(".confirm-check__box").forEach((box) => {
    box.addEventListener("change", () => {
      const checked = Array.from(container.querySelectorAll(".confirm-check__box"))
        .filter((b) => b.checked)
        .map((b) => b.dataset.check);
      draft.checkedItems = checked;
      setDraft(draft);
    });
  });

  // サイン画面へ進む（全チェック必須）
  container.querySelector("#toSign").addEventListener("click", () => {
    const boxes = Array.from(container.querySelectorAll(".confirm-check__box"));
    const allChecked = boxes.every((b) => b.checked);
    if (!allChecked) {
      container.querySelector("#confirmError").textContent =
        "すべての確認項目にチェックしてください。";
      return;
    }
    go("/sign");
  });
}

// 「ラベル：値」1行ぶんのHTMLを作る小さな関数
function rowHtml(label, value) {
  return `
    <div class="confirm-row">
      <div class="confirm-row__label">${esc(label)}</div>
      <div class="confirm-row__value">${esc(value)}</div>
    </div>`;
}
