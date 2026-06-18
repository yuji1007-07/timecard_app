// ============================================================
// customerManage.js … 顧客管理ページ
// 申込履歴を「店舗別・カルテ番号順」できれいに一覧表示します。
// 同じ患者様（カルテ番号）の申込書がまとまって並びます。
// カルテ番号・氏名で検索できます。
// ============================================================

import { getApplications } from "../storage.js";
import { esc, formatDateJa, showError } from "../util.js";
import { exportAppsToZip, downloadBlob } from "../backup.js";

export function render(container) {
  const filter = { keyword: "", store: "" };
  let allApps = [];
  let currentApps = []; // いま表示中（絞り込み後）の申込書

  container.innerHTML = `
    <div class="page-head page-head--row">
      <div>
        <h1>顧客管理</h1>
        <p class="page-head__desc">店舗別・カルテ番号順で申込書を一覧管理できます</p>
      </div>
      <button id="cBackup" class="btn btn--primary no-print">📦 PDFをまとめてZIP保存</button>
    </div>

    <div class="search-bar no-print">
      <input id="cKeyword" class="search-input" type="text" placeholder="カルテ番号・氏名で検索" />
      <select id="cStore" class="search-input"><option value="">すべての店舗</option></select>
      <button id="cClear" class="btn btn--ghost">クリア</button>
    </div>

    <p id="cBackupMsg" class="backup-msg no-print"></p>

    <div id="customerList"></div>
  `;

  const listEl = container.querySelector("#customerList");
  const storeSelect = container.querySelector("#cStore");
  const backupBtn = container.querySelector("#cBackup");
  const backupMsg = container.querySelector("#cBackupMsg");

  // 申込データから「ラベルに特定の語を含む項目」の値を取り出す
  function fieldVal(app, keyword) {
    const f = (app.fields || []).find((x) => x.label.includes(keyword));
    return f ? (app.fieldValues[f.id] || "") : "";
  }
  const chartNo = (a) => fieldVal(a, "カルテ");
  const name = (a) => fieldVal(a, "氏名") || fieldVal(a, "名前") || "（無記名）";
  const kana = (a) => fieldVal(a, "フリガナ");

  function draw() {
    // 検索で絞り込み
    let apps = allApps.filter((a) => {
      if (filter.store && (a.storeName || "") !== filter.store) return false;
      if (filter.keyword) {
        const kw = filter.keyword.toLowerCase();
        const hit = (chartNo(a) + name(a) + kana(a)).toLowerCase().includes(kw);
        if (!hit) return false;
      }
      return true;
    });
    currentApps = apps; // バックアップ対象＝いま表示中のもの

    if (apps.length === 0) {
      listEl.innerHTML = `<div class="empty-box"><p>該当する申込書はありません。</p></div>`;
      return;
    }

    // 店舗ごとにグループ分け
    const byStore = {};
    for (const a of apps) {
      const s = a.storeName || "（店舗未設定）";
      (byStore[s] = byStore[s] || []).push(a);
    }

    // 店舗名で並べ、各店舗内は「カルテ番号 → 申込日」の順
    const storeNames = Object.keys(byStore).sort((a, b) => a.localeCompare(b, "ja"));
    let html = "";
    for (const s of storeNames) {
      const rows = byStore[s]
        .sort((a, b) => {
          const c = chartNo(a).localeCompare(chartNo(b), "ja", { numeric: true });
          if (c !== 0) return c;
          return (a.applyDate || "").localeCompare(b.applyDate || "");
        })
        .map(
          (a) => `
          <tr>
            <td class="td-strong">${esc(chartNo(a) || "—")}</td>
            <td>${esc(name(a))}</td>
            <td>${esc(kana(a))}</td>
            <td>${esc(a.templateName)}</td>
            <td>${esc(formatDateJa(a.applyDate))}</td>
            <td><a href="#/print/${encodeURIComponent(a.id)}" class="btn btn--small btn--primary">PDF</a></td>
          </tr>`
        )
        .join("");

      html += `
        <div class="store-group">
          <h2 class="store-group__title">🏥 ${esc(s)} <span class="store-group__count">${byStore[s].length}件</span></h2>
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>カルテ番号</th><th>氏名</th><th>フリガナ</th><th>申込書種類</th><th>申込日</th><th>PDF</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div>`;
    }
    listEl.innerHTML = html;
  }

  // 店舗の選択肢を作る
  function fillStores() {
    const stores = Array.from(new Set(allApps.map((a) => a.storeName || "（店舗未設定）"))).sort((a, b) =>
      a.localeCompare(b, "ja")
    );
    storeSelect.innerHTML =
      `<option value="">すべての店舗</option>` +
      stores.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join("");
  }

  // 検索操作
  container.querySelector("#cKeyword").addEventListener("input", (e) => {
    filter.keyword = e.target.value;
    draw();
  });
  storeSelect.addEventListener("change", (e) => {
    filter.store = e.target.value;
    draw();
  });
  container.querySelector("#cClear").addEventListener("click", () => {
    filter.keyword = "";
    filter.store = "";
    container.querySelector("#cKeyword").value = "";
    storeSelect.value = "";
    draw();
  });

  // 📦 表示中の申込書を全部PDFにしてZIPでダウンロード
  backupBtn.addEventListener("click", async () => {
    if (currentApps.length === 0) {
      backupMsg.textContent = "保存する申込書がありません。";
      return;
    }
    const label = filter.store ? `「${filter.store}」` : "全店舗";
    if (!confirm(`${label}の表示中 ${currentApps.length}件 をPDFにまとめてZIPで保存します。\n件数が多いと数十秒かかることがあります。よろしいですか？`)) {
      return;
    }
    backupBtn.disabled = true;
    const origText = backupBtn.textContent;
    try {
      const blob = await exportAppsToZip(currentApps, (done, total) => {
        backupMsg.textContent = `PDF作成中… ${done} / ${total} 件`;
        backupBtn.textContent = `作成中… ${done}/${total}`;
      });
      const today = new Date().toISOString().slice(0, 10);
      const storeTag = filter.store ? "_" + filter.store : "";
      downloadBlob(blob, `申込書バックアップ${storeTag}_${today}.zip`);
      backupMsg.textContent = `✅ ${currentApps.length}件をZIPで保存しました。（必要ならGoogleドライブへアップロードしてください）`;
    } catch (e) {
      backupMsg.textContent = "❌ 保存に失敗しました：" + (e && e.message ? e.message : e);
    } finally {
      backupBtn.disabled = false;
      backupBtn.textContent = origText;
    }
  });

  // サーバーから読み込んで表示
  async function load() {
    listEl.innerHTML = `<div class="loading-box">⏳ 読み込み中…</div>`;
    try {
      allApps = await getApplications();
      fillStores();
      draw();
    } catch (e) {
      showError(listEl, e);
    }
  }
  load();
}
