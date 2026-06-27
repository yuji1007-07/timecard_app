"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/confirm-submit";
import { BUSINESS_TYPES, STORE_STATUS } from "@/lib/constants";
import { createStore, updateStore } from "./actions";

type Store = {
  id: string;
  name: string;
  businessType: string;
  isHeadquarters: boolean;
  area: string | null;
  directorName: string | null;
  managerName: string | null;
  openDate: Date | null;
  status: string;
  pinCode: string | null;
  sortOrder: number;
};

export function StoreForm({ store }: { store?: Store }) {
  const [open, setOpen] = useState(false);
  const editing = !!store;
  const action = editing
    ? updateStore.bind(null, store!.id)
    : async (fd: FormData) => {
        await createStore(fd);
      };

  if (!open) {
    return (
      <Button variant={editing ? "outline" : "default"} size="sm" onClick={() => setOpen(true)}>
        {editing ? "編集" : "＋ 店舗を追加"}
      </Button>
    );
  }

  return (
    <form
      action={async (fd) => {
        await action(fd);
        setOpen(false);
      }}
      className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-2"
    >
      <div className="space-y-1 md:col-span-2">
        <Label>店舗名</Label>
        <Input name="name" defaultValue={store?.name} required />
      </div>
      <div className="space-y-1">
        <Label>業態</Label>
        <select name="businessType" defaultValue={store?.businessType ?? "SEIKOTSU"} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
          {Object.entries(BUSINESS_TYPES).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label>ステータス</Label>
        <select name="status" defaultValue={store?.status ?? "ACTIVE"} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
          {Object.entries(STORE_STATUS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label>エリア</Label>
        <Input name="area" defaultValue={store?.area ?? ""} />
      </div>
      <div className="space-y-1">
        <Label>院長・責任者</Label>
        <Input name="directorName" defaultValue={store?.directorName ?? ""} />
      </div>
      <div className="space-y-1">
        <Label>開院日</Label>
        <Input name="openDate" type="date" defaultValue={store?.openDate ? new Date(store.openDate).toISOString().slice(0, 10) : ""} />
      </div>
      <div className="space-y-1">
        <Label>店舗PIN（4桁・軽量ログイン用）</Label>
        <Input name="pinCode" maxLength={4} inputMode="numeric" defaultValue={store?.pinCode ?? ""} placeholder="未設定可" />
      </div>
      <div className="space-y-1">
        <Label>表示順</Label>
        <Input name="sortOrder" type="number" defaultValue={store?.sortOrder ?? 0} />
      </div>
      <div className="flex items-center gap-2 md:col-span-2">
        <input id="isHeadquarters" name="isHeadquarters" type="checkbox" defaultChecked={store?.isHeadquarters} className="h-4 w-4" />
        <Label htmlFor="isHeadquarters" className="cursor-pointer">本部（エリア管理用）として扱う</Label>
      </div>
      <div className="flex gap-2 md:col-span-2">
        <SubmitButton>{editing ? "保存" : "追加"}</SubmitButton>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>キャンセル</Button>
      </div>
    </form>
  );
}
