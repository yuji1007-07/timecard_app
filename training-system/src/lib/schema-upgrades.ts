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
];
