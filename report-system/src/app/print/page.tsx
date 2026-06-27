import { Fragment } from "react";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { fmt } from "@/lib/utils";
import { REPORT_TYPES, BUSINESS_TYPES, KDI_STATUS, label } from "@/lib/constants";
import { PrintToolbar } from "./print-toolbar";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

type KpiVal = {
  id: string;
  kpiName: string;
  unit: string | null;
  target: number | null;
  current: number | null;
  forecast: number | null;
  kpiItem: { category: string | null; goodDirection: string } | null;
};

function groupKpis(values: KpiVal[]) {
  const order: string[] = [];
  const map = new Map<string, KpiVal[]>();
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

export default async function PrintPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string; storeId?: string; type?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireUser();
  const isAdmin = user.role === "AREA_MANAGER";

  // 期間レンジ（提出日ベース）
  let from: Date | null = null;
  let to: Date | null = null;
  let rangeLabel = "全期間";
  if (sp.month && /^\d{4}-\d{2}$/.test(sp.month)) {
    const [y, m] = sp.month.split("-").map(Number);
    from = new Date(y, m - 1, 1);
    to = new Date(y, m, 1);
    rangeLabel = `${y}年${m}月`;
  } else if (sp.year && /^\d{4}$/.test(sp.year)) {
    const y = Number(sp.year);
    from = new Date(y, 0, 1);
    to = new Date(y + 1, 0, 1);
    rangeLabel = `${y}年`;
  }

  const where: Prisma.ReportWhereInput = {};
  if (!isAdmin) {
    where.storeId = user.storeId ?? "__none__";
    if (user.role === "DEPARTMENT_MANAGER") where.departmentId = user.departmentId;
  } else if (sp.storeId) {
    where.storeId = sp.storeId;
  }
  if (sp.type === "WEEKLY" || sp.type === "MONTHLY") where.reportType = sp.type;
  if (from && to) where.submittedAt = { gte: from, lt: to };

  const reports = await prisma.report.findMany({
    where,
    include: {
      store: true,
      department: true,
      reporter: true,
      kpiValues: { include: { kpiItem: { select: { category: true, goodDirection: true } } } },
      kdis: true,
      actions: true,
      inflows: true,
      feedback: true,
    },
    orderBy: [{ submittedAt: "asc" }],
  });

  // 店舗別→日付順に並べる
  reports.sort((a, b) => {
    const s = a.store.name.localeCompare(b.store.name, "ja");
    if (s !== 0) return s;
    return a.submittedAt.getTime() - b.submittedAt.getTime();
  });

  const storeName = isAdmin && sp.storeId ? reports[0]?.store.name ?? "" : !isAdmin ? "自店舗" : "全店舗";
  const summary = `${rangeLabel}／${storeName}`;

  return (
    <div className="bg-white text-[#111]">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .report-page { break-before: page; }
          .report-page:first-of-type { break-before: auto; }
        }
        @page { margin: 12mm; }
      `}</style>

      <PrintToolbar count={reports.length} summary={summary} />

      <div className="mx-auto max-w-[820px] px-6 py-6">
        {reports.length === 0 ? (
          <p className="py-20 text-center text-gray-500">対象の報告がありません。条件を変えて再度開いてください。</p>
        ) : (
          reports.map((r) => {
            const groups = groupKpis(r.kpiValues as KpiVal[]);
            const reviews: [string, string | null][] = [
              ["良かった点", r.goodPoints],
              ["悪かった点", r.badPoints],
              ["数値から見た課題", r.dataIssues],
              ["実施したこと", r.doneThings],
              ["未実施だったこと", r.notDoneThings],
            ];
            const monthly: [string, string | null][] = [
              ["月間総括", r.monthlySummary],
              ["成功事例", r.successCases],
              ["未達要因", r.missFactors],
              ["来月重点KPI", r.nextMonthFocusKpi],
              ["来月KDI", r.nextMonthKdi],
              ["来月Action", r.nextMonthAction],
              ["人材面の課題", r.hrIssues],
              ["集客面の課題", r.marketingIssues],
              ["教育面の課題", r.educationIssues],
              ["運営面の課題", r.operationIssues],
            ];
            const fb = r.feedback?.editedContent || r.feedback?.aiContent || "";
            return (
              <article key={r.id} className="report-page mb-10">
                {/* 見出し */}
                <div className="mb-3 border-b-2 border-[#1e2a4a] pb-2">
                  <h2 className="text-lg font-bold">
                    {r.store.name}
                    {r.department ? ` ${r.department.name}` : ""}
                    <span className="ml-2 text-sm font-normal text-gray-600">
                      [{label(REPORT_TYPES, r.reportType)}] {label(BUSINESS_TYPES, r.department?.businessType ?? r.store.businessType)}
                    </span>
                  </h2>
                  <div className="mt-1 text-xs text-gray-600">
                    対象: {r.targetWeek ?? r.targetMonth} ／ 報告者: {r.reporter.name} ／ 提出: {r.submittedAt.toLocaleString("ja-JP")}
                  </div>
                </div>

                {/* KPI表 */}
                <table className="mb-4 w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-gray-300 text-xs text-gray-500">
                      <th className="py-1 text-left">KPI</th>
                      <th className="py-1 text-right">目標</th>
                      <th className="py-1 text-right">現状</th>
                      <th className="py-1 text-right">着地</th>
                      <th className="py-1 text-right">達成率</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((g) => (
                      <Fragment key={g.category}>
                        <tr>
                          <td colSpan={5} className="bg-gray-100 px-1 py-1 text-xs font-bold">
                            {g.category}
                          </td>
                        </tr>
                        {g.items.map((v, ii) => {
                          const dir = v.kpiItem?.goodDirection ?? "UP";
                          const isUnder =
                            v.target != null && v.forecast != null && (dir === "UP" ? v.forecast < v.target : v.forecast > v.target);
                          const rate =
                            v.target != null && v.target !== 0 && v.forecast != null ? Math.round((v.forecast / v.target) * 100) : null;
                          return (
                            <tr key={v.id} className={ii % 2 === 1 ? "bg-gray-50" : ""}>
                              <td className="py-0.5">
                                {v.kpiName}
                                <span className="ml-1 text-xs text-gray-400">{v.unit}</span>
                              </td>
                              <td className="py-0.5 text-right tabular-nums">{fmt(v.target)}</td>
                              <td className="py-0.5 text-right tabular-nums">{fmt(v.current)}</td>
                              <td className={`py-0.5 text-right tabular-nums ${isUnder ? "font-bold text-red-600" : ""}`}>
                                {fmt(v.forecast)}
                                {isUnder && <span className="ml-1 text-[10px]">未達</span>}
                              </td>
                              <td className={`py-0.5 text-right text-xs tabular-nums ${rate == null ? "text-gray-400" : isUnder ? "text-red-600" : "text-emerald-700"}`}>
                                {rate == null ? "—" : `${rate}%`}
                              </td>
                            </tr>
                          );
                        })}
                      </Fragment>
                    ))}
                  </tbody>
                </table>

                {/* 流入経路 */}
                {r.inflows.length > 0 && (
                  <p className="mb-2 text-xs">
                    <span className="font-semibold">流入経路：</span>
                    {r.inflows.map((i) => `${i.channel} ${i.count}`).join(" / ")}
                  </p>
                )}

                {/* 振り返り */}
                <Section title="振り返り" rows={reviews} />

                {/* 月次 */}
                {r.reportType === "MONTHLY" && <Section title="月次 追加項目" rows={monthly} />}

                {/* KDI */}
                {r.kdis.length > 0 && (
                  <div className="mb-3 text-sm">
                    <div className="mb-1 font-semibold">今回のKDI</div>
                    <ul className="space-y-0.5">
                      {r.kdis.map((k) => (
                        <li key={k.id} className="text-xs">
                          ・{k.name}
                          {k.relatedKpiName ? `（関連: ${k.relatedKpiName}）` : ""} ／ {label(KDI_STATUS, k.status)}
                          {k.assignee ? ` ／ 担当: ${k.assignee}` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 見込みKPI */}
                {r.actions.length > 0 && (
                  <div className="mb-3 text-sm">
                    <div className="mb-1 font-semibold">{r.reportType === "WEEKLY" ? "来週" : "来月"}の見込みKPI</div>
                    <ul className="space-y-0.5">
                      {r.actions.map((a) => (
                        <li key={a.id} className="text-xs">
                          ・{a.relatedKpiName ? `${a.relatedKpiName}: ` : ""}
                          {a.targetValue != null ? `着地 ${fmt(a.baseValue)} → ${fmt(a.targetValue)} 予想` : a.content}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* フィードバック */}
                {fb && (
                  <div className="mb-3 text-sm">
                    <div className="mb-1 font-semibold">フィードバック</div>
                    <p className="whitespace-pre-wrap text-xs">{fb}</p>
                  </div>
                )}

                {/* 報告原本 */}
                {r.originalText && (
                  <div className="text-sm">
                    <div className="mb-1 font-semibold">報告原本（原文）</div>
                    <pre className="whitespace-pre-wrap rounded bg-gray-50 p-2 font-sans text-xs">{r.originalText}</pre>
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}

function Section({ title, rows }: { title: string; rows: [string, string | null][] }) {
  const filled = rows.filter(([, v]) => v && v.trim());
  if (filled.length === 0) return null;
  return (
    <div className="mb-3 text-sm">
      <div className="mb-1 font-semibold">{title}</div>
      <div className="space-y-1">
        {filled.map(([k, v]) => (
          <div key={k} className="text-xs">
            <span className="text-gray-500">{k}：</span>
            <span className="whitespace-pre-wrap">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
