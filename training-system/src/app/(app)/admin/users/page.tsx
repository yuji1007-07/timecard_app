import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BulkUserForm, NewUserForm, UserList, type UserRow } from "./user-forms";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const me = await requireAdmin();
  const [users, stores] = await Promise.all([
    prisma.user.findMany({ include: { store: true }, orderBy: [{ store: { sortOrder: "asc" } }, { name: "asc" }] }),
    prisma.store.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  const rows: UserRow[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    loginId: u.loginId,
    role: u.role,
    position: u.position,
    storeId: u.storeId,
    storeName: u.store?.name ?? "（店舗なし）",
    brand: u.store?.brand ?? "（店舗なし）",
    isActive: u.isActive,
  }));
  const storeOpts = stores.map((s) => ({ id: s.id, name: s.name }));

  return (
    <div>
      <PageHeader
        title="スタッフ管理"
        description="スタッフの登録・編集ができます。ユーザーIDは勤怠管理システムと同じものにそろえてください。"
        action={<NewUserForm stores={storeOpts} />}
      />
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>CSV 一括登録</CardTitle>
          <CardDescription>
            列の順番は <strong>氏名, ユーザーID, 店舗名, 役職, 初期パスワード</strong> です。ブランドと店舗は店舗名から自動で判定します。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BulkUserForm />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>スタッフ一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <UserList users={rows} stores={storeOpts} selfId={me.id} />
        </CardContent>
      </Card>
    </div>
  );
}
