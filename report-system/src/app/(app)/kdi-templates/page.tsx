import { requireAreaManager } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScopeSelector, type ScopeOption } from "@/components/scope-selector";
import { AddKdiToggle, EditKdiToggle } from "./kdi-item-form";
import { deleteKdiItem, copyKdiTemplate } from "./actions";
import { BUSINESS_TYPES, FREQUENCIES, label } from "@/lib/constants";

const BIZ = ["SEIKOTSU", "ESTHE", "SHINKYU"] as const;

export default async function KdiTemplatesPage({
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

  const options: ScopeOption[] = [
    ...BIZ.map((b) => ({ value: `business:${b}`, label: label(BUSINESS_TYPES, b), group: "業態テンプレート" })),
    ...stores.map((s) => ({ value: `store:${s.id}`, label: s.name, group: "店舗で上書き" })),
    ...stores.flatMap((s) => s.departments.map((d) => ({ value: `department:${d.id}`, label: `${s.name} ${d.name}`, group: "部門で上書き" }))),
  ];

  const where =
    level === "store" ? { storeId: key } : level === "department" ? { departmentId: key } : { businessType: key, storeId: null, departmentId: null };
  const items = await prisma.kdiItem.findMany({ where, orderBy: [{ sortOrder: "asc" }] });

  let copyBusinessType: string | null = null;
  if (level === "store") copyBusinessType = stores.find((s) => s.id === key)?.businessType ?? null;
  if (level === "department") copyBusinessType = stores.flatMap((s) => s.departments).find((d) => d.id === key)?.businessType ?? null;

  // カテゴリごとにグループ化
  const grouped = new Map<string, typeof items>();
  for (const it of items) {
    const c = it.category ?? "その他";
    if (!grouped.has(c)) grouped.set(c, []);
    grouped.get(c)!.push(it);
  }

  return (
    <div>
      <PageHeader
        title="KDIテンプレート管理"
        description="業態別・店舗別・部門別にKDI候補を管理します。関連KPIと紐づけると、報告時の整合性チェックに利用されます。"
      />

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-4 pt-5">
          <ScopeSelector basePath="/kdi-templates" options={options} current={`${level}:${key}`} />
          <AddKdiToggle level={level} scopeKey={key} />
        </CardContent>
      </Card>

      {items.length === 0 && (level === "store" || level === "department") && copyBusinessType && (
        <Card className="mb-4 border-dashed">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-5">
            <p className="text-sm text-muted-foreground">
              このスコープには上書きKDIがありません。現在は業態テンプレート（{label(BUSINESS_TYPES, copyBusinessType)}）が適用されています。
            </p>
            <form action={copyKdiTemplate}>
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

      <div className="space-y-4">
        {items.length === 0 ? (
          <Card>
            <CardContent className="pt-5 text-sm text-muted-foreground">KDI項目がありません。「KDI項目を追加」から作成してください。</CardContent>
          </Card>
        ) : (
          Array.from(grouped.entries()).map(([category, list]) => (
            <Card key={category}>
              <CardContent className="space-y-2 pt-5">
                <div className="mb-1 text-sm font-semibold text-navy">{category}</div>
                {list.map((item) => (
                  <div key={item.id} className="grid gap-2 rounded-md border p-3 md:grid-cols-[1fr_auto] md:items-center">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{item.name}</span>
                        {item.relatedKpiName && <Badge variant="outline">関連KPI: {item.relatedKpiName}</Badge>}
                        <Badge variant="secondary">{label(FREQUENCIES, item.recommendedFrequency)}</Badge>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {[item.hasAssignee && "担当者", item.hasDeadline && "期限", item.hasCount && "実施回数", item.hasTargetPerson && "対象者", item.hasStatus && "進捗"]
                          .filter(Boolean)
                          .join(" / ")}
                        {item.note ? ` ／ ${item.note}` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <EditKdiToggle level={level} scopeKey={key} item={item} />
                      <form action={deleteKdiItem}>
                        <input type="hidden" name="id" value={item.id} />
                        <Button type="submit" size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                          削除
                        </Button>
                      </form>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
