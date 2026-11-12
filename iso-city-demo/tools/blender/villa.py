# -*- coding: utf-8 -*-
"""
悬崖别墅 / 混凝土与玻璃 —— 照片级建筑渲染（Cycles）

这版的设计目标和上一版完全不同：不是"实体模型"，是"照片"。

真正让画面像照片、并且 Three.js 做不出来的，只有这几样：

1. 真实天空 + 低角度太阳。Nishita 大气散射 + 0.53° 的太阳角，
   阴影才会有真实的硬度，天空才会有从地平线暖到天顶冷的渐变。
2. 全局光照。光在水面、混凝土、玻璃之间来回反弹 —— 这是离线渲染的
   看家本领，实时引擎只能近似。
3. 真玻璃。IOR 1.52、粗糙度 0.02，透过它能看到室内的暖光。
4. 材质分层：混凝土有模板缝和色斑，木材有纹理，水有微澜。
   纯色材质是最强的 CGI 信号。
5. 摄影语言：28mm、1.6m 机位、低角度逆光、前景水面。

用法：
  blender --background --python tools/blender/villa.py -- [宽 高 采样]
"""
import bpy
import math
import os
import sys
from mathutils import Vector

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
W = int(ARGS[0]) if len(ARGS) > 0 and ARGS[0].isdigit() else 1500
H = int(ARGS[1]) if len(ARGS) > 1 and ARGS[1].isdigit() else 1000
SAMPLES = int(ARGS[2]) if len(ARGS) > 2 and ARGS[2].isdigit() else 180

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(ROOT, 'block', 'tex', 'villa.png')


# ═══════════════════ 基础 ═══════════════════
def wipe():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def srgb(r, g, b):
    def c(v):
        v /= 255.0
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    return (c(r), c(g), c(b), 1.0)


def hexc(h):
    h = h.lstrip('#')
    return srgb(int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def node(nt, kind, loc=(0, 0)):
    n = nt.nodes.new(kind)
    n.location = loc
    return n


def setin(p, name, val):
    """Principled 的插槽名在几个版本间改过，安全赋值。"""
    if name in p.inputs:
        p.inputs[name].default_value = val


def cube(name, size, loc, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object
    o.name = name
    o.scale = size
    o.rotation_euler = rot
    bpy.ops.object.transform_apply(rotation=True, scale=True)
    return o


def bevel(obj, width=0.03, seg=2, angle=40):
    if width <= 0:
        return obj
    m = obj.modifiers.new('bev', 'BEVEL')
    m.width = width
    m.segments = seg
    m.limit_method = 'ANGLE'
    m.angle_limit = math.radians(angle)
    m.harden_normals = True
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj


def assign(obj, mat):
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    return obj


def base_mat(name, color, rough, metal=0.0, spec=0.5):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    p = node(nt, 'ShaderNodeBsdfPrincipled', (0, 0))
    o = node(nt, 'ShaderNodeOutputMaterial', (300, 0))
    nt.links.new(p.outputs['BSDF'], o.inputs['Surface'])
    setin(p, 'Base Color', color)
    setin(p, 'Roughness', rough)
    setin(p, 'Metallic', metal)
    setin(p, 'Specular IOR Level', spec)
    return m, nt, p


# ═══════════════════ 材质 ═══════════════════
def mat_concrete():
    """清水混凝土：模板缝 + 色斑 + 气孔。

    模板缝是关键 —— 一段段 1.8m 宽的水平接缝，人眼一看到它就知道
    "这是真的浇筑出来的墙"，而不是一个灰色盒子。"""
    m, nt, p = base_mat('concrete', hexc('#b6b1a8'), 0.78, spec=0.3)

    # 大尺度色斑：不同浇筑批次的水灰比差异
    n1 = node(nt, 'ShaderNodeTexNoise', (-1000, 320))
    n1.inputs['Scale'].default_value = 1.6
    n1.inputs['Detail'].default_value = 6.0
    n1.inputs['Roughness'].default_value = 0.6
    r1 = node(nt, 'ShaderNodeValToRGB', (-780, 320))
    r1.color_ramp.elements[0].position = 0.35
    r1.color_ramp.elements[0].color = hexc('#9e9990')
    r1.color_ramp.elements[1].position = 0.68
    r1.color_ramp.elements[1].color = hexc('#c6c1b8')
    nt.links.new(n1.outputs['Fac'], r1.inputs['Fac'])
    nt.links.new(r1.outputs['Color'], p.inputs['Base Color'])

    # 模板缝：沿 Z 方向每 0.6 一段的水平线，用 Wave 的 Bands
    wave = node(nt, 'ShaderNodeTexWave', (-1000, 40))
    wave.wave_type = 'BANDS'
    wave.bands_direction = 'Z'
    wave.inputs['Scale'].default_value = 1.7
    wave.inputs['Distortion'].default_value = 0.6
    wave.inputs['Detail'].default_value = 1.0

    # 气孔：细密噪声
    n2 = node(nt, 'ShaderNodeTexNoise', (-1000, -260))
    n2.inputs['Scale'].default_value = 60.0
    n2.inputs['Detail'].default_value = 8.0
    n2.inputs['Roughness'].default_value = 0.65

    mix = node(nt, 'ShaderNodeMix', (-560, -60))
    mix.data_type = 'FLOAT'
    mix.inputs['Factor'].default_value = 0.55
    nt.links.new(wave.outputs['Fac'], mix.inputs[2])
    nt.links.new(n2.outputs['Fac'], mix.inputs[3])

    bump = node(nt, 'ShaderNodeBump', (-300, -160))
    bump.inputs['Strength'].default_value = 0.35
    bump.inputs['Distance'].default_value = 0.02
    nt.links.new(mix.outputs[0], bump.inputs['Height'])
    nt.links.new(bump.outputs['Normal'], p.inputs['Normal'])

    # 粗糙度随色斑起伏：浇得湿的地方更亮
    mr = node(nt, 'ShaderNodeMapRange', (-540, 200))
    mr.inputs['To Min'].default_value = 0.66
    mr.inputs['To Max'].default_value = 0.88
    nt.links.new(n1.outputs['Fac'], mr.inputs['Value'])
    nt.links.new(mr.outputs['Result'], p.inputs['Roughness'])
    return m


def mat_glass():
    """真玻璃。透射 + 近零粗糙 + 正确 IOR。

    这一项就是实时引擎和离线渲染的分水岭：玻璃后面要有真实的室内、
    真实的反射、真实的折射，画面才有"层"。"""
    m, nt, p = base_mat('glass', hexc('#e8f0f2'), 0.02)
    setin(p, 'Transmission Weight', 1.0)
    setin(p, 'IOR', 1.52)
    setin(p, 'Specular IOR Level', 0.55)
    setin(p, 'Coat Weight', 0.0)

    n = node(nt, 'ShaderNodeTexNoise', (-700, -200))
    n.inputs['Scale'].default_value = 3.0
    n.inputs['Detail'].default_value = 2.0
    mr = node(nt, 'ShaderNodeMapRange', (-480, -200))
    mr.inputs['To Min'].default_value = 0.008
    mr.inputs['To Max'].default_value = 0.035
    nt.links.new(n.outputs['Fac'], mr.inputs['Value'])
    nt.links.new(mr.outputs['Result'], p.inputs['Roughness'])
    return m


def mat_water():
    m, nt, p = base_mat('water', hexc('#0d1b1e'), 0.015, spec=0.7)
    setin(p, 'IOR', 1.333)
    setin(p, 'Transmission Weight', 0.92)

    # 微澜：足够微弱，才像静水而不是塑料
    n = node(nt, 'ShaderNodeTexNoise', (-760, -220))
    n.inputs['Scale'].default_value = 0.9
    n.inputs['Detail'].default_value = 4.0
    b = node(nt, 'ShaderNodeBump', (-500, -220))
    b.inputs['Strength'].default_value = 0.05
    b.inputs['Distance'].default_value = 0.03
    nt.links.new(n.outputs['Fac'], b.inputs['Height'])
    nt.links.new(b.outputs['Normal'], p.inputs['Normal'])
    return m


def mat_wood():
    """深色木吊顶：弦切纹理。"""
    m, nt, p = base_mat('wood', hexc('#6b4526'), 0.5)
    wave = node(nt, 'ShaderNodeTexWave', (-900, 60))
    wave.wave_type = 'BANDS'
    wave.bands_direction = 'X'
    wave.inputs['Scale'].default_value = 2.5
    wave.inputs['Distortion'].default_value = 12.0
    wave.inputs['Detail'].default_value = 5.0
    noise = node(nt, 'ShaderNodeTexNoise', (-900, -220))
    noise.inputs['Scale'].default_value = 40.0
    noise.inputs['Detail'].default_value = 8.0
    mix = node(nt, 'ShaderNodeMix', (-660, 0))
    mix.data_type = 'FLOAT'
    mix.inputs['Factor'].default_value = 0.4
    nt.links.new(wave.outputs['Fac'], mix.inputs[2])
    nt.links.new(noise.outputs['Fac'], mix.inputs[3])
    ramp = node(nt, 'ShaderNodeValToRGB', (-440, 0))
    ramp.color_ramp.elements[0].color = hexc('#4a2d17')
    ramp.color_ramp.elements[1].color = hexc('#8a5c34')
    nt.links.new(mix.outputs[0], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], p.inputs['Base Color'])
    b = node(nt, 'ShaderNodeBump', (-440, -280))
    b.inputs['Strength'].default_value = 0.3
    b.inputs['Distance'].default_value = 0.004
    nt.links.new(mix.outputs[0], b.inputs['Height'])
    nt.links.new(b.outputs['Normal'], p.inputs['Normal'])
    return m


def mat_stone():
    m, nt, p = base_mat('stone', hexc('#9c968b'), 0.62)
    brick = node(nt, 'ShaderNodeTexBrick', (-900, 160))
    brick.inputs['Scale'].default_value = 0.9
    brick.inputs['Mortar Size'].default_value = 0.006
    brick.inputs['Brick Width'].default_value = 1.2
    brick.inputs['Row Height'].default_value = 0.6
    brick.inputs['Color1'].default_value = hexc('#a49e93')
    brick.inputs['Color2'].default_value = hexc('#918b80')
    brick.inputs['Mortar'].default_value = hexc('#6f6a61')
    nt.links.new(brick.outputs['Color'], p.inputs['Base Color'])
    n = node(nt, 'ShaderNodeTexNoise', (-900, -280))
    n.inputs['Scale'].default_value = 30.0
    n.inputs['Detail'].default_value = 9.0
    b = node(nt, 'ShaderNodeBump', (-620, -280))
    b.inputs['Strength'].default_value = 0.3
    b.inputs['Distance'].default_value = 0.008
    nt.links.new(n.outputs['Fac'], b.inputs['Height'])
    nt.links.new(b.outputs['Normal'], p.inputs['Normal'])
    return m


def mat_metal():
    m, nt, p = base_mat('metal', hexc('#2b2c2e'), 0.28, metal=1.0)
    setin(p, 'Anisotropic', 0.5)
    n = node(nt, 'ShaderNodeTexNoise', (-700, -220))
    n.inputs['Scale'].default_value = 200.0
    mr = node(nt, 'ShaderNodeMapRange', (-500, -220))
    mr.inputs['To Min'].default_value = 0.22
    mr.inputs['To Max'].default_value = 0.36
    nt.links.new(n.outputs['Fac'], mr.inputs['Value'])
    nt.links.new(mr.outputs['Result'], p.inputs['Roughness'])
    return m


def mat_foliage(name='leaf', c1='#3f5124', c2='#243012'):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    p = node(nt, 'ShaderNodeBsdfPrincipled', (0, 0))
    o = node(nt, 'ShaderNodeOutputMaterial', (320, 0))
    nt.links.new(p.outputs['BSDF'], o.inputs['Surface'])
    setin(p, 'Base Color', hexc(c1))
    setin(p, 'Roughness', 0.62)
    # 树叶必须有透光感，否则就是一团塑料球
    setin(p, 'Subsurface Weight', 0.25)
    setin(p, 'Subsurface Radius', (0.25, 0.35, 0.12))
    n = node(nt, 'ShaderNodeTexNoise', (-700, -220))
    n.inputs['Scale'].default_value = 12.0
    n.inputs['Detail'].default_value = 6.0
    r = node(nt, 'ShaderNodeValToRGB', (-500, -220))
    r.color_ramp.elements[0].color = hexc(c2)
    r.color_ramp.elements[1].color = hexc(c1)
    nt.links.new(n.outputs['Fac'], r.inputs['Fac'])
    nt.links.new(r.outputs['Color'], p.inputs['Base Color'])
    return m


def mat_emit(name, color, strength):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    e = node(nt, 'ShaderNodeEmission', (0, 0))
    e.inputs['Color'].default_value = color
    e.inputs['Strength'].default_value = strength
    o = node(nt, 'ShaderNodeOutputMaterial', (300, 0))
    nt.links.new(e.outputs[0], o.inputs['Surface'])
    return m


M = {}


# ═══════════════════ 场地 ═══════════════════
def build_site():
    """台地 + 镜面水池 + 池沿。

    水池是整张图的"第二建筑"：它把主楼倒影成两半，
    画面立刻有了上下对称的秩序感。

    坐标必须严格分开：水面 y ∈ [-12, 4.4]，台地 y ∈ [5, 23]。
    上一版台地做成了 46×26 盖在 y∈[-1,25]，直接把半个水池埋了 ——
    所以不管怎么调相机都看不到水。"""
    # 大地
    bpy.ops.mesh.primitive_plane_add(size=600, location=(0, 0, 0))
    ground = bpy.context.object
    ground.name = 'ground'
    assign(ground, M['stone'])

    # 台地：只到水池后方，不再压住水面
    plat = cube('terrace', (48, 18.0, 1.2), (0, 14.0, 0.6))
    assign(plat, M['stone'])
    bevel(plat, 0.04, 2)

    # 水池：池底下沉，水面在 +0.03
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -3.8, -0.14))
    basin = bpy.context.object
    basin.name = 'pool_basin'
    basin.scale = (28.0, 16.4, 0.34)
    bpy.ops.object.transform_apply(scale=True)
    assign(basin, M['stone'])
    bevel(basin, 0.02, 1)

    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, -3.8, 0.035))
    water = bpy.context.object
    water.name = 'water'
    water.scale = (27.4, 15.8, 1)
    bpy.ops.object.transform_apply(scale=True)
    assign(water, M['water'])

    # 前场台阶：从池边一级级升到台地，这是"人怎么走进这栋房子"的暗示
    for i in range(4):
        st = cube(f'step{i}', (30.0, 0.9, 0.12), (0, 5.2 + i * 0.9, 0.06 + i * 0.12))
        assign(st, M['stone'])
        bevel(st, 0.02, 2)

    # 池沿：一圈 30cm 的高差，把水"框"住
    for (sx, sy, x, y) in ((29.2, 0.8, 0, 4.9), (29.2, 0.8, 0, -12.5),
                           (0.8, 18.2, 14.5, -3.8), (0.8, 18.2, -14.5, -3.8)):
        c = cube('curb', (sx, sy, 0.46), (x, y, 0.23))
        assign(c, M['stone'])
        bevel(c, 0.025, 2)


# ═══════════════════ 建筑 ═══════════════════
def build_house():
    """三层混凝土住宅。

    构成逻辑（这是"设计感"的来源，不是随手摆盒子）：
      底层整体后退，形成阴影里的玻璃入口 —— 建筑因此"浮"起来
      两层楼板向前挑出 5.5m，形成巨大的水平阴影线
      上层再退，产生退台的层次
      正立面一列竖向混凝土肋，切割玻璃，也接住侧光
    """
    W_, D_ = 24.0, 13.0
    y0 = 14.0        # 建筑中心在平台深处

    # ── 底层：大部分是玻璃，藏在楼板阴影下 ──
    recess = cube('gfloor', (W_ - 3.0, D_ - 1.0, 3.9), (0, y0, 1.95))
    assign(recess, M['concrete'])
    gl1 = cube('g_glass', (W_ - 4.2, 0.12, 3.5), (0, y0 - D_ / 2 - 0.02, 1.95))
    assign(gl1, M['glass'])
    bevel(gl1, 0.01, 1)

    # 室内暖光：透过玻璃溢出来，这是让建筑"有人住"的关键
    inner = cube('inner_glow', (W_ - 8.0, 0.1, 2.6), (0, y0 + 1.2, 1.9))
    assign(inner, M['glow'])

    # ── 两层挑出的楼板 ──
    for i, z in enumerate((4.0, 8.3)):
        slab = cube(f'slab{i}', (W_ + 5.5 * 0 - 0, D_ + 5.0, 0.55),
                    (0, y0 - 2.2, z))
        assign(slab, M['concrete'])
        bevel(slab, 0.045, 3)
        # 楼板底面的木吊顶：暖色，从下往上看才有细节
        soffit = cube(f'soffit{i}', (W_ + 1.0, D_ + 4.4, 0.06),
                      (0, y0 - 2.2, z - 0.30))
        assign(soffit, M['wood'])

        # 二层/三层的玻璃幕墙
        gg = cube(f'glass{i}', (W_ - 2.6, 0.12, 3.55),
                  (0, y0 - D_ / 2 - 2.0, z + 2.0))
        assign(gg, M['glass'])
        bevel(gg, 0.01, 1)

    # ── 竖向混凝土肋：正立面的节奏 ──
    n = 17
    for i in range(n):
        x = -(W_ - 4.0) / 2 + i * (W_ - 4.0) / (n - 1)
        rib = cube(f'rib{i}', (0.22, 0.55, 8.6), (x, y0 - D_ / 2 - 2.3, 4.3))
        assign(rib, M['concrete'])
        bevel(rib, 0.02, 2)

    # ── 屋顶：薄板 + 大出檐 ──
    roof = cube('roof', (W_ + 1.2, D_ + 6.5, 0.5), (0, y0 - 1.8, 12.35))
    assign(roof, M['concrete'])
    bevel(roof, 0.05, 3)
    soffit = cube('roof_soffit', (W_ + 0.8, D_ + 6.0, 0.06), (0, y0 - 1.8, 12.09))
    assign(soffit, M['wood'])

    # ── 顶层：再退一级，做出体量层次 ──
    top = cube('top', (W_ - 7.0, D_ - 4.5, 3.2), (-1.5, y0 + 1.2, 14.2))
    assign(top, M['concrete'])
    bevel(top, 0.05, 3)
    tglass = cube('top_glass', (W_ - 9.0, 0.1, 2.6), (-1.5, y0 + 1.2 - (D_ - 4.5) / 2 - 0.02, 14.2))
    assign(tglass, M['glass'])

    # ── 屋顶薄板压顶 ──
    cap = cube('cap', (W_ - 6.4, D_ - 4.0, 0.32), (-1.5, y0 + 1.2, 15.95))
    assign(cap, M['metal'])
    bevel(cap, 0.02, 2)

    # ── 侧面的实墙：给构图一个重块，别全是玻璃 ──
    side = cube('sidewall', (0.9, D_ + 4.0, 12.2), (W_ / 2 - 0.2, y0 - 2.0, 6.1))
    assign(side, M['concrete'])
    bevel(side, 0.04, 3)

    # ── 悬挑体量：伸到水面上方 5.2m ──
    # 这是整张图的"事件"。没有它，再好的材质也只是几层蛋糕板；
    # 有了它，建筑就有了重力感、危险性，照片才有人愿意多看一眼。
    cant = cube('cantilever', (9.0, 7.0, 3.0), (-7.2, y0 - D_ / 2 - 2.6, 9.9))
    assign(cant, M['concrete'])
    bevel(cant, 0.05, 3)
    # 悬挑端头的通高玻璃
    cg = cube('cant_glass', (3.4, 0.1, 2.4), (-7.2, y0 - D_ / 2 - 6.15, 9.9))
    assign(cg, M['glass'])
    # 悬挑下的木底板：仰视时才有的暖色
    cs = cube('cant_soffit', (8.8, 6.8, 0.06), (-7.2, y0 - D_ / 2 - 2.6, 8.37))
    assign(cs, M['wood'])
    # 支撑它的斜柱（把力传回地面，结构才成立）
    bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=0.28, depth=9.0,
                                        location=(-2.2, y0 - D_ / 2 - 5.4, 5.2))
    col = bpy.context.object
    col.name = 'column'
    assign(col, M['concrete'])
    for p in col.data.polygons:
        p.use_smooth = True


def build_tree(x, y, s=1.0, tall=False):
    """树：主干 + 分叉 + 多层叶团。

    单靠一个球是塑料感最强的做法。至少要三团不同大小、不同深度的叶团，
    再让它们互相穿插，轮廓才会碎、光才会透。"""
    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.14 * s,
                                        depth=3.6 * s, location=(x, y, 1.8 * s))
    tr = bpy.context.object
    assign(tr, M['bark'])
    for p in tr.data.polygons:
        p.use_smooth = True

    blobs = [
        (0.0, 0.0, 4.6, 1.9, 'leaf'),
        (-1.1, 0.5, 4.0, 1.3, 'leaf2'),
        (1.15, -0.4, 4.2, 1.25, 'leaf'),
        (0.3, 1.0, 3.6, 1.0, 'leaf2'),
        (-0.4, -1.0, 5.2, 1.05, 'leaf'),
    ]
    if tall:
        blobs = [(bx, by, bz + 1.4, br * 1.1, bm) for (bx, by, bz, br, bm) in blobs]

    for (dx, dy, dz, r, matn) in blobs:
        bpy.ops.mesh.primitive_ico_sphere_add(
            subdivisions=3, radius=r * s,
            location=(x + dx * s, y + dy * s, dz * s))
        o = bpy.context.object
        o.scale = (1.0, 1.0, 0.82)
        # 顶点随机扰动，打破完美球形
        import random
        random.seed(int(abs(x * 97 + y * 31 + dz)))
        for v in o.data.vertices:
            f = 1.0 + random.uniform(-0.09, 0.09)
            v.co *= f
        assign(o, M[matn])
        for p in o.data.polygons:
            p.use_smooth = True


# ═══════════════════ 光 ═══════════════════
def build_world():
    """手搭的三段渐变天空。

    之前用 Nishita 是有问题的：它内部自带一个太阳，和场景里的 Sun 灯
    方向对不上，两束光互相打架，画面就散了。渐变天空虽然物理上不严格，
    但方向、色彩、明度全部可控 —— 建筑效果图里这就是标准做法。

    低角度太阳的天色规律：地平线暖橙 → 过渡成灰粉 → 天顶深蓝。
    这个三段渐变就是"金色时刻"的全部秘密。"""
    w = bpy.data.worlds.new('sky')
    bpy.context.scene.world = w
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()

    bg = node(nt, 'ShaderNodeBackground', (200, 0))
    out = node(nt, 'ShaderNodeOutputWorld', (500, 0))

    coord = node(nt, 'ShaderNodeTexCoord', (-860, 0))
    sep = node(nt, 'ShaderNodeSeparateXYZ', (-660, 0))
    nt.links.new(coord.outputs['Generated'], sep.inputs['Vector'])

    ramp = node(nt, 'ShaderNodeValToRGB', (-420, 0))
    nt.links.new(sep.outputs['Z'], ramp.inputs['Fac'])
    els = ramp.color_ramp.elements
    els[0].position = 0.44
    els[0].color = hexc('#f0ae72')     # 地平线：暖橙
    els[1].position = 1.0
    els[1].color = hexc('#2c5c94')     # 天顶：深蓝
    m1 = ramp.color_ramp.elements.new(0.53)
    m1.color = hexc('#e2c4ae')         # 近地平线的灰粉
    m2 = ramp.color_ramp.elements.new(0.70)
    m2.color = hexc('#7ea2c4')

    nt.links.new(ramp.outputs['Color'], bg.inputs['Color'])
    bg.inputs['Strength'].default_value = 0.55
    nt.links.new(bg.outputs['Background'], out.inputs['Surface'])


def build_sun():
    d = bpy.data.lights.new('sun', 'SUN')
    d.energy = 8.5
    d.angle = math.radians(0.53)       # 真实太阳的视角尺寸
    d.color = (1.0, 0.70, 0.42)        # 低角度太阳偏暖
    o = bpy.data.objects.new('sun', d)
    # 光线传播方向（不是太阳所在方向）：从左前上方斜射下来，
    # 这样正立面和左立面都能吃到光，挑檐下面留出长影。
    direction = Vector((0.62, 0.72, -0.32)).normalized()
    o.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    bpy.context.scene.collection.objects.link(o)


def build_fill():
    """天光补光：从相反方向来的冷色柔光，专门压住暗部不让它死黑。"""
    d = bpy.data.lights.new('skyfill', 'AREA')
    d.shape = 'SQUARE'
    d.size = 70.0
    d.energy = 900
    d.color = (0.62, 0.76, 1.0)
    o = bpy.data.objects.new('skyfill', d)
    o.location = (-40, -50, 60)
    o.rotation_euler = (math.radians(40), math.radians(-12), math.radians(-30))
    bpy.context.scene.collection.objects.link(o)


# ═══════════════════ 相机 ═══════════════════
def build_camera():
    """28mm、1.6m 机位、对着水池对面的建筑。
    低机位 + 广角 = 建筑摄影的标准语言，能把挑檐的压迫感拉满。"""
    d = bpy.data.cameras.new('cam')
    d.lens = 21
    d.sensor_width = 36
    d.dof.use_dof = True
    d.dof.aperture_fstop = 8.0
    d.dof.focus_distance = 26.0
    cam = bpy.data.objects.new('cam', d)
    cam.location = (-13.0, -9.5, 0.75)
    look_at(cam, Vector((1.0, 13.0, 8.6)))
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
    scn.cycles.adaptive_threshold = 0.01
    scn.cycles.use_denoising = True
    scn.cycles.max_bounces = 10
    scn.cycles.diffuse_bounces = 4
    scn.cycles.glossy_bounces = 5
    scn.cycles.transmission_bounces = 10
    scn.cycles.transparent_max_bounces = 10
    scn.cycles.caustics_reflective = True
    scn.cycles.caustics_refractive = True
    scn.render.resolution_x = W
    scn.render.resolution_y = H
    scn.render.resolution_percentage = 100
    scn.render.image_settings.file_format = 'PNG'
    scn.render.image_settings.color_mode = 'RGB'
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
        print(f'[villa] device={"METAL" if got else "CPU"}', flush=True)
    except Exception:
        scn.cycles.device = 'CPU'

    try:
        scn.view_settings.view_transform = 'AgX'
        for lk in ('AgX - Medium High Contrast', 'Medium High Contrast', 'None'):
            try:
                scn.view_settings.look = lk
                break
            except Exception:
                continue
        scn.view_settings.exposure = 0.75
    except Exception:
        pass


def main():
    wipe()
    M.update({
        'concrete': mat_concrete(),
        'glass': mat_glass(),
        'water': mat_water(),
        'wood': mat_wood(),
        'stone': mat_stone(),
        'metal': mat_metal(),
        'bark': base_mat('bark', hexc('#4a3a2c'), 0.85)[0],
        'leaf': mat_foliage('leaf', '#425626', '#212c10'),
        'leaf2': mat_foliage('leaf2', '#33451c', '#1a240c'),
        'glow': mat_emit('glow', (1.0, 0.62, 0.32, 1), 26.0),
    })

    build_site()
    build_house()
    # 树：左侧一棵高的做框，右侧两棵小的补景深
    build_tree(-13.5, 4.5, 1.35, tall=True)
    build_tree(14.5, 8.0, 1.05)
    build_tree(17.5, 3.0, 0.85)

    build_world()
    build_sun()
    build_fill()
    build_camera()
    setup()

    scn = bpy.context.scene
    faces = sum(len(o.data.polygons) for o in scn.objects if o.type == 'MESH')
    print(f'[villa] objects={len(scn.objects)} faces={faces} res={W}x{H} spp={SAMPLES}', flush=True)

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=OUT.replace('.png', '.blend'))
    scn.render.filepath = OUT
    bpy.ops.render.render(write_still=True)
    print(f'[villa] wrote {OUT}', flush=True)


main()
