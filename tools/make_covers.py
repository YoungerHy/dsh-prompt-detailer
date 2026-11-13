"""Generate the 3:4 and 9:16 covers for dsh-prompt-detailer.

Text is rendered with Pillow (not by an image model) so Chinese stays crisp.
Run: python tools/make_covers.py
"""
from PIL import Image, ImageDraw, ImageFilter, ImageChops, ImageFont
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS = os.path.join(ROOT, "docs")
FONT_DIR = r"C:\Windows\Fonts"
REG = os.path.join(FONT_DIR, "msyh.ttc")
BOLD = os.path.join(FONT_DIR, "msyhbd.ttc")
if not os.path.exists(BOLD):
    BOLD = REG

WHITE = (248, 250, 252)
MUTED = (148, 163, 184)
SOFT = (199, 210, 254)
BLUE = (96, 165, 250)
GOLD = (251, 191, 36)
GREEN = (52, 211, 153)
CARD = (9, 17, 34, 238)
BORDER = (255, 255, 255, 30)


def font(path, size):
    return ImageFont.truetype(path, size)


def gradient(w, h, top, bottom):
    img = Image.new("RGB", (w, h))
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(1, h - 1)
        color = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
        d.line([(0, y), (w, y)], fill=color)
    return img.convert("RGBA")


def add_glow(img, box, color, strength=180, blur=160):
    w, h = img.size
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).ellipse(box, fill=strength)
    mask = mask.filter(ImageFilter.GaussianBlur(blur))
    layer = Image.new("RGB", (w, h), color)
    screened = ImageChops.screen(img.convert("RGB"), layer)
    img.paste(screened, (0, 0), mask)


def add_grid(img, step=54):
    w, h = img.size
    grid = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(grid)
    for x in range(0, w, step):
        d.line([(x, 0), (x, h)], fill=(255, 255, 255, 9))
    for y in range(0, h, step):
        d.line([(0, y), (w, y)], fill=(255, 255, 255, 9))
    return Image.alpha_composite(img, grid)


def star(d, cx, cy, r, fill):
    inner = r * 0.24
    pts = [
        (cx, cy - r), (cx + inner, cy - inner), (cx + r, cy),
        (cx + inner, cy + inner), (cx, cy + r), (cx - inner, cy + inner),
        (cx - r, cy), (cx - inner, cy - inner),
    ]
    d.polygon(pts, fill=fill)


def pill(d, xy, text, f, fg, bg, pad_x=20, pad_y=10):
    x, y = xy
    box = d.textbbox((0, 0), text, font=f)
    w = box[2] - box[0]
    h = box[3] - box[1]
    d.rounded_rectangle([x, y, x + w + pad_x * 2, y + h + pad_y * 2], radius=18, fill=bg)
    d.text((x + pad_x, y + pad_y - 2), text, font=f, fill=fg)
    return w + pad_x * 2, h + pad_y * 2


def card(img, box, radius=28, fill=CARD, outline=BORDER, width=2):
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(layer).rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)
    return Image.alpha_composite(img, layer)


def check(d, x, y, color=GREEN, r=10):
    d.ellipse([x - r, y - r, x + r, y + r], fill=(color[0], color[1], color[2], 38), outline=color, width=2)
    d.line([(x - 4, y), (x - 1, y + 4), (x + 6, y - 5)], fill=color, width=2)


def paste_shot(img, path, x, y, width):
    shot = Image.open(path).convert("RGBA")
    h = int(shot.height * width / shot.width)
    shot = shot.resize((width, h), Image.LANCZOS)
    mask = Image.new("L", shot.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, shot.width, shot.height], radius=16, fill=255)
    img.paste(shot, (x, y), mask)
    return h


def draw_common(img, w, h, layout):
    d = ImageDraw.Draw(img)
    # badge
    pill(d, (56, layout["badge_y"]), "DSH PLUGIN · 开源", font(BOLD, 22), (255, 255, 255),
         (37, 99, 235, 220), pad_x=18, pad_y=9)
    # stars
    sx, sy = layout["star"]
    star(d, sx, sy, 40, (251, 191, 36, 255))
    star(d, sx + 45, sy + 56, 17, (251, 191, 36, 230))

    # headline
    d.text((56, layout["h1_y"]), "别再让 AI", font=font(BOLD, 78), fill=WHITE)
    d.text((56, layout["h2_y"]), "猜需求", font=font(BOLD, 104), fill=GOLD)
    d.text((58, layout["sub_y"]), "一句话，变成能直接执行的详细提示词", font=font(REG, 30), fill=SOFT)

    # before card
    by = layout["before_y"]
    bh = layout["before_h"]
    img = card(img, [56, by, w - 56, by + bh])
    d = ImageDraw.Draw(img)
    d.text((84, by + 20), "你只说了", font=font(REG, 22), fill=MUTED)
    d.text((84, by + 60), "做个记账插件，能记每天花销，", font=font(REG, 28), fill=(226, 232, 240))
    d.text((84, by + 100), "月底能看汇总", font=font(REG, 28), fill=(226, 232, 240))

    # arrow
    ay = layout["arrow_y"]
    d.line([(w // 2, ay), (w // 2, ay + 30)], fill=BLUE, width=4)
    d.polygon([(w // 2 - 9, ay + 26), (w // 2 + 9, ay + 26), (w // 2, ay + 38)], fill=BLUE)
    d.text((w // 2 + 26, ay + 2), "点一下，先写清楚", font=font(REG, 22), fill=BLUE)

    # after card
    cy = layout["after_y"]
    ch = layout["after_h"]
    img = card(img, [56, cy, w - 56, cy + ch], outline=(96, 165, 250, 80))
    d = ImageDraw.Draw(img)
    d.text((84, cy + 20), "插件补全成", font=font(REG, 22), fill=BLUE)
    rows = [
        "目标：本地记账插件，记录每天花销",
        "字段：日期 / 金额 / 分类 / 备注",
        "步骤：新增 → 列表 → 月度汇总",
        "验收：可增删改查，月底自动统计",
    ] + layout.get("extra_rows", [])
    ry = cy + 70
    for row in rows:
        check(d, 96, ry + 11)
        d.text((122, ry), row, font=font(REG, 24), fill=(226, 232, 240))
        ry += layout["row_gap"]
    d.text((84, cy + ch - 38), "不是 PRD，是给 Agent 的任务提示词", font=font(REG, 19), fill=(148, 163, 184))

    # feature line
    d.text((56, layout["feature_y"]), "少返工 · 省 token · 任意 OpenAI 兼容模型", font=font(REG, 26), fill=(147, 197, 253))

    # footer
    d.text((56, layout["name_y"]), "dsh-prompt-detailer", font=font(BOLD, 38), fill=WHITE)
    d.text((56, layout["subname_y"]), "MIT · DSH 插件市场 / npm 搜同名", font=font(REG, 22), fill=MUTED)

    if layout.get("shot"):
        label_y, shot_y = layout["shot"]
        d.text((90, label_y), "真实界面：输入框右侧点一下", font=font(REG, 21), fill=MUTED)
        paste_shot(img, os.path.join(DOCS, "composer.png"), 90, shot_y, w - 180)
    return img


def main_cover(w, h):
    img = gradient(w, h, (6, 10, 22), (12, 26, 54))
    add_glow(img, [w - 520, -260, w + 220, 560], (30, 64, 175), 190, 180)
    add_glow(img, [-320, h - 620, 420, h + 120], (120, 70, 20), 80, 160)
    img = add_grid(img)
    if h > 1600:
        layout = dict(badge_y=70, star=(966, 120), h1_y=160, h2_y=260, sub_y=430,
                      before_y=620, before_h=200, arrow_y=835, after_y=920, after_h=440,
                      row_gap=56, feature_y=1400, name_y=1680, subname_y=1740,
                      shot=(1450, 1480),
                      extra_rows=["输出：一份可直接执行的任务提示词", "边界：本地存储，不采集数据"])
    else:
        layout = dict(badge_y=54, star=(966, 104), h1_y=130, h2_y=230, sub_y=390,
                      before_y=510, before_h=170, arrow_y=695, after_y=750, after_h=330,
                      row_gap=56, feature_y=1120, name_y=1175, subname_y=1225)
    return draw_common(img, w, h, layout)


def alt_cover(w, h=1440):
    img = gradient(w, h, (6, 10, 22), (12, 26, 54))
    add_glow(img, [w - 520, -260, w + 220, 560], (30, 64, 175), 190, 180)
    img = add_grid(img)
    d = ImageDraw.Draw(img)
    pill(d, (56, 54), "DSH PLUGIN · 开源", font(BOLD, 22), (255, 255, 255), (37, 99, 235, 220), 18, 9)
    star(d, 966, 104, 40, (251, 191, 36, 255))
    star(d, 1011, 160, 17, (251, 191, 36, 230))
    d.text((56, 120), "一句话", font=font(BOLD, 96), fill=WHITE)
    d.text((56, 232), "变成", font=font(BOLD, 72), fill=(148, 163, 184))
    d.text((56, 315), "详细提示词", font=font(BOLD, 96), fill=BLUE)
    d.text((58, 470), "把粗需求交给更便宜的模型，让主模型只负责执行", font=font(REG, 27), fill=SOFT)

    by = 530
    img = card(img, [56, by, w - 56, by + 150])
    d = ImageDraw.Draw(img)
    d.text((84, by + 18), "你只说了", font=font(REG, 20), fill=MUTED)
    d.text((84, by + 54), "做个记账插件，能记每天花销，月底看汇总", font=font(REG, 26), fill=(226, 232, 240))

    ay = 690
    d.line([(w // 2, ay), (w // 2, ay + 26)], fill=BLUE, width=4)
    d.polygon([(w // 2 - 9, ay + 22), (w // 2 + 9, ay + 22), (w // 2, ay + 34)], fill=BLUE)
    d.text((w // 2 + 26, ay), "插件补全", font=font(REG, 21), fill=BLUE)

    cy = 740
    ch = 320
    img = card(img, [56, cy, w - 56, cy + ch], outline=(96, 165, 250, 80))
    d = ImageDraw.Draw(img)
    d.text((84, cy + 18), "插件补全成", font=font(REG, 21), fill=BLUE)
    rows = ["目标：本地记账插件，记录每天花销", "字段：日期 / 金额 / 分类 / 备注",
            "步骤：新增 → 列表 → 月度汇总", "验收：可增删改查，月底自动统计"]
    ry = cy + 64
    for row in rows:
        check(d, 96, ry + 10)
        d.text((122, ry), row, font=font(REG, 23), fill=(226, 232, 240))
        ry += 54
    d.text((84, cy + ch - 34), "不是 PRD，是给 Agent 的任务提示词", font=font(REG, 18), fill=MUTED)
    d.text((56, 1090), "少返工 · 省 token · 任意 OpenAI 兼容模型", font=font(REG, 25), fill=(147, 197, 253))
    d.text((56, 1145), "dsh-prompt-detailer", font=font(BOLD, 38), fill=WHITE)
    d.text((56, 1195), "MIT · DSH 插件市场 / npm 搜同名", font=font(REG, 22), fill=MUTED)
    return img


if __name__ == "__main__":
    os.makedirs(DOCS, exist_ok=True)
    main_cover(1080, 1440).convert("RGB").save(os.path.join(DOCS, "cover-3x4.png"), quality=95)
    main_cover(1080, 1920).convert("RGB").save(os.path.join(DOCS, "cover-9x16.png"), quality=95)
    alt_cover(1080, 1440).convert("RGB").save(os.path.join(DOCS, "cover-alt-3x4.png"), quality=95)
    print("saved cover-3x4.png, cover-9x16.png, cover-alt-3x4.png")
