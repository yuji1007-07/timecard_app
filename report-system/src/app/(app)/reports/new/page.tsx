import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getEffectiveKpiItems, getEffectiveKdiItems } from "@/lib/templates";
import { isoWeek, yearMonth } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { ReportSetup, type StoreOpt } from "./report-setup";
import { ReportForm } from "./report-form";
import { INFLOW_CHANNELS, BUSINESS_TYPES, label } from "@/lib/constants";

export default async function NewReportPage({
  searchParams,
}: {
  searchParams: Promise<{ storeId?: string; departmentId?: string; type?: string; period?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireUser();

  const stores = await prisma.store.findMany({
    where: { status: "ACTIVE" },
    include: { departments: { orderBy: { sortOrder: "asc" } } },
    orderBy: { sortOrder: "asc" },
  });

  const isAdmin = user.role === "AREA_MANAGER";
  const isDept = user.role === "DEPARTMENT_MANAGER";

  // スコープ解決
  const storeId = isAdmin ? sp.storeId ?? null : user.storeId;
  const departmentId = isDept ? user.departmentId : sp.departmentId ?? null;
  const type = (sp.type as "WEEKLY" | "MONTHLY") ?? "WEEKLY";
  const period = sp.period ?? (type === "WEEKLY" ? isoWeek(new Date()) : yearMonth(new Date()));

  const storeOpts: StoreOpt[] = stores.map((s) => ({
    id: s.id,
    name: s.name,
    businessType: s.businessType,
    departments: s.departments.map((d) => ({ id: d.id, name: d.name })),
  }));

  const store = storeId ? stores.find((s) => s.id === storeId) : null;
  const needsDepartment = store?.businessType === "COMPLEX" && store.departments.length > 0;
  const resolved = !!store && (!needsDepartment || !!departmentId);

  return (
    <div>
      <PageHeader title="報告を作成" description="店舗・部門のテンプレートに沿って入力フォームが自動生成されます。" />

      <Card className="mb-6">
        <CardContent className="pt-5">
          <ReportSetup
            stores={storeOpts}
            canPickStore={isAdmin}
            canPickDepartment={!isDept}
            storeId={storeId}
            departmentId={departmentId}
            type={type}
            period={period}
          />
        </CardContent>
      </Card>

      {!resolved ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {!store ? "店舗を選択してください。" : "この複合店舗では部門を選択してください。"}
          </CardContent>
        </Card>
      ) : (
        <ResolvedForm storeId={store!.id} departmentId={departmentId} type={type} period={period} storeName={store!.name} businessType={store!.businessType} />
      )}
    </div>
  );
}

async function ResolvedForm({
  storeId,
  departmentId,
  type,
  period,
  storeName,
  businessType,
}: {
  storeId: string;
  departmentId: string | null;
  type: "WEEKLY" | "MONTHLY";
  period: string;
  storeName: string;
  businessType: string;
}) {
  const [kpiItems, kdiItems] = await Promise.all([
    getEffectiveKpiItems({ storeId, departmentId }),
    getEffectiveKdiItems({ storeId, departmentId }),
  ]);

  // 既存の同一期間レポートがあるか
  const existing = await prisma.report.findFirst({
    where: {
      storeId,
      departmentId: departmentId ?? null,
      reportType: type,
      ...(type === "WEEKLY" ? { targetWeek: period } : { targetMonth: period }),
    },
  });

  // 前回報告（差分・前回Action用）
  const prevReport = await prisma.report.findFirst({
    where: { storeId, departmentId: departmentId ?? null, reportType: type, status: "SUBMITTED" },
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

  // 前回報告のKPI値（着地の変化色付け用）
  const kpiPrev: Record<string, { target: number | null; current: number | null; forecast: number | null }> = {};
  for (const v of prevReport?.kpiValues ?? []) {
    kpiPrev[v.kpiName] = { target: v.target, current: v.current, forecast: v.forecast };
  }

  // 当月の最初の報告（月初の目標・着地を反映ボタン用）
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const monthStartReport = await prisma.report.findFirst({
    where: { storeId, departmentId: departmentId ?? null, status: "SUBMITTED", submittedAt: { gte: monthStart, lt: monthEnd } },
    orderBy: { submittedAt: "asc" },
    include: { kpiValues: true },
  });
  const kpiMonthStart: Record<string, { target: number | null; forecast: number | null }> = {};
  for (const v of monthStartReport?.kpiValues ?? []) {
    kpiMonthStart[v.kpiName] = { target: v.target, forecast: v.forecast };
  }

  const dept = departmentId ? await prisma.department.findUnique({ where: { id: departmentId } }) : null;
  const unitLabel = `${storeName}${dept ? ` ${dept.name}` : ""}・${label(BUSINESS_TYPES, dept?.businessType ?? businessType)}`;

  // この店舗/部門で「使わない」KPIの非表示リスト
  const hiddenSource = dept ? dept.hiddenKpis : (await prisma.store.findUnique({ where: { id: storeId } }))?.hiddenKpis;
  let hiddenKpis: string[] = [];
  try {
    const parsed = hiddenSource ? JSON.parse(hiddenSource) : [];
    if (Array.isArray(parsed)) hiddenKpis = parsed.filter((x): x is string => typeof x === "string");
  } catch {
    hiddenKpis = [];
  }

  if (kpiItems.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          この店舗/部門に適用されるKPIテンプレートがありません。先にKPIテンプレートを設定してください。
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      {existing && (
        <div className="mb-4 rounded-md border border-yellow-300 bg-yellow-50 px-4 py-2 text-sm text-yellow-800">
          ※ この対象期間（{period}）には既に報告があります。提出すると別の報告として追加されます。
        </div>
      )}
      <ReportForm
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
      />
    </div>
  );
}
