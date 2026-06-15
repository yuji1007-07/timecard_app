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

// ---- 接続設定（ログイン画面で設定し、ブラウザに記憶） ----
const KEY_API_BASE = "moushikomi_api_base";   // サーバーのURL
const KEY_PASSWORD = "moushikomi_password";   // スタッフ共通の合言葉
const KEY_DRAFT = "moushikomi_draft_v1";      // 入力途中の下書き

// サーバーURLの初期値（会社の勤怠アプリのURL + /api/moushikomi）。
// 違う場合はログイン画面で変更できます。
const DEFAULT_API_BASE = "https://magokoro-attendance.onrender.com/api/moushikomi";

// ------- ID生成 -------
export function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ------- 接続情報の読み書き -------
export function getApiBase() {
  return localStorage.getItem(KEY_API_BASE) || DEFAULT_API_BASE;
}
export function getPassword() {
  return localStorage.getItem(KEY_PASSWORD) || "";
}
export function setCredentials(apiBase, password) {
  localStorage.setItem(KEY_API_BASE, apiBase.replace(/\/+$/, "")); // 末尾スラッシュ除去
  localStorage.setItem(KEY_PASSWORD, password);
}
export function clearCredentials() {
  localStorage.removeItem(KEY_PASSWORD);
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

// ============================================================
// テンプレート（申込書のひな形）
// ============================================================
export async function getTemplates() {
  return await api("/templates");
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
  return template;
}

export async function deleteTemplate(id) {
  await api("/templates/" + encodeURIComponent(id), { method: "DELETE" });
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
  try {
    const stores = await api("/stores");
    if (stores && stores.length > 0) return stores;
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
