/**
 * 「デッドライン割れ時のアクションプラン」の保存・読み出し。
 *
 * 通常のアクションプランが「予算達成・さらに伸ばすための施策」なのに対し、
 * こちらは「最低ライン（デッドライン）を下回ってしまった時に何をするか」を先に決めておくもの。
 * 対象は 初診数 / 成約数 / 成約率 のような新規獲得系の指標を想定している。
 *
 * 保存先は Report.dataIssues（A：改善 の本文）。見出し行で区切って同じ列に埋め込むため、
 * DBのカラムを増やさずに済む（＝既存環境にそのままデプロイできる）。
 */

export type DeadlineEntry = {
  kpi: string; // 対象項目（KPI名）
  threshold: string; // デッドライン値（この値を下回ったら発動）
  actions: string[]; // 下回った際に行うこと（3つ程度）
};

/** dataIssues 内で通常の課題ブロックとデッドラインブロックを分ける見出し */
export const DEADLINE_HEADING = "── デッドライン割れ時のアクション ──";

export const emptyDeadline = (kpi = ""): DeadlineEntry => ({ kpi, threshold: "", actions: ["", "", ""] });

/** 入力欄を常に最低 n 個確保する（表示用） */
export function padActions(actions: string[], n = 3): string[] {
  return actions.length >= n ? actions : [...actions, ...Array(n - actions.length).fill("")];
}

function hasContent(e: DeadlineEntry): boolean {
  return !!e.kpi && (e.threshold.trim() !== "" || e.actions.some((a) => a.trim() !== ""));
}

export function serializeDeadlines(entries: DeadlineEntry[]): string {
  const rows = entries.filter(hasContent).map((e) => {
    const head = `【${e.kpi}】デッドライン ${e.threshold.trim() || "-"} を下回ったら`;
    const acts = e.actions.filter((a) => a.trim()).map((a, i) => `→ ${i + 1}. ${a.trim()}`);
    return [head, ...acts].join("\n");
  });
  return rows.length ? `${DEADLINE_HEADING}\n${rows.join("\n")}` : "";
}

/** 課題ブロックのテキストとデッドラインを1つの dataIssues 文字列にまとめる */
export function joinDataIssues(issuesText: string, deadlines: DeadlineEntry[]): string {
  return [issuesText.trim(), serializeDeadlines(deadlines)].filter(Boolean).join("\n");
}

/** 保存済み dataIssues を「通常の課題ブロック」と「デッドライン」に分解する */
export function splitDataIssues(text: string | null | undefined): { issues: string; deadlines: DeadlineEntry[] } {
  if (!text) return { issues: "", deadlines: [] };
  const at = text.indexOf(DEADLINE_HEADING);
  if (at < 0) return { issues: text, deadlines: [] };

  const issues = text.slice(0, at).trimEnd();
  const out: DeadlineEntry[] = [];
  for (const raw of text.slice(at + DEADLINE_HEADING.length).split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const head = /^【(.+?)】デッドライン\s*(.*?)\s*を下回ったら$/.exec(line);
    if (head) {
      out.push({ kpi: head[1], threshold: head[2] === "-" ? "" : head[2], actions: [] });
      continue;
    }
    const act = /^→\s*\d+\.\s*(.*)$/.exec(line);
    if (act && out.length > 0) out[out.length - 1].actions.push(act[1]);
  }
  return { issues, deadlines: out };
}

// 重点を置く指標。店舗ごとに名称がゆれる（初診数/新規数、成約数/契約数…）ので候補で吸収する。
const FOCUS_CANDIDATES: string[][] = [
  ["初診数", "新規数", "新規来院数"],
  ["成約数", "契約数"],
  ["成約率", "契約率"],
];

/** その店舗のKPI一覧から、デッドラインを設定したい既定の3項目を拾う */
export function defaultDeadlineKpis(kpiNames: string[]): string[] {
  return FOCUS_CANDIDATES.map((cands) => cands.find((c) => kpiNames.includes(c))).filter((n): n is string => !!n);
}
