"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const selectClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

export type StoreOpt = { id: string; name: string };

export function FilterForm({
  basePath,
  month,
  storeId,
  stores,
  canViewAll,
  extra,
}: {
  basePath: string;
  month: string;
  storeId: string;
  stores: StoreOpt[];
  canViewAll: boolean;
  extra?: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const m = String(fd.get("month") || month);
        const s = String(fd.get("storeId") || "");
        router.push(`${basePath}?month=${m}${s ? `&storeId=${s}` : ""}`);
      }}
    >
      <div className="space-y-1.5">
        <Label>対象月</Label>
        <Input type="month" name="month" defaultValue={month} className="w-40" />
      </div>
      <div className="space-y-1.5">
        <Label>店舗</Label>
        <select name="storeId" className={`${selectClass} w-64`} defaultValue={storeId}>
          <option value="">{canViewAll ? "全店舗" : "担当全店舗"}</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit">表示</Button>
      {extra}
    </form>
  );
}
