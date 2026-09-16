import QuartzCore
import SwiftUI

/// 3D 预览画布：拖动旋转、双指缩放。
struct Bead3DCanvas: View, Equatable {
    let grid: BeadGrid
    let style: BeadCanvasStyle
    let rect: GridRect
    let camera: Bead3DCamera
    let highlightedCode: String?
    /// 手势/过渡中传 `.interactive`：只省色号 + 顶点数封顶，几何不变。
    var quality: Bead3DQuality = .settled
    /// 当前外观。参与 `==`：切深色时底板与淡化目标色都变了，必须重画一次。
    var appearance: BeadAppearance = .light

    /// 与 2D 同理：只在这些输入变化时重画。
    static func == (lhs: Self, rhs: Self) -> Bool {
        lhs.style == rhs.style
            && lhs.rect == rhs.rect
            && lhs.camera == rhs.camera
            && lhs.highlightedCode == rhs.highlightedCode
            && lhs.quality == rhs.quality
            && lhs.appearance == rhs.appearance
            && lhs.grid == rhs.grid
    }

    var body: some View {
        // 同步绘制：异步模式下旋转/过渡时会掉帧，画面像是「跟不上手指」
        Canvas(opaque: true, rendersAsynchronously: false) { context, size in
            let started = CACurrentMediaTime()
            context.fill(
                Path(CGRect(origin: .zero, size: size)),
                with: .color(BeadTheme.viewport)
            )
            let stats = Bead3DRenderer.draw(
                context: &context,
                size: size,
                grid: grid,
                rect: rect,
                camera: camera,
                style: style,
                highlightedCode: highlightedCode,
                quality: quality,
                appearance: appearance
            )
            BeadPerfProbe.shared.record(
                canvasMS: (CACurrentMediaTime() - started) * 1000,
                quality: quality == .interactive ? "i" : "s",
                stats: stats
            )
        }
    }
}
