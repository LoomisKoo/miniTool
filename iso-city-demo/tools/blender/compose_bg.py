# -*- coding: utf-8 -*-
"""
把 Cycles 输出的 RGBA 阴影层，合成到精确的 sRGB 背景色上。

为什么要这一步：Blender 的 AgX 色调映射会把背景色整体抬亮
（#a0a7ad 实测出图变成 208,208,208），没法精确控色。
产品摄影里背景色是硬指标，所以放到渲染之后按原始 sRGB 直接合成。

用法：
  python3 tools/blender/compose_bg.py <输入RGBA.png> <输出.png> [#hex]
"""
import sys
from PIL import Image

src = sys.argv[1] if len(sys.argv) > 1 else 'block/tex/hero_raw.png'
dst = sys.argv[2] if len(sys.argv) > 2 else 'block/tex/hero.png'
hexbg = sys.argv[3] if len(sys.argv) > 3 else '#a0a7ad'

bg = tuple(int(hexbg.lstrip('#')[i:i + 2], 16) for i in (0, 2, 4))

im = Image.open(src).convert('RGBA')
# 用 alpha 做 over 合成：阴影层是预乘的黑色，叠上去就是"背景被压暗"
plate = Image.new('RGB', im.size, bg)
plate.paste(im, (0, 0), im)
plate.save(dst)
print(f'composed {src} over {hexbg} -> {dst} {plate.size}')
