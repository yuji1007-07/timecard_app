# まごころグループ 業務アプリ 共通ルール（CLAUDE.md）

このリポジトリは 株式会社まごころグループ（からだラボ整骨院 / ラコンシェル / 鍼灸ラコンシェル）の業務アプリをまとめたモノレポです。
**新しいアプリを作るとき・既存アプリを直すときは、必ずこのファイルのルールに従ってください。** 過去にアプリごとに構成がバラバラになって運用が困った経験があるため、ここに書いた「標準構成」から外れる提案は、理由を明示したうえで必ず確認を取ること。

## 1. アプリ一覧と場所

| フォルダ | アプリ | 状態 |
| --- | --- | --- |
| `report-system/` | 週次/月次報告管理システム | 稼働中（Vercel） |
| `inventory-system/` | 在庫管理システム | 稼働中（Vercel） |
| `timecard-system/` | 勤怠管理システム（Next.js版） | 標準構成に移行済み。旧 Flask 版（ルート直下の `app.py` + Render）から置き換え |
| `moushikomi-system/` | 会員申込書システム（Next.js版） | 標準構成に移行済み。旧 静的HTML版（`moushikomi_app/`）から置き換え |
| `lacshell_site/` | 町田店ホームページ（静的サイト） | 一般公開サイトのため業務アプリの標準構成の対象外 |
| ルート直下 `app.py`, `templates/`, `static/`, `moushikomi_api.py`, `moushikomi_app/` | 旧システム（Flask / 静的HTML） | 移行完了後に削除予定。新機能はここに追加しない |

新しい業務アプリは `<name>-system/` フォルダとして追加し、上の表にも1行足すこと。
新規作成時に貼るプロンプトは `docs/新規アプリ作成プロンプト.md` にある（まずそれを読む）。

## 2. 標準技術構成（全アプリ共通・変更禁止）

- **Next.js 15 (App Router) + React 19 + TypeScript**（`src/` 配下、`@/*` エイリアス）
- **Tailwind CSS + shadcn/ui 風の自前コンポーネント**（`src/components/ui/`）
- **Prisma 5 + PostgreSQL（Supabase）**。1つの Supabase プロジェクトを全アプリで共有し、アプリごとに専用スキーマを使う
  - `generator client { previewFeatures = ["multiSchema"] }`、`datasource db { url = env("DATABASE_URL"), directUrl = env("DIRECT_URL"), schemas = ["<アプリ名>"] }`、全モデルに `@@schema("<アプリ名>")`
  - 例: `inventory`, `timecard`, `moushikomi`
- **Auth.js (NextAuth v5 beta) Credentials + JWT セッション + bcryptjs**
- **Vercel にデプロイ**（Root Directory = アプリのフォルダ）。Render / Netlify / GitHub Pages は業務アプリには使わない（無料プランのスリープで起動が遅くなるため）
- バージョンは既存アプリと揃える: `next ^15.5.19`, `react ^19.2.7`, `next-auth 5.0.0-beta.25`, `prisma ^5.22.0`, `zod ^3`, `lucide-react`

新しいアプリを作るときは **`timecard-system/` をまるごとコピーして始める**（一番シンプルな標準実装）。コピー元: 設定ファイル一式、`src/components/`、`src/lib/{prisma,session,utils,auth-actions}.ts`、`src/auth*.ts`、`src/middleware.ts`、`src/app/login`、`src/app/(app)/{layout,error}.tsx`、`src/app/(app)/account`、`src/app/api/setup`。

## 3. 画面・コードの決まりごと

- 言語: 画面の文言・コメント・コミットメッセージはすべて日本語
- レイアウト: 左サイドバー（PC）/ 上部メニュー（スマホ）の共通シェル（`(app)/layout.tsx`）。ページは `PageHeader` → `Card` の構成
- ログイン: 「ユーザーID + パスワード」（`loginId`）。メールアドレス必須にしない
- 権限: `ADMIN`（本部・全体管理者）と `STAFF`（店舗スタッフ）の2種類を基本にし、店舗の担当範囲はテーブル（例: `StorePermission`）で表す。権限チェックは `requireUser / requireAdmin / requireManager`（`src/lib/session.ts`）で**サーバー側**に必ず入れる
- 店舗マスタ: 店舗名は `timecard-system/src/lib/constants.ts` の `ALL_STORES` が正。ブランド判定は `detectBrandAndStore()` を使う
- フォーム: `useActionState` + サーバーアクション。アクションは `{ error }` または `{ success, message }` を返す。成功したらクライアント側で `router.refresh()`
- 日時: DB は UTC の `DateTime`、表示・入力は日本時間（`src/lib/time.ts` のヘルパーを使う）
- 出力: CSV は BOM 付き UTF-8、Excel は `exceljs`
- 初期化: `/api/setup?key=<AUTH_SECRET>`（テーブル作成 + 初期データ。データは絶対に消さない）と `npm run db:seed`
- 各アプリに `README.md`（機能一覧・ローカル起動）と `DEPLOY.md`（Supabase + Vercel 手順）を置く

## 4. 絶対にやってはいけないこと（実際に起きた不具合）

1. **`loading.tsx` を置かない**（`src/app/(app)/loading.tsx` など）。この Next.js のバージョンでは、loading 境界があると `router.refresh()` / `revalidatePath` の結果が約半分の確率で画面に反映されず、「打刻したのに画面が変わらない」状態になる（timecard-system で再現・確認済み）
2. **サーバーアクションの中で `revalidatePath` / `revalidateTag` を呼ばない**。上と同じ理由で応答が止まることがある。代わりに結果を返して、クライアントで `router.refresh()` する
3. サーバーアクションから**同じパスへ `redirect()` しない**（画面が真っ白になる）。別のパスへのリダイレクトはOK
4. DBを読むページには `export const dynamic = "force-dynamic"` を付ける
5. `.env` をコミットしない。パスワード・接続文字列はチャットにも貼らない

## 5. 運用メモ

- Supabase の接続文字列: Vercel の `DATABASE_URL` は Transaction pooler（6543, `?pgbouncer=true`）、`DIRECT_URL` は Direct（5432）
- データ移行スクリプトは `scripts/migrate-from-*.ts` に置き、何度実行しても安全（upsert）にする
- 動作確認は Playwright（プリインストール済み）でログイン〜主要操作を通すこと。ローカルDBは PostgreSQL 16 を `/tmp` ソケット・ポート 5433 で起動して使える
