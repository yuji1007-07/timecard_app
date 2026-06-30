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
