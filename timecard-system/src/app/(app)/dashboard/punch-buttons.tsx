"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { punchForm, type PunchResult } from "./actions";
import { Button } from "@/components/ui/button";

type Action = "clock_in" | "break_start" | "break_end" | "clock_out";

export function PunchButtons({
  canClockIn,
  canBreakStart,
  canBreakEnd,
  canClockOut,
}: {
  canClockIn: boolean;
  canBreakStart: boolean;
  canBreakEnd: boolean;
  canClockOut: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<PunchResult>(null);

  const submit = (formData: FormData) => {
    startTransition(async () => {
      const result = await punchForm(formData);
      setState(result);
      // サーバーの最新状態（本日の打刻・履歴）を取り直す
      router.refresh();
    });
  };

  const buttons: { a: Action; label: string; enabled: boolean; variant?: "default" | "secondary" | "destructive" }[] = [
    { a: "clock_in", label: "出勤", enabled: canClockIn },
    { a: "break_start", label: "休憩開始", enabled: canBreakStart, variant: "secondary" },
    { a: "break_end", label: "休憩終了", enabled: canBreakEnd, variant: "secondary" },
    { a: "clock_out", label: "退勤", enabled: canClockOut, variant: "destructive" },
  ];

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {buttons.map((b) => (
          <form key={b.a} action={submit}>
            <input type="hidden" name="action" value={b.a} />
            <Button type="submit" size="lg" variant={b.variant} className="h-16 w-full text-lg" disabled={!b.enabled || pending}>
              {pending ? "処理中..." : b.label}
            </Button>
          </form>
        ))}
      </div>
      {state && (
        <div
          className={`mt-4 rounded-md border px-4 py-3 text-sm ${
            state.ok ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {state.message}
        </div>
      )}
    </div>
  );
}
