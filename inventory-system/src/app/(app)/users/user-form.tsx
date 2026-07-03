"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/confirm-submit";
import { ROLES } from "@/lib/constants";
import { createUser } from "./actions";

export function UserForm({ stores }: { stores: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [result, action] = useActionState(createUser, undefined);
  const [role, setRole] = useState("STORE_STAFF");

  if (result === "OK" && open) {
    // 作成成功後フォームを閉じる
    setTimeout(() => setOpen(false), 0);
  }

  if (!open) return <Button size="sm" onClick={() => setOpen(true)}>＋ ユーザーを追加</Button>;

  return (
    <form action={action} className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-2">
      <div className="space-y-1">
        <Label>氏名</Label>
        <Input name="name" required />
      </div>
      <div className="space-y-1">
        <Label>メールアドレス</Label>
        <Input name="email" type="email" required />
      </div>
      <div className="space-y-1">
        <Label>初期パスワード（6文字以上）</Label>
        <Input name="password" type="password" required />
      </div>
      <div className="space-y-1">
        <Label>権限</Label>
        <select name="role" value={role} onChange={(e) => setRole(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
          {Object.entries(ROLES).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>
      {(role === "STORE_STAFF" || role === "STORE_MANAGER") && (
        <div className="space-y-1">
          <Label>担当店舗</Label>
          <select name="storeId" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="">選択してください</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      )}
      {role === "STORE_MANAGER" && (
        <p className="text-xs text-muted-foreground md:col-span-2">
          ※ 店舗マネージャー：自店舗の在庫操作・棚卸に加えて「商品マスタ」「ブランド・カテゴリ」の設定ができます。店舗管理・ユーザー管理・通知/連携設定は不可です。
        </p>
      )}
      <div className="space-y-1">
        <Label>LINE ユーザーID（本部通知先・任意）</Label>
        <Input name="lineUserId" placeholder="Uxxxxxxxx" />
      </div>
      <div className="flex items-center gap-2 md:col-span-2">
        <SubmitButton>追加</SubmitButton>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>キャンセル</Button>
        {result && result !== "OK" && <span className="text-sm text-destructive">{result}</span>}
      </div>
    </form>
  );
}
