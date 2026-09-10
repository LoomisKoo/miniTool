import SwiftUI

/// 预览区：自带缩放/平移/落笔手势状态，并负责 2D ↔ 3D 的切换过渡。
///
/// 手势状态（`scale` / `offset`）只留在这一层，拖动缩放时不会让外层
/// `BeadEditorView` 的 body 重新求值。
///
/// 2D ↔ 3D 过渡对齐 H5 `morphAnim` 的节奏（约 980ms）：
/// 相机俯仰先动、图层交叉淡入淡出错开；复位也走同一套插值。
struct BeadPreviewPane: View {
    let model: BeadEditorModel
    let resetToken: Int

    @State private var viewSize: CGSize = .zero
    @State private var scale: CGFloat = 1
    @State private var offset: CGSize = .zero
    @State private var committedOffset: CGSize = .zero

    @State private var isPainting = false
    @State private var abortStroke = false
    @State private var pinchActive = false
    @State private var pinchStartScale: CGFloat = 1
    @State private var pinchAnchorContent: CGPoint = .zero
    @State private var pinchAnchorScreen: CGPoint = .zero
    @State private var last3DTranslation: CGSize = .zero
    @State private var zoom3DActive = false
    @State private var zoom3DBase: Double = 1

    /// 0 = 完全 2D，1 = 完全 3D。
    @State private var settledProgress: Double = 0
    @State private var morph: MorphRun?
    @State private var morphTask: Task<Void, Never>?

    /// 3D 复位时的相机插值（与模式切换分开，避免互相打断）。
    @State private var cameraMorph: CameraMorph?
    @State private var cameraMorphTask: Task<Void, Never>?

    private struct MorphRun: Equatable {
        var from: Double
        var to: Double
        var start: Date
        var duration: Double = 0.98
    }

    private struct CameraMorph: Equatable {
        var from: Bead3DCamera
        var to: Bead3DCamera
        var start: Date
        var duration: Double = 0.48
    }

    var body: some View {
        GeometryReader { proxy in
            Group {
                if morph != nil || cameraMorph != nil {
                    TimelineView(.animation) { timeline in
                        canvasStack(now: timeline.date)
                    }
                } else {
                    canvasStack(now: .now)
                }
            }
            .onAppear {
                viewSize = proxy.size
                settledProgress = model.viewMode == .threeD ? 1 : 0
                fit(animated: false)
            }
            .onChange(of: proxy.size) { _, size in
                viewSize = size
                fit(animated: false)
            }
        }
        .onChange(of: model.generation) { _, _ in
            cancelMorph()
            cancelCameraMorph()
            fit(animated: false)
        }
        .onChange(of: model.visibleRect) { _, _ in fit(animated: false) }
        .onChange(of: model.viewMode) { _, mode in
            fit(animated: false)
            startMorph(to: mode == .threeD ? 1 : 0)
        }
        .onChange(of: model.settings.showSeam) { _, _ in fit(animated: false) }
        .onChange(of: resetToken) { _, _ in
            if model.viewMode == .threeD {
                startCameraReset()
            } else {
                fit(animated: true)
            }
        }
    }

    // MARK: - 画布

    @ViewBuilder
    private func canvasStack(now: Date) -> some View {
        if let grid = model.grid {
            let progress = morphProgress(at: now)
            // 按「3D 程度」做交叉淡入淡出（对齐 H5 stagger 节奏）
            let a2d = progress <= 0.5
                ? 1 - stagger(progress, 0.0, 0.42)
                : stagger(1 - progress, 0.0, 0.48)
            let a3d = progress >= 0.5
                ? 1 - stagger(1 - progress, 0.0, 0.42)
                : stagger(progress, 0.08, 0.48)

            let animating = morph != nil
            let settledFlat = !animating && progress < 0.01
            let settledThreeD = !animating && progress > 0.99
            let camera = displayedCamera(at: now, morphProgress: progress)

            ZStack {
                if a2d > 0.01 {
                    flatCanvas(grid: grid)
                        .opacity(a2d)
                        .allowsHitTesting(settledFlat)
                }
                if a3d > 0.01 {
                    threeCanvas(grid: grid, camera: camera)
                        .opacity(a3d)
                        .allowsHitTesting(settledThreeD)
                }

                if model.isProcessing {
                    ProgressView()
                        .padding(14)
                        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 12))
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(BeadTheme.viewport)
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
    }

    @ViewBuilder
    private func flatCanvas(grid: BeadGrid) -> some View {
        BeadPreviewCanvas(
            grid: grid,
            settings: model.settings,
            rect: model.visibleRect,
            highlightedCode: model.highlightedCode,
            scale: scale,
            offset: offset
        )
        .contentShape(Rectangle())
        .gesture(flatDragGesture)
        .simultaneousGesture(magnifyGesture)
        .simultaneousGesture(singleTapGesture)
        .simultaneousGesture(doubleTapGesture)
    }

    @ViewBuilder
    private func threeCanvas(grid: BeadGrid, camera: Bead3DCamera) -> some View {
        Bead3DCanvas(
            grid: grid,
            settings: model.settings,
            rect: model.visibleRect,
            camera: camera,
            highlightedCode: model.highlightedCode
        )
        .contentShape(Rectangle())
        .gesture(rotate3DGesture)
        .simultaneousGesture(zoom3DGesture)
    }

    // MARK: - 过渡

    private func morphProgress(at date: Date) -> Double {
        guard let run = morph else { return settledProgress }
        let raw = date.timeIntervalSince(run.start) / run.duration
        let eased = easeInOut(min(max(raw, 0), 1))
        return run.from + (run.to - run.from) * eased
    }

    private func displayedCamera(at date: Date, morphProgress progress: Double) -> Bead3DCamera {
        if let run = cameraMorph {
            let raw = date.timeIntervalSince(run.start) / run.duration
            let eased = easeInOut(min(max(raw, 0), 1))
            return lerpCamera(run.from, run.to, t: eased)
        }
        let target = model.camera
        guard progress < 0.999 else { return target }
        // 2D→3D：从正俯视立起来；3D→2D：回到正俯视
        var camera = target
        let topPitch = Double.pi / 2
        camera.pitch = topPitch + (target.pitch - topPitch) * progress
        camera.yaw = target.yaw * progress
        camera.zoom = 1 + (target.zoom - 1) * progress
        return camera
    }

    private func startMorph(to target: Double) {
        cancelCameraMorph()
        let from = morphProgress(at: .now)
        guard abs(from - target) > 0.001 else {
            cancelMorph()
            return
        }
        let run = MorphRun(from: from, to: target, start: .now)
        morph = run
        morphTask?.cancel()
        morphTask = Task { @MainActor in
            try? await Task.sleep(for: .seconds(run.duration))
            guard !Task.isCancelled else { return }
            settledProgress = target
            morph = nil
        }
    }

    private func cancelMorph() {
        morphTask?.cancel()
        morphTask = nil
        morph = nil
        settledProgress = model.viewMode == .threeD ? 1 : 0
    }

    private func startCameraReset() {
        cancelCameraMorph()
        let from = model.camera
        let to = Bead3DCamera()
        guard from != to else { return }
        let run = CameraMorph(from: from, to: to, start: .now)
        cameraMorph = run
        cameraMorphTask = Task { @MainActor in
            try? await Task.sleep(for: .seconds(run.duration))
            guard !Task.isCancelled else { return }
            model.resetCamera()
            cameraMorph = nil
        }
    }

    private func cancelCameraMorph() {
        cameraMorphTask?.cancel()
        cameraMorphTask = nil
        cameraMorph = nil
    }

    private func lerpCamera(_ a: Bead3DCamera, _ b: Bead3DCamera, t: Double) -> Bead3DCamera {
        Bead3DCamera(
            yaw: a.yaw + (b.yaw - a.yaw) * t,
            pitch: a.pitch + (b.pitch - a.pitch) * t,
            zoom: a.zoom + (b.zoom - a.zoom) * t
        ).clamped
    }

    private func easeInOut(_ t: Double) -> Double {
        t < 0.5 ? 4 * t * t * t : 1 - pow(-2 * t + 2, 3) / 2
    }

    /// H5 `stagger(e, a, b)`：把总进度映射到子区间再 clamp。
    private func stagger(_ e: Double, _ a: Double, _ b: Double) -> Double {
        guard b > a else { return e >= b ? 1 : 0 }
        return min(max((e - a) / (b - a), 0), 1)
    }

    // MARK: - 手势

    private var paintingEnabled: Bool {
        model.isEditing && (model.tool == .brush || model.tool == .eraser)
    }

    private var flatDragGesture: some Gesture {
        DragGesture(minimumDistance: 0)
            .onChanged { value in
                if paintingEnabled {
                    if !isPainting {
                        isPainting = true
                        abortStroke = false
                        model.beginStroke(at: contentPoint(value.startLocation))
                    }
                    guard !abortStroke else { return }
                    model.extendStroke(to: contentPoint(value.location))
                    return
                }
                offset = CGSize(
                    width: committedOffset.width + value.translation.width,
                    height: committedOffset.height + value.translation.height
                )
            }
            .onEnded { _ in
                if isPainting {
                    model.endStroke(commit: !abortStroke)
                    isPainting = false
                    abortStroke = false
                    return
                }
                committedOffset = offset
            }
    }

    private var magnifyGesture: some Gesture {
        MagnifyGesture()
            .onChanged { value in
                if isPainting, !abortStroke {
                    abortStroke = true
                    model.endStroke(commit: false)
                    isPainting = false
                }
                if !pinchActive {
                    pinchActive = true
                    pinchStartScale = scale
                    pinchAnchorScreen = value.startLocation
                    pinchAnchorContent = contentPoint(value.startLocation)
                }
                let next = min(max(pinchStartScale * value.magnification, 0.3), 10)
                let cell = BeadPreviewCanvas.contentCell * next
                scale = next
                offset = CGSize(
                    width: pinchAnchorScreen.x
                        - (pinchAnchorContent.x - CGFloat(model.visibleRect.x0)) * cell,
                    height: pinchAnchorScreen.y
                        - (pinchAnchorContent.y - CGFloat(model.visibleRect.y0)) * cell
                )
            }
            .onEnded { _ in
                pinchActive = false
                committedOffset = offset
            }
    }

    private var singleTapGesture: some Gesture {
        SpatialTapGesture()
            .onEnded { value in
                // 非编辑状态：点击预览无反应（高亮只从「豆色」面板进）
                guard model.isEditing else { return }
                if model.tool == .dropper {
                    if let code = model.pickColor(at: contentPoint(value.location)) {
                        model.showHint("取色：\(code)")
                    }
                    return
                }
            }
    }

    private var doubleTapGesture: some Gesture {
        SpatialTapGesture(count: 2)
            .onEnded { _ in
                guard model.viewMode == .flat else { return }
                fit(animated: true)
            }
    }

    private func contentPoint(_ screen: CGPoint) -> CGPoint {
        let cell = BeadPreviewCanvas.contentCell * scale
        guard cell > 0 else { return .zero }
        return CGPoint(
            x: (screen.x - offset.width) / cell + CGFloat(model.visibleRect.x0),
            y: (screen.y - offset.height) / cell + CGFloat(model.visibleRect.y0)
        )
    }

    // MARK: - 3D 手势

    private var rotate3DGesture: some Gesture {
        DragGesture()
            .onChanged { value in
                guard cameraMorph == nil else { return }
                let dx = value.translation.width - last3DTranslation.width
                let dy = value.translation.height - last3DTranslation.height
                last3DTranslation = value.translation
                model.rotateCamera(deltaX: Double(dx), deltaY: Double(dy))
            }
            .onEnded { _ in
                last3DTranslation = .zero
            }
    }

    private var zoom3DGesture: some Gesture {
        MagnifyGesture()
            .onChanged { value in
                guard cameraMorph == nil else { return }
                if !zoom3DActive {
                    zoom3DActive = true
                    zoom3DBase = model.camera.zoom
                }
                model.setZoom(zoom3DBase * Double(value.magnification))
            }
            .onEnded { _ in
                zoom3DActive = false
            }
    }

    // MARK: - 适配

    private func fit(animated: Bool) {
        guard model.grid != nil, viewSize.width > 0, viewSize.height > 0 else { return }
        let rect = model.visibleRect
        guard rect.width > 0, rect.height > 0 else { return }

        let cell = BeadPreviewCanvas.contentCell
        let contentW = CGFloat(rect.width) * cell
        let contentH = CGFloat(rect.height) * cell
        let fitted = min(viewSize.width / contentW, viewSize.height / contentH) * 0.94
        let nextOffset = CGSize(
            width: (viewSize.width - contentW * fitted) / 2,
            height: (viewSize.height - contentH * fitted) / 2
        )

        let apply = {
            scale = fitted
            offset = nextOffset
            committedOffset = nextOffset
        }
        if animated {
            withAnimation(.easeInOut(duration: 0.35), apply)
        } else {
            apply()
        }
    }
}
