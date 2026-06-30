import { prisma } from "@/lib/prisma";
import { computeKpiDiff, checkConsistency, checkKdiConsistency, type KpiDiffRow } from "@/lib/analysis";
import { CONSISTENCY, label, KDI_STATUS, TREND } from "@/lib/constants";

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

  // 直前の同一スコープ報告
  const prev = await prisma.report.findFirst({
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

  return { report, prev, diffRows, progressResults, unmetKpiNames, kdiCheck };
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
