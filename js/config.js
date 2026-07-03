// ============================================================
// config.js … ログインと部門・店舗の設定
//
// 【この1ファイルを直すだけで、店舗やPIN、本部パスワードを変更できます】
//
// ・店舗ログイン … 各店舗は PIN コードでログインし、自店のデータだけ扱います。
// ・本部ログイン … ID＋パスワードでログインし、全店のデータを閲覧・保管できます。
// ・裏側のサーバーキー(API_PASSWORD)はアプリに内蔵し、店員さんには見せません。
//   （すでに端末に保存済みのキーがある場合は、そちらを優先して使います）
// ============================================================

// 保存先サーバー（勤怠アプリと同じRender上のAPI）
export const API_BASE = "https://timecard-app-1.onrender.com/api/moushikomi";

// サーバー共通キー（裏側で使用。店舗ログインでは店員さんは入力しません）
export const API_PASSWORD = "magokoro2026";

// 本部ログイン（ID＋パスワード）… ここを変えれば本部の認証情報を変更できます
export const HQ = {
  id: "honbu",
  password: "honbu-magokoro2026",
  name: "本部",
};

// ---- 部門 ----
export const DEPARTMENTS = ["整骨院", "エステ", "鍼灸"];

// ---- 店舗とPINコードの対応表（いただいた一覧のまま） ----
// pin: ログイン用の番号 / store: 店舗名 / dept: 部門
export const STORES = [
  // 整骨院部門（1000番台）
  { pin: "1001", store: "青葉台駅前院", dept: "整骨院" },
  { pin: "1002", store: "桜台院", dept: "整骨院" },
  { pin: "1003", store: "溝の口本院", dept: "整骨院" },
  { pin: "1004", store: "溝の口分院", dept: "整骨院" },
  { pin: "1005", store: "新百合ヶ丘北口院", dept: "整骨院" },
  { pin: "1006", store: "マプレ院", dept: "整骨院" },
  { pin: "1007", store: "狛江院", dept: "整骨院" },
  { pin: "1008", store: "駒沢大学駅院", dept: "整骨院" },
  { pin: "1009", store: "たまプラーザ院", dept: "整骨院" },
  { pin: "1010", store: "センター北院", dept: "整骨院" },
  { pin: "1011", store: "用賀院", dept: "整骨院" },
  { pin: "1012", store: "武蔵小杉院", dept: "整骨院" },
  { pin: "1013", store: "向ヶ丘遊園院", dept: "整骨院" },
  // エステ部門（2000番台）
  { pin: "2001", store: "エステ青葉台店", dept: "エステ" },
  { pin: "2002", store: "エステ溝の口店", dept: "エステ" },
  { pin: "2003", store: "エステ三軒茶屋店", dept: "エステ" },
  { pin: "2004", store: "エステ町田店", dept: "エステ" },
  // 鍼灸部門（3000番台）
  { pin: "3001", store: "鍼灸代々木上原店", dept: "鍼灸" },
  { pin: "3002", store: "鍼灸町田店", dept: "鍼灸" },
  { pin: "3003", store: "鍼灸たまプラーザ店", dept: "鍼灸" },
  { pin: "3004", store: "鍼灸武蔵小杉店", dept: "鍼灸" },
];

// PINコードから店舗を探す（見つからなければ null）
export function findStoreByPin(pin) {
  const p = String(pin || "").trim();
  return STORES.find((s) => s.pin === p) || null;
}
