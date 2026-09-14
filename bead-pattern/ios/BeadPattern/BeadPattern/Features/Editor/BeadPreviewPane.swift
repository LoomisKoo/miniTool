import SwiftUI

/// 预览区：自带缩放/平移/落笔手势状态，并负责 2D ↔ 3D 的切换过渡。
///
/// 手势状态（`scale` / `offset`）只留在这一层，拖动缩放时不会让外层
/// `BeadEditorView` 的 body 重新求值。
///
/// 2D ↔ 3D 过渡对齐 H5 `morphAnim` 的节奏（约 980ms）：
/// 相机俯仰先动、图层交叉淡入淡出错开；复位也走同一套插值。
///
/// 缩放/平移口径按「照片详情页」的手感来：
/// 最小缩放 = 图案完整可见（`fittedScale`），放大了才允许被裁切；
/// 位移夹在内容边界内，松手后按末速惯性滑到停下的位置。
struct BeadPreviewPane: View {
    let model: BeadEditorModel
    let resetToken: Int

    @State private var viewSize: CGSize = .zero
    @State private var scale: CGFloat = 1
    @State private var offset: CGSize = .zero
    @State private var committedOffset: CGSize = .zero
    /// 图案完整可见时的缩放，同时作为缩放下限。
    @State private var fittedScale: CGFloat = 1

    @State private var isPainting = false
    @State private var abortStroke = false
    @State private var panning = false
    @State private var pinchActive = false
    @State private var pinchStartScale: CGFloat = 1
    @State private var pinchAnchorContent: CGPoint = .zero
    @State private var pinchAnchorScreen: CGPoint = .zero
    /// 3D 旋转的手势基准：记下**基准时刻的角度**与当时的累计位移，目标角度按
    /// 「基准角度 + 位移差」绝对映射（不逐帧累加，避免打断后残留偏差）。
    ///
    /// 只记 yaw/pitch，**不记 zoom**：万一基准被判成「还是同一段手势」，最多让
    /// 角度跳一下，绝不会把用户刚调好的缩放复原。zoom 每帧都取
    /// `model.camera` 的当前值。
    @State private var rotationAnchor: RotationAnchor?
    /// 3D 缩放的基准。`MagnifyGesture.magnification` 是相对**手势起点**的累计值，
    /// 所以只记基准 zoom；关键是「新一段手势的 magnification 会从 1 重新计」，
    /// 旧基准必须被判为失效，否则第二段捏合的第一帧就会把大小拉回旧值。
    @State private var zoomAnchor: ZoomAnchor?
    /// 3D 手势是否在飞行中。用 `@GestureState` 而不是 `@State`：
    /// 手势被取消（第二个手指、系统手势抢走）时 `onEnded` 不保证触发，
    /// 用 `@State` 会永久卡在 true，画布就一直停在交互档（看起来是扁的）。
    /// `@GestureState` 在手势结束或取消时自动归位。
    @GestureState private var threeDGestureActive = false

    /// 0 = 完全 2D，1 = 完全 3D。
    @State private var settledProgress: Double = 0
    @State private var morph: MorphRun?
    @State private var morphTask: Task<Void, Never>?

    /// 3D 复位 / 旋转惯性的相机插值（与模式切换分开，避免互相打断）。
    @State private var cameraMorph: CameraMorph?
    @State private var cameraMorphTask: Task<Void, Never>?

    /// 2D 的平移惯性 / 适配动画。
    @State private var transformRun: TransformRun?
    @State private var transformTask: Task<Void, Never>?

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

    /// 2D 画布的插值动画：平移惯性、双击/复位时的适配都走这一条。
    private struct TransformRun: Equatable {
        var fromScale: CGFloat
        var fromOffset: CGSize
        var toScale: CGFloat
        var toOffset: CGSize
        var start: Date
        var duration: Double
    }

    /// 3D 旋转的手势基准。`translation` 是记下基准那一刻的累计位移，
    /// 目标角度 = `yaw/pitch` + (当前位移 − `translation`) × 灵敏度。
    private struct RotationAnchor: Equatable {
        var yaw: Double
        var pitch: Double
        var translation: CGSize
        /// 最后一个事件的**处理时刻**，用来判「是否还是同一段手势」。
        var eventAt: Date
    }

    /// 3D 缩放的手势基准：记下**基准 zoom** 与该时刻的**累计张合量**，目标 zoom
    /// 按比例映射。
    ///
    /// 必须把 `magnification` 一起记下来，否则手势中途重建基准就会把累计张合量
    /// 乘第二遍（`magnification` 是相对手势起点累计的，不是增量）。
    private struct ZoomAnchor: Equatable {
        var zoom: Double
        var magnification: Double
        /// 最后一个事件的处理时刻（`MagnifyGesture.Value` 没有时间字段）。
        var eventAt: Date
    }

    var body: some View {
        GeometryReader { proxy in
            Group {
                if morph != nil || cameraMorph != nil || transformRun != nil {
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
            BeadPerfProbe.shared.reset()
            fit(animated: false)
        }
        .onChange(of: model.visibleRect) { _, _ in fit(animated: false) }
        .onChange(of: model.viewMode) { _, mode in
            // 切模式时清掉 3D 手势基准：这里换了视图分支，旧基准没有意义了
            clear3DGestureBase()
            cancelCameraMorph()
            // 2D ↔ 3D 互转都复位 3D 视角：不复用上次的旋转与缩放。
            // 进 3D 时**立刻**复位，过渡正好从「正俯视」升到默认视角；
            // 退 2D 时改由 `startMorph` 收尾时复位 —— 在这里复位会让退场动画的
            // 第一帧从默认视角起步，画面会跳一下。
            if mode == .threeD {
                model.resetCamera()
            }
            fit(animated: false)
            startMorph(to: mode == .threeD ? 1 : 0)
        }
        // 3D 手势的基准不在手势结束时清，而是下一次手势的**第一帧**覆盖（见
        // `needsNewRotationAnchor` / `needsNewZoomAnchor`）：按 `threeDGestureActive`
        // 归零就清的话，双指捏合把 `DragGesture` 顶掉时会把仍在用的缩放基准一起清掉。
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
            // 2D 先退、3D 后进，走同一条单调曲线（对齐 H5 stagger 节奏）。
            //
            // 原实现按 progress ≤ 0.5 分成两支，>`0.5` 那支用 `stagger(1 - progress…)`
            // 把 a2d 又拉回接近 1：p=0.5 时两者都归零，p=0.6 时 a2d=0.83、a3d=0.05
            // ——既在中途闪一下，又让已经看不见的 2D 层白画了后半程（实测每帧
            // 2.5~9.3ms）。2D→3D 与 3D→2D 都是同一条曲线的正/反向，不需要分支。
            let a2d = 1 - stagger(progress, 0.0, 0.42)
            let a3d = stagger(progress, 0.08, 0.48)

            let animating = morph != nil
            let settledThreeD = !animating && progress > 0.99
            let camera = displayedCamera(at: now, morphProgress: progress)

            ZStack {
                // GPU 路径：2D 层与 3D 层各自淡入淡出（3D 层是透明底的 MTKView，
                // 直接叠在 2D 层上）。稳定态只有一层可见，过渡期两层都要画。
                if Bead3DMetalSupport.shared != nil {
                    if a2d > 0.001 {
                        flatCanvas(
                            grid: grid,
                            scale: displayedScale(at: now),
                            offset: displayedOffset(at: now)
                        )
                        .opacity(a2d)
                        .allowsHitTesting(!animating && !settledThreeD)
                    }
                    if a3d > 0.001 {
                        Bead3DMetalCanvas(
                            grid: grid,
                            rect: model.visibleRect,
                            camera: camera,
                            highlightedCode: model.highlightedCode
                        )
                        .opacity(a3d)
                        .contentShape(Rectangle())
                        .gesture(rotate3DGesture)
                        .simultaneousGesture(zoom3DGesture)
                        // 过渡期让位给 2D 层（与原实现一致：过渡中不接受手势）
                        .allowsHitTesting(!animating)
                    }
                } else if animating {
                    // 兜底：没有 Metal（或着色器编译失败）时走原来的 CPU 单画布合成
                    BeadMorphCanvas(
                        grid: grid,
                        style: canvasStyle,
                        rect: model.visibleRect,
                        highlightedCode: model.highlightedCode,
                        flatScale: displayedScale(at: now),
                        flatOffset: displayedOffset(at: now),
                        camera: camera,
                        a2d: a2d,
                        a3d: a3d
                    )
                } else if settledThreeD {
                    threeCanvas(grid: grid, camera: camera)
                } else {
                    flatCanvas(
                        grid: grid,
                        scale: displayedScale(at: now),
                        offset: displayedOffset(at: now)
                    )
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

    /// 画布只吃 `BeadCanvasStyle`：参数滑块（豆宽/限色…）在量化结果回来之前
    /// 不改动它，配合 `.equatable()` 就不会每帧重绘整块画布。
    private var canvasStyle: BeadCanvasStyle { BeadCanvasStyle(model.settings) }

    @ViewBuilder
    private func flatCanvas(grid: BeadGrid, scale: CGFloat, offset: CGSize) -> some View {
        BeadPreviewCanvas(
            grid: grid,
            style: canvasStyle,
            rect: model.visibleRect,
            highlightedCode: model.highlightedCode,
            scale: scale,
            offset: offset
        )
        .equatable()
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
            style: canvasStyle,
            rect: model.visibleRect,
            camera: camera,
            highlightedCode: model.highlightedCode,
            quality: is3DInteracting ? .interactive : .settled
        )
        .equatable()
        .contentShape(Rectangle())
        .gesture(rotate3DGesture)
        .simultaneousGesture(zoom3DGesture)
    }

    /// 3D 手势或过渡进行中：不画格内色号 + 顶点数封顶（几何不变，拖动时仍是完整 3D）。
    ///
    /// 只用会**自动复位**的 `threeDGestureActive` 与 `morph`/`cameraMorph` 判定，
    /// 不掺任何手工复位的 `@State`，避免卡住后一直降档。
    private var is3DInteracting: Bool {
        morph != nil || cameraMorph != nil || threeDGestureActive
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
            let raw = min(max(date.timeIntervalSince(run.start) / run.duration, 0), 1)
            return lerpCamera(run.from, run.to, t: easeInOut(raw))
        }
        let target = model.camera
        guard progress < 0.999 else { return target }
        // 2D→3D：从正俯视立起来；3D→2D：回到正俯视
        var camera = target
        let topPitch = Double.pi / 2
        camera.pitch = topPitch + (target.pitch - topPitch) * progress
        camera.yaw = target.yaw * progress
        // 起点 zoom 不是 1，而是「正俯视的 3D 与 2D 图层同尺寸」的那个值：
        // 2D 与 3D 的 fit 是两套公式（`min × 0.94` vs `fitFactor(pitch: 0.5, pad: 28)`），
        // 各用各的就会出现交叉淡入时两层一大一小。用 `flatMatchedZoom` 对齐起点，
        // 终点仍是用户相机的 zoom，中间线性过渡，两个方向（含 3D→2D）都成立。
        let matched = flatMatchedZoom(at: date)
        camera.zoom = matched + (target.zoom - matched) * progress
        return camera
    }

    /// 正俯视下与 2D 图层同尺寸的 3D zoom（过渡起点用）。
    private func flatMatchedZoom(at date: Date) -> Double {
        let rect = model.visibleRect
        guard rect.width > 0, rect.height > 0 else { return 1 }
        return Bead3DRenderer.flatMatchedZoom(
            pw: rect.width,
            ph: rect.height,
            viewport: viewSize,
            cell: BeadPreviewCanvas.contentCell,
            scale: displayedScale(at: date)
        )
    }

    private func startMorph(to target: Double) {
        cancelCameraMorph()
        let from = morphProgress(at: .now)
        guard abs(from - target) > 0.001 else {
            // 已经是目标状态（比如 2D↔3D 快速来回切）：没有退场动画要保护，
            // 直接复位，省得留下上一次的视角。
            if target < 0.5 { model.resetCamera() }
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
            // 退回 2D 后复位 3D 视角：此刻 3D 层的不透明度已经到 0，复位不可见；
            // 这样「下次进 3D 一定从默认视角开始」不依赖进 3D 那次复位兜底。
            if target < 0.5 { model.resetCamera() }
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
        runCameraMorph(from: from, to: to, duration: 0.48)
    }

    private func runCameraMorph(from: Bead3DCamera, to: Bead3DCamera, duration: Double) {
        let run = CameraMorph(from: from, to: to, start: .now, duration: duration)
        cameraMorph = run
        cameraMorphTask?.cancel()
        cameraMorphTask = Task { @MainActor in
            try? await Task.sleep(for: .seconds(duration))
            guard !Task.isCancelled else { return }
            // 落点就是 `to`（插值的终点），不要再叠一次位移：
            // 之前这里又调了一次 `rotateCamera(inertia)`，等于把目标位移算了两遍。
            model.setCamera(to)
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

    private func easeOutCubic(_ t: Double) -> Double {
        1 - pow(1 - t, 3)
    }

    /// H5 `stagger(e, a, b)`：把总进度映射到子区间再 clamp。
    private func stagger(_ e: Double, _ a: Double, _ b: Double) -> Double {
        guard b > a else { return e >= b ? 1 : 0 }
        return min(max((e - a) / (b - a), 0), 1)
    }

    // MARK: - 2D 插值动画

    private func runProgress(_ run: TransformRun, at date: Date) -> CGFloat {
        let raw = min(max(date.timeIntervalSince(run.start) / run.duration, 0), 1)
        return CGFloat(easeOutCubic(raw))
    }

    private func displayedScale(at date: Date) -> CGFloat {
        guard let run = transformRun else { return scale }
        return run.fromScale + (run.toScale - run.fromScale) * runProgress(run, at: date)
    }

    private func displayedOffset(at date: Date) -> CGSize {
        guard let run = transformRun else { return offset }
        let t = runProgress(run, at: date)
        return CGSize(
            width: run.fromOffset.width + (run.toOffset.width - run.fromOffset.width) * t,
            height: run.fromOffset.height + (run.toOffset.height - run.fromOffset.height) * t
        )
    }

    private func startTransformRun(
        toScale: CGFloat,
        toOffset: CGSize,
        duration: Double
    ) {
        let delta = max(
            max(abs(toOffset.width - offset.width), abs(toOffset.height - offset.height)),
            abs(toScale - scale) * 40
        )
        guard delta > 0.5 else { return }
        let run = TransformRun(
            fromScale: scale,
            fromOffset: offset,
            toScale: toScale,
            toOffset: toOffset,
            start: .now,
            duration: duration
        )
        transformRun = run
        // 状态直接落到终点，动画只作用在画布读到的插值上
        scale = toScale
        offset = toOffset
        committedOffset = toOffset
        transformTask?.cancel()
        transformTask = Task { @MainActor in
            try? await Task.sleep(for: .seconds(duration))
            guard !Task.isCancelled else { return }
            transformRun = nil
        }
    }

    private func cancelTransformRun() {
        transformTask?.cancel()
        transformTask = nil
        transformRun = nil
    }

    /// 新手势开始时把动画停在当前画面，避免「跳回终点再跟手」。
    private func settleTransform() {
        guard transformRun != nil else { return }
        let now = Date()
        scale = displayedScale(at: now)
        let settled = displayedOffset(at: now)
        offset = settled
        committedOffset = settled
        cancelTransformRun()
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
                if !panning {
                    panning = true
                    settleTransform()
                }
                offset = clampedOffset(
                    CGSize(
                        width: committedOffset.width + value.translation.width,
                        height: committedOffset.height + value.translation.height
                    ),
                    scale: scale
                )
            }
            .onEnded { value in
                if isPainting {
                    model.endStroke(commit: !abortStroke)
                    isPainting = false
                    abortStroke = false
                    return
                }
                panning = false
                committedOffset = offset
                // 惯性滑动：按手势末速外推到停下的位置，再夹到内容边界内
                let target = clampedOffset(
                    CGSize(
                        width: committedOffset.width + value.predictedEndTranslation.width,
                        height: committedOffset.height + value.predictedEndTranslation.height
                    ),
                    scale: scale
                )
                startTransformRun(toScale: scale, toOffset: target, duration: 0.55)
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
                    settleTransform()
                    pinchStartScale = scale
                    pinchAnchorScreen = value.startLocation
                    pinchAnchorContent = contentPoint(value.startLocation)
                }
                let upper = max(fittedScale, Self.maxZoom)
                let next = min(max(pinchStartScale * value.magnification, fittedScale), upper)
                let cell = BeadPreviewCanvas.contentCell * next
                scale = next
                offset = clampedOffset(
                    CGSize(
                        width: pinchAnchorScreen.x
                            - (pinchAnchorContent.x - CGFloat(model.visibleRect.x0)) * cell,
                        height: pinchAnchorScreen.y
                            - (pinchAnchorContent.y - CGFloat(model.visibleRect.y0)) * cell
                    ),
                    scale: next
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
            .onEnded { value in
                guard model.viewMode == .flat else { return }
                // 与 H5 `zoomAt2d` 一致：放大状态双击复位，否则就点按处放大两档
                if scale > fittedScale * 1.35 {
                    fit(animated: true)
                } else {
                    zoomIn(at: value.location, animated: true)
                }
            }
    }

    /// 以点击处为锚点放大（对齐 H5 双击放大）。
    private func zoomIn(at point: CGPoint, animated: Bool) {
        let target = min(max(fittedScale * 1.01, scale * 2.3), max(fittedScale, Self.maxZoom))
        let content = contentPoint(point)
        let cell = BeadPreviewCanvas.contentCell * target
        let next = clampedOffset(
            CGSize(
                width: point.x - (content.x - CGFloat(model.visibleRect.x0)) * cell,
                height: point.y - (content.y - CGFloat(model.visibleRect.y0)) * cell
            ),
            scale: target
        )
        if animated {
            startTransformRun(toScale: target, toOffset: next, duration: 0.35)
        } else {
            scale = target
            offset = next
            committedOffset = next
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

    /// 单指拖动旋转。
    ///
    /// 这里是「拖动」而不是「甩动」：与 H5 一致（H5 的 `s3.yaw/pitch` 就是直接按
    /// 位移写，`requestRender()`，没有惯性）。之前多出来的一段旋转惯性带来了三个
    /// 手感问题，都已去掉：
    ///
    /// - **拖不动**：`onChanged` 里原来有 `guard cameraMorph == nil else { return }`，
    ///   动画那 0.7s 内所有拖动都被吞掉，用户只觉得手指没反应。
    /// - **回弹**：`runCameraMorph` 的目标 `to` 里**已经包含**了那段惯性位移，
    ///   动画结束的回调又 `rotateCamera(inertia)` 加了一遍，落点比动画终点多转一格，
    ///   松手后就跳一下；另外 `predictedEndTranslation` 在手指末段回抽时会指向
    ///   拖动**反方向**，那一帧就会朝反方向转。
    /// - **甩回旧位置**：位移原来是逐帧累加 delta，被打断时残留偏差，下一次拖动的
    ///   第一帧带着旧偏移继续走。
    ///
    /// 现在改成「基准角度 + 位移差」的绝对映射，并且允许拖动随时打断复位动画。
    private var rotate3DGesture: some Gesture {
        DragGesture()
            .updating($threeDGestureActive) { _, state, _ in state = true }
            .onChanged { value in
                // 用户重新上手就立刻接管：复位动画停在当前帧并落库
                commitCameraMorphIfNeeded()
                if needsNewRotationAnchor(value) {
                    rotationAnchor = RotationAnchor(
                        yaw: model.camera.yaw,
                        pitch: model.camera.pitch,
                        translation: value.translation,
                        eventAt: .now
                    )
                } else {
                    rotationAnchor?.eventAt = .now
                }
                guard let anchor = rotationAnchor else { return }
                var next = model.camera
                // 方向与 H5 一致：右拖 yaw 减小、下拖 pitch 增大（更俯视）
                next.yaw = anchor.yaw
                    - Double(value.translation.width - anchor.translation.width) * 0.012
                next.pitch = anchor.pitch
                    + Double(value.translation.height - anchor.translation.height) * 0.008
                model.setCamera(next)
            }
            // 常规路径下由这里清基准；被系统手势抢走时 `onEnded` 不保证触发，
            // 那时靠 `needsNewRotationAnchor` 的时间间隔兜底。
            .onEnded { _ in rotationAnchor = nil }
    }

    /// 双指缩放。`magnification` 是相对手势起点的累计值，所以要和基准时刻的
    /// 张合量做比值，而不是直接乘。
    private var zoom3DGesture: some Gesture {
        MagnifyGesture()
            .updating($threeDGestureActive) { _, state, _ in state = true }
            .onChanged { value in
                commitCameraMorphIfNeeded()
                if needsNewZoomAnchor(value) {
                    zoomAnchor = ZoomAnchor(
                        zoom: model.camera.zoom,
                        magnification: Double(value.magnification),
                        eventAt: .now
                    )
                } else {
                    zoomAnchor?.eventAt = .now
                }
                guard let anchor = zoomAnchor, anchor.magnification > 0.001 else { return }
                let target = anchor.zoom * Double(value.magnification) / anchor.magnification
                // 兜底：一帧内张合 35% 在物理上不可能（60Hz 下要 9 帧才能把画面
                // 放大一倍）。出现这种幅度说明基准是上一段手势留下的，而
                // `needsNewZoomAnchor` 没认出来 —— 与其把画面拉回旧大小（用户看到的
                // 就是「缩放被复原」），不如就地重建基准，下一帧就正常了。
                if abs(target - model.camera.zoom) > model.camera.zoom * 0.35 {
                    zoomAnchor = ZoomAnchor(
                        zoom: model.camera.zoom,
                        magnification: Double(value.magnification),
                        eventAt: .now
                    )
                    return
                }
                model.setZoom(target)
            }
            .onEnded { _ in zoomAnchor = nil }
    }

    /// 手势分两段（中间抬手）时，位移/张合量都会**重新从 0 / 1 开始计**，
    /// 所以旧基准必须失效，否则第一帧就会用「旧基准 + 新小值」算出错的绝对位置。
    ///
    /// 判据是**处理相邻事件的时间间隔**：同一段手势里事件是连续投递的（60~120Hz），
    /// 而两段手势之间必然有抬手再落手的停顿。手停住不动超过阈值再继续也走这一支
    /// —— 重记基准不会跳，因为同时记下了当时的位移作参照（见 `rotationAnchor`）。
    /// 主线程偶尔卡顿超过阈值也只会重建基准，同样不影响画面。
    private static let gestureRestartGap: TimeInterval = 0.1

    private func needsNewRotationAnchor(_ value: DragGesture.Value) -> Bool {
        guard let anchor = rotationAnchor else { return true }
        if abs(value.translation.width) < 1, abs(value.translation.height) < 1 { return true }
        return Date.now.timeIntervalSince(anchor.eventAt) > Self.gestureRestartGap
    }

    private func needsNewZoomAnchor(_ value: MagnifyGesture.Value) -> Bool {
        guard let anchor = zoomAnchor else { return true }
        // 新手势的第一帧 `magnification` 必然接近 1（它就是从这个值起算的）
        if abs(value.magnification - 1) < 0.01 { return true }
        return Date.now.timeIntervalSince(anchor.eventAt) > Self.gestureRestartGap
    }

    /// 让复位动画立刻停在当前帧并落库，拖动可以随时打断它。
    private func commitCameraMorphIfNeeded() {
        guard cameraMorph != nil else { return }
        model.setCamera(displayedCamera(at: .now, morphProgress: morphProgress(at: .now)))
        cancelCameraMorph()
    }

    /// 切模式等场景下清掉 3D 手势基准。
    private func clear3DGestureBase() {
        rotationAnchor = nil
        zoomAnchor = nil
    }

    // MARK: - 适配与夹紧

    /// H5 `MAX_ZOOM`：相对内容像素的最大放大倍数（格宽最大约 104pt）。
    private static let maxZoom: CGFloat = 6.5

    /// 位移夹取，与 H5 `clampView2d` 同口径：内容比视口大时允许任意格点
    /// 拖到视口中心（留 `max(44, 半屏)` 的余量），再夹住；比视口小就直接居中。
    /// 这样双击角落放大时不会因为硬夹紧而「跳回来」。
    private func clampedOffset(_ value: CGSize, scale: CGFloat) -> CGSize {
        let rect = model.visibleRect
        guard rect.width > 0, rect.height > 0, viewSize.width > 0, viewSize.height > 0 else {
            return value
        }
        let cell = BeadPreviewCanvas.contentCell * scale
        let contentW = CGFloat(rect.width) * cell
        let contentH = CGFloat(rect.height) * cell
        let edgeX = max(44, viewSize.width * 0.5)
        let edgeY = max(44, viewSize.height * 0.5)

        var x = value.width
        var y = value.height
        if contentW <= viewSize.width {
            x = (viewSize.width - contentW) / 2
        } else {
            x = min(edgeX, max(viewSize.width - contentW - edgeX, x))
        }
        if contentH <= viewSize.height {
            y = (viewSize.height - contentH) / 2
        } else {
            y = min(edgeY, max(viewSize.height - contentH - edgeY, y))
        }
        return CGSize(width: x, height: y)
    }

    private func fit(animated: Bool) {
        guard model.grid != nil, viewSize.width > 0, viewSize.height > 0 else { return }
        let rect = model.visibleRect
        guard rect.width > 0, rect.height > 0 else { return }

        let cell = BeadPreviewCanvas.contentCell
        let contentW = CGFloat(rect.width) * cell
        let contentH = CGFloat(rect.height) * cell
        let fitted = min(viewSize.width / contentW, viewSize.height / contentH) * 0.94
        // 下限就是「完整可见」，图案再大也缩得回来
        fittedScale = max(0.02, fitted)
        let nextOffset = CGSize(
            width: (viewSize.width - contentW * fittedScale) / 2,
            height: (viewSize.height - contentH * fittedScale) / 2
        )

        if animated, scale > 0 {
            startTransformRun(toScale: fittedScale, toOffset: nextOffset, duration: 0.35)
        } else {
            cancelTransformRun()
            scale = fittedScale
            offset = nextOffset
            committedOffset = nextOffset
        }
    }
}
