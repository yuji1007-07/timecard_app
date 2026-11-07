import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserForm, EditUserToggle, DeleteUserButton } from "./user-form";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const me = await requireAdmin();
  const [users, stores] = await Promise.all([
    prisma.user.findMany({
      include: { store: true },
      orderBy: [{ role: "asc" }, { store: { sortOrder: "asc" } }, { name: "asc" }],
    }),
    prisma.store.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
  ]);
  const storeOpts = stores.map((s) => ({ id: s.id, name: s.name }));

  return (
    <div>
      <PageHeader
        title="スタッフ管理"
        description="ログインアカウントの追加・編集・削除ができます。店舗担当アカウントは所属店舗のデータだけを扱えます。"
        action={<UserForm stores={storeOpts} />}
      />

      <Card>
        <CardHeader>
          <CardTitle>アカウント一覧（{users.length}件）</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {users.map((u) => (
            <div key={u.id} className="rounded-md border p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{u.name}</span>
                    <span className="text-sm text-muted-foreground">{u.loginId}</span>
                    <Badge variant={u.role === "ADMIN" ? "default" : "secondary"}>{u.role === "ADMIN" ? "本部" : "店舗担当"}</Badge>
                    {!u.isActive && <Badge variant="bad">無効</Badge>}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    所属: {u.role === "ADMIN" ? "本部（全店）" : (u.store?.name ?? "-")}
                    {u.store?.department ? `（${u.store.department}）` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <EditUserToggle
                    stores={storeOpts}
                    user={{ id: u.id, name: u.name, loginId: u.loginId, role: u.role, storeId: u.storeId, isActive: u.isActive }}
                    isSelf={u.id === me.id}
                  />
                  {u.id !== me.id && <DeleteUserButton id={u.id} name={u.name} />}
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
