// スプレッドシートを印刷したPDFから、文字の座標情報を使って表（行×列）を復元する。
// 単純なテキスト抽出では列同士の数値がくっついてしまうため、
// pdf.js の getTextContent が返す各テキスト片の x/y/width から
// 「行 = y座標クラスタ」「列 = 数値の右端x座標クラスタ（表計算の数値は右揃え）」として再構成する。

export type ParsedColumn = { index: number; header: string; samples: string[] };
export type ParsedRow = { section: string | null; label: string; cells: Record<string, number> };
export type ParsedPdfTable = { columns: ParsedColumn[]; rows: ParsedRow[] };

type TextPiece = { str: string; x: number; y: number; w: number };

const ROW_TOL = 2.5; // 同じ行とみなす y 座標の許容差
const COL_TOL = 6; // 同じ列とみなす右端 x 座標の許容差
const VALUE_ZONE_MIN_X = 150; // これより右にある数値だけを「セル値」とみなす（左は項目名ゾーン）

const NUM_RE = /^[-−]?[¥￥]?[-−]?\d[\d,]*(?:\.\d+)?%?$/;

function isNumeric(s: string): boolean {
  return NUM_RE.test(s.trim());
}

function toNumber(s: string): number {
  const t = s.trim().replace(/[¥￥,%]/g, "").replace(/−/g, "-");
  return Number(t);
}

// ラベルが「AA」のように2回繰り返されて抽出されるケース（固定列の重複印字）を半分にする
function dedupeLabel(s: string): string {
  const t = s.trim();
  if (t.length >= 2 && t.length % 2 === 0) {
    const half = t.length / 2;
    if (t.slice(0, half) === t.slice(half)) return t.slice(0, half);
  }
  return t;
}

export async function parsePdfTable(buffer: Buffer): Promise<ParsedPdfTable> {
  // pdf-parse はパッケージ直下を import するとデバッグ用コードが走るため lib を直接読む
  const mod = await import("pdf-parse/lib/pdf-parse.js");
  const pdfParse = (mod as { default?: unknown }).default ?? mod;

  const pages: TextPiece[][] = [];
  const pagerender = (pageData: {
    getTextContent: (o: object) => Promise<{ items: { str: string; transform: number[]; width: number }[] }>;
  }) =>
    pageData
      .getTextContent({ normalizeWhitespace: true, disableCombineTextItems: false })
      .then((tc) => {
        pages.push(
          tc.items
            .filter((it) => it.str.trim() !== "")
            .map((it) => ({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width }))
        );
        return "";
      });

  await (pdfParse as (b: Buffer, o: object) => Promise<unknown>)(buffer, { pagerender });

  // ---- 数値セルの右端x座標を全ページ横断でクラスタリングして「列」を決める ----
  const edges: number[] = [];
  for (const items of pages) {
    for (const it of items) {
      if (it.x >= VALUE_ZONE_MIN_X && isNumeric(it.str)) edges.push(it.x + it.w);
    }
  }
  edges.sort((a, b) => a - b);
  const clusters: { center: number; count: number }[] = [];
  for (const e of edges) {
    const last = clusters[clusters.length - 1];
    if (last && e - last.center <= COL_TOL) {
      last.center = (last.center * last.count + e) / (last.count + 1);
      last.count++;
    } else {
      clusters.push({ center: e, count: 1 });
    }
  }
  // 同じ列でも桁数（3,300,000 と 24）で右端がずれると別クラスタに割れてしまう。
  // 実際の列は概ね等間隔なので、隣との間隔が「間隔の中央値の半分」に満たないものは同じ列として結合する。
  if (clusters.length > 2) {
    for (let pass = 0; pass < 3; pass++) {
      const gaps = clusters.slice(1).map((c, i) => c.center - clusters[i].center);
      const sortedGaps = [...gaps].sort((a, b) => a - b);
      const median = sortedGaps[Math.floor(sortedGaps.length / 2)];
      if (!median || median <= 0) break;
      const merged: typeof clusters = [];
      let changed = false;
      for (const c of clusters) {
        const last = merged[merged.length - 1];
        if (last && c.center - last.center < median * 0.5) {
          last.center = (last.center * last.count + c.center * c.count) / (last.count + c.count);
          last.count += c.count;
          changed = true;
        } else {
          merged.push({ ...c });
        }
      }
      clusters.length = 0;
      clusters.push(...merged);
      if (!changed) break;
    }
  }

  const colCenters = clusters.map((c) => c.center);
  // 結合後は列幅が広がるので、値の割り当て許容差も列間隔に合わせて広げる
  const colSpan =
    colCenters.length > 1
      ? Math.max(COL_TOL, Math.min(...colCenters.slice(1).map((c, i) => c - colCenters[i])) * 0.6)
      : COL_TOL * 1.5;
  const colIndexOf = (rightEdge: number): number => {
    let best = -1;
    let bestDist = Infinity;
    colCenters.forEach((c, i) => {
      const d = Math.abs(c - rightEdge);
      if (d < bestDist) { bestDist = d; best = i; }
    });
    return bestDist <= colSpan ? best : -1;
  };
  // 数値ゾーンの開始x（ラベルとの境界）
  let valueZoneStart = VALUE_ZONE_MIN_X;
  {
    let minX = Infinity;
    for (const items of pages) {
      for (const it of items) {
        if (it.x >= VALUE_ZONE_MIN_X && isNumeric(it.str)) minX = Math.min(minX, it.x);
      }
    }
    if (minX < Infinity) valueZoneStart = minX - 2;
  }

  // 見出し文字は「どの列に属するか」を行の解析が終わってから決める（空の列を除いてから判定するため）
  const headerItems: { str: string; x: number; w: number }[] = [];
  const rowsOut: ParsedRow[] = [];
  const rowKeyIndex = new Map<string, number>();

  for (const items of pages) {
    // 行クラスタリング（yが近いものをまとめ、上から下へ）
    const rowGroups: { y: number; items: TextPiece[] }[] = [];
    for (const it of items) {
      let g = rowGroups.find((r) => Math.abs(r.y - it.y) < ROW_TOL);
      if (!g) { g = { y: it.y, items: [] }; rowGroups.push(g); }
      g.items.push(it);
    }
    rowGroups.sort((a, b) => b.y - a.y);

    let section: string | null = null;
    for (const g of rowGroups) {
      const sorted = g.items.sort((a, b) => a.x - b.x);
      const labelItems = sorted.filter((it) => it.x < valueZoneStart);
      const valueItems = sorted.filter((it) => it.x >= valueZoneStart);
      const numericItems = valueItems.filter((it) => isNumeric(it.str));
      const textItems = valueItems.filter((it) => !isNumeric(it.str));

      // ヘッダー行（列見出し）: 数値より文字が多い行。列名の材料として回収する
      if (textItems.length > numericItems.length) {
        for (const it of valueItems) headerItems.push({ str: it.str.trim(), x: it.x, w: it.w });
        continue;
      }

      const label = dedupeLabel(labelItems.map((it) => it.str).join(""));
      if (!label) continue;

      // セクション見出し（【…】）: 以降の行の文脈として記録しつつ、行自体も残す
      const secMatch = label.match(/^【(.+)】$/);
      if (secMatch) section = secMatch[1].trim();
      const rowLabel = secMatch ? secMatch[1].trim() : label;

      const cells: Record<string, number> = {};
      for (const it of numericItems) {
        const ci = colIndexOf(it.x + it.w);
        if (ci >= 0) {
          const v = toNumber(it.str);
          if (Number.isFinite(v)) cells[String(ci)] = v;
        }
      }
      if (Object.keys(cells).length === 0) continue;

      // 複数ページに同じ行が出た場合はセル数が多い方を残す
      const key = `${section ?? ""}|${rowLabel}`;
      const existing = rowKeyIndex.get(key);
      if (existing != null) {
        if (Object.keys(cells).length > Object.keys(rowsOut[existing].cells).length) {
          rowsOut[existing] = { section, label: rowLabel, cells };
        }
      } else {
        rowKeyIndex.set(key, rowsOut.length);
        rowsOut.push({ section, label: rowLabel, cells });
      }
    }
  }

  // 値が1つも入らなかった列を捨てる。
  // 見出し行の数字などから空のクラスタができると、その分だけ見出しが1列ずれてしまうため。
  const used = new Set<number>();
  for (const r of rowsOut) for (const ci of Object.keys(r.cells)) used.add(Number(ci));
  const keep = colCenters.map((_, i) => i).filter((i) => used.has(i));
  const remap = new Map(keep.map((oldIdx, newIdx) => [oldIdx, newIdx]));
  if (keep.length < colCenters.length) {
    for (const r of rowsOut) {
      const next: Record<string, number> = {};
      for (const [ci, v] of Object.entries(r.cells)) {
        const ni = remap.get(Number(ci));
        if (ni != null) next[String(ni)] = v;
      }
      r.cells = next;
    }
  }

  // 列ごとのサンプル値（プレビュー用）
  const samples: string[][] = keep.map(() => []);
  for (const r of rowsOut) {
    for (const [ci, v] of Object.entries(r.cells)) {
      const arr = samples[Number(ci)];
      if (arr && arr.length < 3) arr.push(v.toLocaleString());
    }
  }

  // 見出しの割り当て。数値は右揃え・見出しは中央寄せなので、
  // 「列が占める帯（前の列の右端〜自分の右端）の中心」に一番近い見出し文字をその列のものとする。
  // 左端や最近傍の右端で判定すると、見出しが隣の列にずれてしまう。
  const kept = keep.map((i) => colCenters[i]);
  const bandCenters = kept.map((right, i) => {
    const left = i === 0 ? Math.min(valueZoneStart, right - (kept[1] ?? right) + right) : kept[i - 1];
    return (left + right) / 2;
  });
  const headerParts: string[][] = kept.map(() => []);
  for (const it of headerItems) {
    const center = it.x + it.w / 2;
    let best = 0;
    let bestDist = Infinity;
    bandCenters.forEach((bc, i) => {
      const d = Math.abs(center - bc);
      if (d < bestDist) { bestDist = d; best = i; }
    });
    headerParts[best].push(it.str);
  }

  const columns: ParsedColumn[] = kept.map((_, i) => ({
    index: i,
    header: [...new Set(headerParts[i])].join(" ").trim(),
    samples: samples[i],
  }));

  return { columns, rows: rowsOut };
}
