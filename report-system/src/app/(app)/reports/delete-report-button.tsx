"use client";

// 報告の削除ボタン。テストで作った報告を消せるようにするためのもの。
// 誤操作を防ぐため、対象名を出した確認ダイアログを挟む。

import { Button } from "@/components/ui/button";
import { deleteReport } from "./actions";

export function DeleteReportButton({ id, label }: { id: string; label: string }) {
  return (
    <form
      action={deleteReport}
      onSubmit={(e) => {
        if (!window.confirm(`「${label}」を削除します。\n入力したKPI・振り返り・アクションもすべて消え、元に戻せません。よろしいですか？`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Button type="submit" size="sm" variant="ghost" className="text-destructive hover:text-destructive" title="この報告を削除">
        削除
      </Button>
    </form>
  );
}
