// ============================================================
// app.js
// アプリの入り口。URLのハッシュ(#/...)を見て、
// 対応する画面(view)を呼び出す「ルーター」です。
// ============================================================

import { seedIfEmpty } from "./storage.js";

// 各画面（views フォルダの中の部品）を読み込む
import * as home from "./views/home.js";
import * as templateSelect from "./views/templateSelect.js";
import * as formInput from "./views/formInput.js";
import * as patientConfirm from "./views/patientConfirm.js";
import * as signature from "./views/signature.js";
import * as pdfPreview from "./views/pdfPreview.js";
import * as history from "./views/history.js";
import * as templateList from "./views/templateList.js";
import * as templateEdit from "./views/templateEdit.js";

// 初回起動時に初期データ（テンプレ・店舗）を入れる
seedIfEmpty();

const appEl = document.getElementById("app");

// ルート定義: 「#/パス」と「呼び出す画面」の対応表
// :id のような部分は後で取り出してパラメータとして渡します
const routes = [
  { pattern: /^\/?$/, view: home },
  { pattern: /^\/select$/, view: templateSelect },
  { pattern: /^\/form\/(.+)$/, view: formInput, keys: ["templateId"] },
  { pattern: /^\/confirm$/, view: patientConfirm },
  { pattern: /^\/sign$/, view: signature },
  { pattern: /^\/preview$/, view: pdfPreview },
  { pattern: /^\/print\/(.+)$/, view: pdfPreview, keys: ["appId"] },
  { pattern: /^\/history$/, view: history },
  { pattern: /^\/templates$/, view: templateList },
  { pattern: /^\/template\/(.+)$/, view: templateEdit, keys: ["id"] },
];

// 現在のURLハッシュを見て、対応する画面を描画する
function router() {
  const hash = location.hash.replace(/^#/, "") || "/";
  for (const route of routes) {
    const match = hash.match(route.pattern);
    if (match) {
      // URLから取り出したパラメータ（例: templateId）をまとめる
      const params = {};
      (route.keys || []).forEach((key, i) => {
        params[key] = decodeURIComponent(match[i + 1]);
      });
      appEl.innerHTML = "";       // いったん画面を空にする
      window.scrollTo(0, 0);      // 上にスクロールを戻す
      route.view.render(appEl, params); // 画面を描画
      return;
    }
  }
  // どれにも当てはまらなければホームへ
  location.hash = "/";
}

// ハッシュが変わるたびに描画し直す
window.addEventListener("hashchange", router);
window.addEventListener("load", router);
router();
