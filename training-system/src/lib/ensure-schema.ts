// 公開後に追加したテーブル・列（src/lib/schema-upgrades.ts）を、サーバーの起動後に1回だけ自動で反映する。
// これにより、デプロイのたびに /api/setup を開き直さなくても画面が落ちない。
// SQL はすべて「何度実行しても安全・データを消さない」ものだけ。

import { prisma } from "@/lib/prisma";
import { UPGRADE_SQL } from "@/lib/schema-upgrades";

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
    })();
  }
  return g.trainingSchemaReady;
}
