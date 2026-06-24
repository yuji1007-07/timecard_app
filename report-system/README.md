# 週次/月次報告管理システム（整骨院・鍼灸・エステ対応）

各店舗責任者がWebにログインして週次/月次報告を提出し、エリアマネージャーが
KPI進捗・KDI実行状況・前回との差分・フィードバックを一元管理できるWebアプリです。

## 技術構成

- Next.js 15 (App Router) / TypeScript
- Tailwind CSS / shadcn/ui ベースのUIコンポーネント
- Prisma + SQLite（将来 PostgreSQL/Supabase へ移行しやすい構成）
- Auth.js (NextAuth v5) — メール/パスワード認証
- Recharts（KPI推移グラフ）／ Zod ／ React Hook Form 互換のフォーム
- OpenAI API / Google Sheets API / LINE Messaging API 連携（キー設定で有効化）

## セットアップ

```bash
cd report-system
npm install            # 依存をインストール（postinstall で prisma generate）
cp .env.example .env   # 必要に応じて値を編集
npm run db:reset       # SQLite作成 + ダミーデータ投入
npm run dev            # http://localhost:3000
```

> 補足: ネットワーク制限環境で `prisma generate` のエンジンDLが失敗する場合は、
> `binaries.prisma.sh` から該当エンジンを手動取得し `node_modules/@prisma/engines/` に配置するか、
> `PRISMA_QUERY_ENGINE_LIBRARY` / `PRISMA_SCHEMA_ENGINE_BINARY` を設定してください。

## デモアカウント（パスワード: `password123`）

| 役割 | メール | 権限 |
| --- | --- | --- |
| エリアマネージャー | admin@example.com | 全店舗・全機能 |
| 院長（溝の口本院） | honin@example.com | 自店舗のみ |
| 店長（町田・複合店舗） | machida@example.com | 自店舗のみ |
| 部門責任者（町田エステ） | machida-esthe@example.com | 自部門のみ |

## 初期データ

- 店舗: 溝の口本院 / 溝の口分院 / 駒沢大学駅院（整骨院）、エステ溝の口（エステ）、町田（複合店舗）
- 町田の部門: エステ / 鍼灸 / 整骨院
- 整骨院・エステ・鍼灸それぞれのKPI/KDI初期テンプレート
- 溝の口本院の週次報告（前週・今週）と前回Action進捗のサンプル

## 主な機能

1. メール/パスワード認証（エリアマネージャー / 院長・店舗責任者 / 部門責任者）
2. 権限別ダッシュボード（提出状況・KPIサマリー・要注意店舗・フィードバック待ち）
3. 店舗・部門管理＋店舗カルテ（複合店舗は部門別タブ／KPI推移グラフ）
4. KPI/KDIテンプレート管理（業態別・店舗別・部門別の上書き）
5. 週次/月次報告入力（テンプレ自動生成フォーム）
6. 前回KDI/Action進捗チェック（差分自動計算）
7. 前回指数との差分比較（良化方向に基づく判定）
8. KDI整合性チェック・KDIと結果の接続チェック
9. 要注意条件の自由設定（対象業態/KPI/条件/閾値/色/優先度/通知）
10. AIフィードバック生成（OpenAI、未設定時はテンプレ下書き）
11. Googleスプレッドシート連携 / LINE通知連携（設定画面 + キーで有効化）

## 外部連携

`設定画面（/settings）` で接続状態を確認できます。`.env` にキーを設定し、
各トグルをONにすると連携が有効になります。未設定でもアプリは動作し、連携はスキップされます。

| 連携 | 必要な環境変数 | 用途 |
| --- | --- | --- |
| OpenAI | `OPENAI_API_KEY` | AIフィードバック生成 |
| Google Sheets | `GOOGLE_SERVICE_ACCOUNT_EMAIL` / `GOOGLE_PRIVATE_KEY` / `GOOGLE_SHEETS_SPREADSHEET_ID` | 報告データ自動出力 |
| LINE | `LINE_CHANNEL_ACCESS_TOKEN` | 未提出・フィードバック・要注意通知 |

## 将来の拡張

- DB を PostgreSQL/Supabase に切替（`prisma/schema.prisma` の datasource を変更）
- Vercel / Google Cloud へのデプロイ
- LINE公式アカウント連携、Webhook受信
