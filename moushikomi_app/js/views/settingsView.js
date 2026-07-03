// ============================================================
// settingsView.js … 本部設定（本部ログイン時のみ）
// 本部のログインID・パスワードを、Webの画面から変更できます。
// 変更内容はサーバーに保存され、全店・全端末に反映されます。
// ============================================================

import { isHQ, getHqSettings, saveHqSettings } from "../storage.js";
import { HQ } from "../config.js";
import { esc, showLoading } from "../util.js";

export async function render(container) {
  // 本部ログイン以外は入れないようにする
  if (!isHQ()) {
    container.innerHTML = `
      <div class="empty-box">
        <p>この画面は「本部ログイン」でのみ使用できます。</p>
        <a href="#/" class="btn">ホームへ</a>
      </div>`;
    return;
  }

  showLoading(container);
  const remote = await getHqSettings();
  const cur = remote || { id: HQ.id, password: HQ.password };

  container.innerHTML = `
    <div class="page-head">
      <h1>本部設定</h1>
      <p class="page-head__desc">本部ログインのID・パスワードを変更できます（全店・全端末に反映）</p>
    </div>

    <div class="form-card" style="max-width:560px">
      <div class="form-section">
        <h2 class="form-section__title">本部ログイン情報</h2>

        <div class="field">
          <label class="field__label">管理ID <span class="field__req">必須</span></label>
          <input id="setId" class="field__input" type="text" value="${esc(cur.id)}" placeholder="例: honbu" />
        </div>

        <div class="field">
          <label class="field__label">新しいパスワード <span class="field__req">必須</span></label>
          <input id="setPw" class="field__input" type="text" value="" placeholder="新しいパスワードを入力" autocomplete="new-password" />
          <p class="field__hint">英大文字・小文字・数字・記号を混ぜると安全です（例: Yuji-Honbu#2026）</p>
        </div>

        <div class="field">
          <label class="field__label">新しいパスワード（確認） <span class="field__req">必須</span></label>
          <input id="setPw2" class="field__input" type="text" value="" placeholder="もう一度入力" autocomplete="new-password" />
        </div>

        <div class="form-actions">
          <a href="#/" class="btn btn--ghost">キャンセル</a>
          <button id="saveSet" class="btn btn--primary btn--lg">保存する</button>
        </div>
        <p id="setMsg" class="form-error"></p>
      </div>

      <div class="form-section">
        <p class="muted" style="font-size:13px; line-height:1.7">
          ・変更後は、次回のログインから新しいID・パスワードが必要になります。<br>
          ・パスワードは忘れないよう、紙かパスワード管理アプリに控えてください。<br>
          ・店舗のPINコード（1007など）はこの画面では変わりません。
        </p>
      </div>
    </div>
  `;

  const msg = container.querySelector("#setMsg");
  const saveBtn = container.querySelector("#saveSet");

  saveBtn.addEventListener("click", async () => {
    const id = container.querySelector("#setId").value.trim();
    const pw = container.querySelector("#setPw").value;
    const pw2 = container.querySelector("#setPw2").value;

    if (!id) { msg.textContent = "管理IDを入力してください。"; return; }
    if (!pw) { msg.textContent = "新しいパスワードを入力してください。"; return; }
    if (pw.length < 6) { msg.textContent = "パスワードは6文字以上にしてください。"; return; }
    if (pw !== pw2) { msg.textContent = "確認用パスワードが一致しません。"; return; }

    if (!confirm("本部のID・パスワードを変更します。よろしいですか？\n（次回ログインから新しい情報が必要です）")) {
      return;
    }
    saveBtn.disabled = true;
    saveBtn.textContent = "保存中…";
    msg.style.color = "";
    msg.textContent = "";
    try {
      await saveHqSettings({ id, password: pw });
      msg.style.color = "#1f7a4d";
      msg.textContent = "✅ 保存しました。次回のログインから新しいID・パスワードをお使いください。";
      container.querySelector("#setPw").value = "";
      container.querySelector("#setPw2").value = "";
    } catch (e) {
      msg.style.color = "";
      msg.textContent = "❌ 保存に失敗しました。通信状態をご確認ください。";
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "保存する";
    }
  });
}
