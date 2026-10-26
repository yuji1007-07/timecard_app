// シートから読み取った行を、アプリのKPI項目に対応づける。
// シートは区分（【会員】【骨盤】…）ごとに同じ行名（月単価・総来院数・カルテ枚数 等）を
// 繰り返し、アプリ側も区分（カテゴリ）ごとに同じ名前の項目を持てる。
// 行名だけで探すと最初の1件が代表のKPIを取ってしまい、残りの区分の数値が取り込まれないため、
// 「区分つきの名前」「同じ区分にある同じ名前」を先に確定させ、表記ゆれの吸収はその後に回す。

export type MatchRow = { section: string | null; label: string };
export type MatchKpi = { id: string; name: string; category?: string | null };

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

/** シートの区分とアプリのカテゴリが同じものを指すか（会員 ↔ 会員数、新定額会員数 ↔ 新定額会員 など） */
export function sameSection(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const pb = new Set(sectionPrefixes(b));
  return sectionPrefixes(a).some((p) => pb.has(p));
}

export function matchRows<R extends MatchRow, K extends MatchKpi>(
  rows: R[],
  kpis: K[]
): { row: R; kpi: K | null }[] {
  const ks = kpis.map((k) => {
    const n = norm(k.name);
    return { k, n, loose: stripParen(n) };
  });
  const rs = rows.map((row) => {
    const L = norm(row.label);
    return { row, L, Ls: stripParen(L), prefixes: row.section ? sectionPrefixes(row.section) : [] };
  });

  // シートに出てくる区分。そのどれかに当たるカテゴリのKPIは、その区分の行のために取っておく
  // （【会員】に月単価の行がないのに【骨盤】の月単価が会員の月単価へ入る、といった混線を防ぐ）
  const sheetSections = [...new Set(rows.map((r) => r.section).filter((s): s is string => !!s))];
  const reservedFor = ks.map(({ k }) => sheetSections.filter((s) => sameSection(s, k.category)));
  const catOk = (ri: number, ki: number) => sameSection(rows[ri].section, kpis[ki].category);
  const freeFor = (ri: number, ki: number) => {
    const sec = rows[ri].section;
    const res = reservedFor[ki];
    return !sec || res.length === 0 || res.some((s) => sameSection(s, sec));
  };
  const withPrefix = (ri: number, ki: number, label: string) =>
    rs[ri].prefixes.some((p) => ks[ki].n === `${p}-${label}` || ks[ki].n === `${p}${label}`);

  // 確からしい順に並べた判定。上から順に全行へ当てはめていく
  const tiers: { onlyUnsectioned?: boolean; test: (ri: number, ki: number) => boolean }[] = [
    // 1. 区分つきの名前（【会員】カルテ枚数 → 会員-カルテ枚数 ／ 会員入会数）
    { test: (ri, ki) => withPrefix(ri, ki, rs[ri].L) },
    // 2. 同じ区分にある同じ名前（【骨盤】月単価 → 骨盤カテゴリの「月単価」）
    { test: (ri, ki) => ks[ki].n === rs[ri].L && catOk(ri, ki) },
    // 3. 区分つきの名前（行名の注記を外して）
    { test: (ri, ki) => withPrefix(ri, ki, rs[ri].Ls) },
    // 4. 同じ区分にある名前（行名の注記を外して）
    { test: (ri, ki) => ks[ki].n === rs[ri].Ls && catOk(ri, ki) },
    // 5. 名前が一字一句同じ。区分のない行（【KPI】直下の総来院数など）を先に見て、
    //    区分つきの行が代表のKPIを横取りしないようにする
    { onlyUnsectioned: true, test: (ri, ki) => ks[ki].n === rs[ri].L },
    { test: (ri, ki) => ks[ki].n === rs[ri].L && freeFor(ri, ki) },
    // 6. 行名の注記を外すと同じ
    { onlyUnsectioned: true, test: (ri, ki) => ks[ki].n === rs[ri].Ls },
    { test: (ri, ki) => ks[ki].n === rs[ri].Ls && freeFor(ri, ki) },
    // 7. 「新定額」→「新定額会員数」のような略記
    { test: (ri, ki) => ks[ki].n === `${rs[ri].L}会員数` && freeFor(ri, ki) },
    // 8. 同じ区分で、双方の注記を外すと同じ（月単価（P込）↔ 月単価(P) など）
    { test: (ri, ki) => ks[ki].loose === rs[ri].Ls && catOk(ri, ki) },
  ];

  const claimed = new Set<number>();
  const hits: (number | null)[] = rows.map(() => null);
  for (const tier of tiers) {
    // 同じ名前が複数あるときは、シートの上の行からアプリの並び順で前の項目に割り当てる
    // （区分が読み取れない画像でも、シートとアプリの並びが同じなら正しく対応する）
    for (let ri = 0; ri < rows.length; ri++) {
      if (hits[ri] != null) continue;
      if (tier.onlyUnsectioned && rows[ri].section) continue;
      for (let ki = 0; ki < kpis.length; ki++) {
        if (claimed.has(ki) || !tier.test(ri, ki)) continue;
        hits[ri] = ki;
        claimed.add(ki);
        break;
      }
    }
  }

  return rows.map((row, i) => ({ row, kpi: hits[i] != null ? kpis[hits[i]!] : null }));
}
