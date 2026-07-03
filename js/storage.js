// ============================================================
// storage.js
// データの保存・読み込みをすべてここに集約します。
//
// 【クラウド保存版】
// 申込内容・テンプレート・申込履歴は、会社のサーバー（勤怠アプリと同じ
// Render上のAPI）に保存します。これにより全iPad・PCでデータを共有できます。
//
// ・サーバーURLと合言葉(パスワード)は、最初のログイン画面で設定し、
//   このiPadのブラウザに記憶します（次回から自動でログイン）。
// ・入力途中の「下書き(draft)」だけは、画面遷移用にこのiPad内に一時保存します。
// ============================================================

import { DEFAULT_TEMPLATES, DEFAULT_STORES } from "./seed.js";
import { API_BASE, API_PASSWORD } from "./config.js";

// ---- 接続設定（ログイン画面で設定し、ブラウザに記憶） ----
const KEY_API_BASE = "moushikomi_api_base";   // サーバーのURL
const KEY_PASSWORD = "moushikomi_password";   // サーバー共通キー（裏側）
const KEY_DRAFT = "moushikomi_draft_v1";      // 入力途中の下書き
const KEY_SESSION = "moushikomi_session_v1";  // ログイン中の店舗/本部の情報

// サーバーURLの初期値（会社の勤怠アプリのURL + /api/moushikomi）。
// 違う場合はログイン画面で変更できます。
const DEFAULT_API_BASE = API_BASE;

// ------- ID生成 -------
export function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ------- 接続情報の読み書き -------
export function getApiBase() {
  return localStorage.getItem(KEY_API_BASE) || DEFAULT_API_BASE;
}
export function getPassword() {
  // 端末に保存済みのキーがあれば優先。無ければ内蔵の共通キーを使う。
  return localStorage.getItem(KEY_PASSWORD) || API_PASSWORD;
}
export function setCredentials(apiBase, password) {
  if (apiBase) localStorage.setItem(KEY_API_BASE, apiBase.replace(/\/+$/, "")); // 末尾スラッシュ除去
  if (password) localStorage.setItem(KEY_PASSWORD, password);
}
export function clearCredentials() {
  localStorage.removeItem(KEY_PASSWORD);
}

// ------- ログインセッション（店舗ログイン / 本部ログイン） -------
// store モード: { mode:"store", storeName, department, pin }
// hq    モード: { mode:"hq", name }
export function getSession() {
  const raw = localStorage.getItem(KEY_SESSION);
  return raw ? JSON.parse(raw) : null;
}
export function setSession(session) {
  localStorage.setItem(KEY_SESSION, JSON.stringify(session));
}
export function clearSession() {
  localStorage.removeItem(KEY_SESSION);
}
export function isHQ() {
  const s = getSession();
  return !!s && s.mode === "hq";
}
// 店舗ログイン中ならその店舗名、本部なら "" を返す
export function currentStore() {
  const s = getSession();
  return s && s.mode === "store" ? s.storeName : "";
}
export function currentDepartment() {
  const s = getSession();
  return s && s.mode === "store" ? s.department : "";
}

// ------- サーバー通信の共通処理 -------
async function api(path, options = {}) {
  const res = await fetch(getApiBase() + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-App-Password": getPassword(),
      ...(options.headers || {}),
    },
  });
  if (res.status === 401) {
    const err = new Error("認証エラー（合言葉が違います）");
    err.code = 401;
    throw err;
  }
  if (!res.ok) {
    throw new Error("サーバーエラー（" + res.status + "）");
  }
  // 中身が無い場合に備える
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ログイン確認（合言葉が正しいかサーバーに問い合わせ）
export async function checkAuth() {
  if (!getPassword()) return false;
  try {
    await api("/ping");
    return true;
  } catch (e) {
    return false;
  }
}

// サーバーが寝てしまわないよう、アプリを開いている間は定期的に
// 軽い問い合わせ(ping)を送って起こし続ける（セッション中の遅延を防ぐ）。
let _keepAliveTimer = null;
export function startKeepAlive() {
  if (_keepAliveTimer) return;
  _keepAliveTimer = setInterval(() => {
    api("/ping").catch(() => {}); // 失敗しても無視
  }, 4 * 60 * 1000); // 4分ごと
}

// ============================================================
// テンプレート（申込書のひな形）
// ============================================================
// 一度読んだテンプレート・店舗一覧は記憶しておき、画面移動のたびに
// 再通信しないようにします（体感速度が大きく改善します）。
// データを変更したときは記憶を消して、次回に最新を読み直します。
let _templatesCache = null;
let _storesCache = null;

export async function getTemplates(force = false) {
  if (!force && _templatesCache) return _templatesCache;
  _templatesCache = await api("/templates");
  return _templatesCache;
}

export async function getTemplate(id) {
  const list = await getTemplates();
  return list.find((t) => t.id === id) || null;
}

export async function saveTemplate(template) {
  if (!template.id) template.id = newId();
  template.updatedAt = new Date().toISOString();
  if (!template.createdAt) template.createdAt = template.updatedAt;
  await api("/templates/" + encodeURIComponent(template.id), {
    method: "PUT",
    body: JSON.stringify(template),
  });
  _templatesCache = null; // 記憶を消して次回に最新を読み直す
  return template;
}

export async function deleteTemplate(id) {
  await api("/templates/" + encodeURIComponent(id), { method: "DELETE" });
  _templatesCache = null;
}

export async function duplicateTemplate(id) {
  const original = await getTemplate(id);
  if (!original) return null;
  const copy = JSON.parse(JSON.stringify(original));
  copy.id = newId();
  copy.name = original.name + "（コピー）";
  (copy.fields || []).forEach((f) => (f.id = newId()));
  (copy.checks || []).forEach((c) => (c.id = newId()));
  (copy.plans || []).forEach((p) => (p.id = newId()));
  return await saveTemplate(copy);
}

// ============================================================
// 申込書（作成済みデータ＝履歴）
// ============================================================
export async function getApplications() {
  // サーバー側で新しい順に並んで返ってきます
  return await api("/applications");
}

export async function getApplication(id) {
  const list = await getApplications();
  return list.find((a) => a.id === id) || null;
}

export async function saveApplication(application) {
  if (!application.id) application.id = newId();
  if (!application.createdAt) application.createdAt = new Date().toISOString();
  await api("/applications/" + encodeURIComponent(application.id), {
    method: "PUT",
    body: JSON.stringify(application),
  });
  return application;
}

export async function deleteApplication(id) {
  await api("/applications/" + encodeURIComponent(id), { method: "DELETE" });
}

// ============================================================
// 店舗一覧（勤怠アプリの店舗マスタを利用）
// ============================================================
export async function getStores() {
  if (_storesCache) return _storesCache;
  try {
    const stores = await api("/stores");
    if (stores && stores.length > 0) {
      _storesCache = stores;
      return stores;
    }
  } catch (e) {
    // 取得できなければ初期値で代用
  }
  return DEFAULT_STORES;
}

// ============================================================
// 下書き（入力→確認→サイン→PDFの間だけ、このiPad内に一時保存）
// ============================================================
export function getDraft() {
  const raw = localStorage.getItem(KEY_DRAFT);
  return raw ? JSON.parse(raw) : null;
}
export function setDraft(draft) {
  localStorage.setItem(KEY_DRAFT, JSON.stringify(draft));
}
export function clearDraft() {
  localStorage.removeItem(KEY_DRAFT);
}

// ============================================================
// 初期テンプレートの投入（サーバーが空のときだけ）
// ============================================================
export async function seedIfEmpty() {
  try {
    const templates = await getTemplates();
    if (!templates || templates.length === 0) {
      for (const t of DEFAULT_TEMPLATES()) {
        await saveTemplate(t);
      }
    }
  } catch (e) {
    console.error("初期テンプレート投入エラー:", e);
  }
}
