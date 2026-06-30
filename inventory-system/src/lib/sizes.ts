// 商品名からサイズ（S/M/L/LL など、足サイズ）を検出するユーティリティ。
// メンズ/ウィメンズ/ユニセックスは「性別」であってサイズではないので分離しない。

// サイズとして扱うトークン（単独で出現したときだけ）
const SIZE_TOKENS = new Set([
  "XS", "SS", "S", "M", "L", "LL", "XL", "XXL", "2L", "3L", "4L", "F", "FREE", "フリー",
]);

// 足サイズ等のパターン（例: 22-24cm / 25cm / 23.5）
const FOOT_RE = /^\d{2}(\.\d)?(-\d{2}(\.\d)?)?(cm|㎝|CM)?$/;

function isSizeToken(t: string): boolean {
  const u = t.toUpperCase();
  if (SIZE_TOKENS.has(u)) return true;
  if (FOOT_RE.test(t)) return true;
  return false;
}

/**
 * 商品名からサイズを切り出す。
 * 例: "ReD ... 肩コリ改善 S メンズ" -> { base: "ReD ... 肩コリ改善 メンズ", size: "S" }
 *     "... (Long) S"               -> { base: "... (Long)", size: "S" }
 *     "プロラボ サプリ"             -> { base: "プロラボ サプリ", size: null }
 * サイズらしきトークンが無ければ size=null（名前はそのまま）。
 */
export function splitSize(name: string): { base: string; size: string | null } {
  const tokens = name.split(/\s+/).filter(Boolean);
  // 末尾側から最初に見つかったサイズトークンを1つだけ取り出す（性別の手前に来ることが多い）
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (isSizeToken(tokens[i])) {
      const size = tokens[i].toUpperCase() === tokens[i] ? tokens[i] : tokens[i];
      const base = [...tokens.slice(0, i), ...tokens.slice(i + 1)].join(" ");
      return { base: base.trim(), size };
    }
  }
  return { base: name.trim(), size: null };
}
