"use client";

import { useState, useTransition } from "react";
import { setProductEnabled } from "./actions";

export function ProductToggle({ storeId, productId, enabled: initial }: { storeId: string; productId: string; enabled: boolean }) {
  const [enabled, setEnabled] = useState(initial);
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={enabled}
      onClick={() => {
        const next = !enabled;
        setEnabled(next); // 楽観的更新
        start(() => setProductEnabled(storeId, productId, next));
      }}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
        enabled ? "bg-emerald-500" : "bg-gray-300"
      } ${pending ? "opacity-60" : ""}`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          enabled ? "translate-x-5" : "translate-x-1"
        }`}
      />
    </button>
  );
}
