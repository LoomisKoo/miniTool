# -*- coding: utf-8 -*-
"""
写实建筑模型 —— Cycles 离线渲染。

目标不是"照片级真实建筑"，而是**博物馆级实体建筑模型被棚拍下来**的那种质感：
纯等轴测视角、大面积柔光、像黏土一样连贯的圆角、干净的粉彩色、
无缝灰蓝背景、看不见任何噪点。

做到这一点的五条硬规则：
1. 正交等轴测。透视会立刻暴露"这是 CG"，实体模型照片没有透视。
2. 圆角必须够大。倒角是这种风格的灵魂 —— 边缘一道柔缓的高光过渡，
   读起来就是"被摸过的树脂模型"，而不是"多边形盒子"。
3. 材质只做哑光。高光零碎 = 塑料 CG；高光成片 = 真实哑光漆。
4. 光是唯一的主角：一大片柔光箱 + 强环境光，影子淡而软。
5. 色彩必须克制。低饱和、低对比、明度分层，不要糖果色。

用法：
  blender --background --python tools/blender/hero.py -- [宽 高 采样]
"""
import bpy
import bmesh
import math
import os
import sys
from mathutils import Vector

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
RES = int(ARGS[0]) if len(ARGS) > 0 and ARGS[0].isdigit() else 1400
SAMPLES = int(ARGS[1]) if len(ARGS) > 1 and ARGS[1].isdigit() else 160

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(ROOT, 'block', 'tex', 'hero_raw.png')


# ═══════════════════ 基础工具 ═══════════════════
def wipe():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def srgb(r, g, b):
    """取色时给人看的 sRGB → Blender 要的线性空间。"""
    def c(v):
        v /= 255.0
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    return (c(r), c(g), c(b), 1.0)


def hexc(h):
    h = h.lstrip('#')
    return srgb(int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def sat(color, k=1.18):
    """提高饱和度。AgX 色调映射天生压饱和度，哑光材质再一叠就更灰，
    所以取色之后要把饱和度补回来一点，画面才有参考图那种"色块感"。"""
    r, g, b, a = color
    l = 0.2126 * r + 0.7152 * g + 0.0722 * b
    return (max(0.0, l + (r - l) * k), max(0.0, l + (g - l) * k), max(0.0, l + (b - l) * k), a)


def shade(obj, angle=42):
    """平滑着色 + 加权法线。配合倒角，边缘才有一整条柔和的高光带。"""
    me = obj.data
    for p in me.polygons:
        p.use_smooth = True
    w = obj.modifiers.new('wn', 'WEIGHTED_NORMAL')
    w.keep_sharp = True
    w.weight = 50
    # 保留硬边：只用角度阈值，避免整块面被拉糊
    return obj


def bevel(obj, width, segments=3, angle=42):
    m = obj.modifiers.new('bev', 'BEVEL')
    m.width = width
    m.segments = segments
    m.limit_method = 'ANGLE'
    m.angle_limit = math.radians(angle)
    m.harden_normals = True
    m.miter_outer = 'MITER_ARC'
    shade(obj)
    return obj


def mesh_from_boxes(name, boxes):
    """把一堆盒子做进同一个 mesh。上千个窗户用一个物体 + 一个倒角修改器，
    否则每个窗户挂一套修改器，求值开销会把渲染拖死。"""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    for (cx, cy, cz, sx, sy, sz) in boxes:
        verts = bmesh.ops.create_cube(bm, size=1.0)['verts']
        for v in verts:
            v.co.x = v.co.x * sx + cx
            v.co.y = v.co.y * sy + cy
            v.co.z = v.co.z * sz + cz
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def box(name, size, loc, bevel_w=0.12, seg=3):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    if bevel_w > 0:
        bevel(o, bevel_w, seg)
    return o


def assign(obj, mat):
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    return obj


# ═══════════════════ 材质：一律哑光 ═══════════════════
def matte(name, color, rough=0.82, spec=0.25):
    """实体模型的漆面：高粗糙、低镜面。
    rough 低于 0.7 立刻变成"塑料玩具"，这是最容易翻车的地方。"""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    p = nt.nodes.new('ShaderNodeBsdfPrincipled')
    p.location = (0, 0)
    o = nt.nodes.new('ShaderNodeOutputMaterial')
    o.location = (320, 0)
    nt.links.new(p.outputs['BSDF'], o.inputs['Surface'])
    p.inputs['Base Color'].default_value = color
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = 0.0
    if 'Specular IOR Level' in p.inputs:
        p.inputs['Specular IOR Level'].default_value = spec
    # 极轻微的凹凸：纯数学平面会有种"渲染塑料"的假，加一点点尘埃感
    n = nt.nodes.new('ShaderNodeTexNoise')
    n.location = (-700, -260)
    n.inputs['Scale'].default_value = 120.0
    n.inputs['Detail'].default_value = 4.0
    b = nt.nodes.new('ShaderNodeBump')
    b.location = (-420, -260)
    b.inputs['Strength'].default_value = 0.035
    b.inputs['Distance'].default_value = 0.003
    nt.links.new(n.outputs['Fac'], b.inputs['Height'])
    nt.links.new(b.outputs['Normal'], p.inputs['Normal'])
    return m


def glass(name, color):
    """模型里的窗户是"深色玻璃块"，不是真玻璃。

    关键教训：roughness 给到 0.2 时，巨大的柔光箱会在每扇窗上反射出一片白，
    整个立面立刻发灰。模型摄影里窗户必须"吃掉光"—— 高粗糙、低镜面，
    颜色才压得住，窗阵才立得起来。"""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    p = nt.nodes.new('ShaderNodeBsdfPrincipled')
    o = nt.nodes.new('ShaderNodeOutputMaterial')
    o.location = (320, 0)
    nt.links.new(p.outputs['BSDF'], o.inputs['Surface'])
    p.inputs['Base Color'].default_value = color
    p.inputs['Roughness'].default_value = 0.62
    p.inputs['Metallic'].default_value = 0.0
    p.inputs['IOR'].default_value = 1.45
    if 'Specular IOR Level' in p.inputs:
        p.inputs['Specular IOR Level'].default_value = 0.14
    return m


# ═══════════════════ 调色板（从参考图取色）═══════════════════
P = {
    'backdrop': hexc('#a0a7ad'),
    'cream': hexc('#cfc5b0'),
    'cream2': hexc('#c2bbab'),
    'stone': hexc('#a9a9a4'),
    'terra': hexc('#9a4a17'),
    'terra_d': hexc('#6f4520'),
    'navy': hexc('#0a3452'),
    'navy_l': hexc('#4b5764'),
    'pink': hexc('#cf8f8c'),
    'olive': hexc('#3d482c'),
    'olive_d': hexc('#28301b'),
    'slate': hexc('#4e585f'),
    'dark': hexc('#333333'),
    'white': hexc('#e2ded4'),
    'mustard': hexc('#a87f3c'),
}


def materials():
    # 上色前统一加饱和度：AgX + 哑光材质会把颜色压灰，这是补偿不是美化
    def c(h):
        return sat(hexc(h), 1.22)

    return {
        'backdrop': matte('backdrop', hexc('#a0a7ad'), 0.95, 0.1),
        'cream': matte('cream', sat(hexc('#cfc3ae'), 1.3), 0.84),
        'cream2': matte('cream2', sat(hexc('#c3b8a3'), 1.28), 0.86),
        'stone': matte('stone', c('#a9a9a4'), 0.9),
        'terra': matte('terra', c('#9a4a17'), 0.88),
        'terra_d': matte('terra_d', c('#6f4520'), 0.86),
        'pink': matte('pink', c('#cf8f8c'), 0.84),
        'olive': matte('olive', c('#3d482c'), 0.9),
        'olive_d': matte('olive_d', c('#28301b'), 0.92),
        'slate': matte('slate', sat(hexc('#6f675c'), 1.5), 0.8),
        'dark': matte('dark', c('#333333'), 0.75),
        'white': matte('white', c('#e2ded4'), 0.82),
        'mustard': matte('mustard', c('#a87f3c'), 0.86),
        'glassA': glass('glassA', c('#0a3452')),
        'glassB': glass('glassB', c('#4b5764')),
        'glassC': glass('glassC', c('#14374d')),
    }


# ═══════════════════ 立面：窗阵 ═══════════════════
def window_grid(prefix, span, h, z0, cols, rows, axis, offset, mat, depth=0.13, inset=0.74):
    """在一面墙上排窗。

    axis 指定哪一面：'y-' 是正面（朝 -Y），'x+' 是右面（朝 +X）。
    之前用"建好再旋转 90°"的做法，旋转会把局部 -Y 偏移映射到 +X，
    位置必然错位 —— 直接按轴向生成盒子，既简单也不会错。
    inset 是窗占格子的比例：0.74 才有窗阵的节奏，0.5 会变成稀疏几个洞。
    """
    boxes = []
    cw = span / cols
    ch = h / rows
    for r in range(rows):
        for c in range(cols):
            u = -span / 2 + cw * (c + 0.5)
            z = z0 + ch * (r + 0.5)
            if axis == 'x+':
                boxes.append((offset, u, z, depth, cw * inset, ch * inset))
            else:
                boxes.append((u, offset, z, cw * inset, depth, ch * inset))
    ob = mesh_from_boxes(prefix, boxes)
    assign(ob, mat)
    bevel(ob, 0.035, 2)
    return ob


def tower(name, cx, cy, w, d, h, body_mat, win_mat, cols=5, floors=6, plinth=0.0,
          roof='cream', band=0.16, setback=0.0):
    """一栋楼 = 主体 + 每层一道出挑板带 + 四面窗阵 + 压顶。

    板带是这种模型语言里最关键的一笔：它在立面上切出一道道水平阴影线，
    建筑立刻有了"层"的概念。没有板带的玻璃盒子永远是土味 CG。
    floor 高度 = h / floors，窗排在两道板带之间。
    """
    M = MATERIALS
    fh = h / floors
    body = box(f'{name}_body', (w, d, h), (cx, cy, plinth + h / 2),
               bevel_w=min(w, d) * 0.05, seg=4)
    assign(body, body_mat)

    # 每层板带：贴着主体出挑一圈
    for f in range(floors):
        z = plinth + fh * f
        b = box(f'{name}_band{f}', (w + band * 2, d + band * 2, band),
                (cx, cy, z + band / 2), bevel_w=0.035, seg=2)
        assign(b, M[roof])

    # 窗阵：只做等轴测下看得见的 -Y 和 +X 两面
    wz0 = plinth + band
    wh = h - band * (floors + 1)
    window_grid(f'{name}_wS', w * 0.92, wh, wz0, cols, floors, 'y-', -(d / 2 + 0.02), win_mat)
    window_grid(f'{name}_wE', d * 0.92, wh, wz0, max(2, cols - 1), floors, 'x+', (w / 2 + 0.02), win_mat)
    for nm in (f'{name}_wS', f'{name}_wE'):
        bpy.data.objects[nm].location = (cx, cy, 0)

    # 压顶
    cap = box(f'{name}_cap', (w + 0.3, d + 0.3, 0.2), (cx, cy, plinth + h + 0.1), bevel_w=0.06)
    assign(cap, M[roof])

    # 退台：顶部收一圈，天际线才有层次，不会全是平头
    if setback > 0:
        sw, sd, sh = w - setback * 2, d - setback * 2, fh * 0.9
        up = box(f'{name}_set', (sw, sd, sh), (cx + setback * 0.3, cy, plinth + h + sh / 2),
                 bevel_w=0.12, seg=3)
        assign(up, body_mat)
        cap2 = box(f'{name}_cap2', (sw + 0.26, sd + 0.26, 0.18),
                   (cx + setback * 0.3, cy, plinth + h + sh + 0.09), bevel_w=0.05)
        assign(cap2, M[roof])
    return body


def parapet(name, cx, cy, w, d, z, mat, h=0.42, t=0.16):
    for (sx, sy, px, py) in (
        (w, t, 0, d / 2), (w, t, 0, -d / 2),
        (t, d, w / 2, 0), (t, d, -w / 2, 0),
    ):
        b = box(f'{name}_p', (sx, sy, h), (cx + px, cy + py, z + h / 2), bevel_w=0.05, seg=2)
        assign(b, mat)


# ═══════════════════ 树与车 ═══════════════════
def tree(cx, cy, z, s=1.0):
    M = MATERIALS
    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.09 * s, depth=1.5 * s, location=(cx, cy, z + 0.75 * s))
    trunk = bpy.context.object
    assign(trunk, M['terra_d'])
    shade(trunk)

    for (dx, dy, dz, r, mat) in (
        (0, 0, 2.1, 1.15, 'olive'),
        (-0.42, 0.3, 1.85, 0.8, 'olive_d'),
        (0.44, -0.25, 1.95, 0.75, 'olive'),
    ):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=r * s, location=(cx + dx * s, cy + dy * s, z + dz * s))
        o = bpy.context.object
        assign(o, M[mat])
        shade(o)


def green_roof(cx, cy, w, d, z, seed=0):
    """屋顶绿化：整圈灌木 + 几棵树。

    等轴测俯视时屋顶是画面里面积很大的区域，全留空会显得荒。
    参考图的绿量主要不在街上，而在屋顶 —— 这也是一栋楼"有人用"的证据。
    灌木要做得够大：半径 1.7m 才在 60m 的视图里读得出来，小了就只是噪点。"""
    M = MATERIALS
    rng = seed
    # 沿屋顶内缘排一圈，四边都排
    for (sx, sy, n) in ((1, 0, 4), (0, 1, 3), (-1, 0, 3), (0, -1, 2)):
        for i in range(n):
            t = (i + 0.5) / n - 0.5
            if sx:
                lx, ly = sx * w * 0.40, t * d * 0.74
            else:
                lx, ly = t * w * 0.74, sy * d * 0.40
            rng = (rng * 1103515245 + 12345) % 2147483648
            j = ((rng >> 16) % 100) / 100 - 0.5
            bpy.ops.mesh.primitive_ico_sphere_add(
                subdivisions=1, radius=1.65 + j * 0.25,
                location=(cx + lx, cy + ly, z + 0.55))
            o = bpy.context.object
            o.scale = (1.0, 0.78, 0.58)
            assign(o, M['olive'] if (i + seed) % 2 else M['olive_d'])
            shade(o)
    # 屋顶花园里的树
    for (lx, ly, s) in ((w * 0.22, d * 0.22, 0.9), (-w * 0.16, d * 0.20, 0.8)):
        tree(cx + lx, cy + ly, z, s)


def balconies(cx, cy, w, d, h, floors, plinth, face_y=-1, mat=None):
    """阳台：在立面上挑出一道道薄板 + 玻璃栏板。

    这是整栋楼"有没有进深"的分水岭。纯平的立面加再细的窗格也像贴图；
    只要有一道真正挑出来的水平板，侧面就会接住光、下面就会落一道影，
    立面立刻从二维变成三维。"""
    M = MATERIALS
    fh = h / floors
    y = (d / 2) * face_y
    for f in range(1, floors):
        z = plinth + fh * f
        slab = box(f'bal{f}', (w * 0.86, 1.15, 0.14), (cx, cy + y + face_y * 0.5, z),
                   bevel_w=0.05, seg=2)
        assign(slab, mat or M['cream2'])
        rail = box(f'rail{f}', (w * 0.86, 0.06, 0.55), (cx, cy + y + face_y * 1.05, z + 0.34),
                   bevel_w=0.02, seg=1)
        assign(rail, M['glassB'])


def car(cx, cy, z, ry, mat_name):
    M = MATERIALS
    body = box('car', (1.85, 0.92, 0.42), (cx, cy, z + 0.3), bevel_w=0.14, seg=3)
    body.rotation_euler[2] = ry
    assign(body, M[mat_name])
    cab = box('car_cab', (1.0, 0.84, 0.34), (cx - 0.1, cy, z + 0.66), bevel_w=0.13, seg=3)
    cab.rotation_euler[2] = ry
    assign(cab, M['glassC'])
    for sx in (-0.58, 0.58):
        for sy in (-0.42, 0.42):
            bpy.ops.mesh.primitive_cylinder_add(
                vertices=12, radius=0.17, depth=0.16,
                location=(cx + sx * math.cos(ry) - sy * math.sin(ry),
                          cy + sx * math.sin(ry) + sy * math.cos(ry), z + 0.17),
                rotation=(math.radians(90), 0, ry),
            )
            w = bpy.context.object
            assign(w, M['dark'])
            shade(w)


# ═══════════════════ 场景 ═══════════════════
MATERIALS = {}


def build():
    M = MATERIALS
    # 无限背景地面。这里用 Shadow Catcher：地面本身不显示颜色，
    # 只把"落在上面的阴影"渲染成 alpha。背景色再由 compose_bg.py 铺一块纯色 ——
    # 这是产品摄影的标准做法，背景绝对均匀，同时保留真实的软阴影。
    bpy.ops.mesh.primitive_plane_add(size=4000, location=(0, 0, 0))
    floor = bpy.context.object
    floor.name = 'floor'
    floor.is_shadow_catcher = True

    # ── 模型底座：大倒角，这是"模型"身份最重要的宣告 ──
    BS = 36.0
    base = box('base', (BS, BS, 1.4), (0, 0, 0.7), bevel_w=0.4, seg=5)
    assign(base, M['cream'])
    plaza = box('plaza', (BS - 1.4, BS - 1.4, 0.2), (0, 0, 1.48), bevel_w=0.09, seg=3)
    assign(plaza, M['cream2'])

    # ── 十字街：把街区切成四块，街道宽度压到 5.6m ──
    road = box('road', (BS, 4.2, 0.26), (0, 0, 1.58), bevel_w=0.02, seg=1)
    assign(road, M['slate'])
    road2 = box('road2', (4.2, BS, 0.26), (0, 0, 1.585), bevel_w=0.02, seg=1)
    assign(road2, M['slate'])
    for (sx, sy, x, y) in ((BS, 0.9, 0, 2.55), (BS, 0.9, 0, -2.55), (0.9, BS, 2.55, 0), (0.9, BS, -2.55, 0)):
        walk = box('walk', (sx, sy, 0.3), (x, y, 1.6), bevel_w=0.05, seg=2)
        assign(walk, M['cream2'])

    # ══ 四个地块紧贴街道摆，占满底座 ══
    # 陶土塔（主角）：最高，退台收顶
    tower('t1', -10.0, -10.0, 12.0, 12.0, 27.0, M['cream'], M['glassA'],
          cols=4, floors=8, plinth=1.5, roof='cream2', setback=1.6)
    parapet('t1', -10.0, -10.0, 12.0, 12.0, 28.72 + 0.94, M['cream2'], h=0.45)
    balconies(-10.0, -10.0, 12.0, 12.0, 27.0, 8, 1.5, face_y=-1, mat=M['cream2'])

    # 奶油中层：矮一档，形成高度节奏
    tower('t2', 10.0, -10.0, 12.0, 12.0, 16.5, M['terra'], M['glassB'],
          cols=4, floors=5, plinth=1.5, roof='cream')
    parapet('t2', 10.0, -10.0, 12.0, 12.0, 18.2, M['cream'], h=0.38)
    for i in range(9):
        xx = 10.0 - 5.0 + i * 1.25
        fin = box('vfin', (0.13, 0.55, 15.2), (xx, -16.1, 1.5 + 7.6), bevel_w=0.03, seg=2)
        assign(fin, M['cream2'])

    # 深蓝玻璃塔：重色块，压住右前方
    tower('t3', 10.0, 10.0, 12.0, 12.0, 21.5, M['cream2'], M['glassA'],
          cols=4, floors=7, plinth=1.5, roof='dark')
    parapet('t3', 10.0, 10.0, 12.0, 12.0, 23.2, M['dark'], h=0.34)

    # 低层商铺：最矮，暖木色调，前场有雨棚和店面
    shop = box('shop', (12.0, 12.0, 8.4), (-10.0, 10.0, 1.5 + 4.2), bevel_w=0.55, seg=5)
    assign(shop, M['terra_d'])
    parapet('shop', -10.0, 10.0, 12.0, 12.0, 9.9, M['cream'], h=0.42)
    # 雨棚：向前挑出，在立面投一道软影
    awn = box('awning', (12.8, 2.6, 0.3), (-10.6, 15.2, 6.4), bevel_w=0.13, seg=3)
    assign(awn, M['pink'])
    shopwin = box('shop_glass', (10.0, 0.24, 3.1), (-10.6, 15.8, 3.9), bevel_w=0.09, seg=2)
    assign(shopwin, M['glassC'])
    for i in range(8):
        x = -15.8 + i * 1.5
        b = box('fin', (0.16, 0.14, 3.4), (x, 15.85, 7.6), bevel_w=0.035, seg=1)
        assign(b, M['cream'])

    # ── 屋顶绿化：等轴测下屋顶面积很大，留空会显得荒 ──
    green_roof(-10.0, -10.0, 12.0, 12.0, 28.5, seed=0)
    green_roof(-10.0, 10.0, 12.0, 12.0, 9.9, seed=1)
    green_roof(10.0, 10.0, 12.0, 12.0, 23.0, seed=3)
    green_roof(10.0, -10.0, 12.0, 12.0, 18.0, seed=2)

    # ── 屋顶设备：让天际线不空 ──
    for (nm, x, y, z, sx, sy, sz, mat) in (
        ('ac1', -12.6, -6.6, 29.9, 3.4, 2.6, 1.6, 'white'),
        ('vent1', -6.6, -13.0, 30.3, 1.7, 1.7, 2.5, 'slate'),
        ('ac2', 11.6, -7.2, 19.1, 2.8, 2.2, 1.4, 'cream2'),
        ('ac3', 11.4, 11.4, 24.0, 2.6, 2.0, 1.3, 'slate'),
        ('tank', -9.6, 12.4, 11.0, 2.2, 2.2, 1.8, 'cream2'),
    ):
        o = box(nm, (sx, sy, sz), (x, y, z), bevel_w=0.13, seg=3)
        assign(o, M[mat])

    # ── 街角小亭：粉色点缀 ──
    kiosk = box('kiosk', (3.0, 3.0, 2.5), (3.2, 3.4, 1.5 + 1.25), bevel_w=0.34, seg=4)
    assign(kiosk, M['pink'])
    roof_k = box('kiosk_roof', (3.5, 3.5, 0.2), (3.2, 3.4, 4.0), bevel_w=0.15, seg=3)
    assign(roof_k, M['cream'])

    # ── 绿化 ──
    for (x, y, s) in ((-14.5, 4.0, 1.5), (-8.5, 4.0, 1.45), (8.5, 4.0, 1.4),
                      (15.0, 4.0, 1.45), (-4.0, 14.0, 1.45), (-4.0, 7.6, 1.35),
                      (4.0, -14.0, 1.4), (4.0, -8.0, 1.35)):
        tree(x, y, 1.6, s)
    for (x, y) in ((-14.5, 4.0), (15.0, 4.0)):
        pot = box('planter', (2.1, 2.1, 0.55), (x, y, 1.85), bevel_w=0.11, seg=3)
        assign(pot, M['cream2'])

    # ── 车辆 ──
    car(-1.6, 1.7, 1.65, math.radians(90), 'mustard')
    car(1.8, 1.6, 1.65, math.radians(90), 'cream2')
    car(15.6, -1.9, 1.65, math.radians(-6), 'terra')

    # ── 路灯 ──
    for (x, y) in ((-3.7, 3.6), (3.6, 3.6), (3.6, -3.6), (-3.7, -15.4)):
        p = box('pole', (0.12, 0.12, 4.0), (x, y, 1.6 + 2.0), bevel_w=0.035, seg=2)
        assign(p, M['dark'])
        head = box('lamphead', (0.46, 0.34, 0.15), (x, y, 1.6 + 4.0), bevel_w=0.05, seg=2)
        assign(head, M['dark'])


# ═══════════════════ 光与环境 ═══════════════════
def build_lights():
    scn = bpy.context.scene
    w = bpy.data.worlds.new('studio')
    scn.world = w
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    bg = nt.nodes.new('ShaderNodeBackground')
    bg.inputs['Color'].default_value = hexc('#c3ccd4')
    bg.inputs['Strength'].default_value = 0.18
    out = nt.nodes.new('ShaderNodeOutputWorld')
    nt.links.new(bg.outputs['Background'], out.inputs['Surface'])

    def area(name, size, loc, rot, energy, color):
        d = bpy.data.lights.new(name, 'AREA')
        d.shape = 'SQUARE'
        d.size = size
        d.energy = energy
        d.color = color
        o = bpy.data.objects.new(name, d)
        o.location = loc
        o.rotation_euler = rot
        scn.collection.objects.link(o)
        return o

    # 主柔光箱：必须和相机同侧（相机在 +X/-Y）。之前放在 -X/-Y，
    # 占画面面积最大的 +X 立面整个落在阴影里，画面就整片发灰。
    area('key', 26.0, (38, -86, 96),
         (math.radians(46), math.radians(6), math.radians(28)),
         92000, (1.0, 0.975, 0.935))
    # 侧补：专门补 +X 面，别让它死黑
    area('fill', 40.0, (96, -6, 52),
         (math.radians(74), 0, math.radians(96)), 38000, (0.88, 0.94, 1.0))


# ═══════════════════ 相机：正交等轴测 ═══════════════════
def build_camera(lift=0.0):
    d = bpy.data.cameras.new('cam')
    d.type = 'ORTHO'
    # 46m 见方的底座在等轴测下投影宽 46*√2≈65m，ortho_scale 要大于它才不被裁掉；
    # 74 让主体占画面宽度约 88%，留出呼吸感 —— 撑满边缘会显得廉价。
    d.ortho_scale = 60.0
    cam = bpy.data.objects.new('cam', d)
    # 真等轴测：仰角 arctan(1/√2)=35.26°，方位 45°。
    # 相机和注视点一起沿屏幕上方偏移，用来把主体在画面里居中 ——
    # 只移相机不移注视点会改变视角，等轴测就被破坏了。
    off = Vector((0.52, -0.52, -1.04))
    cam.location = Vector((78, -78, 89)) + off
    look_at(cam, Vector((0.0, 0.0, 11.0 + lift)) + off)
    bpy.context.scene.collection.objects.link(cam)
    bpy.context.scene.camera = cam


def look_at(obj, target):
    obj.rotation_euler = (target - obj.location).to_track_quat('-Z', 'Y').to_euler()


# ═══════════════════ 渲染 ═══════════════════
def setup():
    scn = bpy.context.scene
    scn.render.engine = 'CYCLES'
    scn.cycles.samples = SAMPLES
    scn.cycles.use_adaptive_sampling = True
    scn.cycles.adaptive_threshold = 0.015
    scn.cycles.use_denoising = True
    # 只有漫反射和一点点高光，没必要跑满反弹
    scn.cycles.max_bounces = 6
    scn.cycles.diffuse_bounces = 2
    scn.cycles.glossy_bounces = 2
    scn.cycles.transmission_bounces = 3
    scn.cycles.caustics_reflective = False
    scn.cycles.caustics_refractive = False
    scn.render.resolution_x = RES
    scn.render.resolution_y = RES
    scn.render.resolution_percentage = 100
    # 背景不在 Blender 里合成：AgX 色调映射会把背景色整体抬亮（实测 #a0a7ad
    # 会变成 208,208,208），没法精确控色。这里只输出带 alpha 的阴影层，
    # 背景由 compose_bg.py 用原始 sRGB 值直接叠上去，颜色绝对准。
    scn.render.film_transparent = True
    scn.render.image_settings.file_format = 'PNG'
    scn.render.image_settings.color_mode = 'RGBA'
    scn.render.image_settings.color_depth = '8'

    try:
        prefs = bpy.context.preferences.addons['cycles'].preferences
        prefs.compute_device_type = 'METAL'
        prefs.get_devices()
        got = False
        for dv in prefs.devices:
            dv.use = dv.type == 'METAL'
            got = got or dv.use
        scn.cycles.device = 'GPU' if got else 'CPU'
        print(f'[hero] device={"METAL" if got else "CPU"}', flush=True)
    except Exception:
        scn.cycles.device = 'CPU'

    # AgX 让高光滚降像相机；曝光略微提亮，画面才不发闷
    try:
        scn.view_settings.view_transform = 'AgX'
        for lk in ('AgX - Medium High Contrast', 'Medium High Contrast', 'None'):
            try:
                scn.view_settings.look = lk
                break
            except Exception:
                continue
        scn.view_settings.exposure = 0.0
    except Exception:
        pass


def main():
    wipe()
    MATERIALS.update(materials())
    build()
    # 把模型整体抬离地面。压在平面上只会投出一圈 1.4m 高的薄影，
    # 完全没有"落地感"；抬高之后地面接住一整片柔影，模型才像被摆在影棚里。
    LIFT = 2.0
    for o in bpy.context.scene.objects:
        if o.type == 'MESH' and o.name != 'floor':
            o.location.z += LIFT
    build_lights()
    build_camera(LIFT)
    setup()

    scn = bpy.context.scene
    faces = sum(len(o.data.polygons) for o in scn.objects if o.type == 'MESH')
    print(f'[hero] objects={len(scn.objects)} faces={faces} res={RES} spp={SAMPLES}', flush=True)

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    blend = os.path.join(os.path.dirname(OUT), 'hero.blend')
    bpy.ops.wm.save_as_mainfile(filepath=blend)
    print(f'[hero] scene saved {blend}', flush=True)
    scn.render.filepath = OUT
    bpy.ops.render.render(write_still=True)
    print(f'[hero] wrote {OUT}', flush=True)


main()
