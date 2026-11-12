"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FilterTabs } from "@/components/filter-tabs";
import { POSITIONS, POSITION_ORDER, ROLES, label } from "@/lib/constants";
import { bulkCreateUsers, createUser, updateUser } from "./actions";
import { keepForm } from "@/lib/keep-form";

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type StoreOpt = { id: string; name: string };

export type UserRow = {
  id: string;
  name: string;
  loginId: string;
  role: string;
  position: string;
  storeId: string | null;
  storeName: string;
  brand: string;
  isActive: boolean;
};

function CommonFields({ user, stores, isSelf }: { user?: UserRow; stores: StoreOpt[]; isSelf?: boolean }) {
  return (
    <>
      <div className="space-y-1.5">
        <Label>氏名 *</Label>
        <Input name="name" defaultValue={user?.name} required />
      </div>
      <div className="space-y-1.5">
        <Label>ユーザーID *（勤怠管理と同じID）</Label>
        <Input name="loginId" defaultValue={user?.loginId} required placeholder="例: kitamura" autoComplete="off" />
      </div>
      <div className="space-y-1.5">
        <Label>店舗 *</Label>
        <select name="storeId" className={selectClass} defaultValue={user?.storeId ?? ""} required>
          <option value="">選択</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label>役職 *</Label>
        <select name="position" className={selectClass} defaultValue={user?.position ?? "STAFF"}>
          {POSITION_ORDER.map((p) => (
            <option key={p} value={p}>
              {POSITIONS[p]}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label>権限 *</Label>
        <select name="role" className={selectClass} defaultValue={user?.role ?? "STAFF"} disabled={isSelf}>
          {Object.entries(ROLES).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        {isSelf && <input type="hidden" name="role" value={user?.role} />}
      </div>
    </>
  );
}

export function NewUserForm({ stores }: { stores: StoreOpt[] }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createUser, null);
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
        <Card className="mt-3 text-left">
          <CardContent className="pt-5">
            <form onSubmit={keepForm(action)} className="grid gap-4 md:grid-cols-2">
              <CommonFields stores={stores} />
              <div className="space-y-1.5">
                <Label>初期パスワード *</Label>
                <Input name="password" type="text" required placeholder="4文字以上" autoComplete="off" />
              </div>
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

function EditUserForm({ user, stores, isSelf, onDone }: { user: UserRow; stores: StoreOpt[]; isSelf: boolean; onDone: () => void }) {
  const [state, action, pending] = useActionState(updateUser, null);
  const router = useRouter();
  useEffect(() => {
    if (state?.success) {
      onDone();
      router.refresh();
    }
  }, [state, router, onDone]);

  return (
    <form onSubmit={keepForm(action)} className="mt-3 grid gap-4 rounded-md border bg-muted/30 p-4 md:grid-cols-2">
      <input type="hidden" name="id" value={user.id} />
      <CommonFields user={user} stores={stores} isSelf={isSelf} />
      <div className="space-y-1.5">
        <Label>状態</Label>
        <select name="isActive" className={selectClass} defaultValue={user.isActive ? "1" : "0"} disabled={isSelf}>
          <option value="1">有効（ログイン可）</option>
          <option value="0">無効（ログイン不可・記録は残す）</option>
        </select>
        {isSelf && <input type="hidden" name="isActive" value="1" />}
      </div>
      <div className="space-y-1.5">
        <Label>新しいパスワード（変更する場合のみ）</Label>
        <Input name="password" type="text" placeholder="空欄なら現在のまま" autoComplete="off" />
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

/** スタッフ一覧（ブランド／店舗／役職タブで絞り込み） */
export function UserList({ users, stores, selfId }: { users: UserRow[]; stores: StoreOpt[]; selfId: string }) {
  const [brand, setBrand] = useState("");
  const [storeId, setStoreId] = useState("");
  const [position, setPosition] = useState("");
  const [editing, setEditing] = useState<string | null>(null);

  const brands = useMemo(() => [...new Set(users.map((u) => u.brand))], [users]);
  const storeTabs = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of users) if (u.storeId && u.brand === brand) map.set(u.storeId, u.storeName);
    return [...map.entries()];
  }, [users, brand]);
  const shown = users.filter((u) => (!brand || u.brand === brand) && (!storeId || u.storeId === storeId) && (!position || u.position === position));

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <FilterTabs
          title="ブランド"
          value={brand}
          onChange={(v) => {
            setBrand(v);
            setStoreId("");
          }}
          options={[{ value: "", label: "すべて", count: users.length }, ...brands.map((b) => ({ value: b, label: b, count: users.filter((u) => u.brand === b).length }))]}
        />
        {brand && storeTabs.length > 1 && (
          <FilterTabs
            title="店舗"
            value={storeId}
            onChange={setStoreId}
            options={[{ value: "", label: "すべて" }, ...storeTabs.map(([id, name]) => ({ value: id, label: name, count: users.filter((u) => u.storeId === id).length }))]}
          />
        )}
        <FilterTabs
          title="役職"
          value={position}
          onChange={setPosition}
          options={[{ value: "", label: "すべて" }, ...POSITION_ORDER.filter((p) => users.some((u) => u.position === p)).map((p) => ({ value: p, label: POSITIONS[p] }))]}
        />
      </div>
      <div className="text-sm text-muted-foreground" data-testid="user-count">
        表示 {shown.length}名{shown.length !== users.length ? ` / 全${users.length}名` : ""}
      </div>
      <div className="divide-y rounded-lg border">
        {shown.map((u) => (
          <div key={u.id} className="p-3" data-testid="user-row">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <div className="min-w-0 flex-1 basis-56">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-medium">{u.name}</span>
                  {u.role === "ADMIN" ? <Badge>本部</Badge> : <Badge variant="outline">{label(POSITIONS, u.position)}</Badge>}
                  {!u.isActive && <Badge variant="muted">無効</Badge>}
                </div>
                <div className="text-xs text-muted-foreground">
                  ID: {u.loginId}・{u.storeName}
                </div>
              </div>
              {editing !== u.id && (
                <Button size="sm" variant="outline" onClick={() => setEditing(u.id)}>
                  編集
                </Button>
              )}
            </div>
            {editing === u.id && <EditUserForm user={u} stores={stores} isSelf={u.id === selfId} onDone={() => setEditing(null)} />}
          </div>
        ))}
        {shown.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">該当するスタッフはいません。</div>}
      </div>
    </div>
  );
}

/** CSV ファイルを読み込む（Excel の Shift_JIS 保存にも対応） */
async function readCsvFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder("shift_jis").decode(buf);
  }
}

export function BulkUserForm() {
  const [state, action, pending] = useActionState(bulkCreateUsers, null);
  const [text, setText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const ok = state && "success" in state ? state : null;
  const error = state && "error" in state ? state.error : null;
  useEffect(() => {
    if (ok) router.refresh();
  }, [ok, router]);

  return (
    <form action={action} className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv,text/plain"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) setText(await readCsvFile(f));
            e.target.value = "";
          }}
        />
        <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
          CSVファイルを選ぶ
        </Button>
        <span className="text-xs text-muted-foreground">または、Excel の表をそのまま下の枠に貼り付けてもOKです。</span>
      </div>
      <Textarea
        name="bulkText"
        rows={7}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={"氏名,ユーザーID,店舗名,役職,初期パスワード\n河原 太郎,kawahara,からだラボ整骨院 溝の口院,店長,pass1234\n岩村 花子,iwamura,ラコンシェル町田店,スタッフ,pass1234"}
        className="font-mono text-xs"
      />
      <p className="text-xs text-muted-foreground">
        役職は 店長／副店長／リーダー／スタッフ（空欄はスタッフ）。すでに登録済みのユーザーIDは上書きせずスキップします。
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="secondary" disabled={pending || !text.trim()}>
          {pending ? "登録中..." : "一括登録する"}
        </Button>
        {error && <span className="text-sm text-destructive">{error}</span>}
        {ok && (
          <span className="text-sm font-medium text-green-600" data-testid="bulk-result">
            {ok.created} 名を登録しました。
          </span>
        )}
      </div>
      {ok && ok.errors.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-5 text-sm text-destructive">
          {ok.errors.slice(0, 30).map((e, i) => (
            <li key={i}>{e}</li>
          ))}
          {ok.errors.length > 30 && <li>ほか {ok.errors.length - 30} 件あります。</li>}
        </ul>
      )}
    </form>
  );
}
