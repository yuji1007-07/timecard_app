# 販売品在庫管理システム（整骨院・鍼灸・エステグループ向け）

各店舗で扱う販売商品（物販）の在庫を一元管理するWebアプリです。
発注・消耗（販売）・店舗間移動・社販・プレゼントをすべて取引履歴として記録し、
毎月末の棚卸で理論在庫と実在庫のズレを検出します。本部（エリアマネージャー）は
全店舗の在庫・棚卸状況・在庫ズレを横断的に確認でき、LINE・Googleスプレッドシート連携も備えます。

> 週次/月次報告管理システム（`../report-system`）と同じ技術構成・設計思想・デザイン方針で
> 作成しており、将来 Supabase + PostgreSQL + Vercel の同一基盤へ統合移行できます。

## 技術構成

- Next.js 15（App Router） / TypeScript / Tailwind CSS / shadcn/ui
- Prisma + PostgreSQL（Supabase / Neon。`report-system` と同一構成、Vercelへデプロイ可能）
- Auth.js (NextAuth v5) — メール＋パスワード／店舗PIN（軽量モード）
- Recharts / Zod / React Hook Form
- Google Sheets API / LINE Messaging API（認証情報を入れれば有効化、未設定でも動作）

## セットアップ（ローカル開発）

PostgreSQL（Supabase/Neon の開発用DB、またはローカルPostgres）の接続文字列を用意します。

```bash
cd inventory-system
cp .env.example .env          # DATABASE_URL / DIRECT_URL を設定
npm install
npx prisma db push            # スキーマをDBへ反映
npm run db:seed               # 21店舗・ブランド・商品・ダミー取引・棚卸を投入
npm run dev                   # http://localhost:3002
```

> 本番（Vercel）公開の手順は [DEPLOY.md](./DEPLOY.md) を参照してください。

### ログイン

| 区分 | 方法 | 例 |
|---|---|---|
| 本部（エリアマネージャー） | メール＋パスワード | `hq@example.com` / `password` |
| 店舗スタッフ | メール＋パスワード | `staff1@example.com` / `password`（青葉台駅前院） |
| 店舗スタッフ（軽量） | 店舗選択＋4桁PIN | 青葉台駅前院 = `1001` |

## 主な機能

- **在庫の店舗別完全分離**：在庫は取引履歴の積み上げ＋棚卸ベースラインで算出（直接書き換えしない）
- **税率（8%/10%）と税抜⇄税込の自動計算**：商品ごとに入力モード（税抜/税込/両方）を選択
- **6種類の取引**：発注・消耗・店舗間移動（OUT/INペア）・社販・プレゼント＋取り消し（在庫自動補正）
- **棚卸**：理論在庫を自動表示→実在庫入力→ズレ算出→確定（以降この実数が在庫基準に）
- **本部ダッシュボード**：棚卸状況・在庫ズレ・在庫不足・ブランド別/店舗別在庫金額・取引サマリー
- **店舗ダッシュボード**：在庫一覧（ブランド別アコーディオン）・在庫不足・棚卸ステータス・クイック入力
- **店舗カルテ**：基本情報・在庫・取引履歴・棚卸履歴・在庫ズレ推移グラフ
- **CSVインポート**：`ブランド名,商品名,通常価格(税抜),通常価格(税込),卸価格(税抜),卸価格(税込),税率,カテゴリ,単位`
- **PDFバックアップ**：印刷用ページ → ブラウザの印刷でPDF保存（店舗ごとに改ページ）

## テスト

核心ロジック（税抜⇄税込の自動計算、在庫＝棚卸ベースライン＋取引積み上げ、ズレ計算）を
依存フレームワークなしで検証します。

```bash
npm test   # scripts/test-logic.ts を実行
```

## 商品データの一括投入

`sample-products.csv` がインポート用テンプレートです（列構成は商品マスタ画面のCSVインポートと同じ）。
このファイルの中身を実際の商品リスト（200点超）に差し替え、商品マスタ画面の「CSVインポート」に貼り付けると
一括登録できます。価格は片方だけでも税率からもう片方を自動計算し、卸価格0はそのまま0で登録されます。

## 外部連携（設定画面で有効化）

- **LINE通知**：`.env` に `LINE_CHANNEL_ACCESS_TOKEN` を設定し、設定画面でON。
  本部ユーザーのLINE IDはユーザー管理で登録（Webhook `/api/line/webhook` で自分のIDを確認可能）。
  通知トリガー：棚卸未実施 / 在庫ズレ（閾値超過時）/ 在庫不足。
- **Googleスプレッドシート**：`.env` に `GOOGLE_SERVICE_ACCOUNT_JSON`（推奨）と
  `GOOGLE_SHEETS_SPREADSHEET_ID` を設定し、設定画面でON。
  出力：取引履歴 / 棚卸履歴 / 在庫スナップショット（縦持ち1商品1行）。

いずれも未設定・OFFのときはドライラン（送信せず）でアプリは正常動作します。

## 在庫計算の考え方（重要）

```
在庫数 = 最新の確定棚卸の実在庫(actualQty)
       + その棚卸の確定時刻(confirmedAt)より後に作成された取引の符号付き合計
（棚卸がまだ無ければ、全取引の符号付き合計）
```

符号: 発注=+ / 消耗・社販・プレゼント・移動(出庫)=− / 移動(入庫)=+。
棚卸を確定すると、その実数が新しいベースラインになります（`src/lib/stock.ts`）。

## 設定項目（本部）

棚卸締め日 / 棚卸未実施アラート送信時刻 / 在庫ズレ通知閾値（件数・金額）/
在庫不足アラートON-OFF / 税込→税抜の丸めルール（四捨五入・切り捨て・切り上げ）/
ズレ金額の算出基準（卸価格・通常価格）/ LINE・スプレッドシート連携。

## 本番デプロイ（Vercel + PostgreSQL）

[DEPLOY.md](./DEPLOY.md) に手順をまとめています。要点：

1. Supabase / Neon で PostgreSQL を作成（Pooled→`DATABASE_URL`、Direct→`DIRECT_URL`）
2. ローカルから本番DBへ `npx prisma db push`（必要なら `npm run db:seed`）
3. Vercel で Root Directory = `inventory-system`、上記DB接続情報と `AUTH_SECRET` 等を環境変数に設定してデプロイ

`report-system` と同一のDB構成（PostgreSQL）なので、将来は同一基盤・共通DBへ統合できます。
