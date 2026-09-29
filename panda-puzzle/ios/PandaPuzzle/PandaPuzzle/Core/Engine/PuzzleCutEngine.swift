import UIKit

enum PuzzleCutEngine {
    static let maxDim = 50

    static func suggestGrid(imageWidth: Int, imageHeight: Int, preferTotal: Int = 24) -> (cols: Int, rows: Int) {
        let iw = max(1, imageWidth)
        let ih = max(1, imageHeight)
        let aspect = Double(iw) / Double(ih)
        var best = (cols: aspect >= 1 ? 6 : 4, rows: aspect >= 1 ? 4 : 6, score: Double.infinity)
        for rows in 2...24 {
            let cols = max(2, min(maxDim, Int(round(Double(rows) * aspect))))
            let total = cols * rows
            if total < 8 || total > min(PuzzleLimits.proMaxPieces, preferTotal * 3) { continue }
            let aspectErr = abs(Double(cols) / Double(rows) - aspect)
            let totalErr = abs(Double(total - preferTotal)) / Double(preferTotal)
            let score = aspectErr * 3 + totalErr
            if score < best.score { best = (cols, rows, score) }
        }
        return (best.cols, best.rows)
    }

    static func cut(
        image: UIImage,
        cols: Int,
        rows: Int,
        cropView: CropView = CropView()
    ) -> [PuzzlePieceModel] {
        let cols = max(2, min(maxDim, cols))
        let rows = max(2, min(maxDim, rows))
        guard let cg = normalizedCGImage(image) else { return [] }

        let iw = cg.width
        let ih = cg.height
        let map = JigsawGeometry.buildTabMap(cols: cols, rows: rows)
        let total = cols * rows
        let maxTex = total > 600 ? 64 : total > 200 ? 96 : total > 80 ? 128 : 180
        let cellPx = max(24, maxTex)
        let srcW = cellPx * cols
        let srcH = cellPx * rows

        let crop = JigsawGeometry.cropRect(iw: iw, ih: ih, cols: cols, rows: rows, view: cropView)
        guard let source = renderSourceGrid(from: cg, crop: crop, dstWidth: srcW, dstHeight: srcH) else { return [] }

        let tabPx = max(5, Int(round(Double(cellPx) * JigsawGeometry.tabRatio)))
        let pPad = tabPx + 3
        let s = cellPx

        var pieces: [PuzzlePieceModel] = []
        var order = 0
        for r in 0..<rows {
            for c in 0..<cols {
                let tabs = JigsawGeometry.tabsFor(r: r, c: c, cols: cols, rows: rows, map: map)
                let tex = bakePieceTexture(source: source, r: r, c: c, s: s, pPad: pPad)
                pieces.append(PuzzlePieceModel(
                    id: r * cols + c,
                    row: r,
                    col: c,
                    image: tex,
                    correctSlot: r * cols + c,
                    tabs: tabs,
                    cellPx: s,
                    padPx: pPad,
                    trayOrder: order
                ))
                order += 1
            }
        }
        return pieces
    }

    static func demoImage() -> UIImage {
        let size = CGSize(width: 720, height: 1080)
        let renderer = UIGraphicsImageRenderer(size: size)
        let colors: [UIColor] = [
            UIColor(red: 1, green: 0.56, blue: 0.68, alpha: 1),
            UIColor(red: 0.5, green: 0.85, blue: 0.77, alpha: 1),
            UIColor(red: 1, green: 0.82, blue: 0.49, alpha: 1),
            UIColor(red: 0.61, green: 0.8, blue: 1, alpha: 1),
            UIColor(red: 0.78, green: 0.71, blue: 1, alpha: 1),
            UIColor(red: 1, green: 0.7, blue: 0.54, alpha: 1),
        ]
        return renderer.image { ctx in
            for y in 0..<6 {
                for x in 0..<4 {
                    colors[(x + y * 3) % colors.count].setFill()
                    ctx.fill(CGRect(x: CGFloat(x) * 180, y: CGFloat(y) * 180, width: 181, height: 181))
                }
            }
            let attrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.boldSystemFont(ofSize: 56),
                .foregroundColor: UIColor(red: 0.37, green: 0.2, blue: 0.29, alpha: 0.55),
            ]
            ("熊猫拼图" as NSString).draw(at: CGPoint(x: 72, y: 500), withAttributes: attrs)
        }
    }

    // MARK: - private

    private static func renderSourceGrid(from cg: CGImage, crop: CGRect, dstWidth: Int, dstHeight: Int) -> CGImage? {
        // 全程用 UIKit 顶左坐标绘制，避免 CGImage.cropping 底左原点把图裁反
        let src = UIImage(cgImage: cg, scale: 1, orientation: .up)
        let format = UIGraphicsImageRendererFormat()
        format.opaque = true
        format.scale = 1
        let img = UIGraphicsImageRenderer(size: CGSize(width: dstWidth, height: dstHeight), format: format).image { ctx in
            UIColor.black.setFill()
            ctx.fill(CGRect(x: 0, y: 0, width: dstWidth, height: dstHeight))
            ctx.cgContext.interpolationQuality = .high
            let scaleX = CGFloat(dstWidth) / max(1, crop.width)
            let scaleY = CGFloat(dstHeight) / max(1, crop.height)
            let drawRect = CGRect(
                x: -crop.minX * scaleX,
                y: -crop.minY * scaleY,
                width: CGFloat(cg.width) * scaleX,
                height: CGFloat(cg.height) * scaleY
            )
            src.draw(in: drawRect)
        }
        return img.cgImage
    }

    private static func bakePieceTexture(source: CGImage, r: Int, c: Int, s: Int, pPad: Int) -> UIImage {
        let tw = s + pPad * 2
        let src = UIImage(cgImage: source, scale: 1, orientation: .up)
        let sw = source.width
        let sh = source.height
        let sx = c * s
        let sy = r * s
        let format = UIGraphicsImageRendererFormat()
        format.opaque = false
        format.scale = 1
        return UIGraphicsImageRenderer(size: CGSize(width: tw, height: tw), format: format).image { ctx in
            let g = ctx.cgContext
            g.clear(CGRect(x: 0, y: 0, width: tw, height: tw))
            g.interpolationQuality = .none // 边缘 1px 拉伸不要糊成灰边

            /// 从源图矩形拉到目标矩形（顶左坐标），对齐 H5 drawImage
            func blit(_ srcX: Int, _ srcY: Int, _ srcW: Int, _ srcH: Int,
                      _ dstX: CGFloat, _ dstY: CGFloat, _ dstW: CGFloat, _ dstH: CGFloat) {
                guard srcW > 0, srcH > 0, dstW > 0, dstH > 0 else { return }
                let sx0 = max(0, min(sw - 1, srcX))
                let sy0 = max(0, min(sh - 1, srcY))
                let sw0 = max(1, min(srcW, sw - sx0))
                let sh0 = max(1, min(srcH, sh - sy0))
                let scaleX = dstW / CGFloat(sw0)
                let scaleY = dstH / CGFloat(sh0)
                g.saveGState()
                g.clip(to: CGRect(x: dstX, y: dstY, width: dstW, height: dstH))
                src.draw(in: CGRect(
                    x: dstX - CGFloat(sx0) * scaleX,
                    y: dstY - CGFloat(sy0) * scaleY,
                    width: CGFloat(sw) * scaleX,
                    height: CGFloat(sh) * scaleY
                ))
                g.restoreGState()
            }

            // 只裁出当前拼块附近的源图区域。
            // 旧实现会对每个拼块重复绘制整张 source，图片越大等待越明显。
            let x0 = max(0, sx - pPad)
            let y0 = max(0, sy - pPad)
            let x1 = min(sw, sx + s + pPad)
            let y1 = min(sh, sy + s + pPad)
            let validW = max(1, x1 - x0)
            let validH = max(1, y1 - y0)
            let left = max(0, pPad - sx)
            let top = max(0, pPad - sy)
            let right = max(0, sx + s + pPad - sw)
            let bottom = max(0, sy + s + pPad - sh)

            if let region = source.cropping(to: CGRect(x: x0, y: y0, width: validW, height: validH)) {
                UIImage(cgImage: region, scale: 1, orientation: .up).draw(
                    in: CGRect(x: CGFloat(left), y: CGFloat(top), width: CGFloat(validW), height: CGFloat(validH))
                )
            }

            // 只有超出原图的边缘区域才补边，不能把有效区域整体拉伸。
            if top > 0 {
                blit(x0, 0, validW, 1, CGFloat(left), 0, CGFloat(validW), CGFloat(top))
            }
            if bottom > 0 {
                blit(x0, sh - 1, validW, 1, CGFloat(left), CGFloat(tw - bottom), CGFloat(validW), CGFloat(bottom))
            }
            if left > 0 {
                blit(0, y0, 1, validH, 0, CGFloat(top), CGFloat(left), CGFloat(validH))
            }
            if right > 0 {
                blit(sw - 1, y0, 1, validH, CGFloat(tw - right), CGFloat(top), CGFloat(right), CGFloat(validH))
            }
            if left > 0, top > 0 {
                blit(0, 0, 1, 1, 0, 0, CGFloat(left), CGFloat(top))
            }
            if right > 0, top > 0 {
                blit(sw - 1, 0, 1, 1, CGFloat(tw - right), 0, CGFloat(right), CGFloat(top))
            }
            if left > 0, bottom > 0 {
                blit(0, sh - 1, 1, 1, 0, CGFloat(tw - bottom), CGFloat(left), CGFloat(bottom))
            }
            if right > 0, bottom > 0 {
                blit(sw - 1, sh - 1, 1, 1, CGFloat(tw - right), CGFloat(tw - bottom), CGFloat(right), CGFloat(bottom))
            }
        }
    }

    private static func normalizedCGImage(_ image: UIImage) -> CGImage? {
        let maxPixel = 2048
        let sourceWidth = image.cgImage?.width ?? Int(image.size.width * image.scale)
        let sourceHeight = image.cgImage?.height ?? Int(image.size.height * image.scale)
        let ratio = min(1, Double(maxPixel) / Double(max(sourceWidth, sourceHeight)))
        let targetSize = CGSize(
            width: max(1, CGFloat(sourceWidth) * ratio),
            height: max(1, CGFloat(sourceHeight) * ratio)
        )

        if image.imageOrientation == .up,
           let cg = image.cgImage,
           ratio == 1 {
            return cg
        }

        // 拼块纹理最高只有几百像素，没必要让切图流程处理原始相机大图。
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        return UIGraphicsImageRenderer(size: targetSize, format: format).image { _ in
            image.draw(in: CGRect(origin: .zero, size: targetSize))
        }.cgImage
    }
}
