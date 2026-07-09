import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { KpiTrendChart, type TrendPoint } from "@/components/kpi-trend-chart";
import { REPORT_TYPES, KDI_STATUS, label } from "@/lib/constants";
import { fmt, weekLabel } from "@/lib/utils";

/** 店舗（または部門）スコープの履歴・推移を表示するパネル。 */
export async function ScopePanel({ storeId, departmentId }: { storeId: string; departmentId: string | null }) {
  const reports = await prisma.report.findMany({
    where: { storeId, departmentId: departmentId ?? null },
    include: { kpiValues: true, feedback: true, reporter: true, progresses: { include: { previousAction: true } } },
    orderBy: [{ targetWeek: "asc" }, { submittedAt: "asc" }],
  });

  const weekly = reports.filter((r) => r.reportType === "WEEKLY");
  const monthly = reports.filter((r) => r.reportType === "MONTHLY");

  // KPI推移データ（直近8件）
  const recent = weekly.slice(-8);
  const salesTrend: TrendPoint[] = recent.map((r) => ({
    week: r.targetWeek ?? "",
    売上: r.kpiValues.find((v) => v.kpiName === "売上")?.current ?? null,
  }));
  const rateTrend: TrendPoint[] = recent.map((r) => ({
    week: r.targetWeek ?? "",
    成約率: r.kpiValues.find((v) => v.kpiName === "成約率")?.current ?? null,
    離反率: r.kpiValues.find((v) => v.kpiName === "離反率")?.current ?? null,
  }));

  // 未完了Action履歴 / 成功Action履歴
  const unfinished = reports
    .flatMap((r) => r.progresses.map((p) => ({ ...p, week: r.targetWeek })))
    .filter((p) => p.status === "NOT_DONE" || p.status === "PARTIAL")
    .slice(-10)
    .reverse();

  const successActions = await prisma.successAction.findMany({
    where: { storeId, departmentId: departmentId ?? null },
    orderBy: { createdAt: "desc" },
  });

  const feedbacks = reports
    .filter((r) => r.feedback && (r.feedback.editedContent || r.feedback.aiContent))
    .map((r) => ({ report: r, fb: r.feedback! }))
    .reverse();

  return (
    <div className="space-y-6">
      {/* KPI推移 */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>売上推移</CardTitle>
          </CardHeader>
          <CardContent>
            <KpiTrendChart data={salesTrend} series={["売上"]} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>成約率・離反率 推移</CardTitle>
          </CardHeader>
          <CardContent>
            <KpiTrendChart data={rateTrend} series={["成約率", "離反率"]} />
          </CardContent>
        </Card>
      </div>

      {/* 過去報告 */}
      <Card>
        <CardHeader>
          <CardTitle>過去報告（週次 {weekly.length}件 / 月次 {monthly.length}件）</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {reports.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">報告がありません。</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>区分</TableHead>
                  <TableHead>対象</TableHead>
                  <TableHead>報告者</TableHead>
                  <TableHead>売上</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...reports].reverse().map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Badge variant={r.reportType === "WEEKLY" ? "secondary" : "default"}>{label(REPORT_TYPES, r.reportType)}</Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{r.targetWeek ? weekLabel(r.targetWeek) : r.targetMonth}</TableCell>
                    <TableCell className="text-muted-foreground">{r.reporter.name}</TableCell>
                    <TableCell className="tabular-nums">{fmt(r.kpiValues.find((v) => v.kpiName === "売上")?.current, { suffix: "円" })}</TableCell>
                    <TableCell>
                      <Link href={`/reports/${r.id}`}>
                        <Button variant="outline" size="sm">
                          詳細
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 前回Action未完了履歴 */}
        <Card>
          <CardHeader>
            <CardTitle>前回Action 未完了履歴</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {unfinished.length === 0 ? (
              <p className="text-sm text-muted-foreground">未完了のActionはありません。</p>
            ) : (
              unfinished.map((p) => (
                <div key={p.id} className="rounded-md border px-3 py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{p.previousAction.content}</span>
                    <Badge variant={p.status === "NOT_DONE" ? "bad" : "warn"}>{label(KDI_STATUS, p.status)}</Badge>
                  </div>
                  {p.comment && <div className="mt-0.5 text-xs text-muted-foreground">{p.comment}</div>}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* 成功Action履歴 */}
        <Card>
          <CardHeader>
            <CardTitle>成功Action履歴</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {successActions.length === 0 ? (
              <p className="text-sm text-muted-foreground">成功Actionはまだありません。</p>
            ) : (
              successActions.map((a) => (
                <div key={a.id} className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm">
                  <div className="font-medium">{a.content}</div>
                  <div className="mt-0.5 text-xs text-green-800">
                    {a.relatedKpi}: {fmt(a.beforeValue)} → {fmt(a.afterValue)}（差分 {fmt(a.diff)}）
                  </div>
                  {a.reasonComment && <div className="mt-0.5 text-xs text-muted-foreground">{a.reasonComment}</div>}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* フィードバック履歴 */}
      <Card>
        <CardHeader>
          <CardTitle>フィードバック履歴</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {feedbacks.length === 0 ? (
            <p className="text-sm text-muted-foreground">フィードバックはまだありません。</p>
          ) : (
            feedbacks.map(({ report, fb }) => (
              <div key={fb.id} className="rounded-md border p-3">
                <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{report.targetWeek ? weekLabel(report.targetWeek) : report.targetMonth}</span>
                  <Badge variant={fb.sendStatus === "SENT" ? "good" : "muted"}>{fb.sendStatus === "SENT" ? "送信済" : "未送信"}</Badge>
                </div>
                <div className="whitespace-pre-wrap text-sm">{fb.editedContent || fb.aiContent}</div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
