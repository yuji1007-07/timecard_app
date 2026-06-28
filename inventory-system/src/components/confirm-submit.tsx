"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * 確認ダイアログ付きの送信ボタン（取引取り消し・削除などの誤操作対策）。
 * 親は <form action={serverAction}> で囲って使う。
 */
export function ConfirmSubmit({
  children,
  message,
  variant = "destructive",
  size = "sm",
  className,
}: {
  children: React.ReactNode;
  message: string;
  variant?: "destructive" | "outline" | "ghost" | "secondary" | "default";
  size?: "sm" | "default" | "lg" | "icon";
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      disabled={pending}
      className={cn(className)}
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      {pending ? "処理中..." : children}
    </Button>
  );
}

export function SubmitButton({
  children,
  className,
  variant = "default",
  size = "default",
}: {
  children: React.ReactNode;
  className?: string;
  variant?: "destructive" | "outline" | "ghost" | "secondary" | "default";
  size?: "sm" | "default" | "lg" | "icon";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className={className} variant={variant} size={size}>
      {pending ? "処理中..." : children}
    </Button>
  );
}
