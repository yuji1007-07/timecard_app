// 保存済みのKPI値（前回・先月・予測など）を、今のKPI項目に割り当てる。
// 同じ名前の項目が複数の区分にある（会員の月単価／骨盤の月単価 など）ため、名前で引くと
// 別の区分の値が入り込む。まずKPI項目IDで引き、IDが今の項目に見つからない値
// （テンプレートを作り直す前の旧データ、IDを持たない旧い予測）だけを名前で割り当てる。

type SavedValue = { kpiItemId: string | null; kpiName: string };
type Item = { id: string; name: string };

/** items の各項目ID → その項目の保存値。同じ名前が複数あるときは並び順どおり1件ずつ割り当てる */
export function assignSavedValues<V extends SavedValue>(items: Item[], saved: V[]): Map<string, V> {
  const out = new Map<string, V>();
  const ids = new Set(items.map((i) => i.id));
  for (const v of saved) {
    if (v.kpiItemId && ids.has(v.kpiItemId) && !out.has(v.kpiItemId)) out.set(v.kpiItemId, v);
  }
  const orphansByName = new Map<string, V[]>();
  for (const v of saved) {
    if (v.kpiItemId && ids.has(v.kpiItemId)) continue;
    const list = orphansByName.get(v.kpiName) ?? [];
    list.push(v);
    orphansByName.set(v.kpiName, list);
  }
  for (const it of items) {
    if (out.has(it.id)) continue;
    const v = orphansByName.get(it.name)?.shift();
    if (v) out.set(it.id, v);
  }
  return out;
}

/** 月ごとの予測を項目ID → 年月 → 値 に割り当てる（月ごとに assignSavedValues を適用） */
export function assignSavedProjections<V extends SavedValue & { targetMonth: string }>(
  items: Item[],
  saved: V[]
): Map<string, Map<string, V>> {
  const byMonth = new Map<string, V[]>();
  for (const p of saved) {
    const list = byMonth.get(p.targetMonth) ?? [];
    list.push(p);
    byMonth.set(p.targetMonth, list);
  }
  const out = new Map<string, Map<string, V>>();
  for (const [month, list] of byMonth) {
    for (const [id, v] of assignSavedValues(items, list)) {
      if (!out.has(id)) out.set(id, new Map());
      out.get(id)!.set(month, v);
    }
  }
  return out;
}
