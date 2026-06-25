# 公開手順（Vercel + Neon Postgres）

スタッフにURLを送って使ってもらうための公開手順です。所要時間 約20〜30分。
専門知識は不要で、ほぼ「無料アカウント作成 → コピペ → ボタンクリック」です。

全体の流れ：
1. データベースを用意する（Neon・無料）
2. データベースに初期データを入れる（自分のMacから1回だけ）
3. Vercelに公開する（無料）
4. 公開後にパスワードを変更し、スタッフを登録する

---

## 1. データベースを用意する（Neon）

1. https://neon.tech を開き、GitHubアカウントでサインアップ（無料・クレカ不要）。
2. 「Create project」でプロジェクトを作成（名前は何でもOK。リージョンは `Asia Pacific (Tokyo)` が近くて速い）。
3. 作成後に表示される **接続文字列（Connection string）** をコピーしておく。
   - `postgresql://....neon.tech/neondb?sslmode=require` のような文字列です。
   - 「Pooled connection」のチェックは**外したまま**でOK（この規模では不要）。
   - この文字列を、以下で何度か使います。

---

## 2. 初期データを入れる（自分のMacから1回だけ）

最新コードを取り込み、Neonにテーブルと初期データ（店舗・KPI/KDIテンプレート・管理者アカウント）を作成します。

ターミナルで、上から順に実行してください（`◯◯` は置き換え）。

```
cd /Users/kitamura/Downloads/timecard_app/report-system
git stash
git pull origin claude/optimistic-dirac-hmupqt
git stash pop
```

> 「No stash entries found」と出たら無視でOKです。

次に、Neonの接続文字列をセットして、テーブル作成＋初期データ投入：

```
export DATABASE_URL="ここにNeonの接続文字列を貼り付け"
npx prisma db push
npm run db:seed
```

`✅ シード完了` と出れば成功です。これでNeon側に初期データ（あなたの5店舗・町田の3部門・各業態のKPI/KDIテンプレート・管理者アカウント）が入りました。

---

## 3. Vercelに公開する

1. https://vercel.com を開き、GitHubアカウントでサインアップ（無料）。
2. 「Add New… → Project」→ `timecard_app` リポジトリを Import。
3. **Root Directory を `report-system` に変更**（「Edit」を押して `report-system` を選択）。← 最重要
4. **Production Branch を `claude/optimistic-dirac-hmupqt` に設定**。
   - Import画面で選べない場合は、一度デプロイした後に
     Settings → Git → Production Branch で変更して、再デプロイしてください。
5. 「Environment Variables」に以下を追加：

   | Key | Value |
   | --- | --- |
   | `DATABASE_URL` | Neonの接続文字列（手順1のもの） |
   | `AUTH_SECRET` | 強いランダム文字列（下記コマンドで生成） |
   | `NEXTAUTH_SECRET` | AUTH_SECRET と同じ値 |
   | `AUTH_TRUST_HOST` | `true` |

   AUTH_SECRET はターミナルで以下を実行して出た文字列を使ってください：
   ```
   openssl rand -base64 32
   ```

   （任意）AI・LINE・スプレッドシート連携を使う場合は、追加で
   `OPENAI_API_KEY` / `LINE_CHANNEL_ACCESS_TOKEN` / `GOOGLE_SERVICE_ACCOUNT_EMAIL` /
   `GOOGLE_PRIVATE_KEY` / `GOOGLE_SHEETS_SPREADSHEET_ID` を設定。

6. 「Deploy」を押す。数分でビルドが完了し、`https://xxxxx.vercel.app` のURLが発行されます。
   **これがスタッフに送るリンクです。**

---

## 4. 公開後にやること（重要・セキュリティ）

初期データには「password123」の仮アカウントが含まれます。本番では必ず変更してください。

1. 発行されたURLを開き、`k.yuji19951007@gmail.com` / `password123` でログイン。
2. 左メニュー **アカウント設定** → パスワードを自分用に変更。
3. **ユーザー管理** で、実際のスタッフのアカウントを作成（各自のメール・初期パスワード・担当店舗/部門・権限を設定）。
4. 使わない仮アカウント（`honin@example.com` などのデモ用）は **ユーザー管理** から削除。
5. スタッフには「URL・自分のメール・初期パスワード」を伝え、初回ログイン後に
   **アカウント設定からパスワードを変更**してもらってください。

---

## 更新の反映について

このブランチ（`claude/optimistic-dirac-hmupqt`）に新しいコミットがpushされると、
Vercelが自動で再ビルド・再公開します。データ（報告内容など）はNeonに保存されるので、
再デプロイしても消えません。

DBの構造を変えた場合のみ、手順2の `npx prisma db push` を再実行してください
（通常の機能追加では不要です）。

---

## つまずいたら

- ビルドが失敗する → Vercelの「Deployments」→該当ビルド→ログの最後の数行をコピーして共有してください。
- ログインできない → `AUTH_SECRET` / `DATABASE_URL` が正しく設定されているか確認。
- 「prepared statement」系のエラーが出た → `DATABASE_URL` の末尾に `&pgbouncer=true`（`?`が無ければ`?pgbouncer=true`）を付けて再デプロイ。
