import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 数値を見やすくフォーマット（千区切り）。null/undefined は "-"。 */
export function fmt(n: number | null | undefined, opts?: { suffix?: string }): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "-";
  const s = n.toLocaleString("ja-JP", { maximumFractionDigits: 1 });
  return opts?.suffix ? `${s}${opts.suffix}` : s;
}

/** ISO週番号文字列（例: 2026-W26）を返す。 */
export function isoWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

/** サーバーがUTCでも日本時間の「今」を表す Date を返す（期間の判定・表示用） */
export function jstNow(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
}

/** 月内の週の日付範囲ラベル（第1週=1〜7日 ... 第5週=29日〜月末） */
export const MONTH_WEEK_RANGES = ["1〜7日", "8〜14日", "15〜21日", "22〜28日", "29日〜月末"] as const;

/** 月内週番号の文字列（例: 2026-07-W2 ＝ 2026年7月の第2週＝8〜14日） */
export function monthWeek(date: Date): string {
  const w = Math.min(5, Math.floor((date.getDate() - 1) / 7) + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-W${w}`;
}

/**
 * 週文字列を読みやすい表記にする。
 * 新形式 "2026-07-W2" → 「7月 第2週（8〜14日）」（withYear で年つき、short で「7月2週」）。
 * 旧ISO形式（2026-W27）や不明な形式はそのまま返す。
 */
export function weekLabel(w: string | null | undefined, opts?: { withYear?: boolean; short?: boolean }): string {
  if (!w) return "-";
  const m = /^(\d{4})-(\d{2})-W([1-5])$/.exec(w);
  if (!m) return w;
  const y = m[1];
  const mo = Number(m[2]);
  const n = Number(m[3]);
  if (opts?.short) return `${mo}月${n}週`;
  const base = `${mo}月 第${n}週（${MONTH_WEEK_RANGES[n - 1]}）`;
  return opts?.withYear ? `${y}年${base}` : base;
}

/** 旧ISO週文字列（2026-W27）を月内週形式へ変換（ISO週の木曜日が属する月で判定）。変換不能ならそのまま。 */
export function isoWeekToMonthWeek(w: string): string {
  const m = /^(\d{4})-W(\d{2})$/.exec(w);
  if (!m) return w;
  const year = Number(m[1]);
  const week = Number(m[2]);
  // ISO週1の月曜日 = 1/4を含む週の月曜日
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const day = jan4.getUTCDay() || 7;
  const mondayW1 = new Date(jan4);
  mondayW1.setUTCDate(jan4.getUTCDate() - (day - 1));
  const thursday = new Date(mondayW1);
  thursday.setUTCDate(mondayW1.getUTCDate() + (week - 1) * 7 + 3);
  const wn = Math.min(5, Math.floor((thursday.getUTCDate() - 1) / 7) + 1);
  return `${thursday.getUTCFullYear()}-${String(thursday.getUTCMonth() + 1).padStart(2, "0")}-W${wn}`;
}

/** 年月文字列（例: 2026-06） */
export function yearMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** 年月文字列(YYYY-MM)に n ヶ月足した年月文字列を返す。例: addMonthStr("2026-06",1)→"2026-07" */
export function addMonthStr(ym: string, n: number): string {
  const m = /^(\d{4})-(\d{2})$/.exec(ym);
  if (!m) return ym;
  const total = Number(m[1]) * 12 + (Number(m[2]) - 1) + n;
  const y = Math.floor(total / 12);
  const mo = (total % 12) + 1;
  return `${y}-${String(mo).padStart(2, "0")}`;
}

/** 年月文字列(YYYY-MM)を「6月」のような短い表記にする。年が baseYear と違えば「2027/1」。 */
export function monthShort(ym: string, baseYear?: number): string {
  const m = /^(\d{4})-(\d{2})$/.exec(ym);
  if (!m) return ym;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (baseYear !== undefined && y !== baseYear) return `${y}/${mo}`;
  return `${mo}月`;
}
