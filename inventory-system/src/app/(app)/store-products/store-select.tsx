"use client";

import { useRouter } from "next/navigation";

export function StoreSelect({ stores, selected }: { stores: { id: string; name: string }[]; selected: string }) {
  const router = useRouter();
  return (
    <select
      value={selected}
      onChange={(e) => router.push(`/store-products?store=${e.target.value}`)}
      className="h-10 rounded-md border border-input bg-background px-3 text-sm"
    >
      {stores.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </select>
  );
}
