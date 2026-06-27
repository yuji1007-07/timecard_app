"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, canAccessStore, realUserId } from "@/lib/session";
import { getStoreInventory } from "@/lib/inventory";
import { getSetting } from "@/lib/settings";
import { syncStocktake } from "@/lib/sync";
import { notifyStockDiff } from "@/lib/notify";

/**
 * 棚卸を確定する。
 * - 確定時点の理論在庫を再計算
 * - 実在庫（フォーム入力）との差をズレとして記録
 * - ズレ金額は設定の算出基準（卸/通常・税込）で計算
 * - 確定後、その実数が以降の在庫ベースラインになる（computeStock がこれを参照）
 */
export async function confirmStocktake(
  _prev: { ok: boolean; message: string } | undefined,
  formData: FormData
): Promise<{ ok: boolean; message: string }> {
  const user = await requireUser();
  const storeId = String(formData.get("storeId"));
  const month = String(formData.get("month"));
  if (!storeId || !month) return { ok: false, message: "店舗・対象月が不正です。" };
  if (!canAccessStore(user, storeId)) return { ok: false, message: "この店舗の棚卸権限がありません。" };

  const basis = (await getSetting("diffBasis")) ?? "WHOLESALE";
  const inv = await getStoreInventory(storeId);
  const invMap = new Map(inv.map((r) => [r.productId, r]));

  const assigneeName = String(formData.get("assigneeName") ?? "") || user.name || "棚卸担当";

  let diffCount = 0;
  let diffAmount = 0;
  const itemData: {
    productId: string;
    theoreticalQty: number;
    actualQty: number;
    diff: number;
    diffAmount: number;
  }[] = [];

  for (const r of inv) {
    const raw = formData.get(`actual_${r.productId}`);
    if (raw == null || raw === "") continue; // 未入力はスキップ
    const actual = Math.max(0, Math.round(Number(raw)));
    const theoretical = r.stock;
    const diff = actual - theoretical;
    const unit = basis === "NORMAL" ? r.normalIncl : r.wholesaleIncl;
    const amount = diff * unit;
    if (diff !== 0) {
      diffCount++;
      diffAmount += amount;
    }
    itemData.push({ productId: r.productId, theoreticalQty: theoretical, actualQty: actual, diff, diffAmount: amount });
  }

  if (itemData.length === 0) return { ok: false, message: "実在庫が1件も入力されていません。" };

  // 既存の同月棚卸があれば作り直す
  const existing = await prisma.stocktake.findUnique({ where: { storeId_targetMonth: { storeId, targetMonth: month } } });
  if (existing) {
    await prisma.stocktakeItem.deleteMany({ where: { stocktakeId: existing.id } });
    await prisma.stocktake.delete({ where: { id: existing.id } });
  }

  const st = await prisma.stocktake.create({
    data: {
      storeId,
      targetMonth: month,
      assigneeId: realUserId(user),
      assigneeName,
      diffCount,
      diffAmount,
      items: { create: itemData },
    },
  });

  // 連携・通知（未設定/OFFならドライランで何もしない）
  await syncStocktake(st.id);
  const notify = await notifyStockDiff(storeId).catch(() => null);

  revalidatePath("/stocktake");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");

  const note = notify && notify.sent > 0 ? `（本部へLINE通知 ${notify.sent}件）` : "";
  return {
    ok: true,
    message: `棚卸を確定しました。ズレ ${diffCount}件 / ${Math.round(diffAmount).toLocaleString("ja-JP")}円 ${note}`,
  };
}
