import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  DEFAULT_ADMIN_LOGIN_ID,
  DEFAULT_ADMIN_NAME,
  DEFAULT_ADMIN_PASSWORD,
  SETTING_ALLOW_STORE_EDIT,
  STORES,
  storeLoginId,
} from "./constants";
import { DEFAULT_TEMPLATES } from "./default-templates";

/**
 * 初期データ投入。
 *  - 店舗マスタ（旧アプリ config.js の STORES）
 *  - 本部アカウント honbu
 *  - 各店舗の店舗アカウント store<PIN>（初期パスワードは PIN）
 *  - 初期テンプレート（テンプレートが1件も無いときだけ）
 * 既にあるものは変更しない（何度実行しても安全）。
 */
export async function seedDatabase(
  prisma: PrismaClient
): Promise<{ stores: number; storeUsers: number; admin: boolean; templates: number }> {
  let stores = 0;
  let storeUsers = 0;
  let order = 0;

  for (const s of STORES) {
    order += 1;
    let store = await prisma.store.findUnique({ where: { name: s.store } });
    if (!store) {
      store = await prisma.store.create({
        data: { name: s.store, department: s.dept, pinCode: s.pin, isActive: true, sortOrder: order },
      });
      stores += 1;
    }
    const loginId = storeLoginId(s.pin);
    const exists = await prisma.user.findUnique({ where: { loginId } });
    if (!exists) {
      await prisma.user.create({
        data: {
          loginId,
          passwordHash: await bcrypt.hash(s.pin, 10),
          name: s.store,
          role: "STAFF",
          storeId: store.id,
        },
      });
      storeUsers += 1;
    }
  }

  let adminCreated = false;
  const adminExists = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!adminExists) {
    await prisma.user.create({
      data: {
        loginId: DEFAULT_ADMIN_LOGIN_ID,
        passwordHash: await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10),
        name: DEFAULT_ADMIN_NAME,
        role: "ADMIN",
        storeId: null,
      },
    });
    adminCreated = true;
  }

  let templates = 0;
  const templateCount = await prisma.template.count();
  if (templateCount === 0) {
    let i = 0;
    for (const t of DEFAULT_TEMPLATES()) {
      i += 1;
      await prisma.template.create({
        data: {
          name: t.name,
          category: t.category,
          departments: t.departments,
          bodyText: t.bodyText,
          fields: t.fields,
          checks: t.checks,
          plans: t.plans,
          terms: t.terms,
          sortOrder: i,
        },
      });
      templates += 1;
    }
  }

  const setting = await prisma.setting.findUnique({ where: { key: SETTING_ALLOW_STORE_EDIT } });
  if (!setting) {
    await prisma.setting.create({ data: { key: SETTING_ALLOW_STORE_EDIT, value: "0" } });
  }

  return { stores, storeUsers, admin: adminCreated, templates };
}
