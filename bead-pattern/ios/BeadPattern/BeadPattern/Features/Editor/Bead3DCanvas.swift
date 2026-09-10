import SwiftUI

/// 3D 预览画布：拖动旋转、双指缩放。
struct Bead3DCanvas: View {
    let grid: BeadGrid
    let settings: BeadSettings
    let rect: GridRect
    let camera: Bead3DCamera
    let highlightedCode: String?

    var body: some View {
        // 同步绘制：异步模式下旋转/过渡时会掉帧，画面像是「跟不上手指」
        Canvas(opaque: true, rendersAsynchronously: false) { context, size in
            context.fill(
                Path(CGRect(origin: .zero, size: size)),
                with: .color(Bead3DRenderer.backgroundColor.swiftUIColor)
            )
            Bead3DRenderer.draw(
                context: &context,
                size: size,
                grid: grid,
                rect: rect,
                camera: camera,
                settings: settings,
                highlightedCode: highlightedCode
            )
        }
    }
}
