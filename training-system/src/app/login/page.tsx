import { LoginForm } from "./login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_NAME, COMPANY_NAME } from "@/lib/constants";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-navy to-navy-dark p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center text-white">
          <h1 className="text-2xl font-bold">{APP_NAME}</h1>
          <p className="mt-1 text-sm text-white/70">{COMPANY_NAME}</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>ログイン</CardTitle>
            <CardDescription>ユーザーIDとパスワードでログインしてください。</CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
