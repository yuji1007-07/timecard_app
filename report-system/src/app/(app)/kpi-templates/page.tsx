import { requireAreaManager } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScopeSelector, type ScopeOption } from "@/components/scope-selector";
import { AddKpiToggle, EditKpiToggle, BulkAddKpi, ClearScopeKpiButton } from "./kpi-item-form";
import { deleteKpiItem, moveKpiItem, reorderKpiItem, autoFillCategories, copyKpiTemplate } from "./actions";
import { BUSINESS_TYPES, INPUT_TYPES, GOOD_DIRECTIONS, label } from "@/lib/constants";

// カテゴリ見出しの色（報告フォームと合わせる）
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

  // 既存カテゴリ一覧（フォームの候補・色付け用）と、未分類の件数
  const categories = Array.from(new Set(items.map((i) => i.category).filter((c): c is string => !!c)));
  const catColor = (c: string | null) => (c ? CATEGORY_COLORS[categories.indexOf(c) % CATEGORY_COLORS.length] : "bg-muted text-muted-foreground");
  const uncategorized = items.filter((i) => !i.category).length;

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
        <CardContent className="flex flex-wrap items-end gap-3 pt-5">
          <ScopeSelector basePath="/kpi-templates" options={options} current={`${level}:${key}`} />
          <AddKpiToggle level={level} scopeKey={key} categories={categories} />
          <BulkAddKpi level={level} scopeKey={key} />
          {uncategorized > 0 && (
            <form action={autoFillCategories}>
              <input type="hidden" name="level" value={level} />
              <input type="hidden" name="scopeKey" value={key} />
              <Button type="submit" variant="outline" size="sm" title="「会員-〇〇」等の接頭辞から大枠カテゴリを自動で埋めます">
                接頭辞からカテゴリ自動補完（未分類{uncategorized}件）
              </Button>
            </form>
          )}
          <ClearScopeKpiButton level={level} scopeKey={key} count={items.length} />
        </CardContent>
      </Card>

      <Card className="mb-4 border-dashed">
        <CardContent className="pt-4 text-xs text-muted-foreground">
          💡 <span className="font-medium">大枠カテゴリ（色分けの見出し）</span>は「編集」で設定できます。「会員-カルテ枚数」のように<span className="font-medium">「カテゴリ-項目名」</span>で名前を付けると、接頭辞（会員）が自動でカテゴリに入ります。
          並び順は左の番号欄に順番を直接入力（例: 5 と入れて Enter で5番目へ）するか、▲▼ボタンで動かせます。報告フォームでは<span className="font-medium">同じカテゴリのKPIがまとまって</span>表示されます。
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
                <div className="flex items-center gap-1.5">
                  {/* 位置番号を直接入力して移動（Enterで確定） */}
                  <form action={reorderKpiItem} className="flex items-center">
                    <input type="hidden" name="id" value={item.id} />
                    <input
                      type="number"
                      name="pos"
                      defaultValue={idx + 1}
                      min={1}
                      max={items.length}
                      title="順番を直接入力してEnter"
                      className="h-8 w-12 rounded-md border border-input bg-background text-center text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </form>
                  <div className="grid grid-cols-2 gap-x-0.5">
                    <form action={moveKpiItem}>
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="dir" value="top" />
                      <button title="最上部へ" className="px-1 text-xs text-muted-foreground hover:text-navy disabled:opacity-30" disabled={idx === 0}>
                        ⤒
                      </button>
                    </form>
                    <form action={moveKpiItem}>
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="dir" value="up" />
                      <button title="1つ上へ" className="px-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30" disabled={idx === 0}>
                        ▲
                      </button>
                    </form>
                    <form action={moveKpiItem}>
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="dir" value="bottom" />
                      <button title="最下部へ" className="px-1 text-xs text-muted-foreground hover:text-navy disabled:opacity-30" disabled={idx === items.length - 1}>
                        ⤓
                      </button>
                    </form>
                    <form action={moveKpiItem}>
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="dir" value="down" />
                      <button title="1つ下へ" className="px-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30" disabled={idx === items.length - 1}>
                        ▼
                      </button>
                    </form>
                  </div>
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    {item.category && (
                      <span className={`rounded px-2 py-0.5 text-xs font-bold ${catColor(item.category)}`}>{item.category}</span>
                    )}
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
                  <EditKpiToggle level={level} scopeKey={key} item={item} categories={categories} />
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
