import { Fragment } from "react";
import { requireAreaManager } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmt, addMonthStr, monthShort, yearMonth } from "@/lib/utils";
import { TrendPicker } from "./trend-picker";

export const dynamic = "force-dynamic";

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

type KpiDef = { name: string; unit: string | null; category: string; goodDirection: string };

// レポートの kpiValues から KPI一覧（カテゴリ順）を作る
function buildKpiList(kpiValues: { kpiName: string; unit: string | null; kpiItem: { category: string | null; goodDirection: string } | null }[]): { category: string; items: KpiDef[] }[] {
  const order: string[] = [];
  const map = new Map<string, KpiDef[]>();
  const seen = new Set<string>();
  for (const v of kpiValues) {
    if (seen.has(v.kpiName)) continue;
    seen.add(v.kpiName);
    const c = v.kpiItem?.category || "その他";
    if (!map.has(c)) {
      map.set(c, []);
      order.push(c);
    }
    map.get(c)!.push({ name: v.kpiName, unit: v.unit, category: c, goodDirection: v.kpiItem?.goodDirection ?? "UP" });
  }
  return order.map((c) => ({ category: c, items: map.get(c)! }));
}

export default async function TrendsPage({
  searchParams,
}: {
  searchParams: Promise<{ storeId?: string; departmentId?: string; type?: string }>;
}) {
  const sp = await searchParams;
  await requireAreaManager();

  const stores = await prisma.store.findMany({
    where: { status: "ACTIVE" },
    include: { departments: { orderBy: { sortOrder: "asc" } } },
    orderBy: { sortOrder: "asc" },
  });

  const storeId = sp.storeId ?? stores[0]?.id ?? null;
  const store = stores.find((s) => s.id === storeId) ?? null;
  const needsDept = store?.businessType === "COMPLEX" && store.departments.length > 0;
  const departmentId = sp.departmentId ?? null;
  const type: "WEEKLY" | "MONTHLY" = sp.type === "WEEKLY" ? "WEEKLY" : "MONTHLY";

  const storeOpts = stores.map((s) => ({
    id: s.id,
    name: s.name,
    businessType: s.businessType,
    departments: s.departments.map((d) => ({ id: d.id, name: d.name })),
  }));

  const picker = <TrendPicker stores={storeOpts} storeId={storeId} departmentId={departmentId} type={type} />;

  const header = (
    <PageHeader title="店舗別 推移・比較" description="店舗を選ぶと、送られてきた週次/月次を時系列で比較できます（本部専用）。" />
  );

  if (!store || (needsDept && !departmentId)) {
    return (
      <div>
        {header}
        <Card className="mb-4"><CardContent className="pt-5">{picker}</CardContent></Card>
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">{!store ? "店舗を選択してください。" : "この複合店舗では部門を選択してください。"}</CardContent></Card>
      </div>
    );
  }

  const scope = { storeId: store.id, departmentId: departmentId ?? null, status: "SUBMITTED" as const };

  let body: React.ReactNode;

  if (type === "MONTHLY") {
    const reports = await prisma.report.findMany({
      where: { ...scope, reportType: "MONTHLY" },
      orderBy: { targetMonth: "asc" },
      include: { kpiValues: { include: { kpiItem: { select: { category: true, goodDirection: true } } } }, projections: true },
    });

    if (reports.length === 0) {
      body = <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">この店舗の月次報告がまだありません。</CardContent></Card>;
    } else {
      const anchor = reports[reports.length - 1].targetMonth ?? yearMonth(new Date());
      const baseYear = Number(anchor.slice(0, 4));
      // 列: 過去3ヶ月 → 当月 → 来月・再来月
      const cols = [-3, -2, -1, 0, 1, 2].map((n) => addMonthStr(anchor, n));
      const futureSet = new Set([addMonthStr(anchor, 1), addMonthStr(anchor, 2)]);

      // 月→レポート
      const monthReport = new Map(reports.map((r) => [r.targetMonth ?? "", r]));
      // KPI値: month__kpiName → {予算,着地,実績}
      const kpiCell = new Map<string, { budget: number | null; forecast: number | null; actual: number | null }>();
      for (const r of reports) {
        for (const v of r.kpiValues) kpiCell.set(`${r.targetMonth}__${v.kpiName}`, { budget: v.target, forecast: v.forecast, actual: v.current });
      }
      // 予測: month__kpiName → {予算,予測}（最新のレポートが勝つ）
      const projCell = new Map<string, { budget: number | null; forecast: number | null }>();
      for (const r of reports) {
        for (const p of r.projections) projCell.set(`${p.targetMonth}__${p.kpiName}`, { budget: p.budget, forecast: p.forecast });
      }

      // KPI一覧は最新レポート基準
      const groups = buildKpiList(reports[reports.length - 1].kpiValues);

      body = (
        <Card>
          <CardHeader>
            <CardTitle>月次の推移（{store.name}{store.departments.find((d) => d.id === departmentId)?.name ? ` ${store.departments.find((d) => d.id === departmentId)!.name}` : ""}）</CardTitle>
            <p className="text-xs text-muted-foreground">
              過去（予算/実績）→ <span className="font-medium">当月（{monthShort(anchor, baseYear)}）</span> → 来月以降（予算/予測）。着地/実績が予算に届かない項目は<span className="font-medium text-red-600">赤文字</span>。
            </p>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <div className="min-w-[980px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-card">KPI</TableHead>
                    {cols.map((m) => (
                      <TableHead key={m} className={`text-center ${m === anchor ? "text-navy font-bold" : ""}`}>
                        {monthShort(m, baseYear)}
                        <div className="text-[10px] font-normal text-muted-foreground">{futureSet.has(m) ? "予算/予測" : m === anchor ? "予算/実績" : "予算/実績"}</div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groups.map((g, gi) => (
                    <Fragment key={g.category}>
                      <TableRow className="border-0 hover:bg-transparent">
                        <TableCell colSpan={cols.length + 1} className={`py-1 text-xs font-bold ${CATEGORY_COLORS[gi % CATEGORY_COLORS.length]}`}>{g.category}</TableCell>
                      </TableRow>
                      {g.items.map((k) => (
                        <TableRow key={k.name}>
                          <TableCell className="sticky left-0 whitespace-nowrap bg-card font-medium">{k.name}<span className="ml-1 text-xs text-muted-foreground">{k.unit}</span></TableCell>
                          {cols.map((m) => {
                            const isFuture = futureSet.has(m);
                            const hasReport = monthReport.has(m);
                            if (isFuture) {
                              const p = projCell.get(`${m}__${k.name}`);
                              return (
                                <TableCell key={m} className="text-right text-xs tabular-nums">
                                  <div className="text-muted-foreground">予 {fmt(p?.budget ?? null)}</div>
                                  <div>測 {fmt(p?.forecast ?? null)}</div>
                                </TableCell>
                              );
                            }
                            if (!hasReport) return <TableCell key={m} className="text-center text-xs text-muted-foreground">—</TableCell>;
                            const c = kpiCell.get(`${m}__${k.name}`);
                            const under = c?.budget != null && c?.actual != null && (k.goodDirection === "UP" ? c.actual < c.budget : c.actual > c.budget);
                            return (
                              <TableCell key={m} className={`text-right text-xs tabular-nums ${m === anchor ? "bg-navy/5" : ""}`}>
                                <div className="text-muted-foreground">予 {fmt(c?.budget ?? null)}</div>
                                <div className={under ? "font-semibold text-red-600" : "font-semibold"}>実 {fmt(c?.actual ?? null)}</div>
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      );
    }
  } else {
    // 週次：直近8週の推移（現状値を横並び）
    const recent = await prisma.report.findMany({
      where: { ...scope, reportType: "WEEKLY" },
      orderBy: { targetWeek: "desc" },
      take: 8,
      include: { kpiValues: { include: { kpiItem: { select: { category: true, goodDirection: true } } } } },
    });
    const weeks = [...recent].reverse();

    if (weeks.length === 0) {
      body = <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">この店舗の週次報告がまだありません。</CardContent></Card>;
    } else {
      const cellMap = new Map<string, { target: number | null; current: number | null }>();
      for (const r of weeks) {
        for (const v of r.kpiValues) cellMap.set(`${r.targetWeek}__${v.kpiName}`, { target: v.target, current: v.current });
      }
      const groups = buildKpiList(weeks[weeks.length - 1].kpiValues);
      const weekLabels = weeks.map((r) => (r.targetWeek ?? "").replace(/^\d{4}-/, ""));

      body = (
        <Card>
          <CardHeader>
            <CardTitle>週次の推移（直近{weeks.length}週）</CardTitle>
            <p className="text-xs text-muted-foreground">各週の<span className="font-medium">現状値</span>を横並びで表示。目標に届かない週は<span className="font-medium text-red-600">赤文字</span>。</p>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <div style={{ minWidth: 300 + weeks.length * 90 }}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-card">KPI</TableHead>
                    {weeks.map((r, i) => (
                      <TableHead key={r.id} className={`text-center ${i === weeks.length - 1 ? "font-bold text-navy" : ""}`}>{weekLabels[i]}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groups.map((g, gi) => (
                    <Fragment key={g.category}>
                      <TableRow className="border-0 hover:bg-transparent">
                        <TableCell colSpan={weeks.length + 1} className={`py-1 text-xs font-bold ${CATEGORY_COLORS[gi % CATEGORY_COLORS.length]}`}>{g.category}</TableCell>
                      </TableRow>
                      {g.items.map((k) => (
                        <TableRow key={k.name}>
                          <TableCell className="sticky left-0 whitespace-nowrap bg-card font-medium">{k.name}<span className="ml-1 text-xs text-muted-foreground">{k.unit}</span></TableCell>
                          {weeks.map((r) => {
                            const c = cellMap.get(`${r.targetWeek}__${k.name}`);
                            const under = c?.target != null && c?.current != null && (k.goodDirection === "UP" ? c.current < c.target : c.current > c.target);
                            return (
                              <TableCell key={r.id} className={`text-right text-xs tabular-nums ${under ? "font-semibold text-red-600" : ""}`}>
                                {fmt(c?.current ?? null)}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      );
    }
  }

  return (
    <div>
      {header}
      <Card className="mb-4"><CardContent className="pt-5">{picker}</CardContent></Card>
      {body}
    </div>
  );
}
