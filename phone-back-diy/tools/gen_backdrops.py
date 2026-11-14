#!/usr/bin/env python3
"""生成治愈 / 可爱风格的满版手机背膜壁纸。

输出：assets/stickers/wp-*.webp（640x1137，竖版 9:16）
用法：python3 tools/gen_backdrops.py [name ...]
"""
import math
import os
import random
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

W, H = 640, 1137
S = 2  # 超采样倍率，保证边缘平滑
OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "stickers")


def hex2rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def gradient(stops):
    """stops: [(pos, "#RRGGBB"), ...] 竖直方向的柔和渐变。"""
    hh = H * S
    ys = np.linspace(0.0, 1.0, hh)
    stops = sorted(stops, key=lambda s: s[0])
    out = np.zeros((hh, 3), dtype=np.float32)
    for i in range(len(stops) - 1):
        p0, c0 = stops[i]
        p1, c1 = stops[i + 1]
        c0 = np.array(hex2rgb(c0), dtype=np.float32)
        c1 = np.array(hex2rgb(c1), dtype=np.float32)
        m = (ys >= p0) & (ys <= p1)
        t = (ys[m] - p0) / max(1e-6, p1 - p0)
        t = t * t * (3 - 2 * t)  # smoothstep
        out[m] = c0 + (c1 - c0) * t[:, None]
    out[ys < stops[0][0]] = hex2rgb(stops[0][1])
    out[ys > stops[-1][0]] = hex2rgb(stops[-1][1])
    return out.reshape(hh, 1, 3).repeat(W * S, axis=1)


def add_glow(arr, cx, cy, r, color, alpha):
    """径向软光晕，screen 混合，用来做通透的空气感。"""
    hh, ww = arr.shape[:2]
    yy, xx = np.mgrid[0:hh, 0:ww].astype(np.float32)
    d = np.sqrt(((xx - cx * ww) ** 2) + ((yy - cy * hh) ** 2))
    f = np.clip(1.0 - d / (r * ww), 0.0, 1.0)
    f = f * f * (3 - 2 * f)
    c = np.array(hex2rgb(color), dtype=np.float32)
    a = (f * alpha)[:, :, None]
    src = arr * (1 - a) + c * a
    return src


def finish(arr, grain=1.6):
    img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB")
    img = img.resize((W, H), Image.LANCZOS)
    if grain > 0:
        a = np.asarray(img, dtype=np.float32)
        n = np.random.normal(0, grain, (H, W, 1)).astype(np.float32)
        a = a + n
        # 轻微柔化，避免噪点感
        img = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGB").filter(
            ImageFilter.GaussianBlur(0.4)
        )
    return img


def layer():
    return Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0))


def flat(img, color, alpha):
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, img.width, img.height], fill=hex2rgb(color) + (int(255 * alpha),))


def compose(base, lay, blur=0.0):
    if blur:
        lay = lay.filter(ImageFilter.GaussianBlur(blur * S))
    b = Image.fromarray(np.clip(base, 0, 255).astype(np.uint8), "RGB").convert("RGBA")
    b.alpha_composite(lay)
    return np.asarray(b.convert("RGB"), dtype=np.float32)


def dots(color, alpha, step, rad, jitter=0.0):
    lay = layer()
    d = ImageDraw.Draw(lay)
    rows = int(H * S / step) + 2
    cols = int(W * S / step) + 2
    for r in range(rows):
        for c in range(cols):
            cx = c * step + (step / 2 if r % 2 else 0)
            cy = r * step
            if jitter:
                cx += random.uniform(-jitter, jitter)
                cy += random.uniform(-jitter, jitter)
            d.ellipse([cx - rad, cy - rad, cx + rad, cy + rad],
                      fill=hex2rgb(color) + (int(255 * alpha),))
    return lay


def gingham(color, alpha, step, width):
    lay = layer()
    d = ImageDraw.Draw(lay)
    w = int(255 * alpha)
    x = -step
    while x < W * S + step:
        d.rectangle([x, 0, x + width, H * S], fill=hex2rgb(color) + (w,))
        x += step
    y = -step
    while y < H * S + step:
        d.rectangle([0, y, W * S, y + width], fill=hex2rgb(color) + (w,))
        y += step
    return lay


def waves(color, alpha, count, amp, thick):
    lay = layer()
    d = ImageDraw.Draw(lay)
    w = int(255 * alpha)
    for i in range(count):
        base_y = H * S * (i + 0.5) / count
        pts = []
        for px in range(0, W * S + 12, 12):
            t = px / (W * S)
            pts.append((px, base_y + math.sin(t * math.pi * 2.2 + i * 1.7) * amp * S))
        d.line(pts, fill=hex2rgb(color) + (w,), width=int(thick * S), joint="curve")
    return lay


def hearts(color, alpha, count, size):
    lay = layer()
    d = ImageDraw.Draw(lay)
    w = int(255 * alpha)
    for _ in range(count):
        cx = random.uniform(20, W - 20) * S
        cy = random.uniform(20, H - 20) * S
        s = size * S * random.uniform(0.65, 1.35)
        rot = random.uniform(-25, 25)
        pts = []
        for k in range(60):
            a = 2 * math.pi * k / 60
            # 经典心形参数方程
            hx = 16 * math.sin(a) ** 3
            hy = 13 * math.cos(a) - 5 * math.cos(2 * a) - 2 * math.cos(3 * a) - math.cos(4 * a)
            hx *= s / 16.0
            hy *= s / 16.0
            ra = math.radians(rot)
            pts.append((cx + hx * math.cos(ra) - hy * math.sin(ra),
                        cy + hx * math.sin(ra) + hy * math.cos(ra)))
        d.polygon(pts, fill=hex2rgb(color) + (w,))
    return lay


def sparkles(color, alpha, count, smin, smax):
    lay = layer()
    d = ImageDraw.Draw(lay)
    w = int(255 * alpha)
    for _ in range(count):
        cx = random.uniform(0, W) * S
        cy = random.uniform(0, H) * S
        s = random.uniform(smin, smax) * S
        t = s * 0.18
        d.polygon([(cx, cy - s), (cx + t, cy - t), (cx + s, cy), (cx + t, cy + t),
                   (cx, cy + s), (cx - t, cy + t), (cx - s, cy), (cx - t, cy - t)],
                  fill=hex2rgb(color) + (w,))
    return lay


def bubbles(color, alpha, count, rmin, rmax):
    lay = layer()
    d = ImageDraw.Draw(lay)
    w = int(255 * alpha)
    for _ in range(count):
        cx = random.uniform(0, W) * S
        cy = random.uniform(0, H) * S
        r = random.uniform(rmin, rmax) * S
        if random.random() < 0.55:
            d.ellipse([cx - r, cy - r, cx + r, cy + r],
                      outline=hex2rgb(color) + (w,), width=max(1, int(1.6 * S)))
        else:
            d.ellipse([cx - r, cy - r, cx + r, cy + r],
                      fill=hex2rgb(color) + (int(w * 0.55),))
    return lay


def clouds(color, alpha, count):
    lay = layer()
    d = ImageDraw.Draw(lay)
    w = int(255 * alpha)
    for _ in range(count):
        cx = random.uniform(0.12, 0.88) * W * S
        cy = random.uniform(0.1, 0.9) * H * S
        bw = random.uniform(0.13, 0.24) * W * S
        for k in range(5):
            ox = random.uniform(-bw * 0.55, bw * 0.55)
            oy = random.uniform(-bw * 0.2, bw * 0.2)
            r = bw * random.uniform(0.32, 0.55)
            d.ellipse([cx + ox - r, cy + oy - r, cx + ox + r, cy + oy + r],
                      fill=hex2rgb(color) + (w,))
    return lay


def blobs(arr, layers):
    """柔和奶油色块，screen 后压一点对比，避免死板。"""
    lay = layer()
    d = ImageDraw.Draw(lay)
    for (cx, cy, rx, ry, color, alpha) in layers:
        d.ellipse([(cx - rx) * W * S, (cy - ry) * H * S,
                   (cx + rx) * W * S, (cy + ry) * H * S],
                  fill=hex2rgb(color) + (int(255 * alpha),))
    return compose(arr, lay, blur=0.05)


# ----------------------------------------------------------------------------
# 每个背景一个函数，返回 PIL.Image
# ----------------------------------------------------------------------------
def bg_milk():
    a = gradient([(0, "#FFFDF9"), (0.45, "#FFF6E9"), (1, "#FFE7CC")])
    a = add_glow(a, 0.24, 0.16, 0.9, "#FFFFFF", 0.5)
    a = add_glow(a, 0.82, 0.78, 1.0, "#FFD9C2", 0.35)
    a = blobs(a, [(0.2, 0.55, 0.34, 0.19, "#FFF9EE", 0.35),
                  (0.85, 0.35, 0.28, 0.16, "#FFF1DC", 0.3)])
    return finish(a)


def bg_strawberry():
    a = gradient([(0, "#FFF7F9"), (0.4, "#FFE4EE"), (1, "#FFC8DA")])
    a = add_glow(a, 0.7, 0.2, 0.9, "#FFFFFF", 0.45)
    a = add_glow(a, 0.25, 0.84, 0.8, "#FFB3CC", 0.3)
    random.seed(11)
    a = compose(a, dots("#FFFFFF", 0.42, 26 * S, 2.4 * S))
    return finish(a)


def bg_cloudy():
    a = gradient([(0, "#F2FAFF"), (0.45, "#DCEFFF"), (1, "#C6E4FF")])
    a = add_glow(a, 0.5, 0.12, 1.0, "#FFFFFF", 0.55)
    random.seed(22)
    a = compose(a, clouds("#FFFFFF", 0.55, 9), blur=0.014)
    return finish(a, grain=1.2)


def bg_peach():
    a = gradient([(0, "#FFF6EE"), (0.42, "#FFE1CE"), (1, "#FFC7AF")])
    a = add_glow(a, 0.5, 0.62, 1.0, "#FFF3E4", 0.45)
    a = add_glow(a, 0.18, 0.24, 0.8, "#FFFFFF", 0.4)
    random.seed(33)
    a = compose(a, sparkles("#FFFFFF", 0.4, 26, 3.0, 9.0), blur=0.004)
    return finish(a)


def bg_matcha():
    a = gradient([(0, "#FCFCF3"), (0.45, "#EBF1DA"), (1, "#D9E8C6")])
    a = add_glow(a, 0.3, 0.18, 0.9, "#FFFFFF", 0.45)
    a = add_glow(a, 0.78, 0.85, 0.9, "#C9DDB2", 0.3)
    random.seed(44)
    a = compose(a, gingham("#FFFFFF", 0.26, 24 * S, 10 * S), blur=0.006)
    return finish(a, grain=1.3)


def bg_lemon():
    a = gradient([(0, "#FFFEF2"), (0.4, "#FFF8C8"), (1, "#FFEE9E")])
    a = add_glow(a, 0.35, 0.2, 0.9, "#FFFFFF", 0.5)
    a = add_glow(a, 0.75, 0.8, 0.9, "#FFE07A", 0.28)
    random.seed(55)
    a = compose(a, bubbles("#FFFFFF", 0.5, 34, 4.0, 15.0))
    return finish(a)


def bg_lilac():
    a = gradient([(0, "#F9F4FF"), (0.4, "#EBDFFF"), (1, "#D8C6FF")])
    a = add_glow(a, 0.28, 0.2, 0.95, "#FFFFFF", 0.45)
    a = add_glow(a, 0.8, 0.82, 0.9, "#C7AEFF", 0.3)
    random.seed(66)
    a = compose(a, sparkles("#FFFFFF", 0.45, 40, 2.0, 6.0), blur=0.004)
    a = compose(a, dots("#FFFFFF", 0.22, 40 * S, 1.8 * S))
    return finish(a)


def bg_butterheart():
    a = gradient([(0, "#FFFDF6"), (0.45, "#FFF3DE"), (1, "#FFE4C0")])
    a = add_glow(a, 0.25, 0.18, 0.9, "#FFFFFF", 0.5)
    a = add_glow(a, 0.8, 0.8, 0.9, "#FFD9AE", 0.28)
    random.seed(77)
    a = compose(a, hearts("#FFFFFF", 0.42, 16, 7.0))
    a = compose(a, hearts("#FFCFA8", 0.22, 10, 5.0))
    return finish(a)


def bg_mint():
    a = gradient([(0, "#F4FDFA"), (0.42, "#D8F5EA"), (1, "#BFEDDE")])
    a = add_glow(a, 0.6, 0.15, 0.9, "#FFFFFF", 0.5)
    random.seed(88)
    a = compose(a, waves("#FFFFFF", 0.3, 9, 12.0, 9.0), blur=0.006)
    return finish(a, grain=1.3)


def bg_caramel():
    a = gradient([(0, "#FFF8EE"), (0.45, "#F8E1C6"), (1, "#EAC29A")])
    a = add_glow(a, 0.3, 0.26, 1.0, "#FFFFFF", 0.55)
    a = add_glow(a, 0.6, 0.9, 0.9, "#D9A87C", 0.25)
    a = blobs(a, [(0.28, 0.3, 0.42, 0.22, "#FFF3DF", 0.3)])
    random.seed(99)
    a = compose(a, dots("#FFFFFF", 0.16, 34 * S, 1.4 * S, jitter=2.0))
    return finish(a)


GEN = {
    "wp-milk": bg_milk,
    "wp-strawberry": bg_strawberry,
    "wp-cloudy": bg_cloudy,
    "wp-peach": bg_peach,
    "wp-matcha": bg_matcha,
    "wp-lemon": bg_lemon,
    "wp-lilac": bg_lilac,
    "wp-butterheart": bg_butterheart,
    "wp-mint": bg_mint,
    "wp-caramel": bg_caramel,
}


def save(name, img):
    path = os.path.join(OUT_DIR, name + ".webp")
    q = 80
    img.save(path, "WEBP", quality=q, method=6)
    while os.path.getsize(path) > 260 * 1024 and q > 58:
        q -= 6
        img.save(path, "WEBP", quality=q, method=6)
    print(f"{name}.webp  {os.path.getsize(path)/1024:.0f} KB  q={q}")


if __name__ == "__main__":
    names = sys.argv[1:] or list(GEN)
    os.makedirs(OUT_DIR, exist_ok=True)
    for n in names:
        save(n, GEN[n]())
