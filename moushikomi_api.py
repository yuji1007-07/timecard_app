# ============================================================
# moushikomi_api.py
# 申込書アプリ用のクラウド保存API（勤怠アプリに相乗り）。
#
# ・既存の勤怠アプリ(app.py)のコードには手を加えず、この1ファイルで完結。
# ・app.py の末尾で init_moushikomi(app, get_db, パスワード) を呼ぶだけで有効化。
# ・データは勤怠アプリと同じデータベース(PostgreSQL/SQLite)に
#   申込書専用テーブルとして保存するため、全iPad・PCで共有される。
#
# セキュリティ（試験運用向けの簡易保護）:
#   すべてのAPIは HTTPヘッダ "X-App-Password" にスタッフ共通の
#   合言葉が一致しないと 401 で拒否する。
# ============================================================

import json
from flask import Blueprint, request, jsonify

# 申込書フロント(GitHub Pages)からの呼び出しを許可するための設定で使う
bp = Blueprint("moushikomi_api", __name__, url_prefix="/api/moushikomi")

# init_moushikomi で差し込まれる依存（app.py 側のものを使う）
_get_db = None           # データベース接続を返す関数
_password = None         # スタッフ共通の合言葉


def init_moushikomi(app, get_db, password):
    """app.py から呼び出して、このAPIを有効化する。"""
    global _get_db, _password
    _get_db = get_db
    _password = password
    app.register_blueprint(bp)


# ---------- テーブル準備（初回アクセス時に自動作成） ----------
def _ensure_tables(db):
    # id は申込書アプリ側で作った文字列IDをそのまま主キーにする。
    # 中身(data)は申込書1件ぶんのJSONを丸ごと保存する（柔軟・拡張しやすい）。
    db.execute(
        """
        CREATE TABLE IF NOT EXISTS moushikomi_templates (
            id TEXT PRIMARY KEY,
            data TEXT NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    db.execute(
        """
        CREATE TABLE IF NOT EXISTS moushikomi_applications (
            id TEXT PRIMARY KEY,
            data TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    db.commit()


# ---------- 共通処理（CORS・認証） ----------
@bp.before_request
def _before():
    # ブラウザの事前確認(preflight)はそのまま通す
    if request.method == "OPTIONS":
        return ("", 204)
    # 合言葉チェック
    if request.headers.get("X-App-Password") != _password:
        return jsonify({"error": "認証に失敗しました（合言葉が違います）"}), 401
    # テーブルがなければ作る
    _ensure_tables(_get_db())


@bp.after_request
def _after(resp):
    # GitHub Pages など別ドメインのフロントから呼べるように許可（CORS）
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type, X-App-Password"
    resp.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    return resp


# ---------- 認証確認（ログイン画面用） ----------
@bp.route("/ping", methods=["GET", "OPTIONS"])
def ping():
    # ここに到達した時点で合言葉はOK
    return jsonify({"ok": True})


# ---------- テンプレート ----------
@bp.route("/templates", methods=["GET", "OPTIONS"])
def list_templates():
    db = _get_db()
    rows = db.execute("SELECT data FROM moushikomi_templates").fetchall()
    return jsonify([json.loads(r["data"]) for r in rows])


@bp.route("/templates/<tid>", methods=["PUT", "OPTIONS"])
def save_template(tid):
    db = _get_db()
    payload = request.get_json(force=True)
    _upsert(db, "moushikomi_templates", tid, payload)
    return jsonify({"ok": True})


@bp.route("/templates/<tid>", methods=["DELETE", "OPTIONS"])
def delete_template(tid):
    db = _get_db()
    db.execute("DELETE FROM moushikomi_templates WHERE id = ?", (tid,))
    db.commit()
    return jsonify({"ok": True})


# ---------- 申込書（履歴） ----------
@bp.route("/applications", methods=["GET", "OPTIONS"])
def list_applications():
    db = _get_db()
    rows = db.execute(
        "SELECT data FROM moushikomi_applications ORDER BY created_at DESC"
    ).fetchall()
    return jsonify([json.loads(r["data"]) for r in rows])


@bp.route("/applications/<aid>", methods=["PUT", "OPTIONS"])
def save_application(aid):
    db = _get_db()
    payload = request.get_json(force=True)
    _upsert(db, "moushikomi_applications", aid, payload)
    return jsonify({"ok": True})


@bp.route("/applications/<aid>", methods=["DELETE", "OPTIONS"])
def delete_application(aid):
    db = _get_db()
    db.execute("DELETE FROM moushikomi_applications WHERE id = ?", (aid,))
    db.commit()
    return jsonify({"ok": True})


# ---------- 店舗一覧（勤怠アプリの店舗マスタを流用） ----------
@bp.route("/stores", methods=["GET", "OPTIONS"])
def list_stores():
    db = _get_db()
    try:
        rows = db.execute(
            "SELECT display_name FROM stores WHERE is_active = 1 ORDER BY brand_name, store_name"
        ).fetchall()
        names = [r["display_name"] for r in rows]
    except Exception:
        names = []
    return jsonify(names)


# ---------- 内部: 追加 or 上書き（upsert） ----------
def _upsert(db, table, row_id, payload):
    # 念のためIDを本体にも入れておく
    payload["id"] = row_id
    data = json.dumps(payload, ensure_ascii=False)
    # 同じIDがあれば上書き、なければ新規追加（SQLite/PostgreSQL両対応）
    db.execute(
        f"""
        INSERT INTO {table} (id, data) VALUES (?, ?)
        ON CONFLICT(id) DO UPDATE SET data = excluded.data
        """,
        (row_id, data),
    )
    db.commit()
