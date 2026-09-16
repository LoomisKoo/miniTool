import QuartzCore
import SwiftUI

/// 2D ↔ 3D 过渡专用画布：把两层画进**同一个** `Canvas`。
///
/// 原来过渡期用 `ZStack` 叠两个 `Canvas`（各自不透明、各自铺底），叠加那段每帧
/// 要合成两个设备分辨率的图层。在模拟器上这会走 `MTLSimCommandQueue` 把两张
/// 纹理经 XPC 送到宿主 GPU，实测会在
/// `RB::RenderFrame::~RenderFrame` → `xpc_connection_send_message` 崩掉
/// （`—[MTLSimCommandQueue submitCommandBuffers:count:]`）。
/// 单画布只剩一个图层，同时也省掉一次全屏合成。
///
/// 合成口径与原 `ZStack` 等价（`GraphicsContext` 是值类型，副本上设 `opacity`
/// 不会影响原 context）：
/// 底 → `a2d` 的 2D 层 → `a3d` 的 3D 层（含它自己的底色，用来把 2D 压下去）。
struct BeadMorphCanvas: View {
    let grid: BeadGrid
    let style: BeadCanvasStyle
    let rect: GridRect
    let highlightedCode: String?
    /// 2D 层的适配缩放与位移。
    let flatScale: CGFloat
    let flatOffset: CGSize
    /// 3D 层的相机。
    let camera: Bead3DCamera
    /// 两层各自的不透明度，取值与原 `ZStack` 里的 `.opacity` 一致。
    let a2d: Double
    let a3d: Double
    /// 过渡期一律走交互档（有外壁、不画色号），松手/结束后由稳定态补细节。
    var quality: Bead3DQuality = .interactive
    /// 当前外观（底板色与淡化目标色都要按它选）。
    var appearance: BeadAppearance = .light
    /// 「立起来」的进度：正俯视时底板贴预览框底色，避免淡入瞬间整幅变黑。
    var plateTilt: Double = 1

    var body: some View {
        Canvas(opaque: true, rendersAsynchronously: false) { context, size in
            let started = CACurrentMediaTime()
            // 底色只铺一次：2D 与 3D 的底色都是预览框底色
            context.fill(
                Path(CGRect(origin: .zero, size: size)),
                with: .color(BeadTheme.viewport)
            )
            var stats = Bead3DRenderer.FrameStats()

            if a2d > 0.001 {
                var ctx = context
                ctx.opacity = a2d
                Bead2DRenderer.draw(
                    context: &ctx,
                    size: size,
                    grid: grid,
                    rect: rect,
                    style: style,
                    highlightedCode: highlightedCode,
                    scale: flatScale,
                    offset: flatOffset,
                    appearance: appearance
                )
            }

            if a3d > 0.001 {
                var ctx = context
                ctx.opacity = a3d
                // 3D 层自己的底色：原来它是独立图层、整层再乘 a3d，
                // 所以这里也要把底色一起按 a3d 压上去，2D 才会同步退掉。
                ctx.fill(
                    Path(CGRect(origin: .zero, size: size)),
                    with: .color(BeadTheme.viewport)
                )
                stats = Bead3DRenderer.draw(
                    context: &ctx,
                    size: size,
                    grid: grid,
                    rect: rect,
                    camera: camera,
                    style: style,
                    highlightedCode: highlightedCode,
                    quality: quality,
                    appearance: appearance,
                    plateTilt: plateTilt
                )
            }
            BeadPerfProbe.shared.record(
                canvasMS: (CACurrentMediaTime() - started) * 1000,
                quality: "m",
                stats: stats
            )
        }
    }
}
