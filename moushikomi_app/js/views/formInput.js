// ============================================================
// formInput.js … 申込内容入力画面
// スタッフが患者様の情報を入力します。
// 入力した内容は「下書き(draft)」として保存し、確認画面に渡します。
// ============================================================

import { getTemplate, getStores, setDraft, getDraft, newId } from "../storage.js";
import { esc, todayStr, go, showLoading, showError } from "../util.js";

export async function render(container, params) {
  showLoading(container);
  let template, stores;
  try {
    // テンプレートと店舗一覧を同時に取得（待ち時間を短縮）
    [template, stores] = await Promise.all([
      getTemplate(params.templateId),
      getStores(),
    ]);
  } catch (e) {
    showError(container, e);
    return;
  }
  if (!template) {
    container.innerHTML = `<div class="empty-box"><p>テンプレートが見つかりません。</p><a href="#/select" class="btn">選択画面へ戻る</a></div>`;
    return;
  }
  // 同じテンプレートの入力途中があれば引き継ぐ（戻ってきた時用）
  const draft = getDraft();
  const prev = draft && draft.templateId === template.id ? draft : null;

  // 店舗の選択肢
  const storeOptions = stores
    .map((s) => `<option value="${esc(s)}" ${prev && prev.storeName === s ? "selected" : ""}>${esc(s)}</option>`)
    .join("");

  // プランの選択肢（プランがある場合のみ表示）
  const planBlock =
    (template.plans || []).length > 0
      ? `
      <div class="form-section">
        <h2 class="form-section__title">申込プラン</h2>
        <div class="field">
          <label class="field__label">プランを選択</label>
          <select id="plan" class="field__input">
            <option value="">― 選択してください ―</option>
            ${template.plans
              .map(
                (p) =>
                  `<option value="${esc(p.id)}" ${prev && prev.planId === p.id ? "selected" : ""}>${esc(p.name)}（月額 ${esc(p.monthlyFee)}円 / 初回 ${esc(p.initialFee)}円）</option>`
              )
              .join("")}
          </select>
        </div>
        <div class="field-row">
          <div class="field">
            <label class="field__label">月額料金（円）</label>
            <input id="monthlyFee" class="field__input" type="text" value="${esc(prev ? prev.monthlyFee : "")}" placeholder="例: 8,800" />
          </div>
          <div class="field">
            <label class="field__label">初回費用（円）</label>
            <input id="initialFee" class="field__input" type="text" value="${esc(prev ? prev.initialFee : "")}" placeholder="例: 3,300" />
          </div>
        </div>
      </div>`
      : "";

  // テンプレートで定義された患者情報の入力項目を組み立てる
  const fieldInputs = template.fields
    .map((f) => {
      const rawVal = prev && prev.fieldValues ? (prev.fieldValues[f.id] || "") : "";
      const val = esc(rawVal);
      const req = f.required ? '<span class="field__req">必須</span>' : "";
      let input;
      if (f.type === "textarea") {
        input = `<textarea id="f_${f.id}" class="field__input" rows="3" placeholder="${esc(f.placeholder || "")}">${val}</textarea>`;
      } else if (f.type === "select") {
        // プルダウン（1つ選ぶ）
        input = `<select id="f_${f.id}" class="field__input" data-type="select">
            <option value="">― 選択 ―</option>
            ${(f.options || []).map((o) => `<option ${rawVal === o ? "selected" : ""}>${esc(o)}</option>`).join("")}
          </select>`;
      } else if (f.type === "checkboxes") {
        // 複数選択（任意・該当するものに全部チェック）
        const selected = rawVal ? rawVal.split(" / ") : [];
        input = `<div id="f_${f.id}" class="checkbox-group" data-type="checkboxes">
            ${(f.options || [])
              .map(
                (o) =>
                  `<label class="cbx"><input type="checkbox" value="${esc(o)}" ${selected.includes(o) ? "checked" : ""}/> ${esc(o)}</label>`
              )
              .join("")}
          </div>`;
      } else {
        input = `<input id="f_${f.id}" class="field__input" type="${f.type === "date" || f.type === "tel" ? f.type : "text"}" value="${val}" placeholder="${esc(f.placeholder || "")}" />`;
      }
      return `
        <div class="field">
          <label class="field__label" for="f_${f.id}">${esc(f.label)} ${req}</label>
          ${input}
        </div>`;
    })
    .join("");

  container.innerHTML = `
    <div class="page-head">
      <h1>${esc(template.name)}</h1>
      <p class="page-head__desc">患者様の情報を入力してください</p>
    </div>

    <form id="inputForm" class="form-card">
      <div class="form-section">
        <h2 class="form-section__title">基本情報</h2>
        <div class="field-row">
          <div class="field">
            <label class="field__label">申込日 <span class="field__req">必須</span></label>
            <input id="applyDate" class="field__input" type="date" value="${esc(prev ? prev.applyDate : todayStr())}" />
          </div>
          <div class="field">
            <label class="field__label">店舗名 <span class="field__req">必須</span></label>
            <select id="storeName" class="field__input">
              <option value="">― 選択 ―</option>
              ${storeOptions}
            </select>
          </div>
        </div>
        <div class="field">
          <label class="field__label">担当者名</label>
          <input id="staffName" class="field__input" type="text" value="${esc(prev ? prev.staffName : "")}" placeholder="担当スタッフ名" />
        </div>
      </div>

      <div class="form-section">
        <h2 class="form-section__title">患者様情報</h2>
        ${fieldInputs}
      </div>

      ${planBlock}

      <div class="form-actions">
        <a href="#/select" class="btn btn--ghost">戻る</a>
        <button type="submit" class="btn btn--primary btn--lg">確認画面へ進む →</button>
      </div>
      <p id="formError" class="form-error"></p>
    </form>
  `;

  // プランを選んだら料金欄を自動入力（あとから手で直せます）
  const planSelect = container.querySelector("#plan");
  if (planSelect) {
    planSelect.addEventListener("change", () => {
      const plan = template.plans.find((p) => p.id === planSelect.value);
      if (plan) {
        container.querySelector("#monthlyFee").value = plan.monthlyFee || "";
        container.querySelector("#initialFee").value = plan.initialFee || "";
      }
    });
  }

  // 「確認画面へ進む」を押したときの処理
  container.querySelector("#inputForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const errorEl = container.querySelector("#formError");

    const applyDate = container.querySelector("#applyDate").value;
    const storeName = container.querySelector("#storeName").value;

    // 必須項目チェック（申込日・店舗・テンプレで必須にした項目）
    if (!applyDate || !storeName) {
      errorEl.textContent = "申込日と店舗名は必須です。";
      return;
    }
    const fieldValues = {};
    for (const f of template.fields) {
      let v;
      if (f.type === "checkboxes") {
        // チェックされた選択肢を「 / 」でつないで保存
        const boxes = container.querySelectorAll(`#f_${f.id} input[type=checkbox]:checked`);
        v = Array.from(boxes).map((b) => b.value).join(" / ");
      } else {
        v = container.querySelector(`#f_${f.id}`).value.trim();
      }
      fieldValues[f.id] = v;
      if (f.required && !v) {
        errorEl.textContent = `「${f.label}」は必須項目です。`;
        return;
      }
    }

    // 選んだプラン情報
    const planEl = container.querySelector("#plan");
    const planId = planEl ? planEl.value : "";
    const plan = planId ? template.plans.find((p) => p.id === planId) : null;

    // 下書きとして保存（確認→サイン→PDFまで持ち回る）
    const draftData = {
      id: prev ? prev.id : newId(),
      templateId: template.id,
      templateName: template.name,
      category: template.category,
      bodySnapshot: template.bodyText,
      termsSnapshot: template.terms,
      checks: template.checks,        // 確認チェック項目（ラベル）
      fields: template.fields,        // 表示用に項目定義も保持
      applyDate,
      storeName,
      staffName: container.querySelector("#staffName").value.trim(),
      fieldValues,
      planId,
      planName: plan ? plan.name : "",
      monthlyFee: (container.querySelector("#monthlyFee") || {}).value || "",
      initialFee: (container.querySelector("#initialFee") || {}).value || "",
      checkedItems: prev ? prev.checkedItems || [] : [],
      signatureDataUrl: prev ? prev.signatureDataUrl || "" : "",
    };
    setDraft(draftData);
    go("/confirm");
  });
}
