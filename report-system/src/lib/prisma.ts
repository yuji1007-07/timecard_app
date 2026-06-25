import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * DATABASE_URL に余計な文字（引用符、`export DATABASE_URL=` などの接頭辞、
 * 前後の空白・改行）が混入していても動作するように、文字列中から
 * postgresql:// または postgres:// で始まる接続URLを抽出する。
 * 環境変数の貼り付けミスを吸収するための保険。
 */
function cleanDatabaseUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;
  // 値の中から実際のURL部分（空白・引用符が現れる手前まで）を抜き出す
  const match = raw.match(/postgres(?:ql)?:\/\/[^\s'"`]+/i);
  if (match) return match[0];
  // 見つからなければ、引用符・空白だけ取り除いて返す
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
