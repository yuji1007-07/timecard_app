"use client";

import { useActionState, useState } from "react";
import { createUser, updateUser } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ROLES } from "@/lib/constants";

const selectClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

type StoreOpt = { id: string; name: string; departments: { id: string; name: string }[] };

export type EditableUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  storeId: string | null;
  departmentId: string | null;
  lineUserId: string | null;
};

export function UserForm({ stores }: { stores: StoreOpt[] }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createUser, null);
  const [role, setRole] = useState("STORE_MANAGER");
  const [storeId, setStoreId] = useState("");
  if (state?.success && open) setOpen(false);

  const depts = stores.find((s) => s.id === storeId)?.departments ?? [];

  return (
    <div>
      <Button onClick={() => setOpen((v) => !v)} variant={open ? "outline" : "default"}>
        {open ? "キャンセル" : "＋ ユーザーを追加"}
      </Button>
      {open && (
        <Card className="mt-3">
          <CardContent className="pt-5">
            <form action={action} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>氏名 *</Label>
                <Input name="name" required />
              </div>
              <div className="space-y-1.5">
                <Label>メールアドレス *</Label>
                <Input name="email" type="email" required />
              </div>
              <div className="space-y-1.5">
                <Label>初期パスワード *</Label>
                <Input name="password" type="text" placeholder="6文字以上" required />
              </div>
              <div className="space-y-1.5">
                <Label>権限 *</Label>
                <select name="role" className={selectClass} value={role} onChange={(e) => setRole(e.target.value)}>
                  {Object.entries(ROLES).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
                </select>
              </div>
              {role !== "AREA_MANAGER" && (
                <div className="space-y-1.5">
                  <Label>担当店舗</Label>
                  <select name="storeId" className={selectClass} value={storeId} onChange={(e) => setStoreId(e.target.value)}>
                    <option value="">選択</option>
                    {stores.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
                  </select>
                </div>
              )}
              {role === "DEPARTMENT_MANAGER" && depts.length > 0 && (
                <div className="space-y-1.5">
                  <Label>担当部門</Label>
                  <select name="departmentId" className={selectClass}>
                    <option value="">選択</option>
                    {depts.map((d) => (<option key={d.id} value={d.id}>{d.name}</option>))}
                  </select>
                </div>
              )}
              <div className="space-y-1.5">
                <Label>LINE ユーザーID（通知先・任意）</Label>
                <Input name="lineUserId" placeholder="Uxxxxxxxx..." />
              </div>
              <div className="flex items-center gap-2 md:col-span-2">
                <Button type="submit" disabled={pending}>{pending ? "登録中..." : "登録する"}</Button>
                {state?.error && <span className="text-sm text-destructive">{state.error}</span>}
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function EditUserForm({ user, stores, onDone }: { user: EditableUser; stores: StoreOpt[]; onDone: () => void }) {
  const [state, action, pending] = useActionState(updateUser, null);
  const [role, setRole] = useState(user.role);
  const [storeId, setStoreId] = useState(user.storeId ?? "");
  if (state?.success) onDone();

  const depts = stores.find((s) => s.id === storeId)?.departments ?? [];

  return (
    <form action={action} className="grid gap-4 rounded-md border bg-muted/30 p-4 md:grid-cols-2">
      <input type="hidden" name="id" value={user.id} />
      <div className="space-y-1.5">
        <Label>氏名 *</Label>
        <Input name="name" defaultValue={user.name} required />
      </div>
      <div className="space-y-1.5">
        <Label>メールアドレス *</Label>
        <Input name="email" type="email" defaultValue={user.email} required />
      </div>
      <div className="space-y-1.5">
        <Label>権限 *</Label>
        <select name="role" className={selectClass} value={role} onChange={(e) => setRole(e.target.value)}>
          {Object.entries(ROLES).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
        </select>
      </div>
      {role !== "AREA_MANAGER" && (
        <div className="space-y-1.5">
          <Label>担当店舗</Label>
          <select name="storeId" className={selectClass} value={storeId} onChange={(e) => setStoreId(e.target.value)}>
            <option value="">選択</option>
            {stores.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
          </select>
        </div>
      )}
      {role === "DEPARTMENT_MANAGER" && depts.length > 0 && (
        <div className="space-y-1.5">
          <Label>担当部門</Label>
          <select name="departmentId" className={selectClass} defaultValue={user.departmentId ?? ""}>
            <option value="">選択</option>
            {depts.map((d) => (<option key={d.id} value={d.id}>{d.name}</option>))}
          </select>
        </div>
      )}
      <div className="space-y-1.5">
        <Label>LINE ユーザーID（任意）</Label>
        <Input name="lineUserId" defaultValue={user.lineUserId ?? ""} placeholder="Uxxxxxxxx..." />
      </div>
      <div className="space-y-1.5">
        <Label>新しいパスワード（変更する場合のみ・6文字以上）</Label>
        <Input name="password" type="text" placeholder="空欄なら現在のまま" />
      </div>
      <div className="flex items-center gap-2 md:col-span-2">
        <Button type="submit" size="sm" disabled={pending}>{pending ? "保存中..." : "更新する"}</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>閉じる</Button>
        {state?.error && <span className="text-sm text-destructive">{state.error}</span>}
      </div>
    </form>
  );
}

export function EditUserToggle({ user, stores }: { user: EditableUser; stores: StoreOpt[] }) {
  const [open, setOpen] = useState(false);
  if (!open) return <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>編集</Button>;
  return <div className="md:col-span-full"><EditUserForm user={user} stores={stores} onDone={() => setOpen(false)} /></div>;
}
