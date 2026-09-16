import Foundation
import Metal
import QuartzCore

/// Metal 3D 预览的管线与共享网格。
///
/// ## 为什么非换不可
///
/// CPU 路径的瓶颈不是「画了多少像素」，而是 `GraphicsContext.fill` 的**每次绘制
/// 固定开销**：实测 `8324` 颗豆、每颗 2 笔（外壁 + 顶面）＝ `20.6ms`，约 `1.2µs/笔`，
/// 而这一帧的总覆盖面积只有约 3.3M 设备像素。同一档几何在文档里 LOD0（每颗 1 笔、
/// 5440 颗）是 `4.8ms`，也说明成本基本正比于**笔数**。
///
/// H5 端同样的算法不吃这份开销，是因为 canvas2d 在 WebKit 里走 GPU 光栅化；
/// iOS 的 SwiftUI `Canvas` 是 CPU 光栅化，逐豆几万笔就是几万次 CG 路径填充准备。
/// 所以这里把每颗豆做成一个**实例**（圆柱网格全幅复用），一次
/// `drawIndexedPrimitives` 画完整幅，光栅化交给 GPU —— 13k 颗 × 96 三角形 ≈ 1.25M
/// 三角形，对现代 GPU 是零头。顺带把之前那套 LOD/降档脚手架整体去掉了：
/// 「交互期看起来是扁的」正是降档逻辑引入的 bug，GPU 上不需要它。
///
/// ## 为什么不用深度排序
///
/// CPU 路径没有深度缓冲，必须按「画家算法」从远到近逐豆画；Metal 这边开了
/// `.depth32Float` 深度测试，**不排序**（省掉每次相机变化后的排序开销），
/// 遮挡关系由 GPU 保证。
enum Bead3DMetalSupport {
    /// MSAA 采样数。豆的轮廓是小圆弧，4x 足够干净；再高对显存/带宽不划算。
    static let sampleCount = 4

    /// 圆柱的分段数。CPU 路径按 LOD 取 10~28，GPU 上没必要省，固定 16。
    static let beadSegments = 16

    /// 强制回退 CPU 渲染的开关（排查用）。默认走 Metal；
    /// 需要对照时用启动参数 `-rabbitbead.useMetal NO` 或 `defaults write` 置 0。
    static let useMetalKey = "rabbitbead.useMetal"

    /// 管线（设备 + 着色器 + 网格）一次建好，进程内共享；建不出来就是 `nil`，
    /// 调用方回退到 CPU 渲染。
    static let shared: Bead3DMetalPipeline? = {
        let defaults = UserDefaults.standard
        if defaults.object(forKey: useMetalKey) != nil, defaults.bool(forKey: useMetalKey) == false {
            return nil
        }
        return Bead3DMetalPipeline.make()
    }()
}

final class Bead3DMetalPipeline {
    let device: MTLDevice
    let queue: MTLCommandQueue
    let pipeline: MTLRenderPipelineState
    let depthState: MTLDepthStencilState

    /// 单位圆柱：6 个环（顶面外/内、外壁上/下、孔壁上/下），全幅复用。
    /// 顶点布局 `(x, y, z, shade)`，与着色器 `buffer(0)` 一致。
    let beadVertices: MTLBuffer
    let beadIndices: MTLBuffer
    let beadIndexCount: Int

    /// 上次建管线/编着色器的耗时（毫秒），进 HUD 方便确认是不是踩了冷启动。
    let setupMilliseconds: Double

    /// 静态工厂而不是可失败 `init?`：类在属性未填满时提前 `return nil` 的规则容易踩坑，
    /// 而且失败点都在「拿不到设备/编译不出着色器」这一步，用工厂最直接。
    static func make() -> Bead3DMetalPipeline? {
        let started = CACurrentMediaTime()
        guard let device = MTLCreateSystemDefaultDevice(),
              let queue = device.makeCommandQueue() else { return nil }

        // 运行时编译着色器：失败就整条路径不可用（调用方回退 CPU 渲染）
        guard let library = try? device.makeLibrary(source: Bead3DShaderSource.metal, options: nil),
              let vertexFunction = library.makeFunction(name: "bead3d_vertex"),
              let fragmentFunction = library.makeFunction(name: "bead3d_fragment") else {
            return nil
        }

        let descriptor = MTLRenderPipelineDescriptor()
        descriptor.label = "bead3d"
        descriptor.vertexFunction = vertexFunction
        descriptor.fragmentFunction = fragmentFunction
        descriptor.rasterSampleCount = Bead3DMetalSupport.sampleCount
        descriptor.depthAttachmentPixelFormat = .depth32Float
        descriptor.colorAttachments[0].pixelFormat = .bgra8Unorm
        // 顶面与侧壁共用顶点位置、明暗不同；孔的朝向与外壳相反，写错绕序会整幅
        // 消失。这里不开背面剔除换稳妥，多出来的顶点开销在 GPU 上无所谓。
        descriptor.colorAttachments[0].isBlendingEnabled = false
        guard let pipeline = try? device.makeRenderPipelineState(descriptor: descriptor) else {
            return nil
        }

        let depthDescriptor = MTLDepthStencilDescriptor()
        depthDescriptor.depthCompareFunction = .less
        depthDescriptor.isDepthWriteEnabled = true
        guard let depthState = device.makeDepthStencilState(descriptor: depthDescriptor) else {
            return nil
        }

        let mesh = buildCylinder(segments: Bead3DMetalSupport.beadSegments)
        guard let vertices = device.makeBuffer(
                bytes: mesh.vertices,
                length: mesh.vertices.count * MemoryLayout<Float>.stride,
                options: .storageModeShared
              ),
              let indices = device.makeBuffer(
                bytes: mesh.indices,
                length: mesh.indices.count * MemoryLayout<UInt16>.stride,
                options: .storageModeShared
              ) else { return nil }

        return Bead3DMetalPipeline(
            device: device,
            queue: queue,
            pipeline: pipeline,
            depthState: depthState,
            beadVertices: vertices,
            beadIndices: indices,
            beadIndexCount: mesh.indices.count,
            setupMilliseconds: (CACurrentMediaTime() - started) * 1000
        )
    }

    private init(
        device: MTLDevice,
        queue: MTLCommandQueue,
        pipeline: MTLRenderPipelineState,
        depthState: MTLDepthStencilState,
        beadVertices: MTLBuffer,
        beadIndices: MTLBuffer,
        beadIndexCount: Int,
        setupMilliseconds: Double
    ) {
        self.device = device
        self.queue = queue
        self.pipeline = pipeline
        self.depthState = depthState
        self.beadVertices = beadVertices
        self.beadIndices = beadIndices
        self.beadIndexCount = beadIndexCount
        self.setupMilliseconds = setupMilliseconds
    }

    /// 单位圆柱网格。
    ///
    /// 环的顺序无所谓（深度测试保证遮挡），但同一个环要被两个面共用时**必须拆开**：
    /// 顶面环带的顶环（`shade +0.06`）和外壁的顶环（`shade -0.32`）位置相同、
    /// 明暗不同，所以各建一份。于是 6 个环 = `6 × segments` 个顶点。
    private static func buildCylinder(segments: Int) -> (vertices: [Float], indices: [UInt16]) {
        let top = Float(Bead3DRenderer.beadHeight)
        let outer = Float(Bead3DRenderer.outerRadius)
        let inner = Float(Bead3DRenderer.innerRadius)

        var vertices: [Float] = []
        var indices: [UInt16] = []
        vertices.reserveCapacity(segments * 6 * 4)

        /// 追加一个环，返回其首顶点下标。
        func ring(y: Float, radius: Float, shade: Float) -> UInt16 {
            let base = UInt16(vertices.count / 4)
            for i in 0..<segments {
                let angle = Float(i) / Float(segments) * 2 * .pi
                vertices.append(cos(angle) * radius)
                vertices.append(y)
                vertices.append(sin(angle) * radius)
                vertices.append(shade)
            }
            return base
        }

        /// 两个同分段数的环之间铺一圈四边形。
        func band(_ a: UInt16, _ b: UInt16) {
            for i in 0..<segments {
                let j = UInt16((i + 1) % segments)
                let ai = a + UInt16(i)
                let aj = a + j
                let bi = b + UInt16(i)
                let bj = b + j
                indices.append(contentsOf: [ai, bi, aj])
                indices.append(contentsOf: [aj, bi, bj])
            }
        }

        // 顶面圆环（挖孔）+ 外壁 + 孔内壁，明暗与 CPU 路径一致
        band(ring(y: top, radius: outer, shade: 0.06), ring(y: top, radius: inner, shade: 0.06))
        band(ring(y: top, radius: outer, shade: -0.32), ring(y: 0, radius: outer, shade: -0.32))
        band(ring(y: top, radius: inner, shade: -0.22), ring(y: 0, radius: inner, shade: -0.22))

        return (vertices, indices)
    }
}
