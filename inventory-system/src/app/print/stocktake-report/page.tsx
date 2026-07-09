import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser, canAccessStore } from "@/lib/session";
import { yen } from "@/lib/constants";
import { PrintToolbar } from "../print-toolbar";

export const dynamic = "force-dynamic";

function fmtDate(d: Date): string {
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

export default async function StocktakeReportPage({
  searchParams,
}: {
  searchParams: Promise<{ store?: string; month?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const storeId = sp.store ?? "";
  const month = sp.month ?? "";

  if (!storeId || !month) notFound();
  if (!canAccessStore(user, storeId)) redirect("/stocktake");

  const [store, st] = await Promise.all([
    prisma.store.findUnique({ where: { id: storeId } }),
    prisma.stocktake.findUnique({
      where: { storeId_targetMonth: { storeId, targetMonth: month } },
      include: { items: { include: { product: { include: { brand: true } } } } },
    }),
  ]);
  if (!store) notFound();

  if (!st) {
    return (
      <div className="mx-auto max-w-2xl p-8">
        <PrintToolbar title="棚卸報告書" />
        <p className="text-sm text-gray-600">{month} の棚卸データが見つかりません。棚卸を確定してから出力してください。</p>
      </div>
    );
  }

  const hasDiff = st.diffCount > 0;
  const diffItems = st.items
    .filter((it) => it.diff !== 0)
    .sort((a, b) => Math.abs(b.diffAmount) - Math.abs(a.diffAmount));
  const now = new Date();

  return (
    <div className="p-4 md:p-8">
      <PrintToolbar title={`棚卸報告書｜${store.name}｜${month}`} />

      <div className="a4-report bg-white text-[13px] text-gray-900">
        {/* ヘッダー */}
        <div className="mb-6 flex items-start justify-between border-b-2 border-navy pb-3">
          <div>
            <h1 className="text-2xl font-bold tracking-wide">棚卸報告書</h1>
            <p className="mt-1 text-xs text-gray-500">まごころ在庫 — 販売品在庫管理</p>
          </div>
          <div className="text-right text-xs text-gray-600">
            <div>出力日：{fmtDate(now)}</div>
            <div className="mt-0.5">対象月：{month}</div>
          </div>
        </div>

        {/* 基本情報 */}
        <table className="mb-5 w-full border-collapse text-[13px]">
          <tbody>
            <tr>
              <th className="w-28 border border-gray-300 bg-gray-50 px-3 py-2 text-left font-medium">店舗名</th>
              <td className="border border-gray-300 px-3 py-2 font-semibold">{store.name}</td>
              <th className="w-28 border border-gray-300 bg-gray-50 px-3 py-2 text-left font-medium">棚卸担当者</th>
              <td className="border border-gray-300 px-3 py-2">{st.assigneeName ?? "-"}</td>
            </tr>
            <tr>
              <th className="border border-gray-300 bg-gray-50 px-3 py-2 text-left font-medium">対象月</th>
              <td className="border border-gray-300 px-3 py-2">{month}</td>
              <th className="border border-gray-300 bg-gray-50 px-3 py-2 text-left font-medium">棚卸確定日</th>
              <td className="border border-gray-300 px-3 py-2">{fmtDate(new Date(st.confirmedAt))}</td>
            </tr>
          </tbody>
        </table>

        {/* 結果バナー */}
        <div
          className={`mb-5 rounded-lg border-2 px-5 py-4 text-center ${
            hasDiff ? "border-red-400 bg-red-50" : "border-green-500 bg-green-50"
          }`}
        >
          <div className={`text-xl font-bold ${hasDiff ? "text-red-700" : "text-green-700"}`}>
            {hasDiff ? "差異あり" : "差異なし（棚卸完了）"}
          </div>
          <div className="mt-1 text-sm text-gray-700">
            {hasDiff
              ? `理論在庫と実在庫に差異が ${st.diffCount} 件ありました。`
              : "すべての商品で理論在庫と実在庫が一致しました。"}
          </div>
        </div>

        {/* サマリー */}
        <div className="mb-5 grid grid-cols-3 gap-3">
          <div className="rounded-md border border-gray-300 px-3 py-2 text-center">
            <div className="text-xs text-gray-500">棚卸商品数</div>
            <div className="text-lg font-bold tabular-nums">{st.items.length}</div>
          </div>
          <div className="rounded-md border border-gray-300 px-3 py-2 text-center">
            <div className="text-xs text-gray-500">差異件数</div>
            <div className={`text-lg font-bold tabular-nums ${hasDiff ? "text-red-600" : "text-green-600"}`}>
              {st.diffCount}
            </div>
          </div>
          <div className="rounded-md border border-gray-300 px-3 py-2 text-center">
            <div className="text-xs text-gray-500">差異金額</div>
            <div className={`text-lg font-bold tabular-nums ${st.diffAmount !== 0 ? "text-red-600" : ""}`}>
              {yen(st.diffAmount)}
            </div>
          </div>
        </div>

        {/* 差異明細（差異がある場合のみ） */}
        {hasDiff ? (
          <div className="mb-6">
            <h2 className="mb-2 text-sm font-bold">差異の内訳</h2>
            <table className="print-table">
              <thead>
                <tr>
                  <th>ブランド</th>
                  <th>商品名</th>
                  <th style={{ textAlign: "right" }}>理論在庫</th>
                  <th style={{ textAlign: "right" }}>実在庫</th>
                  <th style={{ textAlign: "right" }}>差異</th>
                  <th style={{ textAlign: "right" }}>差異金額</th>
                </tr>
              </thead>
              <tbody>
                {diffItems.map((it) => (
                  <tr key={it.id}>
                    <td>{it.product.brand.name}</td>
                    <td>{it.product.name}{it.product.size ? `（${it.product.size}）` : ""}</td>
                    <td style={{ textAlign: "right" }}>{it.theoreticalQty}</td>
                    <td style={{ textAlign: "right" }}>{it.actualQty}</td>
                    <td style={{ textAlign: "right", color: it.diff > 0 ? "#16a34a" : "#dc2626", fontWeight: 600 }}>
                      {it.diff > 0 ? `+${it.diff}` : it.diff}
                    </td>
                    <td style={{ textAlign: "right" }}>{yen(it.diffAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-gray-500">
              ※ 差異＝実在庫 − 理論在庫。プラスは在庫が多い、マイナスは在庫が少ないことを表します。
            </p>
          </div>
        ) : (
          <div className="mb-6 rounded-md border border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-600">
            差異のある商品はありませんでした。
          </div>
        )}

        {/* 確認欄 */}
        <div className="mt-8 grid grid-cols-2 gap-6">
          <div>
            <div className="mb-1 text-xs text-gray-500">店舗責任者</div>
            <div className="h-12 rounded-md border border-gray-300"></div>
          </div>
          <div>
            <div className="mb-1 text-xs text-gray-500">本部確認</div>
            <div className="h-12 rounded-md border border-gray-300"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
