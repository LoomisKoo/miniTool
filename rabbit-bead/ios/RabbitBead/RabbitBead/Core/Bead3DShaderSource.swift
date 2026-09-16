/// Metal 3D 预览的着色器源码。
///
/// 用**运行时编译**（`MTLDevice.makeLibrary(source:)`）而不是 `.metal` 文件：
/// 不依赖工程把 .metal 加进 target 的编译阶段，失败也只是这一条路径回退到 CPU
/// 渲染（`Bead3DCanvas`），不会变成构建错误。代价是首次进 3D 时多几十~几百毫秒，
/// 编译结果缓存在 `Bead3DMetalSupport` 里只做一次。
///
/// 几何约定（与 `Bead3DRenderer` 一致）：豆是半径 `outerRadius`、高 `beadHeight`
/// 的圆柱，顶面带半径 `innerRadius` 的孔；世界坐标 y=0 是底板面，y 向上。
/// 顶点里第 4 个分量是**明暗系数**，按 H5 `shadeHex` 的口径在片元里施加：
/// 负数向黑、正数向白线性插值（都在 sRGB 分量上算，不做线性化）。
enum Bead3DShaderSource {
    static let metal = """
    #include <metal_stdlib>
    using namespace metal;

    struct VertexOut {
        float4 position [[position]];
        float4 color;
    };

    inline float3 bead_shade(float3 c, float factor) {
        return factor < 0.0 ? c * (1.0 + factor) : mix(c, float3(1.0), factor);
    }

    // 每颗豆一个实例：顶点网格全幅复用，`iid` 取实例的位置与颜色。
    // buffer(0) 顶点 (x, y, z, shade)；buffer(1) 实例位置 (x, z)；
    // buffer(2) 实例颜色 (r, g, b, a)；buffer(3) MVP。
    vertex VertexOut bead3d_vertex(uint vid [[vertex_id]],
                                   uint iid [[instance_id]],
                                   const device float4 *vertices [[buffer(0)]],
                                   const device float2 *positions [[buffer(1)]],
                                   const device float4 *colors [[buffer(2)]],
                                   constant float4x4 &mvp [[buffer(3)]]) {
        float4 v = vertices[vid];
        float2 p = positions[iid];
        float4 c = colors[iid];

        VertexOut out;
        out.position = mvp * float4(v.x + p.x, v.y, v.z + p.y, 1.0);
        out.color = float4(bead_shade(c.rgb, v.w), c.a);
        return out;
    }

    fragment float4 bead3d_fragment(VertexOut in [[stage_in]]) {
        return in.color;
    }
    """
}
