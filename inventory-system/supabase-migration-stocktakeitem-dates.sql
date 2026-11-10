-- ============================================================
-- まごころ在庫: 棚卸の明細（商品ごと）に「棚卸日・確定日時」を追加
-- Supabase の SQL Editor で、デプロイ前に一度だけ実行してください。
-- 列を2つ追加し、既存の明細に今の棚卸の日付を写すだけです。
-- 数量や取引には一切触れません。他アプリにも影響しません。
-- ============================================================

ALTER TABLE "inventory"."StocktakeItem" ADD COLUMN IF NOT EXISTS "countedOn"   TIMESTAMP(3);
ALTER TABLE "inventory"."StocktakeItem" ADD COLUMN IF NOT EXISTS "confirmedAt" TIMESTAMP(3);

UPDATE "inventory"."StocktakeItem" i
   SET "countedOn"   = COALESCE(s."countedOn", s."confirmedAt"),
       "confirmedAt" = s."confirmedAt"
  FROM "inventory"."Stocktake" s
 WHERE i."stocktakeId" = s.id
   AND i."confirmedAt" IS NULL;
