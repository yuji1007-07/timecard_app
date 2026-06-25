import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getReportAnalysis, CONSISTENCY_VARIANT } from "@/lib/report-analysis";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendBadge } from "@/components/trend-badge";
import { FeedbackPanel } from "./feedback-panel";
import { fmt } from "@/lib/utils";
import { REPORT_TYPES, KDI_STATUS, BUSINESS_TYPES, FREQUENCIES, label } from "@/lib/constants";

const KDI_CHECK_LABEL = { OK: "問題なし", WARN: "注意", FIX: "要修正" } as const;
const KDI_CHECK_VARIANT = { OK: "good", WARN: "warn", FIX: "bad" } as const;

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const analysis = await getReportAnalysis(id);
  if (!analysis) notFound();

  const { report, diffRows, progressResults, unmetKpiNames, kdiCheck } = analysis;

  // 権限チェック
  if (user.role !== "AREA_MANAGER") {
    if (user.storeId !== report.storeId) redirect("/dashboard");
    if (user.role === "DEPARTMENT_MANAGER" && user.departmentId !== report.departmentId) redirect("/dashboard");
  }
  const isAdmin = user.role === "AREA_MANAGER";
  const feedbackContent = report.feedback?.editedContent || report.feedback?.aiContent || "";

  return (
    <div>
      <PageHeader
        title={`${report.store.name}${report.department ? ` ${report.department.name}` : ""} の報告`}
        description={`${label(REPORT_TYPES, report.reportType)}／対象: ${report.targetWeek ?? report.targetMonth}／報告者: ${report.reporter.name}／${label(BUSINESS_TYPES, report.department?.businessType ?? report.store.businessType)}`}
        action={
          <Link href={`/stores/${report.storeId}`}>
            <Button variant="outline">店舗カルテ</Button>
          </Link>
        }
      />

      {/* 報告原本（原文） */}
      {report.originalText && (
        <Card className="mb-6 border-navy/30">
          <CardHeader>
            <CardTitle>報告原本（原文）</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap break-words rounded-md bg-muted/40 p-4 font-sans text-sm leading-relaxed">{report.originalText}</pre>
          </CardContent>
        </Card>
      )}

      {/* KPI差分比較 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>前回指数との差分</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>KPI名</TableHead>
                <TableHead className="text-right">前回</TableHead>
                <TableHead className="text-right">今回</TableHead>
                <TableHead className="text-right">差分</TableHead>
                <TableHead className="text-right">増減率</TableHead>
                <TableHead>判定</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {diffRows.map((r) => (
                <TableRow key={r.kpiName}>
                  <TableCell className="font-medium">{r.kpiName}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(r.prev)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(r.curr)}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.diff == null ? "-" : `${r.diff > 0 ? "+" : ""}${r.diff}`}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.rate == null ? "-" : `${r.rate}%`}</TableCell>
                  <TableCell><TrendBadge trend={r.trend} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 前回KDIと結果の接続チェック */}
      {progressResults.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>前回KDI/Actionの進捗と結果の接続チェック</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {progressResults.map(({ progress: p, consistency }) => (
              <div key={p.id} className="rounded-md border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{p.previousAction.content}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="muted">{label(KDI_STATUS, p.status)}</Badge>
                    <Badge variant={CONSISTENCY_VARIANT[consistency.judgement]}>{consistency.judgement}</Badge>
                  </div>
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {p.previousAction.relatedKpiName && (
                    <span className="mr-2">
                      関連KPI {p.previousAction.relatedKpiName}: {fmt(p.prevKpiValue)} → {fmt(p.currentKpiValue)}
                      {p.diff != null && `（差分 ${p.diff > 0 ? "+" : ""}${p.diff}）`}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm">{consistency.comment}</p>
                {p.comment && <p className="mt-1 text-xs text-muted-foreground">現場コメント: {p.comment}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* KDI整合性チェック */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            今回KDIの整合性チェック
            <Badge variant={KDI_CHECK_VARIANT[kdiCheck.level]}>{KDI_CHECK_LABEL[kdiCheck.level]}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {unmetKpiNames.length > 0 && (
            <p className="mb-2 text-sm">
              未達KPI: {unmetKpiNames.map((n) => <Badge key={n} variant="bad" className="mr-1">{n}</Badge>)}
            </p>
          )}
          <ul className="space-y-1 text-sm">
            {kdiCheck.messages.map((m, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-muted-foreground">•</span>
                {m}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* KPI値 */}
        <Card>
          <CardHeader>
            <CardTitle>KPI入力値</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>KPI</TableHead>
                  <TableHead className="text-right">目標</TableHead>
                  <TableHead className="text-right">現状</TableHead>
                  <TableHead className="text-right">着地</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.kpiValues.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium">{v.kpiName}<span className="ml-1 text-xs text-muted-foreground">{v.unit}</span></TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(v.target)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(v.current)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(v.forecast)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* 振り返り + 流入 */}
        <Card>
          <CardHeader>
            <CardTitle>振り返り・流入経路</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {report.inflows.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {report.inflows.map((i) => (
                  <Badge key={i.id} variant="secondary">{i.channel}: {i.count}</Badge>
                ))}
              </div>
            )}
            <ReviewLine label="良かった点" value={report.goodPoints} />
            <ReviewLine label="悪かった点" value={report.badPoints} />
            <ReviewLine label="数値から見た課題" value={report.dataIssues} />
            <ReviewLine label="実施したこと" value={report.doneThings} />
            <ReviewLine label="未実施だったこと" value={report.notDoneThings} />
          </CardContent>
        </Card>
      </div>

      {/* 今回KDI / Action */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>今回のKDI</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {report.kdis.length === 0 ? (
              <p className="text-sm text-muted-foreground">KDIの入力はありません。</p>
            ) : (
              report.kdis.map((k) => (
                <div key={k.id} className="rounded-md border px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{k.name}</span>
                    {k.relatedKpiName && <Badge variant="outline">{k.relatedKpiName}</Badge>}
                    <Badge variant="muted">{label(KDI_STATUS, k.status)}</Badge>
                    {k.frequency && <Badge variant="secondary">{label(FREQUENCIES, k.frequency)}</Badge>}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {[k.assignee && `担当: ${k.assignee}`, k.deadline && `期限: ${k.deadline}`, k.count != null && `実施回数: ${k.count}`].filter(Boolean).join(" / ")}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{report.reportType === "WEEKLY" ? "来週" : "来月"}の見込みKPI（着地 → 予想）</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {report.actions.length === 0 ? (
              <p className="text-sm text-muted-foreground">入力はありません。</p>
            ) : (
              report.actions.map((a) => {
                const diff = a.baseValue != null && a.targetValue != null ? Math.round((a.targetValue - a.baseValue) * 100) / 100 : null;
                return (
                  <div key={a.id} className="rounded-md border px-3 py-2 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      {a.relatedKpiName && <Badge variant="outline">{a.relatedKpiName}</Badge>}
                      {a.targetValue != null ? (
                        <span className="font-medium tabular-nums">
                          着地 {fmt(a.baseValue)} → {fmt(a.targetValue)} 予想
                          {diff != null && <span className={diff > 0 ? "text-green-600" : diff < 0 ? "text-red-600" : ""}>（{diff > 0 ? "+" : ""}{diff}）</span>}
                        </span>
                      ) : (
                        <span className="font-medium">{a.content}</span>
                      )}
                    </div>
                    {a.content && a.targetValue != null && !a.content.includes("→") && (
                      <div className="mt-0.5 text-xs text-muted-foreground">{a.content}</div>
                    )}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* 月次追加項目 */}
      {report.reportType === "MONTHLY" && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>月次 追加項目</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm md:grid-cols-2">
            <ReviewLine label="月間総括" value={report.monthlySummary} />
            <ReviewLine label="成功事例" value={report.successCases} />
            <ReviewLine label="未達要因" value={report.missFactors} />
            <ReviewLine label="来月重点KPI" value={report.nextMonthFocusKpi} />
            <ReviewLine label="人材面の課題" value={report.hrIssues} />
            <ReviewLine label="集客面の課題" value={report.marketingIssues} />
            <ReviewLine label="教育面の課題" value={report.educationIssues} />
            <ReviewLine label="運営面の課題" value={report.operationIssues} />
          </CardContent>
        </Card>
      )}

      {/* AIフィードバック */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>AIフィードバック</CardTitle>
        </CardHeader>
        <CardContent>
          {isAdmin ? (
            <FeedbackPanel
              reportId={report.id}
              initialContent={feedbackContent}
              sendStatus={report.feedback?.sendStatus ?? "UNSENT"}
              sentTo={report.feedback?.sentTo ?? null}
            />
          ) : feedbackContent ? (
            <div className="whitespace-pre-wrap text-sm">{feedbackContent}</div>
          ) : (
            <p className="text-sm text-muted-foreground">エリアマネージャーからのフィードバックはまだありません。</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ReviewLine({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="whitespace-pre-wrap">{value}</div>
    </div>
  );
}
