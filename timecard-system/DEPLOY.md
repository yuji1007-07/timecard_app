# 本番公開手順（Supabase + Vercel）と旧システムからの移行

所要時間の目安: 30〜40分。在庫管理システムと同じ Supabase プロジェクトを使い回せます（このアプリは `timecard` スキーマだけを使い、他のアプリのテーブルには触りません）。

---

## 1. Supabase（データベース）

1. https://supabase.com でプロジェクトを開く（在庫管理で使っているものでOK。新規なら Region は **Northeast Asia (Tokyo)**）
2. 「Connect」ボタン → **Connection string** を2種類コピー
   - **Transaction pooler**（ポート 6543）→ `DATABASE_URL` 用。末尾に `?pgbouncer=true` を付ける
   - **Session pooler / Direct**（ポート 5432）→ `DIRECT_URL` 用
3. パスワード部分 `[YOUR-PASSWORD]` をプロジェクト作成時のDBパスワードに置き換える

## 2. テーブル作成（自分のPCから1回だけ）

```bash
cd timecard-system
npm install
cp .env.example .env
# .env の DATABASE_URL / DIRECT_URL / AUTH_SECRET を本番の値にする
npm run prisma:push     # timecard スキーマとテーブルを作成
npm run db:seed         # 店舗マスタ24店舗 + admin を投入
```

`AUTH_SECRET` は `openssl rand -base64 32` などで作ったランダム文字列にしてください。

> PCで作業できない場合: 先に Vercel へデプロイしてから `https://<アプリURL>/api/setup?key=<AUTH_SECRET>` を1回開くと、テーブル作成と初期データ投入をブラウザから実行できます（データは消しません）。

## 3. 旧システム（Render）からデータを移す

スタッフ・店舗・担当店舗・過去の打刻をすべてコピーします。**スタッフのID・パスワードはそのまま使えます。**

### ブラウザだけで行う方法（おすすめ）

1. Render ダッシュボード → 旧アプリの PostgreSQL → 「External Database URL」をコピー
2. Vercel → このプロジェクト → Settings → Environment Variables に `OLD_DATABASE_URL` としてその文字列を追加 → Redeploy
3. `https://<アプリURL>/api/migrate?key=<AUTH_SECRET>` を開く → `"ok":true` と件数が出れば完了
4. 終わったら `OLD_DATABASE_URL` は削除してよい

### ターミナルで行う方法

1. Render ダッシュボード → 旧アプリの PostgreSQL → 「External Database URL」をコピー
2. 自分のPCで実行:

```bash
cd timecard-system
OLD_DATABASE_URL="postgresql://...(Renderの接続文字列)..." npm run migrate:from-render
```

3. `✅ 移行完了` と件数が表示されれば完了。何度実行しても二重登録にはなりません。

## 4. Vercel（アプリ公開）

1. https://vercel.com → **Add New → Project** → このリポジトリを選択
2. **Root Directory** を `timecard-system` にする（重要）
3. Environment Variables に以下を登録

   | Key | Value |
   | --- | --- |
   | `DATABASE_URL` | Supabase の Transaction pooler 文字列（`?pgbouncer=true` 付き） |
   | `DIRECT_URL` | Supabase の Direct 文字列（ポート 5432） |
   | `AUTH_SECRET` | 手順2で決めたランダム文字列 |
   | `AUTH_TRUST_HOST` | `true` |

4. **Deploy** → 数分で `https://xxxx.vercel.app` が発行される
5. 必要なら Settings → Domains で短いURLを付ける

## 5. 公開後にやること

1. 旧システムで使っていた admin の ID / パスワードでログインできることを確認（移行済みなら旧パスワードがそのまま使えます）
2. スタッフ数名に実際にログイン → 打刻してもらい動作確認
3. 旧 Render アプリの URL をスタッフに案内していた場合は新URLに差し替え
4. 問題なければ Render 側のサービスを停止（データは Supabase 側に移っているので削除してOK。心配なら1ヶ月ほど残しておく）

## トラブルシューティング

- **ログインできない**: Vercel の `AUTH_SECRET` と `DATABASE_URL` を再確認。移行前のアカウントは旧パスワードで入れます
- **「prepared statement ... already exists」エラー**: `DATABASE_URL` に `?pgbouncer=true` が付いているか確認
- **ビルド失敗**: Vercel の Root Directory が `timecard-system` になっているか確認
- **テーブル変更後**: ローカルで `npm run prisma:push`（`DIRECT_URL` が本番を向いていること）
