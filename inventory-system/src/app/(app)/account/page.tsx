import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/session";
import { PasswordForm } from "./password-form";
import { ROLES, label } from "@/lib/constants";

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <div>
      <PageHeader title="アカウント設定" description="ログイン情報の確認とパスワード変更ができます。" />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>基本情報</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">氏名</span><span>{user.name}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">メール</span><span>{user.email ?? "-"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">権限</span><span>{label(ROLES, user.role)}</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>パスワード変更</CardTitle>
          </CardHeader>
          <CardContent>
            <PasswordForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
