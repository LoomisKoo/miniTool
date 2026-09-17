import Foundation
import SwiftUI

/// 裁切页面。
struct BeadCropView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var model = BeadCropModel()
    /// 打开时只按真实画布尺寸初始化一次。
    @State private var didOpen = false
    /// 捏合起点缩放。
    @State private var pinchStartScale: CGFloat = 0

    let sourceImage: UIImage
    let existingCrop: CropRect?
    let onApply: (CropOutput?) -> Void

    var body: some View {
        VStack(spacing: 0) {
            cropCanvas
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .padding(.horizontal, 12)
                .padding(.top, 8)
            controlPanel
                .padding(.bottom, BeadSpace.md)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background {
            BeadTheme.parchmentGradient.ignoresSafeArea()
        }
        .navigationTitle("裁切图片".loc)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("应用".loc) {
                    let result = model.applyCrop()
                    onApply(result)
                    dismiss()
                }
                .fontWeight(.semibold)
            }
        }
        .modifier(BeadCropNavChrome())
    }

    private var cropCanvas: some View {
        GeometryReader { geometry in
            ZStack {
                BeadTheme.cropSurface
                    .clipShape(RoundedRectangle(cornerRadius: BeadRadius.lg, style: .continuous))

                CropCanvasView(
                    cropFrame: model.cropFrame,
                    scale: model.transform.scale,
                    offset: model.transform.offset,
                    rotation: model.transform.rotation,
                    flipScaleX: model.flipScaleX,
                    image: model.sourceImage,
                    showsHandles: model.selectedRatio.id == "free"
                )
                .frame(width: geometry.size.width, height: geometry.size.height)
                .clipShape(RoundedRectangle(cornerRadius: BeadRadius.lg, style: .continuous))
                .gesture(
                    DragGesture(minimumDistance: 0)
                        .onChanged { value in
                            if !model.isDragging {
                                model.startDrag(at: value.location)
                            }
                            model.updateDrag(to: value.location)
                        }
                        .onEnded { _ in
                            model.endDrag()
                        }
                )
                .simultaneousGesture(
                    MagnificationGesture()
                        .onChanged { value in
                            if pinchStartScale <= 0 {
                                pinchStartScale = model.transform.scale
                            }
                            model.setPinchScale(pinchStartScale * value)
                        }
                        .onEnded { _ in
                            pinchStartScale = 0
                        }
                )
            }
            .beadCardShadow()
            .onAppear { openIfNeeded(geometry.size) }
            .onChange(of: geometry.size) { _, size in openIfNeeded(size) }
        }
    }

    /// 等画布有真实尺寸再初始化；尺寸变化时同步视口，避免图与框错位。
    private func openIfNeeded(_ size: CGSize) {
        guard size.width > 1, size.height > 1 else { return }
        if !didOpen {
            didOpen = true
            model.open(
                sourceImage: sourceImage,
                existingCrop: existingCrop,
                viewportSize: size
            )
        } else {
            model.updateViewport(size)
        }
    }

    private var controlPanel: some View {
        VStack(spacing: BeadSpace.sm) {
            ratioChips

            HStack(spacing: BeadSpace.sm) {
                Text("缩放".loc)
                    .font(.system(size: 12))
                    .foregroundStyle(BeadTheme.inkMuted80)
                    .lineLimit(1)
                    .fixedSize(horizontal: true, vertical: false)

                Slider(value: $model.zoomPercent, in: 0...500)
                    .tint(BeadTheme.primary)

                HStack(spacing: BeadSpace.xs) {
                    cropToolButton(systemName: "rotate.right") {
                        model.rotate()
                    }
                    cropToolButton(systemName: "arrow.left.and.right") {
                        model.flip()
                    }
                }
            }
            .padding(.horizontal, 14)
        }
        .padding(.vertical, 10)
        .background(
            BeadTheme.canvas,
            in: RoundedRectangle(cornerRadius: BeadRadius.lg, style: .continuous)
        )
        .beadCardShadow()
        .padding(.horizontal, 12)
        .padding(.top, 10)
    }

    private var ratioChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: BeadSpace.xs) {
                Text("比例".loc)
                    .font(.system(size: 12))
                    .foregroundStyle(BeadTheme.inkMuted80)
                    .lineLimit(1)
                    .fixedSize(horizontal: true, vertical: false)

                ForEach(CropRatio.presets) { ratio in
                    BeadChip(
                        title: ratio.label,
                        selected: model.selectedRatio.id == ratio.id,
                        prominentWhenSelected: false,
                        hugContent: true
                    ) {
                        model.selectRatio(ratio)
                    }
                }
            }
            .padding(.horizontal, 14)
        }
    }

    private func cropToolButton(systemName: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(BeadTheme.inkMuted80)
                .frame(width: 28, height: 28)
                .background(
                    BeadTheme.pearl,
                    in: RoundedRectangle(cornerRadius: BeadRadius.sm, style: .continuous)
                )
                .overlay {
                    RoundedRectangle(cornerRadius: BeadRadius.sm, style: .continuous)
                        .strokeBorder(BeadTheme.hairline, lineWidth: 1)
                }
        }
        .buttonStyle(.automatic)
    }
}

/// 裁切页顶栏：与色号页同一套系统导航栏材质。
private struct BeadCropNavChrome: ViewModifier {
    @ViewBuilder
    func body(content: Content) -> some View {
        if #available(iOS 26.0, *) {
            content
                .toolbarBackground(.automatic, for: .navigationBar)
        } else {
            content
                .toolbarBackground(.visible, for: .navigationBar)
                .toolbarBackground(.bar, for: .navigationBar)
        }
    }
}

// MARK: - 裁切画布

/// 裁切画布。
///
/// 插值裁切框 + 缩放 + 位移 + 旋转 + 水平翻转系数。跟手时无 animation transaction，仍即时更新。
private struct CropCanvasView: View, Animatable {
    var cropFrame: CGRect
    var scale: CGFloat
    var offset: CGSize
    var rotation: CGFloat
    var flipScaleX: CGFloat
    let image: UIImage?
    let showsHandles: Bool

    var animatableData: CropAnimatableData {
        get {
            CropAnimatableData(
                x: cropFrame.minX,
                y: cropFrame.minY,
                width: cropFrame.width,
                height: cropFrame.height,
                imageScale: scale,
                offsetX: offset.width,
                offsetY: offset.height,
                rotation: rotation,
                flipScaleX: flipScaleX
            )
        }
        set {
            cropFrame = CGRect(
                x: newValue.x,
                y: newValue.y,
                width: newValue.width,
                height: newValue.height
            )
            scale = newValue.imageScale
            offset = CGSize(width: newValue.offsetX, height: newValue.offsetY)
            rotation = newValue.rotation
            flipScaleX = newValue.flipScaleX
        }
    }

    var body: some View {
        Canvas { context, size in
            let bg = BeadTheme.cropSurface
            context.fill(
                Path(CGRect(origin: .zero, size: size)),
                with: .color(bg)
            )

            if let image = image {
                drawImage(context: context, image: image, size: size)
            }

            // 框外：同色底 + 淡化图片（对齐 H5，不用整层黑罩）
            var outside = Path(CGRect(origin: .zero, size: size))
            outside.addRect(cropFrame)
            context.fill(outside, with: .color(bg), style: FillStyle(eoFill: true))
            context.drawLayer { layerContext in
                var clip = Path(CGRect(origin: .zero, size: size))
                clip.addRect(cropFrame)
                layerContext.clip(to: clip, style: FillStyle(eoFill: true))
                layerContext.opacity = 0.38
                if let image = image {
                    drawImage(context: layerContext, image: image, size: size)
                }
            }

            context.drawLayer { layerContext in
                layerContext.clip(to: Path(cropFrame))
                if let image = image {
                    drawImage(context: layerContext, image: image, size: size)
                }
            }

            var cropPath = Path()
            cropPath.addRect(cropFrame)
            context.stroke(
                cropPath,
                with: .color(.white.opacity(0.95)),
                lineWidth: 2
            )

            drawGridLines(context: context)

            if showsHandles {
                drawHandles(context: context)
            }
        }
    }

    private func drawImage(context: GraphicsContext, image: UIImage, size: CGSize) {
        guard image.cgImage != nil else { return }

        let imageSize = CGSize(width: image.size.width, height: image.size.height)
        let displaySize = CGSize(
            width: imageSize.width * scale,
            height: imageSize.height * scale
        )

        var imageContext = context
        imageContext.translateBy(
            x: size.width / 2 + offset.width,
            y: size.height / 2 + offset.height
        )
        imageContext.rotate(by: Angle(radians: rotation))
        // 水平翻转动画：1 → -1 过零时短暂侧立。
        imageContext.scaleBy(x: flipScaleX, y: 1)

        let rect = CGRect(
            x: -displaySize.width / 2,
            y: -displaySize.height / 2,
            width: displaySize.width,
            height: displaySize.height
        )
        imageContext.draw(Image(uiImage: image), in: rect)
    }

    private func drawGridLines(context: GraphicsContext) {
        var path = Path()

        let w1 = cropFrame.minX + cropFrame.width / 3
        let w2 = cropFrame.minX + cropFrame.width * 2 / 3
        path.move(to: CGPoint(x: w1, y: cropFrame.minY))
        path.addLine(to: CGPoint(x: w1, y: cropFrame.maxY))
        path.move(to: CGPoint(x: w2, y: cropFrame.minY))
        path.addLine(to: CGPoint(x: w2, y: cropFrame.maxY))

        let h1 = cropFrame.minY + cropFrame.height / 3
        let h2 = cropFrame.minY + cropFrame.height * 2 / 3
        path.move(to: CGPoint(x: cropFrame.minX, y: h1))
        path.addLine(to: CGPoint(x: cropFrame.maxX, y: h1))
        path.move(to: CGPoint(x: cropFrame.minX, y: h2))
        path.addLine(to: CGPoint(x: cropFrame.maxX, y: h2))

        context.stroke(
            path,
            with: .color(.white.opacity(0.4)),
            lineWidth: 1
        )
    }

    private func drawHandles(context: GraphicsContext) {
        let handleSize: CGFloat = 14
        let corners = [
            CGPoint(x: cropFrame.minX, y: cropFrame.minY),
            CGPoint(x: cropFrame.maxX, y: cropFrame.minY),
            CGPoint(x: cropFrame.minX, y: cropFrame.maxY),
            CGPoint(x: cropFrame.maxX, y: cropFrame.maxY),
        ]

        for corner in corners {
            var path = Path()
            path.addEllipse(in: CGRect(
                x: corner.x - handleSize / 2,
                y: corner.y - handleSize / 2,
                width: handleSize,
                height: handleSize
            ))

            context.fill(path, with: .color(.white))
            context.stroke(path, with: .color(BeadTheme.accent), lineWidth: 2)
        }
    }
}

/// 插值：裁切框 + 缩放 + 位移 + 旋转 + 水平翻转。
private struct CropAnimatableData: VectorArithmetic {
    var x: CGFloat = 0
    var y: CGFloat = 0
    var width: CGFloat = 0
    var height: CGFloat = 0
    var imageScale: CGFloat = 0
    var offsetX: CGFloat = 0
    var offsetY: CGFloat = 0
    var rotation: CGFloat = 0
    var flipScaleX: CGFloat = 0

    static var zero: CropAnimatableData { CropAnimatableData() }

    static func + (lhs: Self, rhs: Self) -> Self {
        Self(
            x: lhs.x + rhs.x,
            y: lhs.y + rhs.y,
            width: lhs.width + rhs.width,
            height: lhs.height + rhs.height,
            imageScale: lhs.imageScale + rhs.imageScale,
            offsetX: lhs.offsetX + rhs.offsetX,
            offsetY: lhs.offsetY + rhs.offsetY,
            rotation: lhs.rotation + rhs.rotation,
            flipScaleX: lhs.flipScaleX + rhs.flipScaleX
        )
    }

    static func - (lhs: Self, rhs: Self) -> Self {
        Self(
            x: lhs.x - rhs.x,
            y: lhs.y - rhs.y,
            width: lhs.width - rhs.width,
            height: lhs.height - rhs.height,
            imageScale: lhs.imageScale - rhs.imageScale,
            offsetX: lhs.offsetX - rhs.offsetX,
            offsetY: lhs.offsetY - rhs.offsetY,
            rotation: lhs.rotation - rhs.rotation,
            flipScaleX: lhs.flipScaleX - rhs.flipScaleX
        )
    }

    static func += (lhs: inout Self, rhs: Self) {
        lhs = lhs + rhs
    }

    static func -= (lhs: inout Self, rhs: Self) {
        lhs = lhs - rhs
    }

    mutating func scale(by rhs: Double) {
        let k = CGFloat(rhs)
        x *= k
        y *= k
        width *= k
        height *= k
        imageScale *= k
        offsetX *= k
        offsetY *= k
        rotation *= k
        flipScaleX *= k
    }

    var magnitudeSquared: Double {
        Double(
            x * x + y * y + width * width + height * height
                + imageScale * imageScale + offsetX * offsetX + offsetY * offsetY
                + rotation * rotation + flipScaleX * flipScaleX
        )
    }
}
