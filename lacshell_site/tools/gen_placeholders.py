# -*- coding: utf-8 -*-
"""
ラ・コンシェル整骨院 サイト用 プレースホルダー画像ジェネレーター
（実写真が用意でき次第、同じファイル名で assets/ 内を差し替えるだけで反映されます）

使い方:
    python3 lacshell_site/tools/gen_placeholders.py
"""
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "assets")
os.makedirs(OUT, exist_ok=True)

# ---- フォント ----
JP = "/usr/share/fonts/truetype/fonts-japanese-gothic.ttf"
SERIF = "/mnt/skills/examples/canvas-design/canvas-fonts/CrimsonPro-Regular.ttf"
SERIF_B = "/mnt/skills/examples/canvas-design/canvas-fonts/CrimsonPro-Bold.ttf"
if not os.path.exists(SERIF):
    SERIF = "/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf"
    SERIF_B = "/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf"

def font(path, size):
    return ImageFont.truetype(path, size)

# ---- カラーパレット（ローズ基調 / サイトと統一）----
CREAM_HI = (250, 245, 238)   # #faf5ee
CREAM    = (243, 235, 221)   # #f3ebdd
CREAM_LO = (239, 230, 216)   # #efe6d8
ROSE     = (191, 130, 149)   # #bf8295
ROSE_DP  = (163, 105, 123)   # #a3697b
ROSE_SOFT= (214, 179, 191)
BROWN    = (74, 61, 49)      # #4a3d31
BROWN_2  = (119, 104, 87)    # #776857

def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))

def vgrad(w, h, top, bot):
    img = Image.new("RGB", (w, h), top)
    px = img.load()
    for y in range(h):
        c = lerp(top, bot, y / max(1, h - 1))
        for x in range(w):
            px[x, y] = c
    return img

def draw_spaced(draw, xy, text, fnt, fill, spacing=0, anchor_center=True):
    """文字間隔つきテキスト。anchor_center=True で中央寄せ。"""
    widths = []
    for ch in text:
        bb = draw.textbbox((0, 0), ch, font=fnt)
        widths.append(bb[2] - bb[0])
    total = sum(widths) + spacing * (len(text) - 1)
    x, y = xy
    if anchor_center:
        x -= total / 2
    # 縦中央用に高さ算出
    bb = draw.textbbox((0, 0), text, font=fnt)
    h = bb[3] - bb[1]
    y -= h / 2 + bb[1]
    for i, ch in enumerate(text):
        draw.text((x, y), ch, font=fnt, fill=fill)
        x += widths[i] + spacing

def centered(draw, cx, y, text, fnt, fill):
    bb = draw.textbbox((0, 0), text, font=fnt)
    w = bb[2] - bb[0]
    draw.text((cx - w / 2 - bb[0], y), text, font=fnt, fill=fill)

def camera_glyph(draw, cx, cy, s, color):
    """シンプルなカメラ風アイコン（写真プレースホルダーの合図）"""
    bw, bh = s * 1.6, s
    x0, y0 = cx - bw / 2, cy - bh / 2
    draw.rounded_rectangle([x0, y0, x0 + bw, y0 + bh], radius=s * 0.16,
                           outline=color, width=max(2, int(s * 0.05)))
    # ファインダー突起
    fw = s * 0.42
    draw.rounded_rectangle([cx - fw / 2, y0 - s * 0.16, cx + fw / 2, y0 + s * 0.04],
                           radius=s * 0.06, outline=color, width=max(2, int(s * 0.05)))
    # レンズ
    r = s * 0.28
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=color, width=max(2, int(s * 0.05)))
    r2 = s * 0.12
    draw.ellipse([cx - r2, cy - r2, cx + r2, cy + r2], outline=color, width=max(2, int(s * 0.045)))

def make(name, w, h, jp, en, top=CREAM_HI, bot=CREAM_LO, accent=ROSE, glyph=True, jp_size=None):
    img = vgrad(w, h, top, bot)
    d = ImageDraw.Draw(img, "RGBA")
    m = int(min(w, h) * 0.055)
    # 内側フレーム
    d.rectangle([m, m, w - m, h - m], outline=(*accent, 90), width=max(1, int(min(w, h) * 0.006)))

    cx = w / 2
    base = min(w, h)
    f_over = font(SERIF, max(13, int(base * 0.045)))
    f_jp = font(JP, jp_size or max(22, int(base * 0.115)))
    f_en = font(SERIF_B, max(15, int(base * 0.058)))

    block_h = base * 0.46
    top_y = (h - block_h) / 2

    if glyph:
        camera_glyph(d, cx, top_y + base * 0.05, base * 0.16, (*accent, 150))
        cur = top_y + base * 0.05 + base * 0.16
    else:
        cur = top_y

    # オーバーライン
    draw_spaced(d, (cx, cur + base * 0.06), "LA CONCIER", f_over, (*ROSE_DP, 220),
                spacing=max(2, int(base * 0.02)))
    cur += base * 0.06
    # 区切り線
    lw = base * 0.10
    d.line([cx - lw, cur + base * 0.06, cx + lw, cur + base * 0.06], fill=(*accent, 160),
           width=max(1, int(base * 0.006)))
    cur += base * 0.06
    # JP ラベル
    centered(d, cx, cur + base * 0.03, jp, f_jp, BROWN)
    bb = d.textbbox((0, 0), jp, font=f_jp)
    cur += base * 0.03 + (bb[3] - bb[1]) + base * 0.05
    # EN サブ
    draw_spaced(d, (cx, cur + base * 0.03), en, f_en, (*ROSE_DP, 235),
                spacing=max(1, int(base * 0.018)))

    path = os.path.join(OUT, name)
    img.save(path, quality=88)
    print("wrote", os.path.relpath(path), f"{w}x{h}")

def make_logo():
    """透過ロゴ（モノグラム）"""
    w, h = 184, 144
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx = w / 2
    # 円アーチ
    r = 40
    d.arc([cx - r, 18, cx + r, 18 + 2 * r], start=200, end=520, fill=ROSE, width=3)
    # モノグラム LC
    f = font(SERIF_B, 46)
    centered(d, cx, 26, "LC", f, ROSE_DP)
    # 下部レター
    f2 = font(SERIF, 13)
    draw_spaced(d, (cx, 116), "LA CONCIER", f2, ROSE_DP, spacing=3)
    img.save(os.path.join(OUT, "logo.png"))
    print("wrote logo.png (transparent)", f"{w}x{h}")

make_logo()
make("entrance.jpg",       880, 996, "院内",       "ENTRANCE",   top=CREAM_HI, bot=ROSE_SOFT)
make("lounge-a.jpg",       880, 440, "待合スペース", "LOUNGE",     top=CREAM_HI, bot=CREAM_LO)
make("lounge-b.jpg",       880, 440, "カウンセリング","COUNSELING", top=CREAM,    bot=CREAM_LO)
make("director.jpg",       640, 760, "院長 山本",   "DIRECTOR",   top=CREAM_HI, bot=ROSE_SOFT)
make("care-shoulder.jpg",  560, 560, "首肩こりケア", "SHOULDER",   top=CREAM_HI, bot=CREAM_LO)
make("care-back.jpg",      560, 560, "腰痛ケア",    "LOWER BACK", top=CREAM_HI, bot=CREAM_LO)
make("care-bmk.jpg",       880, 560, "骨盤矯正",    "PELVIC CARE",top=CREAM_HI, bot=ROSE_SOFT)
make("care-highvolt.jpg",  560, 560, "電気療法",    "HIGH VOLT",  top=CREAM_HI, bot=CREAM_LO)
make("care-lower-back.jpg",880, 560, "施術",       "TREATMENT",  top=CREAM_HI, bot=CREAM_LO)
print("done")
