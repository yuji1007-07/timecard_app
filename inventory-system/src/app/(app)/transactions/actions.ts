"use server";

import { z } from "zod";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
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

export async function createTransaction(
  _prev: string | undefined,
  formData: FormData
): Promise<string> {
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
  if (!parsed.success) return "入力内容を確認してください。";
  const d = parsed.data;

  if (!canAccessStore(user, d.storeId)) return "この店舗への記録権限がありません。";

  const product = await prisma.product.findUnique({ where: { id: d.productId } });
  if (!product) return "商品が見つかりません。";

  const date = d.date ? new Date(d.date) : new Date();
  const incl = d.unitPriceIncl ?? null;
  const excl = incl != null && incl > 0 ? exclFromIncl(incl, product.taxRate) : null;
  const uid = realUserId(user);

  if (d.type === "TRANSFER") {
    if (!d.toStoreId) return "移動先店舗を選択してください。";
    if (d.toStoreId === d.storeId) return "移動元と移動先が同じです。";
    // スタッフは自店舗が移動元 or 移動先のもののみ
    if (user.role !== "AREA_MANAGER" && user.storeId !== d.storeId && user.storeId !== d.toStoreId) {
      return "自店舗が関係する移動のみ記録できます。";
    }
    const groupId = randomUUID();
    const base = { productId: d.productId, quantity: d.quantity, date, assignee: d.assignee, memo: d.memo, transferGroupId: groupId, toStoreId: d.toStoreId, userId: uid };
    await prisma.$transaction([
      prisma.transaction.create({ data: { ...base, storeId: d.storeId, type: "TRANSFER_OUT" } }),
      prisma.transaction.create({ data: { ...base, storeId: d.toStoreId, type: "TRANSFER_IN" } }),
    ]);
    await syncTransaction(groupId);
  } else {
    const tx = await prisma.transaction.create({
      data: {
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
    await syncTransaction(tx.id);
  }

  revalidatePath("/transactions");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  return "OK";
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
  revalidatePath("/transactions");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
}
