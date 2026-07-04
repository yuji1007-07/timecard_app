import Link from "next/link";
import { requireUser } from "@/lib/session";
import { isoWeek, yearMonth, fmt } from "@/lib/utils";
import { getDashboardData } from "@/lib/dashboard";
import { getReportUnits } from "@/lib/units";
import { getSubmissionStatus } from "@/lib/dashboard";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ALERT_COLOR_CLASS, PRIORITIES, label, BUSINESS_TYPES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { NotifyButton } from "./notify-button";

// 月次レポートの kpiValues から、名前候補で最初にヒットした値を取り出す
function pickKpi(
  values: { kpiName: string; target: number | null; current: number | null; forecast: number | null }[],
  names: string[]
) {
  for (const n of names) {
    const v = values.find((x) => x.kpiName === n);
    if (v) return v;
  }
  return null;
}

export default async function DashboardPage() {
  const user = await requireUser();
  const week = isoWeek(new Date());

  if (user.role === "AREA_MANAGER") {
    return <AdminDashboard week={week} />;
  }
  return <ManagerDashboard week={week} storeId={user.storeId} departmentId={user.departmentId} name={user.name ?? ""} />;
}

async function AdminDashboard({ week }: { week: string }) {
  const { submission, alerts } = await getDashboardData(week);

  const submitted = submission.filter((s) => s.submitted);
  const unsubmitted = submission.filter((s) => !s.submitted);

  // フィードバック待ち（提出済だが未送信のフィードバック）
  const feedbackWaiting = await prisma.report.count({
    where: { reportType: "WEEKLY", targetWeek: week, status: "SUBMITTED", OR: [{ feedback: null }, { feedback: { sendStatus: "UNSENT" } }] },
  });

  // 店舗別 月次サマリー
  const thisMonth = yearMonth(new Date());
  const units = await getReportUnits();
  const monthlyReports = await prisma.report.findMany({
    where: { reportType: "MONTHLY", status: "SUBMITTED" },
    orderBy: { targetMonth: "asc" },
    include: { kpiValues: true },
  });
  const sameUnit = (r: { storeId: string; departmentId: string | null }, u: { storeId: string; departmentId: string | null }) =>
    r.storeId === u.storeId && (r.departmentId ?? null) === (u.departmentId ?? null);

  const monthlyRows = units.map((u) => {
    const mine = monthlyReports.filter((r) => sameUnit(r, u));
    const thisMonthReport = mine.find((r) => r.targetMonth === thisMonth) ?? null;
    const latest = mine.length > 0 ? mine[mine.length - 1] : null;
    const kv = latest?.kpiValues ?? [];
    const sales = pickKpi(kv, ["総売上"]);
    return {
      unit: u,
      submitted: !!thisMonthReport,
      submittedReportId: thisMonthReport?.id ?? null,
      latestMonth: latest?.targetMonth ?? null,
      budget: sales?.target ?? null, // 予算
      forecast: sales?.forecast ?? null, // 着地
      actual: sales?.current ?? null, // 総売上(実績)
      charts: pickKpi(kv, ["総カルテ枚数", "カルテ枚数"])?.current ?? null,
      freq: pickKpi(kv, ["来店頻度", "通院頻度", "平均来店頻度"])?.current ?? null,
      unitPrice: pickKpi(kv, ["窓口単価", "単価(1回あたり)", "平均窓口単価"])?.current ?? null,
    };
  });

  return (
    <div>
      <PageHeader
        title="管理者ダッシュボード"
        description={`対象週: ${week} ／ 全店舗の状況を一覧で確認できます。`}
        action={<NotifyButton week={week} />}
      />

      {/* サマリーカード */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="今週 提出済" value={`${submitted.length}`} sub={`全${submission.length}単位中`} tone="good" />
        <StatCard label="今週 未提出" value={`${unsubmitted.length}`} sub="要フォロー" tone={unsubmitted.length ? "warn" : "good"} />
        <StatCard label="要注意 該当" value={`${alerts.length}`} sub="条件ヒット数" tone={alerts.length ? "bad" : "good"} />
        <StatCard label="フィードバック待ち" value={`${feedbackWaiting}`} tone={feedbackWaiting ? "warn" : "good"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 提出状況 */}
        <Card>
          <CardHeader>
            <CardTitle>提出状況（週次）</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {submission.map((s) => (
              <div key={s.unit.key} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span>
                  {s.unit.label}
                  <span className="ml-2 text-xs text-muted-foreground">{label(BUSINESS_TYPES, s.unit.businessType)}</span>
                </span>
                {s.submitted ? (
                  s.reportId ? (
                    <Link href={`/reports/${s.reportId}`}>
                      <Badge variant="good">提出済</Badge>
                    </Link>
                  ) : (
                    <Badge variant="good">提出済</Badge>
                  )
                ) : (
                  <Badge variant="bad">未提出</Badge>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* 要注意店舗 */}
        <Card>
          <CardHeader>
            <CardTitle>要注意店舗</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts.length === 0 && <p className="text-sm text-muted-foreground">該当する店舗はありません。</p>}
            {alerts.map((a, i) => (
              <div key={i} className={cn("rounded-md border px-3 py-2 text-sm", ALERT_COLOR_CLASS[a.condition.color])}>
                <div className="flex items-center justify-between">
                  <span className="font-medium">{a.unit.label}</span>
                  <Badge variant="outline" className="bg-white/60">
                    優先度: {label(PRIORITIES, a.condition.priority)}
                  </Badge>
                </div>
                <div className="mt-0.5 text-xs">
                  {a.condition.name} — {a.reason}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* 店舗別 月次サマリー */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>店舗別 月次サマリー（{thisMonth} の提出状況＋最新月次の数値）</CardTitle>
          <p className="text-xs text-muted-foreground">
            月次の提出状況と、各店舗の最新月次報告の 総売上/予算/着地 などを一覧化。数値は「最新の月次報告」から表示します。
          </p>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <div className="min-w-[820px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>店舗 / 単位</TableHead>
                  <TableHead>月次提出</TableHead>
                  <TableHead className="text-right">総売上(実績)</TableHead>
                  <TableHead className="text-right">予算</TableHead>
                  <TableHead className="text-right">着地</TableHead>
                  <TableHead className="text-right">総カルテ</TableHead>
                  <TableHead className="text-right">来店頻度</TableHead>
                  <TableHead className="text-right">窓口単価</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlyRows.map((r) => {
                  const under = r.budget != null && r.actual != null && r.actual < r.budget;
                  return (
                    <TableRow key={r.unit.key}>
                      <TableCell className="whitespace-nowrap font-medium">
                        {r.unit.label}
                        <span className="ml-2 text-xs text-muted-foreground">{label(BUSINESS_TYPES, r.unit.businessType)}</span>
                      </TableCell>
                      <TableCell>
                        {r.submitted && r.submittedReportId ? (
                          <Link href={`/reports/${r.submittedReportId}`}><Badge variant="good">提出済</Badge></Link>
                        ) : (
                          <Badge variant="bad">未提出</Badge>
                        )}
                      </TableCell>
                      <TableCell className={`text-right tabular-nums ${under ? "font-semibold text-red-600" : ""}`}>{fmt(r.actual)}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{fmt(r.budget)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(r.forecast)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(r.charts)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(r.freq)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(r.unitPrice)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <p className="px-4 py-3 text-xs text-muted-foreground">※ 「月次提出」は今月（{thisMonth}）の提出有無。数値は各店舗の最新月次報告のものです（提出月が違う場合があります）。</p>
        </CardContent>
      </Card>
    </div>
  );
}

async function ManagerDashboard({
  week,
  storeId,
  departmentId,
  name,
}: {
  week: string;
  storeId: string | null;
  departmentId: string | null;
  name: string;
}) {
  if (!storeId) {
    return (
      <div>
        <PageHeader title="ダッシュボード" />
        <p className="text-sm text-muted-foreground">担当店舗が割り当てられていません。管理者にお問い合わせください。</p>
      </div>
    );
  }

  const store = await prisma.store.findUnique({ where: { id: storeId }, include: { departments: true } });
  // 自分の単位の提出状況
  const allUnits = await getReportUnits({ storeId });
  const myUnits = departmentId ? allUnits.filter((u) => u.departmentId === departmentId) : allUnits;
  const submission = await getSubmissionStatus(week, myUnits);

  const latestReport = await prisma.report.findFirst({
    where: { storeId, departmentId: departmentId ?? undefined, reportType: "WEEKLY" },
    orderBy: { submittedAt: "desc" },
    include: { kpiValues: true, feedback: true },
  });

  return (
    <div>
      <PageHeader
        title={`${store?.name ?? ""} ダッシュボード`}
        description={`${name} さん ／ 対象週: ${week}`}
        action={
          <Link href="/reports/new">
            <Button>今週の報告を入力</Button>
          </Link>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        {submission.map((s) => (
          <Card key={s.unit.key} className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{s.unit.label}</div>
                <div className="text-xs text-muted-foreground">今週の週次報告</div>
              </div>
              {s.submitted ? <Badge variant="good">提出済</Badge> : <Badge variant="bad">未提出</Badge>}
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>直近の報告</CardTitle>
          </CardHeader>
          <CardContent>
            {latestReport ? (
              <div className="space-y-2 text-sm">
                <div>対象週: {latestReport.targetWeek}</div>
                <div className="grid grid-cols-2 gap-2">
                  {latestReport.kpiValues.slice(0, 6).map((v) => (
                    <div key={v.id} className="rounded-md border px-2 py-1.5">
                      <div className="text-xs text-muted-foreground">{v.kpiName}</div>
                      <div className="font-semibold tabular-nums">{fmt(v.current, { suffix: v.unit ?? "" })}</div>
                    </div>
                  ))}
                </div>
                <Link href={`/reports/${latestReport.id}`} className="inline-block">
                  <Button variant="outline" size="sm">
                    報告の詳細を見る
                  </Button>
                </Link>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">まだ報告がありません。「今週の報告を入力」から提出してください。</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>フィードバック</CardTitle>
          </CardHeader>
          <CardContent>
            {latestReport?.feedback?.editedContent || latestReport?.feedback?.aiContent ? (
              <div className="whitespace-pre-wrap text-sm">
                {latestReport.feedback.editedContent || latestReport.feedback.aiContent}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">エリアマネージャーからのフィードバックはまだありません。</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
