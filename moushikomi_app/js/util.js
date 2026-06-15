// ============================================================
// util.js
// あちこちで使う小さな便利関数をまとめたファイルです。
// ============================================================

// HTMLに文字を埋め込むときの安全対策（タグとして解釈されないようにする）
export function esc(text) {
  if (text === null || text === undefined) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// 改行を <br> に変換しつつ安全にHTML化する（規約文などの表示用）
export function nl2br(text) {
  return esc(text).replace(/\n/g, "<br>");
}

// 今日の日付を YYYY-MM-DD 形式で返す（申込日の初期値などに使う）
export function todayStr() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

// ISO日時を「2026/06/15 14:30」のような見やすい形にする
export function formatDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// 日付(YYYY-MM-DD)を「2026年6月15日」表記にする（PDF用）
export function formatDateJa(ymd) {
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-");
  if (!y || !m || !d) return ymd;
  return `${y}年${Number(m)}月${Number(d)}日`;
}

// URLのハッシュ（#/form/abc）を画面遷移させるショートカット
export function go(path) {
  location.hash = path;
}
