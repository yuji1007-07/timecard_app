-- ============================================================
-- まごころ在庫: 在庫数が合わない不具合の修正に必要な列の追加
-- Supabase の SQL Editor で、デプロイ前に一度だけ実行してください。
-- （何度実行しても安全です。数量・取引・他アプリには触れません）
--
-- 1) 棚卸の明細（商品ごと）に「棚卸日・確定日時」を追加し、既存の明細に今の日付を写す
-- 2) 取引に「二重登録防止の番号」を追加
-- ============================================================

ALTER TABLE "inventory"."StocktakeItem" ADD COLUMN IF NOT EXISTS "countedOn"   TIMESTAMP(3);
ALTER TABLE "inventory"."StocktakeItem" ADD COLUMN IF NOT EXISTS "confirmedAt" TIMESTAMP(3);

UPDATE "inventory"."StocktakeItem" i
   SET "countedOn"   = COALESCE(s."countedOn", s."confirmedAt"),
       "confirmedAt" = s."confirmedAt"
  FROM "inventory"."Stocktake" s
 WHERE i."stocktakeId" = s.id
   AND i."confirmedAt" IS NULL;

ALTER TABLE "inventory"."Transaction" ADD COLUMN IF NOT EXISTS "requestId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Transaction_requestId_key"
    ON "inventory"."Transaction"("requestId");
