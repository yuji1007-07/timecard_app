import { requireAreaManager } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScopeSelector, type ScopeOption } from "@/components/scope-selector";
import { AddKpiToggle, EditKpiToggle } from "./kpi-item-form";
import { deleteKpiItem, moveKpiItem, copyKpiTemplate } from "./actions";
import { BUSINESS_TYPES, INPUT_TYPES, GOOD_DIRECTIONS, label } from "@/lib/constants";

const BIZ = ["SEIKOTSU", "ESTHE", "SHINKYU"] as const;

export default async function KpiTemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string; key?: string }>;
}) {
  await requireAreaManager();
  const sp = await searchParams;
  const level = sp.level ?? "business";
  const key = sp.key ?? "SEIKOTSU";

  const stores = await prisma.store.findMany({
    include: { departments: { orderBy: { sortOrder: "asc" } } },
    orderBy: { sortOrder: "asc" },
  });

  // スコープ選択肢
  const options: ScopeOption[] = [
    ...BIZ.map((b) => ({ value: `business:${b}`, label: label(BUSINESS_TYPES, b), group: "業態テンプレート" })),
    ...stores.map((s) => ({ value: `store:${s.id}`, label: s.name, group: "店舗で上書き" })),
    ...stores.flatMap((s) =>
      s.departments.map((d) => ({ value: `department:${d.id}`, label: `${s.name} ${d.name}`, group: "部門で上書き" }))
    ),
  ];

  const where =
    level === "store" ? { storeId: key } : level === "department" ? { departmentId: key } : { businessType: key, storeId: null, departmentId: null };
  const items = await prisma.kpiItem.findMany({ where, orderBy: { sortOrder: "asc" } });

  // 上書きスコープで空のとき、コピー元の業態を推定
  let copyBusinessType: string | null = null;
  if (level === "store") copyBusinessType = stores.find((s) => s.id === key)?.businessType ?? null;
  if (level === "department")
    copyBusinessType = stores.flatMap((s) => s.departments).find((d) => d.id === key)?.businessType ?? null;

  return (
    <div>
      <PageHeader
        title="KPIテンプレート管理"
        description="業態別・店舗別・部門別にKPI項目を追加・編集・削除・並び替えできます。店舗/部門で上書きすると、その単位の報告フォームに反映されます。"
      />

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-4 pt-5">
          <ScopeSelector basePath="/kpi-templates" options={options} current={`${level}:${key}`} />
          <AddKpiToggle level={level} scopeKey={key} />
        </CardContent>
      </Card>

      {items.length === 0 && (level === "store" || level === "department") && copyBusinessType && (
        <Card className="mb-4 border-dashed">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-5">
            <p className="text-sm text-muted-foreground">
              このスコープには上書きKPIがありません。現在は業態テンプレート（{label(BUSINESS_TYPES, copyBusinessType)}）が適用されています。
            </p>
            <form action={copyKpiTemplate}>
              <input type="hidden" name="fromBusinessType" value={copyBusinessType} />
              <input type="hidden" name="level" value={level} />
              <input type="hidden" name="scopeKey" value={key} />
              <Button type="submit" variant="outline" size="sm">
                業態テンプレートをコピーして上書きを作成
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="space-y-2 pt-5">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">KPI項目がありません。「KPI項目を追加」から作成してください。</p>
          ) : (
            items.map((item, idx) => (
              <div key={item.id} className="grid grid-cols-1 gap-2 rounded-md border p-3 md:grid-cols-[auto_1fr_auto] md:items-center">
                <div className="flex items-center gap-1">
                  <span className="w-6 text-center text-xs text-muted-foreground tabular-nums">{idx + 1}</span>
                  <div className="flex flex-col">
                    <form action={moveKpiItem}>
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="dir" value="up" />
                      <button className="px-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30" disabled={idx === 0}>
                        ▲
                      </button>
                    </form>
                    <form action={moveKpiItem}>
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="dir" value="down" />
                      <button className="px-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30" disabled={idx === items.length - 1}>
                        ▼
                      </button>
                    </form>
                  </div>
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{item.name}</span>
                    <Badge variant="secondary">{item.unit}</Badge>
                    <Badge variant="outline">{label(INPUT_TYPES, item.inputType)}</Badge>
                    <Badge variant={item.goodDirection === "UP" ? "good" : "warn"}>{label(GOOD_DIRECTIONS, item.goodDirection)}</Badge>
                    {item.showDashboard && <Badge variant="default">ダッシュボード</Badge>}
                    {item.required && <Badge variant="bad">必須</Badge>}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {[item.hasTarget && "目標", item.hasCurrent && "現状", item.hasForecast && "着地", item.hasComparison && "前回比較", item.showGraph && "グラフ"]
                      .filter(Boolean)
                      .join(" / ")}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <EditKpiToggle level={level} scopeKey={key} item={item} />
                  <form action={deleteKpiItem}>
                    <input type="hidden" name="id" value={item.id} />
                    <Button type="submit" size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                      削除
                    </Button>
                  </form>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
