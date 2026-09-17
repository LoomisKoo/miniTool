import Foundation
import SwiftUI

/// 预览区：自带缩放/平移/落笔手势状态，并负责 2D ↔ 3D 的切换过渡。
///
/// 手势状态（`scale` / `offset`）只留在这一层，拖动缩放时不会让外层
/// `BeadEditorView` 的 body 重新求值。
///
/// 2D ↔ 3D 过渡对齐 H5 `morphAnim` 的节奏（约 980ms），但**分两段**：
/// 前 `morphSwapEnd` 只做交叉淡入（相机停在正俯视、两层取景重合），
/// 之后才升角；复位也走同一套插值。
///
/// 缩放/平移口径按「照片详情页」的手感来：
/// 最小缩放 = 图案完整可见（`fittedScale`），放大了才允许被裁切；
/// 位移夹在内容边界内，松手后按末速惯性滑到停下的位置。
struct BeadPreviewPane: View {
    let model: BeadEditorModel
    let resetToken: Int

    @Environment(\.colorScheme) private var colorScheme

    @State private var viewSize: CGSize = .zero
    @State private var scale: CGFloat = 1
    @State private var offset: CGSize = .zero
    @State private var committedOffset: CGSize = .zero
    /// 图案完整可见时的缩放，同时作为缩放下限。
    @State private var fittedScale: CGFloat = 1

    @State private var isPainting = false
    @State private var abortStroke = false
    /// 落笔时手指所在的格。非 nil 时在画布上浮出放大镜（见 `BeadPaintLoupe`）。
    @State private var paintLoupe: PaintLoupe?
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
    /// 尺寸变化进行中的取景规则（见 `Bead2DResize`）：非空时画布按**当帧**容器尺寸
    /// 现算取景；这里只记「变化开始时」的那几项基准，收口时把终点落库。
    @State private var resizeRef: Bead2DResize?
    @State private var resizeTask: Task<Void, Never>?
    /// 取景的「归一化」参照（见 `FramingSnapshot` / `keepFraming`）。
    @State private var framingRef: FramingSnapshot?
    /// 内容整个换了（裁切 / 换图）：下一个新格子出来时复位一次取景。
    @State private var pendingRefit = false

    private struct MorphRun: Equatable {
        var from: Double
        var to: Double
        var start: Date
        var duration: Double = BeadPreviewPane.morphDuration
    }

    /// 2D↔3D 过渡的总时长（与 H5 `morphAnim` 的 ~980ms 一致）。
    private static let morphDuration: Double = 0.98
    /// 换层窗口：只占过渡的前 18%。这段里相机不动、两层取景重合，
    /// 交叉淡入看不出「换了一层」；升角在这之后才开始。
    private static let morphSwapEnd: Double = 0.18

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

    /// 落笔放大镜的锚点：手指在哪一格 + 手指在预览框里的位置。
    private struct PaintLoupe: Equatable {
        var col: Int
        var row: Int
        var screen: CGPoint
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

    /// 取景的**归一化参照**（见 `keepFraming`）：把画面上的取景写成两个与豆数无关
    /// 的量，才能原样搬到尺寸已经变了的格子上。
    ///
    /// - `zoomRatio`：相对「完整可见」放大了几倍（1 = 完整可见态）；
    /// - `focus`：画面中心对着内容里的哪个比例点（0.5 = 正中）。
    private struct FramingSnapshot {
        var zoomRatio: CGFloat
        var focus: CGPoint
    }

    var body: some View {
        GeometryReader { proxy in
            let animating = morph != nil || cameraMorph != nil || transformRun != nil || resizeRef != nil
            // 始终用同一个 TimelineView，避免 morph 起停时整棵画布被拆掉重建（会闪一下）。
            TimelineView(.animation(minimumInterval: nil, paused: !animating)) { timeline in
                canvasStack(now: animating ? timeline.date : .now, viewport: proxy.size)
            }
            .onAppear {
                viewSize = proxy.size
                settledProgress = model.viewMode == .threeD ? 1 : 0
                fit(animated: false)
            }
            .onChange(of: proxy.size) { _, size in
                guard size != viewSize else { return }
                guard size.width > 1, size.height > 1 else {
                    viewSize = size
                    return
                }
                // 起点用**还没更新的** `viewSize`（= 变化开始时的容器尺寸）。
                beginResize()
                viewSize = size
                scheduleResizeCommit()
            }
        }
        // 内容整个换了（裁切 / 换图 / 打开作品）：等新格子出来（`generation` 变化）
        // 再复位一次取景。这里不立刻 fit —— 那会先按**旧**图复位一次，白闪一下。
        .onChange(of: model.contentResetToken) { _, _ in
            pendingRefit = true
        }
        // 可见区域自己变了（翻板 / 切全图 / 换拼板规格）：立刻重新适配。
        .onChange(of: model.boardResetToken) { _, _ in
            fit(animated: false)
        }
        // 量化开始：趁机把「重算前」的取景记下来 —— 新格子换上后就取不到旧比例了。
        .onChange(of: model.isProcessing) { _, processing in
            if processing { snapshotFraming() }
        }
        .onChange(of: model.generation) { _, _ in
            cancelMorph()
            cancelCameraMorph()
            BeadPerfProbe.shared.reset()
            if pendingRefit {
                pendingRefit = false
                framingRef = nil
                fit(animated: false)
            } else {
                // 参数重算（豆宽 / 限色 / 合并 / 抖动 / 去背景…）：用户没要求复位，
                // 缩放和位置都留住，只把取景搬到新格子上。
                keepFraming()
            }
        }
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
            // 切模式不要 fit：会改 2D 缩放，过渡期叠在淡出上就像闪一下。
            //
            // 必须关掉继承来的动画事务：两层的 `.opacity` 是由 `TimelineView`
            // 手动逐帧插值的，若这一帧外面带着动画进来（切模式的布局过渡就是），
            // SwiftUI 会在我们的插值之上再补一层，画面就会抖/闪一下。
            withoutAnimation {
                startMorph(to: mode == .threeD ? 1 : 0)
            }
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
    private func canvasStack(now: Date, viewport: CGSize) -> some View {
        if let grid = model.grid {
            let progress = morphProgress(at: now)
            let tilt = tiltProgress(progress)
            // 交叉淡入**只在正俯视那一段**完成（两层此刻重合：同一取景、同一位置，
            // 3D 的底板也被调成预览框底色），之后才把板子立起来。
            //
            // 原先是 2D 退 0…0.42 / 3D 进 0.08…0.48，这两个窗口正好盖住整个升角
            // 过程：中途两层各自半透明、视角又不同，看到的是「一张平的图案上叠着
            // 一张斜的图案」，就是那股说不出的不自然。现在升角整体挪到淡入之后
            // （见 `tiltProgress`），前 0.18 只是一次「同一个画面」的换层。
            let swap = stagger(progress, 0.0, Self.morphSwapEnd)
            let a2d = 1 - swap
            let a3d = swap

            let animating = morph != nil
            let settledThreeD = !animating && progress > 0.99
            let camera = displayedCamera(at: now, morphProgress: progress)
            // 淡化目标色与底板色是 RGB8 参与运算的，得把外观显式传进画布；
            // 同时也让它进 `==`，切深色时画布会重画一次。
            let appearance = BeadAppearance(colorScheme)

            ZStack {
                if Bead3DMetalSupport.shared != nil {
                    // 两层始终挂着，只改透明度：按需创建/销毁 MTKView 会闪空白帧。
                    flatCanvas(
                        grid: grid,
                        scale: displayedScale(at: now),
                        offset: displayedOffset(at: now),
                        appearance: appearance
                    )
                    .opacity(a2d)
                    .allowsHitTesting(!animating && !settledThreeD)

                    Bead3DMetalCanvas(
                        grid: grid,
                        rect: model.visibleRect,
                        camera: camera,
                        highlightedCode: model.highlightedCode,
                        appearance: appearance,
                        plateTilt: tilt
                    )
                    .opacity(a3d)
                    .contentShape(Rectangle())
                    .gesture(rotate3DGesture)
                    .simultaneousGesture(zoom3DGesture)
                    .allowsHitTesting(!animating && settledThreeD)
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
                        a3d: a3d,
                        appearance: appearance,
                        plateTilt: tilt
                    )
                } else if settledThreeD {
                    threeCanvas(grid: grid, camera: camera, appearance: appearance)
                } else {
                    flatCanvas(
                        grid: grid,
                        scale: displayedScale(at: now),
                        offset: displayedOffset(at: now),
                        appearance: appearance
                    )
                }

                if model.isProcessing {
                    ProgressView()
                        .tint(BeadTheme.primary)
                        .padding(16)
                        .background(.thinMaterial, in: Circle())
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(BeadTheme.viewport)
            .clipShape(RoundedRectangle(cornerRadius: BeadRadius.lg, style: .continuous))
            // 全项目唯一一处投影：作品压在台面上的那点重量。
            .beadProductShadow()
            // 落笔放大镜浮在作品上（在裁剪之后，允许轻微越出预览框边缘）。
            .overlay(alignment: .topLeading) { paintLoupeOverlay(in: viewport) }
        }
    }

    /// 放大镜只在落笔时出现（画笔 / 橡皮），取色不需要。
    @ViewBuilder
    private func paintLoupeOverlay(in viewport: CGSize) -> some View {
        if let loupe = paintLoupe, let grid = model.grid {
            BeadPaintLoupe(
                grid: grid,
                rect: model.visibleRect,
                col: loupe.col,
                row: loupe.row,
                touch: loupe.screen,
                viewport: viewport,
                appearance: BeadAppearance(colorScheme)
            )
        }
    }

    /// 画布只吃 `BeadCanvasStyle`：参数滑块（豆宽/限色…）在量化结果回来之前
    /// 不改动它，配合 `.equatable()` 就不会每帧重绘整块画布。
    private var canvasStyle: BeadCanvasStyle { BeadCanvasStyle(model.settings) }

    @ViewBuilder
    private func flatCanvas(
        grid: BeadGrid,
        scale: CGFloat,
        offset: CGSize,
        appearance: BeadAppearance
    ) -> some View {
        BeadPreviewCanvas(
            grid: grid,
            style: canvasStyle,
            rect: model.visibleRect,
            highlightedCode: model.highlightedCode,
            scale: scale,
            offset: offset,
            appearance: appearance,
            // 容器在动的时候，取景由画布按**当帧**容器尺寸现算（见 `BeadPreviewCanvas`）。
            resizing: resizeRef
        )
        .equatable()
        .contentShape(Rectangle())
        .gesture(flatDragGesture)
        .simultaneousGesture(magnifyGesture)
        .simultaneousGesture(singleTapGesture)
        .simultaneousGesture(doubleTapGesture)
    }

    @ViewBuilder
    private func threeCanvas(
        grid: BeadGrid,
        camera: Bead3DCamera,
        appearance: BeadAppearance
    ) -> some View {
        Bead3DCanvas(
            grid: grid,
            style: canvasStyle,
            rect: model.visibleRect,
            camera: camera,
            highlightedCode: model.highlightedCode,
            quality: is3DInteracting ? .interactive : .settled,
            appearance: appearance
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
        // 2D→3D：从正俯视立起来；3D→2D：回到正俯视。
        // 整个升角只在淡入完成之后发生（`tiltProgress`），所以 pitch / yaw / zoom
        // 共用同一个 t：淡入那几帧相机完全不动，两层才严丝合缝地叠在一起。
        let t = easeInOut(tiltProgress(progress))
        var camera = target
        let topPitch = Double.pi / 2
        camera.pitch = topPitch + (target.pitch - topPitch) * t
        camera.yaw = target.yaw * t
        // 起点 zoom 不是 1，而是「正俯视的 3D 与 2D 图层同尺寸」的那个值：
        // 2D 与 3D 的 fit 是两套公式（`min × 0.94` vs `fitFactor(pitch: 0.5, pad: 28)`），
        // 各用各的就会出现交叉淡入时两层一大一小。用 `flatMatchedZoom` 对齐起点，
        // 终点仍是用户相机的 zoom，中间线性过渡，两个方向（含 3D→2D）都成立。
        let matched = flatMatchedZoom(at: date)
        camera.zoom = matched + (target.zoom - matched) * t
        return camera
    }

    /// 2D↔3D 过渡里「立起来」的进度：0 = 正俯视（与 2D 同取景），1 = 用户相机。
    ///
    /// 前 `morphSwapEnd` 是交叉淡入（`canvasStack` 里的 a2d / a3d），这一段相机
    /// **不动**，两层在屏幕上重合；升角从 0.2 走到 0.95，正好在淡入收尾后接管。
    /// 反方向（3D→2D）读同一条曲线：先落回正俯视，最后才淡出 3D。
    private func tiltProgress(_ progress: Double) -> Double {
        stagger(progress, 0.2, 0.95)
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
        alignFlatToFitForMorph()
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

    /// 切模式时把 2D 那层拉回「适配取景」，用换层那段时长做完。
    ///
    /// 2D 被放大 / 平移过时，正俯视的 3D（只有缩放跟着 2D 走，**没有平移**）与它
    /// 在屏幕上不是一个取景：淡入那几帧就成了两张错位的图案，比单纯的换层刺眼
    /// 得多。这里让 2D 平滑地收回适配取景，3D 的 matched zoom 是逐帧读
    /// `displayedScale` 的，两层因此同步收敛，换层结束的瞬间正好严丝合缝。
    /// 本来就贴合时 `delta < 0.5`，不动（大多数情况）。
    private func alignFlatToFitForMorph() {
        guard let target = fitTarget() else { return }
        // 先把正在跑的惯性/适配停在当前画面，否则起点会用动画终点，画面会跳。
        settleTransform()
        startTransformRun(
            toScale: target.scale,
            toOffset: target.offset,
            duration: Self.morphSwapEnd * Self.morphDuration
        )
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

    /// 画布这一帧实际读到的取景：在跑的插值动画 > 静态取景。
    ///
    /// 容器尺寸变化不在这里 —— 屏幕上逐帧那份由画布按**当帧** `size` 现算
    /// （见 `BeadPreviewCanvas`），这里给的是最终尺寸下的值（3D / 过渡层用）。
    private func displayedScale(at date: Date) -> CGFloat {
        if let run = transformRun {
            return run.fromScale + (run.toScale - run.fromScale) * runProgress(run, at: date)
        }
        return scale
    }

    private func displayedOffset(at date: Date) -> CGSize {
        if let run = transformRun {
            let t = runProgress(run, at: date)
            return CGSize(
                width: run.fromOffset.width + (run.toOffset.width - run.fromOffset.width) * t,
                height: run.fromOffset.height + (run.toOffset.height - run.fromOffset.height) * t
            )
        }
        return offset
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

    /// 新手势 / 新动画开始时，把在跑的动画停在当前画面，避免「跳回终点再跟手」。
    ///
    /// 尺寸变化也要一起收：它没有自己的时间轴（见 `Bead2DResize`），但基准是按旧容器
    /// 记的，用户一上手就得先「落库」成新容器的取景，手势的起点才是画面上这一帧。
    private func settleTransform() {
        if resizeRef != nil {
            if let settled = framing(in: viewSize) {
                scale = settled.scale
                offset = settled.offset
                committedOffset = settled.offset
            }
            resizeRef = nil
            resizeTask?.cancel()
            resizeTask = nil
            // 尺寸已经变了，缩放下限跟着刷新，手势后的夹取才对得上。
            _ = fitTarget()
        }
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
                    updatePaintLoupe(at: value.location)
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
                    paintLoupe = nil
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
                    paintLoupe = nil
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
                        model.showHint("取色：%@".loc(code))
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

    /// 落笔位置 → 放大镜锚点（格坐标 + 手指在预览框里的位置）。
    ///
    /// 只认落在可见区域内的点：手指滑出板外时放大镜收起，而不是停在上一格。
    private func updatePaintLoupe(at location: CGPoint) {
        let content = contentPoint(location)
        let col = Int(floor(content.x))
        let row = Int(floor(content.y))
        guard model.visibleRect.contains(x: col, y: row) else {
            paintLoupe = nil
            return
        }
        paintLoupe = PaintLoupe(col: col, row: row, screen: location)
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

    /// 位移夹取（口径见 `Bead2DFraming.clamped`）。
    ///
    /// `viewport` 默认是当前容器尺寸。
    private func clampedOffset(
        _ value: CGSize,
        scale: CGFloat,
        in viewport: CGSize? = nil
    ) -> CGSize {
        Bead2DFraming.clamped(
            value,
            scale: scale,
            rect: model.visibleRect,
            in: viewport ?? viewSize
        )
    }

    /// 「完整可见」的取景（纯函数：只按给定容器尺寸算，不写任何状态）。
    private func fit(in viewport: CGSize) -> (scale: CGFloat, offset: CGSize)? {
        guard model.grid != nil else { return nil }
        return Bead2DFraming.fit(rect: model.visibleRect, in: viewport)
    }

    /// 「完整可见」的取景落点（顺带刷新 `fittedScale` 这个缩放下限），不改动画状态。
    private func fitTarget() -> (scale: CGFloat, offset: CGSize)? {
        guard let target = fit(in: viewSize) else { return nil }
        fittedScale = target.scale
        return target
    }

    // MARK: - 参数重算后的取景

    /// 按**当前**格子把画面上的取景归一化成 `zoomRatio` + `focus`（见 `FramingSnapshot`）。
    private func normalizedFraming(forFit fitScale: CGFloat) -> FramingSnapshot? {
        guard viewSize.width > 1, viewSize.height > 1, fitScale > 0 else { return nil }
        let content = contentSize(atScale: scale)
        guard content.width > 0, content.height > 0 else { return nil }
        return FramingSnapshot(
            zoomRatio: max(1, scale / fitScale),
            focus: CGPoint(
                x: (viewSize.width / 2 - offset.width) / content.width,
                y: (viewSize.height / 2 - offset.height) / content.height
            )
        )
    }

    /// 记一份「重算前」的取景参照 —— 量化开始那一下调，那时旧格子还在。
    ///
    /// 参考的「完整可见」缩放现算（`fit(in:)`）而不是读 `fittedScale`：算出来的就是
    /// 旧内容的真实下限，不会因为别处漏刷而把比例算歪。
    private func snapshotFraming() {
        guard let fit = fit(in: viewSize) else { return }
        framingRef = normalizedFraming(forFit: fit.scale)
    }

    /// 参数重算（豆宽 / 限色 / 合并 / 抖动 / 去背景…）完成后，把用户的取景搬到新
    /// 格子上，**不复位**。
    ///
    /// 这些改动只是把格子重算一遍，用户没要求复位。但格子尺寸可能变了（豆宽直接
    /// 决定豆数），`scale` 不能照搬 —— 照搬的话「一格 16pt」不变，整张图就跟着豆数
    /// 一起涨缩。所以沿用参照里那两个与豆数无关的量：
    ///
    /// - `zoomRatio`：屏幕上的内容大小不变（放大几倍还是几倍）；
    /// - `focus`：画面中心对着的还是照片的同一块地方。
    ///
    /// 完整可见态（`zoomRatio == 1`）下这条规则正好退化成「重新适配、居中」——
    /// 看起来什么都没变，只是图案变密/变疏了。应用完再按新格子归一化一份，连续改
    /// 参数（前一次还没算完又改了）也不会退化成「照搬 scale」。
    private func keepFraming() {
        // 在跑的惯性/适配先停在当前画面：算新取景要用「画面上」这一帧的状态。
        settleTransform()
        guard let fit = fit(in: viewSize) else { return }
        fittedScale = fit.scale

        guard let ref = framingRef else {
            // 没记到参照（量化快得在同一轮更新里就跑完）：至少别复位 ——
            // 缩放与位置照旧，只按新内容重新夹取。
            scale = max(scale, fit.scale)
            offset = clampedOffset(offset, scale: scale)
            committedOffset = offset
            framingRef = normalizedFraming(forFit: fit.scale)
            return
        }

        let newScale = max(fit.scale, ref.zoomRatio * fit.scale)
        let content = contentSize(atScale: newScale)
        scale = newScale
        offset = clampedOffset(
            CGSize(
                width: viewSize.width / 2 - ref.focus.x * content.width,
                height: viewSize.height / 2 - ref.focus.y * content.height
            ),
            scale: newScale
        )
        committedOffset = offset
        framingRef = normalizedFraming(forFit: fit.scale)
    }

    private func fit(animated: Bool) {
        // 显式适配（换图 / 复位 / 翻板）会重置取景，尺寸变化这一串就此结束：
        // 它的基准、锚点都是按旧取景算的，留着会算错位置。
        resizeRef = nil
        resizeTask?.cancel()
        resizeTask = nil

        guard let target = fitTarget() else { return }
        // 取景参照跟着落到「完整可见、居中」：万一此刻正好有一次参数重算在算，
        // 它落下来时按这份参照搬取景，就不会把这次复位又顶回去。
        framingRef = FramingSnapshot(zoomRatio: 1, focus: CGPoint(x: 0.5, y: 0.5))

        if animated, scale > 0 {
            startTransformRun(toScale: target.scale, toOffset: target.offset, duration: 0.35)
        } else {
            cancelTransformRun()
            scale = target.scale
            offset = target.offset
            committedOffset = target.offset
        }
    }

    // MARK: - 容器尺寸变化

    /// 预览区高度会跟着「更多」面板、编辑条、切 3D 变，图像得跟着容器一起变，
    /// 但**不能重置用户的取景**（规则见 `Bead2DResize`）。
    ///
    /// 这里用的是**容器最终尺寸**（`viewSize`）：手势、夹取、落库都按它算。
    /// 屏幕上逐帧的那份由画布自己按当帧 `size` 现算（见 `BeadPreviewCanvas`），
    /// 两边共用 `Bead2DFraming` / `Bead2DResize` 同一套算法。
    private func framing(in container: CGSize) -> (scale: CGFloat, offset: CGSize)? {
        guard container.width > 1, container.height > 1 else { return nil }
        guard let ref = resizeRef else { return (scale, offset) }
        return ref.framing(rect: model.visibleRect, in: container) ?? (scale, offset)
    }

    /// 容器尺寸变化：记下这一串变化的**基准取景**（起点尺寸下的状态）。
    ///
    /// `proxy.size` 报的是最终尺寸，而且**只在变化开始那一帧报一次**，所以起点状态
    /// 必须此刻就取 —— 之后 `viewSize` 就变成新容器了。
    private func beginResize() {
        guard model.grid != nil else { return }
        let from = viewSize
        guard from.width > 1, from.height > 1 else { return }
        // 上一串还没收口（连续改尺寸）或惯性/适配正在跑：先停在当前画面再重新取基准。
        settleTransform()
        resizeRef = Bead2DResize(
            anchor: contentAnchorRatio(in: from),
            // 判据用**旧容器**的 `fittedScale`：改写它的是 `fitTarget()`，这里还没调。
            followsFit: scale <= fittedScale * 1.001 + 0.001,
            startScale: scale
        )
    }

    /// 布局动画的起跑时刻（`proxy.size` 只在起跑那一帧报一次，收口得按时长等）。
    ///
    /// 拿不到就退回当前时刻：那说明这次尺寸变化不是 `withLayoutAnimation` 发起的
    /// （键盘顶起来的布局变化之类），等满一个时长也无害 —— 期间画面本来就是静止的。
    private func layoutAnimationStart() -> Date {
        guard let startedAt = model.layoutAnimationStartedAt else { return .now }
        let age = Date.now.timeIntervalSince(startedAt)
        return (0...BeadEditorModel.layoutDuration).contains(age) ? startedAt : .now
    }

    /// 尺寸动画结束后把这一帧的取景落库（`scale` / `offset` 从此就是新容器的取景）。
    private func scheduleResizeCommit() {
        let elapsed = Date.now.timeIntervalSince(layoutAnimationStart())
        let remaining = max(0.02, BeadEditorModel.layoutDuration - elapsed)
        resizeTask?.cancel()
        resizeTask = Task { @MainActor in
            try? await Task.sleep(for: .seconds(remaining))
            guard !Task.isCancelled else { return }
            commitResize()
        }
    }

    private func commitResize() {
        guard resizeRef != nil else { return }
        // 落库的就是画面上最后那一帧的值（同一个纯函数，容器 = 最终尺寸）。
        if let settled = framing(in: viewSize) {
            scale = settled.scale
            offset = settled.offset
            committedOffset = settled.offset
        }
        resizeRef = nil
        resizeTask = nil
        // 刷新缩放下限与「完整可见」口径，手势随后要用。
        //
        // 这里不刷新取景参照：容器动画可能与一次参数重算重叠，那一刻的格子和参照
        // 未必同代。参照只在「量化开始」「显式适配」和 keepFraming 应用完时刷新。
        _ = fitTarget()
    }

    /// 内容中心在容器里的比例（0.5 = 居中）。
    private func contentAnchorRatio(in container: CGSize) -> CGPoint {
        guard container.width > 1, container.height > 1 else { return CGPoint(x: 0.5, y: 0.5) }
        let content = displayedContentSize()
        return CGPoint(
            x: (offset.width + content.width / 2) / container.width,
            y: (offset.height + content.height / 2) / container.height
        )
    }

    /// 指定缩放下的内容像素尺寸（pt）。
    private func contentSize(atScale scale: CGFloat) -> CGSize {
        let rect = model.visibleRect
        let cell = BeadPreviewCanvas.contentCell * scale
        return CGSize(width: CGFloat(rect.width) * cell, height: CGFloat(rect.height) * cell)
    }

    /// 当前缩放下的内容像素尺寸（pt）。
    private func displayedContentSize() -> CGSize {
        contentSize(atScale: scale)
    }

    /// 在「没有动画」的事务里改状态。    ///
    /// 画布的不透明度 / 相机都是由 `TimelineView` 手动插值的，任何从外面继承进来
    /// 的 SwiftUI 动画都会在我们的插值之上再补一层（表现为闪一下或抖一下）。
    private func withoutAnimation(_ body: () -> Void) {
        var transaction = Transaction()
        transaction.disablesAnimations = true
        withTransaction(transaction, body)
    }
}
