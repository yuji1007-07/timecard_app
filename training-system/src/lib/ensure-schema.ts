// 公開後に追加したテーブル・列（src/lib/schema-upgrades.ts）を、サーバーの起動後に1回だけ自動で反映する。
// これにより、デプロイのたびに /api/setup を開き直さなくても画面が落ちない。
// SQL はすべて「何度実行しても安全・データを消さない」ものだけ。

import { prisma } from "@/lib/prisma";
import { ONE_TIME_FIXES, UPGRADE_SQL } from "@/lib/schema-upgrades";

const g = globalThis as unknown as { trainingSchemaReady?: Promise<void> };

export function ensureSchema(): Promise<void> {
  if (!g.trainingSchemaReady) {
    g.trainingSchemaReady = (async () => {
      for (const u of UPGRADE_SQL) {
        try {
          await prisma.$executeRawUnsafe(u.sql);
        } catch (e) {
          // 初期セットアップ前（テーブルがまだ無い）などは /api/setup に任せる
          console.error(`[ensureSchema] ${u.name}: ${(e as Error).message}`);
        }
      }
      // 1回だけのデータ手直し。先に「実行済み」の印を入れられたサーバーだけが実行する（同時起動しても二重に走らない）
      try {
        await prisma.$executeRawUnsafe(
          `CREATE TABLE IF NOT EXISTS "training"."AppliedFix" ("id" TEXT NOT NULL PRIMARY KEY, "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`
        );
        for (const fix of ONE_TIME_FIXES) {
          const claimed = await prisma.$queryRawUnsafe<{ id: string }[]>(
            `INSERT INTO "training"."AppliedFix" ("id") VALUES ($1) ON CONFLICT ("id") DO NOTHING RETURNING "id"`,
            fix.id
          );
          if (claimed.length === 0) continue;
          for (const sql of fix.sql) await prisma.$executeRawUnsafe(sql);
          console.log(`[ensureSchema] 実行: ${fix.name}`);
        }
      } catch (e) {
        console.error(`[ensureSchema] データ手直し: ${(e as Error).message}`);
      }
    })();
  }
  return g.trainingSchemaReady;
}
