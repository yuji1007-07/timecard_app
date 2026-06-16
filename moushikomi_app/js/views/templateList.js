// ============================================================
// templateList.js … テンプレート管理（一覧）
// 申込書テンプレートの新規作成・複製・削除・編集への入口です。
// ============================================================

import { getTemplates, duplicateTemplate, deleteTemplate, saveTemplate } from "../storage.js";
import { esc, formatDateTime, showLoading, showError } from "../util.js";
import { KARADA_TEMPLATES } from "../karada_templates.js";

export function render(container) {
  async function draw() {
    showLoading(container);
    let templates;
    try {
      templates = await getTemplates();
    } catch (e) {
      showError(container, e);
      return;
    }

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
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          <button id="loadKarada" class="btn">＋ からだラボ標準を読み込む</button>
          <a href="#/template/new" class="btn btn--primary btn--lg">＋ 新規テンプレート</a>
        </div>
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
      btn.addEventListener("click", async () => {
        try {
          await duplicateTemplate(btn.dataset.dup);
          draw();
        } catch (e) {
          alert("複製に失敗しました。通信状態を確認してください。");
        }
      });
    });
    // 削除
    container.querySelectorAll("[data-del]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (confirm("このテンプレートを削除しますか？")) {
          try {
            await deleteTemplate(btn.dataset.del);
            draw();
          } catch (e) {
            alert("削除に失敗しました。通信状態を確認してください。");
          }
        }
      });
    });

    // からだラボ標準テンプレートを読み込む（同名が無いものだけ追加）
    const loadBtn = container.querySelector("#loadKarada");
    if (loadBtn) {
      loadBtn.addEventListener("click", async () => {
        if (!confirm("からだラボ整骨院／狛江駅前整骨院の標準テンプレートを読み込みますか？\n（すでに同じ名前があるものは追加されません）")) {
          return;
        }
        loadBtn.disabled = true;
        loadBtn.textContent = "読み込み中…";
        try {
          const existingNames = new Set(templates.map((t) => t.name));
          let added = 0;
          for (const t of KARADA_TEMPLATES()) {
            if (!existingNames.has(t.name)) {
              await saveTemplate(t);
              added++;
            }
          }
          alert(added > 0 ? `${added}件のテンプレートを追加しました。` : "すでに読み込み済みです。");
          draw();
        } catch (e) {
          loadBtn.disabled = false;
          loadBtn.textContent = "＋ からだラボ標準を読み込む";
          alert("読み込みに失敗しました。通信状態を確認してください。");
        }
      });
    }
  }

  draw();
}
