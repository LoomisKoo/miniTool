import SwiftUI

/// 2D 拼豆图案的绘制实现。
///
/// 绘制顺序与 H5 `renderPreview` 一致：先铺满豆色（相邻格密铺、不留缝），
/// 再叠画格线，最后画分板线。格线不占格面，也不会让豆看起来被切成小方框。
///
/// 性能：同一行里颜色相同的连续格合并成一个矩形再填充。
/// 拼豆图案大片同色的情况很多，这一步能把「每格一次填充」降到「每个色块一次」。
///
/// 抽成静态函数是为了让 2D↔3D 过渡期能把它和 `Bead3DRenderer` 画进**同一个**
/// `Canvas`（见 `BeadMorphCanvas`），过渡期只用一个图层。
enum Bead2DRenderer {
    /// 一格的内容像素（与 H5 的 `PRE_CS` 一致）。
    static let contentCell: CGFloat = 16

    /// 屏幕像素每格 ≥ 该值时在格内画色号（与 H5 的 `CODE_SHOW_CELL` 一致）。
    private static let codeShowCell: CGFloat = 30

    /// 只画图案本身（豆色 / 色号 / 格线 / 分板线），**不铺背景**。
    ///
    /// 背景交给调用方铺一次：2D、3D 的底色都是预览框底色，过渡期各铺一层没有意义。
    static func draw(
        context: inout GraphicsContext,
        size: CGSize,
        grid: BeadGrid,
        rect: GridRect,
        style: BeadCanvasStyle,
        highlightedCode: String?,
        scale: CGFloat,
        offset: CGSize,
        appearance: BeadAppearance = .light
    ) {
        let cell = contentCell * scale
        guard cell > 0, rect.width > 0, rect.height > 0 else { return }

        let originX = offset.width
        let originY = offset.height

        // 可见格范围（含 1 格余量），再裁到区域边界。
        // offset 是相对「本板左上角」的，必须加上 rect 原点，否则切到非首板时
        // minX>maxX，整板被裁成空白。
        let minX = max(rect.x0, rect.x0 + Int(floor(-originX / cell)) - 1)
        let maxX = min(rect.x1 - 1, rect.x0 + Int(ceil((size.width - originX) / cell)) + 1)
        let minY = max(rect.y0, rect.y0 + Int(floor(-originY / cell)) - 1)
        let maxY = min(rect.y1 - 1, rect.y0 + Int(ceil((size.height - originY) / cell)) + 1)
        guard minX <= maxX, minY <= maxY else { return }

        let isDimming = highlightedCode != nil
        let codeFont = Font.system(size: cell * 0.36, weight: .medium, design: .monospaced)
        let showCodes = style.showCodes && cell >= codeShowCell

        // 每行按颜色切段，同色连续格合成一个矩形
        var runCode = ""
        var runColor = Color.clear
        var runStart = minX
        var runPath = Path()
        let origin = CGPoint(x: originX, y: originY)
        var rowY = minY

        while rowY <= maxY {
            runCode = ""
            runStart = minX
            var x = minX
            while x <= maxX {
                let bead = grid[x, rowY]
                let isDimmed = isDimming && bead.code != highlightedCode
                // 空格与淡化格各成一类，不参与同色合并
                let code: String
                if bead.isEmpty {
                    code = ""
                } else if isDimmed {
                    code = "-"
                } else {
                    code = bead.code
                }

                if code != runCode {
                    fillRun(
                        context: &context,
                        path: &runPath,
                        color: runColor,
                        code: runCode,
                        startX: runStart,
                        endX: x,
                        rowY: rowY,
                        rect: rect,
                        origin: origin,
                        cell: cell
                    )
                    runStart = x
                    runCode = code
                    if bead.isEmpty {
                        runColor = BeadTheme.viewport
                    } else if isDimmed {
                        // 其余豆退到背景里：浅色向白、深色向预览框底色
                        runColor = bead.rgb.mixed(with: appearance.dimTarget, t: 0.72).swiftUIColor
                    } else {
                        runColor = bead.rgb.swiftUIColor
                    }
                }
                x += 1
            }
            fillRun(
                context: &context,
                path: &runPath,
                color: runColor,
                code: runCode,
                startX: runStart,
                endX: maxX + 1,
                rowY: rowY,
                rect: rect,
                origin: origin,
                cell: cell
            )

            // 色号单独画：只有放得下时才走这条分支，格数很少
            if showCodes {
                for x in minX...maxX {
                    let bead = grid[x, rowY]
                    guard !bead.isEmpty else { continue }
                    if isDimming, bead.code != highlightedCode { continue }
                    // 亮度 > 160 配深字，否则配浅字（与 H5 `render2d` 同口径）
                    let textColor = bead.rgb.wantsDarkOverlayText
                        ? Color.black.opacity(0.6)
                        : Color.white.opacity(0.85)
                    context.draw(
                        Text(bead.code)
                            .font(codeFont)
                            .foregroundStyle(textColor),
                        at: CGPoint(
                            x: originX + CGFloat(x - rect.x0) * cell + cell / 2,
                            y: originY + CGFloat(rowY - rect.y0) * cell + cell / 2
                        ),
                        anchor: .center
                    )
                }
            }
            rowY += 1
        }

        if style.showGrid, cell >= 2 {
            drawGridLines(
                context: &context,
                rect: rect,
                origin: CGPoint(x: originX, y: originY),
                cell: cell,
                minX: minX, maxX: maxX, minY: minY, maxY: maxY
            )
        }
        if style.showSeam, grid.boardCount > 1, isShowingAllBoards(grid: grid, rect: rect) {
            drawBoardSeams(
                context: &context,
                grid: grid,
                rect: rect,
                origin: CGPoint(x: originX, y: originY),
                cell: cell
            )
        }
    }

    private static func isShowingAllBoards(grid: BeadGrid, rect: GridRect) -> Bool {
        rect.width == grid.width && rect.height == grid.height
    }

    /// 把一段同色连续格填成一个矩形，然后清空待用路径。
    private static func fillRun(
        context: inout GraphicsContext,
        path: inout Path,
        color: Color,
        code: String,
        startX: Int,
        endX: Int,
        rowY: Int,
        rect: GridRect,
        origin: CGPoint,
        cell: CGFloat
    ) {
        guard endX > startX, !code.isEmpty else { return }
        // 多画 0.75pt 抹掉相邻色块之间的缝（H5 `cellDraw = PRE_CS + 0.75`）
        path.addRect(CGRect(
            x: origin.x + CGFloat(startX - rect.x0) * cell,
            y: origin.y + CGFloat(rowY - rect.y0) * cell,
            width: CGFloat(endX - startX) * cell + 0.75,
            height: cell + 0.75
        ))
        context.fill(path, with: .color(color))
        path = Path()
    }

    private static func drawGridLines(
        context: inout GraphicsContext,
        rect: GridRect,
        origin: CGPoint,
        cell: CGFloat,
        minX: Int, maxX: Int, minY: Int, maxY: Int
    ) {
        var path = Path()
        let top = origin.y + CGFloat(minY - rect.y0) * cell
        let bottom = origin.y + CGFloat(maxY + 1 - rect.y0) * cell
        let left = origin.x + CGFloat(minX - rect.x0) * cell
        let right = origin.x + CGFloat(maxX + 1 - rect.x0) * cell

        for x in minX...(maxX + 1) {
            let px = origin.x + CGFloat(x - rect.x0) * cell
            path.move(to: CGPoint(x: px, y: top))
            path.addLine(to: CGPoint(x: px, y: bottom))
        }
        for y in minY...(maxY + 1) {
            let py = origin.y + CGFloat(y - rect.y0) * cell
            path.move(to: CGPoint(x: left, y: py))
            path.addLine(to: CGPoint(x: right, y: py))
        }
        context.stroke(path, with: .color(BeadTheme.gridLine), lineWidth: 1)
    }

    /// 分板线：整幅视图下按拼板规格画，便于对位拼板。
    private static func drawBoardSeams(
        context: inout GraphicsContext,
        grid: BeadGrid,
        rect: GridRect,
        origin: CGPoint,
        cell: CGFloat
    ) {
        let board = max(1, grid.boardSize)
        // 与 H5 `seamW = max(2, PRE_CS / 8)` 对齐换算成屏幕宽度
        let width = max(1, cell / 8)
        // H5 `SEAM_COLOR`
        let boardColor = Color(red: 1, green: 0x3B / 255, blue: 0x30 / 255)
        var path = Path()

        var x = board
        while x < grid.width {
            let px = origin.x + CGFloat(x - rect.x0) * cell
            path.move(to: CGPoint(x: px, y: origin.y))
            path.addLine(to: CGPoint(x: px, y: origin.y + CGFloat(rect.height) * cell))
            x += board
        }
        var y = board
        while y < grid.height {
            let py = origin.y + CGFloat(y - rect.y0) * cell
            path.move(to: CGPoint(x: origin.x, y: py))
            path.addLine(to: CGPoint(x: origin.x + CGFloat(rect.width) * cell, y: py))
            y += board
        }
        context.stroke(path, with: .color(boardColor), lineWidth: width)
    }
}

/// 2D 取景换算（容器尺寸 → 缩放 + 位置）。**纯函数，不碰任何状态**。
///
/// 抽成独立类型的理由：容器尺寸在动画期间有两个「版本」——
/// - 画布每帧拿到的**当帧真实尺寸**（见 `BeadPreviewCanvas` 的注释）；
/// - `GeometryReader.proxy.size` 报的**最终尺寸**（手势、夹取、落库都用它）。
///
/// 两条路必须用同一套算法，否则动画结束、取景落到静态状态时会跳一下。
enum Bead2DFraming {
    /// 「完整可见」的取景（与 `UIViewContentMode.scaleAspectFit` 同口径：较长边贴齐
    /// 容器，不额外留边），居中。
    static func fit(rect: GridRect, in container: CGSize) -> (scale: CGFloat, offset: CGSize)? {
        guard container.width > 0, container.height > 0,
              rect.width > 0, rect.height > 0 else { return nil }
        let cell = Bead2DRenderer.contentCell
        let contentW = CGFloat(rect.width) * cell
        let contentH = CGFloat(rect.height) * cell
        let fitted = max(0.02, min(container.width / contentW, container.height / contentH))
        return (
            fitted,
            CGSize(
                width: (container.width - contentW * fitted) / 2,
                height: (container.height - contentH * fitted) / 2
            )
        )
    }

    /// 位移夹取，按「图片查看器」口径：内容比容器大时，内容的边**不能缩进容器内**
    /// （即不允许露出空白），内容比容器小时一律居中。
    static func clamped(
        _ value: CGSize,
        scale: CGFloat,
        rect: GridRect,
        in container: CGSize
    ) -> CGSize {
        guard rect.width > 0, rect.height > 0,
              container.width > 0, container.height > 0 else { return value }
        let cell = Bead2DRenderer.contentCell * scale
        let contentW = CGFloat(rect.width) * cell
        let contentH = CGFloat(rect.height) * cell

        var x = value.width
        var y = value.height
        if contentW <= container.width {
            x = (container.width - contentW) / 2
        } else {
            x = min(0, max(container.width - contentW, x))
        }
        if contentH <= container.height {
            y = (container.height - contentH) / 2
        } else {
            y = min(0, max(container.height - contentH, y))
        }
        return CGSize(width: x, height: y)
    }
}

/// 容器尺寸变化期间的取景规则：只留「与豆数无关」的基准，容器每帧报多大就按多大算。
///
/// 容器变化时**不能重置用户的取景**，规则分两种状态：
/// - **完整可见态**（`followsFit`）：跟着容器重新适配，中心和容器中心始终对齐；
/// - **放大态**：缩放不动，按变化开始时的「内容中心在容器里的比例」落视口，
///   看左下角就还是左下角；越界时由 `clampedOffset` 停在边上。
struct Bead2DResize: Equatable {
    /// 变化开始时内容中心在容器里的比例（放大态用；0.5 = 居中）。
    var anchor: CGPoint
    /// 变化开始时是「完整可见态」（跟着容器重新适配）还是放大态（只挪视口）。
    var followsFit: Bool
    /// 变化开始时的缩放（放大态下保持不变）。
    var startScale: CGFloat

    /// 给定这一帧的容器尺寸，算出这一帧的取景。
    func framing(rect: GridRect, in container: CGSize) -> (scale: CGFloat, offset: CGSize)? {
        guard let fit = Bead2DFraming.fit(rect: rect, in: container) else { return nil }
        if followsFit { return fit }
        // 放大态：缩放不动（容器大到放不下时至少保持完整可见），位置按比例延续。
        let scale = max(startScale, fit.scale)
        let cell = Bead2DRenderer.contentCell * scale
        let content = CGSize(
            width: CGFloat(rect.width) * cell,
            height: CGFloat(rect.height) * cell
        )
        return (
            scale,
            Bead2DFraming.clamped(
                CGSize(
                    width: anchor.x * container.width - content.width / 2,
                    height: anchor.y * container.height - content.height / 2
                ),
                scale: scale,
                rect: rect,
                in: container
            )
        )
    }
}

/// 2D 拼豆预览：只绘制可见区域，豆宽很大时也不会卡。
///
/// ## 取景为什么在绘制闭包里面算
///
/// 容器（预览框）做尺寸动画时，SwiftUI **只在叶子视图上**解析几何：
/// `GeometryReader.proxy.size` 从头到尾只报**最终**尺寸，而 `Canvas` 这个叶子每帧
/// 拿到的 `size` 是**逐帧插值出来的真实尺寸**。所以取景必须由 `size` 现算，
/// 图像才会和容器严丝合缝 —— 自己预测容器尺寸（按时长/曲线补间）永远差一点相位。
///
/// 这也意味着：不要把这些 `size` 换成外部传入的容器尺寸。
struct BeadPreviewCanvas: View, Equatable {
    let grid: BeadGrid
    let style: BeadCanvasStyle
    let rect: GridRect
    let highlightedCode: String?
    /// 静态取景（没有尺寸动画时用它）。
    let scale: CGFloat
    /// 内容坐标原点（区域左上角）在屏幕上的位置。
    let offset: CGSize
    /// 当前外观。参与 `==`：切深色时画布必须重画一次（淡化目标色变了）。
    var appearance: BeadAppearance = .light
    /// 尺寸变化进行中的取景规则；非空时按**当帧**容器尺寸现算，忽略上面那对静态值。
    var resizing: Bead2DResize?

    /// 一格的内容像素（H5 `PRE_CS`），fit 计算要用。
    static let contentCell: CGFloat = Bead2DRenderer.contentCell

    /// 只有这些输入变了才需要重画。参数滑块（豆宽/限色）在量化结果回来之前
    /// 不会改动任何一个，所以配合 `.equatable()` 可以直接跳过重绘。
    ///
    /// 容器尺寸动画不受这里影响：`size` 是逐帧变化的，绘制闭包照样每帧被调用。
    static func == (lhs: Self, rhs: Self) -> Bool {
        lhs.style == rhs.style
            && lhs.rect == rhs.rect
            && lhs.highlightedCode == rhs.highlightedCode
            && lhs.scale == rhs.scale
            && lhs.offset == rhs.offset
            && lhs.appearance == rhs.appearance
            && lhs.resizing == rhs.resizing
            && lhs.grid == rhs.grid
    }

    var body: some View {
        Canvas(opaque: true) { context, size in
            // 容器尺寸动画期间 `size` 是**逐帧的**真实值（见类型注释）。
            let framing: (scale: CGFloat, offset: CGSize) =
                resizing?.framing(rect: rect, in: size) ?? (scale, offset)
            context.fill(
                Path(CGRect(origin: .zero, size: size)),
                with: .color(BeadTheme.viewport)
            )
            Bead2DRenderer.draw(
                context: &context,
                size: size,
                grid: grid,
                rect: rect,
                style: style,
                highlightedCode: highlightedCode,
                scale: framing.scale,
                offset: framing.offset,
                appearance: appearance
            )
        }
    }
}
