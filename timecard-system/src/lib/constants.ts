// 列挙値 -> 日本語ラベルのマッピング

export const COMPANY_NAME = "株式会社まごころグループ";
export const APP_NAME = "勤怠管理";

export const ROLES = {
  ADMIN: "全体管理者",
  STAFF: "スタッフ",
} as const;
export type Role = keyof typeof ROLES;

/** 画面表示用の役割名（店舗責任者はSTAFFのうち担当店舗を持つ人） */
export function roleLabel(role: string, isManager: boolean): string {
  if (role === "ADMIN") return ROLES.ADMIN;
  return isManager ? "店舗責任者" : "一般スタッフ";
}

export const HQ_STORE_NAME = "本部";
export const BRANDS = ["本部", "からだラボ整骨院", "ラコンシェル", "鍼灸ラコンシェル"] as const;

/** 休憩時間のワンタッチ入力候補（分） */
export const BREAK_PRESETS = [60, 140] as const;

/** 初期登録する全店舗（旧システムと同じ） */
export const ALL_STORES = [
  "本部",
  "からだラボ整骨院 たまプラーザ院",
  "からだラボ整骨院 センター北院",
  "からだラボ整骨院 マプレ院",
  "からだラボ整骨院 向ヶ丘遊園院",
  "からだラボ整骨院 新百合ヶ丘北口院",
  "からだラボ整骨院 桜台院",
  "からだラボ武蔵整骨院 武蔵小杉院",
  "からだラボ整骨院 溝の口分院",
  "からだラボ整骨院 溝の口院",
  "狛江駅前整骨院",
  "からだラボ整骨院 用賀院",
  "からだラボ駅前整骨院",
  "からだラボ整骨院 駒沢大学駅院",
  "からだラボ整骨院 星川院",
  "ラコンシェル三軒茶屋",
  "ラコンシェル溝の口店",
  "ラコンシェル町田店",
  "ラコンシェル青葉台店",
  "ラコンシェル武蔵小杉店",
  "鍼灸ラコンシェルたまプラーザ店",
  "鍼灸ラコンシェル代々木上原店",
  "鍼灸ラコンシェル青葉台店",
  "鍼灸ラコンシェル町田店",
  "鍼灸ラコンシェル武蔵小杉店",
] as const;

export function label<T extends Record<string, string>>(map: T, key: string | null | undefined): string {
  if (!key) return "-";
  return (map as Record<string, string>)[key] ?? key;
}
