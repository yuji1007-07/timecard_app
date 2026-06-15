// ============================================================
// storage.js
// データの保存・読み込みをすべてここに集約します。
// 今は localStorage（ブラウザ内保存）を使っています。
// 将来クラウド保存に変える時は、このファイルの中身だけを
// サーバーAPI呼び出しに書き換えれば、画面側は触らずに済みます。
// ============================================================

// localStorage に保存するときのキー名（保存場所の名前）
const KEY_TEMPLATES = "moushikomi_templates_v1";    // 申込書テンプレート一覧
const KEY_APPLICATIONS = "moushikomi_applications_v1"; // 作成済み申込書（履歴）
const KEY_STORES = "moushikomi_stores_v1";          // 店舗一覧
const KEY_DRAFT = "moushikomi_draft_v1";            // 入力途中の下書き（画面遷移用）

// ------- 小さな共通関数 -------

// ランダムなID（重複しにくい簡易ID）を作る
export function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// localStorage から JSON を読み込む（無ければ初期値を返す）
function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.error("読み込みエラー:", e);
    return fallback;
  }
}

// localStorage に JSON を保存する
function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// ============================================================
// テンプレート（申込書のひな形）
// ============================================================

export function getTemplates() {
  return read(KEY_TEMPLATES, []);
}

export function getTemplate(id) {
  return getTemplates().find((t) => t.id === id) || null;
}

export function saveTemplate(template) {
  const list = getTemplates();
  const index = list.findIndex((t) => t.id === template.id);
  template.updatedAt = new Date().toISOString();
  if (index >= 0) {
    list[index] = template; // 既存を上書き
  } else {
    template.createdAt = new Date().toISOString();
    list.push(template); // 新規追加
  }
  write(KEY_TEMPLATES, list);
  return template;
}

export function deleteTemplate(id) {
  write(KEY_TEMPLATES, getTemplates().filter((t) => t.id !== id));
}

// テンプレートを複製する（中身をコピーして別IDで保存）
export function duplicateTemplate(id) {
  const original = getTemplate(id);
  if (!original) return null;
  const copy = JSON.parse(JSON.stringify(original)); // 完全コピー
  copy.id = newId();
  copy.name = original.name + "（コピー）";
  // 項目・チェック・プランのIDも振り直す
  (copy.fields || []).forEach((f) => (f.id = newId()));
  (copy.checks || []).forEach((c) => (c.id = newId()));
  (copy.plans || []).forEach((p) => (p.id = newId()));
  return saveTemplate(copy);
}

// ============================================================
// 申込書（作成済みデータ＝履歴）
// ============================================================

export function getApplications() {
  // 新しい順で返す
  return read(KEY_APPLICATIONS, []).sort(
    (a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")
  );
}

export function getApplication(id) {
  return read(KEY_APPLICATIONS, []).find((a) => a.id === id) || null;
}

export function saveApplication(application) {
  const list = read(KEY_APPLICATIONS, []);
  const index = list.findIndex((a) => a.id === application.id);
  if (index >= 0) {
    list[index] = application;
  } else {
    application.createdAt = new Date().toISOString();
    list.push(application);
  }
  write(KEY_APPLICATIONS, list);
  return application;
}

export function deleteApplication(id) {
  write(KEY_APPLICATIONS, read(KEY_APPLICATIONS, []).filter((a) => a.id !== id));
}

// ============================================================
// 店舗一覧
// ============================================================

export function getStores() {
  return read(KEY_STORES, []);
}

export function setStores(stores) {
  write(KEY_STORES, stores);
}

// ============================================================
// 下書き（入力→確認→サイン→PDFと画面をまたいでデータを持ち回る）
// ============================================================

export function getDraft() {
  return read(KEY_DRAFT, null);
}

export function setDraft(draft) {
  write(KEY_DRAFT, draft);
}

export function clearDraft() {
  localStorage.removeItem(KEY_DRAFT);
}

// ============================================================
// 初期データの投入（初回起動時だけ）
// ============================================================
import { DEFAULT_TEMPLATES, DEFAULT_STORES } from "./seed.js";

export function seedIfEmpty() {
  if (getTemplates().length === 0) {
    write(KEY_TEMPLATES, DEFAULT_TEMPLATES());
  }
  if (getStores().length === 0) {
    write(KEY_STORES, DEFAULT_STORES);
  }
}
