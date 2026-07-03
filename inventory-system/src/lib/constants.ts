// 列挙値 -> 日本語ラベルのマッピングと選択肢一覧

export const BUSINESS_TYPES = {
  SEIKOTSU: "整骨院",
  SHINKYU: "鍼灸",
  ESTHE: "エステ",
  COMPLEX: "複合",
} as const;
export type BusinessType = keyof typeof BUSINESS_TYPES;

export const BUSINESS_TYPE_CLASS: Record<string, string> = {
  SEIKOTSU: "bg-blue-100 text-blue-800 border-blue-200",
  SHINKYU: "bg-emerald-100 text-emerald-800 border-emerald-200",
  ESTHE: "bg-pink-100 text-pink-800 border-pink-200",
  COMPLEX: "bg-purple-100 text-purple-800 border-purple-200",
};

export const ROLES = {
  AREA_MANAGER: "エリアマネージャー（本部）",
  STORE_MANAGER: "店舗マネージャー（在庫＋商品設定）",
  STORE_STAFF: "店舗スタッフ",
} as const;
export type Role = keyof typeof ROLES;

// 商品・ブランド・カテゴリの設定ができる権限（本部 or 店舗マネージャー）
export const PRODUCT_MANAGER_ROLES = ["AREA_MANAGER", "STORE_MANAGER"] as const;

export const STORE_STATUS = {
  ACTIVE: "稼働中",
  SUSPENDED: "休止中",
  CLOSED: "閉院",
} as const;

export const STORE_STATUS_CLASS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800 border-green-200",
  SUSPENDED: "bg-yellow-100 text-yellow-800 border-yellow-200",
  CLOSED: "bg-gray-100 text-gray-600 border-gray-200",
};

export const UNITS = ["個", "本", "箱", "セット", "枚", "袋", "ケース"] as const;

export const TAX_RATES = [8, 10] as const;

// 価格入力モード
export const PRICE_MODES = {
  EXCL: "税抜入力（税込を自動計算）",
  INCL: "税込入力（税抜を自動計算）",
  BOTH: "両方入力",
} as const;
export type PriceMode = keyof typeof PRICE_MODES;

// 取引種別
export const TX_TYPES = {
  ORDER: "発注（入荷）",
  CONSUME: "消耗（販売）",
  TRANSFER_OUT: "店舗間移動（出庫）",
  TRANSFER_IN: "店舗間移動（入庫）",
  EMPLOYEE_SALE: "社販",
  GIFT: "プレゼント",
} as const;
export type TxType = keyof typeof TX_TYPES;

// 在庫への符号（＋＝増 / －＝減）
export const TX_SIGN: Record<string, number> = {
  ORDER: 1,
  CONSUME: -1,
  TRANSFER_OUT: -1,
  TRANSFER_IN: 1,
  EMPLOYEE_SALE: -1,
  GIFT: -1,
};

export const TX_TYPE_CLASS: Record<string, string> = {
  ORDER: "bg-blue-100 text-blue-800 border-blue-200",
  CONSUME: "bg-amber-100 text-amber-800 border-amber-200",
  TRANSFER_OUT: "bg-purple-100 text-purple-800 border-purple-200",
  TRANSFER_IN: "bg-purple-100 text-purple-800 border-purple-200",
  EMPLOYEE_SALE: "bg-cyan-100 text-cyan-800 border-cyan-200",
  GIFT: "bg-rose-100 text-rose-800 border-rose-200",
};

// 丸めルール
export const ROUNDING = {
  ROUND: "四捨五入",
  FLOOR: "切り捨て",
  CEIL: "切り上げ",
} as const;

// ズレ金額の算出基準
export const DIFF_BASIS = {
  WHOLESALE: "卸価格",
  NORMAL: "通常価格",
} as const;

export function label<T extends Record<string, string>>(
  map: T,
  key: string | null | undefined
): string {
  if (!key) return "-";
  return (map as Record<string, string>)[key] ?? key;
}

export function yen(n: number | null | undefined): string {
  if (n == null) return "-";
  return "¥" + Math.round(n).toLocaleString("ja-JP");
}
