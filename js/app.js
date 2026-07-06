// ============================================================
// app.js
// アプリの入り口。URLのハッシュ(#/...)を見て、対応する画面(view)を
// 呼び出す「ルーター」です。
//
// クラウド保存版では、最初にログイン（合言葉の確認）を行い、
// 成功してから各画面を表示します。
// ============================================================

import { checkAuth, seedIfEmpty, startKeepAlive, getSession, clearSession, isHQ, currentStore, currentDepartment, getStoreEditAllowed, refreshStoreEditFlag } from "./storage.js";

// テンプレート編集ができるか（本部、または本部が店舗編集を許可している場合）
function canEditTemplates() {
  return isHQ() || getStoreEditAllowed();
}

// 各画面（views フォルダの中の部品）を読み込む
import * as login from "./views/login.js";
import * as home from "./views/home.js";
import * as templateSelect from "./views/templateSelect.js";
import * as formInput from "./views/formInput.js";
import * as patientConfirm from "./views/patientConfirm.js";
import * as signature from "./views/signature.js";
import * as pdfPreview from "./views/pdfPreview.js";
import * as history from "./views/history.js";
import * as customerManage from "./views/customerManage.js";
import * as templateList from "./views/templateList.js";
import * as templateEdit from "./views/templateEdit.js";
import * as settingsView from "./views/settingsView.js";

const appEl = document.getElementById("app");
let authed = false; // ログイン済みかどうか

// 画面上部に「ログイン中の店舗／本部」と「ログアウト」を表示する
function updateSessionBar() {
  const nav = document.querySelector(".app-header__nav");
  if (!nav) return;
  let bar = document.getElementById("sessionBar");
  const session = getSession();
  if (!session) {
    if (bar) bar.remove();
    return;
  }
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "sessionBar";
    bar.className = "session-bar";
    nav.after(bar);
  }
  // テンプレート管理は「本部」または「編集を許可された店舗」だけ表示
  const navTemplates = nav.querySelector('a[href="#/templates"]');
  if (navTemplates) navTemplates.style.display = canEditTemplates() ? "" : "none";

  // 本部ログイン時だけ「本部設定」リンクをナビに出す
  let navSettings = document.getElementById("navSettings");
  if (isHQ()) {
    if (!navSettings) {
      navSettings = document.createElement("a");
      navSettings.id = "navSettings";
      navSettings.className = "nav-link";
      navSettings.href = "#/settings";
      navSettings.textContent = "本部設定";
      nav.appendChild(navSettings);
    }
  } else if (navSettings) {
    navSettings.remove();
  }

  const who = isHQ()
    ? `🏢 本部（全店）`
    : `🏥 ${currentDepartment()}／${currentStore()}`;
  bar.innerHTML = `
    <span class="session-bar__who">${who}</span>
    <button id="logoutBtn" class="session-bar__logout">ログアウト</button>`;
  document.getElementById("logoutBtn").addEventListener("click", () => {
    if (!confirm("ログアウトしますか？")) return;
    clearSession();
    authed = false;
    location.hash = "/login";
    router();
  });
}

// ルート定義
const routes = [
  { pattern: /^\/?$/, view: home },
  { pattern: /^\/select$/, view: templateSelect },
  { pattern: /^\/form\/(.+)$/, view: formInput, keys: ["templateId"] },
  { pattern: /^\/confirm$/, view: patientConfirm },
  { pattern: /^\/sign$/, view: signature },
  { pattern: /^\/preview$/, view: pdfPreview },
  { pattern: /^\/print\/(.+)$/, view: pdfPreview, keys: ["appId"] },
  { pattern: /^\/history$/, view: history },
  { pattern: /^\/customers$/, view: customerManage },
  { pattern: /^\/templates$/, view: templateList, editArea: true },
  { pattern: /^\/template\/(.+)$/, view: templateEdit, keys: ["id"], editArea: true },
  { pattern: /^\/settings$/, view: settingsView, hqOnly: true },
];

function router() {
  // 未ログインならログイン画面（または明示的に #/login）
  const hash = location.hash.replace(/^#/, "") || "/";
  if (!authed || hash === "/login") {
    updateSessionBar();
    showLogin();
    return;
  }
  updateSessionBar();

  for (const route of routes) {
    const match = hash.match(route.pattern);
    if (match) {
      // 本部専用の画面に、店舗(PIN)ログインでアクセスしたらホームへ戻す
      if (route.hqOnly && !isHQ()) {
        location.hash = "/";
        return;
      }
      // テンプレート編集エリアは、本部 or 編集許可された店舗のみ
      if (route.editArea && !canEditTemplates()) {
        location.hash = "/";
        return;
      }
      const params = {};
      (route.keys || []).forEach((key, i) => {
        params[key] = decodeURIComponent(match[i + 1]);
      });
      appEl.innerHTML = "";
      window.scrollTo(0, 0);
      route.view.render(appEl, params); // 画面を描画（中で必要に応じて非同期通信）
      return;
    }
  }
  location.hash = "/";
}

// ログイン画面を表示し、成功したら初期化してホームへ
function showLogin() {
  appEl.innerHTML = "";
  login.render(appEl, {
    onSuccess: () => {
      authed = true;
      startKeepAlive();
      // 最新の「店舗編集許可」を取得してから画面を出す
      refreshStoreEditFlag().finally(() => {
        updateSessionBar();
        location.hash = "/";
        router();
      });
    },
  });
}

// 起動処理：記憶済みの合言葉でログインできるか確認
async function boot() {
  appEl.innerHTML = `
    <div class="loading-box">
      ⏳ 接続中…<br>
      <span style="font-size:14px;color:#8a93a3">
        （しばらく使っていなかった場合、最初の接続に最大1分ほどかかります）
      </span>
    </div>`;
  // ログイン済み（＝店舗/本部のセッションがある）かどうかで判定
  authed = !!getSession();
  if (authed) {
    startKeepAlive();       // 開いている間サーバーを起こし続ける
    checkAuth().then((ok) => { if (ok) seedIfEmpty(); }); // 疎通確認は裏で
    // 店舗の編集許可を最新化し、変わっていたら画面の出し分けを更新
    refreshStoreEditFlag().finally(() => { updateSessionBar(); router(); });
  }
  updateSessionBar();
  router();
}

window.addEventListener("hashchange", router);
boot();
