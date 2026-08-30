"use client";

// 店舗カルテの基本情報を編集する。閉院・休止にすると、週次/月次の店舗選択や
// 報告一覧・推移の集計から外れる（報告データ自体は残る）。

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { updateStore } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { BUSINESS_TYPES, STORE_STATUS } from "@/lib/constants";

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type Store = {
  id: string;
  name: string;
  businessType: string;
  area: string | null;
  directorName: string | null;
  managerName: string | null;
  openDate: string | null; // YYYY-MM-DD
  status: string;
};

export function StoreEdit({ store }: { store: Store }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(updateStore, null);

  // 保存できたらフォームを閉じ、上のステータス表示を確実に最新へ更新する
  useEffect(() => {
    if (state?.success) {
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        店舗情報を編集
      </Button>
    );
  }

  return (
    <Card className="mt-3">
      <CardContent className="pt-5">
        <form action={action} className="grid gap-4 md:grid-cols-2">
          <input type="hidden" name="id" value={store.id} />
          <div className="space-y-1.5">
            <Label htmlFor="name">店舗名 *</Label>
            <Input id="name" name="name" defaultValue={store.name} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="businessType">業態区分 *</Label>
            <select id="businessType" name="businessType" className={selectClass} defaultValue={store.businessType}>
              {Object.entries(BUSINESS_TYPES).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="area">所属エリア</Label>
            <Input id="area" name="area" defaultValue={store.area ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="status">ステータス</Label>
            <select id="status" name="status" className={selectClass} defaultValue={store.status}>
              {Object.entries(STORE_STATUS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              「閉院」「休止中」にすると、週次・月次の店舗選択や報告一覧・推移から外れます。
              これまでの報告は残り、報告一覧の絞り込みで「{STORE_STATUS.CLOSED}」を選べば見られます。
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="directorName">院長名</Label>
            <Input id="directorName" name="directorName" defaultValue={store.directorName ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="managerName">責任者名</Label>
            <Input id="managerName" name="managerName" defaultValue={store.managerName ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="openDate">開院日</Label>
            <Input id="openDate" name="openDate" type="date" defaultValue={store.openDate ?? ""} />
          </div>
          {state?.error && <p className="text-sm text-red-600 md:col-span-2">{state.error}</p>}
          <div className="flex gap-2 md:col-span-2">
            <Button type="submit" disabled={pending}>{pending ? "保存中…" : "保存する"}</Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>キャンセル</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
