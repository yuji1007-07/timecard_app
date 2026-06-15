// ============================================================
// history.js … 申込履歴一覧
// 作成済みの申込書を一覧表示し、検索・PDF確認・削除ができます。
// ============================================================

import { getApplications, deleteApplication } from "../storage.js";
import { esc, formatDateJa, formatDateTime } from "../util.js";

export function render(container) {
  // 検索条件の現在値（画面内だけで保持）
  const filter = { name: "", date: "", category: "", store: "" };

  container.innerHTML = `
    <div class="page-head">
      <h1>申込履歴</h1>
      <p class="page-head__desc">作成した申込書の一覧です</p>
    </div>

    <div class="search-bar no-print">
      <input id="sName" class="search-input" type="text" placeholder="患者名で検索" />
      <input id="sDate" class="search-input" type="date" />
      <input id="sCategory" class="search-input" type="text" placeholder="申込書種類で検索" />
      <input id="sStore" class="search-input" type="text" placeholder="店舗名で検索" />
      <button id="clearSearch" class="btn btn--ghost">クリア</button>
    </div>

    <div id="historyList"></div>
  `;

  const listEl = container.querySelector("#historyList");

  // 一覧を（検索条件で絞り込んで）描画する
  function draw() {
    let apps = getApplications();

    apps = apps.filter((a) => {
      const name = patientName(a).toLowerCase();
      if (filter.name && !name.includes(filter.name.toLowerCase())) return false;
      if (filter.date && a.applyDate !== filter.date) return false;
      if (filter.category && !(a.templateName + a.category).toLowerCase().includes(filter.category.toLowerCase())) return false;
      if (filter.store && !(a.storeName || "").toLowerCase().includes(filter.store.toLowerCase())) return false;
      return true;
    });

    if (apps.length === 0) {
      listEl.innerHTML = `<div class="empty-box"><p>該当する申込書はありません。</p></div>`;
      return;
    }

    const rows = apps
      .map(
        (a) => `
        <tr>
          <td>${esc(formatDateJa(a.applyDate))}</td>
          <td class="td-strong">${esc(patientName(a))}</td>
          <td>${esc(a.templateName)}</td>
          <td>${esc(a.storeName || "")}</td>
          <td>${esc(a.staffName || "")}</td>
          <td class="td-actions">
            <a href="#/print/${encodeURIComponent(a.id)}" class="btn btn--small btn--primary">PDF確認</a>
            <button class="btn btn--small btn--danger" data-del="${esc(a.id)}">削除</button>
          </td>
        </tr>`
      )
      .join("");

    listEl.innerHTML = `
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr><th>申込日</th><th>患者名</th><th>申込書種類</th><th>店舗名</th><th>担当者</th><th>操作</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <p class="list-count">${apps.length} 件</p>
    `;

    // 削除ボタン
    listEl.querySelectorAll("[data-del]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (confirm("この申込書を削除しますか？（元に戻せません）")) {
          deleteApplication(btn.dataset.del);
          draw();
        }
      });
    });
  }

  // 検索入力に反応
  const bind = (id, key) =>
    container.querySelector(id).addEventListener("input", (e) => {
      filter[key] = e.target.value;
      draw();
    });
  bind("#sName", "name");
  bind("#sDate", "date");
  bind("#sCategory", "category");
  bind("#sStore", "store");

  container.querySelector("#clearSearch").addEventListener("click", () => {
    filter.name = filter.date = filter.category = filter.store = "";
    container.querySelector("#sName").value = "";
    container.querySelector("#sDate").value = "";
    container.querySelector("#sCategory").value = "";
    container.querySelector("#sStore").value = "";
    draw();
  });

  draw();
}

// 申込データから患者氏名を取り出す
function patientName(a) {
  const f = (a.fields || []).find((x) => x.label.includes("氏名") || x.label.includes("名前"));
  return f ? a.fieldValues[f.id] || "（無記名）" : "（無記名）";
}
