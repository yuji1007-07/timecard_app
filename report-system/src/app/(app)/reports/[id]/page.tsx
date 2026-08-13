import { Fragment } from "react";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getReportAnalysis } from "@/lib/report-analysis";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FeedbackPanel } from "./feedback-panel";
import { fmt, addMonthStr, monthShort, weekLabel, MONTH_WEEK_RANGES, memberCountKpiName } from "@/lib/utils";
import { splitDataIssues } from "@/lib/deadline-actions";
import { REPORT_TYPES, KDI_STATUS, BUSINESS_TYPES, FREQUENCIES, label } from "@/lib/constants";

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
  kpiItemId: string;
  kpiName: string;
  unit: string | null;
  target: number | null;
  current: number | null;
  forecast: number | null;
  kpiItem: { goodDirection: string; category: string | null; sortOrder?: number } | null;
};

/**
 * 数値＋単位。単位は数字より一段小さく薄く出して、数字自体の読みやすさを保つ。
 * 「%」は数字に密着させ、「円・人・回」などは半角スペース分あけて表示する。
 */
function Num({ v, unit }: { v: number | null | undefined; unit?: string | null }) {
  if (v === null || v === undefined || Number.isNaN(v)) return <span className="text-muted-foreground">—</span>;
  const u = (unit ?? "").trim();
  return (
    <>
      {fmt(v)}
      {u && <span className={`text-[0.75em] font-normal text-muted-foreground ${u === "%" ? "" : "ml-0.5"}`}>{u}</span>}
    </>
  );
}

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

  const { report, monthlyPlan } = analysis;
  // dataIssues は「課題ブロック＋デッドライン割れ時のアクション」の複合テキスト
  const ownIssues = splitDataIssues(report.dataIssues);

  // 権限チェック
  if (user.role !== "AREA_MANAGER") {
    if (user.storeId !== report.storeId) redirect("/dashboard");
    if (user.role === "DEPARTMENT_MANAGER" && user.departmentId !== report.departmentId) redirect("/dashboard");
  }
  const isAdmin = user.role === "AREA_MANAGER";
  const isMonthly = report.reportType === "MONTHLY";
  const feedbackContent = report.feedback?.editedContent || report.feedback?.aiContent || "";
  // 各メンバー区分カテゴリ（定額会員/新定額会員/プレミアム会員/ダイエットコース 等）に対応する
  // 「会員数（カルテ枚数）」KPI名を接頭辞から特定し、各区分欄に自動反映して表示する。
  const allKpiNames = report.kpiValues.map((v) => v.kpiName);
  const memberCountNameByCategory = new Map<string, string>();
  for (const g of groupKpiValuesByCategory(report.kpiValues)) {
    const name = memberCountKpiName(g.items.map((i) => i.kpiName), allKpiNames);
    if (name) memberCountNameByCategory.set(g.category, name);
  }
  const kpiByName = new Map(report.kpiValues.map((v) => [v.kpiName, v]));
  // KPI名から単位を引く（アクション・デッドライン表示で数値に単位を添えるため）
  const unitByName = new Map(report.kpiValues.map((v) => [v.kpiName, v.unit]));
  const unitOf = (name: string | null | undefined) => (name ? unitByName.get(name) ?? null : null);

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
                  <TableHead className="text-right text-muted-foreground">先月実績</TableHead>
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
                      <TableCell colSpan={isMonthly ? 5 : 6} className={`py-1.5 text-sm font-bold ${KPI_CATEGORY_COLORS[gi % KPI_CATEGORY_COLORS.length]}`}>
                        {g.category}
                      </TableCell>
                    </TableRow>
                    {memberCountNameByCategory.get(g.category) && (() => {
                      const mcName = memberCountNameByCategory.get(g.category)!;
                      // 会員数KPIの値をそのまま写す（予算・実績・着地・達成率まで会員数欄と揃える）
                      const mc = kpiByName.get(mcName);
                      const lastM = analysis.lastMonthActual.get(mcName) ?? null; // 会員数は名前で特定するためそのまま
                      const mcUnit = mc?.unit ?? null;
                      const mcDir = mc?.kpiItem?.goodDirection ?? "UP";
                      const mcJudge = isMonthly ? mc?.current ?? null : mc?.forecast ?? null;
                      const mcUnder =
                        mc?.target != null && mcJudge != null && (mcDir === "UP" ? mcJudge < mc.target : mcJudge > mc.target);
                      const mcRate =
                        mc?.target != null && mc.target !== 0 && mcJudge != null ? Math.round((mcJudge / mc.target) * 100) : null;
                      return (
                        <TableRow className="bg-muted/20">
                          <TableCell className="font-medium">
                            カルテ枚数（{mcName}）<Badge variant="muted" className="ml-1.5 text-[10px]">自動反映</Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground"><Num v={lastM} unit={mcUnit} /></TableCell>
                          <TableCell className="text-right tabular-nums"><Num v={mc?.target ?? null} unit={mcUnit} /></TableCell>
                          <TableCell className={`text-right tabular-nums ${isMonthly && mcUnder ? "font-semibold text-red-600" : "font-semibold"}`}>
                            <Num v={mc?.current ?? null} unit={mcUnit} />{isMonthly && mcUnder && <span className="ml-1 text-[10px]">未達</span>}
                          </TableCell>
                          {!isMonthly && (
                            <TableCell className={`text-right tabular-nums ${mcUnder ? "font-semibold text-red-600" : ""}`}>
                              <Num v={mc?.forecast ?? null} unit={mcUnit} />{mcUnder && <span className="ml-1 text-[10px]">未達</span>}
                            </TableCell>
                          )}
                          <TableCell className={`text-right text-xs tabular-nums ${mcRate == null ? "text-muted-foreground" : mcUnder ? "text-red-600" : "text-emerald-600"}`}>
                            {mcRate == null ? "—" : `${mcRate}%`}
                          </TableCell>
                        </TableRow>
                      );
                    })()}
                    {g.items.map((v, ii) => {
                      const dir = v.kpiItem?.goodDirection ?? "UP";
                      // 月次は売上確定済み＝実績(current)で判定。週次は着地(forecast)で判定。
                      const judgeVal = isMonthly ? v.current : v.forecast;
                      const isUnder =
                        v.target != null && judgeVal != null && (dir === "UP" ? judgeVal < v.target : judgeVal > v.target);
                      const rate =
                        v.target != null && v.target !== 0 && judgeVal != null ? Math.round((judgeVal / v.target) * 100) : null;
                      const lastM = analysis.lastMonthActual.get(v.kpiItemId) ?? analysis.lastMonthActual.get(v.kpiName) ?? null;
                      return (
                        <TableRow key={v.id} className={ii % 2 === 1 ? "bg-muted/40" : ""}>
                          <TableCell className="font-medium">{v.kpiName}</TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground"><Num v={lastM} unit={v.unit} /></TableCell>
                          <TableCell className="text-right tabular-nums"><Num v={v.target} unit={v.unit} /></TableCell>
                          <TableCell className={`text-right tabular-nums ${isMonthly && isUnder ? "font-semibold text-red-600" : ""}`}>
                            <Num v={v.current} unit={v.unit} />{isMonthly && isUnder && <span className="ml-1 text-[10px]">未達</span>}
                          </TableCell>
                          {!isMonthly && (
                            <TableCell className={`text-right tabular-nums ${isUnder ? "font-semibold text-red-600" : ""}`}>
                              <Num v={v.forecast} unit={v.unit} />{isUnder && <span className="ml-1 text-[10px]">未達</span>}
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

        {/* 振り返り（C: 評価）+ 流入 */}
        <Card className="border-l-4 border-l-blue-400 bg-blue-50/30">
          <CardHeader>
            <CardTitle className="text-blue-900">
              <span className="mr-2 rounded bg-blue-600 px-2 py-0.5 text-xs font-bold text-white">C</span>
              振り返り（評価）・流入経路
            </CardTitle>
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
            <ReviewLine label="未実施だったこと（何が・なぜ）" value={report.notDoneThings} />
          </CardContent>
        </Card>

        {/* 改善アクション（A: 課題→アクションプラン→定量目標） */}
        {report.dataIssues && (
          <Card className="border-l-4 border-l-amber-400 bg-amber-50/30">
            <CardHeader>
              <CardTitle className="text-amber-900">
                <span className="mr-2 rounded bg-amber-500 px-2 py-0.5 text-xs font-bold text-white">A</span>
                数値から見た課題と改善アクション
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {ownIssues.issues && <div className="whitespace-pre-wrap leading-relaxed">{ownIssues.issues}</div>}
              {ownIssues.deadlines.length > 0 && (
                <div className="space-y-2 rounded-md border-2 border-red-200 bg-red-50/60 p-3">
                  <div className="text-sm font-bold text-red-800">⚠ デッドライン割れ時のアクションプラン</div>
                  {ownIssues.deadlines.map((d, i) => (
                    <div key={i} className="rounded-md border bg-background px-3 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{d.kpi}</Badge>
                        <span className="text-xs text-muted-foreground">
                          デッドライン <span className="tabular-nums font-semibold text-red-700">{d.threshold || "-"}</span> を下回ったら
                        </span>
                      </div>
                      <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-sm">
                        {d.actions.map((a, ai) => (
                          <li key={ai}>{a}</li>
                        ))}
                      </ol>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* 月次アクションプランの週次自動追跡（週次報告のみ・入力不要） */}
      {monthlyPlan && (
        <Card className="mt-6 border-l-4 border-l-amber-400">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              月次アクションプランの進捗
              <Badge variant="muted">自動追跡</Badge>
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {monthShort(monthlyPlan.sourceMonth, Number(monthlyPlan.sourceMonth.slice(0, 4)))}の月次報告で立てた定量目標に対して、
              今週時点（着地予測）でどこまで進んだかを自動計算しています。入力は不要です。
              <Link href={`/reports/${monthlyPlan.sourceReportId}`} className="ml-1 text-navy underline">元の月次報告を見る</Link>
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {monthlyPlan.targets.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>対象KPI / アクション</TableHead>
                    <TableHead className="text-right">計画時</TableHead>
                    <TableHead className="text-right">目標</TableHead>
                    <TableHead className="text-right">今週着地</TableHead>
                    <TableHead className="text-right">進捗</TableHead>
                    <TableHead>判定</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monthlyPlan.targets.map((t, i) => {
                    const pct = t.progressPct;
                    const late = !t.achieved && pct != null && pct < 70;
                    return (
                      <TableRow key={i}>
                        <TableCell>
                          <div className="font-medium">{t.kpiName}</div>
                          <div className="text-xs text-muted-foreground">{t.content}</div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground"><Num v={t.baseValue} unit={unitOf(t.kpiName)} /></TableCell>
                        <TableCell className="text-right tabular-nums font-medium"><Num v={t.targetValue} unit={unitOf(t.kpiName)} /></TableCell>
                        <TableCell className="text-right tabular-nums font-semibold"><Num v={t.currentValue} unit={unitOf(t.kpiName)} /></TableCell>
                        <TableCell className={`text-right tabular-nums ${t.achieved ? "text-emerald-600" : late ? "text-red-600" : ""}`}>
                          {pct == null ? "—" : `${pct}%`}
                        </TableCell>
                        <TableCell>
                          <Badge variant={t.achieved ? "good" : late ? "bad" : "warn"}>
                            {t.achieved ? "達成" : late ? "遅れ" : "進行中"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}

            {monthlyPlan.deadlines.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-semibold">デッドラインの状況</div>
                {monthlyPlan.deadlines.map((d, i) => (
                  <div key={i} className={`rounded-md border px-3 py-2 ${d.breached ? "border-red-300 bg-red-50/70" : "bg-muted/20"}`}>
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <Badge variant="outline">{d.kpiName}</Badge>
                      <span className="tabular-nums">
                        デッドライン <Num v={d.threshold} unit={unitOf(d.kpiName)} /> / 今週着地 <span className="font-semibold"><Num v={d.currentValue} unit={unitOf(d.kpiName)} /></span>
                      </span>
                      <Badge variant={d.breached ? "bad" : "good"}>{d.breached ? "下回っています" : "クリア"}</Badge>
                    </div>
                    {d.breached && d.actions.length > 0 && (
                      <div className="mt-1.5">
                        <div className="text-xs font-medium text-red-800">今すぐ実施するアクション</div>
                        <ol className="mt-0.5 list-decimal space-y-0.5 pl-5 text-sm">
                          {d.actions.map((a, ai) => (
                            <li key={ai}>{a}</li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 今回KDI（過去データのみ） / 改善アクションの目標 */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {report.kdis.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>今回のKDI（過去データ）</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {report.kdis.map((k) => (
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
              ))}
            </CardContent>
          </Card>
        )}

        {report.actions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>改善アクションの目標（対象KPI 現在 → 目標）</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {report.actions.map((a) => {
                const diff = a.baseValue != null && a.targetValue != null ? Math.round((a.targetValue - a.baseValue) * 100) / 100 : null;
                return (
                  <div key={a.id} className="rounded-md border px-3 py-2 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      {a.relatedKpiName && <Badge variant="outline">{a.relatedKpiName}</Badge>}
                      {a.targetValue != null ? (
                        <span className="font-medium tabular-nums">
                          着地 <Num v={a.baseValue} unit={unitOf(a.relatedKpiName)} /> → <Num v={a.targetValue} unit={unitOf(a.relatedKpiName)} /> 予想
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
              })}
            </CardContent>
          </Card>
        )}
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
                      <TableCell className="whitespace-nowrap font-medium">{v.kpiName}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground"><Num v={v.target} unit={v.unit} /></TableCell>
                      {[1, 2, 3, 4, 5].map((n) => {
                        const val = valByWeek.get(n)?.get(v.kpiName) ?? null;
                        const rate = v.target != null && v.target !== 0 && val != null ? Math.round((val / v.target) * 100) : null;
                        return (
                          <TableCell key={n} className={`whitespace-nowrap text-right tabular-nums ${n === curW ? "bg-navy/5 font-semibold" : ""}`}>
                            {val == null ? (
                              <span className="text-muted-foreground/40">—</span>
                            ) : (
                              <>
                                <Num v={val} unit={v.unit} />
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
function ActualCell({ budget, actual, good, unit }: { budget: number | null; actual: number | null; good: string; unit?: string | null }) {
  const under = budget != null && actual != null && (good === "UP" ? actual < budget : actual > budget);
  return (
    <TableCell className="text-right text-sm tabular-nums">
      <div className="text-muted-foreground">予算 <Num v={budget} unit={unit} /></div>
      <div className={under ? "font-semibold text-red-600" : "font-semibold"}>実績 <Num v={actual} unit={unit} /></div>
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

  // 来月以降の「予測」行は既定で隠し、必要な時だけチェックで出す（普段は予算だけ見たいため）。
  // サーバーコンポーネントのままJSなしで切り替えたいので :has() を使ったCSSで制御する。
  return (
    <Card className="rolling-wrap">
      <style>{`.rolling-wrap:has(#rolling-show-forecast:not(:checked)) .rolling-forecast-line{display:none}`}</style>
      <CardHeader>
        <CardTitle>ローリング予測（予算・実績）</CardTitle>
        <p className="text-sm text-muted-foreground">
          {hasPrev ? "先月実績・" : ""}当月は確定した予算・実績、来月以降は予算を横並びで確認できます。
          「予算」カテゴリは予算・予測の両方を常に表示します。予算に届かない項目は<span className="font-medium text-red-600">赤文字</span>。
        </p>
        <label className="flex w-fit cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" id="rolling-show-forecast" className="h-4 w-4" />
          <span>「予算」以外の項目も予測を表示する</span>
        </label>
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
                  <TableHead key={m} className="text-center text-base">{monthShort(m, baseYear)}</TableHead>
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
                    // 「予算」カテゴリ（予測着地・営業日数など全体の数字）は予算・予測とも常時表示。
                    // それ以外の明細は予算のみ表示し、予測はチェックを入れた時だけ出す。
                    const alwaysForecast = g.category === "予算";
                    return (
                      <TableRow key={v.id}>
                        <TableCell className="whitespace-nowrap text-sm font-medium">{v.kpiName}</TableCell>
                        {hasPrev && <ActualCell budget={pv?.target ?? null} actual={pv?.current ?? null} good={dir} unit={v.unit} />}
                        <ActualCell budget={v.target} actual={v.current} good={dir} unit={v.unit} />
                        {fwd.map((m) => {
                          const p = projMap.get(`${v.kpiName}__${m}`);
                          return (
                            <TableCell key={m} className="text-right text-sm tabular-nums">
                              <div>予算 <Num v={p?.budget ?? null} unit={v.unit} /></div>
                              <div className={`text-muted-foreground ${alwaysForecast ? "" : "rolling-forecast-line"}`}>予測 <Num v={p?.forecast ?? null} unit={v.unit} /></div>
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
