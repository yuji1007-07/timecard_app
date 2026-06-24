"use client";

import { useActionState, useState } from "react";
import { createDepartment } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEPARTMENT_TYPES } from "@/lib/constants";

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function DepartmentForm({ storeId }: { storeId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createDepartment, null);
  if (state?.success && open) setOpen(false);

  return (
    <div>
      <Button size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>
        {open ? "キャンセル" : "＋ 部門を追加"}
      </Button>
      {open && (
        <form action={action} className="mt-3 grid gap-3 rounded-md border p-3 sm:grid-cols-3">
          <input type="hidden" name="storeId" value={storeId} />
          <div className="space-y-1.5">
            <Label htmlFor="dept-name">部門名 *</Label>
            <Input id="dept-name" name="name" placeholder="エステ" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dept-bt">業態 *</Label>
            <select id="dept-bt" name="businessType" className={selectClass} defaultValue="ESTHE">
              {Object.entries(DEPARTMENT_TYPES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dept-mgr">責任者名</Label>
            <Input id="dept-mgr" name="managerName" />
          </div>
          <div className="sm:col-span-3">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "追加中..." : "部門を追加"}
            </Button>
            {state?.error && <span className="ml-2 text-sm text-destructive">{state.error}</span>}
          </div>
        </form>
      )}
    </div>
  );
}
