import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserForm, EditUserToggle, BulkUserForm, DeleteUserButton } from "./user-form";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const me = await requireAdmin();
  const [users, stores] = await Promise.all([
    prisma.user.findMany({
      include: { store: true, permissions: { include: { store: true } } },
      orderBy: [{ store: { brand: "asc" } }, { store: { name: "asc" } }, { name: "asc" }],
    }),
    prisma.store.findMany({ where: { isActive: true }, orderBy: [{ brand: "asc" }, { sortOrder: "asc" }, { name: "asc" }] }),
  ]);
  const storeOpts = stores.map((s) => ({ id: s.id, name: s.name }));

  return (
    <div>
      <PageHeader
        title="スタッフ管理"
        description="スタッフの追加・編集・削除ができます。「担当店舗」を1つ以上設定すると店舗責任者として勤怠管理画面を使えます。"
        action={<UserForm stores={storeOpts} />}
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>一括登録</CardTitle>
        </CardHeader>
        <CardContent>
          <BulkUserForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>スタッフ一覧（{users.length}名）</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {users.map((u) => {
            const isManager = u.role === "ADMIN" || u.permissions.length > 0;
            return (
              <div key={u.id} className="rounded-md border p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{u.name}</span>
                      <span className="text-sm text-muted-foreground">{u.loginId}</span>
                      <Badge variant={u.role === "ADMIN" ? "default" : isManager ? "good" : "secondary"}>
                        {u.role === "ADMIN" ? "全体管理者" : isManager ? "店舗責任者" : "一般スタッフ"}
                      </Badge>
                      {!u.isActive && <Badge variant="bad">無効</Badge>}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      所属: {u.store?.name ?? "-"}
                      {u.permissions.length > 0 && (
                        <>
                          <span className="mx-2">/</span>
                          担当: {u.permissions.map((p) => p.store.name).join(" / ")}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <EditUserToggle
                      stores={storeOpts}
                      user={{
                        id: u.id,
                        name: u.name,
                        loginId: u.loginId,
                        role: u.role,
                        storeId: u.storeId,
                        isActive: u.isActive,
                        permissionStoreIds: u.permissions.map((p) => p.storeId),
                      }}
                      isSelf={u.id === me.id}
                    />
                    {u.id !== me.id && <DeleteUserButton id={u.id} name={u.name} />}
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
