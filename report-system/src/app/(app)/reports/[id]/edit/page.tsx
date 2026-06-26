import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getEffectiveKpiItems, getEffectiveKdiItems } from "@/lib/templates";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ReportForm, type ReportInitial } from "../../new/report-form";
import { INFLOW_CHANNELS, BUSINESS_TYPES, label } from "@/lib/constants";

const s = (n: number | null) => (n != null ? String(n) : "");

export default async function EditReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const report = await prisma.report.findUnique({
    where: { id },
    include: {
      kpiValues: true,
      inflows: true,
      kdis: true,
      actions: true,
      progresses: true,
      store: true,
      department: true,
    },
  });
  if (!report) notFound();

  // 権限チェック（閲覧と同じスコープのみ編集可）
  if (user.role !== "AREA_MANAGER") {
    if (user.storeId !== report.storeId) redirect("/dashboard");
    if (user.role === "DEPARTMENT_MANAGER" && user.departmentId !== report.departmentId) redirect("/dashboard");
  }

  const storeId = report.storeId;
  const departmentId = report.departmentId;
  const type = report.reportType as "WEEKLY" | "MONTHLY";
  const period = (type === "WEEKLY" ? report.targetWeek : report.targetMonth) ?? "";

  const [kpiItems, kdiItems] = await Promise.all([
    getEffectiveKpiItems({ storeId, departmentId }),
    getEffectiveKdiItems({ storeId, departmentId }),
  ]);

  // このレポートより前の報告（前回Action・差分の色付け用）
  const prevReport = await prisma.report.findFirst({
    where: {
      storeId,
      departmentId: departmentId ?? null,
      reportType: type,
      status: "SUBMITTED",
      submittedAt: { lt: report.submittedAt },
      id: { not: report.id },
    },
    orderBy: { submittedAt: "desc" },
    include: { kpiValues: true, actions: true },
  });

  const prevKpiByName = new Map((prevReport?.kpiValues ?? []).map((v) => [v.kpiName, v.current]));
  const previousActions = (prevReport?.actions ?? []).map((a) => ({
    id: a.id,
    content: a.content,
    relatedKpiName: a.relatedKpiName,
    assignee: a.assignee,
    deadline: a.deadline,
    frequency: a.frequency,
    expectedEffect: a.expectedEffect,
    successCondition: a.successCondition,
    prevKpiValue: a.relatedKpiName ? prevKpiByName.get(a.relatedKpiName) ?? null : null,
  }));

  const kpiPrev: Record<string, { target: number | null; current: number | null; forecast: number | null }> = {};
  for (const v of prevReport?.kpiValues ?? []) {
    kpiPrev[v.kpiName] = { target: v.target, current: v.current, forecast: v.forecast };
  }

  // 非表示KPI
  const hiddenSource = report.department ? report.department.hiddenKpis : report.store.hiddenKpis;
  let hiddenKpis: string[] = [];
  try {
    const parsed = hiddenSource ? JSON.parse(hiddenSource) : [];
    if (Array.isArray(parsed)) hiddenKpis = parsed.filter((x): x is string => typeof x === "string");
  } catch {
    hiddenKpis = [];
  }

  // 既存値をフォーム初期値へ
  const kpiByName: ReportInitial["kpiByName"] = {};
  for (const v of report.kpiValues) {
    kpiByName[v.kpiName] = { target: s(v.target), current: s(v.current), forecast: s(v.forecast), comment: v.comment ?? "" };
  }
  const inflow: Record<string, string> = Object.fromEntries(INFLOW_CHANNELS.map((c) => [c, ""]));
  for (const i of report.inflows) inflow[i.channel] = String(i.count);

  const progressByActionId: Record<string, { status: string; comment: string }> = {};
  for (const p of report.progresses) {
    progressByActionId[p.previousActionId] = { status: p.status, comment: p.comment ?? "" };
  }

  const kdis = report.kdis.map((k) => ({
    kdiItemId: k.kdiItemId,
    name: k.name,
    relatedKpiName: k.relatedKpiName ?? "",
    assignee: k.assignee ?? "",
    deadline: k.deadline ?? "",
    frequency: k.frequency ?? "WEEKLY1",
    count: k.count != null ? String(k.count) : "",
    targetPerson: k.targetPerson ?? "",
    status: k.status,
    comment: k.comment ?? "",
  }));

  const actions = report.actions.map((a) => ({
    relatedKpiName: a.relatedKpiName ?? "",
    targetValue: s(a.targetValue),
    // 自動生成された「着地→予想」文はメモに残さない
    content: a.content && a.content.includes("着地") && a.content.includes("予想") ? "" : a.content,
  }));

  const initial: ReportInitial = {
    originalText: report.originalText ?? "",
    kpiByName,
    inflow,
    review: {
      goodPoints: report.goodPoints ?? "",
      badPoints: report.badPoints ?? "",
      dataIssues: report.dataIssues ?? "",
      doneThings: report.doneThings ?? "",
      notDoneThings: report.notDoneThings ?? "",
    },
    monthly:
      type === "MONTHLY"
        ? {
            monthlySummary: report.monthlySummary ?? "",
            successCases: report.successCases ?? "",
            missFactors: report.missFactors ?? "",
            nextMonthFocusKpi: report.nextMonthFocusKpi ?? "",
            nextMonthKdi: report.nextMonthKdi ?? "",
            nextMonthAction: report.nextMonthAction ?? "",
            hrIssues: report.hrIssues ?? "",
            marketingIssues: report.marketingIssues ?? "",
            educationIssues: report.educationIssues ?? "",
            operationIssues: report.operationIssues ?? "",
          }
        : null,
    progressByActionId,
    kdis,
    actions,
  };

  const unitLabel = `${report.store.name}${report.department ? ` ${report.department.name}` : ""}・${label(
    BUSINESS_TYPES,
    report.department?.businessType ?? report.store.businessType
  )}`;

  return (
    <div>
      <PageHeader
        title="報告を修正"
        description={`${unitLabel}／対象: ${period}`}
        action={
          <Link href={`/reports/${report.id}`}>
            <Button variant="outline">キャンセル</Button>
          </Link>
        }
      />

      {kpiItems.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            この店舗/部門に適用されるKPIテンプレートがありません。
          </CardContent>
        </Card>
      ) : (
        <ReportForm
          mode="edit"
          reportId={report.id}
          initial={initial}
          storeId={storeId}
          departmentId={departmentId}
          unitLabel={unitLabel}
          reportType={type}
          period={period}
          kpiItems={kpiItems.map((k) => ({
            id: k.id,
            name: k.name,
            category: k.category,
            unit: k.unit,
            inputType: k.inputType,
            goodDirection: k.goodDirection,
            hasTarget: k.hasTarget,
            hasCurrent: k.hasCurrent,
            hasForecast: k.hasForecast,
            hasComparison: k.hasComparison,
            required: k.required,
          }))}
          kdiTemplates={kdiItems.map((k) => ({ id: k.id, name: k.name, category: k.category, relatedKpiName: k.relatedKpiName, recommendedFrequency: k.recommendedFrequency }))}
          previousActions={previousActions}
          channels={[...INFLOW_CHANNELS]}
          kpiPrev={kpiPrev}
          kpiMonthStart={{}}
          hiddenKpis={hiddenKpis}
        />
      )}
    </div>
  );
}
