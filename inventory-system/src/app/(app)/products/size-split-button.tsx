"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { autoSplitSizes } from "./actions";

export function SizeSplitButton() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => {
          if (!confirm("商品名からサイズ(S/M/L/LL等)を自動で切り出します。よろしいですか？")) return;
          start(async () => setMsg(await autoSplitSizes()));
        }}
      >
        {pending ? "処理中..." : "サイズ自動分離"}
      </Button>
      {msg && <span className="text-xs text-green-600">{msg}</span>}
    </div>
  );
}
