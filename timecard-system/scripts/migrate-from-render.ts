/**
 * 旧システム（Render 上の Flask 版勤怠アプリ）の PostgreSQL から、新システムへデータを移行する。
 *
 * 使い方:
 *   OLD_DATABASE_URL="postgresql://...(RenderのExternal Database URL)" npm run migrate:from-render
 *
 * ブラウザから実行したい場合は、Vercel に OLD_DATABASE_URL を設定して
 *   https://<アプリURL>/api/migrate?key=<AUTH_SECRET>
 * を開けば同じ処理が走る。
 */
import { PrismaClient } from "@prisma/client";
import { migrateFromRender } from "../src/lib/migrate-from-render";

const OLD_URL = process.env.OLD_DATABASE_URL;
if (!OLD_URL) {
  console.error("OLD_DATABASE_URL（旧 Render PostgreSQL の接続文字列）を設定してください。");
  process.exit(1);
}

const prisma = new PrismaClient();

migrateFromRender(prisma, OLD_URL, (m) => console.log(m))
  .then((r) => console.log("✅ 移行完了", r))
  .catch((e) => {
    console.error("❌ 移行に失敗しました:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
