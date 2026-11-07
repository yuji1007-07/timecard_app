"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveHqSettings, setStoreEditPermission } from "./actions";

export function HqSettingsForm({ currentLoginId }: { currentLoginId: string }) {
  const [state, action, pending] = useActionState(saveHqSettings, null);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (state?.success) {
      // パスワード欄をクリア（IDは新しい値のまま残す）
      const f = formRef.current;
      if (f) {
        for (const name of ["password", "password2"]) {
          const el = f.elements.namedItem(name) as HTMLInputElement | null;
          if (el) el.value = "";
        }
      }
      router.refresh();
    }
  }, [state, router]);

  return (
    <form
      ref={formRef}
      action={action}
      onSubmit={(e) => {
        if (!confirm("本部のID・パスワードを変更します。よろしいですか？\n（次回ログインから新しい情報が必要です）")) e.preventDefault();
      }}
    >
      <div className="field">
        <label className="field__label" htmlFor="setId">
          管理ID <span className="field__req">必須</span>
        </label>
        <input id="setId" name="loginId" className="field__input" type="text" defaultValue={currentLoginId} placeholder="例: honbu" />
      </div>

      <div className="field">
        <label className="field__label" htmlFor="setPw">
          新しいパスワード <span className="field__req">必須</span>
        </label>
        <input id="setPw" name="password" className="field__input" type="text" placeholder="新しいパスワードを入力" autoComplete="new-password" />
        <p className="field__hint">英大文字・小文字・数字・記号を混ぜると安全です（例: Yuji-Honbu#2026）</p>
      </div>

      <div className="field">
        <label className="field__label" htmlFor="setPw2">
          新しいパスワード（確認） <span className="field__req">必須</span>
        </label>
        <input id="setPw2" name="password2" className="field__input" type="text" placeholder="もう一度入力" autoComplete="new-password" />
      </div>

      <div className="form-actions">
        <Link href="/home" className="btn btn--ghost">
          キャンセル
        </Link>
        <button id="saveSet" type="submit" className="btn btn--primary btn--lg" disabled={pending}>
          {pending ? "保存中…" : "保存する"}
        </button>
      </div>
      <p id="setMsg" className={state?.success ? "form-ok" : "form-error"}>
        {state?.error ?? (state?.success ? state.message : "")}
      </p>
    </form>
  );
}

export function StoreEditSwitch({ initial }: { initial: boolean }) {
  const [state, action, pending] = useActionState(setStoreEditPermission, null);
  const [on, setOn] = useState(initial);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (state?.success) {
      setOn(state.allow);
      router.refresh();
    }
  }, [state, router]);

  return (
    <form ref={formRef} action={action}>
      <input type="hidden" name="allow" value={on ? "1" : "0"} />
      <div className="switch-row">
        <div className="switch-row__text">
          <div className="switch-row__title">店舗アカウントにテンプレート編集を許可する</div>
          <div className="switch-row__desc">オフ＝店舗ログインはテンプレート管理を使えません（本部のみ）。オンにすると店舗でも作成・編集できます。</div>
        </div>
        <label className="switch">
          <input
            id="allowEdit"
            type="checkbox"
            checked={on}
            disabled={pending}
            onChange={(e) => {
              const next = e.target.checked;
              setOn(next);
              // 切り替えたら即保存
              const hidden = formRef.current?.elements.namedItem("allow") as HTMLInputElement | null;
              if (hidden) hidden.value = next ? "1" : "0";
              setTimeout(() => formRef.current?.requestSubmit(), 0);
            }}
          />
          <span className="switch__slider" />
        </label>
      </div>
      <p id="permMsg" className={state?.success ? "form-ok" : "form-error"}>
        {pending ? "保存中…" : state?.success ? state.message : ""}
      </p>
    </form>
  );
}
