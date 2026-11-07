// 列挙値 -> 日本語ラベルのマッピング、店舗・部門の初期データ（旧アプリ config.js と同じ）

export const COMPANY_NAME = "株式会社まごころグループ";
export const APP_NAME = "申込書アプリ";

export const ROLES = {
  ADMIN: "本部",
  STAFF: "店舗担当",
} as const;
export type Role = keyof typeof ROLES;

export function roleLabel(role: string): string {
  return role === "ADMIN" ? ROLES.ADMIN : ROLES.STAFF;
}

// ---- 部門 ----
export const DEPARTMENTS = ["整骨院", "エステ", "鍼灸"] as const;
export type Department = (typeof DEPARTMENTS)[number];

// ---- 店舗とPINコードの対応表（旧アプリの一覧のまま） ----
// pin: 旧アプリのログイン番号 / store: 店舗名 / dept: 部門
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
] as const;

// 本部ログインの初期値（旧アプリ config.js の HQ と同じ）
export const DEFAULT_ADMIN_LOGIN_ID = "honbu";
export const DEFAULT_ADMIN_PASSWORD = "honbu-magokoro2026";
export const DEFAULT_ADMIN_NAME = "本部";

// 設定キー
export const SETTING_ALLOW_STORE_EDIT = "allowStoreEdit";

/** 店舗アカウントのログインID（旧PIN から生成。例: store1007） */
export function storeLoginId(pin: string): string {
  return `store${pin}`;
}
