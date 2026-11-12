# -*- coding: utf-8 -*-
"""
城市建筑场景 —— Blender Cycles

为什么"楼"容易做得廉价：只有体块，没有"城市信息量"。
真实街景里，人眼先读到的是这些碎东西，而不是轮廓：

  · 立面：窗框凹进去的深度、滑轨、分格、贴砖缝、滴水线
  · 阳台：分隔墙、栏杆、晾衣杆、挂着的衣服、空调外机 + 冷媒管
  · 屋顶：女儿墙、水箱、楼梯间、天线、排气管
  · 街面：路缘石、人行道砖、白线、井盖、电线杆 + 下垂的电线
  · 生活痕迹：自动售货机、垃圾桶、自行车、立式招牌、盆栽

光：蓝调时刻（天空还没黑，店里已经亮了）。冷背景 + 暖窗光，
这是最省事也最贵的对比。地面微湿，反光把招牌颜色垫到路面上。

用法：
  blender --background --python tools/blender/city.py -- <scene> [宽 高 采样]
  scene: mansion | konbini | street
"""
import bpy
import math
import os
import random
import sys
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import cozy as C  # noqa: E402

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
SCENE = ARGS[0] if ARGS and not ARGS[0].isdigit() else 'mansion'
rest = [a for a in ARGS if a.isdigit()]
W = int(rest[0]) if len(rest) > 0 else 1200
H = int(rest[1]) if len(rest) > 1 else 800
SAMPLES = int(rest[2]) if len(rest) > 2 else 64

ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(ROOT, 'block', 'tex', f'city_{SCENE}.png')

M = C.M


# ══════════════ 小工具 ══════════════
def box(n, sx, sy, sz, x, y, z, mat, rot=(0, 0, 0), bev=0.0):
    o = C.cube(n, (sx, sy, sz), (x, y, z), rot)
    C.assign(o, mat)
    if bev > 0:
        C.bevel(o, bev, 2)
    return o


def cyl(n, r, h, x, y, z, mat, verts=24, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=h, location=(x, y, z))
    o = bpy.context.object
    o.name = n
    o.rotation_euler = rot
    C.assign(o, mat)
    C.smooth(o)
    return o


def wire(n, a, b, sag=0.6, r=0.014, mat=None):
    """下垂的电线。曲线比圆柱省面，而且天然是弧的。"""
    cd = bpy.data.curves.new(n, 'CURVE')
    cd.dimensions = '3D'
    cd.bevel_depth = r
    cd.bevel_resolution = 0
    cd.resolution_u = 6
    sp = cd.splines.new('BEZIER')
    sp.bezier_points.add(2)
    mid = (Vector(a) + Vector(b)) * 0.5
    mid.z -= sag
    for bp, p in zip(sp.bezier_points, (a, mid, b)):
        bp.co = Vector(p)
        bp.handle_left_type = 'AUTO'
        bp.handle_right_type = 'AUTO'
    o = bpy.data.objects.new(n, cd)
    bpy.context.scene.collection.objects.link(o)
    o.data.materials.append(mat or M['cable'])
    return o


def obj_coord(nt, loc=(-1400, 0)):
    tc = C.node(nt, 'ShaderNodeTexCoord', loc)
    return tc.outputs['Object']


def mat_tiles(name, c1, c2, tw=0.3, th=0.15, mortar=0.007, rough=0.82, mort='#6d6a64'):
    """贴砖立面 + 污渍 + AO。

    三层，缺一层就假：
      1. Brick 砖缝 —— 尺度的来源，用 Object 坐标所以砖是真实尺寸
      2. 竖向拉长的噪声 —— 雨水顺着墙往下淌，脏是竖的，不是圆的
      3. AO 节点 —— 凹处、接缝、贴地处自然变暗（接触阴影）

    第 3 点是关键。没有接触阴影，所有面看起来都像"漂在空中"的塑料板。
    """
    m, nt, p = C.base_mat(name, C.hexc(c1), rough, spec=0.28)
    br = C.node(nt, 'ShaderNodeTexBrick', (-900, 220))
    nt.links.new(obj_coord(nt), br.inputs['Vector'])
    br.inputs['Scale'].default_value = 1.0
    br.inputs['Brick Width'].default_value = tw
    br.inputs['Row Height'].default_value = th
    br.inputs['Mortar Size'].default_value = mortar
    br.inputs['Color1'].default_value = C.hexc(c1)
    br.inputs['Color2'].default_value = C.hexc(c2)
    br.inputs['Mortar'].default_value = C.hexc(mort)
    br.inputs['Bias'].default_value = 0.0

    # 竖向雨痕：把噪声在 Z 上压扁 → 拉成一条条竖直的脏
    mp = C.node(nt, 'ShaderNodeMapping', (-1100, -180))
    mp.inputs['Scale'].default_value = (1.0, 1.0, 0.06)
    nt.links.new(obj_coord(nt), mp.inputs['Vector'])
    streak = C.node(nt, 'ShaderNodeTexNoise', (-900, -180))
    streak.inputs['Scale'].default_value = 6.0
    streak.inputs['Detail'].default_value = 6.0
    nt.links.new(mp.outputs['Vector'], streak.inputs['Vector'])
    sramp = C.node(nt, 'ShaderNodeValToRGB', (-680, -180))
    sramp.color_ramp.elements[0].position = 0.45
    sramp.color_ramp.elements[0].color = (1, 1, 1, 1)
    sramp.color_ramp.elements[1].position = 0.78
    sramp.color_ramp.elements[1].color = C.hexc('#9a9287')
    nt.links.new(streak.outputs['Fac'], sramp.inputs['Fac'])

    # 接触阴影
    ao = C.node(nt, 'ShaderNodeAmbientOcclusion', (-680, 460))
    ao.inputs['Distance'].default_value = 0.55
    ao.samples = 8
    ao.only_local = False
    aor = C.node(nt, 'ShaderNodeValToRGB', (-480, 460))
    aor.color_ramp.elements[0].position = 0.28
    aor.color_ramp.elements[0].color = (0.55, 0.54, 0.52, 1)
    aor.color_ramp.elements[1].position = 0.85
    aor.color_ramp.elements[1].color = (1, 1, 1, 1)
    nt.links.new(ao.outputs['AO'], aor.inputs['Fac'])

    mul = C.node(nt, 'ShaderNodeMix', (-260, 260))
    mul.data_type = 'RGBA'
    mul.blend_type = 'MULTIPLY'
    mul.inputs['Factor'].default_value = 1.0
    nt.links.new(br.outputs['Color'], mul.inputs[6])
    nt.links.new(sramp.outputs['Color'], mul.inputs[7])

    mul2 = C.node(nt, 'ShaderNodeMix', (-60, 260))
    mul2.data_type = 'RGBA'
    mul2.blend_type = 'MULTIPLY'
    mul2.inputs['Factor'].default_value = 1.0
    nt.links.new(mul.outputs[2], mul2.inputs[6])
    nt.links.new(aor.outputs['Color'], mul2.inputs[7])
    nt.links.new(mul2.outputs[2], p.inputs['Base Color'])

    # 粗糙度也跟着脏走：脏的地方更糙，干净的地方略有一点反光
    rr = C.node(nt, 'ShaderNodeValToRGB', (-260, -160))
    rr.color_ramp.elements[0].position = 0.2
    rr.color_ramp.elements[0].color = (rough * 0.72,) * 3 + (1,)
    rr.color_ramp.elements[1].position = 0.9
    rr.color_ramp.elements[1].color = (min(1.0, rough * 1.12),) * 3 + (1,)
    nt.links.new(streak.outputs['Fac'], rr.inputs['Fac'])
    nt.links.new(rr.outputs['Color'], p.inputs['Roughness'])

    h = C.node(nt, 'ShaderNodeMix', (-260, -460))
    h.data_type = 'FLOAT'
    h.inputs['Factor'].default_value = 0.6
    nt.links.new(br.outputs['Fac'], h.inputs[2])
    nt.links.new(streak.outputs['Fac'], h.inputs[3])
    bmp = C.node(nt, 'ShaderNodeBump', (-40, -460))
    bmp.inputs['Strength'].default_value = 0.45
    bmp.inputs['Distance'].default_value = 0.004
    nt.links.new(h.outputs[0], bmp.inputs['Height'])
    nt.links.new(bmp.outputs['Normal'], p.inputs['Normal'])
    return m


def mat_asphalt(name='asphalt', wet=0.55):
    """湿沥青：粗糙度用噪声做成斑块，低的地方就是积水，会自然反射招牌。"""
    m, nt, p = C.base_mat(name, C.hexc('#33343a'), 0.42, spec=0.4)
    n = C.node(nt, 'ShaderNodeTexNoise', (-820, 120))
    n.inputs['Scale'].default_value = 1.4
    n.inputs['Detail'].default_value = 8.0
    r = C.node(nt, 'ShaderNodeValToRGB', (-560, 120))
    r.color_ramp.elements[0].position = 0.35
    r.color_ramp.elements[0].color = C.hexc('#22232a')
    r.color_ramp.elements[1].position = 0.75
    r.color_ramp.elements[1].color = C.hexc('#4a4b53')
    nt.links.new(n.outputs['Fac'], r.inputs['Fac'])
    nt.links.new(r.outputs['Color'], p.inputs['Base Color'])

    rough = C.node(nt, 'ShaderNodeValToRGB', (-560, -160))
    rough.color_ramp.elements[0].position = 0.30
    rough.color_ramp.elements[0].color = (0.06, 0.06, 0.06, 1)
    rough.color_ramp.elements[1].position = 0.62
    rough.color_ramp.elements[1].color = (wet, wet, wet, 1)
    nt.links.new(n.outputs['Fac'], rough.inputs['Fac'])
    nt.links.new(rough.outputs['Color'], p.inputs['Roughness'])

    fine = C.node(nt, 'ShaderNodeTexNoise', (-820, -420))
    fine.inputs['Scale'].default_value = 380.0
    fine.inputs['Detail'].default_value = 6.0
    b = C.node(nt, 'ShaderNodeBump', (-560, -420))
    b.inputs['Strength'].default_value = 0.22
    b.inputs['Distance'].default_value = 0.004
    nt.links.new(fine.outputs['Fac'], b.inputs['Height'])
    nt.links.new(b.outputs['Normal'], p.inputs['Normal'])
    return m


def mat_panel(name, c1, c2, scale=1.0, rough=0.6):
    m, nt, p = C.base_mat(name, C.hexc(c1), rough, spec=0.35)
    n = C.node(nt, 'ShaderNodeTexNoise', (-800, 100))
    n.inputs['Scale'].default_value = 3.0 * scale
    n.inputs['Detail'].default_value = 7.0
    r = C.node(nt, 'ShaderNodeValToRGB', (-560, 100))
    r.color_ramp.elements[0].color = C.hexc(c2)
    r.color_ramp.elements[1].color = C.hexc(c1)
    nt.links.new(n.outputs['Fac'], r.inputs['Fac'])
    nt.links.new(r.outputs['Color'], p.inputs['Base Color'])
    b = C.node(nt, 'ShaderNodeBump', (-320, -180))
    b.inputs['Strength'].default_value = 0.1
    b.inputs['Distance'].default_value = 0.004
    nt.links.new(n.outputs['Fac'], b.inputs['Height'])
    nt.links.new(b.outputs['Normal'], p.inputs['Normal'])
    return m


def mat_metal(name, c, rough=0.42, metal=0.85):
    m, nt, p = C.base_mat(name, C.hexc(c), rough, metal=metal, spec=0.5)
    n = C.node(nt, 'ShaderNodeTexNoise', (-700, -200))
    n.inputs['Scale'].default_value = 24.0
    n.inputs['Detail'].default_value = 6.0
    b = C.node(nt, 'ShaderNodeBump', (-460, -200))
    b.inputs['Strength'].default_value = 0.12
    nt.links.new(n.outputs['Fac'], b.inputs['Height'])
    nt.links.new(b.outputs['Normal'], p.inputs['Normal'])
    return m


def mat_frosted(name, c='#cfd8d4', rough=0.34):
    m, nt, p = C.base_mat(name, C.hexc(c), rough, spec=0.5)
    C.setin(p, 'Transmission Weight', 0.35)
    C.setin(p, 'Alpha', 0.85)
    return m


def mat_emit(name, c, s):
    h = C.hexc(c)
    return C.mat_emit(name, (h[0], h[1], h[2], 1), s)


# ══════════════ 建筑零件 ══════════════
def window_unit(x, y, z, w, h, mat, face_y, out=1.0, frame=None, bars=1):
    """一扇窗：外框（凸出 6cm 的窗套）+ 玻璃 + 竖梃。
    凹进去的深度是窗户"真"的唯一来源，只贴一张发光片一定假。"""
    fr = frame or M['frame']
    box('winframe', w + 0.18, 0.16, h + 0.18, x, face_y + out * 0.07, z, fr)
    box('winglass', w, 0.05, h, x, face_y + out * 0.10, z, mat)
    for i in range(1, bars + 1):
        box('mull', 0.055, 0.09, h, x - w / 2 + w * i / (bars + 1), face_y + out * 0.13, z, fr)
    box('mull_h', w, 0.09, 0.05, x, face_y + out * 0.13, z, fr)


def ac_unit(x, y, z, rot=0.0):
    """空调外机 + 支架 + 冷媒管。外机是居民楼立面最有效的一层"生活噪点"。"""
    r = pgroup(x, y, z, rot)
    part(r, 0.86, 0.34, 0.6, 0, 0, 0, M['ac'], 0.02)
    part(r, 0.62, 0.03, 0.42, 0, -0.18, 0, M['ac_grill'])
    part(r, 0.9, 0.06, 0.06, 0, 0, -0.33, M['metal'])
    cyl('pipe', 0.035, 1.2, 0, 0, 0, M['pipe'], 10).parent = r
    bpy.context.object.location = (x + 0.34 * math.cos(rot), y + 0.34 * math.sin(rot), z - 0.85)


def laundry(x, y, z, n=3, seed=0):
    rng = random.Random(seed)
    cyl('pole', 0.018, 2.2, x, y, z, M['metal'], 8, rot=(0, math.radians(90), 0))
    for i in range(n):
        dx = -0.8 + i * (1.6 / max(1, n - 1))
        w = rng.uniform(0.28, 0.46)
        h = rng.uniform(0.42, 0.72)
        box('cloth', w, 0.012, h, x + dx, y, z - h / 2 - 0.03,
            M[rng.choice(('cloth1', 'cloth2', 'cloth3'))], rot=(0, 0, rng.uniform(-0.14, 0.14)))
        box('clip', 0.03, 0.03, 0.05, x + dx, y, z - 0.02, M['metal'])


def pot_plant(x, y, z, s=1.0):
    cyl('pot', 0.13 * s, 0.26 * s, x, y, z + 0.13 * s, M['terracotta'], 14)
    C.blob(x, y, z + 0.38 * s, 0.21 * s, 'leaf', 0.8, 0.22, 2)
    C.blob(x + 0.1 * s, y + 0.06 * s, z + 0.5 * s, 0.14 * s, 'leaf2', 0.8, 0.22, 2)


def point(x, y, z, energy=120.0, color=(1.0, 0.82, 0.62), radius=0.28):
    d = bpy.data.lights.new('pl', 'POINT')
    d.energy = energy
    d.color = color
    d.shadow_soft_size = radius
    o = bpy.data.objects.new('pl', d)
    o.location = (x, y, z)
    bpy.context.scene.collection.objects.link(o)
    return o


def car(x, y, rot=0.0, matn='car_paint', seed=0):
    """路边停的车：城市尺度靠它锚定。车窗暗、漆面亮，反光就是湿街道的一半。"""
    r = pgroup(x, y, 0.0, rot)
    part(r, 1.72, 3.55, 0.62, 0, 0, 0.62, M[matn], 0.06)
    part(r, 1.66, 3.3, 0.34, 0, 0, 0.96, M[matn], 0.05)
    part(r, 1.52, 1.95, 0.62, 0, 0.12, 1.42, M[matn], 0.07)
    part(r, 1.55, 1.82, 0.5, 0, 0.12, 1.45, M['car_glass'])
    part(r, 1.42, 0.04, 0.46, 0, -0.86, 1.44, M['car_glass'])
    part(r, 1.42, 0.04, 0.46, 0, 1.10, 1.44, M['car_glass'])
    for sx in (-0.82, 0.82):
        for sy in (-1.12, 1.12):
            t = cyl('tire', 0.33, 0.2, 0, 0, 0, M['tire'], 18,
                    rot=(0, math.radians(90), 0))
            t.parent = r
            t.location = (sx, sy, 0.33)
    for sx in (-0.62, 0.62):
        part(r, 0.3, 0.05, 0.14, sx, -1.78, 0.78, M['headlight'])
        part(r, 0.3, 0.05, 0.14, sx, 1.78, 0.78, M['taillight'])
    part(r, 1.5, 0.08, 0.12, 0, 1.78, 0.55, M['metal'])
    return r


def pgroup(x, y, z, rot=0.0):
    bpy.ops.object.empty_add(location=(x, y, z), rotation=(0, 0, rot))
    return bpy.context.object


def part(root, sx, sy, sz, px, py, pz, mat, bev=0.0):
    o = C.cube('part', (sx, sy, sz), (px, py, pz))
    C.assign(o, mat)
    if bev > 0:
        C.bevel(o, bev, 2)
    o.parent = root
    return o


def vending(x, y, z, rot=0, seed=0):
    """自动售货机：城市夜景里最可靠的一块光。"""
    rng = random.Random(seed)
    r = pgroup(x, y, z, rot)
    part(r, 1.0, 0.72, 1.86, 0, 0, 0.93, M['vend_body'], 0.02)
    part(r, 0.86, 0.03, 1.3, -0.02, -0.37, 1.16, M['vend_glow'])
    for row in range(3):
        for c in range(6):
            col = rng.choice(('c_red', 'c_blue', 'c_green', 'c_yellow', 'c_white'))
            part(r, 0.085, 0.02, 0.26, -0.34 + c * 0.135, -0.40, 0.9 + row * 0.4, M[col])
    part(r, 0.52, 0.02, 0.16, 0, -0.37, 0.42, M['vend_body'])
    part(r, 0.9, 0.04, 0.05, 0, -0.36, 2.0, M['metal'])


def shop_sign(x, y, z, w=2.2, h=0.6, rot=0, c='#ff8a3c'):
    box('sign', w, 0.12, h, x, y, z, mat_emit('sign_' + str(round(x, 1)) + str(round(y, 1)), c, 4.0),
        rot=(0, 0, rot), bev=0.02)
    box('sign_back', w + 0.1, 0.16, h + 0.12, x, y + 0.05, z, M['metal'], rot=(0, 0, rot))


def awning(x, y, z, w, rot=0):
    box('awn', w, 1.1, 0.06, x, y, z, M['awning'],
        rot=(math.radians(-14), 0, rot), bev=0.01)


def utility_pole(x, y, h=10.0, flip=1):
    cyl('pole', 0.15, h, x, y, h / 2, M['pole_mat'], 16)
    for i, z in enumerate((h - 0.7, h - 1.7)):
        box('arm', 1.7, 0.09, 0.09, x, y, z, M['pole_mat'])
        for sx in (-0.7, 0, 0.7):
            cyl('ins', 0.055, 0.16, x + sx, y, z + 0.12, M['insul'], 10)
    cyl('trafo', 0.28, 0.85, x + 0.28 * flip, y - 0.32, h - 3.0, M['metal'], 16)
    box('box', 0.34, 0.22, 0.5, x - 0.2 * flip, y - 0.2, 4.4, M['metal'])


# ══════════════ 场景 1：居民楼 ══════════════
def build_sky(horizon, mid, zenith, strength=1.0, ground='#2a2e36',
              sun=None, glow='#ff9c4e', glow_str=4.0, glow_spread=0.12):
    """三层渐变天穹 + 太阳方向的暖辉。

    坑 1：World 的 Generated 是视线方向，Z ∈ [-1, 1]。直接当 0..1 的渐变
    因子用，整片天空都会落在地平线那一档颜色上 —— 就是"一片惨白"。
    必须先 Map Range 压到 0..1。

    坑 2：只按高度分层的天空，在方位角上是完全均匀的。所有立面的天光补光
    一模一样，这是画面"平"的头号原因。加上以太阳方向为中心的辉光后，迎光
    面偏暖偏亮、背光面偏冷偏暗，色调分离就自动出来了。
    """
    w = bpy.data.worlds.new('sky')
    bpy.context.scene.world = w
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    out = C.node(nt, 'ShaderNodeOutputWorld', (760, 0))
    coord = C.node(nt, 'ShaderNodeTexCoord', (-1150, 0))
    sep = C.node(nt, 'ShaderNodeSeparateXYZ', (-960, 0))
    nt.links.new(coord.outputs['Generated'], sep.inputs['Vector'])

    mr = C.node(nt, 'ShaderNodeMapRange', (-780, 0))
    mr.inputs['From Min'].default_value = -0.06
    mr.inputs['From Max'].default_value = 0.85
    nt.links.new(sep.outputs['Z'], mr.inputs['Value'])

    ramp = C.node(nt, 'ShaderNodeValToRGB', (-580, 0))
    nt.links.new(mr.outputs[0], ramp.inputs['Fac'])
    els = ramp.color_ramp.elements
    els[0].position = 0.0
    els[0].color = C.hexc(horizon)
    els[1].position = 1.0
    els[1].color = C.hexc(zenith)
    ramp.color_ramp.elements.new(0.33).color = C.hexc(mid)
    ramp.color_ramp.elements.new(0.07).color = C.hexc(ground)

    bg1 = C.node(nt, 'ShaderNodeBackground', (300, 0))
    bg1.inputs['Strength'].default_value = strength
    nt.links.new(ramp.outputs['Color'], bg1.inputs['Color'])

    if sun is None:
        nt.links.new(bg1.outputs['Background'], out.inputs['Surface'])
        return

    nrm = C.node(nt, 'ShaderNodeVectorMath', (-1150, -520))
    nrm.operation = 'NORMALIZE'
    nt.links.new(coord.outputs['Generated'], nrm.inputs[0])
    dot = C.node(nt, 'ShaderNodeVectorMath', (-960, -400))
    dot.operation = 'DOT_PRODUCT'
    nt.links.new(nrm.outputs['Vector'], dot.inputs[0])
    dot.inputs[1].default_value = Vector(sun).normalized()

    lobe = C.node(nt, 'ShaderNodeValToRGB', (-720, -400))
    lobe.color_ramp.interpolation = 'EASE'
    # 角度阈值：Fac 是视线与太阳方向的点积（-1..1）。取 1-spread 意味着
    # 只在太阳附近约 ±28° 内发光。spread 一大，整片天空都会被辉光糊平。
    lobe.color_ramp.elements[0].position = 1.0 - glow_spread
    lobe.color_ramp.elements[0].color = (0, 0, 0, 1)
    lobe.color_ramp.elements[1].position = 1.0
    lobe.color_ramp.elements[1].color = C.hexc(glow)
    nt.links.new(dot.outputs['Value'], lobe.inputs['Fac'])

    gl = C.node(nt, 'ShaderNodeBackground', (60, -400))
    gl.inputs['Strength'].default_value = glow_str
    nt.links.new(lobe.outputs['Color'], gl.inputs['Color'])

    add = C.node(nt, 'ShaderNodeAddShader', (500, -120))
    nt.links.new(bg1.outputs['Background'], add.inputs[0])
    nt.links.new(gl.outputs['Background'], add.inputs[1])
    nt.links.new(add.outputs[0], out.inputs['Surface'])


def cool_fill(loc, target, size=6.0, energy=60.0, color=(0.42, 0.58, 0.92)):
    """背光侧的冷补光。

    这不是"提亮"，是给暗部上色。暗部只有灰阶的时候，画面怎么调都平；
    暗部带一层偏蓝的冷色，暖色的窗光才会立刻跳出来。"""
    d = bpy.data.lights.new('fill', 'AREA')
    d.shape = 'RECTANGLE'
    d.size, d.size_y = size, size * 0.7
    d.energy = energy
    d.color = color
    o = bpy.data.objects.new('fill', d)
    o.location = loc
    C.look_at(o, Vector(target))
    bpy.context.scene.collection.objects.link(o)
    return o


def compositor(bloom=0.0, vignette=0.0):
    """轻量辉光 + 暗角。

    辉光是摄影里高光外溢的物理现象。有它，画面里最亮的那盏灯才成为焦点；
    暗角把视线收回中心。两个都必须很轻 —— 一眼看出是滤镜就废了。

    坑：Blender 5.3 里合成器不再挂在 scene.node_tree 上，而是
    scene.compositing_node_group；Glare 的类型也从属性改成了输入插槽。"""
    scn = bpy.context.scene
    g = bpy.data.node_groups.new('comp', 'CompositorNodeTree')
    g.interface.new_socket('Image', in_out='OUTPUT', socket_type='NodeSocketColor')
    scn.compositing_node_group = g
    nt = g
    rl = C.node(nt, 'CompositorNodeRLayers', (-700, 0))
    prev = rl.outputs['Image']
    if bloom > 0:
        gl = C.node(nt, 'CompositorNodeGlare', (-460, 0))
        gl.inputs['Type'].default_value = 'Fog Glow'
        gl.inputs['Quality'].default_value = 'High'
        gl.inputs['Threshold'].default_value = 0.95
        gl.inputs['Strength'].default_value = bloom
        gl.inputs['Size'].default_value = 0.6
        nt.links.new(prev, gl.inputs['Image'])
        prev = gl.outputs['Image']
    if vignette > 0:
        mask = C.node(nt, 'CompositorNodeEllipseMask', (-460, -320))
        mask.inputs['Size'].default_value = (1.1, 1.1)
        blur = C.node(nt, 'CompositorNodeBlur', (-240, -320))
        blur.inputs['Size'].default_value = (300, 300)
        nt.links.new(mask.outputs[0], blur.inputs['Image'])
        mix = C.node(nt, 'ShaderNodeMix', (0, -80))
        mix.data_type = 'RGBA'
        mix.blend_type = 'MULTIPLY'
        mix.inputs['Factor'].default_value = vignette
        nt.links.new(prev, mix.inputs[6])
        nt.links.new(blur.outputs[0], mix.inputs[7])
        prev = mix.outputs[2]
    out = C.node(nt, 'NodeGroupOutput', (300, 0))
    nt.links.new(prev, out.inputs[0])


def win_key(rng, lit=0.62):
    r = rng.random()
    if r < lit * 0.55:
        return 'win_warm'
    if r < lit * 0.82:
        return 'win_dim'
    if r < lit:
        return 'win_cool'
    return 'win_dark'


def build_materials():
    M.update({
        'asphalt': mat_asphalt('asphalt', 0.5),
        'pave': mat_tiles('pave', '#8f8e88', '#7d7c76', 0.4, 0.4, 0.012, 0.7, '#66655f'),
        'curb': mat_panel('curb', '#a7a59c', '#8f8d84', 4.0, 0.7),
        'paint': mat_panel('paint', '#e8e6dc', '#c9c7bd', 30.0, 0.55),
        'concrete': mat_panel('concrete', '#8d8d88', '#70706b', 2.2, 0.78),
        'concrete_light': mat_panel('concrete_light', '#b3b1a8', '#98968d', 3.0, 0.75),
        'concrete_wall': mat_tiles('concrete_wall', '#9a9791', '#87847e', 1.2, 0.6, 0.006, 0.8, '#6f6d68'),
        'facade': mat_tiles('facade', '#dfd3ba', '#cbbb9d', 0.3, 0.15, 0.007, 0.8, '#8d8477'),
        'facade_a': mat_tiles('facade_a', '#e3d7bd', '#cdbda0', 0.3, 0.15, 0.007, 0.8, '#8d8477'),
        'facade_b': mat_tiles('facade_b', '#d6c8ad', '#c0b094', 0.3, 0.15, 0.007, 0.82, '#867d70'),
        'facade_c': mat_tiles('facade_c', '#e0cdb4', '#c9b295', 0.3, 0.15, 0.007, 0.78, '#8a8174'),
        'facade2': mat_tiles('facade2', '#b9b3a8', '#a59f94', 0.45, 0.22, 0.008, 0.82, '#7d7870'),
        'wall': mat_panel('wall', '#7c7c78', '#6a6a66', 3.0, 0.75),
        'nb_wall': mat_tiles('nb_wall', '#8e8b85', '#7b7872', 0.5, 0.25, 0.007, 0.8, '#65635f'),
        'house': mat_panel('house', '#b6a48c', '#9c8b74', 2.0, 0.8),
        'slab_mat': mat_panel('slab_mat', '#b8b5ac', '#9c998f', 2.0, 0.72),
        'partition': mat_panel('partition', '#c6c3ba', '#aaa79e', 3.0, 0.72),
        'frame': mat_metal('frame', '#c9c6bd', 0.35, 0.6),
        'metal': mat_metal('metal', '#8e9296', 0.34, 0.9),
        'metal_light': mat_metal('metal_light', '#c3c7c9', 0.3, 0.9),
        'pole_mat': mat_panel('pole_mat', '#9c9a93', '#7f7d76', 6.0, 0.7),
        'insul': mat_panel('insul', '#d7d3c6', '#b9b5a8', 12.0, 0.4),
        'cable': mat_metal('cable', '#23252a', 0.55, 0.4),
        'pipe': mat_panel('pipe', '#a8a49b', '#8b877e', 8.0, 0.55),
        'ac': mat_panel('ac', '#d3d1c9', '#b3b1a9', 10.0, 0.55),
        'ac_grill': mat_metal('ac_grill', '#4b4d50', 0.6, 0.5),
        'tank': mat_metal('tank', '#b6bcbd', 0.42, 0.7),
        'roof_mat': mat_metal('roof_mat', '#4a4d50', 0.55, 0.5),
        'shutter': mat_metal('shutter', '#8d9298', 0.5, 0.85),
        'awning': mat_panel('awning', '#4a6b57', '#37503f', 8.0, 0.75),
        'bin': mat_panel('bin', '#5c6357', '#474d43', 10.0, 0.6),
        'bin2': mat_panel('bin2', '#4a5563', '#38414c', 10.0, 0.6),
        'bike': mat_metal('bike', '#2f3238', 0.4, 0.8),
        'terracotta': C.mat_plaster('terracotta', '#b5654a'),
        'leaf': C.mat_leaf('leaf', '#4f6b34', '#2d401a'),
        'leaf2': C.mat_leaf('leaf2', '#3c5726', '#202f12'),
        'bark': C.mat_wood('bark', '#4a3a2c', '#2b2118', axis='Z'),
        # 窗：亮度分三档，暖 / 暗 / 冷。全城统一一种窗光是夜景最廉价的地方。
        'win_warm': mat_emit('win_warm', '#ffcf8f', 11.0),
        'win_dim': mat_emit('win_dim', '#e8a866', 3.6),
        'win_cool': mat_emit('win_cool', '#a8c8e6', 5.5),
        'win_dark': C.base_mat('win_dark', C.hexc('#161b22'), 0.14, metal=0.25)[0],
        'frost': mat_frosted('frost'),
        'glass_night': C.mat_glass('glass_night'),
        'lobby_glow': mat_emit('lobby_glow', '#dfe8ee', 4.0),
        # 便利店
        'tile_floor': mat_tiles('tile_floor', '#bdbab1', '#a9a69d', 0.5, 0.5, 0.01, 0.35, '#9c998f'),
        'ceiling': mat_panel('ceiling', '#c2bfb6', '#a8a59c', 5.0, 0.6),
        'ceil_glow': mat_emit('ceil_glow', '#ffeccd', 1.0),
        'shelf': mat_metal('shelf', '#b9bcbb', 0.45, 0.6),
        'shelf_top': mat_metal('shelf_top', '#d8dbd9', 0.4, 0.5),
        'counter_mat': mat_panel('counter_mat', '#cfae86', '#b08f68', 4.0, 0.5),
        'fridge_glow': mat_emit('fridge_glow', '#dcefff', 1.5),
        'vend_body': mat_panel('vend_body', '#d8dad6', '#bcc0bd', 8.0, 0.45),
        'vend_glow': mat_emit('vend_glow', '#eef6ff', 2.6),
        'fascia_glow': mat_emit('fascia_glow', '#dfe6e8', 0.85),
        'vsign_glow': mat_emit('vsign_glow', '#ffffff', 3.4),
        'glyph': mat_emit('glyph', '#20342c', 0.6),
        'aframe': mat_panel('aframe', '#f0eee4', '#d3d1c7', 6.0, 0.6),
        'shop_glow': mat_emit('shop_glow', '#ffdca8', 5.0),
        'lamp_glow': mat_emit('lamp_glow', '#ffe4b0', 16.0),
        'cloth1': C.mat_plaster('cloth1', '#cfd8de'),
        'cloth2': C.mat_plaster('cloth2', '#c9b8a0'),
        'cloth3': C.mat_plaster('cloth3', '#9fb4bd'),
        'c_red': mat_panel('c_red', '#c0392b', '#96261a', 10.0, 0.6),
        'c_blue': mat_panel('c_blue', '#33689e', '#24507c', 10.0, 0.6),
        'c_green': mat_panel('c_green', '#3f7d4a', '#2c5c36', 10.0, 0.6),
        'c_yellow': mat_panel('c_yellow', '#d8a534', '#b08724', 10.0, 0.6),
        'c_white': mat_panel('c_white', '#e6e3da', '#cbc8bf', 10.0, 0.55),
        'c_orange': mat_panel('c_orange', '#d97a2b', '#b05f1c', 10.0, 0.6),
        'c_pink': mat_panel('c_pink', '#c96a86', '#a04f68', 10.0, 0.6),
        'car_paint': C.base_mat('car_paint', C.hexc('#3c4249'), 0.22, metal=0.55, spec=0.7)[0],
        'car_paint2': C.base_mat('car_paint2', C.hexc('#c8c4b8'), 0.3, metal=0.4, spec=0.6)[0],
        'car_paint3': C.base_mat('car_paint3', C.hexc('#5c2e2c'), 0.28, metal=0.5, spec=0.65)[0],
        'car_glass': C.base_mat('car_glass', C.hexc('#0d1218'), 0.06, metal=0.3, spec=0.8)[0],
        'tire': mat_panel('tire', '#1b1c1e', '#141516', 20.0, 0.75),
        'headlight': mat_emit('headlight', '#dfe6ea', 2.0),
        'taillight': mat_emit('taillight', '#8a1418', 1.4),
    })


# ══════════════ 场景 1：居民楼 ══════════════
def scene_mansion():
    rng = random.Random(11)
    FL, FH = 5, 2.9
    BW, BD = 20.0, 11.0
    fy = 1.5                 # 前立面 y
    base = 0.16
    top = base + FL * FH

    # 地面 + 人行道 + 路缘
    box('ground', 120, 120, 0.2, 0, -30, -0.1, M['asphalt'])
    box('walk', 60, 3.2, 0.2, 0, -0.4, 0.02, M['pave'], bev=0.01)
    box('curb', 60, 0.16, 0.26, 0, -2.1, 0.05, M['curb'], bev=0.02)
    for i in range(20):
        box('line', 2.2, 0.12, 0.02, -28 + i * 3.0, -9.0, 0.02, M['paint'])

    # 主体
    body = box('body', BW, BD, FL * FH, 0, fy + BD / 2, base + FL * FH / 2, M['facade'])
    C.bevel(body, 0.02, 2)
    box('plinth', BW + 0.16, BD + 0.16, 0.5, 0, fy + BD / 2, base + 0.25, M['concrete'])

    # 楼层腰线
    for f in range(FL + 1):
        z = base + f * FH
        box('band', BW + 0.22, 0.14, 0.1, 0, fy - 0.05, z, M['concrete_light'])

    # 阳台 5 开间 × 2-5 层
    bays = 5
    bw = BW / bays
    for f in range(1, FL):
        zs = base + f * FH
        box('slab', BW, 1.5, 0.16, 0, fy - 0.75, zs - 0.08, M['slab_mat'], bev=0.015)
        for b in range(bays + 1):
            px = -BW / 2 + b * bw
            box('part', 0.14, 1.44, 1.06, px, fy - 0.74, zs + 0.53, M['partition'], bev=0.01)
        for b in range(bays):
            cx = -BW / 2 + bw * (b + 0.5)
            # 每户一层薄板，色差很小但足够打破"整面墙一个颜色"的死板
            box('unit', bw - 0.2, 0.05, FH - 0.5, cx, fy - 0.03, zs + FH / 2,
                M[rng.choice(('facade_a', 'facade_b', 'facade_c'))])
            box('rail_glass', bw - 0.22, 0.05, 0.86, cx, fy - 1.46, zs + 0.53, M['frost'])
            box('rail', bw - 0.18, 0.07, 0.05, cx, fy - 1.47, zs + 1.0, M['metal'])
            window_unit(cx, fy, base + f * FH + 1.55, 2.5, 2.05, M[win_key(rng)], fy, -1.0, bars=1)
            if rng.random() < 0.55:
                ac_unit(cx + bw * 0.28, fy - 0.95, zs + 0.35)
            if rng.random() < 0.45:
                laundry(cx - 0.35, fy - 0.9, zs + 1.5, 3, seed=f * 10 + b)
            if rng.random() < 0.5:
                pot_plant(cx - bw * 0.3, fy - 1.1, zs + 0.0, rng.uniform(0.8, 1.15))

    # 一层：入口 + 信箱 + 自行车
    window_unit(-6.2, fy, base + 1.9, 2.2, 1.6, M['win_dim'], fy, -1.0, bars=0)
    window_unit(6.2, fy, base + 1.9, 2.2, 1.6, M['win_dim'], fy, -1.0, bars=0)
    box('entry_glass', 3.0, 0.1, 2.3, 0, fy - 0.02, base + 1.15, M['lobby_glow'])
    for sx in (-1.55, 1.55):
        box('entry_jamb', 0.16, 0.22, 2.5, sx, fy - 0.06, base + 1.25, M['frame'])
    box('entry_mull', 0.08, 0.16, 2.3, 0, fy - 0.1, base + 1.15, M['frame'])
    box('canopy', 4.6, 1.7, 0.18, 0, fy - 0.8, base + 2.75, M['slab_mat'], bev=0.02)
    box('canopy_trim', 4.7, 0.1, 0.28, 0, fy - 1.62, base + 2.72, M['metal'])
    for i in range(8):
        box('mail', 0.26, 0.16, 0.3, -2.9 + i * 0.29, fy - 0.14, base + 0.95, M['metal'])
    for k, bx in enumerate((-3.2, 3.1)):
        bz = 0.16
        for wx in (-0.52, 0.52):
            bpy.ops.mesh.primitive_torus_add(major_radius=0.33, minor_radius=0.022,
                                             location=(bx + wx, -1.0 + k * 0.1, bz + 0.33),
                                             rotation=(math.radians(90), 0, 0))
            C.assign(bpy.context.object, M['metal'])
        box('bframe', 1.0, 0.05, 0.05, bx, -1.0, bz + 0.5, M['bike'])
        box('bsaddle', 0.2, 0.1, 0.06, bx - 0.3, -1.0, bz + 0.72, M['bike'])
        box('bbar', 0.06, 0.4, 0.05, bx + 0.45, -1.0, bz + 0.78, M['bike'])

    # 屋面：女儿墙 + 楼梯间 + 水箱 + 天线
    for (sx, sy, dx, dy) in ((BW + 0.3, 0.24, 0, -BD / 2), (BW + 0.3, 0.24, 0, BD / 2),
                            (0.24, BD, -BW / 2, 0), (0.24, BD, BW / 2, 0)):
        box('parapet', sx, sy, 0.55, dx, fy + BD / 2 + dy, top + 0.27, M['concrete'], bev=0.02)
    box('penthouse', 4.0, 3.0, 2.4, -4.0, fy + BD / 2 + 1.0, top + 1.2, M['concrete'], bev=0.02)
    cyl('tank', 1.05, 2.0, 5.2, fy + BD / 2 + 1.5, top + 1.9, M['tank'], 24)
    for sx, sy in ((-0.7, -0.7), (0.7, -0.7), (-0.7, 0.7), (0.7, 0.7)):
        box('tankleg', 0.08, 0.08, 1.0, 5.2 + sx, fy + BD / 2 + 1.5 + sy, top + 0.4, M['metal'])
    cyl('mast', 0.05, 3.2, 7.6, fy + BD / 2 + 2.0, top + 2.9, M['metal'], 8)
    for i in range(3):
        box('antenna', 0.9 - i * 0.2, 0.04, 0.04, 7.6, fy + BD / 2 + 2.0, top + 3.4 + i * 0.45, M['metal'])
        cyl('vent', 0.16, 0.7, -8 + i * 3.4, fy + BD / 2 + 2.2, top + 0.35, M['metal'], 12)

    # 排水立管：竖线是立面的骨架
    for px in (-BW / 2 + 0.4, 0.0, BW / 2 - 0.4):
        cyl('drain', 0.08, FL * FH, px, fy - 0.1, base + FL * FH / 2, M['pipe'], 10)

    # 绿篱 + 树
    for i in range(26):
        x = -11 + i * 0.86
        C.blob(x, -0.35 + rng.uniform(-0.1, 0.1), 0.42, 0.42, 'leaf2', 0.75, 0.2, 2)
    C.broadleaf(-19.5, 2.2, 1.15, seed=3)
    C.broadleaf(15.0, 1.2, 0.95, seed=9)

    # 街道设施
    utility_pole(-13.0, -1.4, 10.5, 1)
    utility_pole(15.5, -1.6, 9.6, -1)
    for z in (9.8, 8.8):
        for sx in (-0.7, 0, 0.7):
            wire('w', (-13 + sx, -1.4, z), (15.5 + sx, -1.6, z - 0.6), sag=1.5)
    wire('w2', (-13, -1.4, 8.8), (-2.0, fy - 0.2, 8.0), sag=0.8)
    cyl('lamp', 0.09, 6.2, -7.5, -1.85, 3.1, M['pole_mat'], 12)
    cyl('lamp_arm', 0.06, 1.6, -7.5, -2.55, 6.2, M['pole_mat'], 10, rot=(math.radians(90), 0, 0))
    box('lamp_head', 0.5, 0.28, 0.12, -7.5, -3.3, 6.16, M['lamp_glow'], bev=0.03)
    vending(7.6, -0.5, 0.14, 0, seed=5)
    for i, cm in enumerate(('bin', 'bin2', 'bin')):
        cyl('trash', 0.26, 0.85, 9.4 + i * 0.6, -0.7, 0.55, M[cm], 16)
    cyl('manhole', 0.42, 0.03, -3.0, -7.0, 0.015, M['metal'], 24)
    for i in range(7):
        box('zebra', 0.55, 4.2, 0.02, 6.5 + i * 0.95, -4.6, 0.02, M['paint'])

    # 光：3/4 侧逆光，让阳台隔板把光切成一条条
    SUN = (0.55, 0.74, -0.38)
    build_sky('#ff9245', '#1c3468', '#04070f', 0.20,
              sun=(-SUN[0], -SUN[1], -SUN[2]), glow='#ff9a45', glow_str=7.0, glow_spread=0.10)
    C.build_sun(SUN, 11.0, (1.0, 0.64, 0.34), 1.5)
    cool_fill((16.0, -10.0, 6.5), (1.0, 5.5, 5.0), 12.0, 45, (0.32, 0.50, 1.0))
    point(-7.5, -3.3, 5.9, 700, (1.0, 0.78, 0.52), 0.4)
    car(-4.2, -6.2, math.radians(96))
    car(9.0, -14.0, math.radians(-90), 'car_paint2')
    C.build_haze(0.0004, (0.26, 0.40, 0.70), 160)
    C.camera((-13.0, -8.2, 2.1), Vector((1.2, 6.0, 6.2)), 25, 6.3, 13.0)


# ══════════════ 场景 2：便利店 ══════════════
def scene_konbini():
    rng = random.Random(23)
    SW, SD, SH = 9.6, 7.0, 3.5          # 店面宽 / 进深 / 檐高

    box('ground', 120, 120, 0.2, 0, -20, -0.1, M['asphalt'])
    box('walk', 34, 4.0, 0.22, 0, -0.6, 0.02, M['pave'], bev=0.01)
    box('curb', 34, 0.14, 0.28, 0, -2.6, 0.05, M['curb'])
    for i in range(4):
        box('line', 0.12, 4.6, 0.02, -6.5 + i * 4.2, -5.2, 0.02, M['paint'])

    # 店内
    box('floor_in', SW - 0.3, SD - 0.3, 0.06, 0, SD / 2, 0.18, M['tile_floor'])
    box('ceil', SW, SD, 0.12, 0, SD / 2, SH - 0.06, M['ceiling'])
    for i in range(3):
        box('strip', 0.24, SD - 1.4, 0.06, -2.6 + i * 2.6, SD / 2, SH - 0.14, M['ceil_glow'])
    for r, sy in enumerate((2.0, 3.4, 4.8)):
        box('shelf', 6.4, 0.7, 1.75, -0.6, sy, 0.98, M['shelf'], bev=0.01)
        for lv in range(4):
            box('shelfb', 6.4, 0.75, 0.04, -0.6, sy, 0.28 + lv * 0.48, M['shelf_top'])
            for c in range(18):
                if rng.random() < 0.12:
                    continue
                col = rng.choice(('c_red', 'c_blue', 'c_green', 'c_yellow',
                                  'c_white', 'c_orange', 'c_pink'))
                box('prod', 0.24, 0.16, 0.24, -3.6 + c * 0.34, sy - 0.12,
                    0.42 + lv * 0.48, M[col])
    box('fridge', 6.0, 0.8, 2.3, -0.8, SD - 0.5, 1.3, M['metal_light'], bev=0.02)
    box('fridge_glass', 5.8, 0.06, 1.9, -0.8, SD - 0.95, 1.4, M['fridge_glow'])
    for i in range(5):
        box('fg', 0.06, 0.08, 1.9, -3.6 + i * 1.4, SD - 0.98, 1.4, M['metal_light'])
    box('counter', 3.2, 0.9, 1.0, 2.9, 1.3, 0.6, M['counter_mat'], bev=0.02)
    box('counter_top', 3.3, 1.0, 0.07, 2.9, 1.3, 1.13, M['metal_light'])
    box('reg', 0.5, 0.4, 0.22, 3.4, 1.2, 1.28, M['metal'])
    cyl('person', 0.2, 1.6, 3.5, 2.2, 0.9, M['cloth1'], 12)

    # 立面
    box('wall_l', 0.3, SD, SH, -SW / 2, SD / 2, SH / 2, M['wall'])
    box('wall_r', 0.3, SD, SH, SW / 2, SD / 2, SH / 2, M['wall'])
    box('wall_back', SW, 0.3, SH, 0, SD, SH / 2, M['wall'])
    box('wall_top', SW, 0.35, 0.5, 0, 0.05, SH - 0.25, M['wall'])
    for gx, gw in ((-2.6, 4.0), (2.4, 5.0)):
        box('glass', gw, 0.05, 2.55, gx, -0.02, 1.55, M['glass_night'])
    for i in range(6):
        box('mull', 0.1, 0.14, 2.6, -4.6 + i * 1.85, -0.04, 1.55, M['metal_light'])
    box('door_frame', 2.2, 0.14, 2.6, -0.2, -0.04, 1.55, M['metal_light'])
    box('door_glass', 2.0, 0.04, 2.4, -0.2, -0.06, 1.5, M['glass_night'])
    box('door_bar', 0.06, 0.1, 1.0, -1.0, -0.12, 1.5, M['metal'])
    box('door_bar', 0.06, 0.1, 1.0, 0.6, -0.12, 1.5, M['metal'])

    # 招牌带
    box('fascia', SW + 0.4, 0.45, 1.0, 0, -0.2, SH - 0.05, M['fascia_glow'], bev=0.02)
    box('stripe1', SW + 0.42, 0.46, 0.16, 0, -0.21, SH - 0.36, mat_emit('st1', '#2f9e5f', 5.0))
    box('stripe2', SW + 0.42, 0.46, 0.16, 0, -0.21, SH + 0.26, mat_emit('st2', '#e2523c', 5.0))
    for i in range(6):
        box('glyph', 0.34, 0.06, 0.34, -3.4 + i * 1.25, -0.44, SH - 0.02, M['glyph'])
    box('vsign', 0.16, 1.0, 2.6, -SW / 2 - 0.1, 0.9, SH - 1.4, M['vsign_glow'], bev=0.02)
    for i in range(4):
        box('vchar', 0.06, 0.5, 0.42, -SW / 2 - 0.2, 0.9, SH - 0.5 - i * 0.6, M['glyph'])

    # 店外设备
    box('icebox', 1.5, 0.9, 1.0, -5.7, -0.75, 0.62, M['metal_light'], bev=0.02)
    box('ice_lid', 1.55, 0.95, 0.08, -5.7, -0.75, 1.15, M['metal'])
    for i, cm in enumerate(('bin', 'bin2', 'bin')):
        cyl('trash', 0.27, 0.9, 5.6 + i * 0.62, -0.8, 0.57, M[cm], 16)
    vending(-6.1, -1.9, 0.12, math.radians(-12), seed=3)
    vending(-4.7, -1.9, 0.12, math.radians(-12), seed=8)
    box('aframe', 0.9, 0.1, 1.1, 4.2, -2.0, 0.6, M['aframe'], rot=(math.radians(-8), 0, 0), bev=0.02)
    box('aframe2', 0.9, 0.1, 1.1, 4.2, -2.2, 0.6, M['aframe'], rot=(math.radians(8), 0, 0), bev=0.02)
    for wx in (-0.5, 0.5):
        bpy.ops.mesh.primitive_torus_add(major_radius=0.33, minor_radius=0.022,
                                         location=(2.0 + wx, -1.35, 0.49),
                                         rotation=(math.radians(90), 0, 0))
        C.assign(bpy.context.object, M['metal'])
    box('bframe', 0.95, 0.05, 0.05, 2.0, -1.35, 0.66, M['bike'])

    # 左邻矮墙 + 绿篱，收住画面左下
    for i in range(16):
        C.blob(-12.0 + i * 0.62, -1.5, 0.5, 0.4, 'leaf2', 0.8, 0.2, 2)
    box('lowwall', 9.0, 0.28, 0.55, -8.2, -1.85, 0.28, M['concrete'], bev=0.015)

    # 邻栋
    box('nb1', 9.0, 10.0, 12.5, 10.5, 4.0, 6.3, M['nb_wall'], bev=0.02)
    for f in range(4):
        for c in range(4):
            window_unit(7.0 + c * 2.2, 4.0 - 5.0, 2.2 + f * 3.0, 1.3, 1.5,
                        M[win_key(rng, 0.5)], 4.0 - 5.0, 1.0, bars=0)
    box('nb2', 12.0, 9.0, 4.2, -17.5, 5.0, 2.2, M['house'], bev=0.02)
    for sgn in (-1, 1):
        box('roof2', 12.6, 5.4, 0.16, -17.5, 5.0, 5.3, M['roof_mat'],
            rot=(math.radians(sgn * 30), 0, 0))
    for i in range(3):
        window_unit(-20.5 + i * 3.0, 0.5, 2.3, 1.4, 1.2, M[win_key(rng, 0.7)], 0.5, 1.0, bars=0)

    # 电线杆
    utility_pole(-8.6, -2.2, 10.8, 1)
    utility_pole(13.0, -2.4, 9.8, -1)
    for z in (10.0, 9.0):
        for sx in (-0.7, 0, 0.7):
            wire('w', (-8.6 + sx, -2.2, z), (13 + sx, -2.4, z - 0.7), sag=1.6)
    wire('w2', (-8.6, -2.2, 9.0), (-4.8, 0.2, 7.6), sag=0.7)
    cyl('lamp', 0.09, 6.0, 7.4, -2.6, 3.0, M['pole_mat'], 12)
    box('lamp_head', 0.5, 0.28, 0.12, 7.4, -3.8, 6.0, M['lamp_glow'], bev=0.03)
    cyl('lamp_arm', 0.06, 1.3, 7.4, -3.2, 6.0, M['pole_mat'], 10, rot=(math.radians(90), 0, 0))

    # 室内照明：只照亮货架，玻璃后面才不是一块死黑
    for i in range(3):
        d = bpy.data.lights.new('in_light', 'AREA')
        d.shape = 'RECTANGLE'
        d.size, d.size_y = 2.0, 0.6
        d.energy = 14
        d.color = (1.0, 0.94, 0.82)
        o = bpy.data.objects.new('in_light', d)
        o.location = (-2.4 + i * 2.4, 3.4, SH - 0.25)
        bpy.context.scene.collection.objects.link(o)
    d = bpy.data.lights.new('sign_spill', 'AREA')
    d.shape = 'RECTANGLE'
    d.size, d.size_y = 9.0, 1.0
    d.energy = 45
    d.color = (0.95, 0.97, 1.0)
    o = bpy.data.objects.new('sign_spill', d)
    o.location = (0, -1.2, SH + 0.4)
    o.rotation_euler = (math.radians(72), 0, 0)
    bpy.context.scene.collection.objects.link(o)

    SUN = (0.52, 0.76, -0.40)
    build_sky('#ff8b3c', '#19305f', '#03060d', 0.19,
              sun=(-SUN[0], -SUN[1], -SUN[2]), glow='#ff9340', glow_str=6.0, glow_spread=0.11)
    C.build_sun(SUN, 11.0, (1.0, 0.64, 0.34), 1.8)
    cool_fill((12.0, -8.0, 5.5), (0.5, 3.0, 2.4), 10.0, 40, (0.32, 0.50, 1.0))
    point(7.4, -3.8, 5.8, 600, (1.0, 0.80, 0.55), 0.35)
    point(-1.0, -4.6, 4.2, 380, (0.95, 0.97, 1.0), 0.6)
    car(-2.6, -5.4, math.radians(88))
    C.build_haze(0.0006, (0.30, 0.44, 0.72), 150)
    C.camera((-6.4, -6.2, 1.95), Vector((0.9, 3.2, 2.2)), 24, 5.6, 7.5)


# ══════════════ 场景 3：街道 ══════════════
def scene_street():
    rng = random.Random(31)
    ROAD = 7.0
    SW = 2.0
    Y0, Y1 = -26.0, 62.0

    box('ground', 160, 200, 0.2, 0, 18, -0.1, M['asphalt'])
    for sx in (-1, 1):
        box('walk', SW, Y1 - Y0, 0.24, sx * (ROAD / 2 + SW / 2), (Y0 + Y1) / 2, 0.02, M['pave'])
        box('curb', 0.16, Y1 - Y0, 0.3, sx * (ROAD / 2), (Y0 + Y1) / 2, 0.05, M['curb'])
        box('gutter', 0.5, Y1 - Y0, 0.02, sx * (ROAD / 2 - 0.3), (Y0 + Y1) / 2, 0.005, M['concrete'])
    for i in range(14):
        box('dash', 0.14, 2.4, 0.02, 0, -18 + i * 6.0, 0.02, M['paint'])
    for i in range(8):
        box('zebra', 0.6, 4.6, 0.02, -2.9 + i * 0.82, -16.0, 0.02, M['paint'])

    def block(sx, y0, w, h, kind):
        depth = 9.0
        fx = sx * (ROAD / 2 + SW)          # 临街面
        x = fx + sx * depth / 2
        box('b', w, depth, h, x, y0 + w / 2, h / 2,
            M[rng.choice(('facade', 'facade2', 'concrete_wall'))], bev=0.02)
        box('parapet', w + 0.2, 0.2, 0.5, x, y0 + 0.1, h + 0.25, M['concrete'])
        box('parapet', 0.2, depth, 0.5, fx, y0 + w / 2, h + 0.25, M['concrete'])
        if rng.random() < 0.7:
            box('ph', 2.6, 3.0, 2.2, x, y0 + w * 0.5, h + 1.1, M['concrete'], bev=0.02)
        if rng.random() < 0.5:
            cyl('tank', 0.8, 1.6, x, y0 + w * 0.25, h + 1.2, M['tank'], 20)
        floors = max(1, int((h - 3.6) / 3.0))
        cols = max(1, int(w / 2.3))
        for f in range(floors):
            for c in range(cols):
                z = 3.6 + f * 3.0 + 1.2
                yy = y0 + (c + 0.5) * (w / cols)
                box('wf', 0.16, 1.5, 1.75, fx, yy, z, M['frame'])
                box('wg', 0.06, 1.32, 1.55, fx - sx * 0.06, yy, z, M[win_key(rng, 0.62)])
                box('wm', 0.1, 0.05, 1.55, fx - sx * 0.1, yy, z, M['frame'])
                if rng.random() < 0.3:
                    ac_unit(fx - sx * 0.28, yy, z - 1.0, rot=math.radians(90 * sx))
        if kind == 'shop' and w > 5:
            box('shopf', 0.1, w - 1.0, 2.4, fx - sx * 0.03, y0 + w / 2, 1.5, M['shop_glow'])
            for i in range(int(w / 1.5)):
                box('sm', 0.14, 0.08, 2.5, fx - sx * 0.04, y0 + 0.6 + i * 1.5, 1.5, M['metal'])
            awning(fx - sx * 0.6, y0 + w / 2, 3.05, w - 1.4, math.radians(90))
            shop_sign(fx - sx * 0.4, y0 + w / 2, 3.55, w - 1.2, 0.55,
                      0, rng.choice(('#ff8a3c', '#e8433f', '#4fb0d8', '#f0c14b')))
        else:
            box('shutter', 0.1, w - 0.8, 2.5, fx - sx * 0.02, y0 + w / 2, 1.45, M['shutter'])
        if rng.random() < 0.4:
            shop_sign(fx - sx * 0.35, y0 + 0.8, 4.2, 0.5, 2.0,
                      math.radians(90), rng.choice(('#ffb347', '#ff5f4a', '#59c2e8')))

    cur = {-1: Y0 + 11.0, 1: Y0 + 11.0}
    side = 1
    for i in range(20):
        w = rng.uniform(5.5, 9.5)
        h = rng.uniform(6.5, 16.5)
        block(side, cur[side], w, h, 'shop' if rng.random() < 0.45 else 'wall')
        cur[side] += w + rng.uniform(0.4, 1.6)
        if i % 2:
            side = -side

    for i, py in enumerate(range(-14, 56, 13)):
        s = -1 if i % 2 == 0 else 1
        utility_pole(s * (ROAD / 2 + 0.7), py, 10.5 - (i % 2) * 0.4, s)
        if i > 0:
            for dz in (0.0, -0.9):
                for dx in (-0.7, 0, 0.7):
                    wire('cross', (s * (ROAD / 2 + 0.7) + dx, py, 9.7 + dz),
                         (-s * (ROAD / 2 + 0.7) + dx, py - 13, 9.5 + dz), sag=1.0)
    for i in range(4):
        s = -1 if i % 2 == 0 else 1
        ly = -8 + i * 17
        cyl('lamp', 0.09, 6.4, s * (ROAD / 2 + 0.4), ly, 3.2, M['pole_mat'], 12)
        cyl('larm', 0.06, 1.5, s * (ROAD / 2 - 0.3), ly, 6.4, M['pole_mat'], 10,
            rot=(math.radians(90), 0, 0))
        box('lhead', 0.5, 0.3, 0.12, s * (ROAD / 2 - 1.0), ly, 6.36, M['lamp_glow'], bev=0.03)
        point(s * (ROAD / 2 - 1.0), ly, 6.1, 750, (1.0, 0.80, 0.55), 0.4)
    for i in range(5):
        C.broadleaf(-(ROAD / 2 + 1.1), 4 + i * 13, 0.9, seed=i)
        C.broadleaf(ROAD / 2 + 1.1, 10 + i * 12, 0.85, seed=20 + i)
    vending(-(ROAD / 2 - 0.9), -6.0, 0.14, 0, seed=2)
    vending(ROAD / 2 - 1.7, 20.0, 0.14, math.radians(180), seed=6)
    for i in range(4):
        cyl('trash', 0.26, 0.85, -(ROAD / 2 + 0.9) + i * 0.5, -9.5, 0.55, M['bin'], 16)
    cyl('manhole', 0.42, 0.03, 0.8, -3.0, 0.015, M['metal'], 24)
    cyl('manhole', 0.42, 0.03, -1.2, 12.0, 0.015, M['metal'], 24)

    SUN = (0.48, 0.78, -0.36)
    build_sky('#ff9048', '#1b3366', '#03060d', 0.20,
              sun=(-SUN[0], -SUN[1], -SUN[2]), glow='#ff9440', glow_str=7.0, glow_spread=0.10)
    C.build_sun(SUN, 12.0, (1.0, 0.65, 0.35), 1.7)
    cool_fill((14.0, -4.0, 9.0), (0.0, 10.0, 5.0), 14.0, 70, (0.32, 0.50, 1.0))
    car(-(ROAD / 2 - 1.15), 2.0, math.radians(92))
    car(ROAD / 2 - 1.15, 26.0, math.radians(-88), 'car_paint2')
    car(-(ROAD / 2 - 1.15), 41.0, math.radians(92), 'car_paint3')
    C.build_haze(0.0009, (0.28, 0.42, 0.70), 190)
    C.camera((-0.7, -25.0, 2.5), Vector((0.2, 14.0, 4.2)), 38, 4.5, 20.0)


def setup():
    scn = bpy.context.scene
    scn.render.engine = 'CYCLES'
    scn.cycles.samples = SAMPLES
    scn.cycles.use_adaptive_sampling = True
    scn.cycles.adaptive_threshold = 0.02
    scn.cycles.use_denoising = True
    scn.cycles.max_bounces = 8
    scn.cycles.diffuse_bounces = 3
    scn.cycles.glossy_bounces = 3
    scn.cycles.transmission_bounces = 6
    scn.cycles.volume_bounces = 1
    scn.cycles.caustics_reflective = False
    scn.cycles.caustics_refractive = False
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
        got = any(dv.type == 'METAL' for dv in prefs.devices)
        for dv in prefs.devices:
            dv.use = dv.type == 'METAL'
        scn.cycles.device = 'GPU' if got else 'CPU'
        print(f'[city] device={"METAL" if got else "CPU"}', flush=True)
    except Exception:
        scn.cycles.device = 'CPU'
    try:
        scn.view_settings.view_transform = os.environ.get('VT', 'AgX')
        lk = os.environ.get('LOOK', 'AgX - Medium High Contrast')
        try:
            scn.view_settings.look = lk
        except Exception:
            pass
        scn.view_settings.exposure = float(os.environ.get('EV', '-0.35'))
    except Exception:
        pass


def main():
    C.wipe()
    build_materials()
    {'mansion': scene_mansion, 'konbini': scene_konbini, 'street': scene_street}[SCENE]()
    setup()
    scn = bpy.context.scene
    faces = sum(len(o.data.polygons) for o in scn.objects
                if o.type == 'MESH' and o.data)
    print(f'[city] scene={SCENE} objects={len(scn.objects)} faces={faces} '
          f'res={W}x{H} spp={SAMPLES}', flush=True)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    compositor(0.55, 0.32)
    scn.render.filepath = OUT
    bpy.ops.render.render(write_still=True)
    print(f'[city] wrote {OUT}', flush=True)


main()
