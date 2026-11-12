"use client";

import { startTransition, type FormEvent } from "react";

/**
 * <form onSubmit={keepForm(action)}> の形で使う。
 * <form action={...}> だと、React 19 は送信後に入力欄を自動で空に戻すため、
 * 入力エラーのときに打ち込んだ内容が消えてしまう。長いフォームではこれで入力を残す。
 * （useActionState + サーバーアクションの形はそのまま）
 */
export function keepForm(action: (formData: FormData) => void) {
  return (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => action(formData));
  };
}
