# デプロイ手順（Vercel + PostgreSQL）

`inventory-system` を本番公開するための手順です。DBは PostgreSQL（Supabase または Neon）を使います。
`report-system` と同じ構成なので、将来は同一基盤に統合できます。

## 1. PostgreSQL を用意する

### Supabase の場合
1. https://supabase.com でプロジェクトを作成
2. Project Settings → Database → Connection string から2種類を控える
   - **Transaction pooler**（ポート 6543, `?pgbouncer=true`）→ `DATABASE_URL` 用
   - **Direct connection**（ポート 5432）→ `DIRECT_URL` 用

### Neon の場合
1. https://neon.tech でプロジェクトを作成
2. **Pooled connection** → `DATABASE_URL`、**Direct connection** → `DIRECT_URL`

## 2. スキーマ投入と初期データ（ローカルから一度だけ）

手元で本番DBに対してスキーマ作成とシードを実行します（Direct connection を使うと安定）。

```bash
cd inventory-system
# 本番DBの接続文字列を一時的に使う
export DATABASE_URL="postgresql://...direct...:5432/postgres?sslmode=require"
export DIRECT_URL="$DATABASE_URL"

npm install
npx prisma db push     # テーブル作成
npm run db:seed        # 21店舗・ブランド・商品・ダミーデータ投入（本番で不要ならスキップ）
```

> 本番でダミーデータが不要な場合は `db:seed` を省略し、店舗・ブランド・商品は管理画面／CSVインポートで登録してください。

## 3. Vercel プロジェクトを作成

1. https://vercel.com で New Project → このリポジトリを import
2. **Root Directory** を `inventory-system` に設定（モノレポのため重要）
3. Framework Preset: Next.js（自動検出）
4. Environment Variables を設定：

| 変数 | 値 |
|---|---|
| `DATABASE_URL` | Pooled connection（Supabaseは 6543 / `?pgbouncer=true`） |
| `DIRECT_URL` | Direct connection（5432） |
| `AUTH_SECRET` | `openssl rand -base64 32` で生成 |
| `NEXTAUTH_SECRET` | `AUTH_SECRET` と同じ値 |
| `AUTH_TRUST_HOST` | `true` |
| （任意）`GOOGLE_SERVICE_ACCOUNT_JSON` / `GOOGLE_SHEETS_SPREADSHEET_ID` | Sheets連携を使う場合 |
| （任意）`LINE_CHANNEL_ACCESS_TOKEN` / `LINE_CHANNEL_SECRET` | LINE通知を使う場合 |

5. Deploy を実行

`build` スクリプトは `prisma generate && next build` なので、Vercel上でPrisma Clientが自動生成されます。

## 4. 動作確認

デプロイ完了後、発行されたURLにアクセスし、本部アカウント（シード投入時 `hq@example.com` / `password`）でログイン。
**本番では必ずパスワードを変更**してください（アカウント設定画面）。

## 補足

- ローカル開発も PostgreSQL を使います（`.env` の `DATABASE_URL`/`DIRECT_URL` にローカルor開発用DBを設定）。
- Vercelのサーバーレス環境ではファイルシステムが永続しないため、SQLiteは使えません。本番は必ずPostgreSQLを使用してください。
- スキーマ変更時は、ローカルから `npx prisma db push`（または `prisma migrate`）を本番DBに対して実行します。
