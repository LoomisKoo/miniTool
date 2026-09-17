import CoreGraphics
import Foundation

/// 裁切窗口的几何换算。坐标系统一是「视口点、原点左上」。
///
/// 对应 H5 的 `computeTargetCropSize` / `computeMinScale` / `clampOffset` / `getCropSourceRect`：
/// 图片以「视口中心 + `offset`」为中心绘制，先旋转再镜像，最后按 `displayScale` 缩放。
///
/// 缩放口径：`zoom = 1` 表示图片刚好**盖满**裁切框（H5 的最小缩放），
/// 再往下会被夹住——裁切工具的框内不能出现留白。
struct CropGeometry {

    /// 缩放上限（相对「盖满」的倍数）。
    static let maxZoom: CGFloat = 6

    /// 视口尺寸（点）。
    let viewportSize: CGSize
    /// 原图像素尺寸。
    let imagePixelSize: CGSize
    /// 顺时针 90° 步数（0…3）。
    let quarterTurns: Int
    let flipX: Bool
    /// 相对「最小覆盖缩放」的倍数，范围 `1...maxZoom`。
    let zoom: CGFloat
    /// 已夹紧的位移（点，相对视口中心）。
    let offset: CGPoint

    /// 裁切框（视口坐标，居中）。
    let cropRect: CGRect
    /// 源像素 → 视口点 的缩放系数。
    let displayScale: CGFloat
    /// 旋转后的图像在视口上的显示尺寸。
    let displaySize: CGSize
    /// 旋转后的图像像素尺寸。
    let rotatedImageSize: CGSize

    /// 视口或图片还没准备好时的兜底几何。
    static let empty = CropGeometry()

    private init() {
        viewportSize = .zero
        imagePixelSize = .zero
        quarterTurns = 0
        flipX = false
        zoom = 1
        offset = .zero
        cropRect = .zero
        displayScale = 1
        displaySize = .zero
        rotatedImageSize = .zero
    }

    init(
        viewportSize: CGSize,
        imagePixelSize: CGSize,
        ratioId: String,
        zoom: CGFloat,
        offset: CGPoint,
        quarterTurns: Int,
        flipX: Bool
    ) {
        self.viewportSize = viewportSize
        self.imagePixelSize = imagePixelSize
        let turns = ((quarterTurns % 4) + 4) % 4
        self.quarterTurns = turns
        self.flipX = flipX

        let rotated = turns % 2 == 0
            ? imagePixelSize
            : CGSize(width: imagePixelSize.height, height: imagePixelSize.width)
        self.rotatedImageSize = rotated

        guard viewportSize.width > 1, viewportSize.height > 1, rotated.width > 0, rotated.height > 0 else {
            self.cropRect = .zero
            self.displayScale = 1
            self.displaySize = .zero
            self.offset = .zero
            self.zoom = 1
            return
        }

        let ratio = CropRatio.find(ratioId)
        let aspect = ratio.aspect ?? (rotated.width / rotated.height)

        // 1. 裁切框：视口内最大的等比例矩形；自由比例改用图片自身比例，四周留一点边。
        let inset: CGFloat = ratio.aspect == nil ? 0.92 : 1
        var boxW = viewportSize.width * inset
        var boxH = boxW / aspect
        if boxH > viewportSize.height * inset {
            boxH = viewportSize.height * inset
            boxW = boxH * aspect
        }
        let box = CGRect(
            x: ((viewportSize.width - boxW) / 2).rounded(.down),
            y: ((viewportSize.height - boxH) / 2).rounded(.down),
            width: boxW.rounded(.down),
            height: boxH.rounded(.down)
        )
        self.cropRect = box

        // 2. 最小缩放：让图片刚好盖住裁切框。
        let cover = max(box.width / rotated.width, box.height / rotated.height)
        self.zoom = min(max(zoom, 1), Self.maxZoom)

        let scale = cover * self.zoom
        self.displayScale = scale
        self.displaySize = CGSize(width: rotated.width * scale, height: rotated.height * scale)

        // 3. 位移夹紧：图片必须始终覆盖裁切框。
        var clamped = offset
        let drawnW = self.displaySize.width
        let drawnH = self.displaySize.height
        let drawnX = viewportSize.width / 2 + offset.x - drawnW / 2
        let drawnY = viewportSize.height / 2 + offset.y - drawnH / 2
        if drawnX > box.minX { clamped.x -= drawnX - box.minX }
        if drawnY > box.minY { clamped.y -= drawnY - box.minY }
        if drawnX + drawnW < box.maxX { clamped.x += box.maxX - (drawnX + drawnW) }
        if drawnY + drawnH < box.maxY { clamped.y += box.maxY - (drawnY + drawnH) }
        self.offset = clamped
    }

    /// 输出计划：视口点 → 输出像素的密度，以及输出画布尺寸。
    ///
    /// 密度取 `1 / displayScale`（即 1:1 还原源像素），超过 `maxSide` 时整体等比压缩。
    func outputPlan(maxSide: CGFloat) -> (density: CGFloat, size: CGSize) {
        guard cropRect.width > 0, cropRect.height > 0, displayScale > 0 else {
            return (1, CGSize(width: 1, height: 1))
        }
        var density = 1 / displayScale
        let rawMax = max(cropRect.width, cropRect.height) * density
        if rawMax > maxSide {
            density *= maxSide / rawMax
        }
        let size = CGSize(
            width: max(1, (cropRect.width * density).rounded()),
            height: max(1, (cropRect.height * density).rounded())
        )
        return (density, size)
    }

    /// 圆形蒙版的半径（内接于裁切框）。
    var circleRadius: CGFloat { min(cropRect.width, cropRect.height) / 2 }

    /// 圆角半径（按裁切框短边的百分比）。
    func cornerRadius(percent: CGFloat) -> CGFloat {
        min(cropRect.width, cropRect.height) * (percent / 100)
    }
}
