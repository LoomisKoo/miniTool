import MetalKit
import QuartzCore
import SwiftUI
import simd

/// 3D 预览的 Metal 层（透明底的 `MTKView`，叠在预览框底色上）。
///
/// 用法与 `Bead3DCanvas` 等价：给同一份 `grid` / `rect` / `camera`，画面口径也
/// 完全一致（MVP 由 `Bead3DRenderer.scene` 用同一套相机数算），区别只在于
/// 光栅化在 GPU 上、不排序、不做 LOD 降档。
///
/// 按需重绘：`isPaused + enableSetNeedsDisplay`，每次 SwiftUI 更新只
/// `setNeedsDisplay`；实例缓冲只在「格子内容 / 区域 / 高亮色号」变化时重建，
/// 旋转缩放只更新一个 MVP，不碰缓冲。
struct Bead3DMetalCanvas: UIViewRepresentable {
    let grid: BeadGrid
    let rect: GridRect
    let camera: Bead3DCamera
    let highlightedCode: String?

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> MTKView {
        let view = MTKView(frame: .zero, device: Bead3DMetalSupport.shared?.device)
        view.delegate = context.coordinator
        view.enableSetNeedsDisplay = true
        view.isPaused = true
        view.colorPixelFormat = .bgra8Unorm
        view.depthStencilPixelFormat = .depth32Float
        view.sampleCount = Bead3DMetalSupport.sampleCount
        // 透明清屏：底板之外的区域要让预览框底色透上来，过渡期也要能叠在 2D 层上
        view.clearColor = MTLClearColorMake(0, 0, 0, 0)
        view.isOpaque = false
        view.backgroundColor = .clear
        view.framebufferOnly = true
        return view
    }

    func updateUIView(_ view: MTKView, context: Context) {
        let coordinator = context.coordinator
        coordinator.update(grid: grid, rect: rect, highlightedCode: highlightedCode)
        coordinator.camera = camera
        view.setNeedsDisplay()
    }

    /// 实例缓冲只在内容变化时重建；相机变化只影响 uniform。
    final class Coordinator: NSObject, MTKViewDelegate {
        private let pipeline = Bead3DMetalSupport.shared
        private let device = Bead3DMetalSupport.shared?.device

        private struct Signature: Equatable {
            var grid: BeadGrid
            var rect: GridRect
            var highlightedCode: String?
        }

        /// 与 `BeadGrid` 的 `==` 同口径（逐格比较）。格位数不大（≤2 万），
        /// 且量化后 `code` 的字符串存储是共享的，比较基本走指针快路径。
        private var signature: Signature?
        private var currentRect = GridRect(x0: 0, y0: 0, x1: 0, y1: 0)
        private var beadCount = 0
        private var positionBuffer: MTLBuffer?
        private var colorBuffer: MTLBuffer?
        private var plateVertexBuffer: MTLBuffer?
        private var plateColorBuffer: MTLBuffer?
        private var originBuffer: MTLBuffer?

        var camera = Bead3DCamera()

        func mtkView(_ view: MTKView, drawableSizeWillChange size: CGSize) {
            view.setNeedsDisplay()
        }

        func update(grid: BeadGrid, rect: GridRect, highlightedCode: String?) {
            currentRect = rect
            let next = Signature(grid: grid, rect: rect, highlightedCode: highlightedCode)
            guard next != signature else { return }
            signature = next
            rebuild(grid: grid, rect: rect, highlightedCode: highlightedCode)
        }

        /// 每颗豆一个实例：位置 `(x, z)`（已减去半幅，与 CPU 路径同一坐标）＋颜色。
        /// 淡化（高亮其它色号时）在 CPU 侧按色号算好，片元里不做分支。
        private func rebuild(grid: BeadGrid, rect: GridRect, highlightedCode: String?) {
            guard let device, rect.width > 0, rect.height > 0 else { return }

            let halfX = (Float(rect.width) - 1) / 2
            let halfZ = (Float(rect.height) - 1) / 2
            let capacity = rect.width * rect.height
            var positions: [Float] = []
            var colors: [Float] = []
            positions.reserveCapacity(capacity * 2)
            colors.reserveCapacity(capacity * 4)

            for row in 0..<rect.height {
                for column in 0..<rect.width {
                    let cell = grid[column + rect.x0, row + rect.y0]
                    guard !cell.isEmpty else { continue }
                    positions.append(Float(column) - halfX)
                    positions.append(Float(row) - halfZ)

                    let dimmed = highlightedCode != nil && cell.code != highlightedCode
                    let rgb = dimmed ? cell.rgb.mixed(with: RGB8(255, 255, 255), t: 0.72) : cell.rgb
                    colors.append(Float(rgb.r) / 255)
                    colors.append(Float(rgb.g) / 255)
                    colors.append(Float(rgb.b) / 255)
                    colors.append(1)
                }
            }

            beadCount = positions.count / 2
            positionBuffer = positions.isEmpty ? nil : device.makeBuffer(
                bytes: positions,
                length: positions.count * MemoryLayout<Float>.stride,
                options: .storageModeShared
            )
            colorBuffer = colors.isEmpty ? nil : device.makeBuffer(
                bytes: colors,
                length: colors.count * MemoryLayout<Float>.stride,
                options: .storageModeShared
            )

            // 底板：四个绝对世界坐标角点，一次 triangleStrip 铺完
            let corners = Bead3DRenderer.plateWorldCorners(rect: rect)
            var flat: [Float] = []
            flat.reserveCapacity(corners.count * 4)
            for corner in corners {
                flat.append(contentsOf: [corner.x, corner.y, corner.z, 0])
            }
            plateVertexBuffer = device.makeBuffer(
                bytes: flat,
                length: flat.count * MemoryLayout<Float>.stride,
                options: .storageModeShared
            )

            let plate = Bead3DRenderer.plateColor
            let plateRGBA: [Float] = [
                Float(plate.r) / 255,
                Float(plate.g) / 255,
                Float(plate.b) / 255,
                1,
            ]
            plateColorBuffer = device.makeBuffer(
                bytes: plateRGBA,
                length: plateRGBA.count * MemoryLayout<Float>.stride,
                options: .storageModeShared
            )
            // 底板的顶点已是绝对坐标，实例位置固定 0
            let origin: [Float] = [0, 0]
            originBuffer = device.makeBuffer(
                bytes: origin,
                length: origin.count * MemoryLayout<Float>.stride,
                options: .storageModeShared
            )
        }

        func draw(in view: MTKView) {
            guard let pipeline,
                  let scene = Bead3DRenderer.scene(
                    camera: camera,
                    rect: currentRect,
                    viewport: view.bounds.size
                  ),
                  scene.focal > 0,
                  let descriptor = view.currentRenderPassDescriptor,
                  let drawable = view.currentDrawable,
                  let commandBuffer = pipeline.queue.makeCommandBuffer() else { return }

            var mvp = scene.mvp
            guard let encoder = commandBuffer.makeRenderCommandEncoder(descriptor: descriptor) else {
                return
            }
            encoder.label = "bead3d"
            encoder.setRenderPipelineState(pipeline.pipeline)
            encoder.setDepthStencilState(pipeline.depthState)
            encoder.setVertexBytes(&mvp, length: MemoryLayout<simd_float4x4>.stride, index: 3)

            if let plateVertexBuffer, let plateColorBuffer, let originBuffer {
                encoder.setVertexBuffer(plateVertexBuffer, offset: 0, index: 0)
                encoder.setVertexBuffer(originBuffer, offset: 0, index: 1)
                encoder.setVertexBuffer(plateColorBuffer, offset: 0, index: 2)
                encoder.drawPrimitives(type: .triangleStrip, vertexStart: 0, vertexCount: 4)
            }

            if beadCount > 0, let positionBuffer, let colorBuffer {
                encoder.setVertexBuffer(pipeline.beadVertices, offset: 0, index: 0)
                encoder.setVertexBuffer(positionBuffer, offset: 0, index: 1)
                encoder.setVertexBuffer(colorBuffer, offset: 0, index: 2)
                encoder.drawIndexedPrimitives(
                    type: .triangle,
                    indexCount: pipeline.beadIndexCount,
                    indexType: .uint16,
                    indexBuffer: pipeline.beadIndices,
                    indexBufferOffset: 0,
                    instanceCount: beadCount
                )
            }

            encoder.endEncoding()
            commandBuffer.present(drawable)

            // 出帧节奏在这里记（CPU 侧只是编码，几百微秒，不代表渲染成本）；
            // 真正的「画」等命令缓冲完成后换成 GPU 耗时。
            let beads = beadCount
            BeadPerfProbe.shared.record(
                canvasMS: 0,
                quality: "g",
                stats: Bead3DRenderer.FrameStats(
                    lod: 0,
                    segments: Bead3DMetalSupport.beadSegments,
                    beads: beads,
                    wallPx: 0
                )
            )
            commandBuffer.addCompletedHandler { buffer in
                let gpu = (buffer.gpuEndTime - buffer.gpuStartTime) * 1000
                BeadPerfProbe.shared.recordGPU(milliseconds: gpu)
            }
            commandBuffer.commit()
        }
    }
}
