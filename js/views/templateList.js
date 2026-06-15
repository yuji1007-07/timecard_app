// ============================================================
// templateList.js … テンプレート管理（一覧）
// 申込書テンプレートの新規作成・複製・削除・編集への入口です。
// ============================================================

import { getTemplates, duplicateTemplate, deleteTemplate } from "../storage.js";
import { esc, formatDateTime } from "../util.js";

export function render(container) {
  function draw() {
    const templates = getTemplates();

    const rows = templates
      .map(
        (t) => `
        <tr>
          <td class="td-strong">${esc(t.name)}</td>
          <td>${esc(t.category || "")}</td>
          <td>${t.fields.length}項目 / ${(t.plans || []).length}プラン</td>
          <td>${esc(formatDateTime(t.updatedAt))}</td>
          <td class="td-actions">
            <a href="#/template/${encodeURIComponent(t.id)}" class="btn btn--small btn--primary">編集</a>
            <button class="btn btn--small" data-dup="${esc(t.id)}">複製</button>
            <button class="btn btn--small btn--danger" data-del="${esc(t.id)}">削除</button>
          </td>
        </tr>`
      )
      .join("");

    container.innerHTML = `
      <div class="page-head page-head--row">
        <div>
          <h1>テンプレート管理</h1>
          <p class="page-head__desc">申込書のひな形を作成・編集できます</p>
        </div>
        <a href="#/template/new" class="btn btn--primary btn--lg">＋ 新規テンプレート</a>
      </div>

      ${templates.length === 0
        ? `<div class="empty-box"><p>テンプレートがありません。</p></div>`
        : `<div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>テンプレート名</th><th>種類</th><th>構成</th><th>最終更新</th><th>操作</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>`}
    `;

    // 複製
    container.querySelectorAll("[data-dup]").forEach((btn) => {
      btn.addEventListener("click", () => {
        duplicateTemplate(btn.dataset.dup);
        draw();
      });
    });
    // 削除
    container.querySelectorAll("[data-del]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (confirm("このテンプレートを削除しますか？")) {
          deleteTemplate(btn.dataset.del);
          draw();
        }
      });
    });
  }

  draw();
}
