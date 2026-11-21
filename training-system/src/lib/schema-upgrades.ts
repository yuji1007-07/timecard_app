// 公開後に追加したテーブル・列を、既存の本番DBに足すための SQL。
// /api/setup を開くたびに実行される。必ず「何度実行しても安全」「既存データを消さない」形で書くこと
// （CREATE ... IF NOT EXISTS / 制約は存在チェックしてから追加）。

export const UPGRADE_SQL: { name: string; sql: string }[] = [
  {
    name: "VideoAssignment（動画の個人指定）",
    sql: `CREATE TABLE IF NOT EXISTS "training"."VideoAssignment" (
      "id" TEXT NOT NULL,
      "videoId" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "required" BOOLEAN NOT NULL DEFAULT false,
      "dueDate" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "VideoAssignment_pkey" PRIMARY KEY ("id")
    )`,
  },
  {
    name: "VideoAssignment の索引1",
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS "VideoAssignment_videoId_userId_key" ON "training"."VideoAssignment"("videoId", "userId")`,
  },
  {
    name: "VideoAssignment の索引2",
    sql: `CREATE INDEX IF NOT EXISTS "VideoAssignment_userId_idx" ON "training"."VideoAssignment"("userId")`,
  },
  {
    name: "VideoAssignment の外部キー（動画）",
    sql: `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'VideoAssignment_videoId_fkey') THEN
        ALTER TABLE "training"."VideoAssignment" ADD CONSTRAINT "VideoAssignment_videoId_fkey"
          FOREIGN KEY ("videoId") REFERENCES "training"."Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END $$`,
  },
  {
    name: "VideoAssignment の外部キー（スタッフ）",
    sql: `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'VideoAssignment_userId_fkey') THEN
        ALTER TABLE "training"."VideoAssignment" ADD CONSTRAINT "VideoAssignment_userId_fkey"
          FOREIGN KEY ("userId") REFERENCES "training"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END $$`,
  },
  {
    name: "Video.series（シリーズ分類）",
    sql: `ALTER TABLE "training"."Video" ADD COLUMN IF NOT EXISTS "series" TEXT NOT NULL DEFAULT ''`,
  },
  {
    name: "Reflection.impression（感想）",
    sql: `ALTER TABLE "training"."Reflection" ADD COLUMN IF NOT EXISTS "impression" TEXT NOT NULL DEFAULT ''`,
  },
  {
    name: "Reflection.selfRating の初期値",
    sql: `ALTER TABLE "training"."Reflection" ALTER COLUMN "selfRating" SET DEFAULT 0`,
  },
];

/**
 * 1回だけ実行するデータの手直し（依頼を受けて本番データをまとめて直すとき用）。
 * 実行済みの id は "training"."AppliedFix" に記録され、二度と実行されない。
 * 既存データを消す SQL は書かないこと。
 */
export const ONE_TIME_FIXES: { id: string; name: string; sql: string[] }[] = [
  {
    id: "2026-11-21-series-initial",
    name: "シリーズ未設定の動画を振り分け（問診のコツ・初診フィードバック → 問診、それ以外 → KPI）",
    sql: [
      `UPDATE "training"."Video" SET "series" = '問診' WHERE "series" = '' AND ("title" LIKE '問診%' OR "title" LIKE '初診フィードバック%')`,
      `UPDATE "training"."Video" SET "series" = 'KPI' WHERE "series" = ''`,
    ],
  },
];
