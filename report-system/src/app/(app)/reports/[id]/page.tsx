import { Fragment } from "react";
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
import { fmt, addMonthStr, monthShort, weekLabel, MONTH_WEEK_RANGES } from "@/lib/utils";
import { REPORT_TYPES, KDI_STATUS, BUSINESS_TYPES, FREQUENCIES, label } from "@/lib/constants";

const KDI_CHECK_LABEL = { OK: "問題なし", WARN: "注意", FIX: "要修正" } as const;
const KDI_CHECK_VARIANT = { OK: "good", WARN: "warn", FIX: "bad" } as const;

// カテゴリ見出しの色
const KPI_CATEGORY_COLORS = [
  "bg-navy text-white",
  "bg-blue-100 text-blue-900",
  "bg-emerald-100 text-emerald-900",
  "bg-amber-100 text-amber-900",
  "bg-purple-100 text-purple-900",
  "bg-rose-100 text-rose-900",
  "bg-cyan-100 text-cyan-900",
  "bg-lime-100 text-lime-900",
];

type KpiValueRow = {
  id: string;
  kpiName: string;
  unit: string | null;
  target: number | null;
  current: number | null;
  forecast: number | null;
  kpiItem: { goodDirection: string; category: string | null } | null;
};

function groupKpiValuesByCategory(values: KpiValueRow[]) {
  const order: string[] = [];
  const map = new Map<string, KpiValueRow[]>();
  for (const v of values) {
    const c = v.kpiItem?.category || "その他";
    if (!map.has(c)) {
      map.set(c, []);
      order.push(c);
    }
    map.get(c)!.push(v);
  }
  return order.map((c) => ({ category: c, items: map.get(c)! }));
}

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
  const isMonthly = report.reportType === "MONTHLY";
  const feedbackContent = report.feedback?.editedContent || report.feedback?.aiContent || "";
  // カルテ枚数はダイエットコース欄にも自動反映（読み取り専用）で表示する
  const karteVal = report.kpiValues.find((v) => v.kpiName === "カルテ枚数" || v.kpiName === "総カルテ枚数")?.current ?? null;

  return (
    <div>
      <PageHeader
        title={`${report.store.name}${report.department ? ` ${report.department.name}` : ""} の報告`}
        description={`${label(REPORT_TYPES, report.reportType)}／対象: ${report.targetWeek ? weekLabel(report.targetWeek, { withYear: true }) : report.targetMonth}／報告者: ${report.reporter.name}／${label(BUSINESS_TYPES, report.department?.businessType ?? report.store.businessType)}`}
        action={
          <div className="flex gap-2">
            <Link href={`/reports/${report.id}/edit`}>
              <Button variant="outline">{report.status === "DRAFT" ? "続きを入力" : "修正する"}</Button>
            </Link>
            <Link href={`/print?reportId=${report.id}`} target="_blank">
              <Button variant="outline">PDF出力</Button>
            </Link>
            <Link href={`/stores/${report.storeId}`}>
              <Button variant="outline">店舗カルテ</Button>
            </Link>
          </div>
        }
      />

      {report.status === "DRAFT" && (
        <div className="mb-4 flex items-center justify-between rounded-lg border-2 border-yellow-300 bg-yellow-50 px-4 py-3">
          <span className="text-sm font-medium text-yellow-800">
            これは下書きです（未提出）。「続きを入力」から入力を再開し、提出してください。
          </span>
          <Link href={`/reports/${report.id}/edit`}>
            <Button size="sm">続きを入力</Button>
          </Link>
        </div>
      )}

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

      {/* 週次: 今月の推移（第1週→月末、対 目標） */}
      {!isMonthly && <WeeklyProgress report={report} weeks={analysis.sameMonthWeeklies} />}

      {/* KPI差分比較（週次は同じ月の前週とだけ比較。第1週は比較対象がないため非表示） */}
      {analysis.prev && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{isMonthly ? "前回（前月）との差分" : "前週との差分（同じ月内）"}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>KPI名</TableHead>
                  <TableHead className="text-right">{isMonthly ? "前回" : "前週"}</TableHead>
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
      )}

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
                  <span className="font-medium">
                    {p.previousAction.relatedKpiName && <span className="text-navy">{p.previousAction.relatedKpiName}-</span>}
                    {p.previousAction.content}
                  </span>
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

      <div className="space-y-6">
        {/* KPI値（全幅で見やすく） */}
        <Card>
          <CardHeader>
            <CardTitle>KPI入力値</CardTitle>
            <p className="text-xs text-muted-foreground">
              {isMonthly
                ? <>実績が予算に届かない項目（予算未達）は<span className="font-medium text-red-600">赤文字</span>で表示します。</>
                : <>着地が目標に届かない項目（着地未達）は<span className="font-medium text-red-600">赤文字</span>で表示します。</>}
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>KPI</TableHead>
                  <TableHead className="text-right">{isMonthly ? "予算" : "目標"}</TableHead>
                  <TableHead className="text-right">{isMonthly ? "実績" : "現状"}</TableHead>
                  {!isMonthly && <TableHead className="text-right">着地</TableHead>}
                  <TableHead className="text-right">達成率</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupKpiValuesByCategory(report.kpiValues).map((g, gi) => (
                  <Fragment key={g.category}>
                    <TableRow className="border-0 hover:bg-transparent">
                      <TableCell colSpan={isMonthly ? 4 : 5} className={`py-1.5 text-sm font-bold ${KPI_CATEGORY_COLORS[gi % KPI_CATEGORY_COLORS.length]}`}>
                        {g.category}
                      </TableCell>
                    </TableRow>
                    {g.category === "ダイエットコース" && karteVal != null && (
                      <TableRow className="bg-muted/20">
                        <TableCell className="font-medium">
                          カルテ枚数<Badge variant="muted" className="ml-1.5 text-[10px]">自動反映</Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">—</TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">{fmt(karteVal)}</TableCell>
                        {!isMonthly && <TableCell className="text-right tabular-nums text-muted-foreground">—</TableCell>}
                        <TableCell className="text-right text-xs tabular-nums text-muted-foreground">—</TableCell>
                      </TableRow>
                    )}
                    {g.items.map((v, ii) => {
                      const dir = v.kpiItem?.goodDirection ?? "UP";
                      // 月次は売上確定済み＝実績(current)で判定。週次は着地(forecast)で判定。
                      const judgeVal = isMonthly ? v.current : v.forecast;
                      const isUnder =
                        v.target != null && judgeVal != null && (dir === "UP" ? judgeVal < v.target : judgeVal > v.target);
                      const rate =
                        v.target != null && v.target !== 0 && judgeVal != null ? Math.round((judgeVal / v.target) * 100) : null;
                      return (
                        <TableRow key={v.id} className={ii % 2 === 1 ? "bg-muted/40" : ""}>
                          <TableCell className="font-medium">{v.kpiName}<span className="ml-1 text-xs text-muted-foreground">{v.unit}</span></TableCell>
                          <TableCell className="text-right tabular-nums">{fmt(v.target)}</TableCell>
                          <TableCell className={`text-right tabular-nums ${isMonthly && isUnder ? "font-semibold text-red-600" : ""}`}>
                            {fmt(v.current)}{isMonthly && isUnder && <span className="ml-1 text-[10px]">未達</span>}
                          </TableCell>
                          {!isMonthly && (
                            <TableCell className={`text-right tabular-nums ${isUnder ? "font-semibold text-red-600" : ""}`}>
                              {fmt(v.forecast)}{isUnder && <span className="ml-1 text-[10px]">未達</span>}
                            </TableCell>
                          )}
                          <TableCell className={`text-right text-xs tabular-nums ${rate == null ? "text-muted-foreground" : isUnder ? "text-red-600" : "text-emerald-600"}`}>
                            {rate == null ? "—" : `${rate}%`}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* 月次：ローリング予測（先月実績＋当月＋来月以降） */}
        {report.reportType === "MONTHLY" && <RollingForecast report={report} prev={analysis.prev} />}

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
            <ReviewLine label="実施したこと" value={report.doneThings} />
            <ReviewLine label="数値から見た課題（→ アクションプラン）" value={report.dataIssues} />
            <ReviewLine label="未実施だったこと（何が・なぜ）" value={report.notDoneThings} />
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
                    <span className="font-medium">
                      {k.relatedKpiName && <span className="text-navy">{k.relatedKpiName}-</span>}
                      {k.name}
                    </span>
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

// 週次: 同じ月の 第1週（1〜7日）→ 月末 の現状値を横並びにし、目標に対する進捗率を添える
type WeekSnapshot = { id: string; targetWeek: string | null; kpiValues: { kpiName: string; current: number | null }[] };

function WeeklyProgress({ report, weeks }: { report: { targetWeek: string | null; kpiValues: KpiValueRow[] }; weeks: WeekSnapshot[] }) {
  const m = /^(\d{4}-\d{2})-W([1-5])$/.exec(report.targetWeek ?? "");
  if (!m) return null;
  const curW = Number(m[2]);
  const monthLabel = monthShort(m[1]);

  const valByWeek = new Map<number, Map<string, number | null>>();
  for (const w of weeks) {
    const wm = /-W([1-5])$/.exec(w.targetWeek ?? "");
    if (!wm) continue;
    valByWeek.set(Number(wm[1]), new Map(w.kpiValues.map((v) => [v.kpiName, v.current])));
  }
  const groups = groupKpiValuesByCategory(report.kpiValues);

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>{monthLabel}の週次推移（目標に対する進み具合）</CardTitle>
        <p className="text-sm text-muted-foreground">
          同じ月の 第1週（1〜7日）→ 月末 の数値を横並びで比較します。カッコ内は<span className="font-medium">目標に対する進捗率</span>、100%以上は<span className="font-medium text-emerald-600">緑</span>。前月との比較はしません（月内の積み上げのため）。
        </p>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <div className="min-w-[900px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>KPI</TableHead>
                <TableHead className="text-right">目標</TableHead>
                {[1, 2, 3, 4, 5].map((n) => (
                  <TableHead key={n} className={`text-center ${n === curW ? "bg-navy/10 font-bold text-navy" : ""}`}>
                    第{n}週{n === curW && <span className="ml-0.5 rounded bg-navy px-1 py-0.5 text-[10px] font-bold text-white">今回</span>}
                    <div className="text-[10px] font-normal text-muted-foreground">{MONTH_WEEK_RANGES[n - 1]}</div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((g, gi) => (
                <Fragment key={g.category}>
                  <TableRow className="border-0 hover:bg-transparent">
                    <TableCell colSpan={7} className={`py-1.5 text-sm font-bold ${KPI_CATEGORY_COLORS[gi % KPI_CATEGORY_COLORS.length]}`}>
                      {g.category}
                    </TableCell>
                  </TableRow>
                  {g.items.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="whitespace-nowrap font-medium">
                        {v.kpiName}<span className="ml-1 text-xs text-muted-foreground">{v.unit}</span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{fmt(v.target)}</TableCell>
                      {[1, 2, 3, 4, 5].map((n) => {
                        const val = valByWeek.get(n)?.get(v.kpiName) ?? null;
                        const rate = v.target != null && v.target !== 0 && val != null ? Math.round((val / v.target) * 100) : null;
                        return (
                          <TableCell key={n} className={`whitespace-nowrap text-right tabular-nums ${n === curW ? "bg-navy/5 font-semibold" : ""}`}>
                            {val == null ? (
                              <span className="text-muted-foreground/40">—</span>
                            ) : (
                              <>
                                {fmt(val)}
                                {rate != null && (
                                  <span className={`ml-1 text-[10px] ${rate >= 100 ? "font-semibold text-emerald-600" : "text-muted-foreground"}`}>({rate}%)</span>
                                )}
                              </>
                            )}
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

function ReviewLine({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="whitespace-pre-wrap">{value}</div>
    </div>
  );
}

type RollingReport = {
  targetMonth: string | null;
  kpiValues: KpiValueRow[];
  projections: { kpiName: string; targetMonth: string; budget: number | null; forecast: number | null }[];
};
type PrevReport = {
  targetMonth: string | null;
  kpiValues: { kpiName: string; target: number | null; current: number | null; forecast: number | null }[];
} | null;

// 予算/実績 を縦に並べたセル（先月・当月＝売上確定済みなので着地は出さない）
function ActualCell({ budget, actual, good }: { budget: number | null; actual: number | null; good: string }) {
  const under = budget != null && actual != null && (good === "UP" ? actual < budget : actual > budget);
  return (
    <TableCell className="text-right text-sm tabular-nums">
      <div className="text-muted-foreground">予算 {fmt(budget)}</div>
      <div className={under ? "font-semibold text-red-600" : "font-semibold"}>実績 {fmt(actual)}</div>
    </TableCell>
  );
}

function RollingForecast({ report, prev }: { report: RollingReport; prev: PrevReport }) {
  const tm = report.targetMonth ?? "";
  if (!/^\d{4}-\d{2}$/.test(tm)) return null;
  const baseYear = Number(tm.slice(0, 4));
  const fwd = [1, 2, 3].map((n) => addMonthStr(tm, n));
  const projMap = new Map<string, { budget: number | null; forecast: number | null }>();
  for (const p of report.projections) projMap.set(`${p.kpiName}__${p.targetMonth}`, { budget: p.budget, forecast: p.forecast });
  const groups = groupKpiValuesByCategory(report.kpiValues);

  const hasPrev = !!prev && prev.kpiValues.length > 0;
  const prevMap = new Map<string, { target: number | null; current: number | null; forecast: number | null }>();
  for (const v of prev?.kpiValues ?? []) prevMap.set(v.kpiName, { target: v.target, current: v.current, forecast: v.forecast });
  const prevLabel = prev?.targetMonth && /^\d{4}-\d{2}$/.test(prev.targetMonth) ? monthShort(prev.targetMonth, baseYear) : "先月";

  const totalCols = 1 + (hasPrev ? 1 : 0) + 1 + fwd.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>ローリング予測（予算・実績／来月以降は着地予想）</CardTitle>
        <p className="text-sm text-muted-foreground">{hasPrev ? "先月実績・" : ""}当月は確定した予算・実績、来月以降は予算・着地予想を横並びで確認できます。予算に届かない項目は<span className="font-medium text-red-600">赤文字</span>。</p>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <div style={{ minWidth: 260 + totalCols * 140 }}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-base">KPI</TableHead>
                {hasPrev && <TableHead className="text-center text-base text-muted-foreground">{prevLabel}（先月実績）</TableHead>}
                <TableHead className="text-center text-base font-bold text-navy">{monthShort(tm, baseYear)}（当月）</TableHead>
                {fwd.map((m) => (
                  <TableHead key={m} className="text-center text-base">{monthShort(m, baseYear)}（予測）</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((g, gi) => (
                <Fragment key={g.category}>
                  <TableRow className="border-0 hover:bg-transparent">
                    <TableCell colSpan={totalCols} className={`py-1.5 text-sm font-bold ${KPI_CATEGORY_COLORS[gi % KPI_CATEGORY_COLORS.length]}`}>{g.category}</TableCell>
                  </TableRow>
                  {g.items.map((v) => {
                    const dir = v.kpiItem?.goodDirection ?? "UP";
                    const pv = prevMap.get(v.kpiName);
                    return (
                      <TableRow key={v.id}>
                        <TableCell className="whitespace-nowrap text-sm font-medium">{v.kpiName}<span className="ml-1 text-xs text-muted-foreground">{v.unit}</span></TableCell>
                        {hasPrev && <ActualCell budget={pv?.target ?? null} actual={pv?.current ?? null} good={dir} />}
                        <ActualCell budget={v.target} actual={v.current} good={dir} />
                        {fwd.map((m) => {
                          const p = projMap.get(`${v.kpiName}__${m}`);
                          return (
                            <TableCell key={m} className="text-right text-sm tabular-nums">
                              <div className="text-muted-foreground">予算 {fmt(p?.budget ?? null)}</div>
                              <div>着地 {fmt(p?.forecast ?? null)}</div>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
