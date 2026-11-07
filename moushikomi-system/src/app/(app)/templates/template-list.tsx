"use client";

// テンプレート管理（一覧）の操作ボタン（旧アプリ templateList.js の移植）

import { useActionState, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteTemplate, duplicateTemplate, loadKaradaTemplates } from "./actions";

export function TemplateRowActions({ id }: { id: string }) {
  const router = useRouter();
  const [dupState, dupAction, dupPending] = useActionState(duplicateTemplate, null);
  const [delState, delAction, delPending] = useActionState(deleteTemplate, null);

  useEffect(() => {
    if (dupState?.ok) router.refresh();
    else if (dupState && !dupState.ok) alert("複製に失敗しました。" + dupState.message);
  }, [dupState, router]);
  useEffect(() => {
    if (delState?.ok) router.refresh();
    else if (delState && !delState.ok) alert("削除に失敗しました。" + delState.message);
  }, [delState, router]);

  return (
    <div className="flex items-center gap-2">
      <Link href={`/templates/${encodeURIComponent(id)}`} prefetch={false} className="btn btn--small btn--primary">
        編集
      </Link>
      <form action={dupAction}>
        <input type="hidden" name="id" value={id} />
        <button type="submit" className="btn btn--small" disabled={dupPending} data-dup={id}>
          {dupPending ? "複製中…" : "複製"}
        </button>
      </form>
      <form
        action={delAction}
        onSubmit={(e) => {
          if (!confirm("このテンプレートを削除しますか？")) e.preventDefault();
        }}
      >
        <input type="hidden" name="id" value={id} />
        <button type="submit" className="btn btn--small btn--danger" disabled={delPending} data-del={id}>
          {delPending ? "削除中…" : "削除"}
        </button>
      </form>
    </div>
  );
}

/** からだラボ標準テンプレートを読み込む（新規追加＋既存の標準は最新の正式文に更新） */
export function LoadKaradaButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  function onClick() {
    if (
      !confirm(
        "からだラボ整骨院／狛江駅前整骨院の標準テンプレートを読み込みます。\n（未登録のものは追加し、すでにある標準テンプレートは最新の正式な契約文に更新します）"
      )
    ) {
      return;
    }
    setBusy(true);
    startTransition(async () => {
      try {
        const res = await loadKaradaTemplates();
        alert(res.message);
        router.refresh();
      } catch {
        alert("読み込みに失敗しました。通信状態を確認してください。");
      } finally {
        setBusy(false);
      }
    });
  }

  return (
    <button id="loadKarada" type="button" className="btn" onClick={onClick} disabled={pending || busy}>
      {pending || busy ? "読み込み中…" : "＋ からだラボ標準を読み込む"}
    </button>
  );
}
