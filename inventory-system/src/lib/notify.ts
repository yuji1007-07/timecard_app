import { prisma } from "@/lib/prisma";
import { pushLineMessage, LINE_TEMPLATES } from "@/lib/integrations/line";
import { getSetting } from "@/lib/settings";
import { getStoreInventory } from "@/lib/inventory";

/** 本部（エリアマネージャー）でLINE ID登録済みの送信先を取得 */
async function areaManagerTargets(): Promise<string[]> {
  const ms = await prisma.user.findMany({
    where: { role: "AREA_MANAGER", lineUserId: { not: null } },
    select: { lineUserId: true },
  });
  return ms.map((m) => m.lineUserId!).filter(Boolean);
}

export type NotifyResult = { sent: number; skipped: number; messages: string[] };

async function pushToAll(text: string): Promise<NotifyResult> {
  const targets = await areaManagerTargets();
  const res: NotifyResult = { sent: 0, skipped: 0, messages: [] };
  if (targets.length === 0) {
    res.messages.push("送信先(本部のLINE ID)が未登録です。");
    return res;
  }
  for (const to of targets) {
    const r = await pushLineMessage(to, text);
    if (r.ok) res.sent++;
    else {
      res.skipped++;
      res.messages.push(r.message);
    }
  }
  return res;
}

/** 棚卸確定時の在庫ズレ通知（閾値を超えたときだけ送信） */
export async function notifyStockDiff(storeId: string): Promise<NotifyResult | null> {
  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store) return null;
  const st = await prisma.stocktake.findFirst({
    where: { storeId },
    orderBy: { confirmedAt: "desc" },
  });
  if (!st) return null;

  const thresholdCount = Number((await getSetting("diffThresholdCount")) ?? "1");
  const thresholdAmount = Number((await getSetting("diffThresholdAmount")) ?? "0");

  const overCount = st.diffCount >= thresholdCount && thresholdCount > 0;
  const overAmount = Math.abs(st.diffAmount) >= thresholdAmount && thresholdAmount > 0;
  // 件数閾値 or 金額閾値のどちらか超過で通知（金額閾値0なら件数のみで判定）
  if (!overCount && !overAmount) return { sent: 0, skipped: 0, messages: ["閾値未満のため通知しません。"] };

  return pushToAll(LINE_TEMPLATES.stockDiff(store.name, st.diffCount, st.diffAmount));
}

/** 棚卸未実施アラート（指定月に確定棚卸が無い店舗を本部へ通知） */
export async function notifyNotStocktaken(month: string): Promise<NotifyResult & { stores: string[] }> {
  const stores = await prisma.store.findMany({ where: { isHeadquarters: false, status: "ACTIVE" }, orderBy: { sortOrder: "asc" } });
  const done = await prisma.stocktake.findMany({ where: { targetMonth: month }, select: { storeId: true } });
  const doneSet = new Set(done.map((d) => d.storeId));
  const notDone = stores.filter((s) => !doneSet.has(s.id));

  let agg: NotifyResult = { sent: 0, skipped: 0, messages: [] };
  for (const s of notDone) {
    const r = await pushToAll(LINE_TEMPLATES.notStocktaken(s.name, month));
    agg = { sent: agg.sent + r.sent, skipped: agg.skipped + r.skipped, messages: [...agg.messages, ...r.messages] };
  }
  return { ...agg, stores: notDone.map((s) => s.name) };
}

/** 在庫不足アラート（ON時のみ。最小在庫割れ商品がある店舗を本部へ通知） */
export async function notifyLowStock(): Promise<NotifyResult & { stores: string[] }> {
  const enabled = (await getSetting("lowStockAlertEnabled")) === "true";
  if (!enabled) return { sent: 0, skipped: 0, messages: ["在庫不足アラートがOFFです。"], stores: [] };

  const stores = await prisma.store.findMany({ where: { isHeadquarters: false, status: "ACTIVE" }, orderBy: { sortOrder: "asc" } });
  let agg: NotifyResult = { sent: 0, skipped: 0, messages: [] };
  const flagged: string[] = [];
  for (const s of stores) {
    const inv = await getStoreInventory(s.id);
    const low = inv.filter((r) => r.low).length;
    if (low > 0) {
      flagged.push(s.name);
      const r = await pushToAll(LINE_TEMPLATES.lowStock(s.name, low));
      agg = { sent: agg.sent + r.sent, skipped: agg.skipped + r.skipped, messages: [...agg.messages, ...r.messages] };
    }
  }
  return { ...agg, stores: flagged };
}
