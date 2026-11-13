"use server";

import { z } from "zod";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireUser, canAccessStore, realUserId } from "@/lib/session";
import { exclFromIncl } from "@/lib/pricing";
import { syncTransaction } from "@/lib/sync";

const schema = z.object({
  type: z.enum(["ORDER", "CONSUME", "EMPLOYEE_SALE", "GIFT", "TRANSFER"]),
  storeId: z.string().min(1),
  productId: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
  date: z.string().optional(),
  unitPriceIncl: z.coerce.number().optional(),
  supplier: z.string().optional(),
  counterpart: z.string().optional(),
  reason: z.string().optional(),
  assignee: z.string().optional(),
  memo: z.string().optional(),
  toStoreId: z.string().optional(),
});

export type TxFormState = { success?: boolean; message?: string; error?: string } | null;

const TYPE_LABEL: Record<string, string> = {
  ORDER: "発注（入荷）",
  CONSUME: "消耗（販売）",
  TRANSFER: "店舗間移動",
  EMPLOYEE_SALE: "社販",
  GIFT: "プレゼント",
};

/** Prisma の一意制約違反（同じ requestId がすでにある）か */
function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";
}

/**
 * 取引を記録する。
 * 画面の更新はクライアント側で行う（ここで revalidatePath は呼ばない。CLAUDE.md §4）。
 * requestId が同じ送信は1回しか記録しない（押し直し・通信のやり直しによる二重登録の防止）。
 */
export async function createTransaction(_prev: TxFormState, formData: FormData): Promise<TxFormState> {
  const user = await requireUser();
  const parsed = schema.safeParse({
    type: formData.get("type"),
    storeId: formData.get("storeId"),
    productId: formData.get("productId"),
    quantity: formData.get("quantity"),
    date: formData.get("date") || undefined,
    unitPriceIncl: formData.get("unitPriceIncl") || undefined,
    supplier: formData.get("supplier") || undefined,
    counterpart: formData.get("counterpart") || undefined,
    reason: formData.get("reason") || undefined,
    assignee: formData.get("assignee") || undefined,
    memo: formData.get("memo") || undefined,
    toStoreId: formData.get("toStoreId") || undefined,
  });
  if (!parsed.success) return { error: "入力内容を確認してください。" };
  const d = parsed.data;

  if (!canAccessStore(user, d.storeId)) return { error: "この店舗への記録権限がありません。" };

  const product = await prisma.product.findUnique({ where: { id: d.productId } });
  if (!product) return { error: "商品が見つかりません。" };

  const done = `${TYPE_LABEL[d.type] ?? d.type}：${product.name}${product.size ? `（${product.size}）` : ""} × ${d.quantity}${product.unit}`;
  const ridRaw = String(formData.get("requestId") ?? "");
  const requestId = /^[A-Za-z0-9-]{8,64}$/.test(ridRaw) ? ridRaw : null;
  if (requestId) {
    const dup = await prisma.transaction.findUnique({ where: { requestId }, select: { id: true } });
    if (dup) return { success: true, message: `${done} は記録済みです（同じ送信を二重に登録しないようにしました）。` };
  }

  const date = d.date ? new Date(d.date) : new Date();
  const incl = d.unitPriceIncl ?? null;
  const excl = incl != null && incl > 0 ? exclFromIncl(incl, product.taxRate) : null;
  const uid = realUserId(user);

  if (d.type === "TRANSFER") {
    if (!d.toStoreId) return { error: "移動先店舗を選択してください。" };
    if (d.toStoreId === d.storeId) return { error: "移動元と移動先が同じです。" };
    // スタッフは自店舗が移動元 or 移動先のもののみ
    if (user.role !== "AREA_MANAGER" && user.storeId !== d.storeId && user.storeId !== d.toStoreId) {
      return { error: "自店舗が関係する移動のみ記録できます。" };
    }
    const groupId = randomUUID();
    const base = { productId: d.productId, quantity: d.quantity, date, assignee: d.assignee, memo: d.memo, transferGroupId: groupId, toStoreId: d.toStoreId, userId: uid };
    try {
      await prisma.$transaction([
        prisma.transaction.create({ data: { ...base, storeId: d.storeId, type: "TRANSFER_OUT", requestId } }),
        prisma.transaction.create({
          data: { ...base, storeId: d.toStoreId, type: "TRANSFER_IN", requestId: requestId ? `${requestId}:in` : null },
        }),
      ]);
    } catch (e) {
      if (isUniqueViolation(e)) return { success: true, message: `${done} は記録済みです。` };
      throw e;
    }
    await syncTransaction(groupId);
  } else {
    let tx;
    try {
      tx = await prisma.transaction.create({
        data: {
          requestId,
          storeId: d.storeId,
          productId: d.productId,
          type: d.type,
          quantity: d.quantity,
          date,
          unitPriceIncl: incl,
          unitPriceExcl: excl,
          supplier: d.supplier,
          counterpart: d.counterpart,
          reason: d.reason,
          assignee: d.assignee,
          memo: d.memo,
          userId: uid,
        },
      });
    } catch (e) {
      if (isUniqueViolation(e)) return { success: true, message: `${done} は記録済みです。` };
      throw e;
    }
    await syncTransaction(tx.id);
  }

  return { success: true, message: `${done} を記録しました。` };
}

/** 取引取り消し（在庫は履歴積み上げなので、レコード削除で自動的に在庫が戻る）。 */
export async function cancelTransaction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id"));
  const tx = await prisma.transaction.findUnique({ where: { id } });
  if (!tx) return;
  if (!canAccessStore(user, tx.storeId)) return;

  if (tx.transferGroupId) {
    // 移動はペア両方を削除
    await prisma.transaction.deleteMany({ where: { transferGroupId: tx.transferGroupId } });
  } else {
    await prisma.transaction.delete({ where: { id } });
  }
}
