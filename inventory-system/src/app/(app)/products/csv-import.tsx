"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/confirm-submit";
import { importCsv } from "./actions";

const SAMPLE = `ブランド名,商品名,通常価格(税抜),通常価格(税込),卸価格(税抜),卸価格(税込),税率,カテゴリ,単位
ReFa,ReFa グレイス ヘッドスパ,,49800,,30000,10,美容機器,個
プロラボ,プロラボ ハーブザイム 500,,5400,,2900,8,サプリ,本`;

export function CsvImport() {
  const [open, setOpen] = useState(false);
  const [result, action] = useActionState(importCsv, undefined);

  if (!open) return <Button variant="outline" size="sm" onClick={() => setOpen(true)}>CSVインポート</Button>;

  return (
    <form action={action} className="space-y-2 rounded-lg border bg-card p-4">
      <p className="text-sm text-muted-foreground">
        列: ブランド名, 商品名, 通常価格(税抜), 通常価格(税込), 卸価格(税抜), 卸価格(税込), 税率, カテゴリ, 単位
        <br />
        片方しか無い価格は税率からもう片方を自動計算。卸価格が空欄(0)はそのまま0で登録。同名商品は更新。
      </p>
      <textarea
        name="csv"
        rows={8}
        defaultValue={SAMPLE}
        className="w-full rounded-md border border-input bg-background p-3 font-mono text-xs"
      />
      <div className="flex items-center gap-2">
        <SubmitButton>取り込む</SubmitButton>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>閉じる</Button>
        {result && <span className="text-sm text-green-600">{result}</span>}
      </div>
    </form>
  );
}
