"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StaffTabs, staffOptions } from "./staff-tabs";

export type ListRow = {
  id: string;
  workDate: string;
  weekday: string;
  storeName: string;
  user: { id: string; name: string };
  clockIn: string;
  breakStart: string;
  breakEnd: string;
  clockOut: string;
  breakText: string;
  workText: string;
  note: string;
};

export function AttendanceTable({ rows, qs }: { rows: ListRow[]; qs: string }) {
  const [userId, setUserId] = useState("");
  const staff = useMemo(() => staffOptions(rows), [rows]);
  const visible = userId ? rows.filter((r) => r.user.id === userId) : rows;

  return (
    <Card>
      <CardHeader>
        <CardTitle>打刻一覧（{visible.length}件）</CardTitle>
        <div className="mt-3">
          <StaffTabs staff={staff} userId={userId} onSelect={setUserId} />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>日付</TableHead>
                <TableHead>店舗</TableHead>
                <TableHead>スタッフ</TableHead>
                <TableHead>出勤</TableHead>
                <TableHead>休憩開始</TableHead>
                <TableHead>休憩終了</TableHead>
                <TableHead>退勤</TableHead>
                <TableHead>休憩</TableHead>
                <TableHead>実働</TableHead>
                <TableHead>備考</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-muted-foreground">
                    該当データがありません。
                  </TableCell>
                </TableRow>
              )}
              {visible.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {r.workDate.slice(5)}（{r.weekday}）
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{r.storeName}</TableCell>
                  <TableCell className="whitespace-nowrap">{r.user.name}</TableCell>
                  <TableCell className="tabular-nums">{r.clockIn}</TableCell>
                  <TableCell className="tabular-nums">{r.breakStart}</TableCell>
                  <TableCell className="tabular-nums">{r.breakEnd}</TableCell>
                  <TableCell className="tabular-nums">{r.clockOut}</TableCell>
                  <TableCell className="tabular-nums">{r.breakText}</TableCell>
                  <TableCell className="tabular-nums">{r.workText}</TableCell>
                  <TableCell className="max-w-[12rem] truncate text-muted-foreground">{r.note}</TableCell>
                  <TableCell>
                    <Link href={`/attendance/${r.id}?${qs}`}>
                      <Button variant="outline" size="sm">
                        編集
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
