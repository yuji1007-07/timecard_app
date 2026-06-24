"use client";

import { useState, useTransition } from "react";
import { notifyUnsubmitted } from "./notify-actions";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";

export function NotifyButton({ week }: { week: string }) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await notifyUnsubmitted(week);
            setMsg(res.message);
          })
        }
      >
        <Send className="h-4 w-4" />
        {pending ? "送信中..." : "未提出店舗へLINE通知"}
      </Button>
      {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
    </div>
  );
}
