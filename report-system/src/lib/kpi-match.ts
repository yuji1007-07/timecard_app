// シートから読み取った行を、アプリのKPI項目に対応づける。
// シートは区分（【会員】【骨盤】…）ごとに同じ行名（月単価・総来院数・カルテ枚数 等）を
// 繰り返すため、行名だけで探すと最初の1行が代表のKPIを取ってしまい、
// 残りの区分の数値が取り込まれなくなる。区分つきの名前を先に確定させて防ぐ。

export type MatchRow = { section: string | null; label: string };
export type MatchKpi = { id: string; name: string };

/** 表記ゆれの正規化：空白除去・注釈[1]除去・全角カッコ→半角 */
export const norm = (s: string) =>
  s.replace(/\s+/g, "").replace(/\[\d+\]/g, "").replace(/（/g, "(").replace(/）/g, ")");

/** 末尾の（…）注記を除去（例: 幽霊会員数（決済あり）→ 幽霊会員数） */
export const stripParen = (s: string) => s.replace(/\([^()]*\)$/, "");

/** セクション名からKPI接頭辞の候補を作る（例: 新定額会員数 → 新定額 / ダイエットコース → ダイエット） */
export function sectionPrefixes(section: string): string[] {
  const s = norm(section);
  const out = [s];
  for (const suf of ["会員数", "会員", "コース", "数"]) {
    if (s.endsWith(suf) && s.length > suf.length) out.push(s.slice(0, -suf.length));
  }
  return out;
}

export function matchRows<R extends MatchRow, K extends MatchKpi>(
  rows: R[],
  kpis: K[]
): { row: R; kpi: K | null }[] {
  const byNorm = new Map<string, K>();
  for (const k of kpis) if (!byNorm.has(norm(k.name))) byNorm.set(norm(k.name), k);

  // 区分つきの候補（会員-月単価）と、行名そのままの候補（月単価）を分けて持つ
  const sectioned = rows.map((row) => {
    if (!row.section) return [];
    const L = norm(row.label);
    const out: string[] = [];
    for (const p of sectionPrefixes(row.section)) {
      // 「会員-カルテ枚数」形式と「会員入会数」形式のどちらの命名にも対応する
      out.push(`${p}-${L}`, `${p}-${stripParen(L)}`, `${p}${L}`, `${p}${stripParen(L)}`);
    }
    return out;
  });
  const plain = rows.map((row) => {
    const L = norm(row.label);
    return [L, stripParen(L), `${L}会員数`];
  });

  const claimed = new Set<string>();
  const hits: (K | null)[] = rows.map(() => null);
  const take = (i: number, cands: string[]) => {
    if (hits[i]) return;
    for (const c of cands) {
      const k = byNorm.get(c);
      if (k && !claimed.has(k.id)) {
        hits[i] = k;
        claimed.add(k.id);
        return;
      }
    }
  };

  // 1周目: 区分つきの名前で確定させる。同じ行名が複数の区分に出ても各区分のKPIに入る
  rows.forEach((_, i) => take(i, sectioned[i]));
  // 2周目: 残りを行名そのままで拾う。区分のない行（【KPI】直下の総来院数など）を先に見て、
  //        区分つきの行が代表のKPIを横取りしないようにする
  rows.forEach((_, i) => { if (!rows[i].section) take(i, plain[i]); });
  rows.forEach((_, i) => take(i, plain[i]));

  return rows.map((row, i) => ({ row, kpi: hits[i] }));
}
