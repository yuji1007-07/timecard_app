import { requireAreaManager } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserForm } from "./user-form";
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
      <PageHeader title="ユーザー管理" description="エリアマネージャー・院長・部門責任者のアカウントを管理します。" action={<UserForm stores={storeOpts} />} />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>氏名</TableHead>
                <TableHead>メール</TableHead>
                <TableHead>権限</TableHead>
                <TableHead>担当</TableHead>
                <TableHead>LINE</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell>
                    <Badge variant={u.role === "AREA_MANAGER" ? "default" : "secondary"}>{label(ROLES, u.role)}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {u.store ? `${u.store.name}${u.department ? ` / ${u.department.name}` : ""}` : "全店舗"}
                  </TableCell>
                  <TableCell>{u.lineUserId ? <Badge variant="good">設定済</Badge> : <Badge variant="muted">未</Badge>}</TableCell>
                  <TableCell>
                    {u.id !== me.id && (
                      <form action={deleteUser}>
                        <input type="hidden" name="id" value={u.id} />
                        <Button type="submit" size="sm" variant="ghost" className="text-destructive hover:text-destructive">削除</Button>
                      </form>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
