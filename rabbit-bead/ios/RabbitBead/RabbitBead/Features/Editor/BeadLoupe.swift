import SwiftUI

/// 手指放大镜：浮在手指上方，显示手指所在格 + 周围格子 + 该格的**图纸行列号**。
///
/// 落笔（画笔 / 橡皮）和取色都用它：两者都是「手指按在格子上，得看清压在哪个格」，
/// 光学放大 + 坐标读数就够了，区别只在取色会多显示一行**当前吸到的色号**。
///
/// 行列号口径与导出图纸上的坐标轴完全一致（见 `BeadArtworkRenderer.drawAxis`）：
/// **1 起算**、并且带上当前区域的原点（`rect.x0` / `rect.y0`）。所以放大镜读到的
/// 「列 12 · 行 8」可以直接在打印出来的图纸上找到同一格 —— 分板导出时也对得上。
///
/// 位置放在手指上方一段距离，不挡落笔点；顶到画布上缘就翻到手指下方，
/// 再放不下（画布很矮）就夹在画布内。
struct BeadLoupe: View {
    let grid: BeadGrid
    /// 当前可见区域（某块板或整幅）。
    let rect: GridRect
    /// 手指所在格（内容坐标，0 起算）。
    let col: Int
    let row: Int
    /// 手指在预览框里的位置。
    let touch: CGPoint
    /// 预览框尺寸：用来把放大镜夹在画布里。
    let viewport: CGSize
    /// 取色模式：底下多一行读数（色号 + 色块；空格显示占位）。
    ///
    /// 用独立开关而不是「色号非 nil」：读数行时有时无会让整块高度来回跳，
    /// 放大镜跟着上下抖 —— 拖动取色时最明显。
    var showsReadout = false
    /// 手指下这一格的色号（空格 / 非取色工具为 nil）。
    var pickedCode: String?
    var appearance: BeadAppearance = .light

    /// 圆窗直径。`span` 格分这个宽度，一格正好 30pt —— 正好够画出格内色号
    /// （`Bead2DRenderer` 的 `codeShowCell`）。
    private static let diameter: CGFloat = 150
    /// 圆窗里铺几格。奇数，手指那一格落在正中。
    private static let span = 5
    private static let labelGap: CGFloat = 6
    private static let labelHeight: CGFloat = 26
    /// 放大镜与指尖留出的距离（手指不会挡住它）。
    private static let fingerGap: CGFloat = 34
    /// 与画布边缘的间隙。
    private static let edgeInset: CGFloat = 8

    /// 轮盘 + 底下读数的整块尺寸。
    private var blockSize: CGSize {
        CGSize(
            width: Self.diameter,
            height: Self.diameter + Self.labelGap + readoutsHeight
        )
    }

    /// 底下读数的总高：坐标一行，取色时再加一行色号。
    private var readoutsHeight: CGFloat {
        showsReadout
            ? Self.labelHeight * 2 + Self.labelGap
            : Self.labelHeight
    }

    var body: some View {
        VStack(spacing: Self.labelGap) {
            window
            VStack(spacing: Self.labelGap) {
                coordinateLabel
                if showsReadout {
                    readoutLabel
                }
            }
        }
        .position(anchor)
        .allowsHitTesting(false)
    }

    // MARK: - 圆窗

    private var window: some View {
        Canvas { context, size in
            let side = min(size.width, size.height)
            let cell = side / CGFloat(Self.span)
            // 触到区域边缘时把窗口整体往里挪：圆窗里永远是满格的图案，不出现空白。
            let originCol = min(
                max(col - Self.span / 2, rect.x0),
                max(rect.x0, rect.x1 - Self.span)
            )
            let originRow = min(
                max(row - Self.span / 2, rect.y0),
                max(rect.y0, rect.y1 - Self.span)
            )

            context.fill(
                Path(CGRect(origin: .zero, size: size)),
                with: .color(BeadTheme.viewport)
            )
            // 直接复用预览画布的绘制：放大镜里的豆色、格线、色号与主画布是同一套口径。
            // offset 是「区域原点」在圆窗里的位置，所以窗口左上角对准 originCol/Row。
            Bead2DRenderer.draw(
                context: &context,
                size: size,
                grid: grid,
                rect: rect,
                style: .loupe,
                highlightedCode: nil,
                scale: cell / Bead2DRenderer.contentCell,
                offset: CGSize(
                    width: -CGFloat(originCol - rect.x0) * cell,
                    height: -CGFloat(originRow - rect.y0) * cell
                ),
                appearance: appearance
            )

            // 手指那一格：白圈打底再描主题色，压在任何豆色上都看得见。
            let focus = CGRect(
                x: CGFloat(col - originCol) * cell,
                y: CGFloat(row - originRow) * cell,
                width: cell,
                height: cell
            )
            context.stroke(Path(focus), with: .color(.white.opacity(0.92)), lineWidth: 4)
            context.stroke(Path(focus), with: .color(BeadTheme.primary), lineWidth: 2)
        }
        .frame(width: Self.diameter, height: Self.diameter)
        .clipShape(Circle())
        .overlay { Circle().strokeBorder(BeadTheme.hairline, lineWidth: 1) }
        .shadow(color: .black.opacity(0.22), radius: 12, y: 5)
    }

    /// 行列号，与图纸坐标轴同口径（1 起算 + 区域原点）。
    private var coordinateLabel: some View {
        Text("列 %ld · 行 %ld".loc(col + 1, row + 1))
            .font(.system(size: 12, weight: .semibold))
            .monospacedDigit()
            .foregroundStyle(BeadTheme.onDark)
            .padding(.horizontal, 12)
            .frame(height: Self.labelHeight)
            .background(BeadTheme.overlaySurface, in: Capsule())
    }

    /// 取色读数：手指下这一格的豆色 + 色号；空格显示占位（吸不到色，松手也不会改画笔色）。
    private var readoutLabel: some View {
        let cell = grid[col, row]
        return HStack(spacing: 6) {
            BeadSwatch(color: cell.isEmpty ? .clear : cell.rgb.swiftUIColor, size: 12)
            Text(pickedCode ?? "空格".loc)
                .font(.system(size: 12, weight: .semibold))
                .monospacedDigit()
                .foregroundStyle(BeadTheme.onDark)
        }
        .padding(.horizontal, 12)
        .frame(height: Self.labelHeight)
        .background(BeadTheme.overlaySurface, in: Capsule())
    }

    // MARK: - 定位

    /// 放大镜中心在预览框里的位置。
    private var anchor: CGPoint {
        let block = blockSize
        let halfW = block.width / 2
        let halfH = block.height / 2

        let x: CGFloat
        if viewport.width >= block.width + Self.edgeInset * 2 {
            x = min(
                max(touch.x, Self.edgeInset + halfW),
                viewport.width - Self.edgeInset - halfW
            )
        } else {
            x = viewport.width / 2
        }

        // 优先指尖上方（块底边离指尖 fingerGap）……
        let above = touch.y - Self.fingerGap - halfH
        if above - halfH >= Self.edgeInset { return CGPoint(x: x, y: above) }
        // ……上方放不下就翻到下方……
        let below = touch.y + Self.fingerGap + halfH
        if below + halfH <= viewport.height - Self.edgeInset { return CGPoint(x: x, y: below) }
        // ……两头都放不下（画布很矮）：夹回画布内，能用就行。
        let minY = Self.edgeInset + halfH
        let maxY = max(minY, viewport.height - Self.edgeInset - halfH)
        return CGPoint(x: x, y: min(max(above, minY), maxY))
    }
}
