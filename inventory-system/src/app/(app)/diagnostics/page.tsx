import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/stat-card";
import { TxTypeBadge } from "@/components/badges";
import { requireAreaManager } from "@/lib/session";
import { getDiagnostics } from "@/lib/diagnostics";

export const dynamic = "force-dynamic";

function jst(iso: string): string {
  return new Date(iso).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);
const th = "whitespace-nowrap px-3 py-2 text-left font-medium";
const td = "px-3 py-2 align-top";

/**
 * 在庫診断（本部のみ）。在庫数が合わない原因になりうるデータを店舗ごとに一覧する。
 * この画面は読み取りだけで、データは書き換えない。
 */
export default async function DiagnosticsPage() {
  await requireAreaManager();
  const d = await getDiagnostics();
  const t = d.totals;
  const flagged = d.stores.filter(
    (s) =>
      s.duplicates.length ||
      s.backdated.length ||
      s.lateOrders.length ||
      s.negatives.length ||
      s.transferOrderPairs.length ||
      s.stocktakes.some((x) => x.suspicious)
  );

  return (
    <div>
      <PageHeader
        title="在庫診断"
        description="在庫数が合わない原因になりうる記録を、店舗ごとに洗い出します。この画面を開いてもデータは変わりません。"
        action={
          <Button asChild size="sm">
            <a href="/diagnostics/download">診断データをダウンロード</a>
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <StatCard label="二重登録の疑い" value={`${t.duplicateGroups}`} sub={`余分な記録 ${t.duplicateExtra}件`} tone={t.duplicateGroups ? "bad" : "good"} />
        <StatCard label="商品数が減った棚卸" value={`${t.suspiciousStocktakes}`} tone={t.suspiciousStocktakes ? "warn" : "good"} />
        <StatCard label="過去日付で足していない取引" value={`${t.backdated}`} tone={t.backdated ? "warn" : "good"} />
        <StatCard label="マイナス在庫" value={`${t.negatives}`} tone={t.negatives ? "bad" : "good"} />
        <StatCard label="移動と発注の重なり" value={`${t.transferOrderPairs}`} tone={t.transferOrderPairs ? "warn" : "good"} />
        <StatCard label="同名の重複商品" value={`${t.duplicateProducts}`} tone={t.duplicateProducts ? "warn" : "good"} />
      </div>

      <Card className="mb-4 p-4 text-sm text-muted-foreground">
        <ul className="list-disc space-y-1 pl-5">
          <li><span className="font-medium text-foreground">二重登録の疑い</span>：同じ商品・種別・数量・取引日の記録が2分以内に続けて入力されています。余分なものは取引履歴から「取消」できます。</li>
          <li><span className="font-medium text-foreground">商品数が減った棚卸</span>：それ以前の月より棚卸した商品数が半分未満の月です。やり直しで他の商品の数が消えた可能性があります。</li>
          <li><span className="font-medium text-foreground">過去日付で足していない取引</span>：棚卸を確定した後に、棚卸日以前の日付で入力された消耗・社販・プレゼント・移動です。棚卸で数えた数に含まれている扱いのため、在庫には足していません。</li>
          <li><span className="font-medium text-foreground">棚卸後に入力した過去日付の入荷</span>（全店 {t.lateOrders}件）：入荷は届いてから発注日で入力されることが多いため、在庫に足しています。棚卸のときにもう棚にあった分なら、取引履歴から「取消」してください。</li>
          <li><span className="font-medium text-foreground">移動と発注の重なり</span>：店舗間移動で入庫が付いた商品に、同じ数量の発注（入荷）も記録されています。同じ荷物を2回数えている可能性があります。</li>
          <li>スプレッドシート連携：{d.sheetsConfigured ? "有効（「棚卸」シートに過去の棚卸の数が残っています）" : "未設定"}</li>
        </ul>
      </Card>

      {d.duplicateProducts.length > 0 && (
        <Card className="mb-4 overflow-x-auto">
          <div className="border-b px-4 py-2 text-sm font-semibold">同じ名前・サイズの商品が複数あります（{d.duplicateProducts.length}組）</div>
          <table className="w-full text-sm">
            <tbody>
              {d.duplicateProducts.map((p, i) => (
                <tr key={i} className="border-t">
                  <td className={td}>{p.brandName}</td>
                  <td className={td}>{p.name}{p.size ? `（${p.size}）` : ""}</td>
                  <td className={`${td} text-muted-foreground`}>{p.productIds.length}件登録されています</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {flagged.length === 0 && (
        <Card className="p-6 text-center text-sm text-green-700">該当する記録は見つかりませんでした。</Card>
      )}

      <div className="space-y-4">
        {flagged.map((s) => (
          <Card key={s.storeId} className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-secondary/40 px-4 py-2">
              <span className="font-bold">{s.storeName}</span>
              <span className="flex gap-2">
                <Button asChild size="sm" variant="outline"><Link href={`/transactions?store=${s.storeId}`}>取引履歴</Link></Button>
                <Button asChild size="sm" variant="outline"><Link href={`/inventory?store=${s.storeId}`}>在庫一覧</Link></Button>
              </span>
            </div>

            {s.duplicates.length > 0 && (
              <div className="overflow-x-auto border-b">
                <div className="px-4 pt-3 text-sm font-semibold text-red-700">二重登録の疑い（{s.duplicates.length}組）</div>
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr><th className={th}>取引日</th><th className={th}>種別</th><th className={th}>商品</th><th className={th}>数量</th><th className={th}>件数</th><th className={th}>入力日時</th><th className={th}>在庫への影響</th></tr>
                  </thead>
                  <tbody>
                    {s.duplicates.map((g, i) => (
                      <tr key={i} className="border-t">
                        <td className={`${td} whitespace-nowrap`}>{g.date}</td>
                        <td className={`${td} whitespace-nowrap`}><TxTypeBadge type={g.type} /></td>
                        <td className={`${td} min-w-40`}><Link className="underline decoration-dotted" href={`/inventory/breakdown?store=${s.storeId}&product=${g.productId}`}>{g.productName}</Link></td>
                        <td className={`${td} tabular-nums`}>{g.quantity}</td>
                        <td className={`${td} whitespace-nowrap font-semibold tabular-nums text-red-700`}>{g.count}件</td>
                        <td className={`${td} text-xs text-muted-foreground`}>{g.enteredAt.map(jst).join(" / ")}</td>
                        <td className={`${td} text-xs`}>{g.inStock ? "あり" : "なし（棚卸に含まれる）"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {s.stocktakes.some((x) => x.suspicious) && (
              <div className="overflow-x-auto border-b">
                <div className="px-4 pt-3 text-sm font-semibold text-amber-700">棚卸した商品数の推移</div>
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr><th className={th}>対象月</th><th className={th}>棚卸日</th><th className={th}>最終確定</th><th className={th}>商品数</th><th className={th}></th></tr>
                  </thead>
                  <tbody>
                    {s.stocktakes.map((x) => (
                      <tr key={x.targetMonth} className={`border-t ${x.suspicious ? "bg-amber-50" : ""}`}>
                        <td className={td}>{x.targetMonth}</td>
                        <td className={td}>{x.countedDay}</td>
                        <td className={`${td} text-xs text-muted-foreground`}>{jst(x.confirmedAt)}</td>
                        <td className={`${td} tabular-nums`}>{x.itemCount}</td>
                        <td className={`${td} text-xs text-amber-700`}>{x.suspicious ? "商品数が大きく減っています" : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {s.negatives.length > 0 && (
              <div className="border-b px-4 py-3">
                <div className="mb-2 text-sm font-semibold text-red-700">マイナス在庫（{s.negatives.length}商品）</div>
                <div className="flex flex-wrap gap-2">
                  {s.negatives.map((n) => (
                    <Link key={n.productId} href={`/inventory/breakdown?store=${s.storeId}&product=${n.productId}`} className="rounded-full bg-red-100 px-3 py-1 text-xs text-red-700 underline decoration-dotted">
                      {n.productName}：{n.stock}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {s.transferOrderPairs.length > 0 && (
              <div className="overflow-x-auto border-b">
                <div className="px-4 pt-3 text-sm font-semibold text-amber-700">移動入庫と発注の重なり（{s.transferOrderPairs.length}件）</div>
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr><th className={th}>商品</th><th className={th}>数量</th><th className={th}>移動入庫の日付</th><th className={th}>発注の日付</th></tr>
                  </thead>
                  <tbody>
                    {s.transferOrderPairs.map((p, i) => (
                      <tr key={i} className="border-t">
                        <td className={`${td} min-w-40`}><Link className="underline decoration-dotted" href={`/inventory/breakdown?store=${s.storeId}&product=${p.productId}`}>{p.productName}</Link></td>
                        <td className={`${td} tabular-nums`}>{p.quantity}</td>
                        <td className={td}>{p.transferDate}</td>
                        <td className={td}>{p.orderDate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {s.lateOrders.length > 0 && (
              <details className="px-4 py-3">
                <summary className="cursor-pointer text-sm font-semibold text-amber-700">
                  棚卸後に入力した過去日付の入荷（{s.lateOrders.length}件・在庫に足しています）
                </summary>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground">
                      <tr><th className={th}>取引日</th><th className={th}>入力日時</th><th className={th}>棚卸日</th><th className={th}>商品</th><th className={th}>数量</th><th className={th}>メモ</th></tr>
                    </thead>
                    <tbody>
                      {s.lateOrders.map((b, i) => (
                        <tr key={i} className="border-t">
                          <td className={`${td} whitespace-nowrap`}>{b.date}</td>
                          <td className={`${td} text-xs text-muted-foreground`}>{jst(b.enteredAt)}</td>
                          <td className={`${td} whitespace-nowrap`}>{b.stocktakeDay}</td>
                          <td className={`${td} min-w-40`}><Link className="underline decoration-dotted" href={`/inventory/breakdown?store=${s.storeId}&product=${b.productId}`}>{b.productName}</Link></td>
                          <td className={`${td} tabular-nums`}>{signed(b.signed)}</td>
                          <td className={`${td} text-xs text-muted-foreground`}>{b.memo ?? ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}

            {s.backdated.length > 0 && (
              <details className="px-4 py-3">
                <summary className="cursor-pointer text-sm font-semibold text-amber-700">
                  過去日付で足していない取引（{s.backdated.length}件・合計 {signed(s.backdatedNet)}）
                </summary>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground">
                      <tr><th className={th}>取引日</th><th className={th}>入力日時</th><th className={th}>棚卸日</th><th className={th}>種別</th><th className={th}>商品</th><th className={th}>数量</th><th className={th}>メモ</th></tr>
                    </thead>
                    <tbody>
                      {s.backdated.map((b, i) => (
                        <tr key={i} className="border-t">
                          <td className={`${td} whitespace-nowrap`}>{b.date}</td>
                          <td className={`${td} text-xs text-muted-foreground`}>{jst(b.enteredAt)}</td>
                          <td className={`${td} whitespace-nowrap`}>{b.stocktakeDay}</td>
                          <td className={`${td} whitespace-nowrap`}><TxTypeBadge type={b.type} /></td>
                          <td className={`${td} min-w-40`}><Link className="underline decoration-dotted" href={`/inventory/breakdown?store=${s.storeId}&product=${b.productId}`}>{b.productName}</Link></td>
                          <td className={`${td} tabular-nums`}>{signed(b.signed)}</td>
                          <td className={`${td} text-xs text-muted-foreground`}>{b.memo ?? ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
