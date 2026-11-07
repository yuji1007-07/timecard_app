import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { StoreForm, StoreRowForm } from "./store-form";

export const dynamic = "force-dynamic";

export default async function StoresPage() {
  await requireAdmin();
  const stores = await prisma.store.findMany({
    include: { _count: { select: { users: true, attendances: true } } },
    orderBy: [{ isActive: "desc" }, { brand: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });

  return (
    <div>
      <PageHeader
        title="店舗管理"
        description="店舗名を入力すると、ブランド（からだラボ整骨院 / ラコンシェル / 鍼灸ラコンシェル）は自動判定されます。"
        action={<StoreForm />}
      />
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">ブランド</th>
                  <th className="px-4 py-2 text-left font-medium">店舗名</th>
                  <th className="px-4 py-2 text-left font-medium">状態</th>
                  <th className="px-4 py-2 text-right font-medium">所属人数</th>
                  <th className="px-4 py-2 text-right font-medium">打刻数</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {stores.map((s) => (
                  <StoreRowForm
                    key={s.id}
                    store={{ id: s.id, name: s.name, brand: s.brand, isActive: s.isActive }}
                    userCount={s._count.users}
                    attendanceCount={s._count.attendances}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
