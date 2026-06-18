// ============================================================
// login.js … ログイン画面
// スタッフ共通の合言葉(パスワード)を入力して、クラウド保存に接続します。
// 接続情報はこのiPadのブラウザに記憶され、次回からは自動でログインします。
// ============================================================

import { setCredentials, getApiBase, getPassword, checkAuth, seedIfEmpty } from "../storage.js";
import { esc } from "../util.js";

export function render(container, params = {}) {
  container.innerHTML = `
    <div class="login-wrap">
      <div class="login-card">
        <h1 class="login-title">📋 申込書アプリ</h1>
        <p class="login-desc">ご利用には、ログインパスワードを入力してください。</p>

        <div class="field">
          <label class="field__label">ログインパスワード</label>
          <input id="loginPassword" class="field__input" type="password" value="${esc(getPassword())}" placeholder="パスワードを入力" />
        </div>

        <details class="login-advanced">
          <summary>サーバー設定（通常は変更不要）</summary>
          <div class="field" style="margin-top:12px">
            <label class="field__label">サーバーURL</label>
            <input id="loginApiBase" class="field__input" type="text" value="${esc(getApiBase())}" />
          </div>
        </details>

        <button id="loginBtn" class="btn btn--primary btn--lg login-btn">ログイン</button>
        <p id="loginError" class="form-error"></p>
      </div>
    </div>
  `;

  const btn = container.querySelector("#loginBtn");
  const errEl = container.querySelector("#loginError");

  btn.addEventListener("click", async () => {
    const password = container.querySelector("#loginPassword").value.trim();
    const apiBase = container.querySelector("#loginApiBase").value.trim();
    if (!password) {
      errEl.textContent = "ログインパスワードを入力してください。";
      return;
    }
    btn.disabled = true;
    btn.textContent = "接続中…";
    errEl.textContent = "";

    setCredentials(apiBase, password);
    const ok = await checkAuth();
    if (ok) {
      await seedIfEmpty();            // 初回はテンプレートを用意
      if (params.onSuccess) {
        params.onSuccess();
      } else {
        location.hash = "/";
      }
    } else {
      btn.disabled = false;
      btn.textContent = "ログイン";
      errEl.textContent = "ログインできませんでした。ログインパスワードまたはサーバーURLをご確認ください。";
    }
  });

  // Enterキーでもログインできるように
  container.querySelector("#loginPassword").addEventListener("keydown", (e) => {
    if (e.key === "Enter") btn.click();
  });
}
