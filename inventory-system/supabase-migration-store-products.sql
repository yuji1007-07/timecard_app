-- ============================================================
-- まごころ在庫: 店舗別「取扱オフ」機能の追加
-- Supabase の SQL Editor で、デプロイ前に一度だけ実行してください。
-- （既存データ・他アプリには一切影響しません。新しいテーブルを1つ足すだけです）
-- ============================================================

CREATE TABLE IF NOT EXISTS "inventory"."StoreProductDisable" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    CONSTRAINT "StoreProductDisable_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StoreProductDisable_productId_storeId_key"
    ON "inventory"."StoreProductDisable"("productId", "storeId");

CREATE INDEX IF NOT EXISTS "StoreProductDisable_storeId_idx"
    ON "inventory"."StoreProductDisable"("storeId");

ALTER TABLE "inventory"."StoreProductDisable"
    ADD CONSTRAINT "StoreProductDisable_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "inventory"."Product"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "inventory"."StoreProductDisable"
    ADD CONSTRAINT "StoreProductDisable_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "inventory"."Store"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
