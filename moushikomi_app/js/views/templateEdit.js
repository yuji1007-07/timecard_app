// ============================================================
// templateEdit.js … テンプレート編集画面
// テンプレート名・本文・入力項目・チェック項目・プラン・規約を編集します。
// 入力項目は「追加 / 削除 / 並び替え（↑↓）」ができます。
//
// 編集中のデータは model という変数に保持し、
// 構成が変わるたびに画面を作り直します（初心者にも追いやすい方式）。
// ============================================================

import { getTemplate, saveTemplate, newId } from "../storage.js";
import { DEPARTMENTS } from "../config.js";
import { esc, go, showLoading, showError } from "../util.js";

export async function render(container, params) {
  const isNew = params.id === "new";

  // 編集対象の作業用コピーを用意する
  let model;
  if (isNew) {
    model = {
      id: newId(),
      name: "",
      category: "",
      bodyText: "",
      fields: [{ id: newId(), label: "患者氏名", type: "text", required: true, placeholder: "" }],
      checks: [{ id: newId(), label: "上記の内容を確認しました" }],
      plans: [],
      terms: "",
    };
  } else {
    showLoading(container);
    let t;
    try {
      t = await getTemplate(params.id);
    } catch (e) {
      showError(container, e);
      return;
    }
    if (!t) {
      container.innerHTML = `<div class="empty-box"><p>テンプレートが見つかりません。</p><a href="#/templates" class="btn">一覧へ</a></div>`;
      return;
    }
    model = JSON.parse(JSON.stringify(t)); // 元データを壊さないようコピー
  }

  // 画面に表示されている入力値を model に取り込む（再描画や保存の前に呼ぶ）
  function syncFromInputs() {
    model.name = val("#tName");
    model.category = val("#tCategory");
    model.bodyText = val("#tBody");
    model.terms = val("#tTerms");

    // 対象部門（チェックが1つも無ければ「全部門共通」＝空配列）
    model.departments = Array.from(
      container.querySelectorAll(".dept-check:checked")
    ).map((el) => el.value);

    model.fields.forEach((f) => {
      f.label = val(`#fl_${f.id}`);
      f.type = val(`#ft_${f.id}`);
      f.required = container.querySelector(`#fr_${f.id}`).checked;
      f.placeholder = val(`#fp_${f.id}`);
      // 選択肢タイプは「選択肢」欄（改行区切り）を配列に変換して保持
      if (f.type === "select" || f.type === "checkboxes") {
        const raw = val(`#fo_${f.id}`);
        f.options = raw.split("\n").map((s) => s.trim()).filter((s) => s);
      }
    });
    model.checks.forEach((c) => {
      c.label = val(`#cl_${c.id}`);
    });
    model.plans.forEach((p) => {
      p.name = val(`#pn_${p.id}`);
      p.monthlyFee = val(`#pm_${p.id}`);
      p.initialFee = val(`#pi_${p.id}`);
    });
  }

  function val(sel) {
    const el = container.querySelector(sel);
    return el ? el.value : "";
  }

  // --- 画面を組み立てて表示する ---
  function draw() {
    container.innerHTML = `
      <div class="page-head page-head--row">
        <h1>${isNew ? "新規テンプレート作成" : "テンプレート編集"}</h1>
        <a href="#/templates" class="btn btn--ghost">一覧へ戻る</a>
      </div>

      <div class="form-card">
        <div class="form-section">
          <h2 class="form-section__title">基本</h2>
          <div class="field">
            <label class="field__label">テンプレート名 <span class="field__req">必須</span></label>
            <input id="tName" class="field__input" type="text" value="${esc(model.name)}" placeholder="例: 整骨院 会員入会申込書" />
          </div>
          <div class="field">
            <label class="field__label">種類（カテゴリ）</label>
            <input id="tCategory" class="field__input" type="text" value="${esc(model.category)}" placeholder="例: 整骨院 / 鍼灸 / エステ / 回数券 / 同意書" />
          </div>
          <div class="field">
            <label class="field__label">対象部門（この申込書を使える部門）</label>
            <div class="checkbox-group">
              ${DEPARTMENTS.map(
                (d) =>
                  `<label class="cbx"><input type="checkbox" class="dept-check" value="${esc(d)}" ${(model.departments || []).includes(d) ? "checked" : ""}/> ${esc(d)}</label>`
              ).join("")}
            </div>
            <p class="field__hint">どれもチェックしない場合は「全部門で表示（共通）」になります。店舗ログインでは、その店舗の部門に合った申込書だけが表示されます。</p>
          </div>
          <div class="field">
            <label class="field__label">本文（冒頭の説明）</label>
            <textarea id="tBody" class="field__input" rows="3" placeholder="申込書の最初に表示する説明文">${esc(model.bodyText)}</textarea>
          </div>
        </div>

        <div class="form-section">
          <div class="section-head">
            <h2 class="form-section__title">入力項目</h2>
            <button id="addField" class="btn btn--small btn--primary">＋ 項目を追加</button>
          </div>
          <div id="fieldList">${fieldsHtml()}</div>
        </div>

        <div class="form-section">
          <div class="section-head">
            <h2 class="form-section__title">確認チェック項目</h2>
            <button id="addCheck" class="btn btn--small btn--primary">＋ チェックを追加</button>
          </div>
          <div id="checkList">${checksHtml()}</div>
        </div>

        <div class="form-section">
          <div class="section-head">
            <h2 class="form-section__title">プラン・料金</h2>
            <button id="addPlan" class="btn btn--small btn--primary">＋ プランを追加</button>
          </div>
          <div id="planList">${plansHtml()}</div>
        </div>

        <div class="form-section">
          <h2 class="form-section__title">規約・注意事項</h2>
          <textarea id="tTerms" class="field__input" rows="6" placeholder="規約や注意事項を記入">${esc(model.terms)}</textarea>
        </div>

        <div class="form-actions">
          <a href="#/templates" class="btn btn--ghost">キャンセル</a>
          <button id="saveBtn" class="btn btn--primary btn--lg">保存する</button>
        </div>
        <p id="editError" class="form-error"></p>
      </div>
    `;
    bindEvents();
  }

  // 入力項目のHTML（↑↓で並び替え、✕で削除）
  function fieldsHtml() {
    if (model.fields.length === 0) return `<p class="muted">項目がありません。</p>`;
    return model.fields
      .map(
        (f, i) => `
      <div class="edit-row">
        <div class="edit-row__order">
          <button class="icon-btn" data-up="${f.id}" ${i === 0 ? "disabled" : ""}>↑</button>
          <button class="icon-btn" data-down="${f.id}" ${i === model.fields.length - 1 ? "disabled" : ""}>↓</button>
        </div>
        <input id="fl_${f.id}" class="field__input edit-row__main" type="text" value="${esc(f.label)}" placeholder="項目名" />
        <select id="ft_${f.id}" class="field__input edit-row__type">
          <option value="text" ${f.type === "text" ? "selected" : ""}>文字</option>
          <option value="tel" ${f.type === "tel" ? "selected" : ""}>電話</option>
          <option value="date" ${f.type === "date" ? "selected" : ""}>日付</option>
          <option value="textarea" ${f.type === "textarea" ? "selected" : ""}>複数行</option>
          <option value="select" ${f.type === "select" ? "selected" : ""}>選択肢</option>
          <option value="checkboxes" ${f.type === "checkboxes" ? "selected" : ""}>複数選択</option>
        </select>
        <input id="fp_${f.id}" class="field__input edit-row__ph" type="text" value="${esc(f.placeholder || "")}" placeholder="入力例" />
        <label class="edit-row__req"><input id="fr_${f.id}" type="checkbox" ${f.required ? "checked" : ""}/> 必須</label>
        <button class="icon-btn icon-btn--danger" data-delfield="${f.id}">✕</button>
        ${(f.type === "select" || f.type === "checkboxes")
          ? `<textarea id="fo_${f.id}" class="field__input edit-row__options" rows="3" placeholder="選択肢を1行に1つ書いてください">${esc((f.options || []).join("\n"))}</textarea>`
          : ""}
      </div>`
      )
      .join("");
  }

  function checksHtml() {
    if (model.checks.length === 0) return `<p class="muted">チェック項目がありません。</p>`;
    return model.checks
      .map(
        (c) => `
      <div class="edit-row">
        <input id="cl_${c.id}" class="field__input edit-row__main" type="text" value="${esc(c.label)}" placeholder="確認文（例: 上記内容を確認しました）" />
        <button class="icon-btn icon-btn--danger" data-delcheck="${c.id}">✕</button>
      </div>`
      )
      .join("");
  }

  function plansHtml() {
    if (model.plans.length === 0) return `<p class="muted">プランがありません（任意）。</p>`;
    return model.plans
      .map(
        (p) => `
      <div class="edit-row">
        <input id="pn_${p.id}" class="field__input edit-row__main" type="text" value="${esc(p.name)}" placeholder="プラン名" />
        <input id="pm_${p.id}" class="field__input edit-row__fee" type="text" value="${esc(p.monthlyFee)}" placeholder="月額" />
        <input id="pi_${p.id}" class="field__input edit-row__fee" type="text" value="${esc(p.initialFee)}" placeholder="初回費用" />
        <button class="icon-btn icon-btn--danger" data-delplan="${p.id}">✕</button>
      </div>`
      )
      .join("");
  }

  // ボタン類の動作を設定
  function bindEvents() {
    // 項目を追加
    container.querySelector("#addField").addEventListener("click", () => {
      syncFromInputs();
      model.fields.push({ id: newId(), label: "", type: "text", required: false, placeholder: "" });
      draw();
    });
    // チェックを追加
    container.querySelector("#addCheck").addEventListener("click", () => {
      syncFromInputs();
      model.checks.push({ id: newId(), label: "" });
      draw();
    });
    // プランを追加
    container.querySelector("#addPlan").addEventListener("click", () => {
      syncFromInputs();
      model.plans.push({ id: newId(), name: "", monthlyFee: "", initialFee: "" });
      draw();
    });

    // 各種削除・並び替え
    container.querySelectorAll("[data-delfield]").forEach((b) =>
      b.addEventListener("click", () => {
        syncFromInputs();
        model.fields = model.fields.filter((f) => f.id !== b.dataset.delfield);
        draw();
      })
    );
    container.querySelectorAll("[data-delcheck]").forEach((b) =>
      b.addEventListener("click", () => {
        syncFromInputs();
        model.checks = model.checks.filter((c) => c.id !== b.dataset.delcheck);
        draw();
      })
    );
    container.querySelectorAll("[data-delplan]").forEach((b) =>
      b.addEventListener("click", () => {
        syncFromInputs();
        model.plans = model.plans.filter((p) => p.id !== b.dataset.delplan);
        draw();
      })
    );
    container.querySelectorAll("[data-up]").forEach((b) =>
      b.addEventListener("click", () => moveField(b.dataset.up, -1))
    );
    container.querySelectorAll("[data-down]").forEach((b) =>
      b.addEventListener("click", () => moveField(b.dataset.down, +1))
    );

    // 保存
    const saveBtn = container.querySelector("#saveBtn");
    saveBtn.addEventListener("click", async () => {
      syncFromInputs();
      if (!model.name.trim()) {
        container.querySelector("#editError").textContent = "テンプレート名は必須です。";
        return;
      }
      saveBtn.disabled = true;
      saveBtn.textContent = "保存中…";
      try {
        await saveTemplate(model);
        go("/templates");
      } catch (e) {
        saveBtn.disabled = false;
        saveBtn.textContent = "保存する";
        container.querySelector("#editError").textContent =
          "保存に失敗しました。通信状態を確認してください。";
      }
    });
  }

  // 項目を1つ上(-1)または下(+1)に移動する
  function moveField(id, dir) {
    syncFromInputs();
    const i = model.fields.findIndex((f) => f.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= model.fields.length) return;
    [model.fields[i], model.fields[j]] = [model.fields[j], model.fields[i]];
    draw();
  }

  draw();
}
