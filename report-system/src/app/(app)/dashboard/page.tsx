import Link from "next/link";
import { requireUser } from "@/lib/session";
import { isoWeek, fmt } from "@/lib/utils";
import { getDashboardData } from "@/lib/dashboard";
import { getReportUnits } from "@/lib/units";
import { getSubmissionStatus } from "@/lib/dashboard";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ALERT_COLOR_CLASS, PRIORITIES, label, BUSINESS_TYPES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { NotifyButton } from "./notify-button";

export default async function DashboardPage() {
  const user = await requireUser();
  const week = isoWeek(new Date());

  if (user.role === "AREA_MANAGER") {
    return <AdminDashboard week={week} />;
  }
  return <ManagerDashboard week={week} storeId={user.storeId} departmentId={user.departmentId} name={user.name ?? ""} />;
}

async function AdminDashboard({ week }: { week: string }) {
  const { submission, summary, alerts } = await getDashboardData(week);

  const submitted = submission.filter((s) => s.submitted);
  const unsubmitted = submission.filter((s) => !s.submitted);

  // フィードバック待ち（提出済だが未送信のフィードバック）
  const feedbackWaiting = await prisma.report.count({
    where: { reportType: "WEEKLY", targetWeek: week, status: "SUBMITTED", OR: [{ feedback: null }, { feedback: { sendStatus: "UNSENT" } }] },
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

      {/* KPIサマリー */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>KPIサマリー（今週・提出済の合算）</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="全体売上" value={fmt(summary.totalSales, { suffix: "円" })} />
            <StatCard label="整骨院売上" value={fmt(summary.salesByType.SEIKOTSU, { suffix: "円" })} />
            <StatCard label="鍼灸売上" value={fmt(summary.salesByType.SHINKYU, { suffix: "円" })} />
            <StatCard label="エステ売上" value={fmt(summary.salesByType.ESTHE, { suffix: "円" })} />
            <StatCard label="初診数" value={fmt(summary.firstVisits, { suffix: "人" })} />
            <StatCard label="新規数" value={fmt(summary.newCustomers, { suffix: "人" })} />
            <StatCard label="会員数" value={fmt(summary.members, { suffix: "人" })} />
            <StatCard label="カルテ枚数" value={fmt(summary.charts, { suffix: "枚" })} />
            <StatCard label="平均成約率" value={summary.avgClosingRate != null ? `${summary.avgClosingRate}%` : "-"} />
            <StatCard label="平均離反率" value={summary.avgChurnRate != null ? `${summary.avgChurnRate}%` : "-"} tone="warn" />
            <StatCard label="未達KPI数" value={`${summary.unmetCount}`} tone={summary.unmetCount ? "bad" : "good"} />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">※ ダッシュボードの表示項目はKPIテンプレートの「ダッシュボード表示」設定で調整できます。</p>
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
