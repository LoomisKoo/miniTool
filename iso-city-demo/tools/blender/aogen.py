# -*- coding: utf-8 -*-
"""
用 Blender Cycles 离线渲染街区地面的 AO（环境光遮蔽）遮罩。

做法：把世界背景设成纯白、地面给一张白色漫反射，配一台正交相机从正上方
俯拍，关掉间接光。于是"地面有多亮"就直接等于"这个点被环境光照到了多少"——
被楼挡住的地方自然变暗。这比 AO 节点更可靠，因为它走的是真实的光线追踪。

运行：
  blender --background --python tools/blender/aogen.py -- <长边像素> <采样数>
"""
import bpy
import json
import sys
import os
import math

LONG_RES = 1024
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
if ARGS and ARGS[0].isdigit():
    LONG_RES = int(ARGS[0])
SAMPLES = int(ARGS[1]) if len(ARGS) > 1 and ARGS[1].isdigit() else 48

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
SRC = os.path.join(HERE, 'out', 'city.json')
DST = os.path.join(ROOT, 'block', 'tex', 'ground_ao.png')


def mat_white():
    m = bpy.data.materials.new('white')
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    d = nt.nodes.new('ShaderNodeBsdfDiffuse')
    d.inputs['Color'].default_value = (1, 1, 1, 1)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(d.outputs['BSDF'], out.inputs['Surface'])
    return m


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scn = bpy.context.scene

    with open(SRC, 'r') as f:
        data = json.load(f)
    boxes = data['boxes']
    g = data['ground']

    mat = mat_white()

    # ── 遮挡体 ──
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0))
    proto = bpy.context.object
    pm = proto.data
    pm.name = 'occ'
    for poly in pm.polygons:
        poly.use_smooth = False
    n = 0
    for b in boxes:
        mn, mx = b['min'], b['max']
        w, h, d = mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]
        if w <= 0 or h <= 0 or d <= 0:
            continue
        o = bpy.data.objects.new('occ', pm)
        scn.collection.objects.link(o)
        # Three.js 是 Y 向上，Blender 是 Z 向上
        o.location = ((mn[0] + mx[0]) / 2, (mn[2] + mx[2]) / 2, (mn[1] + mx[1]) / 2)
        o.scale = (w, d, h)
        o.data.materials.append(mat)
        n += 1
    bpy.data.objects.remove(proto, do_unlink=True)

    # ── 地面 ──
    cw = g['x1'] - g['x0']
    ch = g['z1'] - g['z0']
    bpy.ops.mesh.primitive_plane_add(
        size=1, location=((g['x0'] + g['x1']) / 2, (g['z0'] + g['z1']) / 2, 0)
    )
    ground = bpy.context.object
    ground.scale = (cw, ch, 1)
    ground.data.materials.append(mat)

    # ── 纯白环境光：均匀白光下，地面亮度就是遮蔽程度 ──
    world = bpy.data.worlds.new('env')
    scn.world = world
    world.use_nodes = True
    wnt = world.node_tree
    wnt.nodes.clear()
    bg = wnt.nodes.new('ShaderNodeBackground')
    bg.inputs['Color'].default_value = (1, 1, 1, 1)
    bg.inputs['Strength'].default_value = 1.0
    wo = wnt.nodes.new('ShaderNodeOutputWorld')
    wnt.links.new(bg.outputs['Background'], wo.inputs['Surface'])

    # ── 正交俯视相机 ──
    cam_data = bpy.data.cameras.new('top')
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = cw
    cam = bpy.data.objects.new('top', cam_data)
    scn.collection.objects.link(cam)
    cam.location = ((g['x0'] + g['x1']) / 2, (g['z0'] + g['z1']) / 2, 400)
    cam.rotation_euler = (0, 0, 0)
    scn.camera = cam

    scn.render.engine = 'CYCLES'
    scn.cycles.device = 'CPU'
    scn.cycles.samples = SAMPLES
    scn.cycles.use_denoising = True
    # 只留一次漫反射：环境光打到地面上就够了。0 会让地面完全收不到光，
    # 2 以上则会带进多次反弹，把遮蔽"照亮"，就不再是 AO 了。
    scn.cycles.max_bounces = 1
    scn.cycles.diffuse_bounces = 1
    scn.cycles.glossy_bounces = 0
    scn.cycles.transmission_bounces = 0
    scn.render.resolution_x = LONG_RES
    scn.render.resolution_y = max(1, round(LONG_RES * ch / cw))
    scn.render.resolution_percentage = 100
    scn.render.film_transparent = False
    scn.render.image_settings.file_format = 'PNG'
    scn.render.image_settings.color_mode = 'BW'
    scn.render.image_settings.color_depth = '8'
    scn.view_settings.view_transform = 'Standard'
    scn.view_settings.look = 'None'

    print(f'[aogen] occ={n} ground={cw:.0f}x{ch:.0f}m res={scn.render.resolution_x}x{scn.render.resolution_y}', flush=True)
    os.makedirs(os.path.dirname(DST), exist_ok=True)
    scn.render.filepath = DST
    bpy.ops.render.render(write_still=True)
    print(f'[aogen] wrote {DST}', flush=True)


main()
