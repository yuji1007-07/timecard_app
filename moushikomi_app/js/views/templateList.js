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

    // からだラボ標準テンプレートを読み込む（新規追加＋既存の標準は最新の正式文に更新）
    const loadBtn = container.querySelector("#loadKarada");
    if (loadBtn) {
      loadBtn.addEventListener("click", async () => {
        if (!confirm("からだラボ整骨院／狛江駅前整骨院の標準テンプレートを読み込みます。\n（未登録のものは追加し、すでにある標準テンプレートは最新の正式な契約文に更新します）")) {
          return;
        }
        loadBtn.disabled = true;
        loadBtn.textContent = "読み込み中…";
        try {
          // 名前で既存テンプレートを引けるようにしておく
          const existingByName = new Map(templates.map((t) => [t.name, t]));
          let added = 0;
          let updated = 0;
          for (const t of KARADA_TEMPLATES()) {
            const existing = existingByName.get(t.name);
            if (existing) {
              // 既存の標準を最新の内容へ上書き（idと作成日は引き継ぐ）
              t.id = existing.id;
              t.createdAt = existing.createdAt || t.createdAt;
              await saveTemplate(t);
              updated++;
            } else {
              await saveTemplate(t);
              added++;
            }
          }
          const msg = [];
          if (added > 0) msg.push(`${added}件を追加`);
          if (updated > 0) msg.push(`${updated}件を最新の契約文に更新`);
          alert(msg.length ? msg.join("／") + "しました。" : "変更はありませんでした。");
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
