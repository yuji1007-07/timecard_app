// あちこちで使う小さな便利関数（旧アプリ util.js と同じ挙動）

// HTMLに文字を埋め込むときの安全対策（タグとして解釈されないようにする）
export function esc(text: unknown): string {
  if (text === null || text === undefined) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// 改行を <br> に変換しつつ安全にHTML化する（規約文などの表示用）
export function nl2br(text: unknown): string {
  return esc(text).replace(/\n/g, "<br>");
}

// 今日の日付を YYYY-MM-DD 形式で返す（申込日の初期値などに使う。端末のローカル日付）
export function todayStr(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

// 日時を「2026/06/15 14:30」のような見やすい形にする（日本時間）
export function formatDateTime(iso: string | Date | null | undefined): string {
  if (!iso) return "";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return String(iso);
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}/${get("month")}/${get("day")} ${get("hour")}:${get("minute")}`;
}

// 日付(YYYY-MM-DD)を「2026年6月15日」表記にする（PDF用）
export function formatDateJa(ymd: string | null | undefined): string {
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-");
  if (!y || !m || !d) return ymd;
  return `${y}年${Number(m)}月${Number(d)}日`;
}
