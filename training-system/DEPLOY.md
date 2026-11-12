# 公開手順（Supabase + Vercel）

研修動画管理システムを Vercel に公開する手順です。データベースは、ほかの業務アプリと**同じ Supabase プロジェクト**を使います（専用スキーマ `training` に入るので、ほかのアプリのデータには触れません）。

## 1. 用意するもの（環境変数4つ）

| 名前 | 値 |
| --- | --- |
| `DATABASE_URL` | Supabase の **Transaction pooler** の接続文字列（ポート 6543、末尾に `?pgbouncer=true`）。勤怠管理など他アプリと同じ値 |
| `DIRECT_URL` | Supabase の **Direct connection**（または Session pooler、ポート 5432）の接続文字列。他アプリと同じ値 |
| `AUTH_SECRET` | このアプリ用のランダムな文字列（32文字以上。他アプリと別の値にする） |
| `AUTH_TRUST_HOST` | `true` |

`DATABASE_URL` と `DIRECT_URL` は、Vercel の既存プロジェクト（例: timecard-system）の Settings → Environment Variables で確認できます。
**接続文字列やパスワードは、チャットやメールに貼らないでください。**

## 2. Vercel に取り込む

1. https://vercel.com/new を開く
2. **Import Git Repository** で `yuji1007-07/timecard_app` の **Import** を押す
3. **Project Name** を `training-system`（任意）にする
4. **Root Directory** の **Edit** を押し、`training-system` を選んで **Continue**
5. Framework Preset が **Next.js** になっていることを確認
6. **Environment Variables** を開き、上の表の4つを1つずつ入力して **Add**
7. **Deploy** を押す（2〜3分）

## 3. 初期セットアップ（1回だけ）

公開されたら、ブラウザで次の URL を開きます（`<AUTH_SECRET>` は手順1で決めた値）。

```
https://<公開されたURL>/api/setup?key=<AUTH_SECRET>
```

`"ok": true` と表示されれば完了です。テーブルの作成と、店舗マスタ・`admin` アカウント・初期動画4本（テスト問題つき）の登録が行われます。
何度開いても安全です（既にあるデータは変更も削除もしません）。

## 4. 公開後にやること

1. `admin` / `admin1234` でログインし、**アカウント設定**でパスワードを変更する
2. **スタッフ管理 → CSV 一括登録** でスタッフを登録する（ユーザーIDは勤怠管理システムと同じにそろえる）
   - 列: `氏名, ユーザーID, 店舗名, 役職, 初期パスワード`
   - 役職: 店長／副店長／リーダー／スタッフ
3. **動画・テスト管理** で各動画の「編集・テスト問題」を開き、YouTube の限定公開 URL を入れる（入れるまでスタッフ側は「準備中」）。必要なら期限も設定する
4. スタッフに公開URLと、ユーザーID・初期パスワードを案内する

## トラブルシューティング

- **ビルド失敗**: Root Directory が `training-system` になっているか確認
- **ログインできない**: `AUTH_SECRET` と `DATABASE_URL` を再確認
- **「prepared statement ... already exists」**: `DATABASE_URL` に `?pgbouncer=true` が付いているか確認
- **/api/setup が「認証エラー」**: URL の `key=` の値が Vercel の `AUTH_SECRET` と同じか確認（記号 `+` `/` `=` を含む場合は、英数字だけの値に作り直すと確実）
- **動画が再生できない**: YouTube 側の公開設定が「限定公開」で、「埋め込みを許可」がオンになっているか確認
- **視聴％が進まない**: 管理画面の「動画の長さ」が実際の長さと合っているか確認
