import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { ALL_STORES } from "./constants";
import { detectBrandAndStore, normalizeText } from "./stores";

export const DEFAULT_ADMIN_LOGIN_ID = "admin";
export const DEFAULT_ADMIN_PASSWORD = "admin1234";

/**
 * 初期データ投入（店舗マスタと admin アカウントのみ）。
 * 既にある店舗・ユーザーは変更しない（何度実行しても安全）。
 */
export async function seedDatabase(prisma: PrismaClient): Promise<{ stores: number; admin: boolean }> {
  let created = 0;
  let order = 0;
  for (const displayName of ALL_STORES) {
    order += 1;
    const name = normalizeText(displayName);
    const exists = await prisma.store.findUnique({ where: { name } });
    if (exists) continue;
    const { brand, shortName } = detectBrandAndStore(name);
    await prisma.store.create({ data: { name, brand, shortName, isActive: true, sortOrder: order } });
    created += 1;
  }

  let adminCreated = false;
  const admin = await prisma.user.findUnique({ where: { loginId: DEFAULT_ADMIN_LOGIN_ID } });
  if (!admin) {
    const firstStore = await prisma.store.findFirst({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });
    await prisma.user.create({
      data: {
        loginId: DEFAULT_ADMIN_LOGIN_ID,
        passwordHash: await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10),
        name: "全体管理者",
        role: "ADMIN",
        storeId: firstStore?.id ?? null,
      },
    });
    adminCreated = true;
  }
  return { stores: created, admin: adminCreated };
}
