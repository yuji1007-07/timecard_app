"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/confirm-submit";
import { BrandBadge } from "@/components/badges";
import { yen } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { confirmStocktake } from "../actions";

type Row = {
  productId: string;
  name: string;
  size: string | null; // サイズ（S/M/L等。無ければnull）
  brandName: string;
  brandColor: string;
  unit: string;
  theoretical: number; // 理論在庫
  noRecord: boolean; // この店舗で入荷・棚卸の記録が一度も無い（＝0は「売り切れ」ではなく「未登録」）
  prevActual: number | null; // 既存棚卸の実数（あれば初期値）
};

export function StocktakeForm({
  storeId,
  month,
  rows,
  assigneeDefault,
  already,
}: {
  storeId: string;
  month: string;
  rows: Row[];
  assigneeDefault: string;
  already: { confirmedAt: string; assigneeName: string | null; txSince: number } | null;
}) {
  const router = useRouter();
  // 前回の実数はあえて初期値に入れない。
  // 入れてしまうと「開いて確定を押しただけ」で前回の数値が今の在庫として上書きされ、
  // その間に記録した消耗・発注が打ち消されてしまうため（前回値は参考列に表示する）。
  const [actuals, setActuals] = useState<Record<string, string>>({});
  const [result, action] = useActionState(confirmStocktake, undefined);

  // 確定成功後は、社長提出用の報告書印刷ボタンを表示する
  if (result?.ok) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-green-300 bg-green-50 p-5">
          <p className="text-lg font-bold text-green-700">棚卸を確定しました ✓</p>
          <p className="mt-1 text-sm text-green-800">{result.message}</p>
        </div>
        <div className="rounded-lg border bg-card p-5">
          <p className="mb-3 text-sm font-medium">社長へ提出する報告書（A4）を印刷・PDF保存できます。</p>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <a href={`/print/stocktake-report?store=${storeId}&month=${month}`} target="_blank" rel="noopener noreferrer">
                📄 棚卸報告書を印刷 / PDF保存
              </a>
            </Button>
            <Button variant="outline" onClick={() => { router.push("/stocktake"); router.refresh(); }}>
              棚卸一覧へ戻る
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            ※ 新しいタブで報告書が開きます。右上の「印刷 / PDF保存」から、印刷または PDF として保存してください。
          </p>
        </div>
      </div>
    );
  }

  // 入力済みのズレサマリー
  let diffCount = 0;
  let entered = 0;
  for (const r of rows) {
    const v = actuals[r.productId];
    if (v === "" || v == null) continue;
    entered++;
    if (Number(v) - r.theoretical !== 0) diffCount++;
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="storeId" value={storeId} />
      <input type="hidden" name="month" value={month} />

      {already && (
        <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-bold text-amber-900">
            この月（{month}）の棚卸は確定済みです（{already.confirmedAt}
            {already.assigneeName ? ` / ${already.assigneeName}` : ""}）
          </p>
          <p className="mt-1 text-sm text-amber-900">
            数量を入れた商品だけが、今の数量で上書きされます。
            {already.txSince > 0 && (
              <>
                {" "}確定後に記録された取引が <span className="font-bold">{already.txSince}件</span>{" "}
                あります。数え直した商品はその取引ぶんも含んだ「今ある数」を入力してください。
              </>
            )}
          </p>
          <p className="mt-1 text-xs text-amber-800">
            ※ 空欄の商品は変更されません。前回の数値はあえて自動入力していません（そのまま確定して在庫が巻き戻るのを防ぐため）。
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg border bg-card p-4">
        <div className="space-y-1">
          <Label>棚卸担当者</Label>
          <Input name="assigneeName" defaultValue={assigneeDefault} className="w-48" />
        </div>
        <div className="flex gap-4 text-sm">
          <div>入力済: <span className="font-semibold tabular-nums">{entered}/{rows.length}</span></div>
          <div>ズレ見込: <span className={cn("font-semibold tabular-nums", diffCount > 0 ? "text-red-600" : "text-green-600")}>{diffCount}</span></div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">ブランド</th>
              <th className="px-3 py-2 text-left">商品名</th>
              <th className="px-3 py-2 text-right">理論在庫</th>
              {already && <th className="px-3 py-2 text-right">前回入力</th>}
              <th className="px-3 py-2 text-right">実在庫</th>
              <th className="px-3 py-2 text-right">ズレ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const v = actuals[r.productId];
              const diff = v === "" || v == null ? null : Number(v) - r.theoretical;
              return (
                <tr key={r.productId} className={cn("border-t", diff != null && diff !== 0 && "bg-red-50")}>
                  <td className="px-3 py-2"><BrandBadge name={r.brandName} color={r.brandColor} /></td>
                  <td className="px-3 py-2 font-medium">
                    <span className="align-middle">{r.name}</span>
                    {r.size && <span className="ml-1.5 rounded bg-navy/10 px-1.5 py-0.5 align-middle text-xs font-semibold text-navy">{r.size}</span>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    <span className="align-middle">{r.theoretical} {r.unit}</span>
                    {r.noRecord && (
                      <span
                        title="この店舗では入荷（発注）も過去の棚卸も記録がないため0になっています。実物がある場合は数量を入力すれば正しい在庫になります。"
                        className="ml-1.5 whitespace-nowrap rounded bg-amber-100 px-1.5 py-0.5 align-middle text-[10px] font-medium text-amber-700"
                      >
                        入荷記録なし
                      </span>
                    )}
                  </td>
                  {already && (
                    <td className="px-3 py-2 text-right tabular-nums text-xs text-muted-foreground">
                      {r.prevActual != null ? r.prevActual : "-"}
                    </td>
                  )}
                  <td className="px-3 py-2 text-right">
                    <input
                      name={`actual_${r.productId}`}
                      type="number"
                      min={0}
                      value={v ?? ""}
                      onChange={(e) => setActuals((s) => ({ ...s, [r.productId]: e.target.value }))}
                      className="h-9 w-20 rounded-md border border-input bg-background px-2 text-right tabular-nums"
                      placeholder="-"
                    />
                  </td>
                  <td className={cn("px-3 py-2 text-right font-semibold tabular-nums", diff == null ? "text-muted-foreground" : diff === 0 ? "text-green-600" : "text-red-600")}>
                    {diff == null ? "-" : diff > 0 ? `+${diff}` : diff}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {result && (
        <p className={cn("text-sm", result.ok ? "text-green-600" : "text-destructive")}>{result.message}</p>
      )}
      <div className="flex gap-2">
        <SubmitButton>棚卸を確定</SubmitButton>
        <Button type="button" variant="ghost" onClick={() => router.push("/stocktake")}>キャンセル</Button>
      </div>
      <p className="text-xs text-muted-foreground">
        ※ 確定すると、入力した実在庫がこの時点の在庫基準になります。以降の発注・消耗はこの実数に積み上がります。
      </p>
      <p className="text-xs text-muted-foreground">
        ※ <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">入荷記録なし</span>{" "}
        は「この店舗で入荷（発注）を一度も記録していないので0になっている」商品です。売り切れとは違います。実物があれば数量を入力すれば正しい在庫になります。
      </p>
      <p className="text-xs text-muted-foreground">
        ※ 数量が空欄の商品は在庫を変更しません（数え忘れで在庫が消えるのを防ぐため）。0にしたい場合は「0」と入力してください。
      </p>
    </form>
  );
}
