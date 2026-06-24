"use client";

import { useActionState, useState } from "react";
import { createStore } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { BUSINESS_TYPES, STORE_STATUS } from "@/lib/constants";

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function StoreForm() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createStore, null);

  if (state?.success && open) setOpen(false);

  return (
    <div>
      <Button onClick={() => setOpen((v) => !v)} variant={open ? "outline" : "default"}>
        {open ? "キャンセル" : "＋ 店舗を追加"}
      </Button>
      {open && (
        <Card className="mt-3">
          <CardContent className="pt-5">
            <form action={action} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name">店舗名 *</Label>
                <Input id="name" name="name" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="businessType">業態区分 *</Label>
                <select id="businessType" name="businessType" className={selectClass} defaultValue="SEIKOTSU">
                  {Object.entries(BUSINESS_TYPES).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="area">所属エリア</Label>
                <Input id="area" name="area" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="status">ステータス</Label>
                <select id="status" name="status" className={selectClass} defaultValue="ACTIVE">
                  {Object.entries(STORE_STATUS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="directorName">院長名</Label>
                <Input id="directorName" name="directorName" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="managerName">責任者名</Label>
                <Input id="managerName" name="managerName" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="openDate">開院日</Label>
                <Input id="openDate" name="openDate" type="date" />
              </div>
              <div className="flex items-end gap-2 md:col-span-2">
                <Button type="submit" disabled={pending}>
                  {pending ? "登録中..." : "登録する"}
                </Button>
                {state?.error && <span className="text-sm text-destructive">{state.error}</span>}
              </div>
              <p className="text-xs text-muted-foreground md:col-span-2">
                ※ 業態を「複合店舗」にすると、登録後に店舗カルテから部門（エステ/鍼灸/整骨院）を追加できます。
              </p>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
