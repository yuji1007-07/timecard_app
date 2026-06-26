"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

/**
 * 店舗/部門ごとに「使わないKPI項目」を非表示にする。
 * 非表示リストは Store.hiddenKpis / Department.hiddenKpis に JSON配列で保存。
 * 報告者（店舗責任者・部門責任者）は自分の店舗/部門のみ、エリアマネージャーは全店舗を編集可能。
 */
export async function setUnitHiddenKpis({
  storeId,
  departmentId,
  hidden,
}: {
  storeId: string;
  departmentId: string | null;
  hidden: string[];
}) {
  const user = await requireUser();

  // 権限チェック: 管理者以外は自店舗/自部門のみ
  if (user.role !== "AREA_MANAGER") {
    if (user.storeId !== storeId) throw new Error("この店舗の設定は変更できません。");
    if (user.role === "DEPARTMENT_MANAGER" && user.departmentId !== departmentId) {
      throw new Error("この部門の設定は変更できません。");
    }
  }

  const json = JSON.stringify([...new Set(hidden.map((s) => s.trim()).filter(Boolean))]);

  if (departmentId) {
    await prisma.department.update({ where: { id: departmentId }, data: { hiddenKpis: json } });
  } else {
    await prisma.store.update({ where: { id: storeId }, data: { hiddenKpis: json } });
  }

  revalidatePath("/reports/new");
  return { ok: true };
}
