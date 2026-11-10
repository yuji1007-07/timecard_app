"use client";

import { useActionState, useState } from "react";
import { updateAttendance } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BREAK_PRESETS } from "@/lib/constants";

type Rec = {
  id: string;
  clockIn: string;
  breakStart: string;
  breakEnd: string;
  clockOut: string;
  breakMinutes: number;
  note: string;
};

export function EditForm({ record, returnTo }: { record: Rec; returnTo: string }) {
  const [state, action, pending] = useActionState(updateAttendance, null);
  const [breakStart, setBreakStart] = useState(record.breakStart);
  const [breakEnd, setBreakEnd] = useState(record.breakEnd);
  const [breakMinutes, setBreakMinutes] = useState(record.breakMinutes);

  const recalc = (s: string, e: string) => {
    if (!s || !e) return;
    const m = Math.round((new Date(e).getTime() - new Date(s).getTime()) / 60000);
    if (!Number.isNaN(m) && m >= 0) setBreakMinutes(m);
  };

  return (
    <form action={action} className="grid gap-4 md:grid-cols-2">
      <input type="hidden" name="id" value={record.id} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <div className="space-y-1.5">
        <Label>出勤</Label>
        <Input type="datetime-local" step={300} name="clockIn" defaultValue={record.clockIn} />
      </div>
      <div className="space-y-1.5">
        <Label>退勤</Label>
        <Input type="datetime-local" step={300} name="clockOut" defaultValue={record.clockOut} />
      </div>
      <div className="space-y-1.5">
        <Label>休憩開始</Label>
        <Input
          type="datetime-local"
          step={300}
          name="breakStart"
          value={breakStart}
          onChange={(e) => {
            setBreakStart(e.target.value);
            recalc(e.target.value, breakEnd);
          }}
        />
      </div>
      <div className="space-y-1.5">
        <Label>休憩終了</Label>
        <Input
          type="datetime-local"
          step={300}
          name="breakEnd"
          value={breakEnd}
          onChange={(e) => {
            setBreakEnd(e.target.value);
            recalc(breakStart, e.target.value);
          }}
        />
      </div>
      <div className="space-y-1.5">
        <Label>休憩合計（分）</Label>
        <div className="flex items-center gap-2">
          <Input type="number" min={0} step={5} name="breakMinutes" value={breakMinutes} onChange={(e) => setBreakMinutes(Number(e.target.value) || 0)} className="w-28" />
          {BREAK_PRESETS.map((m) => (
            <Button key={m} type="button" size="sm" variant={breakMinutes === m ? "default" : "outline"} onClick={() => setBreakMinutes(m)}>
              {m}分
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">ボタンで60分/140分を入力できます。休憩開始・終了を入力した場合は自動計算されます。</p>
      </div>
      <div className="space-y-1.5">
        <Label>備考</Label>
        <Input type="text" name="note" defaultValue={record.note} />
      </div>
      <div className="flex items-center gap-3 md:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "保存中..." : "保存する"}
        </Button>
        {state?.error && <span className="text-sm text-destructive">{state.error}</span>}
      </div>
    </form>
  );
}
