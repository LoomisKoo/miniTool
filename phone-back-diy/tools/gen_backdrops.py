#!/usr/bin/env python3
"""生成治愈 / 可爱风格的满版手机背膜壁纸（插画式，非纯色渐变）。

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
S = 2  # 超采样倍率
OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "stickers")
TAU = math.pi * 2


# ---------------------------------------------------------------- 基础工具
def hex2rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def gradient(stops):
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
        t = t * t * (3 - 2 * t)
        out[m] = c0 + (c1 - c0) * t[:, None]
    out[ys < stops[0][0]] = hex2rgb(stops[0][1])
    out[ys > stops[-1][0]] = hex2rgb(stops[-1][1])
    return out.reshape(hh, 1, 3).repeat(W * S, axis=1)


def glow(arr, cx, cy, r, color, alpha):
    hh, ww = arr.shape[:2]
    yy, xx = np.mgrid[0:hh, 0:ww].astype(np.float32)
    d = np.sqrt(((xx - cx * ww) ** 2) + ((yy - cy * hh) ** 2))
    f = np.clip(1.0 - d / (r * ww), 0.0, 1.0)
    f = f * f * (3 - 2 * f)
    c = np.array(hex2rgb(color), dtype=np.float32)
    a = (f * alpha)[:, :, None]
    return arr * (1 - a) + c * a


def canvas():
    return Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0))


def blend(base, lay, blur=0.0):
    if blur:
        lay = lay.filter(ImageFilter.GaussianBlur(blur * S))
    b = Image.fromarray(np.clip(base, 0, 255).astype(np.uint8), "RGB").convert("RGBA")
    b.alpha_composite(lay)
    return np.asarray(b.convert("RGB"), dtype=np.float32)


def finish(arr, grain=1.4, vignette=0.0):
    img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB")
    img = img.resize((W, H), Image.LANCZOS)
    a = np.asarray(img, dtype=np.float32)
    if vignette:
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        d = np.sqrt(((xx - W / 2) / (W * .72)) ** 2 + ((yy - H / 2) / (H * .72)) ** 2)
        a *= (1 - np.clip(d - .55, 0, 1) * vignette)[:, :, None]
    if grain:
        a = a + np.random.normal(0, grain, (H, W, 1)).astype(np.float32)
    img = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGB")
    return img.filter(ImageFilter.GaussianBlur(0.4))


def stamp(base, im, cx, cy, angle=0.0, scale=1.0):
    if scale != 1.0:
        im = im.resize((max(1, int(im.width * scale)), max(1, int(im.height * scale))), Image.LANCZOS)
    if angle:
        im = im.rotate(angle, resample=Image.BICUBIC, expand=True)
    base.paste(im, (int(cx - im.width / 2), int(cy - im.height / 2)), im)


# ---------------------------------------------------------------- 天空元素
def hill(base_y, amp, freq, phase, color, alpha=255, w=W * S, h=H * S, step=5):
    lay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    pts = [(0, h)]
    x = 0
    while x <= w:
        y = base_y + math.sin(x / w * freq * TAU + phase) * amp \
            + math.sin(x / w * freq * 2.4 * TAU + phase * 1.9) * amp * .34
        pts.append((x, y))
        x += step
    pts += [(w, h)]
    d.polygon(pts, fill=color + (alpha,))
    return lay


def cloud_asset(color, shade, w=560, h=300, seed=1, rim=.5):
    """扁平插画风云朵：柔边纯色 + 底部淡阴影，像手绘绘本。"""
    rnd = random.Random(seed)
    mask = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(mask)
    n = 7
    puffs = []
    for i in range(n):
        t = i / (n - 1)
        r = h * (.20 + .17 * math.sin(t * math.pi) ** .75 + rnd.uniform(-.02, .02))
        px = w * (.13 + .74 * t)
        py = h * (.52 - .05 * math.sin(t * math.pi))
        puffs.append((px, py, r))
        d.ellipse([px - r, py - r, px + r, py + r], fill=255)
    d.rounded_rectangle([w * .14, h * .52, w * .86, h * .80], radius=h * .14, fill=255)
    d.ellipse([w * .2, h * .44, w * .55, h * .8], fill=255)
    d.ellipse([w * .46, h * .42, w * .84, h * .8], fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(w * .012))

    out = Image.new("RGBA", (w, h), hex2rgb(color) + (255,))
    out.putalpha(mask)

    # 底部淡阴影：只在云体下缘
    m = np.asarray(mask, np.float32)
    up = np.roll(m, -int(h * .10), axis=0)
    low = np.clip(up - m, 0, 255) * .0 + np.clip(m - np.roll(m, -int(h * .06), axis=0), 0, 255)
    band = np.zeros_like(m)
    yy = np.arange(h, dtype=np.float32)[:, None]
    band = np.clip((yy - h * .52) / (h * .3), 0, 1) * m
    band = np.asarray(Image.fromarray(band.astype(np.uint8), "L").filter(ImageFilter.GaussianBlur(h * .05)), np.float32)
    sh = Image.new("RGBA", (w, h), hex2rgb(shade) + (255,))
    sh.putalpha(Image.fromarray((band * .55).astype(np.uint8), "L"))
    out.alpha_composite(sh)

    pad = int(h * .16)
    tmp = Image.new("L", (w, h + pad), 0)
    tmp.paste(Image.fromarray(np.clip(m * .22, 0, 255).astype(np.uint8), "L"), (0, pad + int(h * .05)))
    tmp = tmp.filter(ImageFilter.GaussianBlur(h * .06))
    shadow = Image.new("RGBA", (w, h + pad), hex2rgb(shade) + (255,))
    shadow.putalpha(tmp)
    full = Image.new("RGBA", (w, h + pad), (0, 0, 0, 0))
    full.alpha_composite(shadow)
    full.alpha_composite(out, (0, pad))
    return full


def sun(layer, cx, cy, r, inner="#FFF6DC", outer="#FFE0A8", halo="#FFFFFF", halo_a=.5, rays=0):
    d = ImageDraw.Draw(layer)
    if rays:
        for i in range(rays):
            a = TAU * i / rays
            d.line([(cx + math.cos(a) * r * 1.25, cy + math.sin(a) * r * 1.25),
                    (cx + math.cos(a) * r * 1.85, cy + math.sin(a) * r * 1.85)],
                   fill=hex2rgb(inner) + (60,), width=int(r * .09))
    d.ellipse([cx - r * 1.75, cy - r * 1.75, cx + r * 1.75, cy + r * 1.75], fill=hex2rgb(halo) + (int(255 * halo_a * .16),))
    d.ellipse([cx - r * 1.28, cy - r * 1.28, cx + r * 1.28, cy + r * 1.28], fill=hex2rgb(halo) + (int(255 * halo_a * .28),))
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=hex2rgb(outer) + (255,))
    d.ellipse([cx - r * .78, cy - r * .78, cx + r * .78, cy + r * .78], fill=hex2rgb(inner) + (255,))


def stars(layer, count, seed=1, ymax=.72, smin=.9, smax=2.6, color="#FFFFFF", alpha=.85):
    rnd = random.Random(seed)
    d = ImageDraw.Draw(layer)
    for i in range(count):
        x = rnd.uniform(0, W * S)
        y = rnd.uniform(0, H * S * ymax)
        r = rnd.uniform(smin, smax) * S
        a = int(255 * alpha * rnd.uniform(.35, 1))
        d.ellipse([x - r, y - r, x + r, y + r], fill=hex2rgb(color) + (a,))
        if rnd.random() < .12:
            L = r * rnd.uniform(3.5, 6)
            d.line([(x - L, y), (x + L, y)], fill=hex2rgb(color) + (int(a * .55),), width=max(1, int(.7 * S)))
            d.line([(x, y - L), (x, y + L)], fill=hex2rgb(color) + (int(a * .55),), width=max(1, int(.7 * S)))


def crescent(size, color="#FFF7DA", alpha=255):
    m = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(m)
    d.ellipse([0, 0, size - 1, size - 1], fill=255)
    d.ellipse([size * .3, -size * .16, size * 1.3, size * .84], fill=0)
    im = Image.new("RGBA", (size, size), hex2rgb(color) + (alpha,))
    im.putalpha(m)
    return im


def birds(layer, cx, cy, size, color="#5B4A5E", n=3, flip=False):
    d = ImageDraw.Draw(layer)
    for i in range(n):
        x = cx + (i - (n - 1) / 2) * size * 1.5
        y = cy + math.sin(i * 1.7) * size * .3
        s = size * (.7 + .3 * ((i * 37) % 5) / 4)
        w = -1 if flip else 1
        d.arc([x - s, y - s, x, y + s], 200, 340, fill=hex2rgb(color) + (200,), width=max(1, int(.9 * S)))
        d.arc([x, y - s, x + s, y + s], 200, 340, fill=hex2rgb(color) + (200,), width=max(1, int(.9 * S)))


def wave_band(y0, amp, freq, phase, color, alpha, thick, step=4):
    lay = Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    pts = []
    x = 0
    while x <= W * S:
        y = y0 + math.sin(x / (W * S) * freq * TAU + phase) * amp \
            + math.sin(x / (W * S) * freq * 2.7 * TAU + phase * 1.3) * amp * .35
        pts.append((x, y))
        x += step
    d.line(pts, fill=color + (alpha,), width=int(thick), joint="curve")
    return lay


# ---------------------------------------------------------------- 图案素材
def motif_strawberry(size, body="#E75E77", leaf="#78AE5C", seed="#FFE9C9"):
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    cx, cy = size * .5, size * .58
    bw, bh = size * .34, size * .40
    pts = []
    for k in range(48):
        t = k / 47
        a = math.pi * (t - .5)
        x = cx + math.sin(a) * bw * (1 - .30 * (1 - math.cos(a)))
        y = cy - bh * .55 + (bh * 1.1) * (1 - (math.sin(a) + 1) / 2) ** 1.15
        pts.append((x, y))
    d.polygon(pts, fill=hex2rgb(body) + (255,))
    d.ellipse([cx - bw * .92, cy - bh * .95, cx + bw * .92, cy - bh * .05], fill=hex2rgb(body) + (255,))
    # 光泽
    d.ellipse([cx - bw * .62, cy - bh * .74, cx - bw * .02, cy - bh * .24], fill=(255, 255, 255, 46))
    # 籽
    for r in range(4):
        for c in range(-2, 3):
            if abs(c) + r > 3:
                continue
            sx = cx + c * bw * .42 + (0 if r % 2 else bw * .2)
            sy = cy - bh * .40 + r * bh * .30
            d.ellipse([sx - size * .014, sy - size * .022, sx + size * .014, sy + size * .022],
                      fill=hex2rgb(seed) + (235,))
    # 叶
    for a in (-58, -24, 8, 40, 66):
        rad = math.radians(a - 90)
        L = size * .155
        tip = (cx + math.cos(rad) * L, cy - bh * .86 + math.sin(rad) * L)
        d.polygon([(cx - size * .045, cy - bh * .92), (cx + size * .045, cy - bh * .92), tip],
                  fill=hex2rgb(leaf) + (255,))
    d.line([(cx, cy - bh * .90), (cx, cy - bh * 1.10)], fill=hex2rgb(leaf) + (255,),
           width=max(1, int(size * .022)))
    return im


def motif_lemon(size, rind="#F3D468", flesh="#FFEFA6", skin="#FFD44F"):
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    r = size * .38
    c = size * .5
    d.ellipse([c - r, c - r, c + r, c + r], fill=hex2rgb(skin) + (255,))
    d.ellipse([c - r * .86, c - r * .86, c + r * .86, c + r * .86], fill=hex2rgb(flesh) + (255,))
    for k in range(8):
        a0 = k * 45 + 4
        a1 = a0 + 37
        d.pieslice([c - r * .74, c - r * .74, c + r * .74, c + r * .74], a0, a1, fill=hex2rgb(rind) + (255,))
    d.ellipse([c - r * .1, c - r * .1, c + r * .1, c + r * .1], fill=hex2rgb(flesh) + (255,))
    return im


def motif_heart(size, color="#F2A0B4", hi="#FFD3DE"):
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    c = size * .5
    pts = []
    for k in range(72):
        a = TAU * k / 72
        hx = 16 * math.sin(a) ** 3
        hy = 13 * math.cos(a) - 5 * math.cos(2 * a) - 2 * math.cos(3 * a) - math.cos(4 * a)
        pts.append((c + hx * size / 42, c - hy * size / 42))
    d.polygon(pts, fill=hex2rgb(color) + (255,))
    d.ellipse([c - size * .17, c - size * .2, c - size * .02, c - size * .05], fill=hex2rgb(hi) + (170,))
    return im


def motif_leaf(size, color="#7FBE74", vein="#A8D79E"):
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    c = size * .5
    pts = []
    for k in range(40):
        t = k / 39
        y = c - size * .32 + size * .64 * t
        hw = size * .16 * math.sin(t * math.pi) ** .8
        pts.append((c - hw, y))
    for k in range(40):
        t = 1 - k / 39
        y = c - size * .32 + size * .64 * t
        hw = size * .16 * math.sin(t * math.pi) ** .8
        pts.append((c + hw, y))
    d.polygon(pts, fill=hex2rgb(color) + (255,))
    d.line([(c, c - size * .3), (c, c + size * .3)], fill=hex2rgb(vein) + (220,), width=max(1, int(size * .016)))
    return im


def motif_petal(size, color="#F7B6C8"):
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    c = size * .5
    for a in (0, 72, 144, 216, 288):
        rad = math.radians(a)
        px, py = c + math.cos(rad) * size * .18, c + math.sin(rad) * size * .18
        d.ellipse([px - size * .16, py - size * .13, px + size * .16, py + size * .13],
                  fill=hex2rgb(color) + (245,))
    d.ellipse([c - size * .08, c - size * .08, c + size * .08, c + size * .08],
              fill=(255, 236, 176, 255))
    return im


def motif_pine(size, color="#5F7F72", dark=None):
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    c = size * .5
    dark = dark or color
    layers = [(-.46, .17, -.10), (-.30, .235, .08), (-.12, .30, .28), (.06, .355, .46)]
    for i, (top, half, base) in enumerate(layers):
        col = hex2rgb(color if i < 3 else dark)
        d.polygon([(c, c + size * top), (c - size * half, c + size * base),
                   (c + size * half, c + size * base)], fill=col + (255,))
    return im
def scatter(base, motif, step, jitter, ang, sizes, seed=1, offset=(0, 0)):
    rnd = random.Random(seed)
    w, h = base.size
    y = offset[1] % step - step
    row = 0
    while y < h + step:
        x = (offset[0] + (step * .5 if row % 2 else 0)) % step - step
        while x < w + step:
            s = rnd.uniform(*sizes) * S
            m = motif if isinstance(motif, Image.Image) else motif(int(step * s))
            stamp(base, m, x + rnd.uniform(-jitter, jitter) * S, y + rnd.uniform(-jitter, jitter) * S,
                  ang + rnd.uniform(-6, 6), s)
            x += step
        y += step * .86
        row += 1


def motif_bean(size, color="#7C4A28", line="#9A6238"):
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    c = size * .5
    d.ellipse([c - size * .30, c - size * .22, c + size * .30, c + size * .22], fill=hex2rgb(color) + (255,))
    d.arc([c - size * .30, c - size * .22, c + size * .30, c + size * .22], 74, 286,
          fill=hex2rgb(line) + (235,), width=max(1, int(size * .035)))
    d.ellipse([c - size * .2, c - size * .15, c - size * .02, c - size * .03], fill=(255, 255, 255, 40))
    return im


def motif_lemon_whole(size, skin="#FFD84D", hi="#FFF0A6", leaf="#7FBE74"):
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    c = size * .54
    r = size * .32
    d.ellipse([c - r * .88, c - r, c + r * .88, c + r], fill=hex2rgb(skin) + (255,))
    d.ellipse([c - r * 1.04, c - r * .64, c + r * 1.04, c + r * .64], fill=hex2rgb(skin) + (255,))
    # 两端凸头
    d.polygon([(c - r * .12, c - r * 1.08), (c + r * .12, c - r * 1.08), (c, c - r * 1.30)],
              fill=hex2rgb(skin) + (255,))
    d.polygon([(c - r * .12, c + r * 1.08), (c + r * .12, c + r * 1.08), (c, c + r * 1.30)],
              fill=hex2rgb(skin) + (255,))
    d.ellipse([c - r * .66, c - r * .82, c - r * .1, c - r * .28], fill=hex2rgb(hi) + (160,))
    # 叶子
    d.ellipse([c + r * .18, c - r * 1.34, c + r * .95, c - r * .86], fill=hex2rgb(leaf) + (245,))
    d.line([(c + r * .2, c - r * 1.06), (c + r * .9, c - r * 1.1)],
           fill=(255, 255, 255, 90), width=max(1, int(size * .012)))
    return im
def motif_cow(size, color="#6B5444"):
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    c = size * .5
    rnd = random.Random(int(size) + 7)
    for _ in range(5):
        r = size * rnd.uniform(.13, .24)
        px = c + rnd.uniform(-size * .2, size * .2)
        py = c + rnd.uniform(-size * .2, size * .2)
        d.ellipse([px - r, py - r * .86, px + r, py + r * .86], fill=hex2rgb(color) + (255,))
    return im


def lily_pad(R, color, edge):
    sz = int(R * 2.2)
    im = Image.new("RGBA", (sz, sz), (0, 0, 0, 0))
    mask = Image.new("L", (sz, sz), 0)
    d = ImageDraw.Draw(mask)
    c = sz / 2
    d.ellipse([c - R, c - R * .88, c + R, c + R * .88], fill=255)
    d.pieslice([c - R, c - R * .88, c + R, c + R * .88], -13, 13, fill=0)
    mask = mask.filter(ImageFilter.GaussianBlur(R * .008))
    im = Image.new("RGBA", (sz, sz), hex2rgb(color) + (250,))
    im.putalpha(mask)
    d = ImageDraw.Draw(im)
    d.arc([c - R * .9, c - R * .79, c + R * .9, c + R * .79], 10, 350,
          fill=hex2rgb(edge) + (120,), width=max(1, int(R * .06)))
    # 叶脉
    for a in (58, 122, 238, 302):
        rad = math.radians(a)
        d.line([(c + math.cos(rad) * R * .16, c + math.sin(rad) * R * .14),
                (c + math.cos(rad) * R * .78, c + math.sin(rad) * R * .68)],
               fill=hex2rgb(edge) + (70,), width=max(1, int(R * .022)))
    return im


def cloud_sea(y, color, shade, seed=1, n=9, rmin=.18, rmax=.34, spread=1.15):
    """底部云海：沿画面下方堆一排圆，形成连绵云带。"""
    rnd = random.Random(seed)
    w, h = W * S, H * S
    mask = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(mask)
    for i in range(n):
        t = i / (n - 1)
        r = w * rnd.uniform(rmin, rmax) * (.85 + .3 * math.sin(t * math.pi))
        px = w * (-.05 + spread * t) + rnd.uniform(-w * .03, w * .03)
        py = y + rnd.uniform(-h * .025, h * .03)
        d.ellipse([px - r, py - r, px + r, py + r], fill=255)
    d.rectangle([0, y + h * .02, w, h], fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(w * .012))
    out = Image.new("RGBA", (w, h), hex2rgb(color) + (255,))
    out.putalpha(mask)
    m = np.asarray(mask, np.float32)
    yy = np.arange(h, dtype=np.float32)[:, None]
    band = np.clip(1 - (yy - (y - h * .02)) / (h * .16), 0, 1) * m
    band = np.asarray(Image.fromarray((band * .35 * 255).astype(np.uint8), "L")
                      .filter(ImageFilter.GaussianBlur(h * .02)), np.float32) / 255.0
    sh = Image.new("RGBA", (w, h), hex2rgb(shade) + (255,))
    sh.putalpha(Image.fromarray((band * 255).astype(np.uint8), "L"))
    out.alpha_composite(sh)
    return out


def sea_wave(y0, amp, freq, phase, color, crest_alpha=150, crest_w=3.0):
    """海面：用 numpy 生成波形遮罩，避免 ImageDraw 的锯齿与伪影。"""
    ww, hh = W * S, H * S
    xs = np.arange(ww, dtype=np.float32)
    ys = (y0 + np.sin(xs / ww * freq * TAU + phase) * amp
          + np.sin(xs / ww * freq * 2.3 * TAU + phase * 1.6) * amp * .3)
    yy = np.arange(hh, dtype=np.float32)[:, None]
    mask = (yy >= ys[None, :]).astype(np.uint8) * 255
    layer = Image.new("RGBA", (ww, hh), color + (255,))
    layer.putalpha(Image.fromarray(mask, "L").filter(ImageFilter.GaussianBlur(.8)))
    crest = ((yy >= ys[None, :]) & (yy < ys[None, :] + crest_w * S)).astype(np.uint8) * crest_alpha
    band = Image.new("RGBA", (ww, hh), (255, 255, 255, 255))
    band.putalpha(Image.fromarray(crest, "L").filter(ImageFilter.GaussianBlur(1.1)))
    layer.alpha_composite(band)
    return layer

def aurora_curtain(base_x, width, color, alpha, amp, phase, blur):
    lay = canvas()
    d = ImageDraw.Draw(lay)
    top, bot = [], []
    y0, y1 = int(H * S * .03), int(H * S * .66)
    y = y0
    while y <= y1:
        t = y / (H * S)
        off = math.sin(t * TAU * 1.05 + phase) * amp * W * S \
            + math.sin(t * TAU * 2.7 + phase * 1.7) * amp * W * S * .32
        top.append((base_x * W * S + off, y))
        bot.append((base_x * W * S + off + width * W * S * (1 + .18 * math.sin(t * 5 + phase)), y))
        y += 6
    d.polygon(top + bot[::-1], fill=hex2rgb(color) + (255,))
    m = np.asarray(lay.getchannel("A"), np.float32) / 255.0
    yy = np.arange(lay.height, dtype=np.float32)[:, None] / (H * S)
    ramp = np.clip((yy - .02) / .18, 0, 1) * np.clip(1 - (yy - .3) / .38, 0, 1)
    m = m * ramp * (alpha / 255.0) * 1.5
    lay.putalpha(Image.fromarray(np.clip(m * 255, 0, 255).astype(np.uint8), "L"))
    return lay.filter(ImageFilter.GaussianBlur(blur * S))

def cabin(lay, cx, cy, w, body="#6E4B3A", roof="#B75C55", snow="#F7FCFF", light="#FFD98A"):
    h = w * .62
    d = ImageDraw.Draw(lay)
    # 雪堆
    d.ellipse([cx - w * .78, cy - h * .18, cx + w * .78, cy + h * .30], fill=hex2rgb(snow) + (255,))
    # 窗光
    for k in range(4):
        R = w * (.24 + k * .16)
        d.ellipse([cx - w * .09 - R, cy - h * .3 - R, cx - w * .09 + R, cy - h * .3 + R],
                  fill=hex2rgb(light) + (18,))
    # 房体
    d.rectangle([cx - w * .36, cy - h * .60, cx + w * .36, cy + h * .02], fill=hex2rgb(body) + (255,))
    # 屋顶
    d.polygon([(cx - w * .50, cy - h * .56), (cx, cy - h * 1.04), (cx + w * .50, cy - h * .56)],
              fill=hex2rgb(roof) + (255,))
    # 屋顶积雪
    d.polygon([(cx - w * .50, cy - h * .56), (cx - w * .28, cy - h * .73), (cx - w * .06, cy - h * .63),
               (cx + w * .16, cy - h * .75), (cx + w * .38, cy - h * .64), (cx + w * .50, cy - h * .56),
               (cx + w * .50, cy - h * .51), (cx - w * .50, cy - h * .51)],
              fill=hex2rgb(snow) + (245,))
    # 窗
    d.rectangle([cx - w * .22, cy - h * .42, cx + w * .0, cy - h * .12], fill=hex2rgb(light) + (255,))
    d.line([(cx - w * .11, cy - h * .42), (cx - w * .11, cy - h * .12)], fill=(255, 255, 255, 150),
           width=max(1, int(1.4 * S)))
    # 门
    d.rectangle([cx + w * .10, cy - h * .30, cx + w * .26, cy + h * .02], fill=hex2rgb("#4E342A") + (255,))
    # 烟囱
    d.rectangle([cx + w * .16, cy - h * .92, cx + w * .26, cy - h * .74], fill=hex2rgb(body) + (255,))
    d.rectangle([cx + w * .15, cy - h * .94, cx + w * .27, cy - h * .90], fill=hex2rgb(snow) + (255,))


def motif_daisy(size, petal="#FFFFFF", heart="#FFD55E"):
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    c = size * .5
    for k in range(9):
        a = TAU * k / 9
        px, py = c + math.cos(a) * size * .21, c + math.sin(a) * size * .21
        d.ellipse([px - size * .13, py - size * .16, px + size * .13, py + size * .16],
                  fill=hex2rgb(petal) + (250,))
    d.ellipse([c - size * .13, c - size * .13, c + size * .13, c + size * .13], fill=hex2rgb(heart) + (255,))
    return im


# ---------------------------------------------------------------- 场景
def bg_cream_clouds():
    """奶油云海：暖阳 + 连绵云海 + 小云。"""
    a = gradient([(0, "#FFEDCC"), (.32, "#FFD9AC"), (.66, "#FFC395"), (1, "#F0A87F")])
    a = glow(a, .78, .12, .8, "#FFF4DE", .5)
    lay = canvas()
    sun(lay, W * S * .78, H * S * .12, 62 * S, inner="#FFF6D8", outer="#FFD086", halo="#FFE9BE", halo_a=.42)
    stamp(lay, cloud_asset("#FFF2E2", "#DFA987", seed=3), W * S * .2, H * S * .3, scale=S * 1.1)
    stamp(lay, cloud_asset("#FFF8EF", "#E5B393", seed=8), W * S * .8, H * S * .44, scale=S * .85)
    stamp(lay, cloud_asset("#FFFDF8", "#E9BE9F", seed=12), W * S * .42, H * S * .6, scale=S * 1.35)
    lay.alpha_composite(cloud_sea(H * S * .88, "#FFFDF8", "#EFC9AE", seed=33, n=8, rmin=.16, rmax=.3))
    d = ImageDraw.Draw(lay)
    rnd = random.Random(63)
    for _ in range(18):
        x, y = rnd.uniform(0, W * S), rnd.uniform(.05, .5) * H * S
        r = rnd.uniform(2.0, 5.0) * S
        d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255, 120))
    a = blend(a, lay, blur=.004)
    a = glow(a, .5, .94, .7, "#FFF3E4", .18)
    return finish(a, vignette=.12)

def bg_strawberry():
    """草莓糖霜：满版草莓花布。"""
    a = gradient([(0, "#FFF8FA"), (1, "#FFE6EE")])
    lay = canvas()
    scatter(lay, motif_strawberry, 205 * S, 16, 12, (.62, .86), seed=5)
    dots = ImageDraw.Draw(lay)
    rnd = random.Random(9)
    for _ in range(90):
        x, y = rnd.uniform(0, W * S), rnd.uniform(0, H * S)
        r = rnd.uniform(1.6, 3.4) * S
        dots.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255, 190))
    a = blend(a, lay)
    return finish(a, vignette=.08)


def bg_blue_sky():
    """云画蓝天：通透蓝天、太阳、层层白云与飞鸟。"""
    a = gradient([(0, "#5FB1E8"), (.26, "#8CCCF4"), (.56, "#C2E5FB"), (1, "#EBF8FF")])
    a = glow(a, .2, .11, .75, "#FFFFFF", .4)
    lay = canvas()
    sun(lay, W * S * .2, H * S * .11, 46 * S, inner="#FFFBEC", outer="#FFE9A6", halo="#FFF6DA", halo_a=.45)
    stamp(lay, cloud_asset("#FFFFFF", "#A6C6E4", seed=2), W * S * .72, H * S * .21, scale=S * 1.05)
    stamp(lay, cloud_asset("#FFFFFF", "#AFCFEA", seed=7), W * S * .3, H * S * .4, scale=S * .72)
    stamp(lay, cloud_asset("#FFFFFF", "#A9CBE7", seed=15), W * S * .84, H * S * .55, scale=S * 1.25)
    stamp(lay, cloud_asset("#FDFEFF", "#B4D2EA", seed=23), W * S * .2, H * S * .68, scale=S * .95)
    lay.alpha_composite(cloud_sea(H * S * .9, "#FFFFFF", "#BFD9EC", seed=27, n=9, rmin=.15, rmax=.28))
    birds(lay, W * S * .4, H * S * .32, 9 * S, color="#5E7C9B", n=3)
    birds(lay, W * S * .66, H * S * .43, 6.5 * S, color="#7290AB", n=2)
    a = blend(a, lay, blur=.004)
    return finish(a, grain=1.2, vignette=.06)

def bg_sunset_hills():
    """蜜桃黄昏：落日、层叠山丘、归鸟。"""
    a = gradient([(0, "#FFE9C9"), (.3, "#FFCBBA"), (.55, "#FFA9B0"), (.78, "#EE8FA8"), (1, "#B98AA6")])
    a = glow(a, .5, .52, .95, "#FFD9A8", .55)
    lay = canvas()
    sun(lay, W * S * .5, H * S * .52, 92 * S, inner="#FFF3D0", outer="#FFC983", halo="#FFD9A0", halo_a=.8)
    lay2 = canvas()
    lay2.alpha_composite(hill(H * S * .64, H * S * .035, 1.1, 1.2, hex2rgb("#C98FA8"), 210))
    lay2.alpha_composite(hill(H * S * .72, H * S * .045, .8, 3.1, hex2rgb("#A97E9C"), 235))
    lay2.alpha_composite(hill(H * S * .82, H * S * .055, .62, 5.0, hex2rgb("#8C6A8C"), 250))
    lay2.alpha_composite(hill(H * S * .94, H * S * .04, .5, 2.2, hex2rgb("#6E5674"), 255))
    lay.alpha_composite(lay2)
    birds(lay, W * S * .72, H * S * .38, 9 * S, color="#7A5A6E", n=4, flip=True)
    a = blend(a, lay, blur=.005)
    return finish(a, vignette=.12)


def bg_gingham():
    """抹茶格纹：野餐布格纹 + 小叶子。"""
    a = gradient([(0, "#F8FBEF"), (1, "#E4EED3")])
    lay = canvas()
    d = ImageDraw.Draw(lay)
    step, width = 78 * S, 38 * S
    col = hex2rgb("#B9D49B")
    x = 0
    while x < W * S + step:
        d.rectangle([x, 0, x + width, H * S], fill=col + (86,))
        x += step
    y = 0
    while y < H * S + step:
        d.rectangle([0, y, W * S, y + width], fill=col + (86,))
        y += step
    # 交叉处加深
    x = 0
    while x < W * S + step:
        y = 0
        while y < H * S + step:
            d.rectangle([x, y, x + width, y + width], fill=col + (54,))
            y += step
        x += step
    scatter(lay, motif_leaf, 172 * S, 12, 24, (.5, .72), seed=31)
    # 白色描边框
    d.rectangle([18 * S, 18 * S, W * S - 18 * S, H * S - 18 * S],
                outline=(255, 255, 255, 150), width=int(3 * S))
    a = blend(a, lay)
    return finish(a, grain=1.2, vignette=.07)


def bg_lemon():
    """柠檬汽水：整颗柠檬、切片与小气泡。"""
    a = gradient([(0, "#FFFDF2"), (.5, "#FFF9D8"), (1, "#FFF1B4")])
    a = glow(a, .28, .14, .8, "#FFFFFF", .5)
    lay = canvas()
    scatter(lay, motif_lemon, 275 * S, 16, 16, (.52, .72), seed=13)
    rnd = random.Random(71)
    for _ in range(7):
        whole = motif_lemon_whole(int(rnd.uniform(.14, .21) * W * S))
        stamp(lay, whole, rnd.uniform(.1, .9) * W * S, rnd.uniform(.08, .92) * H * S, rnd.uniform(0, 360))
    scatter(lay, motif_leaf, 380 * S, 20, 58, (.26, .36), seed=17)
    d = ImageDraw.Draw(lay)
    for _ in range(34):
        x, y = rnd.uniform(0, W * S), rnd.uniform(0, H * S)
        r = rnd.uniform(4, 16) * S
        d.ellipse([x - r, y - r, x + r, y + r], outline=(255, 255, 255, 140), width=max(1, int(2 * S)))
    a = blend(a, lay)
    return finish(a, vignette=.08)

def bg_lavender_night():
    """薰衣草夜：极光帘、月亮、星星与远山。"""
    a = gradient([(0, "#221F47"), (.32, "#40376B"), (.6, "#6E5890"), (1, "#B491B2")])
    a = glow(a, .72, .18, .6, "#E9DAFF", .45)
    lay = canvas()
    for (bx, col, al, amp, ph, bw) in [(.16, "#7BE8C6", 96, .06, .4, .15),
                                       (.4, "#A6A8FF", 78, .07, 2.1, .12),
                                       (.64, "#6FD6E8", 66, .055, 4.0, .17),
                                       (.85, "#FFBEE0", 48, .06, 1.2, .11)]:
        lay.alpha_composite(aurora_curtain(bx, bw, col, al, amp, ph, 16))
    stars(lay, 200, seed=6, ymax=.62, smin=.8, smax=2.3)
    stamp(lay, crescent(140 * S), W * S * .74, H * S * .16)
    lay.alpha_composite(hill(H * S * .74, H * S * .05, .7, 2.0, hex2rgb("#463C63"), 228))
    lay.alpha_composite(hill(H * S * .84, H * S * .06, .52, 4.6, hex2rgb("#302A48"), 245))
    a = blend(a, lay, blur=.003)
    return finish(a, grain=1.4, vignette=.16)

def bg_hearts():
    """奶油心心：心心花布。"""
    a = gradient([(0, "#FFFAF2"), (1, "#FFEEDC")])
    lay = canvas()
    scatter(lay, lambda s: motif_heart(s, "#F0A2B7", "#FFD4E0"), 200 * S, 14, 14, (.6, .84), seed=23)
    scatter(lay, lambda s: motif_heart(s, "#F7C9B4", "#FFE9DC"), 285 * S, 16, -18, (.34, .5), seed=27,
            offset=(70, 90))
    a = blend(a, lay)
    return finish(a, vignette=.06)


def bg_mint_sea():
    """薄荷海边：平涂海浪、太阳与远云。"""
    a = gradient([(0, "#DFF8F0"), (.3, "#AEE8DB"), (.5, "#7BD2C6"), (1, "#3E9C9C")])
    a = glow(a, .7, .16, .7, "#FFFFFF", .32)
    lay = canvas()
    sun(lay, W * S * .7, H * S * .17, 46 * S, inner="#FFFBE0", outer="#FFEDA6", halo="#FFF6CE", halo_a=.34)
    stamp(lay, cloud_asset("#FFFFFF", "#9FD8CE", seed=61), W * S * .18, H * S * .2, scale=S * .8)
    stamp(lay, cloud_asset("#FFFFFF", "#A6DCD2", seed=64), W * S * .82, H * S * .14, scale=S * .6)
    cols = ["#8FDACB", "#7BD2C3", "#66C6B8", "#54B8AD", "#43A8A1", "#369694", "#2C8486"]
    for i, col in enumerate(cols):
        t = i / (len(cols) - 1)
        lay.alpha_composite(sea_wave(H * S * (.46 + t * .52), H * S * (.008 + t * .012),
                                     1.1 + t * 1.2, i * 1.7, hex2rgb(col),
                                     170 - i * 12, 4.0 + t * 4))
    # 浪尖
    d = ImageDraw.Draw(lay)
    rnd = random.Random(8)
    for _ in range(80):
        x = rnd.uniform(0, W * S)
        y = rnd.uniform(H * S * .5, H * S)
        L = rnd.uniform(8, 26) * S
        d.arc([x - L, y - L * .4, x + L, y + L * .4], 205, 335,
              fill=(255, 255, 255, rnd.randint(80, 160)), width=max(1, int(1.8 * S)))
    a = blend(a, lay, blur=.003)
    return finish(a, vignette=.10)

def bg_caramel():
    """焦糖拿铁：俯视咖啡杯 + 咖啡豆 + 暖光。"""
    a = gradient([(0, "#FFF3DF"), (.4, "#F7DAB6"), (1, "#DCA774")])
    a = glow(a, .5, .4, 1.0, "#FFFDF4", .55)
    lay = canvas()
    cx, cy = W * S * .5, H * S * .46
    R = 196 * S
    d = ImageDraw.Draw(lay)
    # 碟
    d.ellipse([cx - R * 1.24, cy - R * 1.2, cx + R * 1.24, cy + R * 1.2], fill=(255, 250, 240, 235))
    d.ellipse([cx - R * 1.24, cy - R * 1.2, cx + R * 1.24, cy + R * 1.2],
              outline=(232, 205, 174, 190), width=int(2.4 * S))
    # 杯底投影
    for k in range(5):
        d.ellipse([cx - R * (1.02 + k * .02), cy - R * .98 + R * .06 * k,
                   cx + R * (1.02 + k * .02), cy + R * (1.02 + k * .02)],
                  fill=(120, 74, 40, 12))
    # 杯身
    d.ellipse([cx - R, cy - R, cx + R, cy + R], fill=(255, 253, 247, 255))
    d.ellipse([cx - R * .9, cy - R * .9, cx + R * .9, cy + R * .9],
              outline=(238, 220, 198, 200), width=int(9 * S))
    d.ellipse([cx - R, cy - R, cx + R, cy + R], outline=(229, 205, 178, 235), width=int(3 * S))
    # 把手
    d.arc([cx + R * .78, cy - R * .44, cx + R * 1.5, cy + R * .44], -74, 74,
          fill=(255, 253, 247, 255), width=int(30 * S))
    d.arc([cx + R * .78, cy - R * .44, cx + R * 1.5, cy + R * .44], -74, 74,
          fill=(228, 203, 176, 210), width=int(2.4 * S))
    # 咖啡
    d.ellipse([cx - R * .78, cy - R * .78, cx + R * .78, cy + R * .78], fill=(138, 82, 44, 255))
    d.ellipse([cx - R * .78, cy - R * .78, cx + R * .78, cy + R * .78],
              outline=(172, 110, 64, 255), width=int(5 * S))
    d.ellipse([cx - R * .62, cy - R * .7, cx + R * .1, cy - R * .28], fill=(178, 116, 70, 90))
    # 奶泡拉花
    for k in range(3):
        rr = R * (.48 - k * .12)
        d.arc([cx - rr, cy - rr * .92, cx + rr, cy + rr * .92], 208, 332,
              fill=(255, 248, 236, 215), width=int((11 - k * 2.4) * S))
    heart = motif_heart(int(R * .48), "#FFF9EE", "#FFFFFF")
    stamp(lay, heart, cx, cy + R * .06)
    # 咖啡豆
    rnd = random.Random(29)
    for _ in range(14):
        ang = rnd.uniform(0, TAU)
        dist = rnd.uniform(1.55, 2.25) * R
        x, y = cx + math.cos(ang) * dist * .8, cy + math.sin(ang) * dist
        bean = motif_bean(int(rnd.uniform(.075, .11) * W * S))
        stamp(lay, bean, x, y, rnd.uniform(0, 180))
    # 糖粒
    for _ in range(50):
        x, y = rnd.uniform(0, W * S), rnd.uniform(0, H * S)
        r = rnd.uniform(1.4, 3.2) * S
        d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255, rnd.randint(70, 150)))
    a = blend(a, lay, blur=.004)
    return finish(a, vignette=.14)

def bg_aurora():
    """极光夜空：绿紫极光 + 雪山。"""
    a = gradient([(0, "#0E2233"), (.4, "#173A4C"), (.7, "#26606B"), (1, "#4F8E8B")])
    a = glow(a, .5, .3, .9, "#7FE7C4", .28)
    lay = canvas()
    for i, (col, al, y) in enumerate([("#7BF0C4", 60, .3), ("#9FD8FF", 46, .37), ("#C3A8FF", 36, .44)]):
        band = wave_band(H * S * y, H * S * (.03 + i * .012), .8 + i * .25, i * 2.4 + .6,
                         hex2rgb(col), al, (42 - i * 6) * S)
        lay.alpha_composite(band.filter(ImageFilter.GaussianBlur(20 * S)))
    stars(lay, 240, seed=14, ymax=.7, smin=.8, smax=2.6)
    # 雪山
    def mountain(base_y, peaks, color, alpha):
        d = ImageDraw.Draw(lay)
        pts = [(0, H * S)]
        for i in range(len(peaks) + 1):
            x = W * S * i / len(peaks)
            pts.append((x, H * S))
        poly = [(0, H * S)]
        n = 7
        for i in range(n + 1):
            x = W * S * i / n
            h = base_y - (peaks[i % len(peaks)] * H * S)
            poly.append((x, h))
        poly.append((W * S, H * S))
        d.polygon(poly, fill=hex2rgb(color) + (alpha,))
        # 雪顶
        for i in range(n):
            x0 = W * S * i / n
            x1 = W * S * (i + 1) / n
            h = base_y - (peaks[i % len(peaks)] * H * S)
            d.polygon([(x0, h + H * S * .045), ((x0 + x1) / 2, h - H * S * .004), (x1, h + H * S * .045)],
                      fill=(240, 250, 255, 90))

    mountain(H * S * .82, [-.10, -.16, -.09, -.14, -.08, -.13, -.10], "#2A4A55", 235)
    mountain(H * S * .92, [-.07, -.11, -.06, -.10, -.07, -.09, -.06], "#1B3640", 248)
    a = blend(a, lay, blur=.004)
    return finish(a, grain=1.5, vignette=.18)


def bg_daisy():
    """雏菊花田：蓝天、太阳、起伏草地与雏菊。"""
    a = gradient([(0, "#B7E4FF"), (.22, "#D6F2FF"), (.4, "#EFFBFF"),
                  (.44, "#C4E6A2"), (.72, "#93D07E"), (1, "#69AE60")])
    a = glow(a, .78, .1, .7, "#FFFFFF", .45)
    lay = canvas()
    sun(lay, W * S * .78, H * S * .1, 44 * S, inner="#FFFBE6", outer="#FFEE9E", halo="#FFF6D4", halo_a=.4)
    stamp(lay, cloud_asset("#FFFFFF", "#B7D9EF", seed=81), W * S * .22, H * S * .16, scale=S * .85)
    stamp(lay, cloud_asset("#FFFFFF", "#C2E0F1", seed=84), W * S * .72, H * S * .27, scale=S * .6)
    lay.alpha_composite(hill(H * S * .42, H * S * .012, 1.2, 1.0, hex2rgb("#A9D98C"), 245))
    lay.alpha_composite(hill(H * S * .47, H * S * .014, .9, 3.4, hex2rgb("#93CC7A"), 250))
    rnd = random.Random(88)
    d = ImageDraw.Draw(lay)
    # 草叶
    for _ in range(260):
        x = rnd.uniform(0, W * S)
        y = rnd.uniform(H * S * .46, H * S)
        t = (y / (H * S) - .46) / .54
        L = (10 + 34 * t) * S
        col = rnd.choice(["#7CBB63", "#6BAE5A", "#8FC97A", "#5FA152"])
        d.line([(x, y), (x + rnd.uniform(-6, 6) * S, y - L)], fill=hex2rgb(col) + (150,),
               width=max(1, int((1.4 + 1.6 * t) * S)))
    # 雏菊：近大远小
    for row in range(5):
        t = row / 4
        y = H * S * (.56 + t * .42)
        n = 5 - row // 2
        for i in range(n + 2):
            x = W * S * ((i + rnd.uniform(-.3, .3)) / (n + 1) + .06)
            size = (0.06 + .105 * t) * W * S
            if rnd.random() < .25:
                continue
            if t > .1:
                d.line([(x, y + size * .2), (x + rnd.uniform(-.02, .02) * W * S, y + size * .95)],
                       fill=hex2rgb("#5C9A55") + (220,), width=max(1, int(size * .06)))
            stamp(lay, motif_daisy(int(size), "#FFFFFF", "#FFD25E"), x, y, rnd.uniform(0, 360))
    a = blend(a, lay, blur=.003)
    return finish(a, vignette=.08)


def cow_patch(size, color="#6A5343"):
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    c = size * .5
    rnd = random.Random(int(size))
    pts = []
    for k in range(64):
        a = TAU * k / 64
        r = 1 + .16 * math.sin(a * 3 + rnd.random() * .2) + .09 * math.sin(a * 5 + 1.2)
        pts.append((c + math.cos(a) * size * .36 * r, c + math.sin(a) * size * .30 * r))
    d.polygon(pts, fill=hex2rgb(color) + (255,))
    im = im.filter(ImageFilter.GaussianBlur(size * .008))
    return im


def bg_cow():
    """奶牛纹：奶油底 + 大块斑纹 + 小爱心。"""
    a = gradient([(0, "#FFFCF3"), (.5, "#FBF1DF"), (1, "#F1E0C7")])
    lay = canvas()
    for (cx, cy, s, rot) in [(.12, .1, .58, -12), (.74, .16, .46, 22), (.5, .38, .62, -6),
                             (.16, .55, .5, 15), (.86, .62, .54, -18), (.42, .78, .58, 8),
                             (.1, .9, .4, 30), (.78, .92, .46, -8)]:
        patch = cow_patch(int(s * W * S))
        stamp(lay, patch, cx * W * S, cy * H * S, rot)
    d = ImageDraw.Draw(lay)
    rnd = random.Random(93)
    for _ in range(22):
        x, y = rnd.uniform(0, W * S), rnd.uniform(0, H * S)
        r = rnd.uniform(2.4, 6.0) * S
        d.ellipse([x - r, y - r, x + r, y + r], fill=(104, 82, 66, 190))
    for _ in range(10):
        stamp(lay, motif_heart(int(rnd.uniform(.035, .06) * W * S), "#F6CAD9", "#FFE6EE"),
              rnd.uniform(.08, .92) * W * S, rnd.uniform(.06, .94) * H * S, rnd.uniform(-20, 20))
    a = blend(a, lay, blur=.002)
    return finish(a, vignette=.08)

def bg_snow():
    """雪夜小屋：雪林、小屋暖光、月亮与飘雪。"""
    a = gradient([(0, "#16283F"), (.3, "#2B4C72"), (.58, "#5C87AA"), (1, "#B3CDE0")])
    a = glow(a, .24, .15, .55, "#FFF3DA", .4)
    lay = canvas()
    stars(lay, 120, seed=18, ymax=.48, smin=.7, smax=1.9, alpha=.65)
    stamp(lay, crescent(90 * S, "#FFF6E0"), W * S * .24, H * S * .14)
    lay.alpha_composite(hill(H * S * .7, H * S * .03, .8, 1.1, hex2rgb("#4A6C8B"), 215))
    rnd = random.Random(21)
    # 后景松林（略高、颜色淡）
    for i in range(10):
        x = W * S * (.02 + i * .11 + rnd.uniform(-.012, .012))
        size = rnd.uniform(.085, .115) * H * S
        pine = motif_pine(int(size), "#4F7189", "#44647C")
        stamp(lay, pine, x, H * S * (.825 - rnd.uniform(0, .02)))
    # 雪地
    lay.alpha_composite(hill(H * S * .84, H * S * .028, .5, 4.2, hex2rgb("#DCE9F3"), 246))
    cabin(lay, W * S * .62, H * S * .875, W * S * .46)
    # 前景松树
    for (cx, sz, tilt) in [(.12, .15, -4), (.9, .165, 3), (.3, .125, 6), (.775, .115, -6)]:
        pine = motif_pine(int(sz * H * S), "#3B5C60", "#335154").rotate(tilt, expand=True)
        stamp(lay, pine, cx * W * S, H * S * (.995 - sz * .42))
    lay.alpha_composite(hill(H * S * .955, H * S * .012, .4, 1.4, hex2rgb("#FFFFFF"), 120))
    d = ImageDraw.Draw(lay)
    for _ in range(130):
        x, y = rnd.uniform(0, W * S), rnd.uniform(0, H * S)
        r = rnd.uniform(1.2, 4.0) * S
        d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255, rnd.randint(80, 205)))
    a = blend(a, lay, blur=.003)
    return finish(a, grain=1.3, vignette=.18)

def bg_starfield():
    """星座图谱：深紫夜空 + 星座连线 + 行星。"""
    a = gradient([(0, "#150F33"), (.4, "#241A52"), (.72, "#3B2A6E"), (1, "#5B3E86")])
    lay = canvas()
    # 星云
    for (cx, cy, r, col, al) in [(.3, .3, .55, "#7A4FD0", 40), (.75, .62, .5, "#3F7FD6", 34),
                                 (.5, .85, .6, "#C24F9E", 26)]:
        d = ImageDraw.Draw(lay)
        R = r * W * S
        d.ellipse([cx * W * S - R, cy * H * S - R, cx * W * S + R, cy * H * S + R],
                  fill=hex2rgb(col) + (al,))
    lay = lay.filter(ImageFilter.GaussianBlur(40 * S))
    stars(lay, 260, seed=25, ymax=.95, smin=.7, smax=2.4)
    d = ImageDraw.Draw(lay)
    # 星座
    rnd = random.Random(33)
    for g in range(4):
        pts = [(rnd.uniform(.1, .9) * W * S, rnd.uniform(.08, .9) * H * S) for _ in range(rnd.randint(4, 6))]
        for i in range(len(pts) - 1):
            d.line([pts[i], pts[i + 1]], fill=(210, 200, 255, 90), width=max(1, int(1.1 * S)))
        for (x, y) in pts:
            r = rnd.uniform(2.2, 4.2) * S
            d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255, 230))
    # 行星
    def planet(cx, cy, R, col, ring=None):
        d.ellipse([cx - R, cy - R, cx + R, cy + R], fill=hex2rgb(col) + (255,))
        d.ellipse([cx - R * .6, cy - R * .7, cx + R * .1, cy - R * .05], fill=(255, 255, 255, 46))
        if ring:
            d.ellipse([cx - R * 1.7, cy - R * .42, cx + R * 1.7, cy + R * .42],
                      outline=hex2rgb(ring) + (150,), width=max(1, int(2.6 * S)))

    planet(W * S * .72, H * S * .24, 46 * S, "#E8B27A", "#FFD8A8")
    planet(W * S * .24, H * S * .68, 26 * S, "#8FD3E8")
    a = blend(a, lay, blur=.004)
    return finish(a, grain=1.5, vignette=.14)


def bg_rainbow():
    """彩虹棉花糖：马卡龙彩虹、云朵与星星。"""
    a = gradient([(0, "#FFEDF7"), (.3, "#EFF4FF"), (.62, "#DFEEFF"), (1, "#D2E7FF")])
    a = glow(a, .5, .05, .9, "#FFFFFF", .55)
    lay = canvas()
    cx, cy = W * S * .5, H * S * .72
    bands = [("#FF9CBB", 0), ("#FFC489", 1), ("#FFE79A", 2), ("#A9E0B8", 3),
             ("#9FD1FF", 4), ("#BFA6FF", 5), ("#EFB2E2", 6)]
    for col, i in bands:
        R = (360 - i * 27) * S
        d = ImageDraw.Draw(lay)
        d.arc([cx - R, cy - R, cx + R, cy + R], 200, 340, fill=hex2rgb(col) + (252,), width=int(30 * S))
    lay = lay.filter(ImageFilter.GaussianBlur(1.2 * S))
    stamp(lay, cloud_asset("#FFFFFF", "#BDD6EE", seed=41), W * S * .1, H * S * .6, scale=S * 1.45)
    stamp(lay, cloud_asset("#FFFFFF", "#BDD6EE", seed=44), W * S * .9, H * S * .62, scale=S * 1.45)
    lay.alpha_composite(cloud_sea(H * S * .94, "#FFFFFF", "#CFE0F1", seed=47, n=8, rmin=.15, rmax=.27))
    d = ImageDraw.Draw(lay)
    rnd = random.Random(51)
    for _ in range(34):
        x, y = rnd.uniform(0, W * S), rnd.uniform(0, H * S * .5)
        r = rnd.uniform(2.2, 6.0) * S
        d.polygon([(x, y - r), (x + r * .3, y - r * .3), (x + r, y), (x + r * .3, y + r * .3),
                   (x, y + r), (x - r * .3, y + r * .3), (x - r, y), (x - r * .3, y - r * .3)],
                  fill=(255, 255, 255, 215))
    a = blend(a, lay, blur=.003)
    return finish(a, grain=1.2, vignette=.05)

def bg_cherry_night():
    """夜樱：深蓝夜 + 樱花枝 + 月亮。"""
    a = gradient([(0, "#1B2145"), (.4, "#2E3160"), (.72, "#5B4574"), (1, "#9C7189")])
    a = glow(a, .7, .2, .7, "#FFE9F0", .4)
    lay = canvas()
    stars(lay, 170, seed=29, ymax=.6, smin=.7, smax=2.2)
    stamp(lay, crescent(120 * S, "#FFF4DC"), W * S * .7, H * S * .18)
    # 枝
    def branch(p0, p1, w0, w1, col="#3A2A38"):
        d = ImageDraw.Draw(lay)
        n = 22
        for i in range(n):
            t0, t1 = i / n, (i + 1) / n
            x0 = p0[0] + (p1[0] - p0[0]) * t0 + math.sin(t0 * 3.4) * W * S * .02
            y0 = p0[1] + (p1[1] - p0[1]) * t0 + math.cos(t0 * 2.6) * H * S * .012
            x1 = p0[0] + (p1[0] - p0[0]) * t1 + math.sin(t1 * 3.4) * W * S * .02
            y1 = p0[1] + (p1[1] - p0[1]) * t1 + math.cos(t1 * 2.6) * H * S * .012
            d.line([(x0, y0), (x1, y1)], fill=hex2rgb(col) + (235,),
                   width=max(1, int((w0 + (w1 - w0) * t0) * S)))

    branch((-.02 * W * S, .1 * H * S), (.62 * W * S, .34 * H * S), 9, 2.6)
    branch((.5 * W * S, .28 * H * S), (1.02 * W * S, .16 * H * S), 3.4, 1.4)
    branch((.3 * W * S, .25 * H * S), (.44 * W * S, .52 * H * S), 2.4, .8)
    # 花簇
    rnd = random.Random(37)
    anchors = [(rnd.uniform(-.02, .95) * W * S, rnd.uniform(.1, .5) * H * S) for _ in range(64)]
    for (x, y) in anchors:
        if rnd.random() < .5:
            continue
        m = motif_petal(int(rnd.uniform(.03, .075) * W * S))
        stamp(lay, m, x, y, rnd.uniform(0, 360), 1.0)
    # 落花
    for _ in range(26):
        x, y = rnd.uniform(0, W * S), rnd.uniform(.3, 1.0) * H * S
        m = motif_petal(int(rnd.uniform(.018, .04) * W * S), "#F3C3D3")
        stamp(lay, m, x, y, rnd.uniform(0, 360), 1.0)
    a = blend(a, lay, blur=.003)
    return finish(a, grain=1.4, vignette=.16)


GEN = {
    "wp-milk": bg_cream_clouds,
    "wp-strawberry": bg_strawberry,
    "wp-cloudy": bg_blue_sky,
    "wp-peach": bg_sunset_hills,
    "wp-matcha": bg_gingham,
    "wp-lemon": bg_lemon,
    "wp-lilac": bg_lavender_night,
    "wp-butterheart": bg_hearts,
    "wp-mint": bg_mint_sea,
    "wp-caramel": bg_caramel,
    "wp-aurora": bg_aurora,
    "wp-daisy": bg_daisy,
    "wp-cow": bg_cow,
    "wp-snow": bg_snow,
    "wp-starfield": bg_starfield,
    "wp-rainbow": bg_rainbow,
    "wp-cherry": bg_cherry_night,
}


def save(name, img):
    path = os.path.join(OUT_DIR, name + ".webp")
    q = 82
    img.save(path, "WEBP", quality=q, method=6)
    while os.path.getsize(path) > 240 * 1024 and q > 60:
        q -= 6
        img.save(path, "WEBP", quality=q, method=6)
    print(f"{name}.webp  {os.path.getsize(path)/1024:.0f} KB  q={q}")


if __name__ == "__main__":
    names = sys.argv[1:] or list(GEN)
    os.makedirs(OUT_DIR, exist_ok=True)
    only = [n for n in names if n in GEN]
    for n in only:
        save(n, GEN[n]())
    for n in names:
        if n not in GEN:
            print("unknown:", n)
