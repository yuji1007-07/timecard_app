import Link from "next/link";
import { requireManager } from "@/lib/session";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { FilterForm } from "./filter-form";
import { AttendanceTable } from "./attendance-table";
import { queryAttendance, querySummary, resolveStoreScope } from "@/lib/attendance";
import { fmtTime, minutesToHhmm, minutesToHoursText, monthLabel, thisMonthJst, weekdayJa } from "@/lib/time";

export const dynamic = "force-dynamic";

type SP = { month?: string; storeId?: string; msg?: string };

export default async function AttendancePage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireManager();
  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : thisMonthJst();
  const { stores, selectedStoreId, scopeIds, warning } = await resolveStoreScope(user, sp.storeId);

  const [records, summary] = await Promise.all([queryAttendance(month, scopeIds), querySummary(month, scopeIds)]);
  const qs = `month=${month}${selectedStoreId ? `&storeId=${selectedStoreId}` : ""}`;
  const listRows = records.map((r) => ({
    id: r.id,
    workDate: r.workDate,
    weekday: weekdayJa(r.workDate),
    storeName: r.store.name,
    user: { id: r.user.id, name: r.user.name },
    clockIn: fmtTime(r.clockIn),
    breakStart: fmtTime(r.breakStart),
    breakEnd: fmtTime(r.breakEnd),
    clockOut: fmtTime(r.clockOut),
    breakText: minutesToHhmm(r.breakMinutes),
    workText: r.workMinutes != null ? minutesToHhmm(r.workMinutes) : "-",
    note: r.note ?? "",
  }));

  return (
    <div>
      <PageHeader
        title="勤怠管理"
        description={`${monthLabel(month)} の打刻一覧と店舗ごとの集計です。`}
        action={
          <div className="flex flex-wrap gap-2">
            <Link href={`/attendance/bulk?${qs}`}>
              <Button>打刻を一括編集</Button>
            </Link>
            <a href={`/api/export/csv?${qs}`}>
              <Button variant="outline">CSV出力</Button>
            </a>
            <a href={`/api/export/excel?${qs}`}>
              <Button variant="outline">Excel出力</Button>
            </a>
          </div>
        }
      />

      {sp.msg && <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{sp.msg}</div>}
      {warning && <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{warning}</div>}

      <Card className="mb-6">
        <CardContent className="pt-5">
          <FilterForm basePath="/attendance" month={month} storeId={selectedStoreId ?? ""} stores={stores} canViewAll={user.isAdmin} />
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>月次集計</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ブランド</TableHead>
                <TableHead>店舗</TableHead>
                <TableHead className="text-right">対象人数</TableHead>
                <TableHead className="text-right">打刻日数</TableHead>
                <TableHead className="text-right">総実働</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    該当データがありません。
                  </TableCell>
                </TableRow>
              )}
              {summary.map((s) => (
                <TableRow key={s.id} className={s.recordCount === 0 ? "text-muted-foreground" : ""}>
                  <TableCell className="whitespace-nowrap">{s.brand}</TableCell>
                  <TableCell className="whitespace-nowrap">{s.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{s.staffCount}</TableCell>
                  <TableCell className="text-right tabular-nums">{s.recordCount}</TableCell>
                  <TableCell className="text-right tabular-nums">{minutesToHoursText(s.totalMinutes)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AttendanceTable rows={listRows} qs={qs} />
    </div>
  );
}
