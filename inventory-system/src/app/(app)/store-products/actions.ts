"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireProductManager, canAccessStore } from "@/lib/session";

/** 店舗ごとに商品を「オン（利用可）／オフ（非表示）」に切り替える。 */
export async function setProductEnabled(storeId: string, productId: string, enabled: boolean) {
  const user = await requireProductManager();
  if (!canAccessStore(user, storeId)) return;

  if (enabled) {
    // オン = 無効化レコードを削除（既定の利用可状態に戻す）
    await prisma.storeProductDisable.deleteMany({ where: { storeId, productId } });
  } else {
    // オフ = 無効化レコードを作成
    await prisma.storeProductDisable.upsert({
      where: { productId_storeId: { productId, storeId } },
      create: { productId, storeId },
      update: {},
    });
  }
  revalidatePath("/store-products");
  revalidatePath("/inventory");
}

/** この店舗の全商品をオンに戻す。 */
export async function enableAllForStore(formData: FormData) {
  const user = await requireProductManager();
  const storeId = String(formData.get("storeId") ?? "");
  if (!storeId || !canAccessStore(user, storeId)) return;
  await prisma.storeProductDisable.deleteMany({ where: { storeId } });
  revalidatePath("/store-products");
  revalidatePath("/inventory");
}
