import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DepartmentForm } from "../department-form";
import { ScopePanel } from "./scope-panel";
import { BUSINESS_TYPES, STORE_STATUS, label } from "@/lib/constants";

export default async function StoreKartePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const store = await prisma.store.findUnique({
    where: { id },
    include: { departments: { orderBy: { sortOrder: "asc" } } },
  });
  if (!store) notFound();

  // 権限: エリアマネージャー以外は自店舗のみ
  if (user.role !== "AREA_MANAGER" && user.storeId !== store.id) redirect("/dashboard");

  const isComplex = store.businessType === "COMPLEX" && store.departments.length > 0;
  const isAdmin = user.role === "AREA_MANAGER";

  return (
    <div>
      <PageHeader
        title={`店舗カルテ｜${store.name}`}
        description={`${label(BUSINESS_TYPES, store.businessType)} ／ ${store.area ?? "エリア未設定"}`}
        action={
          <Link href="/stores">
            <Button variant="outline">店舗一覧へ戻る</Button>
          </Link>
        }
      />

      {/* 基本情報 */}
      <Card className="mb-6">
        <CardContent className="grid grid-cols-2 gap-4 pt-5 text-sm md:grid-cols-4">
          <Info label="店舗区分" value={label(BUSINESS_TYPES, store.businessType)} />
          <Info label="所属エリア" value={store.area ?? "-"} />
          <Info label="院長" value={store.directorName ?? "-"} />
          <Info label="責任者" value={store.managerName ?? "-"} />
          <Info label="開院日" value={store.openDate ? store.openDate.toLocaleDateString("ja-JP") : "-"} />
          <div>
            <div className="text-xs text-muted-foreground">ステータス</div>
            <Badge variant={store.status === "ACTIVE" ? "good" : store.status === "CLOSED" ? "bad" : "warn"} className="mt-1">
              {label(STORE_STATUS, store.status)}
            </Badge>
          </div>
          <div className="md:col-span-2">
            <div className="text-xs text-muted-foreground">部門</div>
            <div className="mt-1 flex flex-wrap items-center gap-1">
              {store.departments.length > 0 ? (
                store.departments.map((d) => (
                  <Badge key={d.id} variant="secondary">
                    {d.name}（{label(BUSINESS_TYPES, d.businessType)}）
                  </Badge>
                ))
              ) : (
                <span className="text-muted-foreground">なし</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 複合店舗の部門追加（管理者のみ） */}
      {isAdmin && store.businessType === "COMPLEX" && (
        <div className="mb-6">
          <DepartmentForm storeId={store.id} />
        </div>
      )}

      {/* 複合店舗はタブ切り替え（全体 + 部門別） */}
      {isComplex ? (
        <Tabs defaultValue="all">
          <TabsList className="flex-wrap">
            <TabsTrigger value="all">{store.name} 全体</TabsTrigger>
            {store.departments.map((d) => (
              <TabsTrigger key={d.id} value={d.id}>
                {store.name} {d.name}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="all">
            <ComplexOverview storeId={store.id} departments={store.departments} />
          </TabsContent>
          {store.departments.map((d) => (
            <TabsContent key={d.id} value={d.id}>
              <ScopePanel storeId={store.id} departmentId={d.id} />
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        <ScopePanel storeId={store.id} departmentId={null} />
      )}
    </div>
  );
}

function Info({ label: l, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{l}</div>
      <div className="mt-0.5 font-medium">{value}</div>
    </div>
  );
}

/** 複合店舗 全体タブ: 各部門の直近KPIを一覧表示。 */
async function ComplexOverview({
  storeId,
  departments,
}: {
  storeId: string;
  departments: { id: string; name: string; businessType: string }[];
}) {
  const rows = await Promise.all(
    departments.map(async (d) => {
      const latest = await prisma.report.findFirst({
        where: { storeId, departmentId: d.id, reportType: "WEEKLY" },
        orderBy: { submittedAt: "desc" },
        include: { kpiValues: true },
      });
      return { dept: d, latest };
    })
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-5">
          <p className="mb-3 text-sm text-muted-foreground">各部門の直近報告（週次）を一覧表示しています。部門タブで詳細を確認できます。</p>
          <div className="grid gap-3 md:grid-cols-3">
            {rows.map(({ dept, latest }) => {
              const get = (n: string) => latest?.kpiValues.find((v) => v.kpiName === n)?.current ?? null;
              return (
                <Card key={dept.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">{dept.name}</div>
                    <Badge variant="secondary">{label(BUSINESS_TYPES, dept.businessType)}</Badge>
                  </div>
                  {latest ? (
                    <dl className="mt-3 space-y-1 text-sm">
                      <Row k="売上" v={get("売上")} suffix="円" />
                      <Row k="成約率" v={get("成約率")} suffix="%" />
                      <Row k="離反率" v={get("離反率")} suffix="%" />
                    </dl>
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground">報告なし</p>
                  )}
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ k, v, suffix }: { k: string; v: number | null; suffix: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="font-medium tabular-nums">{v == null ? "-" : `${v.toLocaleString("ja-JP")}${suffix}`}</dd>
    </div>
  );
}
