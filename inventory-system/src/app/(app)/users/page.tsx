import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { prisma } from "@/lib/prisma";
import { requireAreaManager } from "@/lib/session";
import { ROLES, label } from "@/lib/constants";
import { ConfirmSubmit, SubmitButton } from "@/components/confirm-submit";
import { UserForm } from "./user-form";
import { updateUserLine, resetPassword, deleteUser } from "./actions";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const me = await requireAreaManager();
  const [users, stores] = await Promise.all([
    prisma.user.findMany({ include: { store: true }, orderBy: { createdAt: "asc" } }),
    prisma.store.findMany({ where: { isHeadquarters: false }, select: { id: true, name: true }, orderBy: { sortOrder: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader title="ユーザー管理" description="本部・店舗スタッフのアカウントとLINE通知先を管理します。" action={<UserForm stores={stores} />} />
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">氏名 / メール</th>
              <th className="px-3 py-2 text-left">権限</th>
              <th className="px-3 py-2 text-left">店舗</th>
              <th className="px-3 py-2 text-left">LINE ID</th>
              <th className="px-3 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t align-top">
                <td className="px-3 py-2">
                  <div className="font-medium">{u.name}</div>
                  <div className="text-xs text-muted-foreground">{u.email}</div>
                </td>
                <td className="px-3 py-2">{label(ROLES, u.role)}</td>
                <td className="px-3 py-2 text-muted-foreground">{u.store?.name ?? (u.role === "AREA_MANAGER" ? "全店" : "-")}</td>
                <td className="px-3 py-2">
                  <form action={updateUserLine} className="flex items-center gap-1">
                    <input type="hidden" name="id" value={u.id} />
                    <Input name="lineUserId" defaultValue={u.lineUserId ?? ""} placeholder="未設定" className="h-8 w-32" />
                    <SubmitButton size="sm" variant="outline">保存</SubmitButton>
                  </form>
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap justify-end gap-2">
                    <form action={resetPassword} className="flex items-center gap-1">
                      <input type="hidden" name="id" value={u.id} />
                      <Input name="password" type="password" placeholder="新PW" className="h-8 w-24" />
                      <SubmitButton size="sm" variant="outline">PW再設定</SubmitButton>
                    </form>
                    {u.id !== me.id && (
                      <form action={deleteUser}>
                        <input type="hidden" name="id" value={u.id} />
                        <ConfirmSubmit message={`${u.name} を削除しますか？`}>削除</ConfirmSubmit>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
