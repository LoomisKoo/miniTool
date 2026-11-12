# -*- coding: utf-8 -*-
"""
治愈系场景 Three Takes —— Blender Cycles

"治愈"不是靠滤镜，它有明确的配方，缺一样就不对：

1. 光：低角度暖阳（色温 ~2800K），大环境光托底。阴影要软、要长。
2. 绿：植物要密、要有层次（大树 / 灌木 / 地被）。单一绿色必死，
   至少三个明度的绿叠在一起。
3. 材质：木、陶土、白灰泥、苔藓。全部高粗糙度，没有高光。
4. 色：暖米黄 + 苔绿 + 一点点砖红，饱和度中等，不要鲜艳。
5. 尺度：小。要有能让人判断"这是人能住的地方"的元素 ——
   窗里的暖光、门口的台阶、晾在外面的东西。
6. 空气：极淡的雾，远景稍微发白，画面才有纵深和呼吸感。

用法：
  blender --background --python tools/blender/cozy.py -- <scene> [宽 高 采样]
  scene: cabin | greenhouse | garden
"""
import bpy
import math
import os
import random
import sys
from mathutils import Vector

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
SCENE = ARGS[0] if ARGS and not ARGS[0].isdigit() else 'cabin'
rest = [a for a in ARGS if a.isdigit()]
W = int(rest[0]) if len(rest) > 0 else 1100
H = int(rest[1]) if len(rest) > 1 else 750
SAMPLES = int(rest[2]) if len(rest) > 2 else 48

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(ROOT, 'block', 'tex', f'cozy_{SCENE}.png')


# ══════════════ 基础 ══════════════
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


def smooth(obj):
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj


def base_mat(name, color, rough, metal=0.0, spec=0.4):
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


# ══════════════ 材质 ══════════════
def mat_wood(name, c1='#7a5133', c2='#4e3320', planks=False, axis='Z'):
    """木头：纹理 + 凹凸。planks=True 时叠一层板缝 ——
    建筑上"一根根板子"的信息量，比一块纯色木头高一个数量级。"""
    m, nt, p = base_mat(name, hexc(c1), 0.72)
    wave = node(nt, 'ShaderNodeTexWave', (-900, 60))
    wave.wave_type = 'BANDS'
    wave.bands_direction = axis
    wave.inputs['Scale'].default_value = 3.0
    wave.inputs['Distortion'].default_value = 14.0
    wave.inputs['Detail'].default_value = 6.0
    noise = node(nt, 'ShaderNodeTexNoise', (-900, -240))
    noise.inputs['Scale'].default_value = 35.0
    noise.inputs['Detail'].default_value = 8.0
    mix = node(nt, 'ShaderNodeMix', (-660, 0))
    mix.data_type = 'FLOAT'
    mix.inputs['Factor'].default_value = 0.35
    nt.links.new(wave.outputs['Fac'], mix.inputs[2])
    nt.links.new(noise.outputs['Fac'], mix.inputs[3])
    ramp = node(nt, 'ShaderNodeValToRGB', (-440, 0))
    ramp.color_ramp.elements[0].color = hexc(c2)
    ramp.color_ramp.elements[1].color = hexc(c1)
    nt.links.new(mix.outputs[0], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], p.inputs['Base Color'])

    height = mix.outputs[0]
    if planks:
        br = node(nt, 'ShaderNodeTexBrick', (-900, -480))
        br.inputs['Scale'].default_value = 1.0
        br.inputs['Mortar Size'].default_value = 0.012
        br.inputs['Brick Width'].default_value = 0.24
        br.inputs['Row Height'].default_value = 4.0
        br.inputs['Color1'].default_value = (1, 1, 1, 1)
        br.inputs['Color2'].default_value = (0.7, 0.7, 0.7, 1)
        br.inputs['Mortar'].default_value = (0.1, 0.1, 0.1, 1)
        add = node(nt, 'ShaderNodeMix', (-700, -400))
        add.data_type = 'FLOAT'
        add.inputs['Factor'].default_value = 0.55
        nt.links.new(mix.outputs[0], add.inputs[2])
        nt.links.new(br.outputs['Fac'], add.inputs[3])
        height = add.outputs[0]

    b = node(nt, 'ShaderNodeBump', (-440, -300))
    b.inputs['Strength'].default_value = 0.28
    b.inputs['Distance'].default_value = 0.006
    nt.links.new(height, b.inputs['Height'])
    nt.links.new(b.outputs['Normal'], p.inputs['Normal'])
    return m


def mat_plaster(name='plaster', c='#d8c8ab'):
    m, nt, p = base_mat(name, hexc(c), 0.86, spec=0.25)
    n = node(nt, 'ShaderNodeTexNoise', (-800, -260))
    n.inputs['Scale'].default_value = 60.0
    n.inputs['Detail'].default_value = 8.0
    b = node(nt, 'ShaderNodeBump', (-560, -260))
    b.inputs['Strength'].default_value = 0.18
    b.inputs['Distance'].default_value = 0.004
    nt.links.new(n.outputs['Fac'], b.inputs['Height'])
    nt.links.new(b.outputs['Normal'], p.inputs['Normal'])
    return m


def mat_leaf(name, c1, c2, sss=0.35):
    m, nt, p = base_mat(name, hexc(c1), 0.62)
    setin(p, 'Subsurface Weight', sss)
    setin(p, 'Subsurface Radius', (0.3, 0.5, 0.16))
    n = node(nt, 'ShaderNodeTexNoise', (-760, -240))
    n.inputs['Scale'].default_value = 9.0
    n.inputs['Detail'].default_value = 7.0
    r = node(nt, 'ShaderNodeValToRGB', (-540, -240))
    r.color_ramp.elements[0].color = hexc(c2)
    r.color_ramp.elements[1].color = hexc(c1)
    nt.links.new(n.outputs['Fac'], r.inputs['Fac'])
    nt.links.new(r.outputs['Color'], p.inputs['Base Color'])
    b = node(nt, 'ShaderNodeBump', (-320, -240))
    b.inputs['Strength'].default_value = 0.4
    b.inputs['Distance'].default_value = 0.02
    nt.links.new(n.outputs['Fac'], b.inputs['Height'])
    nt.links.new(b.outputs['Normal'], p.inputs['Normal'])
    return m


def mat_ground(name, c1, c2):
    m, nt, p = base_mat(name, hexc(c1), 0.92, spec=0.2)
    n = node(nt, 'ShaderNodeTexNoise', (-820, -240))
    n.inputs['Scale'].default_value = 3.5
    n.inputs['Detail'].default_value = 10.0
    n.inputs['Roughness'].default_value = 0.7
    r = node(nt, 'ShaderNodeValToRGB', (-600, -240))
    r.color_ramp.elements[0].color = hexc(c2)
    r.color_ramp.elements[1].color = hexc(c1)
    nt.links.new(n.outputs['Fac'], r.inputs['Fac'])
    nt.links.new(r.outputs['Color'], p.inputs['Base Color'])
    fine = node(nt, 'ShaderNodeTexNoise', (-820, -520))
    fine.inputs['Scale'].default_value = 90.0
    fine.inputs['Detail'].default_value = 10.0
    b = node(nt, 'ShaderNodeBump', (-580, -420))
    b.inputs['Strength'].default_value = 0.45
    b.inputs['Distance'].default_value = 0.02
    nt.links.new(fine.outputs['Fac'], b.inputs['Height'])
    nt.links.new(b.outputs['Normal'], p.inputs['Normal'])
    return m


def mat_stone(name='stone', c='#8d8a80'):
    m, nt, p = base_mat(name, hexc(c), 0.8)
    n = node(nt, 'ShaderNodeTexNoise', (-800, -260))
    n.inputs['Scale'].default_value = 22.0
    n.inputs['Detail'].default_value = 9.0
    b = node(nt, 'ShaderNodeBump', (-560, -260))
    b.inputs['Strength'].default_value = 0.4
    b.inputs['Distance'].default_value = 0.01
    nt.links.new(n.outputs['Fac'], b.inputs['Height'])
    nt.links.new(b.outputs['Normal'], p.inputs['Normal'])
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


def mat_water():
    m, nt, p = base_mat('water', hexc('#1d2b28'), 0.05, spec=0.6)
    setin(p, 'IOR', 1.333)
    setin(p, 'Transmission Weight', 0.85)
    n = node(nt, 'ShaderNodeTexNoise', (-720, -220))
    n.inputs['Scale'].default_value = 0.8
    n.inputs['Detail'].default_value = 3.0
    b = node(nt, 'ShaderNodeBump', (-500, -220))
    b.inputs['Strength'].default_value = 0.04
    b.inputs['Distance'].default_value = 0.02
    nt.links.new(n.outputs['Fac'], b.inputs['Height'])
    nt.links.new(b.outputs['Normal'], p.inputs['Normal'])
    return m


def mat_glass(name='glass'):
    m, nt, p = base_mat(name, hexc('#dfeef2'), 0.03)
    setin(p, 'Transmission Weight', 1.0)
    setin(p, 'IOR', 1.5)
    setin(p, 'Specular IOR Level', 0.5)
    return m


M = {}


# ══════════════ 植物 ══════════════
def blob(x, y, z, r, matn, squash=0.78, jitter=0.12, sub=2):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub, radius=r, location=(x, y, z))
    o = bpy.context.object
    o.scale = (1.0, 1.0, squash)
    random.seed(int(abs(x * 131 + y * 71 + z * 37 + r * 1000)))
    for v in o.data.vertices:
        v.co *= 1.0 + random.uniform(-jitter, jitter)
    assign(o, M[matn])
    smooth(o)
    return o


def broadleaf(x, y, s=1.0, seed=0):
    """阔叶树：树干 + 3~4 团叶。轮廓要碎，光才透得进来。"""
    random.seed(seed)
    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.11 * s, depth=3.2 * s,
                                        location=(x, y, 1.6 * s))
    t = bpy.context.object
    assign(t, M['bark'])
    smooth(t)
    blobs = [(-0.9, 0.4, 3.4, 1.15), (0.9, -0.3, 3.5, 1.05),
             (0.1, 0.1, 4.2, 1.35), (0.0, 0.9, 3.0, 0.85)]
    for (dx, dy, dz, r) in blobs:
        blob(x + dx * s, y + dy * s, dz * s, r * s,
             'leaf' if (dx + dy) > 0 else 'leaf2', 0.8, 0.14)


def pine(x, y, s=1.0, seed=0):
    """针叶树：一层层锥。层数够多，剪影才有"树"的感觉。"""
    bpy.ops.mesh.primitive_cylinder_add(vertices=7, radius=0.1 * s, depth=2.4 * s,
                                        location=(x, y, 1.2 * s))
    t = bpy.context.object
    assign(t, M['bark'])
    smooth(t)
    n = 5
    for i in range(n):
        r = (1.5 - i * 0.24) * s
        z = (2.2 + i * 1.05) * s
        bpy.ops.mesh.primitive_cone_add(vertices=9, radius1=r, radius2=r * 0.15,
                                        depth=1.5 * s, location=(x, y, z))
        c = bpy.context.object
        assign(c, M['pine'] if i % 2 else M['leaf2'])
        smooth(c)


def bush(x, y, s=1.0, matn='leaf2'):
    blob(x, y, 0.32 * s, 0.55 * s, matn, 0.7, 0.2, 2)
    blob(x + 0.3 * s, y + 0.2 * s, 0.22 * s, 0.38 * s, 'leaf', 0.7, 0.2, 2)


def grass_tuft(x, y, s=1.0):
    for i in range(3):
        a = i * 2.1
        bx = x + math.cos(a) * 0.18 * s
        by = y + math.sin(a) * 0.18 * s
        blob(bx, by, 0.12 * s, 0.16 * s, 'leaf', 0.5, 0.25, 1)


# ══════════════ 光与空气 ══════════════
def build_sky(horizon, mid, zenith, strength=0.55):
    w = bpy.data.worlds.new('sky')
    bpy.context.scene.world = w
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    bg = node(nt, 'ShaderNodeBackground', (200, 0))
    out = node(nt, 'ShaderNodeOutputWorld', (520, 0))
    coord = node(nt, 'ShaderNodeTexCoord', (-880, 0))
    sep = node(nt, 'ShaderNodeSeparateXYZ', (-680, 0))
    nt.links.new(coord.outputs['Generated'], sep.inputs['Vector'])
    ramp = node(nt, 'ShaderNodeValToRGB', (-440, 0))
    nt.links.new(sep.outputs['Z'], ramp.inputs['Fac'])
    els = ramp.color_ramp.elements
    els[0].position = 0.42
    els[0].color = hexc(horizon)
    els[1].position = 1.0
    els[1].color = hexc(zenith)
    m1 = ramp.color_ramp.elements.new(0.62)
    m1.color = hexc(mid)
    nt.links.new(ramp.outputs['Color'], bg.inputs['Color'])
    bg.inputs['Strength'].default_value = strength
    nt.links.new(bg.outputs['Background'], out.inputs['Surface'])


def build_sun(direction, energy=7.0, color=(1.0, 0.76, 0.5), angle=1.2):
    d = bpy.data.lights.new('sun', 'SUN')
    d.energy = energy
    d.angle = math.radians(angle)
    d.color = color
    o = bpy.data.objects.new('sun', d)
    o.rotation_euler = Vector(direction).normalized().to_track_quat('-Z', 'Y').to_euler()
    bpy.context.scene.collection.objects.link(o)
    return o


def build_haze(density=0.0022, color=(0.85, 0.86, 0.80), size=170.0):
    """极淡的体积雾，用一个有边界的立方体，不要塞进 World。

    坑：把 Volume Scatter 接到 World 的输出上，等于给整个无限空间铺了雾。
    相机看向天空的光线要穿过"无限厚"的雾，天空直接被吞成纯黑。
    必须限定在一个盒子里 —— 盒子够大（170m），边界就看不见了。

    这一步是"呼吸感"的来源：远景自然发白，近景保持清晰，画面才有纵深。
    密度必须很小，0.005 以上就变成雾霾天。"""
    m = bpy.data.materials.new('haze')
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    v = node(nt, 'ShaderNodeVolumePrincipled', (0, 0))
    v.inputs['Density'].default_value = density
    v.inputs['Color'].default_value = (*color, 1)
    v.inputs['Anisotropy'].default_value = 0.3
    o = node(nt, 'ShaderNodeOutputMaterial', (320, 0))
    nt.links.new(v.outputs[0], o.inputs['Volume'])

    bpy.ops.mesh.primitive_cube_add(size=size, location=(0, 0, size * 0.42))
    c = bpy.context.object
    c.name = 'haze'
    assign(c, m)
    c.visible_shadow = False


def look_at(obj, target):
    obj.rotation_euler = (target - obj.location).to_track_quat('-Z', 'Y').to_euler()


def camera(loc, target, lens=35, fstop=5.6, focus=10.0):
    d = bpy.data.cameras.new('cam')
    d.lens = lens
    d.sensor_width = 36
    d.dof.use_dof = True
    d.dof.aperture_fstop = fstop
    d.dof.focus_distance = focus
    c = bpy.data.objects.new('cam', d)
    c.location = loc
    look_at(c, Vector(target))
    bpy.context.scene.collection.objects.link(c)
    bpy.context.scene.camera = c


# ══════════════ 场景 1：林间小屋 ══════════════
def scene_cabin():
    W_, D_, H_ = 6.4, 5.4, 3.0
    cx, cy = 0.0, 2.0

    bpy.ops.mesh.primitive_plane_add(size=140, location=(0, 0, 0))
    g = bpy.context.object
    assign(g, M['moss'])
    smooth(g)

    # 屋身：木板墙
    body = cube('body', (W_, D_, H_), (cx, cy, H_ / 2))
    assign(body, M['wood_wall'])
    bevel(body, 0.02, 2)

    # 山墙屋顶：两块斜面
    for sgn in (-1, 1):
        roof = cube('roof', (W_ + 1.1, 3.6, 0.18),
                    (cx, cy + sgn * 1.35, H_ + 0.95),
                    rot=(math.radians(sgn * 34), 0, 0))
        assign(roof, M['roof'])
        bevel(roof, 0.02, 2)
    # 屋脊
    ridge = cube('ridge', (W_ + 1.2, 0.22, 0.16), (cx, cy, H_ + 1.94))
    assign(ridge, M['roof'])

    # 烟囱
    chim = cube('chimney', (0.62, 0.62, 2.2), (cx + 1.9, cy + 1.2, H_ + 1.2))
    assign(chim, M['stone'])
    bevel(chim, 0.02, 2)

    # 门窗：室内暖光从窗里透出来，这是"有人住"的唯一证据
    win = cube('window', (1.5, 0.06, 1.15), (cx - 1.2, cy - D_ / 2 - 0.02, 1.85))
    assign(win, M['glow'])
    for (dx, dz, sw, sh) in ((0, 0.60, 1.62, 0.1), (0, -0.60, 1.62, 0.1),
                             (-0.79, 0, 0.1, 1.22), (0.79, 0, 0.1, 1.22), (0, 0, 0.07, 1.22)):
        b = cube('wf', (sw, 0.1, sh), (cx - 1.2 + dx, cy - D_ / 2 - 0.05, 1.85 + dz))
        assign(b, M['wood_dark'])

    door = cube('door', (1.05, 0.08, 2.1), (cx + 1.5, cy - D_ / 2 - 0.03, 1.05))
    assign(door, M['wood_dark'])
    for i in range(3):
        p = cube('plank', (0.9, 0.02, 0.06), (cx + 1.5, cy - D_ / 2 - 0.08, 0.45 + i * 0.65))
        assign(p, M['wood_wall'])

    # 门廊：两根柱子 + 小雨棚 + 台阶
    for sx in (-1, 1):
        post = cube('post', (0.16, 0.16, 2.35), (cx + 1.5 + sx * 0.9, cy - D_ / 2 - 1.25, 1.18))
        assign(post, M['wood_dark'])
    pr = cube('porch_roof', (2.4, 1.6, 0.14), (cx + 1.5, cy - D_ / 2 - 1.05, 2.42))
    assign(pr, M['roof'])
    bevel(pr, 0.02, 2)
    for i in range(2):
        st = cube('step', (1.5, 0.42, 0.16), (cx + 1.5, cy - D_ / 2 - 0.35 - i * 0.42, 0.08 + i * 0.16))
        assign(st, M['stone'])

    # 石板小路
    random.seed(7)
    for i in range(7):
        y = -2.4 - i * 0.95
        sz = 0.55 + random.random() * 0.25
        s = cube('path', (sz * 1.4, sz, 0.12),
                 (cx + 1.5 + random.uniform(-0.25, 0.25), y, 0.06),
                 rot=(0, 0, random.uniform(-0.3, 0.3)))
        assign(s, M['stone'])
        bevel(s, 0.04, 2)

    # 窗外的花箱
    box = cube('planter', (1.7, 0.42, 0.3), (cx - 1.2, cy - D_ / 2 - 0.28, 1.14))
    assign(box, M['wood_dark'])
    for i in range(6):
        blob(cx - 2.0 + i * 0.33, cy - D_ / 2 - 0.28, 1.34, 0.16, 'flower', 0.8, 0.2, 1)

    # ── 植物：分三层，近中远 ──
    broadleaf(-7.5, 5.5, 1.5, 1)
    broadleaf(8.2, 6.5, 1.35, 2)
    pine(-5.0, 10.5, 1.7, 3)
    pine(5.5, 11.5, 1.55, 4)
    broadleaf(-10.5, -2.5, 1.2, 5)
    pine(11.0, 1.0, 1.3, 6)

    random.seed(11)
    for i in range(16):
        a = random.uniform(0, math.tau)
        r = random.uniform(2.6, 8.5)
        x, y = cx + math.cos(a) * r, cy + math.sin(a) * r * 0.7
        if abs(x) < 3.6 and y < 5.0:
            continue
        bush(x, y, random.uniform(0.7, 1.3), 'leaf2' if i % 2 else 'leaf')
    for i in range(55):
        a = random.uniform(0, math.tau)
        r = random.uniform(3.0, 12.0)
        grass_tuft(cx + math.cos(a) * r, cy + math.sin(a) * r * 0.8, random.uniform(0.7, 1.2))

    build_sky('#f7c894', '#ecd6b6', '#86afd2', strength=0.55)
    # 逆光：太阳在屋后偏左，画面才有轮廓光和长影
    build_sun((0.52, 0.58, -0.63), energy=8.5, color=(1.0, 0.78, 0.52))
    build_haze(0.0011)
    camera((-7.6, -11.8, 2.6), (0.5, 2.6, 2.2), lens=40, fstop=4.0, focus=12.5)


# ══════════════ 场景 2：玻璃温室 ══════════════
def scene_greenhouse():
    bpy.ops.mesh.primitive_plane_add(size=140, location=(0, 0, 0))
    g = bpy.context.object
    assign(g, M['moss'])
    smooth(g)

    # 温室：木框 + 玻璃，坡屋顶
    GW, GD, GH = 7.0, 6.0, 3.4
    base = cube('gh_base', (GW, GD, 0.5), (0, 0, 0.25))
    assign(base, M['stone'])
    bevel(base, 0.03, 2)

    for (sx, sy, w, d) in ((GW, 0.12, GW, 0.12), (GW, 0.12, GW, 0.12)):
        pass
    # 四面玻璃墙
    for (px, py, w, d) in ((0, -GD / 2, GW, 0.05), (0, GD / 2, GW, 0.05),
                           (GW / 2, 0, 0.05, GD), (-GW / 2, 0, 0.05, GD)):
        gl = cube('gh_glass', (w, d, GH), (px, py, 0.5 + GH / 2))
        assign(gl, M['glass'])
    # 木框架：立柱 + 横梁
    for sx in (-1, 0, 1):
        for sy in (-1, 1):
            p = cube('frame_v', (0.11, 0.11, GH), (sx * GW / 2 * (0.98 if sx else 0.0), sy * GD / 2, 0.5 + GH / 2))
            assign(p, M['wood_dark'])
        p2 = cube('frame_v2', (0.11, 0.11, GH), (sx * GW / 2, 0, 0.5 + GH / 2))
        assign(p2, M['wood_dark'])
    for zz in (0.5 + GH * 0.33, 0.5 + GH * 0.66):
        r1 = cube('frame_h', (GW, 0.1, 0.1), (0, -GD / 2, zz))
        assign(r1, M['wood_dark'])
        r2 = cube('frame_h', (GW, 0.1, 0.1), (0, GD / 2, zz))
        assign(r2, M['wood_dark'])
    # 屋顶：两片玻璃坡
    for sgn in (-1, 1):
        r = cube('gh_roof', (GW + 0.5, 3.5, 0.05),
                 (0, sgn * 1.45, 0.5 + GH + 0.75),
                 rot=(math.radians(sgn * 26), 0, 0))
        assign(r, M['glass'])
        rr = cube('gh_rafter', (GW + 0.5, 0.09, 0.09),
                  (0, sgn * 1.45, 0.5 + GH + 0.72),
                  rot=(math.radians(sgn * 26), 0, 0))
        assign(rr, M['wood_dark'])
    # 屋脊
    rg = cube('gh_ridge', (GW + 0.6, 0.14, 0.12), (0, 0, 0.5 + GH + 1.5))
    assign(rg, M['wood_dark'])

    # 室内：花盆 + 植物堆
    random.seed(3)
    for i in range(14):
        px = random.uniform(-GW / 2 + 0.9, GW / 2 - 0.9)
        py = random.uniform(-GD / 2 + 0.9, GD / 2 - 0.9)
        ph = random.uniform(0.3, 0.55)
        pot = cube('pot', (ph * 1.1, ph * 1.1, ph), (px, py, 0.5 + ph / 2))
        assign(pot, M['terracotta'])
        bevel(pot, 0.03, 2)
        n = random.randint(2, 4)
        for k in range(n):
            blob(px + random.uniform(-0.35, 0.35), py + random.uniform(-0.35, 0.35),
                 0.5 + ph + random.uniform(0.35, 1.15),
                 random.uniform(0.35, 0.62),
                 'leaf' if k % 2 else 'leaf2', 0.85, 0.18)
    # 墙边的花箱
    for py in (-GD / 2 + 0.5, GD / 2 - 0.5):
        tb = cube('trough', (GW - 0.6, 0.45, 0.4), (0, py, 0.7))
        assign(tb, M['wood_dark'])
        for i in range(11):
            blob(-GW / 2 + 0.5 + i * 0.6, py, 0.98, 0.19, 'flower' if i % 3 else 'leaf', 0.8, 0.2, 1)

    # 室外绿化
    random.seed(9)
    for i in range(20):
        a = random.uniform(0, math.tau)
        r = random.uniform(5.0, 11.0)
        bush(math.cos(a) * r, math.sin(a) * r, random.uniform(0.7, 1.25),
             'leaf2' if i % 2 else 'leaf')
    broadleaf(-6.0, 7.5, 1.35, 1)
    broadleaf(6.5, 7.0, 1.25, 2)

    build_sky('#f9cf98', '#ecd7b8', '#88b1d4', strength=0.55)
    build_sun((0.50, 0.56, -0.66), energy=8.5, color=(1.0, 0.78, 0.52))
    build_haze(0.0010)
    camera((-7.5, -12.5, 2.2), (0.3, 0.6, 2.2), lens=40, fstop=4.5, focus=12.0)


# ══════════════ 场景 3：日式庭院 ══════════════
def scene_garden():
    bpy.ops.mesh.primitive_plane_add(size=140, location=(0, 0, 0))
    g = bpy.context.object
    assign(g, M['moss'])
    smooth(g)

    # 缘侧（木廊）
    ver = cube('veranda', (9.0, 3.4, 0.42), (0, 7.4, 0.9))
    assign(ver, M['wood_wall'])
    bevel(ver, 0.02, 2)
    for i in range(11):
        p = cube('vplank', (0.02, 3.3, 0.03), (-4.4 + i * 0.88, 7.4, 1.13))
        assign(p, M['wood_dark'])
    # 后墙 + 障子
    wall = cube('wall', (9.0, 0.3, 3.0), (0, 9.3, 1.9))
    assign(wall, M['plaster'])
    for i in range(4):
        sh = cube('shoji', (1.7, 0.06, 2.0), (-3.2 + i * 2.1, 9.12, 1.95))
        assign(sh, M['glow'])

    # 石灯笼
    def lantern(x, y, s=1.0):
        b = cube('lb', (0.7 * s, 0.7 * s, 0.25 * s), (x, y, 0.125 * s))
        assign(b, M['stone'])
        col = cube('lc', (0.26, 0.26, 0.9), (x, y, 0.25 * s + 0.45 * s))
        assign(col, M['stone'])
        cap = cube('lcap', (0.62, 0.62, 0.22), (x, y, 0.25 * s + 0.9 * s + 0.11 * s))
        assign(cap, M['stone'])
        bevel(cap, 0.03, 2)
        fire = cube('fire', (0.34, 0.34, 0.34), (x, y, 0.25 * s + 0.9 * s + 0.34 * s))
        assign(fire, M['glow'])
        top = cube('ltop', (0.8, 0.8, 0.14), (x, y, 0.25 * s + 0.9 * s + 0.58 * s))
        assign(top, M['stone'])
        bevel(top, 0.04, 2)

    lantern(-3.2, -1.2, 1.0)

    # 石头（用扁化的 icos 球，比盒子自然得多）
    random.seed(21)
    for i in range(9):
        x = random.uniform(-6.5, 6.5)
        y = random.uniform(-7.0, 3.0)
        r = random.uniform(0.35, 0.95)
        o = blob(x, y, r * 0.42, r, 'rock', 0.52, 0.22, 2)
        o.rotation_euler[2] = random.uniform(0, 3.14)

    # 苔藓团
    for i in range(44):
        x = random.uniform(-7.5, 7.5)
        y = random.uniform(-8.0, 4.0)
        blob(x, y, 0.06, random.uniform(0.3, 0.7), 'moss_soft', 0.22, 0.2, 2)

    # 一棵主枫树 + 几丛竹
    broadleaf(4.8, 2.2, 1.6, 4)
    for i in range(7):
        px = -6.2 + i * 0.34
        bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.055, depth=4.6,
                                            location=(px, 5.6, 2.3))
        st = bpy.context.object
        assign(st, M['bamboo'])
        smooth(st)
        for k in range(3):
            blob(px + random.uniform(-0.3, 0.3), 5.6 + random.uniform(-0.3, 0.3),
                 3.2 + k * 0.75, 0.3, 'leaf', 0.7, 0.2, 1)

    # 水面
    bpy.ops.mesh.primitive_plane_add(size=1, location=(-1.0, -2.6, 0.02))
    wt = bpy.context.object
    wt.scale = (7.0, 5.0, 1)
    bpy.ops.object.transform_apply(scale=True)
    assign(wt, M['water'])

    build_sky('#f6c592', '#ecd6b8', '#86afd2', strength=0.55)
    build_sun((0.48, 0.52, -0.70), energy=8.0, color=(1.0, 0.78, 0.53))
    build_haze(0.0012)
    camera((-5.0, -11.5, 1.7), (0.5, 3.0, 1.9), lens=38, fstop=4.0, focus=11.0)


# ══════════════ 渲染 ══════════════
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
        got = False
        for dv in prefs.devices:
            dv.use = dv.type == 'METAL'
            got = got or dv.use
        scn.cycles.device = 'GPU' if got else 'CPU'
        print(f'[cozy] device={"METAL" if got else "CPU"}', flush=True)
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
        scn.view_settings.exposure = 0.85
    except Exception:
        pass


def main():
    wipe()
    M.update({
        'wood_wall': mat_wood('wood_wall', '#8a5c37', '#5a3a20', planks=True, axis='X'),
        'wood_dark': mat_wood('wood_dark', '#4e3323', '#2e1d10'),
        'roof': mat_wood('roof', '#3f3a32', '#24211c', planks=True, axis='X'),
        'plaster': mat_plaster('plaster', '#dbcbb0'),
        'bark': mat_wood('bark', '#4a3a2c', '#2b2118', axis='Z'),
        'stone': mat_stone('stone', '#8a857b'),
        'rock': mat_stone('rock', '#7a766d'),
        'terracotta': mat_plaster('terracotta', '#b5654a'),
        'bamboo': mat_wood('bamboo', '#7d8a4e', '#4f5a2c', axis='Z'),
        'water': mat_water(),
        'moss': mat_ground('moss', '#4d5c33', '#37421f'),
        'moss_soft': mat_leaf('moss_soft', '#566b36', '#38461f', 0.2),
        'leaf': mat_leaf('leaf', '#4f6b34', '#2d401a'),
        'leaf2': mat_leaf('leaf2', '#3c5726', '#202f12'),
        'pine': mat_leaf('pine', '#33502c', '#1b2a16', 0.18),
        'flower': mat_leaf('flower', '#c07a5e', '#8d5340', 0.15),
        'glow': mat_emit('glow', (1.0, 0.66, 0.36, 1), 18.0),
        'glass': mat_glass(),
    })

    {'cabin': scene_cabin, 'greenhouse': scene_greenhouse, 'garden': scene_garden}[SCENE]()

    setup()
    scn = bpy.context.scene
    faces = sum(len(o.data.polygons) for o in scn.objects if o.type == 'MESH')
    print(f'[cozy] scene={SCENE} objects={len(scn.objects)} faces={faces} res={W}x{H} spp={SAMPLES}', flush=True)

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    scn.render.filepath = OUT
    bpy.ops.render.render(write_still=True)
    print(f'[cozy] wrote {OUT}', flush=True)


if __name__ == '__main__':
    main()
