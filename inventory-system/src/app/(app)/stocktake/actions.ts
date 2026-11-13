"use server";

import { prisma } from "@/lib/prisma";
import { requireUser, canAccessStore, realUserId } from "@/lib/session";
import { getStoreInventory } from "@/lib/inventory";
import { getSetting } from "@/lib/settings";
import { syncStocktake } from "@/lib/sync";
import { notifyStockDiff } from "@/lib/notify";
import { jstDayKey, computeTheoreticalAt } from "@/lib/stock";

/**
 * 棚卸を確定する。
 * - 数量を入れた商品だけを記録する。空欄の商品には触らない
 *   （同じ月を確定し直しても、空欄にした商品の棚卸の数は残る）
 * - 理論在庫は「数えた時点」の値で出し、実在庫との差をズレとして記録
 * - ズレ金額は設定の算出基準（卸/通常・税込）で計算
 * - 記録した実数が、その商品の以降の在庫ベースラインになる
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

  const assigneeName = String(formData.get("assigneeName") ?? "") || user.name || "棚卸担当";

  // 棚卸日（実際に数えた日）。未指定なら今日（日本時間）。未来日は不可。
  const countedOnRaw = String(formData.get("countedOn") ?? "").trim();
  const todayJst = jstDayKey(new Date());
  const countedOnDay = countedOnRaw || todayJst;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(countedOnDay)) return { ok: false, message: "棚卸日の形式が不正です。" };
  if (countedOnDay > todayJst) return { ok: false, message: "棚卸日に未来の日付は指定できません。" };
  const countedOn = new Date(`${countedOnDay}T00:00:00.000Z`);

  const confirmedAt = new Date();
  const existing = await prisma.stocktake.findUnique({
    where: { storeId_targetMonth: { storeId, targetMonth: month } },
  });

  // 数えた時点の理論在庫（確定し直す場合は、この棚卸自身の明細は前の基準に使わない）
  const theoMap = await computeTheoreticalAt(storeId, { countedOn, confirmedAt }, existing?.id);

  const itemData: {
    productId: string;
    theoreticalQty: number;
    actualQty: number;
    diff: number;
    diffAmount: number;
    countedOn: Date;
    confirmedAt: Date;
  }[] = [];

  for (const r of inv) {
    const raw = formData.get(`actual_${r.productId}`);
    if (raw == null || raw === "") continue; // 空欄は記録しない（既存の数もそのまま）
    const actual = Math.max(0, Math.round(Number(raw)));
    const theoretical = theoMap.get(r.productId) ?? 0;
    const diff = actual - theoretical;
    const unit = basis === "NORMAL" ? r.normalIncl : r.wholesaleIncl;
    itemData.push({
      productId: r.productId,
      theoreticalQty: theoretical,
      actualQty: actual,
      diff,
      diffAmount: diff * unit,
      countedOn,
      confirmedAt,
    });
  }

  if (itemData.length === 0) return { ok: false, message: "実在庫が1件も入力されていません。" };

  const enteredIds = itemData.map((d) => d.productId);
  const assigneeId = realUserId(user);

  const st = await prisma.$transaction(
    async (tx) => {
      let stocktakeId: string;
      if (existing) {
        // 明細の日付が空の既存行は、棚卸全体の日付を書き換える前に今の日付を写しておく
        await tx.stocktakeItem.updateMany({
          where: { stocktakeId: existing.id, confirmedAt: null },
          data: { countedOn: existing.countedOn ?? existing.confirmedAt, confirmedAt: existing.confirmedAt },
        });
        // 今回数量を入れた商品だけ置き換える（空欄の商品の明細はそのまま）
        await tx.stocktakeItem.deleteMany({
          where: { stocktakeId: existing.id, productId: { in: enteredIds } },
        });
        await tx.stocktakeItem.createMany({
          data: itemData.map((d) => ({ ...d, stocktakeId: existing.id })),
        });
        await tx.stocktake.update({
          where: { id: existing.id },
          data: { countedOn, confirmedAt, assigneeId, assigneeName },
        });
        stocktakeId = existing.id;
      } else {
        const created = await tx.stocktake.create({
          data: {
            storeId,
            targetMonth: month,
            countedOn,
            confirmedAt,
            assigneeId,
            assigneeName,
            items: { createMany: { data: itemData } },
          },
        });
        stocktakeId = created.id;
      }

      // ズレ件数・金額はこの月の全明細から集計し直す
      const agg = await tx.stocktakeItem.aggregate({
        where: { stocktakeId, NOT: { diff: 0 } },
        _count: true,
        _sum: { diffAmount: true },
      });
      return tx.stocktake.update({
        where: { id: stocktakeId },
        data: { diffCount: agg._count, diffAmount: agg._sum.diffAmount ?? 0 },
      });
    },
    { timeout: 20000 }
  );

  // 連携・通知（未設定/OFFならドライランで何もしない）
  await syncStocktake(st.id, enteredIds);
  const notify = await notifyStockDiff(storeId).catch(() => null);


  const note = notify && notify.sent > 0 ? `（本部へLINE通知 ${notify.sent}件）` : "";
  return {
    ok: true,
    message: `棚卸を確定しました（今回入力 ${itemData.length}件）。この月のズレ ${st.diffCount}件 / ${Math.round(
      st.diffAmount
    ).toLocaleString("ja-JP")}円 ${note}`,
  };
}
