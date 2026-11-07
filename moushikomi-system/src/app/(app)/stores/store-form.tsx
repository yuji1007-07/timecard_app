"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createStore, updateStore } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { DEPARTMENTS } from "@/lib/constants";

const selectClass =
  "flex h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function StoreForm() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createStore, null);
  const router = useRouter();
  useEffect(() => {
    if (state?.success) {
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);

  return (
    <div>
      <Button onClick={() => setOpen((v) => !v)} variant={open ? "outline" : "default"}>
        {open ? "キャンセル" : "＋ 店舗を追加"}
      </Button>
      {open && (
        <Card className="mt-3">
          <CardContent className="pt-5">
            <form action={action} className="flex flex-wrap items-end gap-3">
              <div className="min-w-64 space-y-1.5">
                <Label htmlFor="name">店舗名 *</Label>
                <Input id="name" name="name" required placeholder="例: 狛江院 / エステ町田店" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="department">部門 *</Label>
                <select id="department" name="department" className={selectClass + " h-10"} defaultValue="整骨院">
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pinCode">旧PIN（任意）</Label>
                <Input id="pinCode" name="pinCode" placeholder="例: 1007" className="w-28" />
              </div>
              <Button type="submit" disabled={pending}>
                {pending ? "登録中..." : "登録する"}
              </Button>
              {state?.error && <span className="text-sm text-destructive">{state.error}</span>}
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function StoreRowForm({
  store,
  userCount,
  applicationCount,
}: {
  store: { id: string; name: string; department: string; pinCode: string | null; isActive: boolean };
  userCount: number;
  applicationCount: number;
}) {
  const [state, action, pending] = useActionState(updateStore, null);
  const router = useRouter();
  useEffect(() => {
    if (state?.success) router.refresh();
  }, [state, router]);
  const formId = `store-${store.id}`;

  return (
    <tr className={`border-t ${store.isActive ? "" : "text-muted-foreground"}`}>
      <td className="px-4 py-2">
        <form id={formId} action={action}>
          <input type="hidden" name="id" value={store.id} />
          <Input name="name" defaultValue={store.name} className="h-9 min-w-48" required />
        </form>
      </td>
      <td className="px-4 py-2">
        <select name="department" form={formId} className={selectClass} defaultValue={store.department}>
          {DEPARTMENTS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </td>
      <td className="px-4 py-2">
        <Input name="pinCode" form={formId} defaultValue={store.pinCode ?? ""} className="h-9 w-24" />
      </td>
      <td className="px-4 py-2">
        <select name="isActive" form={formId} className={selectClass} defaultValue={store.isActive ? "1" : "0"}>
          <option value="1">有効</option>
          <option value="0">無効</option>
        </select>
      </td>
      <td className="px-4 py-2 text-right tabular-nums">{userCount}</td>
      <td className="px-4 py-2 text-right tabular-nums">{applicationCount}</td>
      <td className="whitespace-nowrap px-4 py-2">
        <div className="flex items-center gap-2">
          <Button type="submit" form={formId} size="sm" variant="outline" disabled={pending}>
            {pending ? "保存中..." : "保存"}
          </Button>
          {state?.error && <span className="text-xs text-destructive">{state.error}</span>}
          {state?.success && <span className="text-xs text-green-600">保存しました</span>}
        </div>
      </td>
    </tr>
  );
}
