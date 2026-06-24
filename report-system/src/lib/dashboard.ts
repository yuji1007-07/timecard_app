import { prisma } from "@/lib/prisma";
import { getReportUnits, type ReportUnit } from "@/lib/units";
import { evaluateAlert } from "@/lib/analysis";
import { ALERT_OPERATORS, type AlertOperator } from "@/lib/constants";
import type { Report, ReportKpiValue, AlertCondition } from "@prisma/client";

type ReportWithValues = Report & { kpiValues: (ReportKpiValue & { kpiItem: { goodDirection: string } | null })[] };

function unitKeyOf(storeId: string, departmentId: string | null) {
  return departmentId ? `${storeId}:${departmentId}` : storeId;
}

/** 指定週の提出状況を報告単位ごとに返す。 */
export async function getSubmissionStatus(
  week: string,
  units: ReportUnit[]
): Promise<{ unit: ReportUnit; submitted: boolean; reportId: string | null }[]> {
  const reports = await prisma.report.findMany({
    where: { reportType: "WEEKLY", targetWeek: week, status: "SUBMITTED" },
    select: { id: true, storeId: true, departmentId: true },
  });
  const submittedMap = new Map(reports.map((r) => [unitKeyOf(r.storeId, r.departmentId), r.id]));
  return units.map((unit) => ({
    unit,
    submitted: submittedMap.has(unit.key),
    reportId: submittedMap.get(unit.key) ?? null,
  }));
}

/** 指定週のKPIサマリー（業態別売上・主要指標・未達KPI数）。 */
export async function getKpiSummary(week: string, filter?: { storeId?: string }) {
  const reports = (await prisma.report.findMany({
    where: { reportType: "WEEKLY", targetWeek: week, status: "SUBMITTED", ...(filter ?? {}) },
    include: { kpiValues: { include: { kpiItem: { select: { goodDirection: true } } } }, store: true, department: true },
  })) as unknown as (ReportWithValues & { store: { businessType: string }; department: { businessType: string } | null })[];

  const salesByType: Record<string, number> = { SEIKOTSU: 0, SHINKYU: 0, ESTHE: 0 };
  let totalSales = 0;
  let firstVisits = 0;
  let newCustomers = 0;
  let members = 0;
  let charts = 0;
  const closingRates: number[] = [];
  const churnRates: number[] = [];
  let unmetCount = 0;

  for (const r of reports) {
    const bt = r.department?.businessType ?? r.store.businessType;
    for (const v of r.kpiValues) {
      if (v.kpiName === "売上" && v.current != null) {
        totalSales += v.current;
        if (salesByType[bt] != null) salesByType[bt] += v.current;
      }
      if (v.kpiName === "初診数" && v.current != null) firstVisits += v.current;
      if (v.kpiName === "新規数" && v.current != null) newCustomers += v.current;
      if (v.kpiName === "会員数" && v.current != null) members += v.current;
      if (v.kpiName === "カルテ枚数" && v.current != null) charts += v.current;
      if (v.kpiName === "成約率" && v.current != null) closingRates.push(v.current);
      if (v.kpiName === "離反率" && v.current != null) churnRates.push(v.current);

      // 未達KPI: 目標があり、良化方向に対して目標未達
      if (v.target != null && v.current != null) {
        const dir = v.kpiItem?.goodDirection ?? "UP";
        const unmet = dir === "UP" ? v.current < v.target : v.current > v.target;
        if (unmet) unmetCount++;
      }
    }
  }

  const avg = (arr: number[]) => (arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null);

  return {
    totalSales,
    salesByType,
    firstVisits,
    newCustomers,
    members,
    charts,
    avgClosingRate: avg(closingRates),
    avgChurnRate: avg(churnRates),
    unmetCount,
    reportCount: reports.length,
  };
}

export type AlertHit = {
  unit: ReportUnit;
  condition: AlertCondition;
  reason: string;
};

/** 指定週・指定単位に対して、有効な要注意条件の該当を評価する。 */
export async function getAlertHits(week: string, units: ReportUnit[]): Promise<AlertHit[]> {
  const conditions = await prisma.alertCondition.findMany({ where: { enabled: true }, orderBy: { sortOrder: "asc" } });

  // 各単位の今週・前回レポートを取得
  const hits: AlertHit[] = [];
  for (const unit of units) {
    const reports = await prisma.report.findMany({
      where: { storeId: unit.storeId, departmentId: unit.departmentId, reportType: "WEEKLY", status: "SUBMITTED" },
      include: { kpiValues: true, actions: true, progresses: true },
      orderBy: { submittedAt: "desc" },
      take: 2,
    });
    const latest = reports.find((r) => r.targetWeek === week) ?? null;
    const prev = reports.find((r) => r.targetWeek !== week) ?? reports[1] ?? null;

    for (const cond of conditions) {
      if (!conditionAppliesToUnit(cond, unit)) continue;

      if (cond.operator === "NOT_SUBMITTED") {
        if (!latest) hits.push({ unit, condition: cond, reason: "今週の報告が未提出です。" });
        continue;
      }
      if (!latest) continue; // 未提出なら数値系は判定不能

      if (cond.operator === "ACTION_NOT_DONE") {
        const notDone = latest.progresses.some((p) => p.status === "NOT_DONE");
        if (notDone) hits.push({ unit, condition: cond, reason: "前回Actionに未実施があります。" });
        continue;
      }

      const kpiName = cond.targetKpi;
      if (!kpiName) continue;
      const currVal = latest.kpiValues.find((v) => v.kpiName === kpiName);
      const prevVal = prev?.kpiValues.find((v) => v.kpiName === kpiName);
      if (!currVal) continue;

      const hit = evaluateAlert({
        operator: cond.operator as AlertOperator,
        threshold: cond.threshold,
        current: currVal.current,
        target: currVal.target,
        prev: prevVal?.current ?? null,
      });
      if (hit) {
        hits.push({
          unit,
          condition: cond,
          reason: `${kpiName} = ${currVal.current}（条件: ${kpiName} ${ALERT_OPERATORS[cond.operator as AlertOperator]} ${cond.threshold ?? ""}）`,
        });
      }
    }
  }
  return hits;
}

function conditionAppliesToUnit(cond: AlertCondition, unit: ReportUnit): boolean {
  switch (cond.targetType) {
    case "ALL":
      return true;
    case "SEIKOTSU":
    case "SHINKYU":
    case "ESTHE":
      return unit.businessType === cond.targetType;
    case "STORE":
      return cond.storeId === unit.storeId && !unit.departmentId;
    case "DEPARTMENT":
      return cond.departmentId === unit.departmentId;
    default:
      return false;
  }
}

export async function getDashboardData(week: string, filter?: { storeId?: string }) {
  const units = await getReportUnits(filter);
  const [submission, summary, alerts] = await Promise.all([
    getSubmissionStatus(week, units),
    getKpiSummary(week, filter),
    getAlertHits(week, units),
  ]);
  return { units, submission, summary, alerts };
}
