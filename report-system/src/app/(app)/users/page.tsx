import { requireAreaManager } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserForm, EditUserToggle } from "./user-form";
import { deleteUser } from "./actions";
import { ROLES, label } from "@/lib/constants";

export default async function UsersPage() {
  const me = await requireAreaManager();
  const [users, stores] = await Promise.all([
    prisma.user.findMany({ include: { store: true, department: true }, orderBy: { createdAt: "asc" } }),
    prisma.store.findMany({ include: { departments: { orderBy: { sortOrder: "asc" } } }, orderBy: { sortOrder: "asc" } }),
  ]);

  const storeOpts = stores.map((s) => ({ id: s.id, name: s.name, departments: s.departments.map((d) => ({ id: d.id, name: d.name })) }));

  return (
    <div>
      <PageHeader
        title="ユーザー管理"
        description="アカウントの追加・編集・削除ができます。担当者が変わったら「編集」で氏名・メール・担当店舗・パスワードを変更できます。"
        action={<UserForm stores={storeOpts} />}
      />

      <div className="space-y-2">
        {users.map((u) => (
          <Card key={u.id}>
            <CardContent className="space-y-3 pt-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{u.name}</span>
                    <Badge variant={u.role === "AREA_MANAGER" ? "default" : "secondary"}>{label(ROLES, u.role)}</Badge>
                    {u.lineUserId ? <Badge variant="good">LINE設定済</Badge> : <Badge variant="muted">LINE未</Badge>}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {u.email}
                    <span className="mx-2">/</span>
                    担当: {u.store ? `${u.store.name}${u.department ? ` ${u.department.name}` : ""}` : "全店舗"}
                  </div>
                </div>
                {u.id !== me.id && (
                  <form action={deleteUser}>
                    <input type="hidden" name="id" value={u.id} />
                    <Button type="submit" size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                      削除
                    </Button>
                  </form>
                )}
              </div>
              <EditUserToggle
                stores={storeOpts}
                user={{
                  id: u.id,
                  name: u.name,
                  email: u.email,
                  role: u.role,
                  storeId: u.storeId,
                  departmentId: u.departmentId,
                  lineUserId: u.lineUserId,
                }}
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
