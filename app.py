import csv
import io
import os
import sqlite3
import unicodedata
from contextlib import closing
from datetime import date, datetime
from functools import wraps

from flask import (
    Flask,
    flash,
    g,
    redirect,
    render_template,
    request,
    send_file,
    session,
    url_for,
)
from werkzeug.security import check_password_hash, generate_password_hash

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE = os.path.join(BASE_DIR, "timecard.db")
COMPANY_NAME = "株式会社まごころグループ"
DEFAULT_ADMIN_PASSWORD = "admin1234"

app = Flask(__name__)
app.config["SECRET_KEY"] = "change-this-secret-key-v21"
app.config["SESSION_COOKIE_NAME"] = "magokoro_timecard_v21"


ALL_STORES = [
    "からだﾗﾎﾞ駅前院",
    "からだﾗﾎﾞ桜台院",
    "ﾗｺﾝｼｪﾙ青葉台店",
    "鍼灸ﾗｺﾝｼｪﾙ青葉台店",
    "からだﾗﾎﾞ溝の口院",
    "ﾗｺﾝｼｪﾙ三軒茶屋",
    "からだﾗﾎﾞ駒沢大学駅院",
    "狛江駅前整骨院",
    "からだﾗﾎﾞ新百合ヶ丘北口院",
    "からだﾗﾎﾞ溝の口分院",
    "からだﾗﾎﾞたまﾌﾟﾗｰｻﾞ院",
    "鍼灸ﾗｺﾝｼｪﾙたまﾌﾟﾗｰｻﾞ店",
    "ﾗｺﾝｼｪﾙ溝の口店",
    "鍼灸ﾗｺﾝｼｪﾙ代々木上原店",
    "ラ・コンシェル町田店",
    "からだラボ整骨院　センター北院",
    "からだラボ整骨院　マプレ院",
    "からだﾗﾎﾞ武蔵小杉院",
    "からだﾗﾎﾞ用賀院",
    "からだﾗﾎﾞ向ヶ丘遊園院",
]


# ---------- DB helpers ----------
def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DATABASE)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(exception=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def normalize_text(value: str) -> str:
    text = unicodedata.normalize("NFKC", value or "")
    text = text.replace("　", " ")
    return " ".join(text.split())


def detect_brand_and_store(display_name: str) -> tuple[str, str]:
    normalized = normalize_text(display_name)

    if normalized.startswith("鍼灸ラコンシェル"):
        return "鍼灸ラコンシェル", normalized.replace("鍼灸ラコンシェル", "", 1).strip()
    if normalized.startswith("ラコンシェル"):
        return "ラコンシェル", normalized.replace("ラコンシェル", "", 1).strip()
    if normalized.startswith("ラ・コンシェル"):
        return "ラコンシェル", normalized.replace("ラ・コンシェル", "", 1).strip()
    if normalized.startswith("からだラボ整骨院"):
        return "からだラボ整骨院", normalized.replace("からだラボ整骨院", "", 1).strip()
    if normalized.startswith("からだラボ"):
        return "からだラボ整骨院", normalized.replace("からだラボ", "", 1).strip()

    if "整骨院" in normalized:
        return "からだラボ整骨院", normalized

    return "からだラボ整骨院", normalized


def database_ready() -> bool:
    if not os.path.exists(DATABASE):
        return False
    try:
        conn = sqlite3.connect(DATABASE)
        row = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").fetchone()
        conn.close()
        return row is not None
    except sqlite3.Error:
        return False


def init_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    with closing(open(os.path.join(BASE_DIR, "schema.sql"), encoding="utf-8")) as f:
        conn.executescript(f.read())
    conn.commit()
    seed_data(conn)
    conn.close()


def seed_data(db):
    existing_admin = db.execute("SELECT id FROM users WHERE username = ?", ("admin",)).fetchone()
    if existing_admin:
        return

    for store_display_name in ALL_STORES:
        brand_name, store_name = detect_brand_and_store(store_display_name)
        db.execute(
            "INSERT INTO stores (company_name, brand_name, store_name, display_name) VALUES (?, ?, ?, ?)",
            (COMPANY_NAME, brand_name, store_name, normalize_text(store_display_name)),
        )

    admin_hash = generate_password_hash(DEFAULT_ADMIN_PASSWORD)
    first_store = db.execute("SELECT id FROM stores ORDER BY id LIMIT 1").fetchone()
    db.execute(
        "INSERT INTO users (store_id, username, password_hash, full_name, role, is_active) VALUES (?, ?, ?, ?, ?, 1)",
        (first_store["id"], "admin", admin_hash, "全体管理者", "admin"),
    )

    sample_staff = [
        ("kawahara", "河原", "からだラボ整骨院", "溝の口院"),
        ("kaneko", "金子", "からだラボ整骨院", "武蔵小杉院"),
        ("iwamura", "岩村", "ラコンシェル", "町田店"),
        ("hanada", "花田", "鍼灸ラコンシェル", "代々木上原店"),
    ]
    for username, full_name, brand_name, store_name in sample_staff:
        store = db.execute(
            "SELECT id FROM stores WHERE brand_name = ? AND store_name = ? LIMIT 1",
            (brand_name, store_name),
        ).fetchone()
        if store:
            db.execute(
                "INSERT INTO users (store_id, username, password_hash, full_name, role, is_active) VALUES (?, ?, ?, ?, ?, 1)",
                (store["id"], username, generate_password_hash("staff1234"), full_name, "staff"),
            )

    db.commit()


# ---------- auth ----------
def login_required(view):
    @wraps(view)
    def wrapped_view(**kwargs):
        if session.get("user_id") is None:
            return redirect(url_for("login"))
        return view(**kwargs)

    return wrapped_view



def admin_required(view):
    @wraps(view)
    def wrapped_view(**kwargs):
        if session.get("role") != "admin":
            flash("管理者のみ利用できます。", "error")
            return redirect(url_for("dashboard"))
        return view(**kwargs)

    return wrapped_view


@app.before_request
def load_logged_in_user():
    if request.endpoint == "init_db_route":
        g.user = None
        return

    if not database_ready():
        session.clear()
        g.user = None
        return

    user_id = session.get("user_id")
    if user_id is None:
        g.user = None
    else:
        g.user = get_db().execute(
            """
            SELECT u.*, s.brand_name, s.store_name, s.display_name, s.company_name
            FROM users u
            LEFT JOIN stores s ON u.store_id = s.id
            WHERE u.id = ?
            """,
            (user_id,),
        ).fetchone()
        if g.user is None:
            session.clear()


# ---------- business logic ----------
def get_today_attendance(user_id: int):
    db = get_db()
    return db.execute(
        "SELECT * FROM attendance WHERE user_id = ? AND work_date = ?",
        (user_id, date.today().isoformat()),
    ).fetchone()



def calculate_work_minutes(clock_in, clock_out, break_minutes):
    if not clock_in or not clock_out:
        return None
    start = datetime.fromisoformat(clock_in)
    end = datetime.fromisoformat(clock_out)
    total = int((end - start).total_seconds() // 60) - (break_minutes or 0)
    return max(total, 0)



def format_dt(dt_str):
    if not dt_str:
        return None
    return datetime.fromisoformat(dt_str).strftime("%Y-%m-%d %H:%M")



def minutes_to_hours_text(minutes):
    if minutes is None:
        return "-"
    hours = minutes // 60
    mins = minutes % 60
    return f"{hours}時間 {mins}分"


app.jinja_env.filters["format_dt"] = format_dt
app.jinja_env.filters["minutes_to_hours_text"] = minutes_to_hours_text


# ---------- routes ----------
@app.route("/init-db")
def init_db_route():
    session.clear()

    existing_db = g.pop("db", None)
    if existing_db is not None:
        existing_db.close()

    if os.path.exists(DATABASE):
        os.remove(DATABASE)

    init_db()
    return f"DB initialized. Login with admin / {DEFAULT_ADMIN_PASSWORD}"


@app.route("/", methods=["GET", "POST"])
def login():
    if not database_ready():
        return redirect(url_for("init_db_route"))

    if request.method == "POST":
        username = request.form["username"].strip()
        password = request.form["password"]
        db = get_db()
        user = db.execute(
            """
            SELECT u.*, s.brand_name, s.store_name, s.display_name, s.company_name
            FROM users u
            LEFT JOIN stores s ON u.store_id = s.id
            WHERE u.username = ? AND u.is_active = 1
            """,
            (username,),
        ).fetchone()
        error = None
        if user is None or not check_password_hash(user["password_hash"], password):
            error = "ログイン情報が正しくありません。"

        if error is None:
            session.clear()
            session["user_id"] = user["id"]
            session["role"] = user["role"]
            return redirect(url_for("dashboard"))

        flash(error, "error")

    return render_template("login.html")


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


@app.route("/dashboard")
@login_required
def dashboard():
    today_attendance = get_today_attendance(g.user["id"])
    db = get_db()
    recent_logs = db.execute(
        """
        SELECT * FROM attendance
        WHERE user_id = ?
        ORDER BY work_date DESC
        LIMIT 10
        """,
        (g.user["id"],),
    ).fetchall()
    return render_template(
        "dashboard.html",
        today_attendance=today_attendance,
        recent_logs=recent_logs,
    )


@app.route("/punch/<action>", methods=["POST"])
@login_required
def punch(action):
    db = get_db()
    record = get_today_attendance(g.user["id"])
    now = datetime.now().replace(second=0, microsecond=0).isoformat()

    if action == "clock_in":
        if record and record["clock_in"]:
            flash("本日の出勤打刻は完了しています。", "error")
        else:
            if record:
                db.execute(
                    "UPDATE attendance SET clock_in = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                    (now, record["id"]),
                )
            else:
                db.execute(
                    "INSERT INTO attendance (user_id, store_id, work_date, clock_in) VALUES (?, ?, ?, ?)",
                    (g.user["id"], g.user["store_id"], date.today().isoformat(), now),
                )
            db.commit()
            flash("出勤打刻しました。", "success")

    elif action == "break_start":
        if not record or not record["clock_in"]:
            flash("先に出勤打刻をしてください。", "error")
        elif record["break_start"] and not record["break_end"]:
            flash("すでに休憩中です。", "error")
        else:
            db.execute(
                "UPDATE attendance SET break_start = ?, break_end = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (now, record["id"]),
            )
            db.commit()
            flash("休憩開始を記録しました。", "success")

    elif action == "break_end":
        if not record or not record["break_start"]:
            flash("休憩開始が未打刻です。", "error")
        elif record["break_end"]:
            flash("休憩終了はすでに記録済みです。", "error")
        else:
            start = datetime.fromisoformat(record["break_start"])
            end = datetime.fromisoformat(now)
            delta_minutes = int((end - start).total_seconds() // 60)
            total_break = (record["break_minutes"] or 0) + max(delta_minutes, 0)
            db.execute(
                "UPDATE attendance SET break_end = ?, break_minutes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (now, total_break, record["id"]),
            )
            db.commit()
            flash("休憩終了を記録しました。", "success")

    elif action == "clock_out":
        if not record or not record["clock_in"]:
            flash("先に出勤打刻をしてください。", "error")
        elif record["clock_out"]:
            flash("本日の退勤打刻は完了しています。", "error")
        else:
            break_minutes = record["break_minutes"] or 0
            work_minutes = calculate_work_minutes(record["clock_in"], now, break_minutes)
            db.execute(
                "UPDATE attendance SET clock_out = ?, work_minutes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (now, work_minutes, record["id"]),
            )
            db.commit()
            flash("退勤打刻しました。", "success")
    else:
        flash("不正な操作です。", "error")

    return redirect(url_for("dashboard"))


@app.route("/admin")
@login_required
@admin_required
def admin_panel():
    db = get_db()
    month = request.args.get("month") or date.today().strftime("%Y-%m")
    store_id = request.args.get("store_id")

    query = """
        SELECT a.*, u.full_name, u.username, s.brand_name, s.store_name, s.display_name
        FROM attendance a
        JOIN users u ON a.user_id = u.id
        JOIN stores s ON a.store_id = s.id
        WHERE substr(a.work_date, 1, 7) = ?
    """
    params = [month]
    if store_id:
        query += " AND a.store_id = ?"
        params.append(store_id)
    query += " ORDER BY a.work_date DESC, s.brand_name, s.store_name, u.full_name"

    records = db.execute(query, params).fetchall()
    stores = db.execute(
        "SELECT * FROM stores ORDER BY brand_name, store_name"
    ).fetchall()

    summary = db.execute(
        """
        SELECT s.id, s.brand_name, s.store_name, s.display_name,
               COUNT(DISTINCT a.user_id) AS staff_count,
               COALESCE(SUM(a.work_minutes), 0) AS total_minutes
        FROM stores s
        LEFT JOIN attendance a ON a.store_id = s.id AND substr(a.work_date, 1, 7) = ?
        GROUP BY s.id
        ORDER BY s.brand_name, s.store_name
        """,
        (month,),
    ).fetchall()

    return render_template(
        "admin.html",
        records=records,
        stores=stores,
        summary=summary,
        selected_month=month,
        selected_store_id=store_id,
    )


@app.route("/admin/users", methods=["GET", "POST"])
@login_required
@admin_required
def manage_users():
    db = get_db()
    if request.method == "POST":
        store_id = request.form["store_id"]
        username = request.form["username"].strip()
        full_name = request.form["full_name"].strip()
        password = request.form["password"]
        role = request.form["role"]
        try:
            db.execute(
                "INSERT INTO users (store_id, username, password_hash, full_name, role, is_active) VALUES (?, ?, ?, ?, ?, 1)",
                (store_id, username, generate_password_hash(password), full_name, role),
            )
            db.commit()
            flash("スタッフを追加しました。", "success")
        except sqlite3.IntegrityError:
            flash("ユーザー名が重複しています。", "error")
        return redirect(url_for("manage_users"))

    users = db.execute(
        """
        SELECT u.*, s.brand_name, s.store_name, s.display_name
        FROM users u
        LEFT JOIN stores s ON u.store_id = s.id
        ORDER BY s.brand_name, s.store_name, u.full_name
        """
    ).fetchall()
    stores = db.execute("SELECT * FROM stores ORDER BY brand_name, store_name").fetchall()
    return render_template("users.html", users=users, stores=stores)


@app.route("/admin/users/<int:user_id>/delete", methods=["POST"])
@login_required
@admin_required
def delete_user(user_id: int):
    db = get_db()
    user = db.execute(
        "SELECT id, full_name, username, role FROM users WHERE id = ?",
        (user_id,),
    ).fetchone()

    if user is None:
        flash("対象スタッフが見つかりません。", "error")
        return redirect(url_for("manage_users"))

    if user["id"] == session.get("user_id"):
        flash("ログイン中の自分自身は削除できません。", "error")
        return redirect(url_for("manage_users"))

    db.execute("DELETE FROM attendance WHERE user_id = ?", (user_id,))
    db.execute("DELETE FROM users WHERE id = ?", (user_id,))
    db.commit()
    flash(f"{user['full_name']}（{user['username']}）を削除しました。", "success")
    return redirect(url_for("manage_users"))


@app.route("/admin/export")
@login_required
@admin_required
def export_csv():
    db = get_db()
    month = request.args.get("month") or date.today().strftime("%Y-%m")
    store_id = request.args.get("store_id")

    query = """
        SELECT a.work_date, s.brand_name, s.store_name, s.display_name, u.full_name,
               a.clock_in, a.break_start, a.break_end, a.clock_out,
               a.break_minutes, a.work_minutes, a.note
        FROM attendance a
        JOIN users u ON a.user_id = u.id
        JOIN stores s ON a.store_id = s.id
        WHERE substr(a.work_date, 1, 7) = ?
    """
    params = [month]
    if store_id:
        query += " AND a.store_id = ?"
        params.append(store_id)
    query += " ORDER BY a.work_date, s.brand_name, s.store_name, u.full_name"

    rows = db.execute(query, params).fetchall()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "勤務日", "ブランド", "店舗略称", "店舗表示名", "スタッフ名", "出勤", "休憩開始", "休憩終了",
        "退勤", "休憩合計(分)", "実働(分)", "実働(時間表記)", "備考"
    ])
    for row in rows:
        writer.writerow([
            row["work_date"], row["brand_name"], row["store_name"], row["display_name"], row["full_name"],
            row["clock_in"] or "", row["break_start"] or "", row["break_end"] or "", row["clock_out"] or "",
            row["break_minutes"] or 0, row["work_minutes"] or 0, minutes_to_hours_text(row["work_minutes"] or 0), row["note"] or ""
        ])

    mem = io.BytesIO()
    mem.write(output.getvalue().encode("utf-8-sig"))
    mem.seek(0)

    filename = f"timecard_{month}"
    if store_id:
        store = db.execute("SELECT display_name FROM stores WHERE id = ?", (store_id,)).fetchone()
        if store:
            filename += f"_{store['display_name']}"
    filename += ".csv"

    return send_file(mem, as_attachment=True, download_name=filename, mimetype="text/csv")


@app.route("/admin/edit/<int:attendance_id>", methods=["GET", "POST"])
@login_required
@admin_required
def edit_attendance(attendance_id):
    db = get_db()
    record = db.execute(
        """
        SELECT a.*, u.full_name, s.brand_name, s.store_name, s.display_name
        FROM attendance a
        JOIN users u ON a.user_id = u.id
        JOIN stores s ON a.store_id = s.id
        WHERE a.id = ?
        """,
        (attendance_id,),
    ).fetchone()
    if not record:
        flash("対象データが見つかりません。", "error")
        return redirect(url_for("admin_panel"))

    if request.method == "POST":
        clock_in = request.form.get("clock_in") or None
        break_start = request.form.get("break_start") or None
        break_end = request.form.get("break_end") or None
        clock_out = request.form.get("clock_out") or None
        note = request.form.get("note") or None
        break_minutes = int(request.form.get("break_minutes") or 0)
        work_minutes = calculate_work_minutes(clock_in, clock_out, break_minutes)
        db.execute(
            """
            UPDATE attendance
            SET clock_in = ?, break_start = ?, break_end = ?, clock_out = ?,
                break_minutes = ?, work_minutes = ?, note = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (clock_in, break_start, break_end, clock_out, break_minutes, work_minutes, note, attendance_id),
        )
        db.commit()
        flash("打刻を更新しました。", "success")
        return redirect(url_for("admin_panel"))

    return render_template("edit_attendance.html", record=record)


if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
