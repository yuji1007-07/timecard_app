import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { StoreForm, StoreRowForm } from "./store-form";

export const dynamic = "force-dynamic";

export default async function StoresPage() {
  await requireAdmin();
  const stores = await prisma.store.findMany({
    include: { _count: { select: { users: true, applications: true } } },
    orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
  });

  return (
    <div>
      <PageHeader
        title="店舗管理"
        description="店舗の追加・名称変更・部門・有効/無効を管理します。店舗担当アカウントは「スタッフ管理」で店舗に紐づけます。"
        action={<StoreForm />}
      />
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">店舗名</th>
                  <th className="px-4 py-2 text-left font-medium">部門</th>
                  <th className="px-4 py-2 text-left font-medium">旧PIN</th>
                  <th className="px-4 py-2 text-left font-medium">状態</th>
                  <th className="px-4 py-2 text-right font-medium">アカウント数</th>
                  <th className="px-4 py-2 text-right font-medium">申込書数</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {stores.map((s) => (
                  <StoreRowForm
                    key={s.id}
                    store={{ id: s.id, name: s.name, department: s.department, pinCode: s.pinCode, isActive: s.isActive }}
                    userCount={s._count.users}
                    applicationCount={s._count.applications}
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
