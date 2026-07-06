// ============================================================
// templateSelect.js … 申込書テンプレート選択画面
// スタッフがどの申込書を作るか選びます。
// ============================================================

import { getTemplates, isHQ, currentDepartment } from "../storage.js";
import { esc, showLoading, showError } from "../util.js";

// テンプレートがこの部門で表示対象か判定する。
// departments が未設定/空 = 全部門共通（どの部門でも表示）
function visibleForDept(t, dept) {
  const ds = t.departments || [];
  if (ds.length === 0) return true;
  return ds.includes(dept);
}

export async function render(container) {
  showLoading(container);
  let templates;
  try {
    templates = await getTemplates();
  } catch (e) {
    showError(container, e);
    return;
  }

  // 店舗ログイン中は自部門のテンプレートだけに絞る（本部は全部表示）
  const dept = currentDepartment();
  if (!isHQ() && dept) {
    templates = templates.filter((t) => visibleForDept(t, dept));
  }

  if (templates.length === 0) {
    container.innerHTML = `
      <div class="page-head"><h1>申込書を選択</h1></div>
      <div class="empty-box">
        <p>${dept ? `「${esc(dept)}」で使える申込書がまだ設定されていません。` : "テンプレートがまだありません。"}</p>
        <p class="muted" style="margin-top:8px">本部にお問い合わせください。（本部ログイン → テンプレート管理 → 各テンプレートの「対象部門」を設定）</p>
      </div>`;
    return;
  }

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
