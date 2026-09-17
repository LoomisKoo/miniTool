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
    var selectedRatio: CropRatio = .original
    
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
                return
            }
            guard !suppressZoomSideEffect else { return }
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

    /// 打开裁切页时的图（重置用）。
    private var sessionOriginal: UIImage?

    /// 打开时选中的比例（重置用）。
    private var initRatio: CropRatio = .presets[0]

    /// 是否做过旋转 / 翻转烘焙（相对 sessionOriginal）。
    private var hasOrientedEdit = false

    /// 水平翻转动画系数：`1` → `-1` 插值，结束后烘焙并归 `1`。
    var flipScaleX: CGFloat = 1

    /// 待提交的烘焙任务。
    @ObservationIgnored private var pendingBakeTask: Task<Void, Never>?

    /// 写 zoomPercent 时跳过 didSet 里改 scale（旋转后对齐账面用）。
    private var suppressZoomSideEffect = false

    // MARK: - 初始化
    
    init() {}
    
    // MARK: - 公开方法
    
    /// 打开裁切页面。
    func open(sourceImage: UIImage, existingCrop: CropRect?, viewportSize: CGSize) {
        pendingBakeTask?.cancel()
        pendingBakeTask = nil

        self.sessionOriginal = sourceImage
        self.sourceImage = sourceImage
        self.viewportSize = viewportSize
        self.hasOrientedEdit = false
        self.flipScaleX = 1
        
        let imageSize = CGSize(width: sourceImage.size.width, height: sourceImage.size.height)
        
        // 初始区域
        if let crop = existingCrop {
            initRect = crop.toCGRect(in: imageSize)
        } else {
            initRect = CGRect(origin: .zero, size: imageSize)
        }
        
        // 无裁切 / 全图 → 原始；否则匹配预设，对不上落自由
        if existingCrop == nil || existingCrop?.isFull == true {
            selectedRatio = .original
        } else {
            let ratio = initRect.width / max(initRect.height, 0.0001)
            selectedRatio = matchRatio(ratio: ratio)
        }
        initRatio = selectedRatio
        
        // 重置变换
        transform.reset()
        zoomPercent = 0
        
        // 计算初始视图（整图 / 初始区域铺满裁切框 → 框与可见图同尺寸）
        computeInitialView()
        
        // 保存快照
        initSnapshot = makeSnapshot()
    }

    /// 画布尺寸变化（导航栏布局稳定后很常见）：框保持比例并重新居中，图重新夹紧进框。
    func updateViewport(_ size: CGSize) {
        guard size.width > 1, size.height > 1 else { return }
        let old = viewportSize
        if old.width > 1, old.height > 1,
           abs(old.width - size.width) < 0.5, abs(old.height - size.height) < 0.5 {
            return
        }

        let aspect = cropFrame.width > 1
            ? cropFrame.width / max(cropFrame.height, 0.0001)
            : (sourceImage.map { $0.size.width / max($0.size.height, 0.0001) } ?? 1)

        viewportSize = size

        let frame: CGRect
        if selectedRatio.id == "orig", let image = sourceImage {
            // 原始比例始终铺满当前画布，避免导航栏/布局变化后留下旧边距。
            let imageAspect = image.size.width / max(image.size.height, 0.0001)
            frame = computeCropFrameForAspect(imageAspect, isFree: false)
        } else if old.width > 1, old.height > 1, cropFrame.width > 1 {
            let relW = cropFrame.width / old.width
            let relH = cropFrame.height / old.height
            var w = min(size.width, size.width * relW)
            var h = min(size.height, size.height * relH)
            if w / max(h, 0.0001) > aspect {
                w = h * aspect
            } else {
                h = w / aspect
            }
            w = min(w, size.width)
            h = min(h, size.height)
            frame = CGRect(
                x: (size.width - w) / 2,
                y: (size.height - h) / 2,
                width: w,
                height: h
            )
        } else {
            frame = computeCropFrameForAspect(aspect, isFree: selectedRatio.id == "free")
        }

        cropFrame = frame
        ensureImageCoversCropFrame()
    }
    
    /// 重置：还原原图，裁切框与图片显示尺寸一致（整图刚好铺满框）。
    func reset() {
        pendingBakeTask?.cancel()
        pendingBakeTask = nil
        guard let original = sessionOriginal ?? sourceImage else { return }

        let imageSize = CGSize(width: original.size.width, height: original.size.height)
        guard imageSize.width > 0, imageSize.height > 0, viewportSize.width > 1, viewportSize.height > 1 else { return }

        // 框比例 = 原图比例，zoom=0 → 显示尺寸与裁切框一致。
        let aspect = imageSize.width / imageSize.height
        let fitRatio = CropRatio.original
        let frame = computeCropFrameForAspect(aspect, isFree: false)
        let cover = max(frame.width / imageSize.width, frame.height / imageSize.height)
        var fitted = CropTransform()
        fitted.scale = cover
        fitted.offset = .zero
        fitted.rotation = 0
        fitted.isFlipped = false

        var t = Transaction()
        t.disablesAnimations = true
        withTransaction(t) {
            sourceImage = original
            hasOrientedEdit = false
            flipScaleX = 1
            selectedRatio = fitRatio
            initRect = CGRect(origin: .zero, size: imageSize)
            initRatio = fitRatio
        }

        withAnimation(.easeOut(duration: 0.32)) {
            cropFrame = frame
            minScale = cover
            suppressZoomSideEffect = true
            zoomPercent = 0
            suppressZoomSideEffect = false
            transform = fitted
        }
    }
    
    /// 应用裁切。返回 nil 表示未做修改（或无法渲染）。
    ///
    /// 与 H5 `applyCrop` 一致：旋转 / 镜像会真正落到输出像素上，
    /// 覆盖全图且未旋转 / 未镜像时直接回填原图，避免重采样。
    func applyCrop() -> CropOutput? {
        settleOrientationNow()

        guard let image = sourceImage, let cgImage = image.cgImage else { return nil }

        // 判断是否修改过
        if let snapshot = initSnapshot, isEqualToSnapshot(snapshot), !hasOrientedEdit {
            return nil // 未修改
        }

        let imageSize = CGSize(width: cgImage.width, height: cgImage.height)
        let cropRectInSource = cropRectInSourceCoordinates()
        let normalized = CropRect.from(cropRectInSource, in: imageSize)

        if normalized.isFull, !hasOrientedEdit {
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
                // 朝向已烘焙进像素；导出时只保留临时旋转。
                cg.rotate(by: transform.rotation)
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
    
    /// 切换比例。选「原始」等同重置：整图 + 原图比例。
    func selectRatio(_ ratio: CropRatio, animated: Bool = true) {
        settleOrientationNow()
        if ratio.id == "orig" {
            reset()
            return
        }
        guard ratio.id != selectedRatio.id else { return }
        selectedRatio = ratio
        
        let targetFrame = computeCropFrame(for: ratio)
        
        if animated {
            withAnimation(.easeOut(duration: 0.26)) {
                cropFrame = targetFrame
                ensureImageCoversCropFrame()
            }
        } else {
            cropFrame = targetFrame
            ensureImageCoversCropFrame()
        }
    }
    
    /// 旋转 90°：以当前预览为基准顺时针转，动画结束后烘焙进图片。
    func rotate() {
        settleOrientationNow()
        withAnimation(.easeOut(duration: 0.28)) {
            transform.rotation += .pi / 2
            ensureImageCoversCropFrame()
        }
        scheduleBake(afterMs: 280) { [weak self] in
            guard let self else { return }
            self.commitBake(rotation: self.transform.rotation, flip: false)
        }
    }
    
    /// 翻转：左右镜向，用 `flipScaleX` 1→-1 插值（过零时侧立），结束后烘焙进像素。
    func flip() {
        settleOrientationNow()
        withAnimation(.easeInOut(duration: 0.32)) {
            flipScaleX = -1
        }
        scheduleBake(afterMs: 320) { [weak self] in
            self?.finishFlipAnimation()
        }
    }

    private func finishFlipAnimation() {
        let shouldFlip = flipScaleX < 0
        commitBake(rotation: 0, flip: shouldFlip)
        var t = Transaction()
        t.disablesAnimations = true
        withTransaction(t) {
            flipScaleX = 1
            ensureImageCoversCropFrame()
        }
    }

    /// 更新 zoomPercent 账面；`scale` 永远 ≥ minScale，避免框内黑边。
    private func syncZoomPercent(preservingScale kept: CGFloat) {
        let safeMin = max(minScale, 0.0001)
        let scale = max(kept, safeMin)
        suppressZoomSideEffect = true
        zoomPercent = max(0, min(500, (scale / safeMin - 1) * 100))
        suppressZoomSideEffect = false
        transform.scale = scale
    }

    /// 任意操作后调用：图必须盖住裁切框（scale ≥ minScale + 位移夹紧）。
    private func ensureImageCoversCropFrame() {
        shrinkCropFrameToFitImageIfNeeded()
        computeMinScale()
        syncZoomPercent(preservingScale: transform.scale)
        clampOffset()
    }

    /// 自由裁切：框不得超过当前图的显示范围；固定比例则靠放大图片盖住框。
    private func shrinkCropFrameToFitImageIfNeeded() {
        guard selectedRatio.id == "free", let image = sourceImage else { return }

        let imageSize = CGSize(width: image.size.width, height: image.size.height)
        let box = rotatedBox(size: imageSize, rotation: transform.rotation)
        let scale = max(transform.scale, 0.0001)
        let scaled = CGSize(width: box.width * scale, height: box.height * scale)
        let imageRect = CGRect(
            x: viewportSize.width / 2 + transform.offset.width - scaled.width / 2,
            y: viewportSize.height / 2 + transform.offset.height - scaled.height / 2,
            width: scaled.width,
            height: scaled.height
        )
        let limit = imageRect.intersection(CGRect(origin: .zero, size: viewportSize))
        let minSide: CGFloat = 64
        guard limit.width >= minSide, limit.height >= minSide else { return }

        let aspect = cropFrame.width / max(cropFrame.height, 0.0001)
        var w = min(cropFrame.width, limit.width)
        var h = min(cropFrame.height, limit.height)
        if w / max(h, 0.0001) > aspect {
            w = h * aspect
        } else {
            h = w / aspect
        }
        w = min(max(minSide, w), limit.width)
        h = min(max(minSide, h), limit.height)
        // 再锁比例，避免 minSide 把比例撑破后仍溢出。
        if w / max(h, 0.0001) > aspect {
            w = min(h * aspect, limit.width)
        } else {
            h = min(w / aspect, limit.height)
        }

        var x = cropFrame.midX - w / 2
        var y = cropFrame.midY - h / 2
        x = min(max(limit.minX, x), limit.maxX - w)
        y = min(max(limit.minY, y), limit.maxY - h)
        cropFrame = CGRect(x: x, y: y, width: w, height: h)
    }

    private func scheduleBake(afterMs: UInt64, _ body: @escaping () -> Void) {
        pendingBakeTask?.cancel()
        pendingBakeTask = Task { @MainActor in
            try? await Task.sleep(nanoseconds: afterMs * 1_000_000)
            guard !Task.isCancelled else { return }
            body()
            pendingBakeTask = nil
        }
    }

    /// 若动画中途又点了别的操作，先把当前朝向落地。
    private func settleOrientationNow() {
        pendingBakeTask?.cancel()
        pendingBakeTask = nil

        if abs(flipScaleX - 1) > 0.001 {
            // 过零点才算翻过去；未过则取消翻转动画。
            let shouldFlip = flipScaleX < 0
            var t = Transaction()
            t.disablesAnimations = true
            withTransaction(t) { flipScaleX = 1 }
            if shouldFlip {
                commitBake(rotation: transform.rotation, flip: true)
                return
            }
            // fall through：可能还有未烘焙的旋转
        }

        let rot = transform.rotation
        guard abs(rot) > 0.0001 else {
            transform.rotation = 0
            transform.isFlipped = false
            return
        }
        commitBake(rotation: rot, flip: false)
    }

    /// 把旋转 / 翻转烘焙进 `sourceImage`，变换归零，下次操作总基于最新预览。
    private func commitBake(rotation: CGFloat, flip: Bool) {
        guard let image = sourceImage?.cgImage else { return }
        let twoPi = CGFloat.pi * 2
        var rot = rotation.truncatingRemainder(dividingBy: twoPi)
        if rot < 0 { rot += twoPi }
        let hasRot = rot > 0.0001 && abs(rot - twoPi) > 0.0001
        guard hasRot || flip else {
            var t = Transaction()
            t.disablesAnimations = true
            withTransaction(t) {
                transform.rotation = 0
                transform.isFlipped = false
            }
            return
        }

        guard let baked = renderOrientedFull(image: image, rotation: rot, flip: flip) else { return }
        let keptScale = transform.scale
        let keptOffset = transform.offset

        var t = Transaction()
        t.disablesAnimations = true
        withTransaction(t) {
            sourceImage = UIImage(cgImage: baked)
            transform.rotation = 0
            transform.isFlipped = false
            transform.scale = keptScale
            transform.offset = keptOffset
            ensureImageCoversCropFrame()
            hasOrientedEdit = true
        }
    }

    /// 整图按旋转 / 翻转重采样（输出立着的像素）。
    private func renderOrientedFull(image: CGImage, rotation: CGFloat, flip: Bool) -> CGImage? {
        let nw = CGFloat(image.width)
        let nh = CGFloat(image.height)
        guard nw > 0, nh > 0 else { return nil }

        let box = rotatedBox(size: CGSize(width: nw, height: nh), rotation: rotation)
        let outW = max(1, box.width.rounded())
        let outH = max(1, box.height.rounded())

        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        format.opaque = false

        let rendered = UIGraphicsImageRenderer(size: CGSize(width: outW, height: outH), format: format)
            .image { context in
                let cg = context.cgContext
                cg.translateBy(x: outW / 2, y: outH / 2)
                if flip {
                    cg.scaleBy(x: -1, y: 1)
                }
                cg.rotate(by: rotation)
                UIImage(cgImage: image).draw(in: CGRect(x: -nw / 2, y: -nh / 2, width: nw, height: nh))
            }
        return rendered.cgImage
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
    
    /// 匹配比例预设；对不上就落到「自由」。
    private func matchRatio(ratio: CGFloat) -> CropRatio {
        if let image = sourceImage {
            let orig = image.size.width / max(image.size.height, 0.0001)
            if abs(orig - ratio) / max(ratio, 0.0001) < 0.004 {
                return .original
            }
        }
        for preset in CropRatio.presets {
            guard preset.id != "free", preset.id != "orig", let ar = preset.aspectRatio else { continue }
            if abs(ar - ratio) / max(ratio, 0.0001) < 0.004 {
                return preset
            }
        }
        return .free
    }
    
    /// 计算初始视图。
    private func computeInitialView() {
        let target = makeInitialViewTarget()
        cropFrame = target.cropFrame
        computeMinScale()
        suppressZoomSideEffect = true
        zoomPercent = target.zoomPercent
        suppressZoomSideEffect = false
        transform = target.transform
        clampOffset()
    }

    /// 打开 / 重置时的目标视图：初始区域铺满裁切框。
    /// 全图时框比例 = 图比例且 zoom=0 → 裁切框与图片显示大小一致。
    private func makeInitialViewTarget() -> (cropFrame: CGRect, transform: CropTransform, zoomPercent: CGFloat) {
        guard let image = sourceImage else {
            return (.zero, CropTransform(), 0)
        }

        let imageSize = CGSize(width: image.size.width, height: image.size.height)
        let initAspect = initRect.width / max(initRect.height, 0.0001)

        let frame: CGRect
        if selectedRatio.id == "free" {
            frame = computeCropFrameForAspect(initAspect, isFree: true)
        } else if selectedRatio.id == "orig" {
            let imageAspect = imageSize.width / max(imageSize.height, 0.0001)
            frame = computeCropFrameForAspect(imageAspect, isFree: false)
        } else {
            frame = computeCropFrame(for: selectedRatio)
        }

        let boxW = imageSize.width
        let boxH = imageSize.height
        let cover = max(frame.width / max(boxW, 0.0001), frame.height / max(boxH, 0.0001))
        let scaleToFit = max(
            frame.width / max(initRect.width, 0.0001),
            frame.height / max(initRect.height, 0.0001),
            cover
        )
        let zoom = min(500, max(0, (scaleToFit / cover - 1) * 100))
        let scale = cover * (1 + zoom / 100)

        let imageCenter = CGPoint(x: imageSize.width / 2, y: imageSize.height / 2)
        let initCenter = CGPoint(x: initRect.midX, y: initRect.midY)
        var t = CropTransform()
        t.scale = scale
        t.offset = CGSize(
            width: (imageCenter.x - initCenter.x) * scale,
            height: (imageCenter.y - initCenter.y) * scale
        )
        t.rotation = 0
        t.isFlipped = false

        return (frame, t, zoom)
    }
    
    /// 计算裁切框（给定比例）。
    private func computeCropFrame(for ratio: CropRatio) -> CGRect {
        let aspect: CGFloat
        if ratio.id == "orig", let image = sourceImage {
            aspect = image.size.width / max(image.size.height, 0.0001)
        } else if let ar = ratio.aspectRatio {
            aspect = ar
        } else if cropFrame.width > 1 {
            aspect = cropFrame.width / max(cropFrame.height, 0.0001)
        } else if let image = sourceImage {
            aspect = image.size.width / max(image.size.height, 0.0001)
        } else {
            aspect = 1
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
        guard box.width > 0, box.height > 0 else { return }
        
        minScale = max(
            cropFrame.width / box.width,
            cropFrame.height / box.height
        )
    }

    /// 框 / 旋转变化后重算，保证无黑边。
    private func recomputeScaleKeepingZoom() {
        ensureImageCoversCropFrame()
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
    
    /// 钳制偏移（保证图片始终覆盖裁切框）。调用前应已保证 scale ≥ minScale。
    private func clampOffset() {
        guard let image = sourceImage else { return }
        
        let imageSize = CGSize(width: image.size.width, height: image.size.height)
        let box = rotatedBox(size: imageSize, rotation: transform.rotation)
        let scaledBox = CGSize(
            width: box.width * transform.scale,
            height: box.height * transform.scale
        )
        
        // 极端情况下仍略小于框：先贴到盖住所需的最小缩放，再夹位移。
        if scaledBox.width + 0.5 < cropFrame.width || scaledBox.height + 0.5 < cropFrame.height {
            computeMinScale()
            if transform.scale < minScale {
                transform.scale = minScale
            }
        }

        let covered = CGSize(
            width: box.width * transform.scale,
            height: box.height * transform.scale
        )
        let left = viewportSize.width / 2 - covered.width / 2 + transform.offset.width
        let top = viewportSize.height / 2 - covered.height / 2 + transform.offset.height
        let right = left + covered.width
        let bottom = top + covered.height

        if left > cropFrame.minX {
            transform.offset.width -= left - cropFrame.minX
        }
        if right < cropFrame.maxX {
            transform.offset.width += cropFrame.maxX - right
        }
        if top > cropFrame.minY {
            transform.offset.height -= top - cropFrame.minY
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
        var u = point.x - viewportSize.width / 2 - transform.offset.width
        var v = point.y - viewportSize.height / 2 - transform.offset.height
        
        // 正向是 T · R（翻转已烘焙），逆变换只撤旋转。
        let cos = cos(transform.rotation)
        let sin = sin(transform.rotation)
        let u2 = u * cos + v * sin
        v = -u * sin + v * cos
        u = u2
        
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
    
    /// 调整裁切框大小（自由比例）。图片缩放不动，框限制在当前图显示范围内。
    private func resizeCropFrame(by delta: CGSize, handle: ResizeHandle) {
        guard let image = sourceImage else { return }

        let minSide: CGFloat = 64
        let imageSize = CGSize(width: image.size.width, height: image.size.height)
        let box = rotatedBox(size: imageSize, rotation: transform.rotation)
        let scaled = CGSize(width: box.width * transform.scale, height: box.height * transform.scale)
        let imageRect = CGRect(
            x: viewportSize.width / 2 + transform.offset.width - scaled.width / 2,
            y: viewportSize.height / 2 + transform.offset.height - scaled.height / 2,
            width: scaled.width,
            height: scaled.height
        )
        let limit = imageRect.intersection(CGRect(origin: .zero, size: viewportSize))
        guard limit.width >= minSide, limit.height >= minSide else { return }

        // 固定对角，只动被拖的角。
        var minX = cropFrame.minX
        var minY = cropFrame.minY
        var maxX = cropFrame.maxX
        var maxY = cropFrame.maxY

        switch handle {
        case .topLeft:
            minX = min(maxX - minSide, max(limit.minX, minX + delta.width))
            minY = min(maxY - minSide, max(limit.minY, minY + delta.height))
        case .topRight:
            maxX = max(minX + minSide, min(limit.maxX, maxX + delta.width))
            minY = min(maxY - minSide, max(limit.minY, minY + delta.height))
        case .bottomLeft:
            minX = min(maxX - minSide, max(limit.minX, minX + delta.width))
            maxY = max(minY + minSide, min(limit.maxY, maxY + delta.height))
        case .bottomRight:
            maxX = max(minX + minSide, min(limit.maxX, maxX + delta.width))
            maxY = max(minY + minSide, min(limit.maxY, maxY + delta.height))
        }

        cropFrame = CGRect(x: minX, y: minY, width: maxX - minX, height: maxY - minY)
        ensureImageCoversCropFrame()
    }
    
    /// 制作快照。
    private func makeSnapshot() -> CropSnapshot {
        CropSnapshot(
            cropFrame: cropFrame,
            transform: transform,
            zoomPercent: zoomPercent
        )
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
