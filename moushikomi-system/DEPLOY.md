# 本番公開手順（Supabase + Vercel）と旧システムからの移行

所要時間の目安: 30〜40分。勤怠管理・在庫管理システムと同じ Supabase プロジェクトを使い回せます（このアプリは `moushikomi` スキーマだけを使い、他のアプリのテーブルには触りません）。

---

## 1. Supabase（データベース）

1. https://supabase.com でプロジェクトを開く（勤怠管理・在庫管理で使っているものでOK。新規なら Region は **Northeast Asia (Tokyo)**）
2. 「Connect」ボタン → **Connection string** を2種類コピー
   - **Transaction pooler**（ポート 6543）→ `DATABASE_URL` 用。末尾に `?pgbouncer=true` を付ける
   - **Session pooler / Direct**（ポート 5432）→ `DIRECT_URL` 用
3. パスワード部分 `[YOUR-PASSWORD]` をプロジェクト作成時のDBパスワードに置き換える

## 2. テーブル作成（自分のPCから1回だけ）

```bash
cd moushikomi-system
npm install
cp .env.example .env
# .env の DATABASE_URL / DIRECT_URL / AUTH_SECRET を本番の値にする
npm run prisma:push     # moushikomi スキーマとテーブルを作成
npm run db:seed         # 店舗マスタ21店舗 + 店舗アカウント + 本部アカウント + 初期テンプレートを投入
```

`AUTH_SECRET` は `openssl rand -base64 32` などで作ったランダム文字列にしてください。

> PCで作業できない場合: 先に Vercel へデプロイしてから `https://<アプリURL>/api/setup?key=<AUTH_SECRET>` を1回開くと、テーブル作成と初期データ投入をブラウザから実行できます（データは消しません）。

## 3. 旧システム（Render）からデータを移す

旧アプリのテンプレートと申込履歴（署名画像込み）をすべてコピーします。

1. Render ダッシュボード → 旧勤怠アプリ（申込書APIが相乗りしていたもの）の PostgreSQL → 「External Database URL」をコピー
2. 自分のPCで実行:

```bash
cd moushikomi-system
OLD_DATABASE_URL="postgresql://...(Renderの接続文字列)..." npm run migrate:from-render
```

3. `✅ 移行完了` と件数が表示されれば完了。何度実行しても二重登録にはなりません。
   - 店舗名が店舗マスタに無い申込書があった場合、その店舗は「無効」状態で自動作成されます（店舗管理で名前を直すか有効化してください）
   - 旧「本部設定」の「店舗アカウントにテンプレート編集を許可する」も引き継がれます
   - 旧本部の ID/パスワードは引き継がれません（新システムは `honbu` / `honbu-magokoro2026` で始まり、本部設定で変更します）

## 4. Vercel（アプリ公開）

1. https://vercel.com → **Add New → Project** → このリポジトリを選択
2. **Root Directory** を `moushikomi-system` にする（重要）
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

1. `honbu` / `honbu-magokoro2026` でログイン → **本部設定** でID・パスワードを変更
2. 各店舗の iPad で `store<旧PIN>` / `<旧PIN>`（例: `store1007` / `1007`）でログインできることを確認 → 申込書を1件作ってサイン・印刷まで試す
3. 必要なら **スタッフ管理** で店舗アカウントのパスワードを変更
4. 旧アプリ（GitHub Pages）のURLを案内していた場合は新URLに差し替え
5. 問題なければ旧 Render 側の申込書APIは不要（勤怠アプリも新システムへ移行済みなら Render 自体を停止してOK。心配なら1ヶ月ほど残しておく）

## トラブルシューティング

- **ログインできない**: Vercel の `AUTH_SECRET` と `DATABASE_URL` を再確認。店舗アカウントは `store` + 4桁PIN がID、PINがパスワード
- **店舗で申込書が1つも表示されない**: 本部ログイン → テンプレート管理 → 各テンプレートの「対象部門」をその店舗の部門にする（どれもオフなら全部門で表示）
- **「prepared statement ... already exists」エラー**: `DATABASE_URL` に `?pgbouncer=true` が付いているか確認
- **ビルド失敗**: Vercel の Root Directory が `moushikomi-system` になっているか確認
- **PDFをまとめてZIP保存が動かない**: ブラウザが cdnjs.cloudflare.com（html2canvas / jsPDF / JSZip）に接続できるか確認
- **テーブル変更後**: ローカルで `npm run prisma:push`（`DIRECT_URL` が本番を向いていること）
