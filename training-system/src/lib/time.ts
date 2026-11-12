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
  return { y: Number(map.year), m: Number(map.month), d: Number(map.day), hh: Number(map.hour) % 24, mm: Number(map.minute) };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** 日本時間の今日 YYYY-MM-DD */
export function todayJst(now: Date = new Date()): string {
  const p = jstParts(now);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}

/** 表示: 2026-07-18 09:59 */
export function fmtDateTime(date: Date | null | undefined): string {
  if (!date) return "-";
  const p = jstParts(date);
  return `${p.y}-${pad(p.m)}-${pad(p.d)} ${pad(p.hh)}:${pad(p.mm)}`;
}

/** 表示: 2026-07-18 */
export function fmtDate(date: Date | null | undefined): string {
  if (!date) return "-";
  return todayJst(date);
}

/** YYYY-MM-DD → 7/18（土） */
export function fmtDueDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  const [, m, d] = dateStr.split("-").map(Number);
  const wd = ["日", "月", "火", "水", "木", "金", "土"][new Date(`${dateStr}T12:00:00Z`).getUTCDay()];
  return `${m}/${d}（${wd}）`;
}

/** 期限まであと何日か（今日が期限なら 0、過ぎていれば負） */
export function daysUntil(dateStr: string, today: string = todayJst()): number {
  const a = new Date(`${today}T00:00:00Z`).getTime();
  const b = new Date(`${dateStr}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86400000);
}

/** 秒 → 3:25 形式 */
export function fmtDuration(sec: number | null | undefined): string {
  const s = Math.max(0, Math.floor(sec ?? 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(r)}` : `${m}:${pad(r)}`;
}

/** "5:15" / "1:02:03" / "315" → 秒。読めなければ null */
export function parseDuration(text: string | null | undefined): number | null {
  const t = (text ?? "").normalize("NFKC").trim();
  if (!t) return null;
  if (!/^\d+(:\d{1,2}){0,2}$/.test(t)) return null;
  const parts = t.split(":").map(Number);
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}
