"use server";

import { requireAreaManager } from "@/lib/session";
import { notifyNotStocktaken, notifyLowStock } from "@/lib/notify";
import { syncSnapshot } from "@/lib/sync";

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export async function notifyNotStocktakenAction(): Promise<string> {
  await requireAreaManager();
  const r = await notifyNotStocktaken(currentMonth());
  if (r.stores.length === 0) return "未実施店舗はありません。";
  if (r.sent > 0) return `未実施 ${r.stores.length}店舗を本部へ通知しました（送信${r.sent}件）。`;
  return `未実施店舗: ${r.stores.join("、")}｜送信はスキップ（${r.messages[0] ?? "LINE未設定"}）`;
}

export async function notifyLowStockAction(): Promise<string> {
  await requireAreaManager();
  const r = await notifyLowStock();
  if (r.stores.length === 0) return r.messages[0] ?? "在庫不足の店舗はありません。";
  if (r.sent > 0) return `在庫不足 ${r.stores.length}店舗を本部へ通知しました（送信${r.sent}件）。`;
  return `在庫不足店舗: ${r.stores.join("、")}｜送信はスキップ（${r.messages[0] ?? "LINE未設定"}）`;
}

export async function syncSnapshotAction(): Promise<string> {
  await requireAreaManager();
  const r = await syncSnapshot();
  return r.count > 0
    ? `在庫スナップショット ${r.count}行をスプレッドシートへ出力しました（同期OFF時は未送信）。`
    : "出力対象の在庫がありませんでした。";
}
