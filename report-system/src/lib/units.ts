import { prisma } from "@/lib/prisma";

/**
 * 「報告単位」= 通常店舗は店舗そのもの、複合店舗は各部門。
 * ダッシュボードの提出状況や要注意判定はこの単位で行う。
 */
export type ReportUnit = {
  key: string;
  storeId: string;
  storeName: string;
  departmentId: string | null;
  departmentName: string | null;
  businessType: string;
  label: string; // 表示名（例: 町田 エステ）
};

export async function getReportUnits(filter?: { storeId?: string }): Promise<ReportUnit[]> {
  const stores = await prisma.store.findMany({
    where: { status: { not: "CLOSED" }, ...(filter?.storeId ? { id: filter.storeId } : {}) },
    include: { departments: { orderBy: { sortOrder: "asc" } } },
    orderBy: { sortOrder: "asc" },
  });

  const units: ReportUnit[] = [];
  for (const store of stores) {
    if (store.businessType === "COMPLEX" && store.departments.length > 0) {
      for (const dept of store.departments) {
        units.push({
          key: `${store.id}:${dept.id}`,
          storeId: store.id,
          storeName: store.name,
          departmentId: dept.id,
          departmentName: dept.name,
          businessType: dept.businessType,
          label: `${store.name} ${dept.name}`,
        });
      }
    } else {
      units.push({
        key: store.id,
        storeId: store.id,
        storeName: store.name,
        departmentId: null,
        departmentName: null,
        businessType: store.businessType,
        label: store.name,
      });
    }
  }
  return units;
}
