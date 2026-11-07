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
