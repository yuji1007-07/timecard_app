"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { bulkCreateUsers, createUser, deleteUser, updateUser } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  permissionStoreIds: string[];
};

function PermissionGrid({ stores, defaultChecked }: { stores: StoreOpt[]; defaultChecked?: string[] }) {
  const set = new Set(defaultChecked ?? []);
  return (
    <fieldset className="md:col-span-2">
      <legend className="mb-2 text-sm font-medium">担当店舗（店舗責任者にする場合のみチェック）</legend>
      <div className="grid gap-2 rounded-md border p-3 sm:grid-cols-2 lg:grid-cols-3">
        {stores.map((s) => (
          <label key={s.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="permissionStoreIds" value={s.id} defaultChecked={set.has(s.id)} className="h-4 w-4 rounded border-input" />
            {s.name}
          </label>
        ))}
      </div>
    </fieldset>
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
        {open ? "キャンセル" : "＋ スタッフを追加"}
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
                <Label>ユーザーID *</Label>
                <Input name="loginId" required placeholder="例: kitamura" autoComplete="off" />
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
              <div className="space-y-1.5 md:col-span-2">
                <Label>主所属店舗 *</Label>
                <select name="storeId" className={selectClass} defaultValue="" required>
                  <option value="">選択</option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              {role === "STAFF" && <PermissionGrid stores={stores} />}
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
        <Label>氏名 *</Label>
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
      <div className="space-y-1.5">
        <Label>主所属店舗 *</Label>
        <select name="storeId" className={selectClass} defaultValue={user.storeId ?? ""} required>
          <option value="">選択</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
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
      {role === "STAFF" && <PermissionGrid stores={stores} defaultChecked={user.permissionStoreIds} />}
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

export function BulkUserForm() {
  const [state, action, pending] = useActionState(bulkCreateUsers, null);
  const router = useRouter();
  useEffect(() => {
    if (state?.success) router.refresh();
  }, [state, router]);

  return (
    <form action={action} className="space-y-3">
      <p className="text-sm text-muted-foreground">
        1行に1名ずつ、<strong>氏名,ユーザーID,初期PW,主所属店舗,権限,担当店舗1|担当店舗2</strong> の順で貼り付けてください。
        権限は省略すると staff、担当店舗は省略できます。
      </p>
      <Textarea
        name="bulkText"
        rows={6}
        placeholder={"北村優次,kitamura,pass123,からだラボ整骨院 溝の口院,admin\n河原,kawahara,staff1234,からだラボ整骨院 溝の口院,staff,からだラボ整骨院 溝の口院|からだラボ整骨院 溝の口分院\n岩村,iwamura,staff1234,ラコンシェル町田店,staff,ラコンシェル町田店"}
        className="font-mono text-xs"
      />
      <div className="flex items-center gap-3">
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "登録中..." : "一括登録する"}
        </Button>
        {state?.error && <span className="text-sm text-destructive">{state.error}</span>}
        {state?.success && <span className="text-sm text-green-600">{state.created} 名を追加しました。</span>}
      </div>
      {state?.success && state.errors.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-5 text-sm text-destructive">
          {state.errors.slice(0, 20).map((e, i) => (
            <li key={i}>{e}</li>
          ))}
          {state.errors.length > 20 && <li>ほか {state.errors.length - 20} 件のエラーがあります。</li>}
        </ul>
      )}
    </form>
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
        if (!confirm(`本当に ${name} を削除しますか？打刻履歴も削除されます。`)) e.preventDefault();
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
