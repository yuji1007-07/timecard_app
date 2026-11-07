// 日本時間（Asia/Tokyo）まわりのヘルパー。DBはUTCで保持し、表示・入力はJSTで扱う。

const TZ = "Asia/Tokyo";

type Parts = { y: number; m: number; d: number; hh: number; mm: number };

function jstParts(date: Date): Parts {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const map: Record<string, string> = {};
  for (const p of f.formatToParts(date)) map[p.type] = p.value;
  return {
    y: Number(map.year),
    m: Number(map.month),
    d: Number(map.day),
    hh: Number(map.hour) % 24,
    mm: Number(map.minute),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** 日本時間の今日 YYYY-MM-DD */
export function todayJst(now: Date = new Date()): string {
  const p = jstParts(now);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}

/** 日本時間の今月 YYYY-MM */
export function thisMonthJst(now: Date = new Date()): string {
  return todayJst(now).slice(0, 7);
}

/** 秒以下を切り捨てた「今」 */
export function nowMinute(): Date {
  const d = new Date();
  d.setSeconds(0, 0);
  return d;
}

/** 表示: 2026-07-18 09:59 */
export function fmtDateTime(date: Date | null | undefined): string {
  if (!date) return "-";
  const p = jstParts(date);
  return `${p.y}-${pad(p.m)}-${pad(p.d)} ${pad(p.hh)}:${pad(p.mm)}`;
}

/** 表示: 09:59 */
export function fmtTime(date: Date | null | undefined): string {
  if (!date) return "-";
  const p = jstParts(date);
  return `${pad(p.hh)}:${pad(p.mm)}`;
}

/** <input type="datetime-local"> の value 用: 2026-07-18T09:59 */
export function toInputValue(date: Date | null | undefined): string {
  if (!date) return "";
  const p = jstParts(date);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}T${pad(p.hh)}:${pad(p.mm)}`;
}

/** datetime-local の値（JST）を Date に戻す。空なら null */
export function fromInputValue(value: string | null | undefined): Date | null {
  const v = (value ?? "").trim();
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(v);
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00+09:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 分 → 8:00 形式 */
export function minutesToHhmm(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return "-";
  const m = Math.max(0, Math.round(minutes));
  return `${Math.floor(m / 60)}:${pad(m % 60)}`;
}

/** 分 → 8時間 00分 形式 */
export function minutesToHoursText(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return "-";
  const m = Math.max(0, Math.round(minutes));
  return `${Math.floor(m / 60)}時間 ${pad(m % 60)}分`;
}

/** 実働分を計算（退勤 − 出勤 − 休憩）。どちらか欠けていれば null */
export function calcWorkMinutes(clockIn: Date | null, clockOut: Date | null, breakMinutes: number): number | null {
  if (!clockIn || !clockOut) return null;
  const total = Math.floor((clockOut.getTime() - clockIn.getTime()) / 60000) - (breakMinutes || 0);
  return Math.max(total, 0);
}

export const WEEKDAYS_JA = ["日", "月", "火", "水", "木", "金", "土"] as const;

/** YYYY-MM-DD → 曜日（土） */
export function weekdayJa(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  return WEEKDAYS_JA[d.getUTCDay()];
}

/** YYYY-MM の日数 */
export function daysInMonth(ym: string): number {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** 月の表示 2026-07 → 2026年7月 */
export function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${y}年${m}月`;
}
