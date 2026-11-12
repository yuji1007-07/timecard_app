// 「実際に再生した区間」の計算。区間は [開始秒, 終了秒] の配列。

export type Segment = [number, number];

const round1 = (n: number) => Math.round(n * 10) / 10;

/** 不正な値を捨て、0〜duration に収める */
export function sanitizeSegments(input: unknown, duration: number): Segment[] {
  if (!Array.isArray(input)) return [];
  const out: Segment[] = [];
  for (const item of input.slice(0, 500)) {
    if (!Array.isArray(item) || item.length < 2) continue;
    const s = Number(item[0]);
    const e = Number(item[1]);
    if (!Number.isFinite(s) || !Number.isFinite(e)) continue;
    const start = Math.max(0, Math.min(duration, s));
    const end = Math.max(0, Math.min(duration, e));
    if (end - start <= 0) continue;
    out.push([round1(start), round1(end)]);
  }
  return out;
}

/** 重なり・隣接（0.5秒以内のすき間）をまとめる */
export function mergeSegments(segments: Segment[]): Segment[] {
  const sorted = [...segments].sort((a, b) => a[0] - b[0]);
  const out: Segment[] = [];
  for (const [s, e] of sorted) {
    const last = out[out.length - 1];
    if (last && s <= last[1] + 0.5) {
      if (e > last[1]) last[1] = e;
    } else {
      out.push([s, e]);
    }
  }
  return out;
}

/** 区間の合計秒数 */
export function totalSeconds(segments: Segment[]): number {
  return round1(segments.reduce((acc, [s, e]) => acc + (e - s), 0));
}
