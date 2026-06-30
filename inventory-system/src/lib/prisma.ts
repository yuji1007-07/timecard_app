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

/**
 * Supabase のトランザクションプーラー(pgbouncer / port 6543)経由では、
 * Prisma の prepared statements が衝突して PrismaClientUnknownRequestError が
 * 断続的に発生する。これを避けるため、プーラー宛のURLには必ず
 * pgbouncer=true（prepared statements 無効化）と connection_limit=1 を付与する。
 * 環境変数にこれらが無くてもコード側で確実に補う保険。
 */
function ensurePoolerParams(url: string | undefined): string | undefined {
  if (!url) return url;
  try {
    const u = new URL(url);
    const isPooler = u.hostname.includes("pooler.supabase.com") || u.port === "6543";
    if (isPooler) {
      if (!u.searchParams.has("pgbouncer")) u.searchParams.set("pgbouncer", "true");
      if (!u.searchParams.has("connection_limit")) u.searchParams.set("connection_limit", "1");
    }
    return u.toString();
  } catch {
    return url;
  }
}

const databaseUrl = ensurePoolerParams(cleanDatabaseUrl());

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(databaseUrl ? { datasources: { db: { url: databaseUrl } } } : {}),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
