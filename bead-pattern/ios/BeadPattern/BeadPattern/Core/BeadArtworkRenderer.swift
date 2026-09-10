import Foundation
import UIKit

/// 导出图纸 PNG。用 UIKit 绘制（`UIGraphicsImageRenderer`），单豆按实物 5mm @ 300DPI 换算。
///
/// 版式对齐 H5 `measureExport` / `exportDataUrl`：标题字号随单豆像素、图例色块 = 2×2 格，
/// 块内色号 + 下方颗数，列数按可用宽度自适应。
enum BeadArtworkRenderer {

    /// 单豆导出像素：5mm @ 300DPI ≈ 59px
    private static let idealCell = 59
    private static let minCell = 8
    private static let maxSide = 4096
    private static let maxArea = 16_777_216

    /// 图纸底部广告条高度（始终绘制，不随导出选项开关）。
    private static let promoHeight = 52

    private static let gridColor = UIColor(white: 0.78, alpha: 1)
    private static let seamColor = UIColor(red: 1, green: 0.23, blue: 0.19, alpha: 1)
    private static let inkColor = UIColor(white: 0.13, alpha: 1)
    private static let promoText = "在 App Store 搜索「兔格拼豆」下载 App · 支持 3D 预览与高清图纸"

    /// 与 H5 `measureExport` 对齐的版式量。
    private struct Metrics {
        let pad: CGFloat
        let padBottom: CGFloat
        let axisTop: CGFloat
        let axisLeft: CGFloat
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
        boardLabel: String
    ) -> UIImage? {
        guard rect.width > 0, rect.height > 0 else { return nil }

        let options = settings.export
        let usage = options.legend ? grid.usage(palette: palette, in: rect) : []
        let metrics = pickMetrics(
            pw: rect.width,
            ph: rect.height,
            legendCount: usage.count,
            axes: options.coordinates,
            showLegend: options.legend && !usage.isEmpty,
            showMeta: options.title
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
                    axisLeft: metrics.axisLeft
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

    // MARK: - 量尺（对齐 H5 measureExport）

    private static func measure(
        cell: Int,
        pw: Int,
        ph: Int,
        legendCount: Int,
        axes: Bool,
        showLegend: Bool,
        showMeta: Bool
    ) -> Metrics {
        let c = CGFloat(cell)
        let pad = max(36, round(c * 0.7))
        let padBottom = max(pad + 24, round(c * 1.4)) + CGFloat(promoHeight)
        let axisTop = axes ? max(28, round(c * 0.85)) : 0
        let axisLeft = axes ? max(40, round(c * 1.0)) : 0
        let titleSize = max(28, round(c * 0.58))
        let subSize = max(18, round(c * 0.4))
        let tipSize = max(14, round(c * 0.3))
        let metaH = showMeta
            ? round(titleSize * 1.05 + subSize * 1.25 + tipSize * 2.1 + 20)
            : 0

        // 色块边长 = 2×2 格（四个像素格）
        let sw = max(48, c * 2)
        let itemGapX = max(16, round(sw * 0.22))
        let itemGapY = max(18, round(sw * 0.28))
        let countGap = max(8, round(sw * 0.12))
        let countH = max(22, round(sw * 0.36))
        let itemH = sw + countGap + countH
        let patternW = CGFloat(pw) * c
        let patternH = CGFloat(ph) * c
        let outW = pad + axisLeft + patternW + pad
        let innerW = outW - pad * 2
        let maxCols = showLegend && legendCount > 0
            ? max(1, Int(floor((innerW + itemGapX) / (sw + itemGapX))))
            : 1
        let legendCols = showLegend && legendCount > 0 ? min(maxCols, legendCount) : 1
        let legendRows = showLegend && legendCount > 0
            ? Int(ceil(Double(legendCount) / Double(legendCols)))
            : 0
        let legendTop = pad + metaH + axisTop + patternH
            + (legendRows > 0 ? round(c * 0.55) : 0)
        let legendH = legendRows > 0
            ? CGFloat(legendRows) * (itemH + itemGapY) - itemGapY
            : 0
        let outH: CGFloat
        if showLegend, legendCount > 0 {
            outH = legendTop + legendH + padBottom
        } else {
            outH = pad + metaH + axisTop + patternH + padBottom
        }

        return Metrics(
            pad: pad,
            padBottom: padBottom,
            axisTop: axisTop,
            axisLeft: axisLeft,
            metaH: metaH,
            titleSize: titleSize,
            subSize: subSize,
            tipSize: tipSize,
            sw: sw,
            swR: max(8, round(sw * 0.18)),
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
        showMeta: Bool
    ) -> Metrics {
        var cell = idealCell
        for _ in 0..<8 {
            let m = measure(
                cell: cell, pw: pw, ph: ph, legendCount: legendCount,
                axes: axes, showLegend: showLegend, showMeta: showMeta
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
            axes: axes, showLegend: showLegend, showMeta: showMeta
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
        metrics: Metrics,
        origin: CGPoint
    ) {
        let title = "兔格拼豆 · \(palette.name)" as NSString
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
            subtitle += " · 全图"
        } else if boardLabel.isEmpty {
            subtitle += " · 全图"
        }
        subtitle += " · 每格5mm"
        if settings.export.coordinates { subtitle += " · 坐标版" }
        if shrunk { subtitle += " · 已缩小导出" }
        (subtitle as NSString).draw(
            at: CGPoint(x: origin.x, y: origin.y + metrics.titleSize + metrics.subSize * 0.15),
            withAttributes: [
                .font: UIFont.systemFont(ofSize: metrics.subSize, weight: .regular),
                .foregroundColor: UIColor(white: 0.27, alpha: 1),
            ]
        )

        let tip = "打印请选「实际大小 / 100%」，勿勾选适应页面（300 DPI）" as NSString
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

    private static func codeAttributes(
        for rgb: RGB8,
        font: UIFont
    ) -> [NSAttributedString.Key: Any] {
        if rgb.prefersDarkOverlayText {
            return [
                .font: font,
                .foregroundColor: UIColor(white: 0.10, alpha: 1),
                .strokeColor: UIColor(white: 1, alpha: 0.85),
                .strokeWidth: -2.0,
            ]
        }
        return [
            .font: font,
            .foregroundColor: UIColor(white: 1, alpha: 1),
            .strokeColor: UIColor(white: 0, alpha: 0.75),
            .strokeWidth: -2.0,
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
        let codeFont = UIFont.monospacedSystemFont(ofSize: cellSize * 0.34, weight: .medium)
        var codeAttributesByColor: [RGB8: [NSAttributedString.Key: Any]] = [:]
        var fillColorByBead: [BeadCell: CGColor] = [:]
        let emptyColor = UIColor(white: 0.97, alpha: 1)

        for y in rect.y0..<rect.y1 {
            for x in rect.x0..<rect.x1 {
                let bead = grid[x, y]
                let box = CGRect(
                    x: origin.x + CGFloat(x - rect.x0) * cellSize,
                    y: origin.y + CGFloat(y - rect.y0) * cellSize,
                    width: cellSize,
                    height: cellSize
                )
                if bead.isEmpty {
                    ctx.setFillColor(emptyColor.cgColor)
                    ctx.fill(box)
                    continue
                }

                let cgColor: CGColor
                if let cached = fillColorByBead[bead] {
                    cgColor = cached
                } else {
                    cgColor = bead.rgb.uiColor.cgColor
                    fillColorByBead[bead] = cgColor
                }
                ctx.setFillColor(cgColor)
                ctx.fill(box.insetBy(dx: -0.25, dy: -0.25))

                if showCodes, cell >= 22 {
                    let attributes: [NSAttributedString.Key: Any]
                    if let cached = codeAttributesByColor[bead.rgb] {
                        attributes = cached
                    } else {
                        attributes = codeAttributes(for: bead.rgb, font: codeFont)
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

    private static func drawAxis(
        grid: BeadGrid,
        rect: GridRect,
        ctx: CGContext,
        origin: CGPoint,
        cell: Int,
        axisTop: CGFloat,
        axisLeft: CGFloat
    ) {
        _ = grid
        _ = axisLeft
        let cellSize = CGFloat(cell)
        let font = UIFont.systemFont(ofSize: max(16, cellSize * 0.42), weight: .regular)
        let attributes: [NSAttributedString.Key: Any] = [
            .font: font,
            .foregroundColor: UIColor(white: 0.2, alpha: 1),
        ]

        for i in 0..<rect.width {
            let text = "\(rect.x0 + i + 1)" as NSString
            let size = text.size(withAttributes: attributes)
            let cx = origin.x + CGFloat(i) * cellSize + cellSize / 2
            text.draw(
                at: CGPoint(x: cx - size.width / 2, y: origin.y - axisTop / 2 - size.height / 2 - 1),
                withAttributes: attributes
            )
        }
        for j in 0..<rect.height {
            let text = "\(rect.y0 + j + 1)" as NSString
            let size = text.size(withAttributes: attributes)
            let cy = origin.y + CGFloat(j) * cellSize + cellSize / 2
            text.draw(
                at: CGPoint(x: origin.x - 8 - size.width, y: cy - size.height / 2),
                withAttributes: attributes
            )
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
        let codeFont = UIFont.systemFont(ofSize: max(20, round(sw * 0.42)), weight: .bold)
        let countFont = UIFont.systemFont(ofSize: max(16, round(sw * 0.32)), weight: .semibold)
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

            let ink: UIColor = item.color.rgb.prefersDarkOverlayText
                ? UIColor(white: 0.12, alpha: 0.9)
                : UIColor(white: 1, alpha: 0.92)
            let code = item.color.code as NSString
            let codeAttrs: [NSAttributedString.Key: Any] = [
                .font: codeFont,
                .foregroundColor: ink,
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
