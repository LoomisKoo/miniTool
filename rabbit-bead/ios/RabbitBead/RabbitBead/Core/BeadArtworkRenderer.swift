import Foundation
import UIKit

/// 导出图纸：单豆按实物 5mm @ 300DPI 换算，用 UIKit 绘制（`UIGraphicsImageRenderer`），
/// 最终由 `JpegEncoder` 编成带 300DPI 密度的 JPEG。
///
/// 版式对齐 H5 `measureExport` / `exportDataUrl`：标题字号随单豆像素、图例色块 = 2×2 格，
/// 块内色号 + 下方颗数，列数按可用宽度自适应。
enum BeadArtworkRenderer {

    /// 单豆导出像素：5mm @ 300DPI ≈ 59px
    private static let idealCell = 59
    private static let minCell = 8
    private static let proMaxSide = 4096
    private static let freeMaxSide = 1200
    private static let maxArea = 16_777_216

    /// 打印 DPI。写入导出的 JPEG 密度段，打印选「实际大小」时每格正好 5mm。
    static let printDPI = 300

    /// 图纸底部广告条高度（仅免费版绘制）。
    private static let promoHeight = 52

    private static let gridColor = UIColor(white: 0.78, alpha: 1)
    private static let seamColor = UIColor(red: 1, green: 0.23, blue: 0.19, alpha: 1)
    private static let inkColor = UIColor(white: 0.13, alpha: 1)
    /// 图纸底部条文案。iOS 端这里是署名，不是 H5 那种引流（用户已经在 App 里了）。
    private static let promoText = "兔格拼豆 · 照片转拼豆色号图纸".loc

    /// 导出画质档位。
    struct Quality: Sendable {
        var showPromo: Bool
        var maxSide: Int

        static let free = Quality(showPromo: true, maxSide: freeMaxSide)
        static let pro = Quality(showPromo: false, maxSide: proMaxSide)
    }

    /// 与 H5 `measureExport` 对齐的版式量。
    private struct Metrics {
        let pad: CGFloat
        let padBottom: CGFloat
        let axisTop: CGFloat
        let axisBottom: CGFloat
        let axisLeft: CGFloat
        let axisRight: CGFloat
        let metaH: CGFloat
        let titleSize: CGFloat
        let subSize: CGFloat
        let tipSize: CGFloat
        let sw: CGFloat
        let swR: CGFloat
        let itemGapX: CGFloat
        let itemGapY: CGFloat
        let countGap: CGFloat
        let itemH: CGFloat
        let legendCols: Int
        let legendRows: Int
        let legendTop: CGFloat
        let outW: CGFloat
        let outH: CGFloat
        let cell: Int
        let patternW: CGFloat
        let patternH: CGFloat
    }

    /// 生成图纸。返回 nil 表示区域为空。尺寸超出上限时自动缩小单豆像素（与 H5 端策略一致）。
    static func render(
        grid: BeadGrid,
        palette: BeadPalette,
        settings: BeadSettings,
        rect: GridRect,
        boardLabel: String,
        quality: Quality
    ) -> UIImage? {
        guard rect.width > 0, rect.height > 0 else { return nil }

        let options = settings.export
        let usage = options.legend ? grid.legendList(palette: palette, in: rect) : []
        let metrics = pickMetrics(
            pw: rect.width,
            ph: rect.height,
            legendCount: usage.count,
            axes: options.coordinates,
            showLegend: options.legend && !usage.isEmpty,
            showMeta: options.title,
            showPromo: quality.showPromo,
            maxSide: quality.maxSide
        )

        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        format.opaque = true
        let renderer = UIGraphicsImageRenderer(
            size: CGSize(width: metrics.outW, height: metrics.outH),
            format: format
        )

        let originX = metrics.pad + metrics.axisLeft
        let originY = metrics.pad + metrics.metaH + metrics.axisTop

        return renderer.image { context in
            let ctx = context.cgContext
            UIColor.white.setFill()
            ctx.fill(CGRect(x: 0, y: 0, width: metrics.outW, height: metrics.outH))

            if options.title {
                drawHeader(
                    grid: grid,
                    palette: palette,
                    settings: settings,
                    rect: rect,
                    boardLabel: boardLabel,
                    shrunk: metrics.cell < idealCell,
                    isPreview: quality.showPromo,
                    metrics: metrics,
                    origin: CGPoint(x: metrics.pad, y: metrics.pad)
                )
            }

            drawBeads(
                grid: grid,
                rect: rect,
                ctx: ctx,
                origin: CGPoint(x: originX, y: originY),
                cell: metrics.cell,
                showCodes: options.codes,
                showGrid: settings.showGrid
            )
            if options.boardSeams {
                drawBoardSeams(
                    grid: grid,
                    rect: rect,
                    ctx: ctx,
                    origin: CGPoint(x: originX, y: originY),
                    cell: metrics.cell
                )
            }
            if options.coordinates {
                drawAxis(
                    grid: grid,
                    rect: rect,
                    ctx: ctx,
                    origin: CGPoint(x: originX, y: originY),
                    cell: metrics.cell,
                    axisTop: metrics.axisTop,
                    axisBottom: metrics.axisBottom,
                    axisLeft: metrics.axisLeft,
                    axisRight: metrics.axisRight
                )
            }
            if options.legend, !usage.isEmpty {
                drawLegend(
                    usage: usage,
                    metrics: metrics,
                    ctx: ctx,
                    pad: metrics.pad
                )
            }

            if quality.showPromo {
                drawPromo(
                    ctx: ctx,
                    origin: CGPoint(
                        x: metrics.pad,
                        y: metrics.outH - metrics.padBottom + 4
                    ),
                    width: metrics.outW - metrics.pad * 2
                )
            }
        }
    }

    // MARK: - 量尺（对齐 H5 measureExport）

    private static func measure(
        cell: Int,
        pw: Int,
        ph: Int,
        legendCount: Int,
        axes: Bool,
        showLegend: Bool,
        showMeta: Bool,
        showPromo: Bool
    ) -> Metrics {
        let c = CGFloat(cell)
        let pad = max(24, round(c * 0.7))
        let padBottom = max(pad + 16, round(c * 1.2)) + (showPromo ? CGFloat(promoHeight) : 0)
        // 坐标是一圈与豆格同大的格子，紧贴图案四边（含四角空格）。
        let axisTop = axes ? c : 0
        let axisBottom = axes ? c : 0
        let axisLeft = axes ? c : 0
        let axisRight = axes ? c : 0
        let titleSize = max(18, round(c * 0.58))
        let subSize = max(12, round(c * 0.4))
        let tipSize = max(10, round(c * 0.3))
        let metaH = showMeta
            ? round(titleSize * 1.05 + subSize * 1.25 + tipSize * 2.1 + 16)
            : 0

        // 图例色块随单豆缩放；不要卡 48px 下限——缩小导出时否则只剩 1～2 列，
        // 图例变成细长条、图案被压成邮票。
        let sw = max(16, round(c * 1.7))
        let itemGapX = max(8, round(sw * 0.18))
        let itemGapY = max(10, round(sw * 0.22))
        let countGap = max(4, round(sw * 0.1))
        let countH = max(12, round(sw * 0.34))
        let itemH = sw + countGap + countH
        let patternW = CGFloat(pw) * c
        let patternH = CGFloat(ph) * c
        var outW = pad + axisLeft + patternW + axisRight + pad
        if showLegend, legendCount > 0 {
            // 按色数开足够的列，避免「两列细长条」。
            let targetCols = min(
                legendCount,
                max(8, Int(ceil(sqrt(Double(legendCount) * 1.8))))
            )
            let neededInner = CGFloat(targetCols) * sw + CGFloat(max(0, targetCols - 1)) * itemGapX
            outW = max(outW, neededInner + pad * 2)
        }
        let innerW = outW - pad * 2
        let maxCols = showLegend && legendCount > 0
            ? max(1, Int(floor((innerW + itemGapX) / (sw + itemGapX))))
            : 1
        let legendCols = showLegend && legendCount > 0 ? min(maxCols, legendCount) : 1
        let legendRows = showLegend && legendCount > 0
            ? Int(ceil(Double(legendCount) / Double(legendCols)))
            : 0
        let legendTop = pad + metaH + axisTop + patternH + axisBottom
            + (legendRows > 0 ? round(c * 0.55) : 0)
        let legendH = legendRows > 0
            ? CGFloat(legendRows) * (itemH + itemGapY) - itemGapY
            : 0
        let outH: CGFloat
        if showLegend, legendCount > 0 {
            outH = legendTop + legendH + padBottom
        } else {
            outH = pad + metaH + axisTop + patternH + axisBottom + padBottom
        }

        return Metrics(
            pad: pad,
            padBottom: padBottom,
            axisTop: axisTop,
            axisBottom: axisBottom,
            axisLeft: axisLeft,
            axisRight: axisRight,
            metaH: metaH,
            titleSize: titleSize,
            subSize: subSize,
            tipSize: tipSize,
            sw: sw,
            swR: max(4, round(sw * 0.18)),
            itemGapX: itemGapX,
            itemGapY: itemGapY,
            countGap: countGap,
            itemH: itemH,
            legendCols: legendCols,
            legendRows: legendRows,
            legendTop: legendTop,
            outW: outW,
            outH: outH,
            cell: cell,
            patternW: patternW,
            patternH: patternH
        )
    }

    private static func pickMetrics(
        pw: Int,
        ph: Int,
        legendCount: Int,
        axes: Bool,
        showLegend: Bool,
        showMeta: Bool,
        showPromo: Bool,
        maxSide: Int
    ) -> Metrics {
        var cell = idealCell
        for _ in 0..<8 {
            let m = measure(
                cell: cell, pw: pw, ph: ph, legendCount: legendCount,
                axes: axes, showLegend: showLegend, showMeta: showMeta, showPromo: showPromo
            )
            let area = m.outW * m.outH
            if m.outW <= CGFloat(maxSide), m.outH <= CGFloat(maxSide), area <= CGFloat(maxArea) {
                return m
            }
            let scale = min(
                CGFloat(maxSide) / m.outW,
                CGFloat(maxSide) / m.outH,
                sqrt(CGFloat(maxArea) / max(1, area))
            )
            cell = max(minCell, Int(floor(CGFloat(cell) * min(0.98, scale))))
        }
        return measure(
            cell: cell, pw: pw, ph: ph, legendCount: legendCount,
            axes: axes, showLegend: showLegend, showMeta: showMeta, showPromo: showPromo
        )
    }

    // MARK: - 标题

    private static func drawHeader(
        grid: BeadGrid,
        palette: BeadPalette,
        settings: BeadSettings,
        rect: GridRect,
        boardLabel: String,
        shrunk: Bool,
        isPreview: Bool,
        metrics: Metrics,
        origin: CGPoint
    ) {
        let title = "兔格拼豆 · %@".loc(palette.name) as NSString
        title.draw(
            at: CGPoint(x: origin.x, y: origin.y + metrics.titleSize * 0.05),
            withAttributes: [
                .font: UIFont.systemFont(ofSize: metrics.titleSize, weight: .bold),
                .foregroundColor: inkColor,
            ]
        )

        var subtitle = "\(grid.width)×\(grid.height)"
        if !boardLabel.isEmpty { subtitle += " · \(boardLabel)" }
        else if settings.export.boardScope == .full, grid.boardCount == 1 {
            subtitle += " · 全图".loc
        } else if boardLabel.isEmpty {
            subtitle += " · 全图".loc
        }
        subtitle += " · 每格5mm".loc
        if settings.export.coordinates { subtitle += " · 坐标版".loc }
        if shrunk { subtitle += isPreview ? " · 预览尺寸".loc : " · 已缩小导出".loc }
        (subtitle as NSString).draw(
            at: CGPoint(x: origin.x, y: origin.y + metrics.titleSize + metrics.subSize * 0.15),
            withAttributes: [
                .font: UIFont.systemFont(ofSize: metrics.subSize, weight: .regular),
                .foregroundColor: UIColor(white: 0.27, alpha: 1),
            ]
        )

        let tip = (isPreview
            ? "免费版为预览尺寸；解锁 Pro 可导出 300DPI 打印级图纸".loc
            : "打印请选「实际大小 / 100%」，勿勾选适应页面（300 DPI）".loc) as NSString
        tip.draw(
            at: CGPoint(
                x: origin.x,
                y: origin.y + metrics.titleSize + metrics.subSize + metrics.tipSize * 0.9
            ),
            withAttributes: [
                .font: UIFont.systemFont(ofSize: metrics.tipSize, weight: .regular),
                .foregroundColor: UIColor(white: 0.47, alpha: 1),
            ]
        )
    }

    // MARK: - 底部广告

    private static func drawPromo(ctx: CGContext, origin: CGPoint, width: CGFloat) {
        ctx.setStrokeColor(UIColor(white: 0.88, alpha: 1).cgColor)
        ctx.setLineWidth(1)
        ctx.move(to: CGPoint(x: origin.x, y: origin.y))
        ctx.addLine(to: CGPoint(x: origin.x + width, y: origin.y))
        ctx.strokePath()

        let text = promoText as NSString
        let attributes: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 18, weight: .medium),
            .foregroundColor: UIColor(red: 0, green: 122 / 255, blue: 1, alpha: 1),
        ]
        let size = text.size(withAttributes: attributes)
        text.draw(
            at: CGPoint(
                x: origin.x + max(0, (width - size.width) / 2),
                y: origin.y + 12
            ),
            withAttributes: attributes
        )
    }

    // MARK: - 格子

    /// 格内色号：字号随格宽缩放；缩小导出时也要能写下色号（不再卡 cell≥22）。
    private static func codeAttributes(for rgb: RGB8, cell: Int) -> [NSAttributedString.Key: Any] {
        let size = max(5 as CGFloat, (CGFloat(cell) * 0.36).rounded(.down))
        return [
            .font: UIFont.systemFont(ofSize: size, weight: .medium),
            .foregroundColor: rgb.wantsDarkOverlayText
                ? UIColor(white: 0, alpha: 0.72)
                : UIColor(white: 1, alpha: 0.9),
        ]
    }

    private static func drawBeads(
        grid: BeadGrid,
        rect: GridRect,
        ctx: CGContext,
        origin: CGPoint,
        cell: Int,
        showCodes: Bool,
        showGrid: Bool
    ) {
        let cellSize = CGFloat(cell)
        var codeAttributesByColor: [RGB8: [NSAttributedString.Key: Any]] = [:]
        var fillColorByBead: [BeadCell: CGColor] = [:]

        // 空格不铺色，留白底（与 H5 `drawPattern` 的 `continue` 一致）
        for y in rect.y0..<rect.y1 {
            for x in rect.x0..<rect.x1 {
                let bead = grid[x, y]
                guard !bead.isEmpty else { continue }
                let box = CGRect(
                    x: origin.x + CGFloat(x - rect.x0) * cellSize,
                    y: origin.y + CGFloat(y - rect.y0) * cellSize,
                    width: cellSize,
                    height: cellSize
                )

                let cgColor: CGColor
                if let cached = fillColorByBead[bead] {
                    cgColor = cached
                } else {
                    cgColor = bead.rgb.uiColor.cgColor
                    fillColorByBead[bead] = cgColor
                }
                ctx.setFillColor(cgColor)
                ctx.fill(box.insetBy(dx: -0.25, dy: -0.25))

                // 开了格内色号就每格都写：免费预览缩小单豆后也不再整页没字。
                if showCodes {
                    let attributes: [NSAttributedString.Key: Any]
                    if let cached = codeAttributesByColor[bead.rgb] {
                        attributes = cached
                    } else {
                        attributes = codeAttributes(for: bead.rgb, cell: cell)
                        codeAttributesByColor[bead.rgb] = attributes
                    }
                    let text = bead.code as NSString
                    let size = text.size(withAttributes: attributes)
                    text.draw(
                        at: CGPoint(x: box.midX - size.width / 2, y: box.midY - size.height / 2),
                        withAttributes: attributes
                    )
                }
            }
        }

        guard showGrid else { return }
        ctx.setStrokeColor(gridColor.cgColor)
        ctx.setLineWidth(1)
        ctx.setShouldAntialias(false)
        for x in 0...rect.width {
            let px = origin.x + CGFloat(x) * cellSize
            ctx.move(to: CGPoint(x: px, y: origin.y))
            ctx.addLine(to: CGPoint(x: px, y: origin.y + CGFloat(rect.height) * cellSize))
        }
        for y in 0...rect.height {
            let py = origin.y + CGFloat(y) * cellSize
            ctx.move(to: CGPoint(x: origin.x, y: py))
            ctx.addLine(to: CGPoint(x: origin.x + CGFloat(rect.width) * cellSize, y: py))
        }
        ctx.strokePath()
        ctx.setShouldAntialias(true)
    }

    private static func drawBoardSeams(
        grid: BeadGrid,
        rect: GridRect,
        ctx: CGContext,
        origin: CGPoint,
        cell: Int
    ) {
        guard grid.boardCount > 1 else { return }
        let cellSize = CGFloat(cell)
        let seamW = max(2, CGFloat(cell) / 10)
        ctx.setFillColor(seamColor.cgColor)

        for x in (rect.x0 + 1)..<rect.x1 {
            guard x % grid.boardSize == 0 else { continue }
            let px = origin.x + CGFloat(x - rect.x0) * cellSize - floor(seamW / 2)
            ctx.fill(CGRect(
                x: px, y: origin.y,
                width: seamW, height: CGFloat(rect.height) * cellSize
            ))
        }
        for y in (rect.y0 + 1)..<rect.y1 {
            guard y % grid.boardSize == 0 else { continue }
            let py = origin.y + CGFloat(y - rect.y0) * cellSize - floor(seamW / 2)
            ctx.fill(CGRect(
                x: origin.x, y: py,
                width: CGFloat(rect.width) * cellSize, height: seamW
            ))
        }
    }

    // MARK: - 坐标轴

    /// 坐标格内字号：压到一格装得下，每格都标。
    private static func axisFontSize(cell: CGFloat, widest: String) -> CGFloat {
        let ideal = max(10, cell * 0.42)
        let idealWidth = labelWidth(widest, size: ideal)
        let fitting = min(
            ideal,
            cell * 0.72,
            idealWidth > 0 ? ideal * cell * 0.88 / idealWidth : ideal
        )
        return max(5, fitting)
    }

    private static func labelWidth(_ text: String, size: CGFloat) -> CGFloat {
        (text as NSString)
            .size(withAttributes: [.font: UIFont.systemFont(ofSize: size, weight: .regular)])
            .width
    }

    /// 四边各画一圈与豆格同大的坐标格，紧贴图案；四角空格补齐边框。
    private static func drawAxis(
        grid: BeadGrid,
        rect: GridRect,
        ctx: CGContext,
        origin: CGPoint,
        cell: Int,
        axisTop: CGFloat,
        axisBottom: CGFloat,
        axisLeft: CGFloat,
        axisRight: CGFloat
    ) {
        _ = grid
        _ = axisTop
        _ = axisBottom
        _ = axisLeft
        _ = axisRight
        let cellSize = CGFloat(cell)
        let patternW = CGFloat(rect.width) * cellSize
        let patternH = CGFloat(rect.height) * cellSize
        let colFont = axisFontSize(cell: cellSize, widest: "\(rect.x0 + rect.width)")
        let rowFont = axisFontSize(cell: cellSize, widest: "\(rect.y0 + rect.height)")
        let columnAttributes: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: colFont, weight: .medium),
            .foregroundColor: UIColor(white: 0.22, alpha: 1),
        ]
        let rowAttributes: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: rowFont, weight: .medium),
            .foregroundColor: UIColor(white: 0.22, alpha: 1),
        ]

        func strokeCell(_ box: CGRect) {
            ctx.setStrokeColor(gridColor.cgColor)
            ctx.setLineWidth(1)
            ctx.stroke(box.insetBy(dx: 0.5, dy: 0.5))
        }

        func fillAxisCell(_ box: CGRect) {
            ctx.setFillColor(UIColor(white: 0.97, alpha: 1).cgColor)
            ctx.fill(box)
            strokeCell(box)
        }

        func drawCentered(_ text: NSString, in box: CGRect, attributes: [NSAttributedString.Key: Any]) {
            let size = text.size(withAttributes: attributes)
            text.draw(
                at: CGPoint(x: box.midX - size.width / 2, y: box.midY - size.height / 2),
                withAttributes: attributes
            )
        }

        // 上 / 下：与每一列对齐
        for i in 0..<rect.width {
            let x = origin.x + CGFloat(i) * cellSize
            let top = CGRect(x: x, y: origin.y - cellSize, width: cellSize, height: cellSize)
            let bottom = CGRect(x: x, y: origin.y + patternH, width: cellSize, height: cellSize)
            fillAxisCell(top)
            fillAxisCell(bottom)
            let label = "\(rect.x0 + i + 1)" as NSString
            drawCentered(label, in: top, attributes: columnAttributes)
            drawCentered(label, in: bottom, attributes: columnAttributes)
        }

        // 左 / 右：与每一行对齐
        for j in 0..<rect.height {
            let y = origin.y + CGFloat(j) * cellSize
            let left = CGRect(x: origin.x - cellSize, y: y, width: cellSize, height: cellSize)
            let right = CGRect(x: origin.x + patternW, y: y, width: cellSize, height: cellSize)
            fillAxisCell(left)
            fillAxisCell(right)
            let label = "\(rect.y0 + j + 1)" as NSString
            drawCentered(label, in: left, attributes: rowAttributes)
            drawCentered(label, in: right, attributes: rowAttributes)
        }

        // 四角空格，把边框接成一圈
        let corners = [
            CGRect(x: origin.x - cellSize, y: origin.y - cellSize, width: cellSize, height: cellSize),
            CGRect(x: origin.x + patternW, y: origin.y - cellSize, width: cellSize, height: cellSize),
            CGRect(x: origin.x - cellSize, y: origin.y + patternH, width: cellSize, height: cellSize),
            CGRect(x: origin.x + patternW, y: origin.y + patternH, width: cellSize, height: cellSize),
        ]
        for box in corners {
            fillAxisCell(box)
        }
    }

    // MARK: - 用量图例（对齐 H5：2×2 色块 + 块内色号 + 下方颗数）

    private static func drawLegend(
        usage: [(color: PaletteColor, count: Int)],
        metrics: Metrics,
        ctx: CGContext,
        pad: CGFloat
    ) {
        let sw = metrics.sw
        let swR = metrics.swR
        let codeFont = UIFont.systemFont(ofSize: max(8, round(sw * 0.42)), weight: .bold)
        let countFont = UIFont.systemFont(ofSize: max(7, round(sw * 0.32)), weight: .semibold)
        let strokeW = max(1, round(sw * 0.02))

        for (index, item) in usage.enumerated() {
            let col = index % metrics.legendCols
            let row = index / metrics.legendCols
            let lx = pad + CGFloat(col) * (sw + metrics.itemGapX)
            let ly = metrics.legendTop + CGFloat(row) * (metrics.itemH + metrics.itemGapY)
            let box = CGRect(x: lx, y: ly, width: sw, height: sw)

            let path = UIBezierPath(roundedRect: box, cornerRadius: swR)
            ctx.setFillColor(item.color.rgb.uiColor.cgColor)
            ctx.addPath(path.cgPath)
            ctx.fillPath()

            ctx.setStrokeColor(UIColor(white: 0, alpha: 0.14).cgColor)
            ctx.setLineWidth(strokeW)
            ctx.addPath(
                UIBezierPath(
                    roundedRect: box.insetBy(dx: 0.5, dy: 0.5),
                    cornerRadius: swR
                ).cgPath
            )
            ctx.strokePath()

            let ink = item.color.rgb.legendInk
            let code = item.color.code as NSString
            let codeAttrs: [NSAttributedString.Key: Any] = [
                .font: codeFont,
                .foregroundColor: ink.uiColor,
            ]
            let codeSize = code.size(withAttributes: codeAttrs)
            code.draw(
                at: CGPoint(
                    x: box.midX - codeSize.width / 2,
                    y: box.midY - codeSize.height / 2 + 1
                ),
                withAttributes: codeAttrs
            )

            let count = "\(item.count)" as NSString
            let countAttrs: [NSAttributedString.Key: Any] = [
                .font: countFont,
                .foregroundColor: UIColor(white: 0.27, alpha: 1),
            ]
            let countSize = count.size(withAttributes: countAttrs)
            count.draw(
                at: CGPoint(
                    x: box.midX - countSize.width / 2,
                    y: ly + sw + metrics.countGap
                ),
                withAttributes: countAttrs
            )
        }
    }
}

extension RGB8 {
    var uiColor: UIColor {
        UIColor(
            red: CGFloat(r) / 255,
            green: CGFloat(g) / 255,
            blue: CGFloat(b) / 255,
            alpha: 1
        )
    }
}
