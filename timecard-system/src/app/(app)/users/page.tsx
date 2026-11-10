import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { StoreFilter } from "./store-filter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserForm, EditUserToggle, BulkUserForm, DeleteUserButton } from "./user-form";

export const dynamic = "force-dynamic";

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ brand?: string; storeId?: string }> }) {
  const me = await requireAdmin();
  const sp = await searchParams;
  const brand = sp.brand ?? "";
  const storeId = sp.storeId ?? "";
  const [users, stores] = await Promise.all([
    prisma.user.findMany({
      include: { store: true, permissions: { include: { store: true } } },
      orderBy: [{ store: { brand: "asc" } }, { store: { name: "asc" } }, { name: "asc" }],
    }),
    prisma.store.findMany({ where: { isActive: true }, orderBy: [{ brand: "asc" }, { sortOrder: "asc" }, { name: "asc" }] }),
  ]);
  const storeOpts = stores.map((s) => ({ id: s.id, name: s.name }));
  const brands = [...new Set(stores.map((s) => s.brand))];
  const filtered = users.filter((u) => {
    if (storeId) return u.storeId === storeId;
    if (brand) return u.store?.brand === brand;
    return true;
  });
  const storesInBrand = brand ? stores.filter((s) => s.brand === brand) : stores;

  return (
    <div>
      <PageHeader
        title="スタッフ管理"
        description="スタッフの追加・編集・削除ができます。「担当店舗」を1つ以上設定すると店舗責任者として勤怠管理画面を使えます。"
        action={<UserForm stores={storeOpts} />}
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>一括登録</CardTitle>
        </CardHeader>
        <CardContent>
          <BulkUserForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            スタッフ一覧（{filtered.length}名{filtered.length !== users.length ? ` / 全${users.length}名` : ""}）
          </CardTitle>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Link href="/users" className={`rounded-full px-3 py-1 text-sm ${!brand && !storeId ? "bg-navy text-white" : "bg-muted hover:bg-muted/70"}`}>
              すべて
            </Link>
            {brands.map((b) => (
              <Link
                key={b}
                href={`/users?brand=${encodeURIComponent(b)}`}
                className={`rounded-full px-3 py-1 text-sm ${brand === b && !storeId ? "bg-navy text-white" : "bg-muted hover:bg-muted/70"}`}
              >
                {b}
              </Link>
            ))}
            <StoreFilter stores={storesInBrand.map((s) => ({ id: s.id, name: s.name, brand: s.brand }))} storeId={storeId} />
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {filtered.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">該当するスタッフがいません。</p>}
          {filtered.map((u) => {
            const isManager = u.role === "ADMIN" || u.permissions.length > 0;
            return (
              <div key={u.id} className="rounded-md border p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{u.name}</span>
                      <span className="text-sm text-muted-foreground">{u.loginId}</span>
                      <Badge variant={u.role === "ADMIN" ? "default" : isManager ? "good" : "secondary"}>
                        {u.role === "ADMIN" ? "全体管理者" : isManager ? "店舗責任者" : "一般スタッフ"}
                      </Badge>
                      {!u.isActive && <Badge variant="bad">無効</Badge>}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      所属: {u.store?.name ?? "-"}
                      {u.permissions.length > 0 && (
                        <>
                          <span className="mx-2">/</span>
                          担当: {u.permissions.map((p) => p.store.name).join(" / ")}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <EditUserToggle
                      stores={storeOpts}
                      user={{
                        id: u.id,
                        name: u.name,
                        loginId: u.loginId,
                        role: u.role,
                        storeId: u.storeId,
                        isActive: u.isActive,
                        permissionStoreIds: u.permissions.map((p) => p.storeId),
                      }}
                      isSelf={u.id === me.id}
                    />
                    {u.id !== me.id && <DeleteUserButton id={u.id} name={u.name} />}
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
