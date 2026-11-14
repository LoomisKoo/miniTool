#!/usr/bin/env python3
"""生成镜头用的可爱环状贴纸（384x384 透明底）。

输出：assets/stickers/st-ring-*.webp
用法：python3 tools/gen_lens_rings.py
"""
import math
import os
import random

from PIL import Image, ImageDraw, ImageFilter

S = 384
C = S / 2
TAU = math.pi * 2
OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "stickers")
K = 4  # 超采样


def hex2rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def fresh():
    return Image.new("RGBA", (S * K, S * K), (0, 0, 0, 0))


def down(im):
    return im.resize((S, S), Image.LANCZOS)


def shadow_of(im, blur=7, alpha=.30, dy=4):
    a = im.getchannel("A").point(lambda v: int(v * alpha))
    sh = Image.new("RGBA", im.size, (60, 34, 22, 255))
    sh.putalpha(a)
    sh = sh.filter(ImageFilter.GaussianBlur(blur * K))
    out = Image.new("RGBA", im.size, (0, 0, 0, 0))
    out.alpha_composite(sh, (0, int(dy * K)))
    out.alpha_composite(im)
    return out


# ---------------------------------------------------------------- 小部件
def daisy(size, petal="#FFFDF8", heart="#F6C453", edge=None):
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    c = size / 2
    for k in range(8):
        a = TAU * k / 8
        px, py = c + math.cos(a) * size * .20, c + math.sin(a) * size * .20
        box = [px - size * .15, py - size * .18, px + size * .15, py + size * .18]
        d.ellipse(box, fill=hex2rgb(petal) + (255,), outline=(hex2rgb(edge) + (255,)) if edge else None,
                  width=int(size * .012) if edge else 0)
    d.ellipse([c - size * .14, c - size * .14, c + size * .14, c + size * .14], fill=hex2rgb(heart) + (255,))
    d.ellipse([c - size * .07, c - size * .09, c + size * .03, c + size * .01], fill=(255, 255, 255, 120))
    return im


def heart(size, color="#F79CBC", hi="#FFD7E4"):
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    c = size / 2
    pts = []
    for k in range(72):
        a = TAU * k / 72
        hx = 16 * math.sin(a) ** 3
        hy = 13 * math.cos(a) - 5 * math.cos(2 * a) - 2 * math.cos(3 * a) - math.cos(4 * a)
        pts.append((c + hx * size / 42, c - hy * size / 42))
    d.polygon(pts, fill=hex2rgb(color) + (255,))
    d.ellipse([c - size * .17, c - size * .19, c - size * .02, c - size * .05], fill=hex2rgb(hi) + (200,))
    return im


def cloud(size, body="#FFFDFA", shade="#D6E6F3"):
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    c = size / 2
    d.ellipse([c - size * .19, c - size * .20, c + size * .03, c + size * .02], fill=hex2rgb(body) + (255,))
    d.ellipse([c - size * .04, c - size * .26, c + size * .18, c - size * .04], fill=hex2rgb(body) + (255,))
    d.ellipse([c - size * .24, c - size * .10, c + size * .24, c + size * .16], fill=hex2rgb(body) + (255,))
    d.rounded_rectangle([c - size * .24, c - size * .04, c + size * .24, c + size * .14],
                        radius=size * .09, fill=hex2rgb(body) + (255,))
    d.arc([c - size * .20, c - size * .02, c + size * .20, c + size * .14], 15, 165,
          fill=hex2rgb(shade) + (170,), width=max(1, int(size * .035)))
    return im


def bow(size, color="#F4A4B8", hi="#FFD9E4"):
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    c = size / 2
    for sgn in (-1, 1):
        d.polygon([(c, c + size * .02),
                   (c + sgn * size * .26, c - size * .17),
                   (c + sgn * size * .30, c + size * .10),
                   (c + sgn * size * .10, c + size * .13)],
                  fill=hex2rgb(color) + (255,))
        d.polygon([(c + sgn * size * .10, c - size * .06),
                   (c + sgn * size * .22, c - size * .13),
                   (c + sgn * size * .24, c + size * .02),
                   (c + sgn * size * .12, c + size * .04)],
                  fill=hex2rgb(hi) + (160,))
    d.ellipse([c - size * .07, c - size * .07, c + size * .07, c + size * .07], fill=hex2rgb(color) + (255,))
    return im


def candy(size, body="#FFE0EC", stripe="#F48FB1", stick="#FFF6E6"):
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    c = size / 2
    d.ellipse([c - size * .26, c - size * .26, c + size * .26, c + size * .26], fill=hex2rgb(body) + (255,))
    for k in range(3):
        R = size * (.26 - k * .07)
        d.arc([c - R, c - R, c + R, c + R], 20 + k * 40, 200 + k * 40,
              fill=hex2rgb(stripe) + (220,), width=max(1, int(size * .045)))
    d.ellipse([c - size * .1, c - size * .12, c + size * .02, c - size * .01], fill=(255, 255, 255, 170))
    return im


def moon_star(size):
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    m = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(m)
    d.ellipse([0, 0, size * .82, size * .82], fill=255)
    d.ellipse([size * .26, -size * .12, size * 1.12, size * .74], fill=0)
    body = Image.new("RGBA", (size, size), hex2rgb("#FFD98A") + (255,))
    body.putalpha(m)
    im.alpha_composite(body)
    d = ImageDraw.Draw(im)
    # 小星星
    cx, cy = size * .76, size * .72
    r = size * .17
    d.polygon([(cx, cy - r), (cx + r * .3, cy - r * .3), (cx + r, cy),
               (cx + r * .3, cy + r * .3), (cx, cy + r),
               (cx - r * .3, cy + r * .3), (cx - r, cy), (cx - r * .3, cy - r * .3)],
              fill=hex2rgb("#FFE9A8") + (255,))
    return im.filter(ImageFilter.GaussianBlur(.6))


# ---------------------------------------------------------------- 环
def ring(motif_fn, count, radius, angle0=-.5, phase_fn=None, extra=None, mscale=1.0):
    base = fresh()
    for i in range(count):
        a = angle0 + TAU * i / count
        x = C * K + math.cos(a) * radius * K
        y = C * K + math.sin(a) * radius * K
        size = int(S * .26 * mscale * K)
        if phase_fn:
            size = int(size * phase_fn(i / count))
        m = motif_fn(size)
        rot = math.degrees(a) + 90
        r = m.rotate(-rot, resample=Image.BICUBIC, expand=True)
        base.paste(r, (int(x - r.width / 2), int(y - r.height / 2)), r)
    if extra:
        for (ex, ey, esz, rot) in extra(base):
            pass
    return down(shadow_of(base, blur=6, alpha=.26, dy=3))


def gen_flower():
    rnd = random.Random(11)
    pal = [("#FFFDF8", "#F6C453"), ("#FFE4F0", "#F4A4B8"), ("#FFF3D2", "#E9A94C")]
    i = [0]

    def mk(size):
        p, h = pal[i[0] % 3]
        i[0] += 1
        return daisy(size, p, h, "#E9D9C6")

    return ring(mk, 9, S * .30)


def gen_heart():
    pal = ["#F79CBC", "#F6B7CB", "#F48FB1"]

    def mk(size):
        return heart(size, pal[(i := random.Random(size).randrange(3))], "#FFD7E4")

    return ring(mk, 10, S * .30, angle0=-.35)


def gen_cloud():
    def mk(size):
        return cloud(size)

    return ring(mk, 7, S * .30, angle0=-.9, mscale=1.18)


def gen_bow():
    pal = ["#F4A4B8", "#F7BECB", "#EFB0D8"]

    def mk(size):
        return bow(size, pal[random.Random(size).randrange(3)])

    out = ring(mk, 8, S * .30, angle0=-.4)
    # 中间加一个蝴蝶结
    b = bow(int(S * .34 * K), "#F4A4B8")
    out.alpha_composite(b, (int(C - b.width / 2), int(C - b.height / 2)))
    return out


def gen_candy():
    pal = [("#FFE0EC", "#F48FB1"), ("#E6F7EE", "#7CC6A6"), ("#FFF3D2", "#EFC05C")]

    def mk(size):
        b, s = pal[random.Random(size).randrange(3)]
        return candy(size, b, s)

    return ring(mk, 9, S * .30, angle0=-.3)


def gen_moon():
    return ring(lambda size: moon_star(size), 7, S * .30, angle0=-1.0, mscale=.92)


GEN = {
    "st-ring-flower": gen_flower,
    "st-ring-heart": gen_heart,
    "st-ring-cloud": gen_cloud,
    "st-ring-bow": gen_bow,
    "st-ring-candy": gen_candy,
    "st-ring-moon": gen_moon,
}

if __name__ == "__main__":
    os.makedirs(OUT_DIR, exist_ok=True)
    for name, fn in GEN.items():
        im = fn()
        path = os.path.join(OUT_DIR, name + ".webp")
        q = 86
        im.save(path, "WEBP", quality=q, method=6)
        while os.path.getsize(path) > 90 * 1024 and q > 60:
            q -= 6
            im.save(path, "WEBP", quality=q, method=6)
        print(f"{name}.webp  {os.path.getsize(path)/1024:.0f} KB  q={q}")
