import CoreGraphics
import Observation
import SwiftUI
import UIKit

/// 裁切页面的业务逻辑。
@Observable
final class BeadCropModel {
    // MARK: - 状态
    
    /// 源图（未裁切）。
    var sourceImage: UIImage?
    
    /// 当前选中的比例。
    var selectedRatio: CropRatio = .presets[0]
    
    /// 裁切变换。
    var transform = CropTransform()
    
    /// 裁切框位置与大小（屏幕坐标）。
    var cropFrame: CGRect = .zero
    
    /// 视口大小。
    var viewportSize: CGSize = .zero
    
    /// 最小缩放比例。
    private var minScale: CGFloat = 1
    
    /// 缩放倍数（相对 minScale，0-500%）。
    var zoomPercent: CGFloat = 0 {
        didSet {
            let clamped = max(0, min(500, zoomPercent))
            if clamped != zoomPercent {
                zoomPercent = clamped
            }
            transform.scale = minScale * (1 + zoomPercent / 100)
            clampOffset()
        }
    }
    
    /// 初始裁切区域（源图坐标）。
    private var initRect: CGRect = .zero
    
    /// 初始快照（用于判断是否修改过）。
    private var initSnapshot: CropSnapshot?
    
    // MARK: - 手势状态
    
    /// 是否正在拖动。
    var isDragging = false
    
    /// 拖动模式。
    var dragMode: DragMode = .pan
    
    /// 调整把手位置。
    var resizeHandle: ResizeHandle?
    
    /// 上次触摸位置。
    private var lastLocation: CGPoint = .zero
    
    /// 速度（用于惯性滑动）。
    private var velocity: CGSize = .zero
    
    // MARK: - 初始化
    
    init() {}
    
    // MARK: - 公开方法
    
    /// 打开裁切页面。
    func open(sourceImage: UIImage, existingCrop: CropRect?, viewportSize: CGSize) {
        self.sourceImage = sourceImage
        self.viewportSize = viewportSize
        
        let imageSize = CGSize(width: sourceImage.size.width, height: sourceImage.size.height)
        
        // 初始区域
        if let crop = existingCrop {
            initRect = crop.toCGRect(in: imageSize)
        } else {
            initRect = CGRect(origin: .zero, size: imageSize)
        }
        
        // 匹配比例
        let ratio = initRect.width / initRect.height
        selectedRatio = matchRatio(ratio: ratio, imageRatio: imageSize.width / imageSize.height)
        
        // 重置变换
        transform.reset()
        zoomPercent = 0
        
        // 计算初始视图
        computeInitialView()
        
        // 保存快照
        initSnapshot = makeSnapshot()
    }
    
    /// 重置到初始状态。
    func reset() {
        guard let snapshot = initSnapshot else { return }
        applySnapshot(snapshot, animated: true)
    }
    
    /// 应用裁切。返回 nil 表示未做修改（或无法渲染）。
    ///
    /// 与 H5 `applyCrop` 一致：旋转 / 镜像会真正落到输出像素上，
    /// 覆盖全图且未旋转 / 未镜像时直接回填原图，避免重采样。
    func applyCrop() -> CropOutput? {
        guard let image = sourceImage, let cgImage = image.cgImage else { return nil }

        // 判断是否修改过
        if let snapshot = initSnapshot, isEqualToSnapshot(snapshot) {
            return nil // 未修改
        }

        let imageSize = CGSize(width: cgImage.width, height: cgImage.height)
        let cropRectInSource = cropRectInSourceCoordinates()
        let normalized = CropRect.from(cropRectInSource, in: imageSize)

        // 旋转只可能是 π/2 的整数倍
        let quarter = transform.rotation.truncatingRemainder(dividingBy: .pi / 2)
        let isRotated = abs(quarter) > 0.001

        if normalized.isFull, !transform.isFlipped, !isRotated {
            return CropOutput(image: cgImage, rect: .full, isOriginal: true)
        }

        guard let rendered = render(image: cgImage) else { return nil }
        return CropOutput(image: rendered, rect: normalized, isOriginal: false)
    }

    /// 把当前视口里的图按变换画到目标画布，再把裁切框范围截出来。
    private func render(image: CGImage) -> CGImage? {
        let nw = CGFloat(image.width)
        let nh = CGFloat(image.height)
        guard nw > 0, nh > 0, transform.scale > 0,
              cropFrame.width > 0, cropFrame.height > 0 else { return nil }

        // 屏幕上 1px 对应的源图像素
        var k = 1 / transform.scale
        var outW = cropFrame.width * k
        var outH = cropFrame.height * k
        // 输出最长边上限（与 H5 的 CROP_MAX_OUT 一致）
        let cap = 1600 / max(outW, outH)
        if cap < 1 {
            k *= cap
            outW *= cap
            outH *= cap
        }
        outW = max(1, outW.rounded())
        outH = max(1, outH.rounded())

        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        format.opaque = false

        let rendered = UIGraphicsImageRenderer(size: CGSize(width: outW, height: outH), format: format)
            .image { context in
                let cg = context.cgContext
                cg.scaleBy(x: k, y: k)
                cg.translateBy(x: -cropFrame.minX, y: -cropFrame.minY)
                cg.translateBy(
                    x: viewportSize.width / 2 + transform.offset.width,
                    y: viewportSize.height / 2 + transform.offset.height
                )
                cg.rotate(by: transform.rotation)
                cg.scaleBy(x: transform.isFlipped ? -1 : 1, y: 1)
                let dw = nw * transform.scale
                let dh = nh * transform.scale
                UIImage(cgImage: image).draw(in: CGRect(x: -dw / 2, y: -dh / 2, width: dw, height: dh))
            }
        return rendered.cgImage
    }

    /// 双指捏合：按目标 `scale` 同步缩放百分比（0–500%）。
    func setPinchScale(_ target: CGFloat) {
        guard minScale > 0 else { return }
        zoomPercent = (target / minScale - 1) * 100
    }
    
    /// 切换比例。
    func selectRatio(_ ratio: CropRatio, animated: Bool = true) {
        guard ratio.id != selectedRatio.id else { return }
        selectedRatio = ratio
        
        // 重新计算裁切框
        let targetFrame = computeCropFrame(for: ratio)
        
        if animated {
            withAnimation(.easeOut(duration: 0.26)) {
                cropFrame = targetFrame
                computeMinScale()
                clampOffset()
            }
        } else {
            cropFrame = targetFrame
            computeMinScale()
            clampOffset()
        }
    }
    
    /// 旋转 90 度。
    func rotate() {
        withAnimation(.easeOut(duration: 0.32)) {
            transform.rotate90()
            computeMinScale()
            clampOffset()
        }
    }
    
    /// 切换翻转。
    func flip() {
        withAnimation(.easeOut(duration: 0.32)) {
            transform.toggleFlip()
        }
    }
    
    // MARK: - 手势处理
    
    /// 开始拖动。
    func startDrag(at location: CGPoint) {
        lastLocation = location
        velocity = .zero
        
        // 检测是否点击把手
        if selectedRatio.id == "free" {
            resizeHandle = hitTestHandle(at: location)
            dragMode = resizeHandle != nil ? .resize : .pan
        } else {
            dragMode = .pan
        }
        
        isDragging = true
    }
    
    /// 拖动中。
    func updateDrag(to location: CGPoint) {
        guard isDragging else { return }
        
        let delta = CGSize(
            width: location.x - lastLocation.x,
            height: location.y - lastLocation.y
        )
        
        if dragMode == .resize, let handle = resizeHandle {
            resizeCropFrame(by: delta, handle: handle)
        } else {
            transform.offset.width += delta.width
            transform.offset.height += delta.height
            clampOffset()
            
            // 更新速度（用于惯性）
            velocity.width = velocity.width * 0.6 + delta.width * 0.4
            velocity.height = velocity.height * 0.6 + delta.height * 0.4
        }
        
        lastLocation = location
    }
    
    /// 结束拖动。
    func endDrag() {
        isDragging = false
        dragMode = .pan
        resizeHandle = nil
        
        // TODO: 实现惯性滑动
    }
    
    // MARK: - 私有方法
    
    /// 匹配比例预设。
    private func matchRatio(ratio: CGFloat, imageRatio: CGFloat) -> CropRatio {
        for preset in CropRatio.presets {
            if preset.id == "orig" {
                if abs(imageRatio - ratio) / ratio < 0.004 {
                    return preset
                }
            } else if preset.id == "free" {
                continue
            } else if let ar = preset.aspectRatio {
                if abs(ar - ratio) / ratio < 0.004 {
                    return preset
                }
            }
        }
        return CropRatio.presets.last! // free
    }
    
    /// 计算初始视图。
    private func computeInitialView() {
        guard let image = sourceImage else { return }
        
        let imageSize = CGSize(width: image.size.width, height: image.size.height)
        let initAspect = initRect.width / initRect.height
        
        // 计算裁切框
        if selectedRatio.id == "free" {
            cropFrame = computeCropFrameForAspect(initAspect, isFree: true)
        } else {
            cropFrame = computeCropFrame(for: selectedRatio)
        }
        
        // 计算最小缩放
        computeMinScale()
        
        // 计算需要的缩放倍数（让初始区域铺满裁切框）
        let scaleToFit = max(
            cropFrame.width / initRect.width,
            cropFrame.height / initRect.height,
            minScale
        )
        
        zoomPercent = min(500, max(0, (scaleToFit / minScale - 1) * 100))
        
        // 计算偏移（让初始区域中心对齐视口中心）
        let imageCenter = CGPoint(x: imageSize.width / 2, y: imageSize.height / 2)
        let initCenter = CGPoint(
            x: initRect.midX,
            y: initRect.midY
        )
        
        transform.offset = CGSize(
            width: (imageCenter.x - initCenter.x) * transform.scale,
            height: (imageCenter.y - initCenter.y) * transform.scale
        )
        
        clampOffset()
    }
    
    /// 计算裁切框（给定比例）。
    private func computeCropFrame(for ratio: CropRatio) -> CGRect {
        let aspect: CGFloat
        if ratio.id == "orig", let image = sourceImage {
            aspect = image.size.width / image.size.height
        } else if let ar = ratio.aspectRatio {
            aspect = ar
        } else {
            aspect = cropFrame.width / cropFrame.height
        }
        
        return computeCropFrameForAspect(aspect, isFree: ratio.id == "free")
    }
    
    /// 计算裁切框（给定宽高比）。
    private func computeCropFrameForAspect(_ aspect: CGFloat, isFree: Bool) -> CGRect {
        let maxWidth = viewportSize.width * (isFree ? 0.86 : 1.0)
        let maxHeight = viewportSize.height * (isFree ? 0.86 : 1.0)
        
        var width = maxWidth
        var height = width / aspect
        
        if height > maxHeight {
            height = maxHeight
            width = height * aspect
        }
        
        let x = (viewportSize.width - width) / 2
        let y = (viewportSize.height - height) / 2
        
        return CGRect(x: x, y: y, width: width, height: height)
    }
    
    /// 计算最小缩放。
    private func computeMinScale() {
        guard let image = sourceImage else { return }
        
        let imageSize = CGSize(width: image.size.width, height: image.size.height)
        let box = rotatedBox(size: imageSize, rotation: transform.rotation)
        
        minScale = max(
            cropFrame.width / box.width,
            cropFrame.height / box.height
        )
    }
    
    /// 计算旋转后的包围盒。
    private func rotatedBox(size: CGSize, rotation: CGFloat) -> CGSize {
        let cos = abs(cos(rotation))
        let sin = abs(sin(rotation))
        
        return CGSize(
            width: size.width * cos + size.height * sin,
            height: size.width * sin + size.height * cos
        )
    }
    
    /// 钳制偏移（保证图片始终覆盖裁切框）。
    private func clampOffset() {
        guard let image = sourceImage else { return }
        
        let imageSize = CGSize(width: image.size.width, height: image.size.height)
        let box = rotatedBox(size: imageSize, rotation: transform.rotation)
        let scaledBox = CGSize(
            width: box.width * transform.scale,
            height: box.height * transform.scale
        )
        
        // 图片边界（在视口坐标系中）
        let left = viewportSize.width / 2 - scaledBox.width / 2 + transform.offset.width
        let top = viewportSize.height / 2 - scaledBox.height / 2 + transform.offset.height
        let right = left + scaledBox.width
        let bottom = top + scaledBox.height
        
        // 钳制（保证裁切框完全被图片覆盖）
        if left > cropFrame.minX {
            transform.offset.width -= left - cropFrame.minX
        }
        if top > cropFrame.minY {
            transform.offset.height -= top - cropFrame.minY
        }
        if right < cropFrame.maxX {
            transform.offset.width += cropFrame.maxX - right
        }
        if bottom < cropFrame.maxY {
            transform.offset.height += cropFrame.maxY - bottom
        }
    }
    
    /// 裁切区域（屏幕坐标 → 源图坐标）。
    private func cropRectInSourceCoordinates() -> CGRect {
        guard let image = sourceImage else { return .zero }
        
        let imageSize = CGSize(width: image.size.width, height: image.size.height)
        
        // 裁切框的四个角点
        let corners = [
            cropFrame.origin,
            CGPoint(x: cropFrame.maxX, y: cropFrame.minY),
            CGPoint(x: cropFrame.minX, y: cropFrame.maxY),
            CGPoint(x: cropFrame.maxX, y: cropFrame.maxY)
        ]
        
        // 转换到源图坐标
        var minX: CGFloat = .infinity
        var minY: CGFloat = .infinity
        var maxX: CGFloat = -.infinity
        var maxY: CGFloat = -.infinity
        
        for corner in corners {
            let point = viewportPointToImage(corner, imageSize: imageSize)
            minX = min(minX, point.x)
            minY = min(minY, point.y)
            maxX = max(maxX, point.x)
            maxY = max(maxY, point.y)
        }
        
        // 钳制到图片范围
        minX = max(0, min(imageSize.width - 1, minX))
        minY = max(0, min(imageSize.height - 1, minY))
        maxX = max(minX + 1, min(imageSize.width, maxX))
        maxY = max(minY + 1, min(imageSize.height, maxY))
        
        return CGRect(x: minX, y: minY, width: maxX - minX, height: maxY - minY)
    }
    
    /// 视口坐标点 → 源图坐标点。
    private func viewportPointToImage(_ point: CGPoint, imageSize: CGSize) -> CGPoint {
        // 相对视口中心
        var u = point.x - viewportSize.width / 2 - transform.offset.width
        var v = point.y - viewportSize.height / 2 - transform.offset.height
        
        // 反向旋转
        let cos = cos(transform.rotation)
        let sin = sin(transform.rotation)
        let u2 = u * cos + v * sin
        v = -u * sin + v * cos
        u = u2
        
        // 反向翻转
        if transform.isFlipped {
            u = -u
        }
        
        // 反向缩放，转换到源图坐标
        let px = u / transform.scale + imageSize.width / 2
        let py = v / transform.scale + imageSize.height / 2
        
        return CGPoint(x: px, y: py)
    }
    
    /// 检测是否点击把手。
    private func hitTestHandle(at location: CGPoint) -> ResizeHandle? {
        let threshold: CGFloat = 22
        
        let nearLeft = abs(location.x - cropFrame.minX) <= threshold
        let nearRight = abs(location.x - cropFrame.maxX) <= threshold
        let nearTop = abs(location.y - cropFrame.minY) <= threshold
        let nearBottom = abs(location.y - cropFrame.maxY) <= threshold
        
        if nearTop && nearLeft { return .topLeft }
        if nearTop && nearRight { return .topRight }
        if nearBottom && nearLeft { return .bottomLeft }
        if nearBottom && nearRight { return .bottomRight }
        
        return nil
    }
    
    /// 调整裁切框大小。
    private func resizeCropFrame(by delta: CGSize, handle: ResizeHandle) {
        var newFrame = cropFrame
        
        switch handle {
        case .topLeft:
            newFrame.origin.x += delta.width
            newFrame.origin.y += delta.height
            newFrame.size.width -= delta.width
            newFrame.size.height -= delta.height
        case .topRight:
            newFrame.origin.y += delta.height
            newFrame.size.width += delta.width
            newFrame.size.height -= delta.height
        case .bottomLeft:
            newFrame.origin.x += delta.width
            newFrame.size.width -= delta.width
            newFrame.size.height += delta.height
        case .bottomRight:
            newFrame.size.width += delta.width
            newFrame.size.height += delta.height
        }
        
        // 最小尺寸
        let minSide: CGFloat = 64
        if newFrame.width < minSide || newFrame.height < minSide {
            return
        }
        
        // 限制在视口内
        newFrame.origin.x = max(0, min(viewportSize.width - newFrame.width, newFrame.origin.x))
        newFrame.origin.y = max(0, min(viewportSize.height - newFrame.height, newFrame.origin.y))
        
        cropFrame = newFrame
        
        // 重新计算最小缩放
        computeMinScale()
        if transform.scale < minScale {
            zoomPercent = 0
        }
        
        clampOffset()
    }
    
    /// 制作快照。
    private func makeSnapshot() -> CropSnapshot {
        CropSnapshot(
            cropFrame: cropFrame,
            transform: transform,
            zoomPercent: zoomPercent
        )
    }
    
    /// 应用快照。
    private func applySnapshot(_ snapshot: CropSnapshot, animated: Bool) {
        if animated {
            withAnimation(.easeOut(duration: 0.32)) {
                cropFrame = snapshot.cropFrame
                transform = snapshot.transform
                zoomPercent = snapshot.zoomPercent
            }
        } else {
            cropFrame = snapshot.cropFrame
            transform = snapshot.transform
            zoomPercent = snapshot.zoomPercent
        }
    }
    
    /// 判断是否等于快照。
    private func isEqualToSnapshot(_ snapshot: CropSnapshot) -> Bool {
        func near(_ a: CGFloat, _ b: CGFloat, _ threshold: CGFloat = 1) -> Bool {
            abs(a - b) <= threshold
        }
        
        return near(cropFrame.origin.x, snapshot.cropFrame.origin.x)
            && near(cropFrame.origin.y, snapshot.cropFrame.origin.y)
            && near(cropFrame.width, snapshot.cropFrame.width)
            && near(cropFrame.height, snapshot.cropFrame.height)
            && near(transform.offset.width, snapshot.transform.offset.width)
            && near(transform.offset.height, snapshot.transform.offset.height)
            && near(transform.scale, snapshot.transform.scale, 0.001)
            && near(transform.rotation, snapshot.transform.rotation, 0.0001)
            && transform.isFlipped == snapshot.transform.isFlipped
    }
}

// MARK: - 辅助类型

/// 拖动模式。
enum DragMode {
    case pan
    case resize
}

/// 调整把手位置。
enum ResizeHandle {
    case topLeft
    case topRight
    case bottomLeft
    case bottomRight
}

/// 视图快照（用于判断是否修改）。
private struct CropSnapshot {
    let cropFrame: CGRect
    let transform: CropTransform
    let zoomPercent: CGFloat
}
