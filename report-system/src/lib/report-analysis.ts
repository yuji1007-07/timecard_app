import { prisma } from "@/lib/prisma";
import { computeKpiDiff, checkConsistency, checkKdiConsistency, type KpiDiffRow } from "@/lib/analysis";
import { CONSISTENCY, label, KDI_STATUS, TREND } from "@/lib/constants";
import { addMonthStr } from "@/lib/utils";
import { splitDataIssues } from "@/lib/deadline-actions";

export async function getReportAnalysis(reportId: string) {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    include: {
      kpiValues: { include: { kpiItem: { select: { goodDirection: true, category: true } } } },
      kdis: true,
      actions: true,
      projections: true,
      progresses: { include: { previousAction: true } },
      inflows: true,
      store: true,
      department: true,
      reporter: true,
      feedback: true,
    },
  });
  if (!report) return null;

  // 比較対象の「前回」
  // 週次: 数値は月内の累計なので、同じ月の「前の週」とだけ比較する（第1週は前月末と比べない）。
  // 月次: 直前の提出（＝先月分）と比較する。
  const wm = report.reportType === "WEEKLY" && report.targetWeek ? /^(\d{4}-\d{2})-W([1-5])$/.exec(report.targetWeek) : null;
  const prevWeek = wm && Number(wm[2]) > 1 ? `${wm[1]}-W${Number(wm[2]) - 1}` : null;
  const prev =
    report.reportType === "WEEKLY"
      ? prevWeek
        ? await prisma.report.findFirst({
            where: {
              storeId: report.storeId,
              departmentId: report.departmentId,
              reportType: "WEEKLY",
              status: "SUBMITTED",
              targetWeek: prevWeek,
            },
            orderBy: { submittedAt: "desc" },
            include: { kpiValues: true },
          })
        : null
      : await prisma.report.findFirst({
          where: {
            storeId: report.storeId,
            departmentId: report.departmentId,
            reportType: report.reportType,
            status: "SUBMITTED",
            submittedAt: { lt: report.submittedAt },
          },
          orderBy: { submittedAt: "desc" },
          include: { kpiValues: true },
        });

  // 週次: 同じ月の各週の報告（第1週→月末の推移比較用）
  const sameMonthWeeklies = wm
    ? await prisma.report.findMany({
        where: {
          storeId: report.storeId,
          departmentId: report.departmentId,
          reportType: "WEEKLY",
          status: "SUBMITTED",
          targetWeek: { startsWith: `${wm[1]}-W` },
        },
        orderBy: { targetWeek: "asc" },
        select: { id: true, targetWeek: true, kpiValues: { select: { kpiName: true, current: true } } },
      })
    : [];

  const goodDirByName = new Map(report.kpiValues.map((v) => [v.kpiName, v.kpiItem?.goodDirection ?? "UP"]));

  // KPI差分
  const diffRows: KpiDiffRow[] = computeKpiDiff(
    (prev?.kpiValues ?? []).map((v) => ({ kpiName: v.kpiName, current: v.current })),
    report.kpiValues.map((v) => ({ kpiName: v.kpiName, unit: v.unit, current: v.current, goodDirection: v.kpiItem?.goodDirection ?? "UP" }))
  );

  // 前回Actionと結果の接続チェック
  const progressResults = report.progresses.map((p) => {
    const dir = p.previousAction.relatedKpiName ? goodDirByName.get(p.previousAction.relatedKpiName) ?? "UP" : "UP";
    const consistency = checkConsistency({
      actionContent: p.previousAction.content,
      relatedKpiName: p.previousAction.relatedKpiName,
      status: p.status,
      prevKpi: p.prevKpiValue,
      currKpi: p.currentKpiValue,
      goodDirection: dir,
    });
    return { progress: p, consistency };
  });

  // 未達KPI
  const unmetKpiNames = report.kpiValues
    .filter((v) => {
      if (v.target == null || v.current == null) return false;
      const dir = v.kpiItem?.goodDirection ?? "UP";
      return dir === "UP" ? v.current < v.target : v.current > v.target;
    })
    .map((v) => v.kpiName);

  // KDI整合性チェック
  const unfinishedPrevActions = report.progresses.filter((p) => p.status === "NOT_DONE").length;
  const kdiCheck = checkKdiConsistency({
    unmetKpiNames,
    kdis: report.kdis.map((k) => ({ name: k.name, relatedKpiName: k.relatedKpiName, assignee: k.assignee, deadline: k.deadline, frequency: k.frequency })),
    unfinishedPrevActions,
  });

  // 先月の実績（KPI入力値に参考表示）。週次は先月最終週の現状、月次は先月の月次の実績。
  const lastMonthActual = new Map<string, number | null>();
  {
    let src: { kpiValues: { kpiItemId: string; kpiName: string; current: number | null }[] } | null = null;
    if (report.reportType === "WEEKLY" && wm) {
      const pm = addMonthStr(wm[1], -1);
      src = await prisma.report.findFirst({
        where: { storeId: report.storeId, departmentId: report.departmentId, reportType: "WEEKLY", status: "SUBMITTED", targetWeek: { startsWith: `${pm}-W` } },
        orderBy: { targetWeek: "desc" },
        select: { kpiValues: { select: { kpiItemId: true, kpiName: true, current: true } } },
      });
    } else if (report.reportType === "MONTHLY" && report.targetMonth) {
      const pm = addMonthStr(report.targetMonth, -1);
      src = await prisma.report.findFirst({
        where: { storeId: report.storeId, departmentId: report.departmentId, reportType: "MONTHLY", status: "SUBMITTED", targetMonth: pm },
        orderBy: { submittedAt: "desc" },
        select: { kpiValues: { select: { kpiItemId: true, kpiName: true, current: true } } },
      });
    }
    // 同名KPIがあっても取り違えないよう ID を主キーにし、名前はフォールバックとして併記する
    for (const v of src?.kpiValues ?? []) {
      lastMonthActual.set(v.kpiItemId, v.current);
      if (!lastMonthActual.has(v.kpiName)) lastMonthActual.set(v.kpiName, v.current);
    }
  }

  // 週次: 現在有効な月次アクションプランの進捗を自動追跡する。
  // 「有効な月次計画」＝この週が属する月より前で、直近に提出された月次報告（＝今月に向けて立てた計画）。
  // 手入力は一切なく、今週のKPI（着地予測 or 実績）から達成度を計算する。
  const monthlyPlan = await buildMonthlyPlanProgress(report, wm);

  return { report, prev, sameMonthWeeklies, lastMonthActual, diffRows, progressResults, unmetKpiNames, kdiCheck, monthlyPlan };
}

export type ReportAnalysis = NonNullable<Awaited<ReturnType<typeof getReportAnalysis>>>;

/** AIフィードバック用にテキスト要約を組み立てる。 */
export function buildAnalysisText(a: ReportAnalysis) {
  const diffSummary = a.diffRows
    .filter((r) => r.prev !== null || r.curr !== null)
    .map((r) => `・${r.kpiName}: ${r.prev ?? "-"} → ${r.curr ?? "-"}（${r.trend}${r.rate != null ? ` ${r.rate}%` : ""}）`)
    .join("\n");

  const prevKdiSummary = a.progressResults
    .map((p) => `・${p.progress.previousAction.content}: ${label(KDI_STATUS, p.progress.status)} / ${p.consistency.judgement} — ${p.consistency.comment}`)
    .join("\n");

  const currentKdiSummary = a.report.kdis
    .map((k) => `・${k.name}${k.relatedKpiName ? `（関連KPI: ${k.relatedKpiName}）` : ""} 担当:${k.assignee ?? "未設定"} 進捗:${label(KDI_STATUS, k.status)}`)
    .join("\n");

  const kdiConsistency = `判定レベル: ${a.kdiCheck.level}\n${a.kdiCheck.messages.map((m) => `・${m}`).join("\n")}`;

  const review = [
    a.report.goodPoints && `良かった点: ${a.report.goodPoints}`,
    a.report.badPoints && `悪かった点: ${a.report.badPoints}`,
    a.report.dataIssues && `数値課題: ${a.report.dataIssues}`,
  ]
    .filter(Boolean)
    .join("\n");

  return { diffSummary, prevKdiSummary, currentKdiSummary, kdiConsistency, review, worsened: a.diffRows.filter((r) => r.trend === TREND.WORSENED) };
}

export const CONSISTENCY_VARIANT: Record<string, "good" | "warn" | "bad" | "muted"> = {
  [CONSISTENCY.OK]: "good",
  [CONSISTENCY.WEAK]: "warn",
  [CONSISTENCY.NONE]: "bad",
  [CONSISTENCY.UNKNOWN]: "muted",
};

// ===== 月次アクションプランの週次自動追跡 =====
// 月次報告で立てた定量目標（ReportAction）とデッドラインを、
// その後の各週次報告のKPIから自動で進捗判定する。現場の追加入力は不要。

export type MonthlyPlanTarget = {
  content: string;
  kpiName: string;
  baseValue: number | null; // 計画時点の値
  targetValue: number; // 目標値
  currentValue: number | null; // 今週時点の値（着地予測 or 実績）
  progressPct: number | null; // 計画時点→目標 のうち何%進んだか
  achieved: boolean;
  goodDirection: "UP" | "DOWN";
};

export type MonthlyPlanDeadline = {
  kpiName: string;
  threshold: number | null;
  currentValue: number | null;
  breached: boolean; // デッドラインを下回っているか
  actions: string[];
};

export type MonthlyPlan = {
  sourceMonth: string; // 計画を立てた月次報告の対象月
  sourceReportId: string;
  targets: MonthlyPlanTarget[];
  deadlines: MonthlyPlanDeadline[];
} | null;

type ReportForPlan = {
  id: string;
  reportType: string;
  storeId: string;
  departmentId: string | null;
  kpiValues: { kpiName: string; current: number | null; forecast: number | null; kpiItem?: { goodDirection: string } | null }[];
};

async function buildMonthlyPlanProgress(report: ReportForPlan, wm: RegExpExecArray | null): Promise<MonthlyPlan> {
  // 週次報告でのみ追跡する（月次報告そのものは計画を立てる側）
  if (report.reportType !== "WEEKLY" || !wm) return null;
  const thisMonth = wm[1];

  const source = await prisma.report.findFirst({
    where: {
      storeId: report.storeId,
      departmentId: report.departmentId,
      reportType: "MONTHLY",
      status: "SUBMITTED",
      targetMonth: { lt: thisMonth },
    },
    // 同じ月に複数提出されている場合は最後に提出されたものを採用する
    orderBy: [{ targetMonth: "desc" }, { submittedAt: "desc" }],
    include: { actions: true },
  });
  if (!source?.targetMonth) return null;

  // 今週時点の値: 週次は着地予測を優先（月末見込み＝月次目標と比較できる）
  const valueOf = (name: string): number | null => {
    const v = report.kpiValues.find((x) => x.kpiName === name);
    if (!v) return null;
    return v.forecast ?? v.current;
  };
  const dirOf = (name: string): "UP" | "DOWN" =>
    report.kpiValues.find((x) => x.kpiName === name)?.kpiItem?.goodDirection === "DOWN" ? "DOWN" : "UP";

  const targets: MonthlyPlanTarget[] = source.actions
    .filter((a) => a.relatedKpiName && a.targetValue != null)
    .map((a) => {
      const kpiName = a.relatedKpiName!;
      const targetValue = a.targetValue!;
      const currentValue = valueOf(kpiName);
      const goodDirection = dirOf(kpiName);
      const base = a.baseValue;
      let progressPct: number | null = null;
      if (currentValue != null) {
        if (base != null && targetValue !== base) {
          progressPct = Math.round(((currentValue - base) / (targetValue - base)) * 100);
        } else if (targetValue !== 0) {
          progressPct = Math.round((currentValue / targetValue) * 100);
        }
      }
      const achieved =
        currentValue != null && (goodDirection === "UP" ? currentValue >= targetValue : currentValue <= targetValue);
      return { content: a.content, kpiName, baseValue: base, targetValue, currentValue, progressPct, achieved, goodDirection };
    });

  const { deadlines: parsed } = splitDataIssues(source.dataIssues);
  const deadlines: MonthlyPlanDeadline[] = parsed.map((d) => {
    const threshold = d.threshold.trim() === "" ? null : Number(d.threshold);
    const th = threshold != null && Number.isFinite(threshold) ? threshold : null;
    const currentValue = valueOf(d.kpi);
    return {
      kpiName: d.kpi,
      threshold: th,
      currentValue,
      breached: currentValue != null && th != null && currentValue < th,
      actions: d.actions.filter((a) => a.trim()),
    };
  });

  if (targets.length === 0 && deadlines.length === 0) return null;
  return { sourceMonth: source.targetMonth, sourceReportId: source.id, targets, deadlines };
}
