// 列挙値 -> 日本語ラベルのマッピング

export const COMPANY_NAME = "株式会社まごころグループ";
export const APP_NAME = "研修動画";

export const ROLES = {
  ADMIN: "本部（管理者）",
  STAFF: "店舗スタッフ",
} as const;
export type Role = keyof typeof ROLES;

/** 役職（権限ではない。責任者向け動画の対象判定に使う） */
export const POSITIONS = {
  MANAGER: "店長",
  SUBMANAGER: "副店長",
  LEADER: "リーダー",
  STAFF: "スタッフ",
} as const;
export type Position = keyof typeof POSITIONS;
export const POSITION_ORDER: Position[] = ["MANAGER", "SUBMANAGER", "LEADER", "STAFF"];
/** 責任者（店長・副店長・リーダー） */
export const LEADER_POSITIONS: string[] = ["MANAGER", "SUBMANAGER", "LEADER"];

/** 動画のカテゴリ */
export const CATEGORIES = {
  COMMON: "全部門共通",
  SEIKOTSU: "整骨",
  ESTHE: "エステ",
  SHINKYU: "鍼灸",
} as const;
export type Category = keyof typeof CATEGORIES;

/** ブランド → その部門のカテゴリ */
export const BRAND_CATEGORY: Record<string, Category> = {
  からだラボ整骨院: "SEIKOTSU",
  ラコンシェル: "ESTHE",
  鍼灸ラコンシェル: "SHINKYU",
};

/** 対象役職 */
export const AUDIENCES = {
  ALL: "全員",
  LEADERS: "責任者（店長・副店長・リーダー）",
} as const;

/** 必修の範囲 */
export const REQUIRED_SCOPES = {
  NONE: "必修にしない",
  ALL: "対象者全員が必修",
  LEADERS: "責任者のみ必修",
} as const;

/** 再生した部分がこの割合以上で「視聴完了」 */
export const WATCH_COMPLETE_RATIO = 0.9;
/** テストの正答率がこの割合以上で「合格」 */
export const QUIZ_PASS_RATIO = 0.8;
/** 期限まであと何日で「期限が近い」とするか */
export const DUE_SOON_DAYS = 7;

export const HQ_STORE_NAME = "本部";
export const BRANDS = ["本部", "からだラボ整骨院", "ラコンシェル", "鍼灸ラコンシェル"] as const;

/** 初期登録する全店舗（勤怠管理システム timecard-system/src/lib/constants.ts の ALL_STORES と同じ） */
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
