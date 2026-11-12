"""
Blender PBR 贴图工厂（headless）。

    blender --background --python tools/blender/texgen.py -- <输出目录>

每套贴图输出 albedo / normal / roughness 三张 1024 PNG。

所有图案都是"周期可平铺"的：
  * 噪声走 torus 4D 映射（u,v -> (cos,sin,cos,sin)），所以 UV 边界天然无缝；
  * 砖缝 / 拼板缝用 fract() 网格自建，格子数取整数，绕回也不断。
这样在 Three.js 里 RepeatWrapping 平铺不会出现接缝。

albedo 是"细节乘数"而不是颜色：均值 ≈ 0.92，只保留起伏。
真正的色调由 Three.js 里材质本身的 color 决定，这样原有配色方案不会被换掉。
"""

import math
import os
import sys

import bpy

TAU = 2.0 * math.pi
RES = 1024
OUT = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else os.getcwd()


# ---------------------------------------------------------------- node helpers

def m(nt, op, *args):
    n = nt.nodes.new("ShaderNodeMath")
    n.operation = op
    for i, v in enumerate(args):
        if v is None:
            continue
        if isinstance(v, (int, float)):
            n.inputs[i].default_value = v
        else:
            nt.links.new(v, n.inputs[i])
    return n.outputs[0]


def vc(nt, x, y, z):
    n = nt.nodes.new("ShaderNodeCombineXYZ")
    for i, v in enumerate((x, y, z)):
        if isinstance(v, (int, float)):
            n.inputs[i].default_value = v
        else:
            nt.links.new(v, n.inputs[i])
    return n.outputs[0]


def remap(nt, val, fmin, fmax, tmin=0.0, tmax=1.0):
    n = nt.nodes.new("ShaderNodeMapRange")
    n.clamp = True
    n.inputs["From Min"].default_value = fmin
    n.inputs["From Max"].default_value = fmax
    n.inputs["To Min"].default_value = tmin
    n.inputs["To Max"].default_value = tmax
    nt.links.new(val, n.inputs["Value"])
    return n.outputs[0]


def sep_uv(nt):
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sp = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["UV"], sp.inputs[0])
    return sp.outputs[0], sp.outputs[1]


def torus_noise(nt, scale, detail=6.0, rough=0.55, distortion=0.0):
    """UV 上的周期噪声。scale = 每个贴图周期内的噪声循环数。"""
    u, v = sep_uv(nt)
    ax = m(nt, "MULTIPLY", u, scale * TAU)
    ay = m(nt, "MULTIPLY", v, scale * TAU)
    vec = vc(nt, m(nt, "COSINE", ax), m(nt, "SINE", ax), m(nt, "COSINE", ay))
    n = nt.nodes.new("ShaderNodeTexNoise")
    n.noise_dimensions = "4D"
    n.inputs["Scale"].default_value = 1.0
    n.inputs["Detail"].default_value = detail
    n.inputs["Roughness"].default_value = rough
    if "Distortion" in n.inputs:
        n.inputs["Distortion"].default_value = distortion
    nt.links.new(vec, n.inputs["Vector"])
    nt.links.new(m(nt, "SINE", ay), n.inputs["W"])
    return n.outputs["Fac"]


def tile_grid(nt, cols, rows, offset=0.0, gw=0.02, gh=0.02):
    """
    fract() 网格：返回 (mortarMask, fu, fv, cell_x, row)。
    格子数取整数 → 平铺无缝。
    """
    u, v = sep_uv(nt)
    cu = m(nt, "MULTIPLY", u, cols)
    cv = m(nt, "MULTIPLY", v, rows)
    row = m(nt, "FLOOR", cv)
    cu2 = m(nt, "MULTIPLY_ADD", row, offset, cu) if False else m(
        nt, "ADD", cu, m(nt, "MULTIPLY", row, offset))
    fu = m(nt, "FRACT", cu2)
    fv = m(nt, "FRACT", cv)
    mx = m(nt, "MINIMUM", fu, m(nt, "SUBTRACT", 1.0, fu))
    my = m(nt, "MINIMUM", fv, m(nt, "SUBTRACT", 1.0, fv))
    mask = m(nt, "MAXIMUM",
             m(nt, "LESS_THAN", mx, gw),
             m(nt, "LESS_THAN", my, gh))
    return mask, fu, fv, m(nt, "FLOOR", cu2), row


def white_noise(nt, x, y, z=0.0):
    n = nt.nodes.new("ShaderNodeTexWhiteNoise")
    n.noise_dimensions = "3D"
    nt.links.new(vc(nt, x, y, z), n.inputs["Vector"])
    return n.outputs["Value"]


# ---------------------------------------------------------------- presets

def build(nt, kind):
    """返回 (albedo, height, roughness) 三个 socket。"""
    if kind == "concrete":
        mottle = torus_noise(nt, 3, detail=8, rough=0.62)
        fine = torus_noise(nt, 44, detail=4, rough=0.5)
        pores = remap(nt, torus_noise(nt, 130, detail=1, rough=0.4), 0.68, 0.80)
        mask, *_ = tile_grid(nt, 2, 2, gw=0.004, gh=0.004)

        # 中值压在 0.72 左右而不是 0.95：sRGB 曲线在高端很平，基色越接近 1，
        # 贴图的起伏被编码压得越扁 —— 上一版 std 只有 0.02，等于是死图。
        alb = m(nt, "MULTIPLY", remap(nt, mottle, 0.25, 0.75, 0.62, 0.84),
                remap(nt, fine, 0.25, 0.75, 0.86, 1.02))
        alb = m(nt, "MULTIPLY", alb, m(nt, "SUBTRACT", 1.0, m(nt, "MULTIPLY", pores, 0.45)))
        # 拼板缝压深一点，2m 网格在墙上才看得出来
        alb = m(nt, "MULTIPLY", alb, m(nt, "SUBTRACT", 1.0, m(nt, "MULTIPLY", mask, 0.42)))
        height = m(nt, "ADD", m(nt, "MULTIPLY", pores, -0.35), m(nt, "MULTIPLY", mask, -1.0))
        height = m(nt, "ADD", height, m(nt, "MULTIPLY", fine, 0.18))
        rough = remap(nt, m(nt, "ADD", m(nt, "MULTIPLY", fine, 0.6),
                           m(nt, "MULTIPLY", mottle, 0.4)), 0.2, 0.8, 0.72, 1.00)
        return alb, height, rough

    if kind == "brick":
        mask, fu, fv, cx, row = tile_grid(nt, 4, 10, offset=0.5, gw=0.018, gh=0.05)
        tint = white_noise(nt, cx, row, 0.0)
        grain = torus_noise(nt, 90, detail=4, rough=0.6)
        # 每块砖独立色差拉到 ±18%，砖墙的"花"就是靠这个
        alb = m(nt, "MULTIPLY", remap(nt, tint, 0.0, 1.0, 0.60, 1.02),
                remap(nt, grain, 0.25, 0.75, 0.88, 1.04))
        alb = m(nt, "MULTIPLY", alb, m(nt, "SUBTRACT", 1.0, m(nt, "MULTIPLY", mask, 0.55)))
        height = m(nt, "ADD", m(nt, "MULTIPLY", mask, -1.0),
                   m(nt, "MULTIPLY", grain, 0.16))
        rough = remap(nt, mask, 0.0, 1.0, 0.80, 1.02)
        return alb, height, rough

    if kind == "plaster":
        big = torus_noise(nt, 6, detail=7, rough=0.6)
        fine = torus_noise(nt, 70, detail=5, rough=0.55)
        streak = torus_noise(nt, 2, detail=3, rough=0.4, distortion=1.4)
        alb = m(nt, "MULTIPLY", remap(nt, big, 0.25, 0.75, 0.72, 0.90),
                remap(nt, fine, 0.25, 0.75, 0.92, 1.02))
        # 雨水冲刷痕：竖向长条，是外墙上最明显的一种脏
        alb = m(nt, "MULTIPLY", alb, remap(nt, streak, 0.32, 0.72, 0.80, 1.01))
        height = m(nt, "ADD", m(nt, "MULTIPLY", fine, 0.7), m(nt, "MULTIPLY", big, 0.3))
        rough = remap(nt, fine, 0.2, 0.8, 0.80, 1.00)
        return alb, height, rough

    if kind == "metal":
        brush = torus_noise(nt, 120, detail=2, rough=0.3)
        smudge = torus_noise(nt, 7, detail=6, rough=0.6)
        alb = remap(nt, m(nt, "ADD", m(nt, "MULTIPLY", brush, 0.35),
                          m(nt, "MULTIPLY", smudge, 0.65)), 0.3, 0.7, 0.74, 0.98)
        height = m(nt, "MULTIPLY", brush, 0.30)
        rough = remap(nt, smudge, 0.2, 0.8, 0.45, 1.10)
        return alb, height, rough

    raise ValueError(kind)


# ---------------------------------------------------------------- bake

def bake_pass(img, bake_type, pass_filter=None):
    nt = bpy.context.object.active_material.node_tree
    node = nt.nodes.new("ShaderNodeTexImage")
    node.image = img
    node.select = True
    nt.nodes.active = node
    if pass_filter:
        bpy.ops.object.bake(type=bake_type, pass_filter=pass_filter,
                            margin=24, use_clear=True)
    else:
        bpy.ops.object.bake(type=bake_type, margin=24, use_clear=True)
    nt.nodes.remove(node)


def setup_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 1
    scene.cycles.use_denoising = False
    scene.render.bake.margin = 24
    scene.render.bake.use_pass_direct = False
    scene.render.bake.use_pass_indirect = False
    scene.render.bake.use_pass_color = True
    bpy.ops.mesh.primitive_plane_add(size=2.0)
    return bpy.context.object


def make_material(obj, kind):
    mat = bpy.data.materials.new(kind)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])

    alb, height, rough = build(nt, kind)
    nt.links.new(alb, bsdf.inputs["Base Color"])
    nt.links.new(rough, bsdf.inputs["Roughness"])
    # height 走 bump 只为烘出切线空间法线图；NORMAL 烘焙会把 bump 的
    # 凹凸直接写进 tangent-space normal，Three.js 里就能当真正的法线贴图用。
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 1.0
    bump.inputs["Distance"].default_value = 0.018
    nt.links.new(height, bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])

    if kind == "metal":
        # 注意：不能给金属度，否则 DIFFUSE 烘焙出来的反照率接近全黑，
        # 这张图是要当"细节乘数"用的，金属度留到 Three.js 里再设。
        pass
    obj.data.materials.append(mat)
    return mat


def new_img(name, srgb, size=RES):
    img = bpy.data.images.new(name, size, size, alpha=False, float_buffer=True)
    img.colorspace_settings.name = "sRGB" if srgb else "Non-Color"
    img.generated_color = (0.5, 0.5, 0.5, 1.0)
    return img


def main():
    os.makedirs(OUT, exist_ok=True)
    kinds = ["concrete", "brick", "plaster", "metal"]
    for kind in kinds:
        obj = setup_scene()
        make_material(obj, kind)
        bpy.context.view_layer.objects.active = obj

        # albedo 和法线要全尺寸，粗糙度可以减半（它本来就低频）
        for suffix, bake_type, flt, srgb, size in (
            ("albedo", "DIFFUSE", {"COLOR"}, True, RES),
            ("normal", "NORMAL", None, False, RES // 2),
            ("rough", "ROUGHNESS", None, False, RES // 2),
        ):
            img = new_img(f"{kind}_{suffix}", srgb, size)
            bake_pass(img, bake_type, flt)
            path = os.path.join(OUT, f"{kind}_{suffix}.png")
            img.filepath_raw = path
            img.file_format = "PNG"
            img.save()
            print(f"  {kind}/{suffix} -> {path}")
            bpy.data.images.remove(img)

    print("DONE")


main()
