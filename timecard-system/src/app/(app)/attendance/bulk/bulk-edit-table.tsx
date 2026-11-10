"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { bulkUpdateAttendance } from "../actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { weekdayJa } from "@/lib/time";
import { BREAK_PRESETS } from "@/lib/constants";
import { StaffTabs, staffOptions } from "../staff-tabs";

export type BulkRow = {
  id: string;
  workDate: string;
  storeName: string;
  userId: string;
  userName: string;
  clockIn: string;
  breakStart: string;
  breakEnd: string;
  clockOut: string;
  breakMinutes: number;
  note: string;
};

const cell = "h-9 rounded-md border border-input bg-background px-2 text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function diffMinutes(a: string, b: string): number | null {
  if (!a || !b) return null;
  const [ah, am] = a.split(":").map(Number);
  const [bh, bm] = b.split(":").map(Number);
  const d = bh * 60 + bm - (ah * 60 + am);
  return Number.isNaN(d) || d < 0 ? null : d;
}

export function BulkEditTable({ rows: initial }: { rows: BulkRow[] }) {
  const [rows, setRows] = useState(initial);
  const [state, action, pending] = useActionState(bulkUpdateAttendance, null);
  const [userId, setUserId] = useState("");
  const staff = staffOptions(rows.map((r) => ({ user: { id: r.userId, name: r.userName } })));
  const visibleCount = userId ? rows.filter((r) => r.userId === userId).length : rows.length;
  const router = useRouter();
  useEffect(() => setRows(initial), [initial]);
  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  const set = (id: string, patch: Partial<BulkRow>) =>
    setRows((rs) =>
      rs.map((r) => {
        if (r.id !== id) return r;
        const next = { ...r, ...patch };
        if ("breakStart" in patch || "breakEnd" in patch) {
          const m = diffMinutes(next.breakStart, next.breakEnd);
          if (m !== null) next.breakMinutes = m;
        }
        return next;
      })
    );

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">該当データがありません。</CardContent>
      </Card>
    );
  }

  return (
    <form action={action}>
      {state && (
        <div className={`mb-4 rounded-md border px-4 py-3 text-sm ${state.ok ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800"}`}>
          {state.message}
        </div>
      )}
      <div className="mb-3">
        <StaffTabs staff={staff} userId={userId} onSelect={setUserId} />
      </div>
      <div className="mb-3 flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "保存中..." : "まとめて保存"}
        </Button>
        <span className="text-sm text-muted-foreground">{visibleCount} 件{userId ? "（他のスタッフの変更も一緒に保存されます）" : ""}</span>
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-max min-w-full text-sm">
              <thead className="bg-muted/60 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">日付</th>
                  <th className="px-3 py-2 text-left font-medium">店舗</th>
                  <th className="px-3 py-2 text-left font-medium">スタッフ</th>
                  <th className="px-3 py-2 text-left font-medium">出勤</th>
                  <th className="px-3 py-2 text-left font-medium">休憩開始</th>
                  <th className="px-3 py-2 text-left font-medium">休憩終了</th>
                  <th className="px-3 py-2 text-left font-medium">退勤</th>
                  <th className="px-3 py-2 text-left font-medium">休憩(分)</th>
                  <th className="px-3 py-2 text-left font-medium">備考</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={`border-t even:bg-muted/30 ${userId && r.userId !== userId ? "hidden" : ""}`}>
                    <td className="whitespace-nowrap px-3 py-1.5 tabular-nums">
                      {r.workDate.slice(5)}（{weekdayJa(r.workDate)}）
                      <input type="hidden" name="recordIds" value={r.id} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5">{r.storeName}</td>
                    <td className="whitespace-nowrap px-3 py-1.5">{r.userName}</td>
                    <td className="px-3 py-1.5">
                      <input type="datetime-local" step={300} name={`clockIn_${r.id}`} value={r.clockIn} onChange={(e) => set(r.id, { clockIn: e.target.value })} className={`${cell} w-44`} />
                    </td>
                    <td className="px-3 py-1.5">
                      <input type="time" step={300} name={`breakStart_${r.id}`} value={r.breakStart} onChange={(e) => set(r.id, { breakStart: e.target.value })} className={`${cell} w-28`} />
                    </td>
                    <td className="px-3 py-1.5">
                      <input type="time" step={300} name={`breakEnd_${r.id}`} value={r.breakEnd} onChange={(e) => set(r.id, { breakEnd: e.target.value })} className={`${cell} w-28`} />
                    </td>
                    <td className="px-3 py-1.5">
                      <input type="datetime-local" step={300} name={`clockOut_${r.id}`} value={r.clockOut} onChange={(e) => set(r.id, { clockOut: e.target.value })} className={`${cell} w-44`} />
                    </td>
                    <td className="px-3 py-1.5">
                      <div className="flex items-center gap-1">
                        <input type="number" min={0} step={5} name={`breakMinutes_${r.id}`} value={r.breakMinutes} onChange={(e) => set(r.id, { breakMinutes: Number(e.target.value) || 0 })} className={`${cell} w-16`} />
                        {BREAK_PRESETS.map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => set(r.id, { breakMinutes: m })}
                            className={`h-9 rounded-md border px-2 text-xs ${r.breakMinutes === m ? "border-navy bg-navy text-white" : "border-input bg-background hover:bg-muted"}`}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-1.5">
                      <input type="text" name={`note_${r.id}`} value={r.note} onChange={(e) => set(r.id, { note: e.target.value })} className={`${cell} w-40`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      <div className="mt-3">
        <Button type="submit" disabled={pending}>
          {pending ? "保存中..." : "まとめて保存"}
        </Button>
      </div>
    </form>
  );
}
