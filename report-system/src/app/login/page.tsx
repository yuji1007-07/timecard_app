import { LoginForm } from "./login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-navy to-navy-dark p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center text-white">
          <h1 className="text-2xl font-bold">週次/月次報告管理システム</h1>
          <p className="mt-1 text-sm text-white/70">整骨院・鍼灸・エステ グループ運営</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>ログイン</CardTitle>
            <CardDescription>メールアドレスとパスワードでログインしてください。</CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm />
            <div className="mt-6 rounded-md bg-muted p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">デモアカウント（パスワード: password123）</p>
              <ul className="mt-1 space-y-0.5">
                <li>管理者: admin@example.com</li>
                <li>院長(溝の口本院): honin@example.com</li>
                <li>部門責任者(町田エステ): machida-esthe@example.com</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
