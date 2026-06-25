import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * DATABASE_URL に誤って引用符（' や "）や前後の空白・改行が混入していても
 * 動作するように正規化する。Vercel等の環境変数貼り付けミスを吸収するための保険。
 */
function cleanDatabaseUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;
  const cleaned = raw
    .trim()
    .replace(/^['"`]+/, "") // 先頭の引用符を除去
    .replace(/['"`]+$/, "") // 末尾の引用符を除去
    .trim();
  return cleaned;
}

const databaseUrl = cleanDatabaseUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(databaseUrl ? { datasources: { db: { url: databaseUrl } } } : {}),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
