import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getEffectiveKpiItems, getEffectiveKdiItems } from "@/lib/templates";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ReportForm, type ReportInitial, type ProjMap } from "../../new/report-form";
import { updateReportPeriod } from "../../actions";
import { addMonthStr, weekLabel, monthWeek, jstNow, MONTH_WEEK_RANGES } from "@/lib/utils";
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
      projections: true,
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
  // 週次の対象期間フォーム用に 月(YYYY-MM) と 週番号 に分解（旧形式・不正値は今日基準）
  const wm = /^(\d{4}-\d{2})-W([1-5])$/.exec(period) ?? /^(\d{4}-\d{2})-W([1-5])$/.exec(monthWeek(jstNow()))!;
  const weekYm = wm[1];
  const weekN = Number(wm[2]);

  const [kpiItems, kdiItems] = await Promise.all([
    getEffectiveKpiItems({ storeId, departmentId }),
    getEffectiveKdiItems({ storeId, departmentId }),
  ]);

  // このレポートより前の報告（前回Action・差分の色付け用）
  // 提出日ではなく対象期間で選ぶ（提出が前後しても必ず対象より前の直近の報告になる）
  const prevReport = await prisma.report.findFirst({
    where: {
      storeId,
      departmentId: departmentId ?? null,
      reportType: type,
      status: "SUBMITTED",
      id: { not: report.id },
      ...(type === "WEEKLY" ? { targetWeek: { lt: period } } : { targetMonth: { lt: period } }),
    },
    orderBy: type === "WEEKLY" ? { targetWeek: "desc" } : { targetMonth: "desc" },
    include: { kpiValues: true, actions: true, projections: true },
  });

  // 「月初の目標・着地を反映」用: 対象月の最初の週次報告（自分自身は除く）
  const monthStartReport = await prisma.report.findFirst({
    where: {
      storeId,
      departmentId: departmentId ?? null,
      status: "SUBMITTED",
      reportType: "WEEKLY",
      id: { not: report.id },
      targetWeek: { startsWith: `${period.slice(0, 7)}-W`, ...(type === "WEEKLY" ? { lt: period } : {}) },
    },
    orderBy: { targetWeek: "asc" },
    include: { kpiValues: true },
  });
  // 同名KPIの取り違えを防ぐため ID を主キーにし、名前は旧データ用のフォールバックとして併記する
  const kpiMonthStart: Record<string, { target: number | null; forecast: number | null }> = {};
  for (const v of monthStartReport?.kpiValues ?? []) {
    const val = { target: v.target, forecast: v.forecast };
    kpiMonthStart[v.kpiItemId] = val;
    if (!(v.kpiName in kpiMonthStart)) kpiMonthStart[v.kpiName] = val;
  }

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
    const val = { target: v.target, current: v.current, forecast: v.forecast };
    kpiPrev[v.kpiItemId] = val;
    if (!(v.kpiName in kpiPrev)) kpiPrev[v.kpiName] = val;
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
  // 保存値は KPI項目ID で引き当てる（同名KPIがあっても値・コメントが混ざらない）
  const kpiById: ReportInitial["kpiById"] = {};
  const kpiByName: ReportInitial["kpiByName"] = {};
  for (const v of report.kpiValues) {
    const val = { target: s(v.target), current: s(v.current), forecast: s(v.forecast), comment: v.comment ?? "" };
    kpiById[v.kpiItemId] = val;
    if (!(v.kpiName in kpiByName)) kpiByName[v.kpiName] = val;
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

  // 月次：3ヶ月予測（このレポートの保存値）＋前月からの引き継ぎ
  const forwardMonths = type === "MONTHLY" ? [1, 2, 3].map((n) => addMonthStr(period, n)) : [];
  const projections: ProjMap = {};
  for (const p of report.projections) {
    projections[p.kpiName] = projections[p.kpiName] ?? {};
    projections[p.kpiName][p.targetMonth] = { budget: s(p.budget), forecast: s(p.forecast) };
  }
  const kpiCarry: Record<string, { budget: string; forecast: string }> = {};
  const projCarry: ProjMap = {};
  let carryFromMonth: string | null = null;
  if (type === "MONTHLY") {
    // 前月が未提出でも取り込めるように、対象月より前の月次報告を新しい順に遡って探す
    const candidates = await prisma.report.findMany({
      where: {
        storeId,
        departmentId: departmentId ?? null,
        reportType: "MONTHLY",
        status: "SUBMITTED",
        id: { not: report.id },
        targetMonth: { lt: period },
      },
      orderBy: { targetMonth: "desc" },
      take: 6,
      select: { targetMonth: true, projections: true },
    });
    const wanted = [period, ...forwardMonths];
    const source =
      candidates.find((c) => c.projections.some((p) => p.targetMonth === period)) ??
      candidates.find((c) => c.projections.some((p) => wanted.includes(p.targetMonth))) ??
      null;
    if (source) {
      carryFromMonth = source.targetMonth;
      for (const p of source.projections) {
        if (p.targetMonth === period) kpiCarry[p.kpiName] = { budget: s(p.budget), forecast: s(p.forecast) };
        if (forwardMonths.includes(p.targetMonth)) {
          projCarry[p.kpiName] = projCarry[p.kpiName] ?? {};
          projCarry[p.kpiName][p.targetMonth] = { budget: s(p.budget), forecast: s(p.forecast) };
        }
      }
    }
  }

  const initial: ReportInitial = {
    originalText: report.originalText ?? "",
    kpiById,
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
    projections,
  };

  const unitLabel = `${report.store.name}${report.department ? ` ${report.department.name}` : ""}・${label(
    BUSINESS_TYPES,
    report.department?.businessType ?? report.store.businessType
  )}`;

  const isDraft = report.status === "DRAFT";

  return (
    <div>
      <PageHeader
        title={isDraft ? "下書きの続きを入力" : "報告を修正"}
        description={`${unitLabel}／対象: ${type === "WEEKLY" ? weekLabel(period, { withYear: true }) : period}${isDraft ? "（下書き・未提出）" : ""}`}
        action={
          <Link href={isDraft ? "/reports" : `/reports/${report.id}`}>
            <Button variant="outline">キャンセル</Button>
          </Link>
        }
      />

      {/* 対象期間の修正（例: 6月なのに7月で提出した等） */}
      <Card className="mb-4 border-amber-300">
        <CardContent className="pt-5">
          <form action={updateReportPeriod} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="reportId" value={report.id} />
            <div className="space-y-1.5">
              <label className="text-sm font-medium">対象{type === "MONTHLY" ? "月" : "週"}の修正</label>
              {type === "MONTHLY" ? (
                <input type="month" name="value" defaultValue={period} className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm" />
              ) : (
                <div className="flex gap-2">
                  <input type="month" name="wmonth" defaultValue={weekYm} className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm" />
                  <select name="wweek" defaultValue={weekN} className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm">
                    {MONTH_WEEK_RANGES.map((range, i) => (
                      <option key={i + 1} value={i + 1}>第{i + 1}週（{range}）</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <Button type="submit" variant="outline">この対象に修正</Button>
            <p className="text-xs text-muted-foreground">
              「6月なのに7月で提出した」等、対象{type === "MONTHLY" ? "月" : "週"}だけを直せます（他の入力は消えません）。
            </p>
          </form>
        </CardContent>
      </Card>

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
          initialStatus={report.status}
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
          kpiMonthStart={kpiMonthStart}
          hiddenKpis={hiddenKpis}
          forwardMonths={forwardMonths}
          kpiCarry={kpiCarry}
          projCarry={projCarry}
          carryFromMonth={carryFromMonth}
          monthStartLabel={monthStartReport?.targetWeek ? weekLabel(monthStartReport.targetWeek, { short: true }) : null}
          prevPeriodLabel={
            type === "WEEKLY" && prevReport?.targetWeek ? weekLabel(prevReport.targetWeek, { short: true }) : null
          }
        />
      )}
    </div>
  );
}
