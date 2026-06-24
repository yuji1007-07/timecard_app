import { requireAreaManager } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AddAlertToggle, EditAlertToggle } from "./alert-form";
import { deleteAlert, toggleAlert } from "./actions";
import { ALERT_TARGET_TYPES, ALERT_OPERATORS, ALERT_COLORS, ALERT_COLOR_CLASS, PRIORITIES, label } from "@/lib/constants";
import { cn } from "@/lib/utils";

export default async function AlertsPage() {
  await requireAreaManager();
  const [conditions, stores, depts] = await Promise.all([
    prisma.alertCondition.findMany({ orderBy: { sortOrder: "asc" }, include: { store: true, department: true } }),
    prisma.store.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.department.findMany({ include: { store: true }, orderBy: { sortOrder: "asc" } }),
  ]);

  const storeOpts = stores.map((s) => ({ id: s.id, name: s.name }));
  const deptOpts = depts.map((d) => ({ id: d.id, name: `${d.store.name} ${d.name}` }));

  return (
    <div>
      <PageHeader
        title="要注意条件 設定"
        description="ダッシュボードの要注意店舗を判定する条件を自由に設定できます。対象業態・KPI・条件・閾値・表示色・優先度・通知を指定できます。"
      />

      <Card className="mb-4">
        <CardContent className="pt-5">
          <AddAlertToggle stores={storeOpts} departments={deptOpts} />
        </CardContent>
      </Card>

      <div className="space-y-2">
        {conditions.length === 0 ? (
          <Card><CardContent className="pt-5 text-sm text-muted-foreground">条件がありません。</CardContent></Card>
        ) : (
          conditions.map((c) => (
            <Card key={c.id}>
              <CardContent className="grid gap-3 pt-5 md:grid-cols-[1fr_auto] md:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn("rounded px-2 py-0.5 text-sm font-medium", ALERT_COLOR_CLASS[c.color])}>{label(ALERT_COLORS, c.color)}</span>
                    <span className="font-medium">{c.name}</span>
                    <Badge variant="secondary">{label(ALERT_TARGET_TYPES, c.targetType)}</Badge>
                    {c.store && <Badge variant="outline">{c.store.name}</Badge>}
                    {c.department && <Badge variant="outline">{c.department.name}</Badge>}
                    <Badge variant="muted">優先度: {label(PRIORITIES, c.priority)}</Badge>
                    {c.notify && <Badge variant="default">通知ON</Badge>}
                    {!c.enabled && <Badge variant="bad">無効</Badge>}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    条件: {c.targetKpi ? `${c.targetKpi} ` : ""}{label(ALERT_OPERATORS, c.operator)}{c.threshold != null ? ` ${c.threshold}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <form action={toggleAlert}>
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="enabled" value={(!c.enabled).toString()} />
                    <Button type="submit" size="sm" variant="ghost">{c.enabled ? "無効化" : "有効化"}</Button>
                  </form>
                  <EditAlertToggle stores={storeOpts} departments={deptOpts} item={c} />
                  <form action={deleteAlert}>
                    <input type="hidden" name="id" value={c.id} />
                    <Button type="submit" size="sm" variant="ghost" className="text-destructive hover:text-destructive">削除</Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
