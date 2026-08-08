"use client";

// スプレッドシートを印刷したPDFをアップロードして、KPIの数値を自動入力するカード。
// スタッフの操作は最小限：アップロード →（週次のみ「今週の列」を1タップ）→ 内容確認 → 反映。
// 列の割り当てはシートの運用（当月列=予算/目標、月末列=実績/着地予測、翌月以降=着地予想）に
// 合わせて自動で行い、手動調整は「上級者向け」に畳んで隠す。

import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { monthShort } from "@/lib/utils";
import type { KpiItemDef } from "./report-form";

type PdfCol = { index: number; header: string; samples: string[] };
type PdfRow = { section: string | null; label: string; cells: Record<string, number> };

export type PdfKpiUpdates = Record<string, { target?: string; current?: string; forecast?: string }>; // kpiItemId ->
export type PdfProjUpdates = Record<string, Record<string, { budget?: string; forecast?: string }>>; // kpiName -> month ->

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-background px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

// 表記ゆれの正規化：空白除去・注釈[1]除去・全角カッコ→半角
const norm = (s: string) =>
  s.replace(/\s+/g, "").replace(/\[\d+\]/g, "").replace(/（/g, "(").replace(/）/g, ")");
// 末尾の（…）注記を除去（例: 幽霊会員数（決済あり）→ 幽霊会員数）
const stripParen = (s: string) => s.replace(/\([^()]*\)$/, "");

// セクション名からKPI接頭辞の候補を作る（例: 新定額会員数 → 新定額 / ダイエットコース → ダイエット）
function sectionPrefixes(section: string): string[] {
  const s = norm(section);
  const out = [s];
  for (const suf of ["会員数", "会員", "コース", "数"]) {
    if (s.endsWith(suf) && s.length > suf.length) out.push(s.slice(0, -suf.length));
  }
  return out;
}

function matchRows(rows: PdfRow[], kpis: KpiItemDef[]): { row: PdfRow; kpi: KpiItemDef | null }[] {
  const byNorm = new Map<string, KpiItemDef>();
  for (const k of kpis) if (!byNorm.has(norm(k.name))) byNorm.set(norm(k.name), k);
  const claimed = new Set<string>();
  return rows.map((row) => {
    const L = norm(row.label);
    const cands: string[] = [L, stripParen(L), `${L}会員数`];
    if (row.section) {
      for (const p of sectionPrefixes(row.section)) cands.push(`${p}-${L}`, `${p}-${stripParen(L)}`);
    }
    let hit: KpiItemDef | null = null;
    for (const c of cands) {
      const k = byNorm.get(c);
      if (k && !claimed.has(k.id)) { hit = k; break; }
    }
    if (hit) claimed.add(hit.id);
    return { row, kpi: hit };
  });
}

// 列見出しから取り込み先を推測。
// シートの運用: 「月末」列は週次では着地予想、月次では確定した実績が入る。
// 「7月」など当月の列は前月に立てた予測＝予算（週次では目標）、翌月以降は着地予想。
// 「8月予算」「9月着地」のように月＋種別が書かれている列は、その種別に振り分ける。
function guessRole(header: string, isMonthly: boolean, curMonthNum: number, forwardMonths: string[]): string {
  const h = norm(header);
  // 「差異」列は予算と実績の差分なので、どの欄にも取り込まない
  if (/差異|差分/.test(h)) return "";
  const isForecast = /着地|予測|見込/.test(h);
  const hasMonth = (n: number) => new RegExp(`(?:^|[^0-9])${n}月`).test(h);

  if (isMonthly) {
    // 翌月以降の月が書かれている列は、3ヶ月予測（②-2）に振り分ける
    for (const m of forwardMonths) {
      if (hasMonth(Number(m.slice(5, 7)))) return isForecast ? `pf:${m}` : `pb:${m}`;
    }
    if (h.includes("月末")) return "current";
    if (curMonthNum > 0 && hasMonth(curMonthNum)) return isForecast ? "forecast" : "target";
    return "";
  }

  // 週次: 月末列は着地予測、対象月の列はその月の目標。週の列（~7日 等）は下で別途割り当てる。
  if (h.includes("月末")) return "forecast";
  if (/~\d+日?/.test(h)) return "";
  if (/予算|目標/.test(h)) return "target";
  if (curMonthNum > 0 && hasMonth(curMonthNum)) return "target";
  return "";
}

// 見出しの表示用。結合セルの影響で隣の値やエラー文字（#DIV/0! 等）が混ざるので、
// ノイズを落として読みやすくする。何も残らない場合は列の位置で示す。
function headerLabel(c: PdfCol): string {
  const h = c.header
    .replace(/#(DIV\/0!|REF!|VALUE!|N\/A|NAME\?|NULL!|NUM!)/g, "") // 表計算のエラー表示
    .replace(/[\d,]{3,}/g, "") // 隣のセルから紛れ込んだ数値
    .replace(/\s+/g, "")
    .replace(/^[①-⑳*※・\-]+/, "")
    .replace(/^日/, "") // 「~14日」の日が隣の列にずれて先頭に付くことがある
    .trim();
  if (!h) return `左から${c.index + 1}列目`;
  return h.length > 12 ? `${h.slice(0, 12)}…` : h;
}

export function PdfImportCard({
  kpis,
  reportType,
  period,
  forwardMonths,
  baseYear,
  onApply,
}: {
  kpis: KpiItemDef[];
  reportType: "WEEKLY" | "MONTHLY";
  period: string; // 月次: YYYY-MM ／ 週次: YYYY-Wnn
  forwardMonths: string[];
  baseYear: number;
  onApply: (kpiUpdates: PdfKpiUpdates, projUpdates: PdfProjUpdates) => void;
}) {
  const isMonthly = reportType === "MONTHLY";
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{ columns: PdfCol[]; rows: PdfRow[] } | null>(null);
  const [colMap, setColMap] = useState<Record<string, string>>({});
  const [applied, setApplied] = useState<number | null>(null);
  const [showUnmatched, setShowUnmatched] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const matched = useMemo(() => (data ? matchRows(data.rows, kpis) : []), [data, kpis]);
  const matchedCount = matched.filter((m) => m.kpi).length;
  const unmatched = matched.filter((m) => !m.kpi);
  // 月次は対象月から、週次は今日の日付から「当月」を推定（目標/予算列の自動判定に使う）
  const curMonthNum = Number(period.slice(5, 7)) || 0; // 週次 2026-08-W2 / 月次 2026-08 のどちらも先頭7文字が年月
  const curLabel = isMonthly ? (/^\d{4}-\d{2}$/.test(period) ? monthShort(period, baseYear) : "当月") : "今週";

  async function handleFiles(fs: File[]) {
    setError(null);
    setApplied(null);
    setData(null);
    setShowAdvanced(false);
    if (fs.length === 0) return;
    if (fs.some((f) => f.size > 10 * 1024 * 1024)) {
      setError("ファイルが大きすぎます（1件10MBまで）。");
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      for (const f of fs) fd.append("file", f);
      const res = await fetch("/api/parse-report-pdf", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error || "ファイルの解析に失敗しました。");
        return;
      }
      const cols: PdfCol[] = json.columns;
      const rows: PdfRow[] = json.rows;
      setData({ columns: cols, rows });
      // 列の取り込み先を自動判定（下の「上級者向け」で変更可能）
      const init: Record<string, string> = {};
      for (const c of cols) {
        const g = guessRole(c.header, isMonthly, curMonthNum, forwardMonths);
        if (g) init[String(c.index)] = g;
      }

      // 週次: 対象週に対応する列（第1週→~7日、第2週→~14日…）を「現状」に自動で割り当てる
      if (!isMonthly) {
        const wn = Number((/-W([1-5])$/.exec(period) ?? [])[1] ?? 0);
        if (wn >= 1 && wn <= 4 && !Object.values(init).includes("current")) {
          const want = new RegExp(`~${wn * 7}日?`);
          const col = cols.find((c) => want.test(norm(c.header)));
          if (col) init[String(col.index)] = "current";
        }
      }

      // 月次シートは見出しが結合セルで崩れやすく、月の判定に失敗することがある。
      // その場合は並び順で補う：[当月予算][当月実績][差異][翌月][翌々月][3ヶ月後] という構成が多いので、
      // 「数値が入っている列の右から3つ」を翌月以降に、左の2つを当月の予算・実績に割り当てる。
      if (isMonthly && forwardMonths.length > 0 && !Object.values(init).some((r) => r.startsWith("pb:") || r.startsWith("pf:"))) {
        const withData = cols.filter((c) => rows.some((r) => r.cells[String(c.index)] != null));
        if (withData.length >= forwardMonths.length) {
          const tail = withData.slice(-forwardMonths.length);
          forwardMonths.forEach((m, i) => { init[String(tail[i].index)] = `pb:${m}`; });
          const head = withData.slice(0, withData.length - forwardMonths.length);
          if (head.length >= 2) {
            if (!Object.values(init).includes("target")) init[String(head[0].index)] = "target";
            if (!Object.values(init).includes("current")) init[String(head[1].index)] = "current";
          }
        }
      }
      setColMap(init);
    } catch {
      setError("通信に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setBusy(false);
    }
  }

  const currentWeekColIndex = Object.entries(colMap).find(([, r]) => r === "current")?.[0] ?? null;

  // 月次: 「当月の予算/実績」＋「来月以降3ヶ月の予算/着地予想」の割り当て先スロット
  const monthSlots = useMemo(() => {
    if (!isMonthly) {
      // 週次も同じ「行ごとに列をタップ」方式にする（見出しが崩れても数値で選べる）
      return [
        { role: "target", label: "目標（月の目標）" },
        { role: "current", label: "現状（今週まで）" },
        { role: "forecast", label: "着地予測（月末見込み）" },
      ];
    }
    const slots = [
      { role: "target", label: `${curLabel}（当月）の予算` },
      { role: "current", label: `${curLabel}（当月）の実績` },
    ];
    // シートは月ごとに1列なので、来月以降は月ごとに1スロット。
    // 予算／予測の振り分けは列ではなく「行」で決まる（シートの【予算】行と実績（予測）行）。
    for (const m of forwardMonths) {
      slots.push({ role: `pb:${m}`, label: `${monthShort(m, baseYear)} の列` });
    }
    return slots;
  }, [isMonthly, curLabel, forwardMonths, baseYear]);

  // 列選択の目印にする行。「見出しが崩れていても数値を見れば分かる」ように、
  // 値が一番多く入っている（＝どの列にも数字がある）行を代表として使う。
  const sampleRow = useMemo(() => {
    if (!data) return null;
    let best: PdfRow | null = null;
    for (const r of data.rows) {
      if (!best || Object.keys(r.cells).length > Object.keys(best.cells).length) best = r;
    }
    return best;
  }, [data]);
  const sampleRowLabel = sampleRow ? `「${sampleRow.label}」` : null;

  // シートの「【予算】」行（事前に決めた数値）と、それに対応する売上ラインKPI。
  // この2つが揃っている時だけ、予算行→予算 / 実績（予測）行→予測 に振り分ける。
  const budgetRow = useMemo(
    () => data?.rows.find((r) => /^(予算|予算合計|売上予算)$/.test(norm(r.label))) ?? null,
    [data]
  );
  const revenueKpi = useMemo(
    () => kpis.find((k) => ["実績(予測)", "予測着地", "実績予測"].includes(norm(k.name))) ?? null,
    [kpis]
  );

  const colOfRole = (role: string) => Object.entries(colMap).find(([, r]) => r === role)?.[0] ?? null;

  // 1つの列は1つの役割にしか割り当てない（付け替えたら元の割り当ては外す）
  function assignRole(role: string, index: number | null) {
    setColMap((m) => {
      const next = { ...m };
      for (const [ci, r] of Object.entries(next)) {
        if (r === role) delete next[ci];
      }
      if (index != null) next[String(index)] = role;
      return next;
    });
    setApplied(null);
  }

  function apply() {
    const kpiUpd: PdfKpiUpdates = {};
    const projUpd: PdfProjUpdates = {};
    let n = 0;
    // シートは「【予算】＝事前に決めた数値」と「実績（予測）＝現実的に届く数値」が別の行になっている。
    // 予算行は同じ売上ラインKPIの“予算”側、実績（予測）行は“予測”側に入れる。
    // 行が1本しかないKPIは、その月の予算・予測の両方に同じ数値を入れる。
    const targets: { row: PdfRow; kpi: KpiItemDef; fill: "both" | "budget" | "forecast" }[] = [];
    for (const { row, kpi } of matched) {
      if (kpi) targets.push({ row, kpi, fill: kpi.id === revenueKpi?.id && budgetRow ? "forecast" : "both" });
      else if (revenueKpi && row === budgetRow) targets.push({ row, kpi: revenueKpi, fill: "budget" });
    }

    for (const { row, kpi, fill } of targets) {
      for (const [ci, role] of Object.entries(colMap)) {
        if (!role) continue;
        const v = row.cells[ci];
        if (v == null) continue;
        const s = String(v);
        if (role === "current") {
          if (!kpi.hasCurrent || fill === "budget") continue;
          (kpiUpd[kpi.id] ??= {}).current = s;
          n++;
        } else if (role === "target") {
          if (!kpi.hasTarget || fill === "forecast") continue;
          (kpiUpd[kpi.id] ??= {}).target = s;
          n++;
        } else if (role === "forecast") {
          if (!kpi.hasForecast || fill === "budget") continue;
          (kpiUpd[kpi.id] ??= {}).forecast = s;
          n++;
        } else if (role.startsWith("pb:") || role.startsWith("pf:")) {
          const m = role.slice(3);
          if (!forwardMonths.includes(m)) continue;
          const slot = ((projUpd[kpi.name] ??= {})[m] ??= {});
          if (fill !== "forecast") slot.budget = s;
          if (fill !== "budget") slot.forecast = s;
          n++;
        }
      }
    }
    onApply(kpiUpd, projUpd);
    setApplied(n);
  }

  const roleLabel = (role: string) => {
    if (role === "current") return isMonthly ? `実績（${curLabel}）` : "現状（今週）";
    if (role === "target") return isMonthly ? `予算（${curLabel}）` : "目標";
    if (role === "forecast") return "着地予測";
    const m = role.slice(3);
    const ml = /^\d{4}-\d{2}$/.test(m) ? monthShort(m, baseYear) : m;
    return role.startsWith("pb:") ? `${ml}の予算` : `${ml}の予測`;
  };
  const roleOrder = (role: string) => (role === "target" ? 0 : role === "current" ? 1 : role === "forecast" ? 2 : 10);

  const activeCols = data
    ? data.columns
        .filter((c) => colMap[String(c.index)])
        .sort((a, b) => roleOrder(colMap[String(a.index)]) - roleOrder(colMap[String(b.index)]) || a.index - b.index)
    : [];
  // プレビューは値が1つもない行を省く（見やすさ優先）
  const previewRows = matched.filter(
    ({ row, kpi }) => kpi && activeCols.some((c) => row.cells[String(c.index)] != null)
  );
  const needsWeekPick = !isMonthly && currentWeekColIndex == null;

  return (
    <Card className="border-dashed border-navy/40">
      <CardHeader>
        <CardTitle>📄 いつものシート（PDF・画像）から自動入力</CardTitle>
        <div className="text-sm text-muted-foreground">
          手入力しなくても、いつものスプレッドシートから数値を取り込めます。
          <ol className="mt-1 list-decimal space-y-0.5 pl-5">
            <li>スプレッドシートをPDFで保存（ファイル → ダウンロード → PDF）、または画面のスクリーンショットを撮る</li>
            <li>下の「ファイルを選択」でそのPDF／画像を選ぶ（画像は複数枚まとめて選べます）</li>
            {!isMonthly && <li>「今週の数字はどの列？」で今週の列をタップ</li>}
            {isMonthly && <li>「どの列がどの月？」で当月と来月以降3ヶ月ぶんの列をタップ</li>}
            <li>内容を確認して「反映する」を押す → あとは数値をチェックして提出するだけ</li>
          </ol>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,application/pdf,image/*"
            multiple
            className="text-sm"
            disabled={busy}
            onChange={(e) => handleFiles(Array.from(e.target.files ?? []))}
          />
          {busy && <span className="text-sm text-muted-foreground">読み取り中...（画像は少し時間がかかります）</span>}
        </div>
        {error && <p className="text-sm font-medium text-red-600">{error}</p>}

        {data && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="good">✅ {matchedCount}項目を読み取りました</Badge>
              {unmatched.length > 0 && (
                <button type="button" className="text-xs text-muted-foreground underline" onClick={() => setShowUnmatched((v) => !v)}>
                  読み取れなかった行 {unmatched.length}件 {showUnmatched ? "を隠す" : ""}
                </button>
              )}
            </div>
            {showUnmatched && unmatched.length > 0 && (
              <p className="rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
                {unmatched.map((m) => m.row.label).join(" ／ ")}
                <span className="mt-1 block">※ 集計行など、アプリのKPIにない項目はスキップされます（問題ありません）。</span>
              </p>
            )}

            {/* 当月・週の列を割り当てる（見出しが崩れても数値で選べるようにする） */}
            {data.columns.length > 0 && (
              <div className="space-y-3 rounded-lg border-2 border-navy/20 bg-navy/5 p-3">
                <div>
                  <p className="text-sm font-bold">
                    {isMonthly ? "👉 どの列がどの月？" : "👉 どの列が今週の数字？"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    シートの見出しは崩れて読み取られることがあります。かっこ内の数値（{sampleRowLabel ?? "先頭の項目"}の値）を見て選んでください。
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {monthSlots.map((slot) => {
                    const picked = colOfRole(slot.role);
                    return (
                      <label key={slot.role} className="space-y-1 rounded-md bg-background p-2 shadow-sm">
                        <span className="block text-xs font-medium">{slot.label}</span>
                        <select
                          className={selectClass}
                          value={picked ?? ""}
                          onChange={(e) => assignRole(slot.role, e.target.value === "" ? null : Number(e.target.value))}
                        >
                          <option value="">使わない</option>
                          {data.columns.map((c) => {
                            const sample = sampleRow?.cells[String(c.index)];
                            return (
                              <option key={c.index} value={c.index}>
                                {headerLabel(c)}（{sample != null ? sample.toLocaleString() : "空"}）
                              </option>
                            );
                          })}
                        </select>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* この内容で取り込みます（自動判定の結果） */}
            {activeCols.length > 0 && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-xs font-bold text-emerald-900">この内容で取り込みます（自動判定）:</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {activeCols.map((c) => (
                    <span key={c.index} className="rounded-md bg-white px-2 py-1 text-xs shadow-sm ring-1 ring-emerald-200">
                      <span className="font-bold text-emerald-800">{roleLabel(colMap[String(c.index)])}</span>
                      <span className="text-muted-foreground"> ← シートの「{headerLabel(c)}」列</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* プレビュー（取り込む数値の確認） */}
            {activeCols.length > 0 && previewRows.length > 0 && (
              <div className="max-h-72 overflow-auto rounded-md border">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-medium">項目</th>
                      {activeCols.map((c) => (
                        <th key={c.index} className="px-2 py-1.5 text-right font-medium">{roleLabel(colMap[String(c.index)])}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map(({ row, kpi }) => (
                      <tr key={`${row.section}|${row.label}`} className="border-t">
                        <td className="px-2 py-1 font-medium">{kpi!.name}</td>
                        {activeCols.map((c) => (
                          <td key={c.index} className="px-2 py-1 text-right tabular-nums">
                            {row.cells[String(c.index)] != null ? row.cells[String(c.index)].toLocaleString() : "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {needsWeekPick && (
              <p className="text-sm font-medium text-amber-700">↑ 先に「現状（今週まで）」の列を選ぶと反映できるようになります。</p>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" size="lg" onClick={apply} disabled={activeCols.length === 0 || matchedCount === 0 || needsWeekPick}>
                ✅ この数値をフォームに反映する
              </Button>
              {applied != null && (
                <span className="text-sm font-medium text-emerald-700">
                  {applied}件を反映しました。下のKPI欄を確認してください。
                </span>
              )}
            </div>

            {/* 上級者向け: 列の割り当てを手動調整 */}
            <div>
              <button type="button" className="text-xs text-muted-foreground underline" onClick={() => setShowAdvanced((v) => !v)}>
                {showAdvanced ? "手動調整を閉じる" : "うまく取り込めないとき（列の割り当てを手動で調整）"}
              </button>
              {showAdvanced && (
                <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {data.columns.map((c) => (
                    <div key={c.index} className="rounded-md border p-2">
                      <div className="truncate text-xs font-medium" title={c.header || `列${c.index + 1}`}>
                        {headerLabel(c)}
                      </div>
                      <div className="truncate text-[11px] text-muted-foreground">例: {c.samples.join(", ") || "—"}</div>
                      <select
                        className={`${selectClass} mt-1`}
                        value={colMap[String(c.index)] ?? ""}
                        onChange={(e) => {
                          setColMap((m) => ({ ...m, [String(c.index)]: e.target.value }));
                          setApplied(null);
                        }}
                      >
                        <option value="">取り込まない</option>
                        {isMonthly ? (
                          <>
                            <option value="current">実績（{curLabel}）</option>
                            <option value="target">予算（{curLabel}）</option>
                            {forwardMonths.map((m) => (
                              <option key={`pb:${m}`} value={`pb:${m}`}>{monthShort(m, baseYear)}の予算</option>
                            ))}
                            {forwardMonths.map((m) => (
                              <option key={`pf:${m}`} value={`pf:${m}`}>{monthShort(m, baseYear)}の着地予想</option>
                            ))}
                          </>
                        ) : (
                          <>
                            <option value="target">目標</option>
                            <option value="current">現状（今週）</option>
                            <option value="forecast">着地予測</option>
                          </>
                        )}
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <p className="text-[11px] text-muted-foreground">
          ※ 一番正確なのはスプレッドシートから直接PDF出力したものです。画像（スクリーンショット・写真）はAIで読み取るため、
          表全体が写った明るい画像をお使いください。いずれの場合も、反映後は必ず数値を確認してから提出してください。
        </p>
      </CardContent>
    </Card>
  );
}
