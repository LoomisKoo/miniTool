import SwiftUI

/// 2D 拼豆预览：只绘制可见区域，豆宽很大时也不会卡。
///
/// 绘制顺序与 H5 `renderPreview` 一致：先铺满豆色（相邻格密铺、不留缝），
/// 再叠画格线，最后画分板线。格线不占格面，也不会让豆看起来被切成小方框。
///
/// 性能：同一行里颜色相同的连续格合并成一个矩形再填充。
/// 拼豆图案大片同色的情况很多，这一步能把「每格一次填充」降到「每个色块一次」。
struct BeadPreviewCanvas: View {
    let grid: BeadGrid
    let settings: BeadSettings
    let rect: GridRect
    let highlightedCode: String?
    let scale: CGFloat
    /// 内容坐标原点（区域左上角）在屏幕上的位置。
    let offset: CGSize

    /// 屏幕像素每格 ≥ 该值时在格内画色号（与 H5 的 `CODE_SHOW_CELL` 一致）。
    private let codeShowCell: CGFloat = 30
    /// 一格的内容像素（与 H5 的 `PRE_CS` 一致）。
    static let contentCell: CGFloat = 16

    var body: some View {
        Canvas(opaque: true) { context, size in
            context.fill(
                Path(CGRect(origin: .zero, size: size)),
                with: .color(BeadTheme.viewport)
            )

            let cell = Self.contentCell * scale
            guard cell > 0, rect.width > 0, rect.height > 0 else { return }

            let originX = offset.width
            let originY = offset.height

            // 可见格范围（含 1 格余量），再裁到区域边界
            let minX = max(rect.x0, Int(floor(-originX / cell)) - 1)
            let maxX = min(rect.x1 - 1, Int(ceil((size.width - originX) / cell)) + 1)
            let minY = max(rect.y0, Int(floor(-originY / cell)) - 1)
            let maxY = min(rect.y1 - 1, Int(ceil((size.height - originY) / cell)) + 1)
            guard minX <= maxX, minY <= maxY else { return }

            let isDimming = highlightedCode != nil
            let codeFont = Font.system(size: cell * 0.36, weight: .medium, design: .monospaced)
            let showCodes = settings.showCodes && cell >= codeShowCell

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
                            origin: origin,
                            cell: cell
                        )
                        runStart = x
                        runCode = code
                        if bead.isEmpty {
                            runColor = BeadTheme.viewport
                        } else if isDimmed {
                            runColor = Color.white.opacity(0.9)
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
                    origin: origin,
                    cell: cell
                )

                // 色号单独画：只有放得下时才走这条分支，格数很少
                if showCodes {
                    for x in minX...maxX {
                        let bead = grid[x, rowY]
                        guard !bead.isEmpty else { continue }
                        if isDimming, bead.code != highlightedCode { continue }
                        // 深色豆配白字、浅色豆配黑字，避免格内编号看不清
                        let textColor = bead.rgb.prefersDarkOverlayText
                            ? Color.black.opacity(0.70)
                            : Color.white.opacity(0.92)
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

            if settings.showGrid, cell >= 2 {
                drawGridLines(
                    context: &context,
                    origin: CGPoint(x: originX, y: originY),
                    cell: cell,
                    minX: minX, maxX: maxX, minY: minY, maxY: maxY
                )
            }
            if settings.showSeam, boardCount > 1, isShowingAllBoards {
                drawBoardSeams(
                    context: &context,
                    origin: CGPoint(x: originX, y: originY),
                    cell: cell
                )
            }
        }
    }

    private var boardCount: Int { grid.boardCount }

    private var isShowingAllBoards: Bool {
        rect.width == grid.width && rect.height == grid.height
    }

    /// 把一段同色连续格填成一个矩形，然后清空待用路径。
    private func fillRun(
        context: inout GraphicsContext,
        path: inout Path,
        color: Color,
        code: String,
        startX: Int,
        endX: Int,
        rowY: Int,
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

    private func drawGridLines(
        context: inout GraphicsContext,
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
        context.stroke(path, with: .color(BeadTheme.gridLine.swiftUIColor), lineWidth: 1)
    }

    /// 分板线：整幅视图下按拼板规格画，便于对位拼板。
    private func drawBoardSeams(
        context: inout GraphicsContext,
        origin: CGPoint,
        cell: CGFloat
    ) {
        let board = max(1, grid.boardSize)
        // 与 H5 `seamW = max(2, PRE_CS / 8)` 对齐换算成屏幕宽度
        let width = max(1, cell / 8)
        let boardColor = Color.red.opacity(0.75)
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
