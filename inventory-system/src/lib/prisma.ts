import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * DATABASE_URL に余計な文字（引用符、`export DATABASE_URL=` などの接頭辞、
 * 前後の空白・改行）が混入していても動作するよう、postgresql:// で始まる
 * 接続URLを抽出する。環境変数の貼り付けミスを吸収する保険（report-system と同方式）。
 */
function cleanDatabaseUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;
  const match = raw.match(/postgres(?:ql)?:\/\/[^\s'"`]+/i);
  if (match) return match[0];
  return raw.trim().replace(/^['"`]+/, "").replace(/['"`]+$/, "").trim();
}

const databaseUrl = cleanDatabaseUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(databaseUrl ? { datasources: { db: { url: databaseUrl } } } : {}),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
