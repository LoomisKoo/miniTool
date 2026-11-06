#!/usr/bin/env python3
"""把 AI 生成的边框 / 宝石图处理成透明 WebP，内嵌到 src/frames.js。

用法: python3 tools/make-frames.py <素材目录>
素材: card-{n,r,sr,ssr,ur,ex}.jpg（纯色底边框）、gems-sheet9.jpg（3x2 宝石）
边框按 CARD_W x CARD_H 的 SCALE 倍输出：等比缩放到目标宽，再删掉中段直边凑高度，不拉伸角饰。
"""
import base64, io, json, os, sys
import numpy as np
from PIL import Image

CARD_W, CARD_H, SCALE = 330, 406, 2
TIERS = ['n', 'r', 'sr', 'ssr', 'ur', 'ex']
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'src', 'frames.js')


def bg_color(a):
    h, w, _ = a.shape
    pts = np.concatenate([a[:8, :8].reshape(-1, 3), a[:8, -8:].reshape(-1, 3),
                          a[-8:, :8].reshape(-1, 3), a[-8:, -8:].reshape(-1, 3)])
    return np.median(pts, axis=0)


def keyed(img, lo=22, hi=60):
    """按与底色的距离生成 alpha，并反解混入的底色（去绿边）。"""
    a = np.asarray(img.convert('RGB')).astype(np.float32)
    bg = bg_color(a)
    d = np.sqrt(((a - bg) ** 2).sum(-1))
    alpha = np.clip((d - lo) / (hi - lo), 0, 1)
    al = np.maximum(alpha, 1e-3)[..., None]
    rgb = np.clip((a - (1 - al) * bg) / al, 0, 255)
    return rgb, alpha, a


def bbox(alpha, th=0.5):
    ys, xs = np.where(alpha > th)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def to_rgba(rgb, alpha):
    return Image.fromarray(np.dstack([rgb, alpha * 255]).astype(np.uint8), 'RGBA')


def inner_inset(alpha):
    """从中线向外找第一处不透明像素，得到框带厚度（左右取均值，上下各自）。"""
    h, w = alpha.shape
    row, col = alpha[h // 2], alpha[:, w // 2]
    cx, cy = w // 2, h // 2
    left = cx - next(i for i in range(cx) if row[cx - i] > .5)
    right = w - (cx + next(i for i in range(w - cx) if row[cx + i] > .5))
    top = cy - next(i for i in range(cy) if col[cy - i] > .5)
    bottom = h - (cy + next(i for i in range(h - cy) if col[cy + i] > .5))
    return left, right, top, bottom


def fill_band(alpha):
    """框带底色可能接近背景：被内外金属线包住、既连不到外部也连不到中心的区域强制不透明。"""
    from PIL import ImageDraw
    h, w = alpha.shape
    m = Image.fromarray(((alpha > .5) * 255).astype(np.uint8), 'L').copy()
    ImageDraw.floodfill(m, (0, 0), 128)
    ImageDraw.floodfill(m, (w // 2, h // 2), 128)
    return np.asarray(m) == 0


def frame(path):
    rgb, alpha, orig = keyed(Image.open(path))
    band = fill_band(alpha)
    alpha[band] = 1
    rgb[band] = orig[band]
    x0, y0, x1, y1 = bbox(alpha)
    im = to_rgba(rgb, alpha).crop((x0, y0, x1, y1))
    tw, th = CARD_W * SCALE, CARD_H * SCALE
    s = tw / im.width
    im = im.resize((tw, round(im.height * s)), Image.LANCZOS)
    if im.height > th:
        half = th // 2
        out = Image.new('RGBA', (tw, th))
        out.paste(im.crop((0, 0, tw, half)), (0, 0))
        out.paste(im.crop((0, im.height - (th - half), tw, im.height)), (0, half))
        im = out
    else:
        im = im.resize((tw, th), Image.LANCZOS)
    ins = inner_inset(np.asarray(im)[..., 3] / 255.0)
    return im, [round(v / SCALE, 1) for v in ins]


def gems(path, size=96):
    rgb, alpha, _ = keyed(Image.open(path))
    # 边缘半透明处压掉绿色溢色（宝石本体不透明，不受影响）
    edge = alpha < .98
    g = rgb[..., 1]
    g[edge] = np.minimum(g[edge], (rgb[..., 0][edge] + rgb[..., 2][edge]) / 2 + 6)
    full = to_rgba(rgb, alpha)
    h, w = alpha.shape
    out = []
    for r in range(2):
        for c in range(3):
            cx0, cy0, cx1, cy1 = w * c // 3, h * r // 2, w * (c + 1) // 3, h * (r + 1) // 2
            sub = alpha[cy0:cy1, cx0:cx1]
            x0, y0, x1, y1 = bbox(sub)
            side = max(x1 - x0, y1 - y0)
            mx, my = (x0 + x1) // 2 + cx0, (y0 + y1) // 2 + cy0
            g = full.crop((mx - side // 2, my - side // 2, mx + side // 2, my + side // 2))
            out.append(g.resize((size, size), Image.LANCZOS))
    return out


def lv_coin(gem, inner=.74):
    """复用宝石徽章的金属外环，中心换成深色珐琅，给等级数字当底。"""
    a = np.asarray(gem).astype(np.float32)
    n = a.shape[0]
    yy, xx = np.mgrid[0:n, 0:n]
    c = (n - 1) / 2
    r = np.sqrt((xx - c) ** 2 + (yy - c) ** 2) / (n / 2)
    t = np.clip(r / inner, 0, 1)[..., None]
    hl = np.clip(1 - np.sqrt((xx - c) ** 2 + (yy - c * .55) ** 2) / (n * .42), 0, 1)[..., None]
    enamel = np.array([40, 30, 62]) * (1 - t * .55) + np.array([255, 255, 255]) * hl * .1
    edge = np.clip((r - inner) / .05 + 1, 0, 1)[..., None]
    shade = 1 - .45 * np.clip(1 - (inner - r) / .08, 0, 1)[..., None] * (r < inner)[..., None]
    rgb = a[..., :3] * edge + enamel * shade * (1 - edge)
    alpha = np.where(r < inner, 255, a[..., 3])
    return Image.fromarray(np.dstack([rgb, alpha]).clip(0, 255).astype(np.uint8), 'RGBA')


def webp_uri(im, q=88):
    buf = io.BytesIO()
    im.save(buf, 'WEBP', quality=q, method=6)
    return 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode()


def main(src):
    frames, insets = {}, {}
    for t in TIERS:
        im, ins = frame(os.path.join(src, 'card-%s.jpg' % t))
        frames[t] = webp_uri(im)
        insets[t] = ins
    gl = gems(os.path.join(src, 'gems-sheet9.jpg'), 128)
    gem = dict(zip(TIERS, (webp_uri(g, 90) for g in gl)))
    lv = dict(zip(TIERS, (webp_uri(lv_coin(g), 90) for g in gl)))
    js = ('/* 自动生成：tools/make-frames.py。图片边框、品级宝石、等级圆章底（透明 WebP） */\n'
          '(function (g) {\n  g.FRAME_IMG = ' + json.dumps(frames) + ';\n'
          '  g.FRAME_INSET = ' + json.dumps(insets) + ';\n'
          '  g.GEM_IMG = ' + json.dumps(gem) + ';\n'
          '  g.LV_IMG = ' + json.dumps(lv) + ';\n})(window);\n')
    with open(OUT, 'w') as f:
        f.write(js)
    print('insets', insets)
    print('bytes', len(js))


if __name__ == '__main__':
    main(sys.argv[1])
