"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitReport, updateReport, type ReportPayload } from "../actions";
import { setUnitHiddenKpis } from "../hide-actions";
import { PdfImportCard, type PdfKpiUpdates, type PdfProjUpdates } from "./pdf-import";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KDI_STATUS, FREQUENCIES, GOOD_DIRECTIONS, label } from "@/lib/constants";
import { monthShort, memberCountKpiName } from "@/lib/utils";

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export type KpiItemDef = {
  id: string;
  name: string;
  category: string | null;
  unit: string;
  inputType: string;
  goodDirection: string;
  hasTarget: boolean;
  hasCurrent: boolean;
  hasForecast: boolean;
  hasComparison: boolean;
  required: boolean;
};

// カテゴリごとの色（見出しバー）
const CATEGORY_COLORS = [
  "bg-navy text-white",
  "bg-blue-100 text-blue-900",
  "bg-emerald-100 text-emerald-900",
  "bg-amber-100 text-amber-900",
  "bg-purple-100 text-purple-900",
  "bg-rose-100 text-rose-900",
  "bg-cyan-100 text-cyan-900",
  "bg-lime-100 text-lime-900",
];
export type KdiTemplateDef = { id: string; name: string; category: string | null; relatedKpiName: string | null; recommendedFrequency: string };
export type PrevActionDef = {
  id: string;
  content: string;
  relatedKpiName: string | null;
  assignee: string | null;
  deadline: string | null;
  frequency: string | null;
  expectedEffect: string | null;
  successCondition: string | null;
  prevKpiValue: number | null;
};

export type KpiPrevMap = Record<string, { target: number | null; current: number | null; forecast: number | null }>;
export type KpiMonthStartMap = Record<string, { target: number | null; forecast: number | null }>;

type KpiState = Record<string, { target: string; current: string; forecast: string; comment: string }>;
type KdiRow = { kdiItemId: string | null; name: string; relatedKpiName: string; assignee: string; deadline: string; frequency: string; count: string; targetPerson: string; status: string; comment: string };
type ActionRow = { relatedKpiName: string; targetValue: string; content: string };

// 振り返りは構造化して入力し、保存時は読みやすいテキストに整形する（DBはそのままTEXT列）
type ReviewEntry = { kpi: string; text: string }; // 良かった点・悪かった点: 対象KPI＋詳細
type TargetEntry = { kpi: string; after: string }; // 定量目標: 対象KPI（現在値は自動）＋変化後（手入力）
type IssueEntry = { kpi: string; issue: string; action: string; targets: TargetEntry[] }; // 課題＋アクションプラン＋定量目標
type NotDoneEntry = { what: string; why: string }; // 未実施: 何ができなかったか＋なぜできなかったか
type ReviewState = { good: ReviewEntry[]; bad: ReviewEntry[]; done: string; issues: IssueEntry[]; notDone: NotDoneEntry[] };
type ReviewStrings = { goodPoints: string; badPoints: string; dataIssues: string; doneThings: string; notDoneThings: string };

const emptyEntry = (): ReviewEntry => ({ kpi: "", text: "" });
const emptyTarget = (): TargetEntry => ({ kpi: "", after: "" });
const emptyIssue = (): IssueEntry => ({ kpi: "", issue: "", action: "", targets: [] });
const emptyNotDone = (): NotDoneEntry => ({ what: "", why: "" });

// 保存形式: 【対象KPI】詳細（KPIなしは詳細のみ）／ 課題は「→ アクションプラン:」「→ 定量目標:」、未実施は「→ できなかった理由:」を続ける
function serializeReview(r: ReviewState, landingOf: (kpi: string) => number | null): ReviewStrings {
  const pts = (es: ReviewEntry[]) =>
    es.filter((e) => e.text.trim() || e.kpi).map((e) => (e.kpi ? `【${e.kpi}】${e.text}` : e.text)).join("\n");
  const issues = r.issues
    .filter((e) => e.issue.trim() || e.action.trim() || e.targets.some((t) => t.kpi && t.after.trim()))
    .map((e) => {
      let s = `${e.kpi ? `【${e.kpi}】` : ""}${e.issue}`;
      if (e.action.trim()) s += `\n→ アクションプラン: ${e.action}`;
      const ts = e.targets.filter((t) => t.kpi && t.after.trim());
      if (ts.length) {
        s += `\n→ 定量目標: ${ts.map((t) => `${t.kpi}: ${landingOf(t.kpi) ?? "-"} → ${t.after}`).join(" ／ ")}`;
      }
      return s;
    })
    .join("\n");
  const notDone = r.notDone
    .filter((e) => e.what.trim() || e.why.trim())
    .map((e) => `${e.what}${e.why.trim() ? `\n→ できなかった理由: ${e.why}` : ""}`)
    .join("\n");
  return { goodPoints: pts(r.good), badPoints: pts(r.bad), dataIssues: issues, doneThings: r.done, notDoneThings: notDone };
}

// 編集時: 保存済みテキストを行単位で構造に戻す（旧形式の自由文は詳細欄にそのまま入る）
function parseReview(s: ReviewStrings | undefined | null): ReviewState {
  const parsePts = (t: string | undefined): ReviewEntry[] => {
    if (!t?.trim()) return [emptyEntry()];
    return t.split("\n").filter((l) => l.trim()).map((l) => {
      const m = /^【(.+?)】(.*)$/.exec(l);
      return m ? { kpi: m[1], text: m[2] } : { kpi: "", text: l };
    });
  };
  const parseIssues = (t: string | undefined): IssueEntry[] => {
    if (!t?.trim()) return [emptyIssue()];
    const out: IssueEntry[] = [];
    for (const l of t.split("\n")) {
      if (!l.trim()) continue;
      const act = /^→ アクションプラン: (.*)$/.exec(l.trim());
      if (act && out.length > 0) { out[out.length - 1].action = act[1]; continue; }
      const tgt = /^→ 定量目標: (.*)$/.exec(l.trim());
      if (tgt && out.length > 0) {
        out[out.length - 1].targets = tgt[1].split("／").map((seg) => {
          const mm = /^\s*(.+?):\s*.*?→\s*([\d,.\-]+)\s*$/.exec(seg);
          return mm ? { kpi: mm[1].trim(), after: mm[2].replace(/,/g, "") } : null;
        }).filter((x): x is TargetEntry => !!x);
        continue;
      }
      const m = /^【(.+?)】(.*)$/.exec(l);
      out.push(m ? { kpi: m[1], issue: m[2], action: "", targets: [] } : { kpi: "", issue: l, action: "", targets: [] });
    }
    return out.length ? out : [emptyIssue()];
  };
  const parseNotDone = (t: string | undefined): NotDoneEntry[] => {
    if (!t?.trim()) return [emptyNotDone()];
    const out: NotDoneEntry[] = [];
    for (const l of t.split("\n")) {
      if (!l.trim()) continue;
      const why = /^→ できなかった理由: (.*)$/.exec(l.trim());
      if (why && out.length > 0) { out[out.length - 1].why = why[1]; continue; }
      out.push({ what: l, why: "" });
    }
    return out.length ? out : [emptyNotDone()];
  };
  return {
    good: parsePts(s?.goodPoints),
    bad: parsePts(s?.badPoints),
    done: s?.doneThings ?? "",
    issues: parseIssues(s?.dataIssues),
    notDone: parseNotDone(s?.notDoneThings),
  };
}
type MonthlyState = {
  monthlySummary: string; successCases: string; missFactors: string; nextMonthFocusKpi: string; nextMonthKdi: string; nextMonthAction: string;
  hrIssues: string; marketingIssues: string; educationIssues: string; operationIssues: string;
};
// 編集モードでフォームに初期値を流し込むためのデータ
export type ReportInitial = {
  originalText: string;
  kpiByName: Record<string, { target: string; current: string; forecast: string; comment: string }>;
  inflow: Record<string, string>;
  review: ReviewStrings;
  monthly: MonthlyState | null;
  progressByActionId: Record<string, { status: string; comment: string }>;
  kdis: KdiRow[];
  actions: ActionRow[];
  projections?: ProjMap;
};

// 月次の3ヶ月予測： kpiName -> 年月(YYYY-MM) -> { 予算, 着地予想 }（文字列で保持）
export type ProjMap = Record<string, Record<string, { budget: string; forecast: string }>>;

const EMPTY_MONTHLY: MonthlyState = {
  monthlySummary: "", successCases: "", missFactors: "", nextMonthFocusKpi: "", nextMonthKdi: "", nextMonthAction: "",
  hrIssues: "", marketingIssues: "", educationIssues: "", operationIssues: "",
};

const numOrNull = (s: string) => (s.trim() === "" ? null : Number(s));
const emptyAction = (): ActionRow => ({ relatedKpiName: "", targetValue: "", content: "" });

export function ReportForm({
  storeId,
  departmentId,
  unitLabel,
  reportType,
  period,
  kpiItems,
  kdiTemplates,
  previousActions,
  channels,
  kpiPrev,
  kpiMonthStart,
  hiddenKpis,
  mode = "create",
  reportId,
  initial = null,
  initialStatus = "SUBMITTED",
  forwardMonths = [],
  kpiCarry = {},
  projCarry = {},
}: {
  storeId: string;
  departmentId: string | null;
  unitLabel: string;
  reportType: "WEEKLY" | "MONTHLY";
  period: string;
  kpiItems: KpiItemDef[];
  kdiTemplates: KdiTemplateDef[];
  previousActions: PrevActionDef[];
  channels: string[];
  kpiPrev: KpiPrevMap;
  kpiMonthStart: KpiMonthStartMap;
  hiddenKpis: string[];
  mode?: "create" | "edit";
  reportId?: string;
  initial?: ReportInitial | null;
  initialStatus?: string; // "DRAFT" | "SUBMITTED"（edit時の元ステータス）
  forwardMonths?: string[];
  kpiCarry?: Record<string, { budget: string; forecast: string }>;
  projCarry?: ProjMap;
}) {
  const isMonthly = reportType === "MONTHLY";
  const baseYear = Number((period.match(/^(\d{4})/) || [])[1]) || new Date().getFullYear();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [draftPending, setDraftPending] = useState(false); // どちらのボタンで実行中か
  const [editVisibility, setEditVisibility] = useState(false);
  const [savingVis, setSavingVis] = useState(false);
  const hiddenSet = useMemo(() => new Set(hiddenKpis), [hiddenKpis]);

  const [originalText, setOriginalText] = useState(initial?.originalText ?? "");
  const [kpi, setKpi] = useState<KpiState>(() =>
    Object.fromEntries(
      kpiItems.map((k) => {
        if (initial?.kpiByName[k.name]) return [k.id, initial.kpiByName[k.name]];
        // 新規・月次：前月が立てた「今月の予測」を 予算(target)・着地予測(forecast) に引き継ぐ（実績は空）
        const carry = kpiCarry[k.name];
        if (carry) return [k.id, { target: carry.budget, current: "", forecast: carry.forecast, comment: "" }];
        return [k.id, { target: "", current: "", forecast: "", comment: "" }];
      })
    )
  );
  // 月次：来月以降3ヶ月の予測 state（kpiName -> 月 -> {budget,forecast}）
  const [proj, setProj] = useState<ProjMap>(() => {
    const src: ProjMap = initial?.projections ?? projCarry;
    const out: ProjMap = {};
    for (const k of kpiItems) {
      out[k.name] = {};
      for (const mo of forwardMonths) {
        const v = src[k.name]?.[mo];
        out[k.name][mo] = { budget: v?.budget ?? "", forecast: v?.forecast ?? "" };
      }
    }
    return out;
  });
  // 「前月から取り込む」：前月が立てた予測を、今月の予算・着地予測＋来月以降の予測に反映
  function applyCarry() {
    setKpi((prev) => {
      const next = { ...prev };
      for (const k of kpiItems) {
        const c = kpiCarry[k.name];
        if (!c) continue;
        next[k.id] = { ...next[k.id], target: c.budget || next[k.id].target, forecast: c.forecast || next[k.id].forecast };
      }
      return next;
    });
    setProj((prev) => {
      const next: ProjMap = { ...prev };
      for (const k of kpiItems) {
        next[k.name] = { ...(next[k.name] ?? {}) };
        for (const mo of forwardMonths) {
          const v = projCarry[k.name]?.[mo];
          if (v && (v.budget || v.forecast)) next[k.name][mo] = { budget: v.budget, forecast: v.forecast };
        }
      }
      return next;
    });
  }
  const hasCarry = Object.keys(kpiCarry).length > 0 || Object.keys(projCarry).length > 0;
  // PDF自動入力の反映：読み取った数値をKPI欄と来月以降の予測欄に流し込む
  function applyPdfImport(kpiUpd: PdfKpiUpdates, projUpd: PdfProjUpdates) {
    setKpi((prev) => {
      const next = { ...prev };
      for (const [id, u] of Object.entries(kpiUpd)) {
        if (!next[id]) continue;
        next[id] = {
          ...next[id],
          ...(u.target != null ? { target: u.target } : {}),
          ...(u.current != null ? { current: u.current } : {}),
          ...(u.forecast != null ? { forecast: u.forecast } : {}),
        };
      }
      return next;
    });
    setProj((prev) => {
      const next: ProjMap = { ...prev };
      for (const [name, months] of Object.entries(projUpd)) {
        next[name] = { ...(next[name] ?? {}) };
        for (const [mo, u] of Object.entries(months)) {
          if (!forwardMonths.includes(mo)) continue;
          const cur = next[name][mo] ?? { budget: "", forecast: "" };
          next[name][mo] = { budget: u.budget ?? cur.budget, forecast: u.forecast ?? cur.forecast };
        }
      }
      return next;
    });
  }
  const [inflow, setInflow] = useState<Record<string, string>>(() => Object.fromEntries(channels.map((c) => [c, initial?.inflow[c] ?? ""])));
  const [review, setReview] = useState<ReviewState>(() => parseReview(initial?.review));
  const [monthly, setMonthly] = useState<MonthlyState>(initial?.monthly ?? EMPTY_MONTHLY);
  // KDI・来週見込みKPIの入力は廃止。編集時に過去KDIを消さないよう initial を保持だけする。

  const kpiNameById = useMemo(() => new Map(kpiItems.map((k) => [k.name, k.id])), [kpiItems]);

  function currentOf(kpiName: string | null): number | null {
    if (!kpiName) return null;
    const id = kpiNameById.get(kpiName);
    if (!id) return null;
    return numOrNull(kpi[id]?.current ?? "");
  }
  // 指定KPIの「今回の着地（予測）」を取得
  function forecastOf(kpiName: string | null): number | null {
    if (!kpiName) return null;
    const id = kpiNameById.get(kpiName);
    if (!id) return null;
    return numOrNull(kpi[id]?.forecast ?? "");
  }
  // 定量目標の「現在値」: 週次は着地（forecast）優先、無ければ実績/現状（current）
  function landingOf(kpiName: string | null): number | null {
    if (!kpiName) return null;
    return forecastOf(kpiName) ?? currentOf(kpiName);
  }
  // 月初の目標・着地を反映（目標が月内で変わらない運用向け）
  function reflectMonthStart() {
    setKpi((prev) => {
      const next = { ...prev };
      for (const k of kpiItems) {
        const ms = kpiMonthStart[k.name];
        if (!ms) continue;
        next[k.id] = {
          ...next[k.id],
          target: ms.target != null ? String(ms.target) : next[k.id].target,
          forecast: ms.forecast != null ? String(ms.forecast) : next[k.id].forecast,
        };
      }
      return next;
    });
  }
  const hasMonthStart = kpiItems.some((k) => kpiMonthStart[k.name]);

  const visibleKpis = useMemo(() => kpiItems.filter((k) => !hiddenSet.has(k.name)), [kpiItems, hiddenSet]);
  const groupedVisible = useMemo(() => groupByCategory(visibleKpis), [visibleKpis]);
  // 各メンバー区分（定額会員/新定額会員/プレミアム会員/ダイエットコース 等）に対応する
  // 「会員数（カルテ枚数）」KPI を接頭辞から特定。会員数は会員数・新規欄で1回入力し、各区分欄へ自動反映する。
  const allKpiNames = useMemo(() => kpiItems.map((k) => k.name), [kpiItems]);
  const memberCountItemByCategory = useMemo(() => {
    const map = new Map<string, KpiItemDef>();
    for (const g of groupByCategory(kpiItems)) {
      const name = memberCountKpiName(g.items.map((k) => k.name), allKpiNames);
      if (!name) continue;
      const item = kpiItems.find((k) => k.name === name);
      if (item) map.set(g.category, item);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kpiItems, allKpiNames]);

  function groupByCategory(items: KpiItemDef[]) {
    const order: string[] = [];
    const map = new Map<string, KpiItemDef[]>();
    for (const k of items) {
      const c = k.category || "その他";
      if (!map.has(c)) {
        map.set(c, []);
        order.push(c);
      }
      map.get(c)!.push(k);
    }
    return order.map((c) => ({ category: c, items: map.get(c)! }));
  }

  function toggleHidden(name: string) {
    const next = hiddenSet.has(name) ? hiddenKpis.filter((n) => n !== name) : [...hiddenKpis, name];
    setSavingVis(true);
    startTransition(async () => {
      await setUnitHiddenKpis({ storeId, departmentId, hidden: next });
      router.refresh();
      setSavingVis(false);
    });
  }

  function handleSubmit(asDraft = false) {
    setError(null);
    setDraftPending(asDraft);
    // 必須KPIチェック（非表示の項目は対象外）。下書き保存時は未入力OK。
    if (!asDraft) {
      for (const k of visibleKpis) {
        if (k.required && k.hasCurrent && numOrNull(kpi[k.id].current) === null) {
          setError(`必須KPI「${k.name}」の現状値を入力してください。`);
          return;
        }
      }
    }

    const payload: ReportPayload = {
      storeId,
      departmentId,
      reportType,
      targetWeek: reportType === "WEEKLY" ? period : null,
      targetMonth: reportType === "MONTHLY" ? period : null,
      originalText,
      review: serializeReview(review, (k) => landingOf(k)),
      monthly: reportType === "MONTHLY" ? monthly : null,
      kpis: visibleKpis.map((k) => ({
        kpiItemId: k.id,
        kpiName: k.name,
        unit: k.unit,
        target: k.hasTarget ? numOrNull(kpi[k.id].target) : null,
        current: k.hasCurrent ? numOrNull(kpi[k.id].current) : null,
        forecast: k.hasForecast ? numOrNull(kpi[k.id].forecast) : null,
        comment: kpi[k.id].comment,
      })),
      inflows: channels.map((c) => ({ channel: c, count: Number(inflow[c] || 0) })),
      // KDIは廃止。編集時のみ既存の過去KDIを保持（消さない）、新規は空
      kdis: (initial?.kdis ?? []).map((k) => ({ ...k, count: numOrNull(k.count) })),
      // 「数値から見た課題」の定量目標を Action として保存（前回Action進捗チェック・推移で活用）
      actions: review.issues.flatMap((e) =>
        e.targets
          .filter((t) => t.kpi && t.after.trim())
          .map((t) => ({
            content: e.action.trim() || e.issue.trim() || `${t.kpi}の改善`,
            relatedKpiName: t.kpi,
            baseValue: landingOf(t.kpi),
            targetValue: numOrNull(t.after),
            assignee: "",
            deadline: "",
            frequency: "",
            expectedEffect: "",
            successCondition: "",
          }))
      ),
      progresses: [],
      projections: isMonthly
        ? visibleKpis.flatMap((k) =>
            forwardMonths.map((m) => ({
              kpiName: k.name,
              targetMonth: m,
              budget: numOrNull(proj[k.name]?.[m]?.budget ?? ""),
              forecast: numOrNull(proj[k.name]?.[m]?.forecast ?? ""),
            }))
          )
        : [],
    };

    startTransition(async () => {
      try {
        if (mode === "edit" && reportId) {
          // 下書きの編集: asDraft=false なら提出（SUBMITTEDへ昇格）
          await updateReport(reportId, payload, { submit: !asDraft });
        } else {
          await submitReport(payload, { draft: asDraft });
        }
      } catch (e) {
        // redirect() は例外を投げるので、本物のエラーのみ表示
        if ((e as Error).message && !(e as { digest?: string }).digest) setError((e as Error).message);
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* 報告原本（LINEで届いた原文をそのまま保存） */}
      <Card>
        <CardHeader>
          <CardTitle>⓪ 報告原本（原文）</CardTitle>
          <p className="text-sm text-muted-foreground">
            LINEなどで届いた報告文をそのまま貼り付けてください。原文は加工せず保存され、報告詳細でいつでも閲覧できます。
          </p>
        </CardHeader>
        <CardContent>
          <Textarea
            rows={8}
            value={originalText}
            onChange={(e) => setOriginalText(e.target.value)}
            placeholder="ここにLINEの報告文をそのまま貼り付け（任意）。下のKPI欄は数値集計用に別途入力します。"
            className="whitespace-pre-wrap"
          />
        </CardContent>
      </Card>

      {/* スプレッドシートPDFから自動入力（週次・月次共通） */}
      <PdfImportCard
        kpis={visibleKpis}
        reportType={reportType}
        period={period}
        forwardMonths={forwardMonths}
        baseYear={baseYear}
        onApply={applyPdfImport}
      />


      {/* KPI入力 */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>② KPI入力（{unitLabel}）</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              {isMonthly && hasCarry && !editVisibility && (
                <Button type="button" variant="outline" size="sm" onClick={applyCarry}>
                  前月から取り込む
                </Button>
              )}
              {hasMonthStart && !editVisibility && (
                <Button type="button" variant="outline" size="sm" onClick={reflectMonthStart}>
                  月初の目標・着地を反映
                </Button>
              )}
              <Button
                type="button"
                variant={editVisibility ? "default" : "outline"}
                size="sm"
                onClick={() => setEditVisibility((v) => !v)}
              >
                {editVisibility ? "編集を終わる" : "使わない項目を編集"}
              </Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {editVisibility ? (
              <>この店舗で<span className="font-medium">使わないKPI項目のチェックを外す</span>と、入力欄から非表示になります（管理側でもカットできます）。</>
            ) : isMonthly ? (
              <>
                月次は<span className="font-medium">予算 / 実績</span>を入力します（売上確定済みのため着地はありません。着地予想は下の「来月以降の予測」で入力）。「前月から取り込む」で先月立てた予測を予算に自動反映できます。実績が予算に届かない項目は<span className="font-medium text-red-600">赤文字</span>です。
              </>
            ) : (
              <>
                目標は月内で基本変わらないので「月初の目標・着地を反映」で前回の数値を呼び出せます。着地が目標に届かない項目（着地未達）は<span className="font-medium text-red-600">赤文字</span>、着地が先週から変わった項目は<span className="font-medium text-amber-600">黄色</span>で表示されます。
              </>
            )}
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {editVisibility ? (
            // 使う / 使わない を編集するモード
            <div className="space-y-3">
              {savingVis && <p className="text-xs text-muted-foreground">保存中...</p>}
              {groupByCategory(kpiItems).map((g, gi) => (
                <div key={g.category}>
                  <div className={`rounded-md px-3 py-1.5 text-sm font-semibold ${CATEGORY_COLORS[gi % CATEGORY_COLORS.length]}`}>
                    {g.category}
                  </div>
                  <div className="mt-1 grid gap-1 md:grid-cols-2">
                    {g.items.map((k) => {
                      const isHidden = hiddenSet.has(k.name);
                      return (
                        <label
                          key={k.id}
                          className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${isHidden ? "bg-muted/40" : ""}`}
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4"
                            checked={!isHidden}
                            disabled={savingVis}
                            onChange={() => toggleHidden(k.name)}
                          />
                          <span className={isHidden ? "text-muted-foreground line-through" : "font-medium"}>{k.name}</span>
                          <span className="text-xs text-muted-foreground">({k.unit})</span>
                          {isHidden && <span className="ml-auto text-[10px] text-muted-foreground">非表示</span>}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className={`hidden gap-2 border-b pb-2 text-xs font-medium text-muted-foreground md:grid ${isMonthly ? "md:grid-cols-[1.5fr_1fr_1fr_2fr]" : "md:grid-cols-[1.5fr_1fr_1fr_1fr_2fr]"}`}>
                <div>KPI名</div>
                {isMonthly ? (
                  <>
                    <div>予算</div>
                    <div>実績</div>
                  </>
                ) : (
                  <>
                    <div>目標</div>
                    <div>現状</div>
                    <div>着地予測</div>
                  </>
                )}
                <div>コメント</div>
              </div>
              {visibleKpis.length === 0 && (
                <p className="text-sm text-muted-foreground">表示するKPIがありません。「使わない項目を編集」で項目を表示に戻せます。</p>
              )}
              {groupedVisible.map((g, gi) => (
                <div key={g.category} className="space-y-2">
                  <div className={`rounded-md px-3 py-1.5 text-sm font-semibold ${CATEGORY_COLORS[gi % CATEGORY_COLORS.length]}`}>
                    {g.category}
                  </div>
                  {memberCountItemByCategory.get(g.category) && (() => {
                    const mc = memberCountItemByCategory.get(g.category)!;
                    return (
                      <div className="flex items-center gap-2 rounded-md border border-dashed bg-muted/30 px-3 py-1.5 text-sm">
                        <span className="font-medium">カルテ枚数（{mc.name}）</span>
                        <Badge variant="muted" className="text-[10px]">自動反映</Badge>
                        <span className="tabular-nums font-semibold">{kpi[mc.id]?.current || "—"}</span>
                        <span className="text-xs text-muted-foreground">（会員数欄の入力がそのまま反映されます）</span>
                      </div>
                    );
                  })()}
                  {g.items.map((k) => {
                    const prevForecast = kpiPrev[k.name]?.forecast ?? null;
                    const target = numOrNull(kpi[k.id].target);
                    const actual = numOrNull(kpi[k.id].current);
                    const curForecast = numOrNull(kpi[k.id].forecast);
                    const forecastChanged = prevForecast != null && curForecast != null && curForecast !== prevForecast;
                    // 月次: 実績が予算に届かない ／ 週次: 着地が目標に届かない（良化方向を考慮）
                    const isUnder = isMonthly
                      ? target != null && actual != null && (k.goodDirection === "UP" ? actual < target : actual > target)
                      : target != null && curForecast != null && (k.goodDirection === "UP" ? curForecast < target : curForecast > target);
                    return (
                      <div key={k.id} className={`grid gap-2 border-b pb-2 md:items-center md:border-0 md:pb-0 ${isMonthly ? "md:grid-cols-[1.5fr_1fr_1fr_2fr]" : "md:grid-cols-[1.5fr_1fr_1fr_1fr_2fr]"}`}>
                        <div className="flex items-center gap-1.5 text-sm font-medium">
                          {k.name}
                          <span className="text-xs text-muted-foreground">({k.unit})</span>
                          {k.required && <Badge variant="bad" className="text-[10px]">必須</Badge>}
                          <Badge variant={k.goodDirection === "UP" ? "good" : "warn"} className="text-[10px]">{label(GOOD_DIRECTIONS, k.goodDirection)}</Badge>
                        </div>
                        {/* 予算 / 目標 */}
                        <Input type="number" step="any" inputMode="decimal" disabled={!k.hasTarget} value={kpi[k.id].target} onChange={(e) => setKpi((s) => ({ ...s, [k.id]: { ...s[k.id], target: e.target.value } }))} placeholder={k.hasTarget ? (isMonthly ? "予算" : "目標") : "—"} />
                        {isMonthly ? (
                          // 月次: 実績のみ（着地は確定月には不要）。予算未達なら赤
                          <div>
                            <Input type="number" step="any" inputMode="decimal" disabled={!k.hasCurrent} value={kpi[k.id].current} onChange={(e) => setKpi((s) => ({ ...s, [k.id]: { ...s[k.id], current: e.target.value } }))} placeholder={k.hasCurrent ? "実績" : "—"} className={isUnder ? "border-red-400 bg-red-50 font-semibold text-red-700" : ""} />
                            {isUnder && <div className="mt-0.5 text-[10px] font-medium text-red-600">予算未達（予算 {target}）</div>}
                          </div>
                        ) : (
                          <>
                            {/* 週次: 現状 */}
                            <Input type="number" step="any" inputMode="decimal" disabled={!k.hasCurrent} value={kpi[k.id].current} onChange={(e) => setKpi((s) => ({ ...s, [k.id]: { ...s[k.id], current: e.target.value } }))} placeholder={k.hasCurrent ? "現状" : "—"} />
                            {/* 週次: 着地予測 */}
                            <div>
                              <Input type="number" step="any" inputMode="decimal" disabled={!k.hasForecast} value={kpi[k.id].forecast} onChange={(e) => setKpi((s) => ({ ...s, [k.id]: { ...s[k.id], forecast: e.target.value } }))} placeholder={k.hasForecast ? "着地" : "—"} className={isUnder ? "border-red-400 bg-red-50 font-semibold text-red-700" : forecastChanged ? "border-amber-400 bg-amber-50" : ""} />
                              {isUnder ? (
                                <div className="mt-0.5 text-[10px] font-medium text-red-600">着地未達（目標 {target}）</div>
                              ) : forecastChanged ? (
                                <div className="mt-0.5 text-[10px] text-amber-600">先週: {prevForecast}</div>
                              ) : null}
                            </div>
                          </>
                        )}
                        <Input value={kpi[k.id].comment} onChange={(e) => setKpi((s) => ({ ...s, [k.id]: { ...s[k.id], comment: e.target.value } }))} placeholder="コメント" />
                      </div>
                    );
                  })}
                </div>
              ))}
            </>
          )}
        </CardContent>
      </Card>

      {/* 月次: 来月以降3ヶ月の予測 */}
      {isMonthly && forwardMonths.length > 0 && (
        <Card className="border-navy/30">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>②-2 来月以降の予測（{forwardMonths.length}ヶ月先まで）</CardTitle>
              {hasCarry && (
                <Button type="button" variant="outline" size="sm" onClick={applyCarry}>前月から取り込む</Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              月次報告は<span className="font-medium">来月以降の売上予測を明確にする</span>のが目的です。各月の「予算」と「着地予想」を入力してください（{forwardMonths.map((m) => monthShort(m, baseYear)).join("・")}）。
            </p>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <div style={{ minWidth: 560 + forwardMonths.length * 150 }}>
              <div className="grid gap-2 border-b pb-2 text-xs font-medium text-muted-foreground" style={{ gridTemplateColumns: `1.6fr ${forwardMonths.map(() => "1fr").join(" ")}` }}>
                <div>KPI名</div>
                {forwardMonths.map((m) => (
                  <div key={m} className="text-center">{monthShort(m, baseYear)} の予測</div>
                ))}
              </div>
              {groupedVisible.map((g, gi) => (
                <div key={g.category} className="space-y-2">
                  <div className={`mt-2 rounded-md px-3 py-1 text-sm font-semibold ${CATEGORY_COLORS[gi % CATEGORY_COLORS.length]}`}>{g.category}</div>
                  {g.items.map((k) => (
                    <div key={k.id} className="grid items-center gap-2 border-b pb-2 md:border-0 md:pb-0" style={{ gridTemplateColumns: `1.6fr ${forwardMonths.map(() => "1fr").join(" ")}` }}>
                      <div className="text-sm font-medium">{k.name}<span className="ml-1 text-xs text-muted-foreground">({k.unit})</span></div>
                      {forwardMonths.map((m) => (
                        <div key={m} className="space-y-1">
                          <div className="flex items-center gap-1">
                            <span className="w-8 shrink-0 text-[10px] text-muted-foreground">予算</span>
                            <Input type="number" step="any" inputMode="decimal" className="h-8 text-sm" value={proj[k.name]?.[m]?.budget ?? ""} onChange={(e) => setProj((s) => ({ ...s, [k.name]: { ...(s[k.name] ?? {}), [m]: { ...(s[k.name]?.[m] ?? { budget: "", forecast: "" }), budget: e.target.value } } }))} placeholder="予算" />
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="w-8 shrink-0 text-[10px] text-muted-foreground">着地</span>
                            <Input type="number" step="any" inputMode="decimal" className="h-8 text-sm" value={proj[k.name]?.[m]?.forecast ?? ""} onChange={(e) => setProj((s) => ({ ...s, [k.name]: { ...(s[k.name] ?? {}), [m]: { ...(s[k.name]?.[m] ?? { budget: "", forecast: "" }), forecast: e.target.value } } }))} placeholder="着地予想" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 流入経路 */}
      <Card>
        <CardHeader>
          <CardTitle>③ 流入経路</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {channels.map((c) => (
              <div key={c} className="space-y-1.5">
                <Label>{c}</Label>
                <Input type="number" inputMode="numeric" value={inflow[c]} onChange={(e) => setInflow((s) => ({ ...s, [c]: e.target.value }))} placeholder="0" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 先週振り返り（C: 振り返り／評価） */}
      <Card className="border-l-4 border-l-blue-400 bg-blue-50/30">
        <CardHeader>
          <CardTitle className="text-blue-900">
            <span className="mr-2 rounded bg-blue-600 px-2 py-0.5 text-xs font-bold text-white">C</span>
            ④ {reportType === "WEEKLY" ? "先週" : "先月"}の振り返り（評価）
          </CardTitle>
          <p className="text-sm text-muted-foreground">やってみてどうだったか（良かった点・悪かった点・実施したこと・できなかったこと）を振り返ります。</p>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* 良かった点・悪かった点: 対象KPIを選んで詳細を書く */}
          {(["good", "bad"] as const).map((sec) => (
            <div key={sec} className="space-y-2">
              <Label className="text-sm font-semibold">{sec === "good" ? "良かった点" : "悪かった点"}</Label>
              {review[sec].map((e, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <select
                    className={selectClass + " w-52 shrink-0"}
                    value={e.kpi}
                    onChange={(ev) => setReview((s) => ({ ...s, [sec]: s[sec].map((x, xi) => (xi === i ? { ...x, kpi: ev.target.value } : x)) }))}
                  >
                    <option value="">対象KPIを選択（任意）</option>
                    {visibleKpis.map((k) => (
                      <option key={k.id} value={k.name}>{k.name}</option>
                    ))}
                  </select>
                  <Input
                    className="min-w-[240px] flex-1"
                    value={e.text}
                    onChange={(ev) => setReview((s) => ({ ...s, [sec]: s[sec].map((x, xi) => (xi === i ? { ...x, text: ev.target.value } : x)) }))}
                    placeholder="詳細を入力"
                  />
                  {review[sec].length > 1 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setReview((s) => ({ ...s, [sec]: s[sec].filter((_, xi) => xi !== i) }))}>✕</Button>
                  )}
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => setReview((s) => ({ ...s, [sec]: [...s[sec], emptyEntry()] }))}>
                ＋ {sec === "good" ? "良かった点" : "悪かった点"}を追加
              </Button>
            </div>
          ))}

          {/* 実施したこと（課題より先） */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">実施したこと</Label>
            <Textarea rows={2} value={review.done} onChange={(e) => setReview((s) => ({ ...s, done: e.target.value }))} placeholder="今回やったことを入力" />
          </div>

          {/* 未実施: 何が・なぜ */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">未実施だったこと（何が・なぜ）</Label>
            {review.notDone.map((e, i) => (
              <div key={i} className="space-y-2 rounded-md border p-3">
                <div className="flex items-center gap-2">
                  <Input
                    value={e.what}
                    onChange={(ev) => setReview((s) => ({ ...s, notDone: s.notDone.map((x, xi) => (xi === i ? { ...x, what: ev.target.value } : x)) }))}
                    placeholder="できていなかったこと"
                  />
                  {review.notDone.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setReview((s) => ({ ...s, notDone: s.notDone.filter((_, xi) => xi !== i) }))}>✕</Button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="shrink-0 text-xs font-medium text-navy">→ なぜできなかったのか</span>
                  <Input
                    value={e.why}
                    onChange={(ev) => setReview((s) => ({ ...s, notDone: s.notDone.map((x, xi) => (xi === i ? { ...x, why: ev.target.value } : x)) }))}
                    placeholder="理由（人員不足・時間が取れなかった 等）"
                  />
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setReview((s) => ({ ...s, notDone: [...s.notDone, emptyNotDone()] }))}>＋ 未実施項目を追加</Button>
          </div>
        </CardContent>
      </Card>

      {/* 改善アクション（A: 課題→アクションプラン→定量目標） */}
      <Card className="border-l-4 border-l-amber-400 bg-amber-50/30">
        <CardHeader>
          <CardTitle className="text-amber-900">
            <span className="mr-2 rounded bg-amber-500 px-2 py-0.5 text-xs font-bold text-white">A</span>
            ⑤ 数値から見た課題と改善アクション
          </CardTitle>
          <p className="text-sm text-muted-foreground">数値から見えた課題ごとに、対策（アクションプラン）と「どの項目をどこまで変えるか」の定量目標を立てます。</p>
        </CardHeader>
        <CardContent className="space-y-3">
            {review.issues.map((e, i) => (
              <div key={i} className="space-y-2 rounded-md border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className={selectClass + " w-52 shrink-0"}
                    value={e.kpi}
                    onChange={(ev) => setReview((s) => ({ ...s, issues: s.issues.map((x, xi) => (xi === i ? { ...x, kpi: ev.target.value } : x)) }))}
                  >
                    <option value="">対象KPIを選択（任意）</option>
                    {visibleKpis.map((k) => (
                      <option key={k.id} value={k.name}>{k.name}</option>
                    ))}
                  </select>
                  <Input
                    className="min-w-[240px] flex-1"
                    value={e.issue}
                    onChange={(ev) => setReview((s) => ({ ...s, issues: s.issues.map((x, xi) => (xi === i ? { ...x, issue: ev.target.value } : x)) }))}
                    placeholder="課題（例: HPBの成約率が上がらない）"
                  />
                  {review.issues.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setReview((s) => ({ ...s, issues: s.issues.filter((_, xi) => xi !== i) }))}>✕</Button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="shrink-0 text-xs font-medium text-navy">→ アクションプラン</span>
                  <Input
                    value={e.action}
                    onChange={(ev) => setReview((s) => ({ ...s, issues: s.issues.map((x, xi) => (xi === i ? { ...x, action: ev.target.value } : x)) }))}
                    placeholder="この課題に対して何をするか"
                  />
                </div>

                {/* 定量目標: 対象項目（KPI）＋現在値（自動）→ 変化後（手入力）。複数可 */}
                <div className="space-y-1.5 rounded-md bg-muted/40 p-2">
                  <div className="text-xs font-medium text-navy">→ 定量目標（どのくらい変化させるか）</div>
                  {e.targets.map((t, ti) => {
                    const cur = landingOf(t.kpi);
                    return (
                      <div key={ti} className="flex flex-wrap items-center gap-2">
                        <select
                          className={selectClass + " w-44 shrink-0"}
                          value={t.kpi}
                          onChange={(ev) =>
                            setReview((s) => ({ ...s, issues: s.issues.map((x, xi) => (xi === i ? { ...x, targets: x.targets.map((y, yi) => (yi === ti ? { ...y, kpi: ev.target.value } : y)) } : x)) }))
                          }
                        >
                          <option value="">対象項目を選択</option>
                          {visibleKpis.map((k) => (
                            <option key={k.id} value={k.name}>{k.name}</option>
                          ))}
                        </select>
                        <div className="flex h-10 min-w-[92px] items-center justify-end rounded-md border bg-background px-3 text-sm tabular-nums text-muted-foreground" title="現在の着地/実績（自動）">
                          {cur != null ? cur.toLocaleString() : "—"}
                        </div>
                        <span className="text-sm text-muted-foreground">→</span>
                        <Input
                          type="number"
                          step="any"
                          inputMode="decimal"
                          className="w-32"
                          value={t.after}
                          onChange={(ev) =>
                            setReview((s) => ({ ...s, issues: s.issues.map((x, xi) => (xi === i ? { ...x, targets: x.targets.map((y, yi) => (yi === ti ? { ...y, after: ev.target.value } : y)) } : x)) }))
                          }
                          placeholder="変化後"
                        />
                        <span className="text-xs text-muted-foreground">{t.kpi ? visibleKpis.find((k) => k.name === t.kpi)?.unit : ""}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setReview((s) => ({ ...s, issues: s.issues.map((x, xi) => (xi === i ? { ...x, targets: x.targets.filter((_, yi) => yi !== ti) } : x)) }))}
                        >
                          ✕
                        </Button>
                      </div>
                    );
                  })}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setReview((s) => ({ ...s, issues: s.issues.map((x, xi) => (xi === i ? { ...x, targets: [...x.targets, { kpi: x.kpi, after: "" }] } : x)) }))
                    }
                  >
                    ＋ 対象項目を追加
                  </Button>
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setReview((s) => ({ ...s, issues: [...s.issues, emptyIssue()] }))}>＋ 課題を追加</Button>
        </CardContent>
      </Card>

      {/* 月次追加項目 */}
      {reportType === "MONTHLY" && (
        <Card>
          <CardHeader>
            <CardTitle>⑤ 月次 追加項目</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <Field label="月間総括" className="md:col-span-2"><Textarea rows={3} value={monthly.monthlySummary} onChange={(e) => setMonthly((s) => ({ ...s, monthlySummary: e.target.value }))} /></Field>
            <Field label="成功事例"><Textarea rows={2} value={monthly.successCases} onChange={(e) => setMonthly((s) => ({ ...s, successCases: e.target.value }))} /></Field>
            <Field label="未達要因"><Textarea rows={2} value={monthly.missFactors} onChange={(e) => setMonthly((s) => ({ ...s, missFactors: e.target.value }))} /></Field>
            <Field label="来月重点KPI"><Input value={monthly.nextMonthFocusKpi} onChange={(e) => setMonthly((s) => ({ ...s, nextMonthFocusKpi: e.target.value }))} /></Field>
            <Field label="来月KDI"><Input value={monthly.nextMonthKdi} onChange={(e) => setMonthly((s) => ({ ...s, nextMonthKdi: e.target.value }))} /></Field>
            <Field label="来月Action" className="md:col-span-2"><Textarea rows={2} value={monthly.nextMonthAction} onChange={(e) => setMonthly((s) => ({ ...s, nextMonthAction: e.target.value }))} /></Field>
            <Field label="人材面の課題"><Textarea rows={2} value={monthly.hrIssues} onChange={(e) => setMonthly((s) => ({ ...s, hrIssues: e.target.value }))} /></Field>
            <Field label="集客面の課題"><Textarea rows={2} value={monthly.marketingIssues} onChange={(e) => setMonthly((s) => ({ ...s, marketingIssues: e.target.value }))} /></Field>
            <Field label="教育面の課題"><Textarea rows={2} value={monthly.educationIssues} onChange={(e) => setMonthly((s) => ({ ...s, educationIssues: e.target.value }))} /></Field>
            <Field label="運営面の課題"><Textarea rows={2} value={monthly.operationIssues} onChange={(e) => setMonthly((s) => ({ ...s, operationIssues: e.target.value }))} /></Field>
          </CardContent>
        </Card>
      )}

      <div className="sticky bottom-0 -mx-4 flex items-center justify-between gap-3 border-t bg-card/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
        {error ? <span className="text-sm text-destructive">{error}</span> : <span className="text-sm text-muted-foreground">対象: {period}</span>}
        <div className="flex items-center gap-2">
          {/* 下書き保存: 新規作成時、または下書きの続き編集時に表示（提出済みの修正では非表示） */}
          {(mode === "create" || initialStatus === "DRAFT") && (
            <Button onClick={() => handleSubmit(true)} disabled={pending} size="lg" variant="outline">
              {pending && draftPending ? "保存中..." : "下書き保存"}
            </Button>
          )}
          <Button onClick={() => handleSubmit(false)} disabled={pending} size="lg">
            {pending && !draftPending
              ? mode === "edit" && initialStatus !== "DRAFT"
                ? "更新中..."
                : "提出中..."
              : mode === "edit" && initialStatus !== "DRAFT"
                ? "報告を更新する"
                : "報告を提出する"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
