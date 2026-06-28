import { LoginForm } from "./login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // PIN軽量ログイン用に、PIN設定済みの店舗だけ取得（失敗してもログイン画面は表示）
  let pinStores: { id: string; name: string }[] = [];
  try {
    pinStores = await prisma.store.findMany({
      where: { isHeadquarters: false, pinCode: { not: null }, status: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: { sortOrder: "asc" },
    });
  } catch {
    pinStores = [];
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-navy to-navy-dark p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center text-white">
          <h1 className="text-2xl font-bold">販売品在庫管理システム</h1>
          <p className="mt-1 text-sm text-white/70">整骨院・鍼灸・エステ グループ運営</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>ログイン</CardTitle>
            <CardDescription>本部はメール／パスワード、店舗スタッフは店舗PINでも入れます。</CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm pinStores={pinStores} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
