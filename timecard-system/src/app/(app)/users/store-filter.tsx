"use client";

import { useRouter } from "next/navigation";

const selectClass = "h-8 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function StoreFilter({ stores, storeId }: { stores: { id: string; name: string; brand: string }[]; storeId: string }) {
  const router = useRouter();
  return (
    <select
      className={selectClass}
      value={storeId}
      onChange={(e) => {
        const id = e.target.value;
        const brand = stores.find((s) => s.id === id)?.brand;
        router.push(id ? `/users?brand=${encodeURIComponent(brand ?? "")}&storeId=${id}` : "/users");
      }}
    >
      <option value="">店舗で絞り込み</option>
      {stores.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </select>
  );
}
