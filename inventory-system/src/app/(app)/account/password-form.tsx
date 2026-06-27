"use client";

import { useActionState } from "react";
import { changePassword } from "./actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/confirm-submit";

export function PasswordForm() {
  const [result, action] = useActionState(changePassword, undefined);
  return (
    <form action={action} className="max-w-sm space-y-4">
      <div className="space-y-2">
        <Label htmlFor="current">現在のパスワード</Label>
        <Input id="current" name="current" type="password" required autoComplete="current-password" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="next">新しいパスワード（6文字以上）</Label>
        <Input id="next" name="next" type="password" required autoComplete="new-password" />
      </div>
      {result === "OK" ? (
        <p className="text-sm text-green-600">パスワードを変更しました。</p>
      ) : result ? (
        <p className="text-sm text-destructive">{result}</p>
      ) : null}
      <SubmitButton>パスワードを変更</SubmitButton>
    </form>
  );
}
