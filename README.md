# 株式会社まごころグループ 業務アプリ

グループの業務アプリをまとめたリポジトリです。各アプリの使い方・公開手順はそれぞれのフォルダの README / DEPLOY.md を見てください。
作り方のルールは **[CLAUDE.md](./CLAUDE.md)** にまとめています（新しいアプリ・修正はこのルールに従います）。
新しいアプリを作るときは **[docs/新規アプリ作成プロンプト.md](./docs/新規アプリ作成プロンプト.md)** の内容を Claude に貼ってください。

| フォルダ | アプリ | 内容 |
| --- | --- | --- |
| [`timecard-system/`](./timecard-system/) | 勤怠管理 | 出勤・休憩・退勤の打刻、勤怠一覧・一括編集、CSV/Excel出力、スタッフ・店舗管理 |
| [`report-system/`](./report-system/) | 週次/月次報告管理 | 店舗責任者の週次/月次報告、KPI/KDI管理、エリアマネージャー向けダッシュボード |
| [`inventory-system/`](./inventory-system/) | 在庫管理 | 商品・店舗別在庫、入出庫、棚卸 |
| [`moushikomi-system/`](./moushikomi-system/) | 会員申込書 | iPadで申込書を表示→サイン→PDF印刷、テンプレート管理、申込履歴・顧客管理 |
| `lacshell_site/` | 町田店ホームページ | 一般公開用の静的サイト |

共通の技術構成: Next.js + Prisma + PostgreSQL（Supabase、アプリごとに専用スキーマ）+ Vercel。

## 旧システム（移行済み・削除予定）

- ルート直下の `app.py` / `templates/` / `static/`: 旧 勤怠アプリ（Flask + Render）。`timecard-system/` に置き換え済み
- `moushikomi_app/` / `moushikomi_api.py`: 旧 会員申込書アプリ（静的HTML + 勤怠アプリのAPI）。`moushikomi-system/` に置き換え済み

旧システムの利用を完全に止めたら、これらのフォルダは削除して構いません。
