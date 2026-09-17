import SwiftUI

/// 预览画布：图片 + 压暗遮罩 + 裁切框 + 宫格线。视觉对齐 H5 `drawCrop`。
struct CropCanvasView: View {
    let model: CropEditorModel

    @State private var dragStart: CGPoint?
    @State private var zoomStart: CGFloat?

    /// 遮罩层要画的全部内容。
    ///
    /// 单独取快照而不是让 `Canvas` 闭包直接读模型：`@Observable` 的依赖是在 body 求值时登记的，
    /// 闭包在渲染阶段才执行，直接读属性可能收不到刷新。
    private struct OverlaySnapshot {
        let cropRect: CGRect
        let shape: CropShape
        let circleRadius: CGFloat
        let cornerRadius: CGFloat
        let grid: CropGrid
        let lineColor: Color
        let showHandles: Bool

        /// 裁切框轮廓（圆形按内接圆）。
        var framePath: Path {
            switch shape {
            case .circle:
                Path(
                    ellipseIn: CGRect(
                        x: cropRect.midX - circleRadius,
                        y: cropRect.midY - circleRadius,
                        width: circleRadius * 2,
                        height: circleRadius * 2
                    )
                )
            case .round:
                Path(roundedRect: cropRect, cornerRadius: cornerRadius)
            case .rect:
                Path(cropRect)
            }
        }
    }

    var body: some View {
        GeometryReader { geo in
            ZStack {
                QingyingTheme.viewport

                if let uiImage = model.displayImage {
                    imageLayer(uiImage)
                }

                overlayCanvas(snapshot)
            }
            .frame(width: geo.size.width, height: geo.size.height)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .contentShape(Rectangle())
            .gesture(drag)
            .simultaneousGesture(magnify)
            .onTapGesture(count: 2) {
                model.resetCamera()
            }
            .onAppear { model.updateViewport(geo.size) }
            .onChange(of: geo.size) { _, newValue in model.updateViewport(newValue) }
        }
    }

    private var snapshot: OverlaySnapshot {
        let g = model.geometry
        return OverlaySnapshot(
            cropRect: g.cropRect,
            shape: model.shape,
            circleRadius: g.circleRadius,
            cornerRadius: g.cornerRadius(percent: model.radiusPercent),
            grid: model.grid,
            lineColor: model.lineColor.color,
            showHandles: model.ratio.aspect == nil
        )
    }

    // MARK: - 图层

    @ViewBuilder
    private func imageLayer(_ uiImage: UIImage) -> some View {
        let g = model.geometry
        let w = model.imagePixelSize.width * g.displayScale
        let h = model.imagePixelSize.height * g.displayScale

        if w > 0, h > 0 {
            Image(uiImage: uiImage)
                .resizable()
                .interpolation(.high)
                .frame(width: w, height: h)
                // 顺序与 H5 一致：先镜像，再旋转，最后按「中心 + 位移」落位。
                .scaleEffect(x: g.flipX ? -1 : 1, y: 1)
                .rotationEffect(.degrees(Double(g.quarterTurns) * 90))
                .position(
                    x: g.viewportSize.width / 2 + g.offset.x,
                    y: g.viewportSize.height / 2 + g.offset.y
                )
        }
    }

    private func overlayCanvas(_ snap: OverlaySnapshot) -> some View {
        Canvas { context, size in
            guard snap.cropRect.width > 1, snap.cropRect.height > 1 else { return }

            let frame = snap.framePath

            // 1. 框外压暗（even-odd 挖出裁切区）。
            var mask = Path(CGRect(origin: .zero, size: size))
            mask.addPath(frame)
            context.fill(mask, with: .color(QingyingTheme.dim), style: FillStyle(eoFill: true))

            // 2. 宫格切线（直角形状下才画，与 H5 一致）。
            if snap.grid.cellCount > 1, snap.shape == .rect {
                var lines = Path()
                let cellW = snap.cropRect.width / CGFloat(snap.grid.cols)
                let cellH = snap.cropRect.height / CGFloat(snap.grid.rows)
                for col in 1..<snap.grid.cols {
                    let x = snap.cropRect.minX + cellW * CGFloat(col)
                    lines.move(to: CGPoint(x: x, y: snap.cropRect.minY))
                    lines.addLine(to: CGPoint(x: x, y: snap.cropRect.maxY))
                }
                for row in 1..<snap.grid.rows {
                    let y = snap.cropRect.minY + cellH * CGFloat(row)
                    lines.move(to: CGPoint(x: snap.cropRect.minX, y: y))
                    lines.addLine(to: CGPoint(x: snap.cropRect.maxX, y: y))
                }
                context.stroke(lines, with: .color(snap.lineColor), lineWidth: 1.25)
            }

            // 3. 裁切框线。
            context.stroke(frame, with: .color(snap.lineColor), lineWidth: 2)

            // 4. 自由比例的角把手。
            if snap.showHandles, snap.shape == .rect {
                var handles = Path()
                let size: CGFloat = 7
                let points = [
                    CGPoint(x: snap.cropRect.minX, y: snap.cropRect.minY),
                    CGPoint(x: snap.cropRect.maxX, y: snap.cropRect.minY),
                    CGPoint(x: snap.cropRect.minX, y: snap.cropRect.maxY),
                    CGPoint(x: snap.cropRect.maxX, y: snap.cropRect.maxY)
                ]
                for point in points {
                    handles.addRect(
                        CGRect(
                            x: point.x - size / 2,
                            y: point.y - size / 2,
                            width: size,
                            height: size
                        )
                    )
                }
                context.fill(handles, with: .color(snap.lineColor))
            }
        }
        .allowsHitTesting(false)
    }

    // MARK: - 手势

    private var drag: some Gesture {
        DragGesture(minimumDistance: 1)
            .onChanged { value in
                if dragStart == nil { dragStart = model.offset }
                guard let start = dragStart else { return }
                model.setOffset(
                    CGPoint(
                        x: start.x + value.translation.width,
                        y: start.y + value.translation.height
                    )
                )
            }
            .onEnded { value in
                guard let start = dragStart else { return }
                dragStart = nil
                // 惯性滑动：按手势末速外推到停下的位置，再由 `setOffset` 夹紧。
                // 图片的位移喂给 `.position`，所以这里的 withAnimation 能真正插值。
                let predicted = value.predictedEndTranslation
                guard abs(predicted.width) > 1 || abs(predicted.height) > 1 else { return }
                withAnimation(.timingCurve(0.16, 0.8, 0.32, 1, duration: 0.5)) {
                    model.setOffset(
                        CGPoint(
                            x: start.x + predicted.width,
                            y: start.y + predicted.height
                        )
                    )
                }
            }
    }

    private var magnify: some Gesture {
        MagnifyGesture()
            .onChanged { value in
                if zoomStart == nil { zoomStart = model.zoom }
                guard let start = zoomStart else { return }
                model.magnify(
                    to: start * value.magnification,
                    anchorInViewport: value.startLocation
                )
            }
            .onEnded { _ in zoomStart = nil }
    }
}
