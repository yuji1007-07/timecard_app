import Link from "next/link";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fmt } from "@/lib/utils";
import { REPORT_TYPES, BUSINESS_TYPES, label } from "@/lib/constants";
import type { Prisma } from "@prisma/client";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; storeId?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireUser();
  const isAdmin = user.role === "AREA_MANAGER";

  const where: Prisma.ReportWhereInput = {};
  if (!isAdmin) {
    where.storeId = user.storeId ?? "__none__";
    if (user.role === "DEPARTMENT_MANAGER") where.departmentId = user.departmentId;
  } else if (sp.storeId) {
    where.storeId = sp.storeId;
  }
  if (sp.type === "WEEKLY" || sp.type === "MONTHLY") where.reportType = sp.type;
  if (sp.q) {
    where.OR = [
      { store: { name: { contains: sp.q } } },
      { reporter: { name: { contains: sp.q } } },
      { targetWeek: { contains: sp.q } },
      { targetMonth: { contains: sp.q } },
      { kdis: { some: { name: { contains: sp.q } } } },
      { actions: { some: { content: { contains: sp.q } } } },
    ];
  }

  const reports = await prisma.report.findMany({
    where,
    include: { store: true, department: true, reporter: true, kpiValues: true, feedback: true },
    orderBy: { submittedAt: "desc" },
    take: 100,
  });

  const stores = isAdmin ? await prisma.store.findMany({ orderBy: { sortOrder: "asc" } }) : [];

  const selectClass = "flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm";

  return (
    <div>
      <PageHeader
        title="報告一覧"
        description="提出済の週次/月次報告を検索・確認できます。"
        action={
          <Link href="/reports/new">
            <Button>報告を作成</Button>
          </Link>
        }
      />

      <Card className="mb-4">
        <CardContent className="pt-5">
          <form className="flex flex-wrap items-end gap-3" method="get">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">キーワード</label>
              <input name="q" defaultValue={sp.q} placeholder="店舗 / 報告者 / 週 / KDI / Action" className={selectClass + " w-64"} />
            </div>
            {isAdmin && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">店舗</label>
                <select name="storeId" defaultValue={sp.storeId ?? ""} className={selectClass}>
                  <option value="">すべて</option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">区分</label>
              <select name="type" defaultValue={sp.type ?? ""} className={selectClass}>
                <option value="">すべて</option>
                <option value="WEEKLY">週次</option>
                <option value="MONTHLY">月次</option>
              </select>
            </div>
            <Button type="submit" variant="outline">検索</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>区分</TableHead>
                <TableHead>店舗 / 部門</TableHead>
                <TableHead>業態</TableHead>
                <TableHead>対象</TableHead>
                <TableHead>報告者</TableHead>
                <TableHead className="text-right">売上</TableHead>
                <TableHead>FB</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">該当する報告がありません。</TableCell>
                </TableRow>
              ) : (
                reports.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell><Badge variant={r.reportType === "WEEKLY" ? "secondary" : "default"}>{label(REPORT_TYPES, r.reportType)}</Badge></TableCell>
                    <TableCell className="font-medium">{r.store.name}{r.department ? ` ${r.department.name}` : ""}</TableCell>
                    <TableCell>{label(BUSINESS_TYPES, r.department?.businessType ?? r.store.businessType)}</TableCell>
                    <TableCell>{r.targetWeek ?? r.targetMonth}</TableCell>
                    <TableCell className="text-muted-foreground">{r.reporter.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(r.kpiValues.find((v) => v.kpiName === "売上")?.current, { suffix: "円" })}</TableCell>
                    <TableCell>
                      {r.feedback?.sendStatus === "SENT" ? <Badge variant="good">送信済</Badge> : r.feedback?.aiContent || r.feedback?.editedContent ? <Badge variant="warn">下書き</Badge> : <Badge variant="muted">未</Badge>}
                    </TableCell>
                    <TableCell>
                      <Link href={`/reports/${r.id}`}><Button variant="outline" size="sm">詳細</Button></Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
