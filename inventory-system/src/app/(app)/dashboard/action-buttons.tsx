"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { notifyNotStocktakenAction, notifyLowStockAction, syncSnapshotAction } from "./notify-actions";

const ACTIONS = {
  notStocktaken: notifyNotStocktakenAction,
  lowStock: notifyLowStockAction,
  snapshot: syncSnapshotAction,
} as const;

export function ActionButtons() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");

  function run(key: keyof typeof ACTIONS) {
    start(async () => {
      setMsg("");
      const r = await ACTIONS[key]();
      setMsg(r);
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run("notStocktaken")}>
          棚卸未実施をLINE通知
        </Button>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run("lowStock")}>
          在庫不足をLINE通知
        </Button>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run("snapshot")}>
          在庫スナップショットをSheets同期
        </Button>
      </div>
      {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
    </div>
  );
}
