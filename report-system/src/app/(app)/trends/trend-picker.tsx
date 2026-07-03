"use client";

import { useRouter } from "next/navigation";

const selectClass =
  "flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type StoreOpt = { id: string; name: string; businessType: string; departments: { id: string; name: string }[] };

export function TrendPicker({
  stores,
  storeId,
  departmentId,
  type,
}: {
  stores: StoreOpt[];
  storeId: string | null;
  departmentId: string | null;
  type: "WEEKLY" | "MONTHLY";
}) {
  const router = useRouter();
  const store = stores.find((s) => s.id === storeId);
  const depts = store?.departments ?? [];

  function go(next: { storeId?: string; departmentId?: string | null; type?: string }) {
    const p = new URLSearchParams();
    const sid = next.storeId ?? storeId ?? "";
    if (sid) p.set("storeId", sid);
    const did = next.departmentId !== undefined ? next.departmentId : departmentId;
    if (did) p.set("departmentId", did);
    p.set("type", next.type ?? type);
    router.push(`/trends?${p.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <label className="text-sm font-medium">店舗</label>
        <select className={selectClass + " min-w-[200px]"} value={storeId ?? ""} onChange={(e) => go({ storeId: e.target.value, departmentId: "" })}>
          <option value="">店舗を選択</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {depts.length > 0 && (
        <div className="space-y-1.5">
          <label className="text-sm font-medium">部門</label>
          <select className={selectClass} value={departmentId ?? ""} onChange={(e) => go({ departmentId: e.target.value })}>
            <option value="">部門を選択</option>
            {depts.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-sm font-medium">区分</label>
        <select className={selectClass} value={type} onChange={(e) => go({ type: e.target.value })}>
          <option value="MONTHLY">月次</option>
          <option value="WEEKLY">週次</option>
        </select>
      </div>
    </div>
  );
}
