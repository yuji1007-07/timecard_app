"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createUser, deleteUser, updateUser } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ROLES } from "@/lib/constants";

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type StoreOpt = { id: string; name: string };

export type EditableUser = {
  id: string;
  name: string;
  loginId: string;
  role: string;
  storeId: string | null;
  isActive: boolean;
};

function StoreSelect({ stores, defaultValue, required }: { stores: StoreOpt[]; defaultValue?: string; required?: boolean }) {
  return (
    <select name="storeId" className={selectClass} defaultValue={defaultValue ?? ""} required={required}>
      <option value="">選択</option>
      {stores.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </select>
  );
}

export function UserForm({ stores }: { stores: StoreOpt[] }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createUser, null);
  const [role, setRole] = useState("STAFF");
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
        {open ? "キャンセル" : "＋ アカウントを追加"}
      </Button>
      {open && (
        <Card className="mt-3">
          <CardContent className="pt-5">
            <form action={action} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>氏名・表示名 *</Label>
                <Input name="name" required placeholder="例: 狛江院 / 本部 山田" />
              </div>
              <div className="space-y-1.5">
                <Label>ユーザーID *</Label>
                <Input name="loginId" required placeholder="例: store1007" autoComplete="off" />
              </div>
              <div className="space-y-1.5">
                <Label>初期パスワード *</Label>
                <Input name="password" type="text" required placeholder="4文字以上" autoComplete="off" />
              </div>
              <div className="space-y-1.5">
                <Label>権限 *</Label>
                <select name="role" className={selectClass} value={role} onChange={(e) => setRole(e.target.value)}>
                  {Object.entries(ROLES).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              {role === "STAFF" && (
                <div className="space-y-1.5 md:col-span-2">
                  <Label>所属店舗 *</Label>
                  <StoreSelect stores={stores} required />
                </div>
              )}
              <div className="flex items-center gap-2 md:col-span-2">
                <Button type="submit" disabled={pending}>
                  {pending ? "登録中..." : "登録する"}
                </Button>
                {state?.error && <span className="text-sm text-destructive">{state.error}</span>}
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function EditUserForm({ user, stores, isSelf, onDone }: { user: EditableUser; stores: StoreOpt[]; isSelf: boolean; onDone: () => void }) {
  const [state, action, pending] = useActionState(updateUser, null);
  const [role, setRole] = useState(user.role);
  const router = useRouter();
  useEffect(() => {
    if (state?.success) {
      onDone();
      router.refresh();
    }
  }, [state, router, onDone]);

  return (
    <form action={action} className="mt-3 grid gap-4 rounded-md border bg-muted/30 p-4 md:grid-cols-2">
      <input type="hidden" name="id" value={user.id} />
      <div className="space-y-1.5">
        <Label>氏名・表示名 *</Label>
        <Input name="name" defaultValue={user.name} required />
      </div>
      <div className="space-y-1.5">
        <Label>ユーザーID *</Label>
        <Input name="loginId" defaultValue={user.loginId} required autoComplete="off" />
      </div>
      <div className="space-y-1.5">
        <Label>権限 *</Label>
        <select name="role" className={selectClass} value={role} onChange={(e) => setRole(e.target.value)} disabled={isSelf}>
          {Object.entries(ROLES).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        {isSelf && <input type="hidden" name="role" value={user.role} />}
      </div>
      {role === "STAFF" && (
        <div className="space-y-1.5">
          <Label>所属店舗 *</Label>
          <StoreSelect stores={stores} defaultValue={user.storeId ?? ""} required />
        </div>
      )}
      <div className="space-y-1.5">
        <Label>新しいパスワード（変更する場合のみ）</Label>
        <Input name="password" type="text" placeholder="空欄なら現在のまま" autoComplete="off" />
      </div>
      <div className="space-y-1.5">
        <Label>状態</Label>
        <select name="isActive" className={selectClass} defaultValue={user.isActive ? "1" : "0"} disabled={isSelf}>
          <option value="1">有効（ログイン可）</option>
          <option value="0">無効（ログイン不可・履歴は残す）</option>
        </select>
      </div>
      <div className="flex items-center gap-2 md:col-span-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "保存中..." : "更新する"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          閉じる
        </Button>
        {state?.error && <span className="text-sm text-destructive">{state.error}</span>}
      </div>
    </form>
  );
}

export function EditUserToggle({ user, stores, isSelf }: { user: EditableUser; stores: StoreOpt[]; isSelf: boolean }) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        編集
      </Button>
    );
  return (
    <div className="w-full basis-full">
      <EditUserForm user={user} stores={stores} isSelf={isSelf} onDone={() => setOpen(false)} />
    </div>
  );
}

export function DeleteUserButton({ id, name }: { id: string; name: string }) {
  const [state, action, pending] = useActionState(deleteUser, null);
  const router = useRouter();
  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`本当に ${name} を削除しますか？`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Button type="submit" size="sm" variant="ghost" className="text-destructive hover:text-destructive" disabled={pending}>
        {pending ? "削除中..." : "削除"}
      </Button>
      {state && !state.ok && <span className="ml-2 text-xs text-destructive">{state.message}</span>}
    </form>
  );
}
