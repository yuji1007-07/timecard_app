"""gunicorn 用エントリーポイント。

Render の Start Command:
    gunicorn -w 2 -b 0.0.0.0:$PORT wsgi:app
"""

from magokoro_attendance.app import create_app

app = create_app()
