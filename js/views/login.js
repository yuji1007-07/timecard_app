// ============================================================
// login.js … ログイン画面（2種類）
//  ・店舗ログイン … PINコード（例: 狛江院=1007）→ 自店のデータだけ
//  ・本部ログイン … ID＋パスワード → 全店のデータを閲覧・保管
// 接続情報はこのブラウザに記憶され、次回からは自動でログインします。
// ============================================================

import {
  setCredentials, getApiBase, checkAuth, seedIfEmpty, setSession,
} from "../storage.js";
import { HQ, findStoreByPin } from "../config.js";
import { esc } from "../util.js";

export function render(container, params = {}) {
  container.innerHTML = `
    <div class="login-wrap">
      <div class="login-card">
        <h1 class="login-title">📋 申込書アプリ</h1>

        <div class="login-tabs">
          <button id="tabStore" class="login-tab login-tab--active">🏥 店舗ログイン</button>
          <button id="tabHq" class="login-tab">🏢 本部ログイン</button>
        </div>

        <!-- 店舗ログイン（PIN） -->
        <div id="paneStore" class="login-pane">
          <p class="login-desc">店舗のPINコード（4桁）を入力してください。</p>
          <div class="field">
            <label class="field__label">PINコード</label>
            <input id="pin" class="field__input login-pin" type="tel" inputmode="numeric"
              maxlength="4" placeholder="例: 1007" autocomplete="off" />
          </div>
          <button id="storeBtn" class="btn btn--primary btn--lg login-btn">ログイン</button>
        </div>

        <!-- 本部ログイン（ID＋パスワード） -->
        <div id="paneHq" class="login-pane" style="display:none">
          <p class="login-desc">本部の管理IDとパスワードを入力してください。</p>
          <div class="field">
            <label class="field__label">ID</label>
            <input id="hqId" class="field__input" type="text" placeholder="ID" autocomplete="username" />
          </div>
          <div class="field">
            <label class="field__label">パスワード</label>
            <input id="hqPw" class="field__input" type="password" placeholder="パスワード" autocomplete="current-password" />
          </div>
          <button id="hqBtn" class="btn btn--primary btn--lg login-btn">本部としてログイン</button>
        </div>

        <details class="login-advanced" id="advBox">
          <summary>サーバー設定（通常は変更不要）</summary>
          <div class="field" style="margin-top:12px">
            <label class="field__label">サーバーURL</label>
            <input id="loginApiBase" class="field__input" type="text" value="${esc(getApiBase())}" />
          </div>
          <div class="field" style="margin-top:12px">
            <label class="field__label">サーバーキー（上書きする場合のみ）</label>
            <input id="loginServerKey" class="field__input" type="text" placeholder="通常は空のままでOK" />
          </div>
        </details>

        <p id="loginError" class="form-error"></p>
      </div>
    </div>
  `;

  const errEl = container.querySelector("#loginError");

  // --- タブ切り替え ---
  const tabStore = container.querySelector("#tabStore");
  const tabHq = container.querySelector("#tabHq");
  const paneStore = container.querySelector("#paneStore");
  const paneHq = container.querySelector("#paneHq");
  function switchTab(store) {
    tabStore.classList.toggle("login-tab--active", store);
    tabHq.classList.toggle("login-tab--active", !store);
    paneStore.style.display = store ? "" : "none";
    paneHq.style.display = store ? "none" : "";
    errEl.textContent = "";
  }
  tabStore.addEventListener("click", () => switchTab(true));
  tabHq.addEventListener("click", () => switchTab(false));

  // 接続情報をセットしてサーバーに疎通確認（共通処理）
  async function connectAndCheck() {
    const apiBase = container.querySelector("#loginApiBase").value.trim();
    const overrideKey = container.querySelector("#loginServerKey").value.trim();
    setCredentials(apiBase, overrideKey); // キーは空なら内蔵/既存を使用
    return await checkAuth();
  }

  async function finishLogin(session) {
    setSession(session);
    await seedIfEmpty();
    if (params.onSuccess) params.onSuccess();
    else location.hash = "/";
  }

  // --- 店舗ログイン ---
  const storeBtn = container.querySelector("#storeBtn");
  storeBtn.addEventListener("click", async () => {
    const pin = container.querySelector("#pin").value.trim();
    const st = findStoreByPin(pin);
    if (!st) {
      errEl.textContent = "PINコードが正しくありません。";
      return;
    }
    storeBtn.disabled = true;
    storeBtn.textContent = "接続中…";
    errEl.textContent = "";
    const ok = await connectAndCheck();
    if (ok) {
      await finishLogin({ mode: "store", storeName: st.store, department: st.dept, pin: st.pin });
    } else {
      storeBtn.disabled = false;
      storeBtn.textContent = "ログイン";
      errEl.textContent = "サーバーに接続できませんでした。「サーバー設定」を開いてご確認ください。";
      container.querySelector("#advBox").open = true;
    }
  });

  // --- 本部ログイン ---
  const hqBtn = container.querySelector("#hqBtn");
  hqBtn.addEventListener("click", async () => {
    const id = container.querySelector("#hqId").value.trim();
    const pw = container.querySelector("#hqPw").value;
    if (id !== HQ.id || pw !== HQ.password) {
      errEl.textContent = "IDまたはパスワードが正しくありません。";
      return;
    }
    hqBtn.disabled = true;
    hqBtn.textContent = "接続中…";
    errEl.textContent = "";
    const ok = await connectAndCheck();
    if (ok) {
      await finishLogin({ mode: "hq", name: HQ.name });
    } else {
      hqBtn.disabled = false;
      hqBtn.textContent = "本部としてログイン";
      errEl.textContent = "サーバーに接続できませんでした。「サーバー設定」を開いてご確認ください。";
      container.querySelector("#advBox").open = true;
    }
  });

  // Enterキー対応
  container.querySelector("#pin").addEventListener("keydown", (e) => {
    if (e.key === "Enter") storeBtn.click();
  });
  container.querySelector("#hqPw").addEventListener("keydown", (e) => {
    if (e.key === "Enter") hqBtn.click();
  });
}
