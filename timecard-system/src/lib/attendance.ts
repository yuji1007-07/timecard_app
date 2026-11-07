import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/session";

/** 管理画面で選べる店舗一覧と、絞り込み条件（店舗ID配列 or null=全店舗）を返す */
export async function resolveStoreScope(user: CurrentUser, requestedStoreId: string | null | undefined) {
  const where = user.managedStoreIds === null ? { isActive: true } : { isActive: true, id: { in: user.managedStoreIds } };
  const stores = await prisma.store.findMany({ where, orderBy: [{ brand: "asc" }, { sortOrder: "asc" }, { name: "asc" }] });

  let selectedStoreId: string | null = null;
  let scopeIds: string[] | null = user.managedStoreIds;
  let warning: string | null = null;

  if (requestedStoreId) {
    if (user.managedStoreIds === null || user.managedStoreIds.includes(requestedStoreId)) {
      selectedStoreId = requestedStoreId;
      scopeIds = [requestedStoreId];
    } else {
      warning = "担当外の店舗は閲覧できません。";
    }
  }
  return { stores, selectedStoreId, scopeIds, warning };
}

/** 月(YYYY-MM)と店舗範囲で打刻一覧を取得 */
export async function queryAttendance(month: string, scopeIds: string[] | null) {
  if (scopeIds !== null && scopeIds.length === 0) return [];
  return prisma.attendance.findMany({
    where: {
      workDate: { startsWith: month },
      ...(scopeIds ? { storeId: { in: scopeIds } } : {}),
    },
    include: { user: { select: { id: true, name: true, loginId: true } }, store: { select: { id: true, name: true, brand: true } } },
    orderBy: [{ workDate: "desc" }, { store: { brand: "asc" } }, { store: { name: "asc" } }, { user: { name: "asc" } }],
  });
}

export type AttendanceRow = Awaited<ReturnType<typeof queryAttendance>>[number];

/** 店舗ごとの月次集計 */
export async function querySummary(month: string, scopeIds: string[] | null) {
  if (scopeIds !== null && scopeIds.length === 0) return [];
  const stores = await prisma.store.findMany({
    where: { isActive: true, ...(scopeIds ? { id: { in: scopeIds } } : {}) },
    orderBy: [{ brand: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });
  const grouped = await prisma.attendance.groupBy({
    by: ["storeId"],
    where: { workDate: { startsWith: month }, ...(scopeIds ? { storeId: { in: scopeIds } } : {}) },
    _sum: { workMinutes: true },
    _count: { _all: true },
  });
  const staffCounts = await prisma.attendance.findMany({
    where: { workDate: { startsWith: month }, ...(scopeIds ? { storeId: { in: scopeIds } } : {}) },
    distinct: ["storeId", "userId"],
    select: { storeId: true, userId: true },
  });
  const staffByStore = new Map<string, number>();
  for (const s of staffCounts) staffByStore.set(s.storeId, (staffByStore.get(s.storeId) ?? 0) + 1);
  const byStore = new Map(grouped.map((g) => [g.storeId, g]));
  return stores.map((s) => ({
    id: s.id,
    name: s.name,
    brand: s.brand,
    staffCount: staffByStore.get(s.id) ?? 0,
    recordCount: byStore.get(s.id)?._count._all ?? 0,
    totalMinutes: byStore.get(s.id)?._sum.workMinutes ?? 0,
  }));
}
