import { prisma } from "@/lib/prisma";
import type { KpiItem, KdiItem } from "@prisma/client";

/**
 * 有効なKPIテンプレートを解決する。
 * 上書き優先順位: 部門 > 店舗 > 業態。
 * 指定スコープにKPIが1件でもあれば、そのスコープを採用（=上書き）。
 */
export async function getEffectiveKpiItems(params: {
  storeId: string;
  departmentId?: string | null;
}): Promise<KpiItem[]> {
  const { storeId, departmentId } = params;

  if (departmentId) {
    const deptItems = await prisma.kpiItem.findMany({
      where: { departmentId },
      orderBy: { sortOrder: "asc" },
    });
    if (deptItems.length > 0) return deptItems;

    const dept = await prisma.department.findUnique({ where: { id: departmentId } });
    // 部門上書きが無ければ部門の業態テンプレートにフォールバック
    if (dept) return businessTypeKpis(dept.businessType);
    return [];
  }

  const storeItems = await prisma.kpiItem.findMany({
    where: { storeId },
    orderBy: { sortOrder: "asc" },
  });
  if (storeItems.length > 0) return storeItems;

  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (store) return businessTypeKpis(store.businessType);
  return [];
}

async function businessTypeKpis(businessType: string): Promise<KpiItem[]> {
  return prisma.kpiItem.findMany({
    where: { businessType, storeId: null, departmentId: null },
    orderBy: { sortOrder: "asc" },
  });
}

/**
 * 有効なKDIテンプレートを解決する。部門 > 店舗 > 業態。
 */
export async function getEffectiveKdiItems(params: {
  storeId: string;
  departmentId?: string | null;
}): Promise<KdiItem[]> {
  const { storeId, departmentId } = params;

  if (departmentId) {
    const deptItems = await prisma.kdiItem.findMany({
      where: { departmentId },
      orderBy: { sortOrder: "asc" },
    });
    if (deptItems.length > 0) return deptItems;
    const dept = await prisma.department.findUnique({ where: { id: departmentId } });
    if (dept) return businessTypeKdis(dept.businessType);
    return [];
  }

  const storeItems = await prisma.kdiItem.findMany({
    where: { storeId },
    orderBy: { sortOrder: "asc" },
  });
  if (storeItems.length > 0) return storeItems;

  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (store) return businessTypeKdis(store.businessType);
  return [];
}

async function businessTypeKdis(businessType: string): Promise<KdiItem[]> {
  return prisma.kdiItem.findMany({
    where: { businessType, storeId: null, departmentId: null },
    orderBy: { sortOrder: "asc" },
  });
}
