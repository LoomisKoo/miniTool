import CoreGraphics
import UIKit

/// 把当前裁切窗口烘焙成成品图。对应 H5 `processCrop`。
enum CropRenderer {

    /// 一张成品图。
    struct Output: Identifiable {
        let id = UUID()
        let image: UIImage
        /// 宫格序号（1 起）；单图为 `nil`。
        let index: Int?
        /// 保存时要走 PNG（形状裁切有透明区）。
        let keepsAlpha: Bool

        var saveItem: PhotoLibrary.Item {
            PhotoLibrary.Item(image: image, keepsAlpha: keepsAlpha)
        }
    }

    /// 成品最长边上限（像素）。比 H5 的 1440 高一档，尽量还原原图细节。
    static let maxOutputSide: CGFloat = 4096
    /// 宫格切片时收紧上限，避免整图 + 多张切片的峰值内存过高。
    static let gridOutputSide: CGFloat = 3072

    /// - Parameters:
    ///   - grid: 非单图时按格子切成多张（与 H5 一致，形状蒙版只作用于单图）。
    static func render(
        image: CGImage,
        geometry: CropGeometry,
        grid: CropGrid,
        shape: CropShape,
        radiusPercent: CGFloat
    ) -> [Output] {
        let plan = geometry.outputPlan(maxSide: grid.isSingle ? maxOutputSide : gridOutputSide)
        let outSize = plan.size
        let usesShapeMask = shape.keepsAlpha && grid.isSingle
        let keepsAlpha = usesShapeMask

        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        format.opaque = !keepsAlpha

        let renderer = UIGraphicsImageRenderer(size: outSize, format: format)
        let full = renderer.image { context in
            let cg = context.cgContext
            cg.interpolationQuality = .high

            if !keepsAlpha {
                // 兜底：位图上下文是不透明的，先把底色刷掉，避免出现未初始化的脏像素
                cg.setFillColor(UIColor.white.cgColor)
                cg.fill(CGRect(origin: .zero, size: outSize))
            }

            // 画布：把裁切框铺满输出图。
            cg.saveGState()
            cg.scaleBy(x: plan.density, y: plan.density)
            cg.translateBy(x: -geometry.cropRect.minX, y: -geometry.cropRect.minY)

            // 相机：中心 + 位移 → 旋转 → 镜像 → 缩放。
            cg.translateBy(
                x: geometry.viewportSize.width / 2 + geometry.offset.x,
                y: geometry.viewportSize.height / 2 + geometry.offset.y
            )
            if geometry.quarterTurns != 0 {
                cg.rotate(by: CGFloat(geometry.quarterTurns) * .pi / 2)
            }
            if geometry.flipX {
                cg.scaleBy(x: -1, y: 1)
            }
            cg.scaleBy(x: geometry.displayScale, y: geometry.displayScale)
            UIImage(cgImage: image).draw(
                in: CGRect(
                    x: -geometry.imagePixelSize.width / 2,
                    y: -geometry.imagePixelSize.height / 2,
                    width: geometry.imagePixelSize.width,
                    height: geometry.imagePixelSize.height
                )
            )
            cg.restoreGState()

            guard usesShapeMask else { return }

            // 形状蒙版：只保留裁切形状内的像素。
            cg.saveGState()
            cg.setBlendMode(.destinationIn)
            cg.setFillColor(UIColor.black.cgColor)
            let box = CGRect(origin: .zero, size: outSize)
            switch shape {
            case .circle:
                let radius = min(outSize.width, outSize.height) / 2
                cg.addArc(
                    center: CGPoint(x: box.midX, y: box.midY),
                    radius: radius,
                    startAngle: 0,
                    endAngle: .pi * 2,
                    clockwise: true
                )
            case .round:
                let radius = min(outSize.width, outSize.height) * (radiusPercent / 100)
                cg.addPath(UIBezierPath(roundedRect: box, cornerRadius: radius).cgPath)
            case .rect:
                break
            }
            cg.fillPath()
            cg.restoreGState()
        }

        guard !grid.isSingle else {
            return [Output(image: full, index: nil, keepsAlpha: keepsAlpha)]
        }

        guard let fullCG = full.cgImage else { return [] }
        let totalW = fullCG.width
        let totalH = fullCG.height
        let cellW = totalW / grid.cols
        let cellH = totalH / grid.rows
        guard cellW > 0, cellH > 0 else { return [] }

        var outputs: [Output] = []
        for row in 0..<grid.rows {
            for col in 0..<grid.cols {
                let rect = CGRect(x: col * cellW, y: row * cellH, width: cellW, height: cellH)
                guard let tile = fullCG.cropping(to: rect) else { continue }
                outputs.append(
                    Output(
                        image: UIImage(cgImage: tile),
                        index: row * grid.cols + col + 1,
                        keepsAlpha: false
                    )
                )
            }
        }
        return outputs
    }
}
