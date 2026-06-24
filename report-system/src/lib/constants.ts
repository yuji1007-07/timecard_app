// 列挙値 -> 日本語ラベルのマッピングと選択肢一覧

export const BUSINESS_TYPES = {
  SEIKOTSU: "整骨院",
  SHINKYU: "鍼灸",
  ESTHE: "エステ",
  COMPLEX: "複合店舗",
} as const;
export type BusinessType = keyof typeof BUSINESS_TYPES;

// 部門に使える業態（複合店舗の中身）
export const DEPARTMENT_TYPES = {
  SEIKOTSU: "整骨院",
  SHINKYU: "鍼灸",
  ESTHE: "エステ",
} as const;

export const ROLES = {
  AREA_MANAGER: "エリアマネージャー",
  STORE_MANAGER: "院長・店舗責任者",
  DEPARTMENT_MANAGER: "部門責任者",
} as const;
export type Role = keyof typeof ROLES;

export const STORE_STATUS = {
  ACTIVE: "稼働中",
  SUSPENDED: "休止中",
  CLOSED: "閉院",
} as const;

export const UNITS = ["円", "人", "枚", "回", "%", "件"] as const;

export const INPUT_TYPES = {
  NUMBER: "数値",
  PERCENT: "パーセント",
  TEXT: "テキスト",
} as const;

export const GOOD_DIRECTIONS = {
  UP: "増えると良い",
  DOWN: "減ると良い",
} as const;

export const FREQUENCIES = {
  DAILY: "毎日",
  WEEKLY1: "週1",
  WEEKLY2: "週2",
  MONTHLY1: "月1",
  ANY: "任意",
} as const;

export const KDI_STATUS = {
  COMPLETED: "完了",
  PARTIAL: "一部完了",
  NOT_DONE: "未実施",
  ONGOING: "継続中",
  CANCELLED: "中止",
} as const;

export const REPORT_TYPES = {
  WEEKLY: "週次",
  MONTHLY: "月次",
} as const;

export const ALERT_TARGET_TYPES = {
  ALL: "全業態",
  SEIKOTSU: "整骨院",
  SHINKYU: "鍼灸",
  ESTHE: "エステ",
  STORE: "店舗指定",
  DEPARTMENT: "部門指定",
} as const;

export const ALERT_OPERATORS = {
  GTE: "以上",
  LTE: "以下",
  LT: "未満",
  GT: "超過",
  INCREASED: "前回より増加",
  DECREASED: "前回より低下",
  BELOW_TARGET: "目標未達",
  NOT_SUBMITTED: "未提出",
  ACTION_NOT_DONE: "Action未実施",
} as const;
export type AlertOperator = keyof typeof ALERT_OPERATORS;

export const ALERT_COLORS = {
  RED: "赤",
  YELLOW: "黄",
  BLUE: "青",
} as const;

export const ALERT_COLOR_CLASS: Record<string, string> = {
  RED: "bg-red-100 text-red-800 border-red-300",
  YELLOW: "bg-yellow-100 text-yellow-800 border-yellow-300",
  BLUE: "bg-blue-100 text-blue-800 border-blue-300",
};

export const PRIORITIES = {
  HIGH: "高",
  MID: "中",
  LOW: "低",
} as const;

export const INFLOW_CHANNELS = [
  "ホットペッパー",
  "Google",
  "Yahoo",
  "看板",
  "紹介",
  "チラシ",
  "その他",
  "事故",
] as const;

// 差分判定の結果
export const TREND = {
  IMPROVED: "良化",
  WORSENED: "悪化",
  FLAT: "横ばい",
} as const;

// KDI整合性判定
export const CONSISTENCY = {
  OK: "整合性あり",
  WEAK: "整合性やや弱い",
  NONE: "整合性なし",
  UNKNOWN: "判断不能",
} as const;

export function label<T extends Record<string, string>>(map: T, key: string | null | undefined): string {
  if (!key) return "-";
  return (map as Record<string, string>)[key] ?? key;
}
