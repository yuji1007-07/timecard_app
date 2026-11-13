"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { keepForm } from "@/lib/keep-form";
import { assignUsers, unassignUser } from "../actions";

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type Assigned = { id: string; userId: string; name: string; sub: string; required: boolean; due: string | null };
type Staff = { id: string; name: string; position: string; storeId: string; storeName: string };

function UnassignButton({ id, name }: { id: string; name: string }) {
  const [state, action, pending] = useActionState(unassignUser, null);
  const router = useRouter();
  useEffect(() => {
    if (state?.success) router.refresh();
  }, [state, router]);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`${name} さんの指定を解除しますか？（視聴・テストの記録は残ります）`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Button type="submit" size="sm" variant="ghost" className="text-destructive hover:text-destructive" disabled={pending}>
        {pending ? "解除中..." : "解除"}
      </Button>
      {state?.error && <span className="ml-2 text-xs text-destructive">{state.error}</span>}
    </form>
  );
}

export function AssignmentPanel({ videoId, assigned, staff }: { videoId: string; assigned: Assigned[]; staff: Staff[] }) {
  const [open, setOpen] = useState(false);
  const [storeId, setStoreId] = useState("");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [state, action, pending] = useActionState(assignUsers, null);
  const router = useRouter();

  useEffect(() => {
    if (state?.success) {
      setPicked([]);
      router.refresh();
    }
  }, [state, router]);

  const stores = useMemo(() => [...new Map(staff.map((s) => [s.storeId, s.storeName])).entries()], [staff]);
  const assignedIds = useMemo(() => new Set(assigned.map((a) => a.userId)), [assigned]);
  const q = query.trim();
  // 店舗を選ぶか、名前で検索したときだけ候補を出す（100名を一度に並べない）
  const candidates = storeId || q ? staff.filter((s) => (!storeId || s.storeId === storeId) && (!q || s.name.includes(q))) : [];
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <div className="space-y-4">
      {assigned.length === 0 ? (
        <p className="text-sm text-muted-foreground">個人指定しているスタッフはいません。</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {assigned.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5" data-testid="assigned-row">
              <div className="min-w-0 flex-1 basis-56">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-medium">{a.name}</span>
                  {a.required ? <Badge variant="bad">必修</Badge> : <Badge variant="muted">任意</Badge>}
                  {a.due && <Badge variant="outline">期限 {a.due}</Badge>}
                </div>
                <div className="text-xs text-muted-foreground">{a.sub}</div>
              </div>
              <UnassignButton id={a.id} name={a.name} />
            </li>
          ))}
        </ul>
      )}

      <Button type="button" onClick={() => setOpen((v) => !v)} variant={open ? "outline" : "default"}>
        {open ? "閉じる" : "＋ スタッフを指定する"}
      </Button>

      {open && (
        <form onSubmit={keepForm(action)} className="space-y-4 rounded-lg border bg-muted/30 p-4">
          <input type="hidden" name="videoId" value={videoId} />
          {picked.map((id) => (
            <input key={id} type="hidden" name="userIds" value={id} />
          ))}
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>店舗で探す</Label>
              <select className={selectClass} value={storeId} onChange={(e) => setStoreId(e.target.value)} aria-label="店舗で探す">
                <option value="">店舗を選ぶ</option>
                {stores.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>名前で探す</Label>
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="例: 北村" autoComplete="off" aria-label="名前で探す" />
            </div>
          </div>

          {candidates.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {candidates.map((s) => {
                const on = picked.includes(s.id);
                return (
                  <label
                    key={s.id}
                    className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm ${on ? "border-navy ring-1 ring-navy" : "border-input"}`}
                  >
                    <input type="checkbox" checked={on} onChange={() => toggle(s.id)} className="h-4 w-4 shrink-0 accent-[#1e3a5f]" />
                    <span className="min-w-0">
                      <span className="font-medium">{s.name}</span>
                      {assignedIds.has(s.id) && <span className="ml-1.5 text-xs text-purple-700">指定済み</span>}
                      <span className="block truncate text-xs text-muted-foreground">
                        {s.storeName} / {s.position}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{storeId || q ? "該当するスタッフがいません。" : "店舗を選ぶか、名前を入力すると候補が出ます。"}</p>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm">
              <input type="checkbox" name="required" className="h-4 w-4 shrink-0 accent-[#1e3a5f]" />
              <span>
                必修にする
                <span className="block text-xs text-muted-foreground">その人の一覧の上のほうに出て、「必修の未完了者」にも載ります。</span>
              </span>
            </label>
            <div className="space-y-1.5">
              <Label>この人たちだけの期限（空欄なら動画の期限）</Label>
              <Input name="dueDate" type="date" />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={pending || picked.length === 0}>
              {pending ? "指定中..." : picked.length > 0 ? `選んだ${picked.length}名を指定する` : "スタッフを選んでください"}
            </Button>
            {state?.error && <span className="text-sm text-destructive">{state.error}</span>}
            {state?.success && <span className="text-sm text-green-600">{state.message}</span>}
          </div>
          <p className="text-xs text-muted-foreground">すでに指定済みの人をもう一度選ぶと、必修・期限の設定を上書きします。</p>
        </form>
      )}
    </div>
  );
}
