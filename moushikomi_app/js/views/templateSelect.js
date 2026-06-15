// ============================================================
// templateSelect.js … 申込書テンプレート選択画面
// スタッフがどの申込書を作るか選びます。
// ============================================================

import { getTemplates } from "../storage.js";
import { esc } from "../util.js";

export function render(container) {
  const templates = getTemplates();

  if (templates.length === 0) {
    container.innerHTML = `
      <div class="page-head"><h1>申込書を選択</h1></div>
      <div class="empty-box">
        <p>テンプレートがまだありません。</p>
        <a href="#/templates" class="btn btn--primary">テンプレート管理で作成する</a>
      </div>`;
    return;
  }

  // テンプレートをカードで一覧表示
  const cards = templates
    .map(
      (t) => `
      <a href="#/form/${encodeURIComponent(t.id)}" class="select-card">
        <span class="select-card__badge">${esc(t.category || "申込書")}</span>
        <span class="select-card__name">${esc(t.name)}</span>
        <span class="select-card__meta">入力項目 ${t.fields.length}件 ・ プラン ${(t.plans || []).length}件</span>
      </a>`
    )
    .join("");

  container.innerHTML = `
    <div class="page-head">
      <h1>申込書を選択</h1>
      <p class="page-head__desc">作成する申込書の種類を選んでください</p>
    </div>
    <div class="select-grid">${cards}</div>
  `;
}
