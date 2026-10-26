// シート画像を送る前にブラウザで整える。
// 読み取りAIは画像を「短い辺768px」程度まで縮小してから読むため、大きな表を1枚で送ると
// 小さな数字が潰れて読み違える。そこで
//   ・全体画像（列の並び・見出しの把握用。長辺2048pxに縮小）
//   ・上から帯状に切った拡大画像（数字を読む用。横長にして縮小されにくくする）
// を作って一緒に送る。ついでにJPEGへ変換して容量を抑える（サーバーの受け取り上限 約4.5MB）。

const OVERVIEW_MAX = 2048;
const STRIP_MAX_WIDTH = 2048;
const STRIP_ASPECT = 0.375; // 幅2048のとき高さ768＝縮小されないぎりぎりの帯
const STRIP_OVERLAP = 0.12; // 境目の行が欠けないよう帯どうしを重ねる割合
const MAX_STRIPS_TOTAL = 10;
const BYTE_BUDGET = 3.8 * 1024 * 1024;

export type PreparedImage = { overview: Blob; strips: Blob[] };

function canvasBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", quality));
}

async function render(
  bmp: ImageBitmap,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  scale: number,
  quality: number
): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sw * scale));
  canvas.height = Math.max(1, Math.round(sh * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#fff"; // 透過PNGの背景が黒くならないように
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvasBlob(canvas, quality);
}

/** 帯の切り出し位置（元画像の y 座標と高さ）を決める */
function stripRects(width: number, height: number, maxStrips: number): { y: number; h: number }[] {
  const scale = Math.min(1, STRIP_MAX_WIDTH / width);
  let h = (width * scale * STRIP_ASPECT) / scale;
  // 縦に長すぎて上限を超える場合は帯を高くして枚数を抑える
  const count = (hh: number) => Math.ceil((height - hh * STRIP_OVERLAP) / (hh * (1 - STRIP_OVERLAP)));
  if (count(h) > maxStrips) h = height / (maxStrips - (maxStrips - 1) * STRIP_OVERLAP);
  const out: { y: number; h: number }[] = [];
  for (let y = 0; y < height; y += h * (1 - STRIP_OVERLAP)) {
    const yy = Math.round(y);
    out.push({ y: yy, h: Math.min(Math.round(h), height - yy) });
    if (y + h >= height) break;
  }
  return out;
}

/**
 * 画像ファイル群を、全体画像＋拡大用の帯画像に変換する。
 * ブラウザが読めない形式（ChromeでのHEIC等）は null を返すので、元のファイルをそのまま送る。
 */
export async function prepareSheetImages(files: File[]): Promise<PreparedImage[] | null> {
  const bitmaps: ImageBitmap[] = [];
  try {
    for (const f of files) bitmaps.push(await createImageBitmap(f));
  } catch {
    bitmaps.forEach((b) => b.close());
    return null;
  }

  // 短い辺が小さい画像はそのままで縮小されないので帯は不要
  const needsStrips = bitmaps.map((b) => Math.min(b.width, b.height) > 800);
  const perImage = Math.max(2, Math.floor(MAX_STRIPS_TOTAL / Math.max(1, needsStrips.filter(Boolean).length)));

  const build = async (quality: number, withStrips: boolean): Promise<PreparedImage[] | null> => {
    const out: PreparedImage[] = [];
    for (let i = 0; i < bitmaps.length; i++) {
      const b = bitmaps[i];
      const overview = await render(b, 0, 0, b.width, b.height, Math.min(1, OVERVIEW_MAX / Math.max(b.width, b.height)), quality);
      if (!overview) return null;
      const strips: Blob[] = [];
      if (withStrips && needsStrips[i]) {
        const scale = Math.min(1, STRIP_MAX_WIDTH / b.width);
        const rects = stripRects(b.width, b.height, perImage);
        // 1枚で収まる（＝全体画像と同じ）なら拡大の意味がないので送らない
        for (const r of rects.length > 1 ? rects : []) {
          const s = await render(b, 0, r.y, b.width, r.h, scale, quality);
          if (s) strips.push(s);
        }
      }
      out.push({ overview, strips });
    }
    return out;
  };
  const size = (ps: PreparedImage[]) => ps.reduce((n, p) => n + p.overview.size + p.strips.reduce((m, s) => m + s.size, 0), 0);

  try {
    // 容量が上限を超える場合は画質を下げ、それでも超えるなら帯なし（全体画像のみ）で送る
    for (const [quality, withStrips] of [[0.88, true], [0.72, true], [0.8, false]] as const) {
      const prepared = await build(quality, withStrips);
      if (!prepared) return null;
      if (size(prepared) <= BYTE_BUDGET || !withStrips) return prepared;
    }
    return null;
  } finally {
    bitmaps.forEach((b) => b.close());
  }
}
