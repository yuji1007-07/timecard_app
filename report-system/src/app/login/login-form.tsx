"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { authenticate } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "ログイン中..." : "ログイン"}
    </Button>
  );
}

export function LoginForm() {
  const [errorMessage, formAction] = useActionState(authenticate, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">メールアドレス</Label>
        <Input id="email" name="email" type="email" placeholder="admin@example.com" required autoComplete="email" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">パスワード</Label>
        <Input id="password" name="password" type="password" placeholder="••••••••" required autoComplete="current-password" />
      </div>
      {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
      <SubmitButton />
    </form>
  );
}
