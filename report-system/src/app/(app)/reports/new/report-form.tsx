"use client";

import { useMemo, useState, useTransition } from "react";
import { submitReport, type ReportPayload } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KDI_STATUS, FREQUENCIES, GOOD_DIRECTIONS, label } from "@/lib/constants";

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export type KpiItemDef = {
  id: string;
  name: string;
  unit: string;
  inputType: string;
  goodDirection: string;
  hasTarget: boolean;
  hasCurrent: boolean;
  hasForecast: boolean;
  hasComparison: boolean;
  required: boolean;
};
export type KdiTemplateDef = { id: string; name: string; category: string | null; relatedKpiName: string | null; recommendedFrequency: string };
export type PrevActionDef = {
  id: string;
  content: string;
  relatedKpiName: string | null;
  assignee: string | null;
  deadline: string | null;
  frequency: string | null;
  expectedEffect: string | null;
  successCondition: string | null;
  prevKpiValue: number | null;
};

type KpiState = Record<string, { target: string; current: string; forecast: string; comment: string }>;
type KdiRow = { kdiItemId: string | null; name: string; relatedKpiName: string; assignee: string; deadline: string; frequency: string; count: string; targetPerson: string; status: string; comment: string };
type ActionRow = { content: string; relatedKpiName: string; assignee: string; deadline: string; frequency: string; expectedEffect: string; successCondition: string };

const numOrNull = (s: string) => (s.trim() === "" ? null : Number(s));

export function ReportForm({
  storeId,
  departmentId,
  unitLabel,
  reportType,
  period,
  kpiItems,
  kdiTemplates,
  previousActions,
  channels,
}: {
  storeId: string;
  departmentId: string | null;
  unitLabel: string;
  reportType: "WEEKLY" | "MONTHLY";
  period: string;
  kpiItems: KpiItemDef[];
  kdiTemplates: KdiTemplateDef[];
  previousActions: PrevActionDef[];
  channels: string[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [kpi, setKpi] = useState<KpiState>(() =>
    Object.fromEntries(kpiItems.map((k) => [k.id, { target: "", current: "", forecast: "", comment: "" }]))
  );
  const [inflow, setInflow] = useState<Record<string, string>>(() => Object.fromEntries(channels.map((c) => [c, ""])));
  const [review, setReview] = useState({ goodPoints: "", badPoints: "", dataIssues: "", doneThings: "", notDoneThings: "" });
  const [monthly, setMonthly] = useState({
    monthlySummary: "", successCases: "", missFactors: "", nextMonthFocusKpi: "", nextMonthKdi: "", nextMonthAction: "",
    hrIssues: "", marketingIssues: "", educationIssues: "", operationIssues: "",
  });
  const [progress, setProgress] = useState<Record<string, { status: string; comment: string }>>(() =>
    Object.fromEntries(previousActions.map((a) => [a.id, { status: "ONGOING", comment: "" }]))
  );
  const [kdis, setKdis] = useState<KdiRow[]>([]);
  const [actions, setActions] = useState<ActionRow[]>([{ content: "", relatedKpiName: "", assignee: "", deadline: "", frequency: "WEEKLY1", expectedEffect: "", successCondition: "" }]);

  const kpiNameById = useMemo(() => new Map(kpiItems.map((k) => [k.name, k.id])), [kpiItems]);

  function currentOf(kpiName: string | null): number | null {
    if (!kpiName) return null;
    const id = kpiNameById.get(kpiName);
    if (!id) return null;
    return numOrNull(kpi[id]?.current ?? "");
  }

  function addKdiFromTemplate(id: string) {
    const t = kdiTemplates.find((x) => x.id === id);
    if (!t) return;
    setKdis((prev) => [
      ...prev,
      { kdiItemId: t.id, name: t.name, relatedKpiName: t.relatedKpiName ?? "", assignee: "", deadline: "", frequency: t.recommendedFrequency, count: "", targetPerson: "", status: "ONGOING", comment: "" },
    ]);
  }
  function addBlankKdi() {
    setKdis((prev) => [...prev, { kdiItemId: null, name: "", relatedKpiName: "", assignee: "", deadline: "", frequency: "WEEKLY1", count: "", targetPerson: "", status: "ONGOING", comment: "" }]);
  }

  function handleSubmit() {
    setError(null);
    // 必須KPIチェック
    for (const k of kpiItems) {
      if (k.required && k.hasCurrent && numOrNull(kpi[k.id].current) === null) {
        setError(`必須KPI「${k.name}」の現状値を入力してください。`);
        return;
      }
    }

    const payload: ReportPayload = {
      storeId,
      departmentId,
      reportType,
      targetWeek: reportType === "WEEKLY" ? period : null,
      targetMonth: reportType === "MONTHLY" ? period : null,
      review,
      monthly: reportType === "MONTHLY" ? monthly : null,
      kpis: kpiItems.map((k) => ({
        kpiItemId: k.id,
        kpiName: k.name,
        unit: k.unit,
        target: k.hasTarget ? numOrNull(kpi[k.id].target) : null,
        current: k.hasCurrent ? numOrNull(kpi[k.id].current) : null,
        forecast: k.hasForecast ? numOrNull(kpi[k.id].forecast) : null,
        comment: kpi[k.id].comment,
      })),
      inflows: channels.map((c) => ({ channel: c, count: Number(inflow[c] || 0) })),
      kdis: kdis.map((k) => ({ ...k, count: numOrNull(k.count) })),
      actions,
      progresses: previousActions.map((a) => ({ previousActionId: a.id, status: progress[a.id].status, comment: progress[a.id].comment })),
    };

    startTransition(async () => {
      try {
        await submitReport(payload);
      } catch (e) {
        // redirect() は例外を投げるので、本物のエラーのみ表示
        if ((e as Error).message && !(e as { digest?: string }).digest) setError((e as Error).message);
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* 前回KDI進捗チェック（最重要） */}
      {previousActions.length > 0 && (
        <Card className="border-navy/30">
          <CardHeader>
            <CardTitle>① 前回Action（KDI）進捗チェック</CardTitle>
            <p className="text-sm text-muted-foreground">前回立てたActionの進捗を入力してください。関連KPIの前回値→今回値の差分は自動計算されます。</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {previousActions.map((a) => {
              const curr = currentOf(a.relatedKpiName);
              const diff = a.prevKpiValue != null && curr != null ? Math.round((curr - a.prevKpiValue) * 100) / 100 : null;
              return (
                <div key={a.id} className="rounded-md border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{a.content}</span>
                    {a.relatedKpiName && <Badge variant="outline">関連KPI: {a.relatedKpiName}</Badge>}
                    {a.assignee && <Badge variant="secondary">担当: {a.assignee}</Badge>}
                  </div>
                  <div className="mt-2 grid gap-3 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>進捗ステータス</Label>
                      <select
                        className={selectClass}
                        value={progress[a.id].status}
                        onChange={(e) => setProgress((p) => ({ ...p, [a.id]: { ...p[a.id], status: e.target.value } }))}
                      >
                        {Object.entries(KDI_STATUS).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>関連KPIの変化（自動）</Label>
                      <div className="flex h-10 items-center rounded-md border bg-muted/40 px-3 text-sm tabular-nums">
                        {a.relatedKpiName ? (
                          <>
                            {a.prevKpiValue ?? "-"} → {curr ?? "（今回値を入力）"}
                            {diff != null && (
                              <span className={`ml-2 ${diff === 0 ? "text-muted-foreground" : ""}`}>（差分 {diff > 0 ? "+" : ""}{diff}）</span>
                            )}
                          </>
                        ) : (
                          <span className="text-muted-foreground">関連KPIなし</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 space-y-1.5">
                    <Label>進捗コメント</Label>
                    <Textarea
                      rows={2}
                      value={progress[a.id].comment}
                      onChange={(e) => setProgress((p) => ({ ...p, [a.id]: { ...p[a.id], comment: e.target.value } }))}
                      placeholder="実施状況・できなかった理由など"
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* KPI入力 */}
      <Card>
        <CardHeader>
          <CardTitle>② KPI入力（{unitLabel}）</CardTitle>
          <p className="text-sm text-muted-foreground">テンプレートに沿って自動生成されています。必須項目は必ず入力してください。</p>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="hidden gap-2 border-b pb-2 text-xs font-medium text-muted-foreground md:grid md:grid-cols-[1.5fr_1fr_1fr_1fr_2fr]">
            <div>KPI名</div>
            <div>目標</div>
            <div>現状</div>
            <div>着地予測</div>
            <div>コメント</div>
          </div>
          {kpiItems.map((k) => (
            <div key={k.id} className="grid gap-2 border-b pb-2 md:grid-cols-[1.5fr_1fr_1fr_1fr_2fr] md:items-center md:border-0 md:pb-0">
              <div className="flex items-center gap-1.5 text-sm font-medium">
                {k.name}
                <span className="text-xs text-muted-foreground">({k.unit})</span>
                {k.required && <Badge variant="bad" className="text-[10px]">必須</Badge>}
                <Badge variant={k.goodDirection === "UP" ? "good" : "warn"} className="text-[10px]">{label(GOOD_DIRECTIONS, k.goodDirection)}</Badge>
              </div>
              <Input type="number" step="any" inputMode="decimal" disabled={!k.hasTarget} value={kpi[k.id].target} onChange={(e) => setKpi((s) => ({ ...s, [k.id]: { ...s[k.id], target: e.target.value } }))} placeholder={k.hasTarget ? "目標" : "—"} />
              <Input type="number" step="any" inputMode="decimal" disabled={!k.hasCurrent} value={kpi[k.id].current} onChange={(e) => setKpi((s) => ({ ...s, [k.id]: { ...s[k.id], current: e.target.value } }))} placeholder={k.hasCurrent ? "現状" : "—"} />
              <Input type="number" step="any" inputMode="decimal" disabled={!k.hasForecast} value={kpi[k.id].forecast} onChange={(e) => setKpi((s) => ({ ...s, [k.id]: { ...s[k.id], forecast: e.target.value } }))} placeholder={k.hasForecast ? "着地" : "—"} />
              <Input value={kpi[k.id].comment} onChange={(e) => setKpi((s) => ({ ...s, [k.id]: { ...s[k.id], comment: e.target.value } }))} placeholder="コメント" />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 流入経路 */}
      <Card>
        <CardHeader>
          <CardTitle>③ 流入経路</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {channels.map((c) => (
              <div key={c} className="space-y-1.5">
                <Label>{c}</Label>
                <Input type="number" inputMode="numeric" value={inflow[c]} onChange={(e) => setInflow((s) => ({ ...s, [c]: e.target.value }))} placeholder="0" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 先週振り返り */}
      <Card>
        <CardHeader>
          <CardTitle>④ {reportType === "WEEKLY" ? "先週" : "先月"}の振り返り</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <Field label="良かった点"><Textarea rows={2} value={review.goodPoints} onChange={(e) => setReview((s) => ({ ...s, goodPoints: e.target.value }))} /></Field>
          <Field label="悪かった点"><Textarea rows={2} value={review.badPoints} onChange={(e) => setReview((s) => ({ ...s, badPoints: e.target.value }))} /></Field>
          <Field label="数値から見た課題"><Textarea rows={2} value={review.dataIssues} onChange={(e) => setReview((s) => ({ ...s, dataIssues: e.target.value }))} /></Field>
          <Field label="実施したこと"><Textarea rows={2} value={review.doneThings} onChange={(e) => setReview((s) => ({ ...s, doneThings: e.target.value }))} /></Field>
          <Field label="未実施だったこと"><Textarea rows={2} value={review.notDoneThings} onChange={(e) => setReview((s) => ({ ...s, notDoneThings: e.target.value }))} /></Field>
        </CardContent>
      </Card>

      {/* KDI入力 */}
      <Card>
        <CardHeader>
          <CardTitle>⑤ 今回のKDI入力</CardTitle>
          <p className="text-sm text-muted-foreground">テンプレートから選ぶか、自由に追加できます。</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1.5">
              <Label>テンプレートから追加</Label>
              <select className={selectClass + " max-w-xs"} value="" onChange={(e) => e.target.value && addKdiFromTemplate(e.target.value)}>
                <option value="">選択してください</option>
                {kdiTemplates.map((t) => (
                  <option key={t.id} value={t.id}>{t.category ? `[${t.category}] ` : ""}{t.name}</option>
                ))}
              </select>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addBlankKdi}>＋ 自由入力で追加</Button>
          </div>

          {kdis.length === 0 && <p className="text-sm text-muted-foreground">KDIが未追加です。テンプレートまたは自由入力で追加してください。</p>}
          {kdis.map((row, i) => (
            <div key={i} className="grid gap-2 rounded-md border p-3 md:grid-cols-3">
              <Field label="KDI名"><Input value={row.name} onChange={(e) => setKdis((s) => s.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))} /></Field>
              <Field label="関連KPI"><Input value={row.relatedKpiName} onChange={(e) => setKdis((s) => s.map((r, j) => (j === i ? { ...r, relatedKpiName: e.target.value } : r)))} /></Field>
              <Field label="担当者"><Input value={row.assignee} onChange={(e) => setKdis((s) => s.map((r, j) => (j === i ? { ...r, assignee: e.target.value } : r)))} /></Field>
              <Field label="期限"><Input type="date" value={row.deadline} onChange={(e) => setKdis((s) => s.map((r, j) => (j === i ? { ...r, deadline: e.target.value } : r)))} /></Field>
              <Field label="実施頻度">
                <select className={selectClass} value={row.frequency} onChange={(e) => setKdis((s) => s.map((r, j) => (j === i ? { ...r, frequency: e.target.value } : r)))}>
                  {Object.entries(FREQUENCIES).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
                </select>
              </Field>
              <Field label="実施回数"><Input type="number" inputMode="numeric" value={row.count} onChange={(e) => setKdis((s) => s.map((r, j) => (j === i ? { ...r, count: e.target.value } : r)))} /></Field>
              <Field label="進捗ステータス">
                <select className={selectClass} value={row.status} onChange={(e) => setKdis((s) => s.map((r, j) => (j === i ? { ...r, status: e.target.value } : r)))}>
                  {Object.entries(KDI_STATUS).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
                </select>
              </Field>
              <Field label="コメント" className="md:col-span-2"><Input value={row.comment} onChange={(e) => setKdis((s) => s.map((r, j) => (j === i ? { ...r, comment: e.target.value } : r)))} /></Field>
              <div className="md:col-span-3">
                <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => setKdis((s) => s.filter((_, j) => j !== i))}>削除</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 来週Action */}
      <Card>
        <CardHeader>
          <CardTitle>⑥ {reportType === "WEEKLY" ? "来週" : "来月"}のAction</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {actions.map((row, i) => (
            <div key={i} className="grid gap-2 rounded-md border p-3 md:grid-cols-3">
              <Field label="Action内容" className="md:col-span-3"><Input value={row.content} onChange={(e) => setActions((s) => s.map((r, j) => (j === i ? { ...r, content: e.target.value } : r)))} placeholder="来週実施するActionを具体的に" /></Field>
              <Field label="関連KPI"><Input value={row.relatedKpiName} onChange={(e) => setActions((s) => s.map((r, j) => (j === i ? { ...r, relatedKpiName: e.target.value } : r)))} /></Field>
              <Field label="担当者"><Input value={row.assignee} onChange={(e) => setActions((s) => s.map((r, j) => (j === i ? { ...r, assignee: e.target.value } : r)))} /></Field>
              <Field label="期限"><Input type="date" value={row.deadline} onChange={(e) => setActions((s) => s.map((r, j) => (j === i ? { ...r, deadline: e.target.value } : r)))} /></Field>
              <Field label="実施頻度">
                <select className={selectClass} value={row.frequency} onChange={(e) => setActions((s) => s.map((r, j) => (j === i ? { ...r, frequency: e.target.value } : r)))}>
                  {Object.entries(FREQUENCIES).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
                </select>
              </Field>
              <Field label="期待する効果"><Input value={row.expectedEffect} onChange={(e) => setActions((s) => s.map((r, j) => (j === i ? { ...r, expectedEffect: e.target.value } : r)))} /></Field>
              <Field label="成功条件"><Input value={row.successCondition} onChange={(e) => setActions((s) => s.map((r, j) => (j === i ? { ...r, successCondition: e.target.value } : r)))} /></Field>
              <div className="md:col-span-3">
                {actions.length > 1 && (
                  <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => setActions((s) => s.filter((_, j) => j !== i))}>削除</Button>
                )}
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => setActions((s) => [...s, { content: "", relatedKpiName: "", assignee: "", deadline: "", frequency: "WEEKLY1", expectedEffect: "", successCondition: "" }])}>
            ＋ Actionを追加
          </Button>
        </CardContent>
      </Card>

      {/* 月次追加項目 */}
      {reportType === "MONTHLY" && (
        <Card>
          <CardHeader>
            <CardTitle>⑦ 月次 追加項目</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <Field label="月間総括" className="md:col-span-2"><Textarea rows={3} value={monthly.monthlySummary} onChange={(e) => setMonthly((s) => ({ ...s, monthlySummary: e.target.value }))} /></Field>
            <Field label="成功事例"><Textarea rows={2} value={monthly.successCases} onChange={(e) => setMonthly((s) => ({ ...s, successCases: e.target.value }))} /></Field>
            <Field label="未達要因"><Textarea rows={2} value={monthly.missFactors} onChange={(e) => setMonthly((s) => ({ ...s, missFactors: e.target.value }))} /></Field>
            <Field label="来月重点KPI"><Input value={monthly.nextMonthFocusKpi} onChange={(e) => setMonthly((s) => ({ ...s, nextMonthFocusKpi: e.target.value }))} /></Field>
            <Field label="来月KDI"><Input value={monthly.nextMonthKdi} onChange={(e) => setMonthly((s) => ({ ...s, nextMonthKdi: e.target.value }))} /></Field>
            <Field label="来月Action" className="md:col-span-2"><Textarea rows={2} value={monthly.nextMonthAction} onChange={(e) => setMonthly((s) => ({ ...s, nextMonthAction: e.target.value }))} /></Field>
            <Field label="人材面の課題"><Textarea rows={2} value={monthly.hrIssues} onChange={(e) => setMonthly((s) => ({ ...s, hrIssues: e.target.value }))} /></Field>
            <Field label="集客面の課題"><Textarea rows={2} value={monthly.marketingIssues} onChange={(e) => setMonthly((s) => ({ ...s, marketingIssues: e.target.value }))} /></Field>
            <Field label="教育面の課題"><Textarea rows={2} value={monthly.educationIssues} onChange={(e) => setMonthly((s) => ({ ...s, educationIssues: e.target.value }))} /></Field>
            <Field label="運営面の課題"><Textarea rows={2} value={monthly.operationIssues} onChange={(e) => setMonthly((s) => ({ ...s, operationIssues: e.target.value }))} /></Field>
          </CardContent>
        </Card>
      )}

      <div className="sticky bottom-0 -mx-4 flex items-center justify-between gap-3 border-t bg-card/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
        {error ? <span className="text-sm text-destructive">{error}</span> : <span className="text-sm text-muted-foreground">対象: {period}</span>}
        <Button onClick={handleSubmit} disabled={pending} size="lg">
          {pending ? "提出中..." : "報告を提出する"}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
