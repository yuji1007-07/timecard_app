"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { authenticate, authenticatePin } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type StoreOpt = { id: string; name: string };

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "処理中..." : label}
    </Button>
  );
}

export function LoginForm({ pinStores }: { pinStores: StoreOpt[] }) {
  const [mode, setMode] = useState<"email" | "pin">("email");
  const [emailErr, emailAction] = useActionState(authenticate, undefined);
  const [pinErr, pinAction] = useActionState(authenticatePin, undefined);

  return (
    <div className="space-y-4">
      <div className="flex rounded-md border p-1 text-sm">
        <button
          type="button"
          onClick={() => setMode("email")}
          className={cn(
            "flex-1 rounded px-3 py-1.5 transition-colors",
            mode === "email" ? "bg-navy text-white" : "text-muted-foreground"
          )}
        >
          メール / パスワード
        </button>
        <button
          type="button"
          onClick={() => setMode("pin")}
          className={cn(
            "flex-1 rounded px-3 py-1.5 transition-colors",
            mode === "pin" ? "bg-navy text-white" : "text-muted-foreground"
          )}
        >
          店舗PIN（軽量）
        </button>
      </div>

      {mode === "email" ? (
        <form action={emailAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">メールアドレス</Label>
            <Input id="email" name="email" type="email" placeholder="hq@example.com" required autoComplete="email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">パスワード</Label>
            <Input id="password" name="password" type="password" placeholder="••••••••" required autoComplete="current-password" />
          </div>
          {emailErr && <p className="text-sm text-destructive">{emailErr}</p>}
          <SubmitButton label="ログイン" />
        </form>
      ) : (
        <form action={pinAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="storeId">店舗</Label>
            <select
              id="storeId"
              name="storeId"
              required
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">選択してください</option>
              {pinStores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pin">4桁PIN</Label>
            <Input id="pin" name="pin" inputMode="numeric" maxLength={4} placeholder="0000" required />
          </div>
          {pinErr && <p className="text-sm text-destructive">{pinErr}</p>}
          <SubmitButton label="店舗でログイン" />
        </form>
      )}
    </div>
  );
}
