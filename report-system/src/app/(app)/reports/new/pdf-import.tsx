"use client";

// スプレッドシートを印刷したPDFをアップロードして、月次KPIの数値を自動入力するカード。
// 1) PDFをサーバーで表に復元 → 2) 項目名をKPIに自動対応付け → 3) どの列を実績/予測として
// 取り込むかを選択 → 4) プレビュー確認後にフォームへ一括反映（スタッフは確認するだけ）。

import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { monthShort } from "@/lib/utils";
import type { KpiItemDef } from "./report-form";

type PdfCol = { index: number; header: string; samples: string[] };
type PdfRow = { section: string | null; label: string; cells: Record<string, number> };

export type PdfKpiUpdates = Record<string, { target?: string; current?: string }>; // kpiItemId ->
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

// 列見出しから取り込み先を推測（「6月」→当月実績、「7月」→7月の着地予想 など）
function guessRole(header: string, curMonthNum: number, forwardMonths: string[]): string {
  const h = norm(header);
  const hasMonth = (n: number) => new RegExp(`(?:^|[^0-9])${n}月`).test(h);
  if (hasMonth(curMonthNum)) return "current";
  for (const m of forwardMonths) {
    if (hasMonth(Number(m.slice(5, 7)))) return `pf:${m}`;
  }
  return "";
}

export function PdfImportCard({
  kpis,
  period,
  forwardMonths,
  baseYear,
  onApply,
}: {
  kpis: KpiItemDef[];
  period: string; // YYYY-MM
  forwardMonths: string[];
  baseYear: number;
  onApply: (kpiUpdates: PdfKpiUpdates, projUpdates: PdfProjUpdates) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{ columns: PdfCol[]; rows: PdfRow[] } | null>(null);
  const [colMap, setColMap] = useState<Record<string, string>>({});
  const [applied, setApplied] = useState<number | null>(null);
  const [showUnmatched, setShowUnmatched] = useState(false);

  const matched = useMemo(() => (data ? matchRows(data.rows, kpis) : []), [data, kpis]);
  const matchedCount = matched.filter((m) => m.kpi).length;
  const unmatched = matched.filter((m) => !m.kpi);
  const curMonthNum = Number(period.slice(5, 7)) || 0;
  const curLabel = /^\d{4}-\d{2}$/.test(period) ? monthShort(period, baseYear) : "当月";

  async function handleFile(f: File) {
    setError(null);
    setApplied(null);
    setData(null);
    if (f.size > 10 * 1024 * 1024) {
      setError("ファイルが大きすぎます（10MBまで）。");
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch("/api/parse-report-pdf", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error || "PDFの解析に失敗しました。");
        return;
      }
      const cols: PdfCol[] = json.columns;
      setData({ columns: cols, rows: json.rows });
      // 列見出しから初期の取り込み先を推測（間違っていても下で変更できる）
      const init: Record<string, string> = {};
      for (const c of cols) {
        const g = guessRole(c.header, curMonthNum, forwardMonths);
        if (g) init[String(c.index)] = g;
      }
      setColMap(init);
    } catch {
      setError("通信に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setBusy(false);
    }
  }

  function apply() {
    const kpiUpd: PdfKpiUpdates = {};
    const projUpd: PdfProjUpdates = {};
    let n = 0;
    for (const { row, kpi } of matched) {
      if (!kpi) continue;
      for (const [ci, role] of Object.entries(colMap)) {
        if (!role) continue;
        const v = row.cells[ci];
        if (v == null) continue;
        const s = String(v);
        if (role === "current") {
          if (!kpi.hasCurrent) continue;
          (kpiUpd[kpi.id] ??= {}).current = s;
          n++;
        } else if (role === "target") {
          if (!kpi.hasTarget) continue;
          (kpiUpd[kpi.id] ??= {}).target = s;
          n++;
        } else if (role.startsWith("pb:") || role.startsWith("pf:")) {
          const m = role.slice(3);
          if (!forwardMonths.includes(m)) continue;
          const slot = ((projUpd[kpi.name] ??= {})[m] ??= {});
          if (role.startsWith("pb:")) slot.budget = s;
          else slot.forecast = s;
          n++;
        }
      }
    }
    onApply(kpiUpd, projUpd);
    setApplied(n);
  }

  const activeCols = data ? data.columns.filter((c) => colMap[String(c.index)]) : [];
  const roleLabel = (role: string) => {
    if (role === "current") return `実績（${curLabel}）`;
    if (role === "target") return `予算（${curLabel}）`;
    const m = role.slice(3);
    const ml = /^\d{4}-\d{2}$/.test(m) ? monthShort(m, baseYear) : m;
    return role.startsWith("pb:") ? `${ml}の予算` : `${ml}の着地予想`;
  };

  return (
    <Card className="border-dashed border-navy/40">
      <CardHeader>
        <CardTitle>📄 スプレッドシートのPDFから自動入力（任意）</CardTitle>
        <p className="text-sm text-muted-foreground">
          いつも使っているスプレッドシートをPDFにしてアップロードすると、項目を自動で読み取ってKPI欄に反映します。
          反映後に数値を確認してから提出してください。（スプレッドシートの「ファイル → ダウンロード → PDF」で作成したものが対象。写真・スキャンは不可）
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,application/pdf"
            className="text-sm"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          {busy && <span className="text-sm text-muted-foreground">解析中...</span>}
        </div>
        {error && <p className="text-sm font-medium text-red-600">{error}</p>}

        {data && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="good">{matchedCount}項目をKPIに対応付けました</Badge>
              {unmatched.length > 0 && (
                <button type="button" className="text-xs text-muted-foreground underline" onClick={() => setShowUnmatched((v) => !v)}>
                  対応できなかった行 {unmatched.length}件 {showUnmatched ? "を隠す" : "を見る"}
                </button>
              )}
            </div>
            {showUnmatched && unmatched.length > 0 && (
              <p className="rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
                {unmatched.map((m) => m.row.label).join(" ／ ")}
              </p>
            )}

            {/* 列の取り込み先を選ぶ */}
            <div>
              <p className="mb-1 text-xs font-medium">どの列をどこに取り込むかを選んでください（見出しとサンプル値を参考に）:</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {data.columns.map((c) => (
                  <div key={c.index} className="rounded-md border p-2">
                    <div className="truncate text-xs font-medium" title={c.header || `列${c.index + 1}`}>
                      {c.header || `列${c.index + 1}`}
                    </div>
                    <div className="truncate text-[11px] text-muted-foreground">例: {c.samples.join(", ") || "—"}</div>
                    <select
                      className={`${selectClass} mt-1`}
                      value={colMap[String(c.index)] ?? ""}
                      onChange={(e) => setColMap((m) => ({ ...m, [String(c.index)]: e.target.value }))}
                    >
                      <option value="">取り込まない</option>
                      <option value="current">実績（{curLabel}）</option>
                      <option value="target">予算（{curLabel}）</option>
                      {forwardMonths.map((m) => (
                        <option key={`pb:${m}`} value={`pb:${m}`}>{monthShort(m, baseYear)}の予算</option>
                      ))}
                      {forwardMonths.map((m) => (
                        <option key={`pf:${m}`} value={`pf:${m}`}>{monthShort(m, baseYear)}の着地予想</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* プレビュー（選択した列のみ） */}
            {activeCols.length > 0 && (
              <div className="max-h-72 overflow-auto rounded-md border">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-medium">PDFの項目 → KPI</th>
                      {activeCols.map((c) => (
                        <th key={c.index} className="px-2 py-1.5 text-right font-medium">{roleLabel(colMap[String(c.index)])}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {matched.filter((m) => m.kpi).map(({ row, kpi }) => (
                      <tr key={`${row.section}|${row.label}`} className="border-t">
                        <td className="px-2 py-1">
                          {row.label}
                          {kpi!.name !== row.label && <span className="text-muted-foreground"> → {kpi!.name}</span>}
                        </td>
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

            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" onClick={apply} disabled={activeCols.length === 0 || matchedCount === 0}>
                この内容をフォームに反映する
              </Button>
              {applied != null && (
                <span className="text-sm font-medium text-emerald-700">
                  ✅ {applied}件の数値を反映しました。下のKPI欄・予測欄を確認してください。
                </span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
