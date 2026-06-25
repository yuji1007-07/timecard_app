import { requireUser } from "@/lib/session";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PasswordForm } from "./password-form";
import { ROLES, label } from "@/lib/constants";

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <div>
      <PageHeader title="アカウント設定" description="ログイン情報の確認とパスワード変更ができます。" />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>アカウント情報</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row k="氏名" v={user.name ?? "-"} />
            <Row k="メールアドレス" v={user.email ?? "-"} />
            <Row k="権限" v={label(ROLES, user.role)} />
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

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between border-b py-1.5 last:border-0">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}
