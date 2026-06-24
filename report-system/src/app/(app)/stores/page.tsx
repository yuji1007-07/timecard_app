import Link from "next/link";
import { requireAreaManager } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StoreForm } from "./store-form";
import { BUSINESS_TYPES, STORE_STATUS, label } from "@/lib/constants";

export default async function StoresPage() {
  await requireAreaManager();
  const stores = await prisma.store.findMany({
    include: { departments: { orderBy: { sortOrder: "asc" } }, _count: { select: { reports: true } } },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <div>
      <PageHeader title="店舗管理" description="店舗・部門の登録と店舗カルテの確認ができます。" action={<StoreForm />} />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>店舗名</TableHead>
                <TableHead>業態</TableHead>
                <TableHead>エリア</TableHead>
                <TableHead>院長/責任者</TableHead>
                <TableHead>ステータス</TableHead>
                <TableHead>報告数</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stores.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">
                    {s.name}
                    {s.departments.length > 0 && (
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {s.departments.map((d) => (
                          <Badge key={d.id} variant="secondary" className="text-[10px]">
                            {d.name}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>{label(BUSINESS_TYPES, s.businessType)}</TableCell>
                  <TableCell className="text-muted-foreground">{s.area ?? "-"}</TableCell>
                  <TableCell className="text-muted-foreground">{s.managerName ?? s.directorName ?? "-"}</TableCell>
                  <TableCell>
                    <Badge variant={s.status === "ACTIVE" ? "good" : s.status === "CLOSED" ? "bad" : "warn"}>
                      {label(STORE_STATUS, s.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="tabular-nums">{s._count.reports}</TableCell>
                  <TableCell>
                    <Link href={`/stores/${s.id}`}>
                      <Button variant="outline" size="sm">
                        カルテ
                      </Button>
                    </Link>
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
