import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/stat-card";
import { PunchButtons } from "./punch-buttons";
import { fmtTime, minutesToHhmm, todayJst, weekdayJa } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const today = todayJst();

  const [todayRecord, recent] = await Promise.all([
    prisma.attendance.findUnique({ where: { userId_workDate: { userId: user.id, workDate: today } } }),
    prisma.attendance.findMany({ where: { userId: user.id }, orderBy: { workDate: "desc" }, take: 10, include: { store: true } }),
  ]);

  const onBreak = !!(todayRecord?.breakStart && !todayRecord.breakEnd);
  const status = !todayRecord?.clockIn
    ? "未出勤"
    : todayRecord.clockOut
      ? "退勤済み"
      : onBreak
        ? "休憩中"
        : "勤務中";

  return (
    <div>
      <PageHeader
        title="打刻"
        description={`${today}（${weekdayJa(today)}）${user.storeName ? ` ・ ${user.storeName}` : ""}`}
      />

      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>本日の打刻</CardTitle>
          <span className="rounded-full bg-accent px-3 py-1 text-sm font-medium text-navy">{status}</span>
        </CardHeader>
        <CardContent>
          <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-6">
            <StatCard label="出勤" value={fmtTime(todayRecord?.clockIn)} />
            <StatCard label="休憩開始" value={fmtTime(todayRecord?.breakStart)} />
            <StatCard label="休憩終了" value={fmtTime(todayRecord?.breakEnd)} />
            <StatCard label="退勤" value={fmtTime(todayRecord?.clockOut)} />
            <StatCard label="休憩合計" value={`${todayRecord?.breakMinutes ?? 0} 分`} />
            <StatCard label="実働" value={todayRecord?.workMinutes != null ? minutesToHhmm(todayRecord.workMinutes) : "-"} />
          </div>
          <PunchButtons
            canClockIn={!todayRecord?.clockIn}
            canBreakStart={!!todayRecord?.clockIn && !todayRecord.clockOut && !onBreak}
            canBreakEnd={onBreak}
            canClockOut={!!todayRecord?.clockIn && !todayRecord.clockOut}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>直近の打刻履歴</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>日付</TableHead>
                <TableHead>店舗</TableHead>
                <TableHead>出勤</TableHead>
                <TableHead>休憩開始</TableHead>
                <TableHead>休憩終了</TableHead>
                <TableHead>退勤</TableHead>
                <TableHead>休憩</TableHead>
                <TableHead>実働</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    まだ履歴がありません。
                  </TableCell>
                </TableRow>
              )}
              {recent.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap">
                    {r.workDate}（{weekdayJa(r.workDate)}）
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{r.store.name}</TableCell>
                  <TableCell>{fmtTime(r.clockIn)}</TableCell>
                  <TableCell>{fmtTime(r.breakStart)}</TableCell>
                  <TableCell>{fmtTime(r.breakEnd)}</TableCell>
                  <TableCell>{fmtTime(r.clockOut)}</TableCell>
                  <TableCell>{minutesToHhmm(r.breakMinutes)}</TableCell>
                  <TableCell>{r.workMinutes != null ? minutesToHhmm(r.workMinutes) : "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
