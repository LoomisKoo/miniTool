import CoreGraphics
import Observation
import SwiftUI

/// 手绘工具。
enum EditTool: String, CaseIterable, Identifiable {
    case brush
    case eraser
    case dropper

    var id: String { rawValue }

    var label: String {
        switch self {
        case .brush: "画笔"
        case .eraser: "橡皮"
        case .dropper: "取色"
        }
    }

    var hint: String {
        switch self {
        case .brush: "画笔：单指点涂 · 双指缩放/平移"
        case .eraser: "橡皮：擦回自动生成色"
        case .dropper: "取色：点一下吸取格内豆色"
        }
    }
}

/// 视图模式。
enum BeadViewMode: Equatable {
    case flat
    case threeD
}

/// 单格的改动（一笔里的一个格位）。
private struct CellEdit {
    let index: Int
    let previous: BeadCell
    let current: BeadCell
}

/// 一次可撤销的操作（一笔或一次清空）。
private struct EditOp {
    let edits: [CellEdit]
    let cellCount: Int
}

/// 载入作品后待贴回的手绘。
///
/// 尺寸与色卡用来判断参数是否已被改过：对不上就说明这份手绘已经失效，宁愿丢掉也不贴歪。
private struct PendingHandEdits {
    let width: Int
    let height: Int
    let paletteId: String
    let edits: [BeadHandEdit]
}

/// 编辑页状态机：源图 → 量化 → 手绘 → 预览 → 导出。
@MainActor
@Observable
final class BeadEditorModel {

    var settings: BeadSettings {
        didSet {
            guard settings != oldValue else { return }
            scheduleSave()
            if settings.quantizationSignature != oldValue.quantizationSignature {
                scheduleRegenerate()
            } else {
                // 拼板规格之类只影响分板与裁切，不用重新量化
                applyLayoutOnlyChanges(from: oldValue)
            }
        }
    }

    /// 未裁切的源图，裁切始终基于它。
    private(set) var originalSourceImage: CGImage?
    
    /// 当前工作图（可能是裁切后的）。
    private(set) var sourceImage: CGImage?
    
    /// 累积裁切区域（相对源图归一化，nil 表示未裁切）。
    private(set) var cropRect: CropRect?
    
    /// 是否显示裁切页面。
    var showingCrop = false
    
    /// 含手绘改动的显示用格子。
    ///
    /// `didSet` 只刷「摘要」那几个缓存标量（是否已有图 / 板数 / 信息行文案）。
    /// 视图读这些标量而不是读 `grid`：`@Observable` 是按属性追踪的，
    /// 只要外层 body 里读了 `grid`，落笔的每一格都会让整个编辑页重新求值。
    private(set) var grid: BeadGrid? {
        didSet {
            // 落笔只改 cells，尺寸没变就别重算摘要（信息行有字符串格式化，很贵）
            let shapeChanged = oldValue?.width != grid?.width
                || oldValue?.height != grid?.height
                || oldValue?.boardSize != grid?.boardSize
                || (oldValue == nil) != (grid == nil)
            if shapeChanged { syncGridSummary() }
        }
    }

    /// 纯自动换算结果，橡皮与「清空手绘」的还原目标。
    private(set) var autoGrid: BeadGrid?
    private(set) var isProcessing = false
    /// 每次量化完成 +1，视图据此重新适配缩放。
    private(set) var generation = 0

    var highlightedCode: String?
    var message: String?

    // MARK: - 作品库

    /// 当前作品；nil 表示这张图还没存过。
    private(set) var project: BeadProject?
    /// 作品名。未保存时是默认名。
    var projectName = "未命名作品"
    /// 载入作品后待贴回的手绘，量化完成时消费掉。
    private var pendingHandEdits: PendingHandEdits?

    // 编辑
    var isEditing = false
    var tool: EditTool = .brush
    private(set) var brushCode: String?
    private(set) var canUndo = false
    private(set) var canRedo = false

    // 视图
    var viewMode: BeadViewMode = .flat
    var camera = Bead3DCamera()
    /// -1 表示全图。
    private(set) var boardIndex = -1

    private var regenTask: Task<Void, Never>?
    private var saveTask: Task<Void, Never>?
    private var undoStack: [EditOp] = []
    private var redoStack: [EditOp] = []
    private var strokeEdits: [CellEdit]?
    private var lastStrokePoint: CGPoint?
    private var previousPaletteId: String?

    /// 用量与颗数缓存：只在格子真的变了（量化完成 / 落笔结束 / 撤销 / 清空）时重算，
    /// 避免视图每次求值都整图扫一遍（这是之前拖动卡顿的主因）。
    private(set) var usage: [(color: PaletteColor, count: Int)] = []
    private(set) var totalBeadCount = 0
    private(set) var usedColorCount = 0

    /// 供视图读取的「格子摘要」，避免视图直接碰 `grid`（见 `grid` 的注释）。
    private(set) var hasGrid = false
    private(set) var boardCount = 1
    private(set) var metaText = "—"

    var palette: BeadPalette { PaletteLibrary.palette(id: settings.paletteId) }

    init() {
        settings = SettingsStore.load()
        previousPaletteId = settings.paletteId
    }

    var canExport: Bool { hasGrid && !isProcessing }

    /// 有源图或正在量化，但格子还没出来：应显示加载态，而不是「选择图片」。
    var isOpeningContent: Bool {
        isProcessing || (originalSourceImage != nil && !hasGrid)
    }

    /// 当前预览区域：某块板，或整幅。
    var visibleRect: GridRect {
        guard let grid else { return GridRect(x0: 0, y0: 0, x1: 0, y1: 0) }
        return grid.rect(forBoard: boardIndex)
    }

    var boardLabel: String {
        guard boardCount > 1 else { return "" }
        return boardIndex < 0 ? "全图" : "\(boardIndex + 1)/\(boardCount)"
    }

    /// 副标题：色卡 + 豆宽（H5 `header-sub`）。
    var headerSubtitle: String {
        guard hasGrid else { return "照片转拼豆色号图纸" }
        return "\(palette.name) · \(settings.beadWidth) 豆宽"
    }

    /// 重算「摘要」（是否已有图 / 板数 / 信息行文案）。
    /// 只在 grid 换掉或用量缓存更新后调用；`metaText` 里的色数与颗数取自缓存。
    private func syncGridSummary() {
        guard let grid else {
            hasGrid = false
            boardCount = 1
            metaText = "—"
            return
        }
        hasGrid = true
        boardCount = grid.boardCount
        let widthCM = Double(grid.width) * 0.5
        let heightCM = Double(grid.height) * 0.5
        metaText = "\(grid.width)×\(grid.height) · \(usedColorCount)色 · \(totalBeadCount)颗 · "
            + "\(widthCM.formatted(.number.precision(.fractionLength(1))))×"
            + "\(heightCM.formatted(.number.precision(.fractionLength(1))))cm · "
            + "\(grid.boardSize)×\(grid.boardSize)拼板 · "
            + "\(grid.boardsX)×\(grid.boardsY)板"
    }

    var brush: PaletteColor? {
        guard let brushCode else { return palette.colors.first }
        return palette.color(for: brushCode)
    }

    /// 用量清单：整幅统计（H5 `counts` 也是整幅），按数量降序。
    /// 用量清单里每个色号的颗数，供画笔/豆色面板标数。
    var usageCounts: [String: Int] {
        var counts: [String: Int] = [:]
        counts.reserveCapacity(usage.count)
        for item in usage {
            counts[item.color.code] = item.count
        }
        return counts
    }

    /// 重算缓存。只在格子内容真的变化后调用，不要放进视图求值路径。
    private func recount() {
        guard let grid else {
            usage = []
            totalBeadCount = 0
            usedColorCount = 0
            syncGridSummary()
            return
        }
        let list = grid.usage(palette: palette)
        usage = list
        usedColorCount = list.count
        totalBeadCount = list.reduce(0) { $0 + $1.count }
        syncGridSummary()
    }

    private func scheduleSave() {
        saveTask?.cancel()
        let snapshot = settings
        saveTask = Task {
            try? await Task.sleep(for: .milliseconds(500))
            guard !Task.isCancelled else { return }
            SettingsStore.save(snapshot)
        }
    }

    func flushPendingSave() {
        saveTask?.cancel()
        saveTask = nil
        SettingsStore.save(settings)
    }

    // MARK: - 载入图片

    func load(image: CGImage) {
        originalSourceImage = image
        sourceImage = image
        cropRect = nil
        // 新图自成一份作品，不复用上一份的名字与手绘
        project = nil
        projectName = "未命名作品"
        pendingHandEdits = nil
        grid = nil
        autoGrid = nil
        highlightedCode = nil
        resetHistory()
        recount()
        boardIndex = -1
        applyAutoSampleMode(for: image)
        showHint("单指拖动平移 · 双指缩放 · 双击放大/复位")
        regenerate()
    }

    /// 打开已保存的作品：源图 + 参数重跑量化，再把手绘贴回去。
    func load(project: BeadProject) {
        guard let image = ProjectStore.shared.image(for: project) else {
            message = "作品源图丢失，无法打开。"
            return
        }
        // 先清干净，避免上一份作品的手绘串进来
        pendingHandEdits = nil
        originalSourceImage = image
        sourceImage = image
        cropRect = nil
        grid = nil
        autoGrid = nil
        highlightedCode = nil
        resetHistory()
        recount()
        boardIndex = -1

        self.project = project
        projectName = project.name
        pendingHandEdits = PendingHandEdits(
            width: project.gridWidth,
            height: project.gridHeight,
            paletteId: project.settings.paletteId,
            edits: project.handEdits
        )
        // 赋值可能触发 debounce 重算；紧接着的 regenerate 会把它取消掉
        settings = project.settings
        regenerate()
    }
    
    // MARK: - 裁切
    
    /// 打开裁切页面。
    func openCrop() {
        guard originalSourceImage != nil else { return }
        showingCrop = true
    }
    
    /// 应用裁切结果（`nil` 表示未修改）。
    func applyCrop(_ output: CropOutput?) {
        guard let output else { return }

        if output.isOriginal {
            guard let original = originalSourceImage, cropRect != nil else { return }
            sourceImage = original
            cropRect = nil
            resetHistory()
            applyAutoSampleMode(for: original)
            regenerate()
            showHint("已还原原图")
            return
        }

        guard originalSourceImage != nil else { return }
        sourceImage = output.image
        cropRect = output.rect
        // 清空手绘历史，因为图片已变化
        resetHistory()
        applyAutoSampleMode(for: output.image)
        regenerate()
        showHint("已应用裁切")
    }

    /// 新图（含裁切后的图）按颜色数自动选采样模式：卡通/插画保描边、照片降色差。
    /// 与 H5 端 `mapImage` 里 `freshImage` 的行为一致。
    private func applyAutoSampleMode(for image: CGImage) {
        let mode = BeadQuantizer.suggestedSampleMode(for: image)
        if settings.sampleMode != mode {
            settings.sampleMode = mode
        }
    }

    /// 保存当前作品（没有就新建，有就覆盖）。
    @discardableResult
    func saveProject(name: String? = nil) -> BeadProject? {
        guard let grid, let sourceImage else { return nil }

        if let name {
            let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
            if !trimmed.isEmpty { projectName = trimmed }
        }

        let isNew = project == nil
        let id = project?.id ?? UUID()
        let value = BeadProject(
            id: id,
            name: projectName,
            createdAt: project?.createdAt ?? Date(),
            updatedAt: Date(),
            imageFile: project?.imageFile ?? "\(id.uuidString).jpg",
            settings: settings,
            handEdits: collectHandEdits(),
            gridWidth: grid.width,
            gridHeight: grid.height
        )

        let saved = ProjectStore.shared.save(
            value,
            sourceImage: sourceImage,
            thumbnail: ImageImport.thumbnail(from: sourceImage)
        )
        project = saved
        projectName = saved.name
        showHint(isNew ? "已保存到作品库" : "已更新作品")
        return saved
    }

    /// 收集手绘改动：与自动结果不同的格位。橡皮擦回自动色的格子不算改动。
    private func collectHandEdits() -> [BeadHandEdit] {
        guard let grid, let autoGrid, grid.cells.count == autoGrid.cells.count else { return [] }
        var edits: [BeadHandEdit] = []
        for index in grid.cells.indices {
            let current = grid.cells[index]
            guard !current.isEmpty, current != autoGrid.cells[index] else { continue }
            edits.append(BeadHandEdit(index: index, code: current.code))
        }
        return edits
    }

    /// 把手绘贴回量化结果。形状或色卡对不上就丢弃（参数已被改过）。
    private func applyPendingHandEdits() {
        guard let pending = pendingHandEdits else { return }
        pendingHandEdits = nil

        guard var value = grid else { return }
        guard pending.width == value.width,
              pending.height == value.height,
              pending.paletteId == settings.paletteId else {
            if !pending.edits.isEmpty { showHint("参数已变，原有手绘未恢复") }
            return
        }

        let palette = self.palette
        var applied = 0
        for edit in pending.edits {
            guard edit.index >= 0, edit.index < value.cells.count,
                  let color = palette.color(for: edit.code) else { continue }
            value.cells[edit.index] = BeadCell(code: color.code, rgb: color.rgb)
            applied += 1
        }
        guard applied > 0 else { return }

        grid = value
        // 载入即是一个还原点，撤销不该撤到"没打开过这张图"的状态
        resetHistory()
        recount()
    }

    func clearImage() {
        regenTask?.cancel()
        sourceImage = nil
        project = nil
        projectName = "未命名作品"
        pendingHandEdits = nil
        grid = nil
        autoGrid = nil
        highlightedCode = nil
        resetHistory()
        recount()
        boardIndex = -1
    }

    // MARK: - 量化

    /// 参数变化时延后重算，避免拖滑块时连续触发。
    private func scheduleRegenerate() {
        regenTask?.cancel()
        regenTask = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(180))
            guard !Task.isCancelled else { return }
            self?.regenerate()
        }
    }

    func regenerate() {
        guard let image = sourceImage else { return }
        let settings = self.settings
        let palette = self.palette

        regenTask?.cancel()
        isProcessing = true

        // 生成前先记录旧状态，用于搬运手绘改动
        let oldGrid = grid
        let oldAuto = autoGrid
        let oldPaletteId = previousPaletteId

        regenTask = Task { [weak self] in
            let result = await Task.detached(priority: .userInitiated) {
                BeadQuantizer.quantize(image: image, settings: settings, palette: palette)
            }.value

            guard !Task.isCancelled, let self else { return }
            self.isProcessing = false
            self.generation += 1

            guard var newGrid = result else {
                self.grid = nil
                self.autoGrid = nil
                self.message = "图片读取失败，换一张试试。"
                return
            }

            // 保留仍然有效的手绘：按格位搬运，色号不在当前色卡则丢弃
            if let oldGrid, let oldAuto {
                newGrid = Self.carryHandEdits(
                    from: oldGrid,
                    auto: oldAuto,
                    to: newGrid,
                    palette: palette
                )
            }
            // 换色卡或豆宽变化后历史格位对不上，清空撤销栈
            if oldGrid == nil
                || oldGrid?.width != newGrid.width
                || oldPaletteId != settings.paletteId {
                self.resetHistory()
            }

            self.grid = newGrid
            self.autoGrid = result
            self.previousPaletteId = settings.paletteId
            self.boardIndex = min(self.boardIndex, newGrid.boardCount - 1)
            self.recount()

            // 打开作品时要贴回手绘；必须在 recount 之后，画笔色才能看到最终用量
            self.applyPendingHandEdits()

            // 画笔色跟随当前色卡；色号不存在时回落到图上最常用色
            if self.brushCode == nil || palette.color(for: self.brushCode!) == nil {
                self.brushCode = self.usage.first?.color.code
            }
        }
    }

    /// 只改了展示层参数（拼板规格、网格、分板线…）时，就地更新分板并保留手绘。
    private func applyLayoutOnlyChanges(from old: BeadSettings) {
        guard grid != nil else { return }

        if settings.boardSize != old.boardSize {
            let size = settings.boardSize
            if var value = grid {
                if value.boardSize != size {
                    value = BeadGrid(
                        width: value.width,
                        height: value.height,
                        boardSize: size,
                        cells: value.cells
                    )
                    grid = value
                }
            }
            if var auto = autoGrid, auto.boardSize != size {
                auto = BeadGrid(
                    width: auto.width,
                    height: auto.height,
                    boardSize: size,
                    cells: auto.cells
                )
                autoGrid = auto
            }
            if let value = grid, boardIndex >= value.boardCount {
                boardIndex = -1
            }
        }
    }

    private static func carryHandEdits(
        from oldGrid: BeadGrid,
        auto oldAuto: BeadGrid,
        to newGrid: BeadGrid,
        palette: BeadPalette
    ) -> BeadGrid {
        var result = newGrid
        let count = min(oldGrid.cells.count, oldAuto.cells.count)
        guard count > 0, oldGrid.width > 0 else { return result }

        for index in 0..<count {
            let current = oldGrid.cells[index]
            guard current != oldAuto.cells[index] else { continue }
            let col = index % oldGrid.width
            let row = index / oldGrid.width
            guard row < result.height, col < result.width else { continue }
            guard let color = palette.color(for: current.code) else { continue }
            result[col, row] = BeadCell(code: color.code, rgb: color.rgb)
        }
        return result
    }

    // MARK: - 手绘

    /// 顶部浮层提示（H5 的 `.view-hint`），短暂显示后自动消失。
    var hint: String?

    private var hintTask: Task<Void, Never>?

    func showHint(_ text: String) {
        hintTask?.cancel()
        hint = text
        hintTask = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(2200))
            guard !Task.isCancelled else { return }
            self?.hint = nil
        }
    }

    // MARK: - 参数开关（对齐 H5 的 chips 行）

    func selectPalette(_ id: String) {
        settings.paletteId = id
        showHint("色卡：\(palette.name)")
    }

    func setBoardSize(_ size: Int) {
        guard size != settings.boardSize else { return }
        settings.boardSize = size
        showHint("拼板 \(size)×\(size) · 共 \(boardCount) 板")
    }

    func toggleGrid() {
        settings.showGrid.toggle()
        showHint(settings.showGrid ? "网格：开" : "网格：关")
    }

    func toggleMerge() {
        settings.mergeSimilar.toggle()
        showHint(settings.mergeSimilar ? "合并邻近相似色：开" : "合并邻近相似色：关")
    }

    func toggleDither() {
        settings.dither.toggle()
        showHint(settings.dither ? "抖动：开" : "抖动：关")
    }

    func toggleAverageSampling() {
        let useAverage = settings.sampleMode != .average
        settings.sampleMode = useAverage ? .average : .dominant
        showHint(useAverage ? "取色：格内均值" : "取色：格内主色")
    }

    func toggleSeam() {
        settings.showSeam.toggle()
        showHint(settings.showSeam ? "分板线：开" : "分板线：关")
    }

    func setBrush(_ code: String) {
        guard palette.color(for: code) != nil else { return }
        brushCode = code
        tool = .brush
    }

    /// 进入/退出编辑。进入时清掉高亮，避免看不清真实颜色。
    func setEditing(_ on: Bool) {
        guard on == false || grid != nil else { return }
        isEditing = on
        if on {
            if brushCode == nil {
                brushCode = usage.first?.color.code
            }
            highlightedCode = nil
            tool = .brush
        }
        showHint(on ? EditTool.brush.hint : "已退出编辑")
    }

    func setTool(_ newTool: EditTool) {
        tool = newTool
        showHint(newTool.hint)
    }

    /// 一笔开始。`point` 为内容坐标（单位：格，可为小数）。
    func beginStroke(at point: CGPoint) {
        guard canPaint else { return }
        strokeEdits = []
        lastStrokePoint = point
        paintSegment(from: point, to: point)
    }

    func extendStroke(to point: CGPoint) {
        guard canPaint, let last = lastStrokePoint else { return }
        paintSegment(from: last, to: point)
        lastStrokePoint = point
    }

    /// `commit = false` 用于双指缩放打断落笔时回滚整笔。
    func endStroke(commit: Bool) {
        guard let edits = strokeEdits else { return }
        strokeEdits = nil
        lastStrokePoint = nil
        guard !edits.isEmpty else {
            // 落笔没改动任何格（点在空格/同色），也要刷新一次统计
            recount()
            return
        }

        if !commit {
            apply(edits, forward: false)
        } else {
            pushUndo(EditOp(edits: edits, cellCount: grid?.cells.count ?? 0))
            recount()
        }
    }

    /// 取色：命中则吸取该格色号并切回画笔。
    func pickColor(at point: CGPoint) -> String? {
        guard let grid else { return nil }
        let col = Int(floor(point.x))
        let row = Int(floor(point.y))
        guard visibleRect.contains(x: col, y: row) else { return nil }
        let cell = grid[col, row]
        guard !cell.isEmpty else { return nil }
        brushCode = cell.code
        tool = .brush
        return cell.code
    }

    private var canPaint: Bool {
        isEditing && viewMode == .flat && (tool == .brush || tool == .eraser) && grid != nil
    }

    /// 在两点之间按半格步长密集落笔，快速滑动不断线、越界自动裁掉。
    private func paintSegment(from start: CGPoint, to end: CGPoint) {
        let dx = end.x - start.x
        let dy = end.y - start.y
        let distance = (dx * dx + dy * dy).squareRoot()
        let steps = max(1, Int(ceil(distance / 0.5)))

        for step in 0...steps {
            let t = Double(step) / Double(steps)
            paintCell(at: CGPoint(x: start.x + dx * t, y: start.y + dy * t))
        }
    }

    private func paintCell(at point: CGPoint) {
        guard let grid, let autoGrid else { return }
        let col = Int(floor(point.x))
        let row = Int(floor(point.y))
        guard visibleRect.contains(x: col, y: row) else { return }

        let index = row * grid.width + col
        let target: BeadCell
        switch tool {
        case .brush:
            guard let color = brush else { return }
            target = BeadCell(code: color.code, rgb: color.rgb)
        case .eraser:
            target = autoGrid.cells[index]
        case .dropper:
            return
        }

        let previous = grid.cells[index]
        guard previous != target else { return }
        strokeEdits?.append(CellEdit(index: index, previous: previous, current: target))
        // 走 `_modify` 就地在原缓冲上改，避免逐格复制整个数组
        self.grid?.cells[index] = target
    }

    private func apply(_ edits: [CellEdit], forward: Bool) {
        guard var value = grid else { return }
        for edit in edits {
            guard edit.index < value.cells.count else { continue }
            value.cells[edit.index] = forward ? edit.current : edit.previous
        }
        grid = value
        recount()
    }

    var autoBeadCount: Int { autoGrid?.beadCount ?? 0 }

    func clearHandEdits() {
        guard var value = grid, let autoGrid else { return }
        var edits: [CellEdit] = []
        for index in value.cells.indices {
            let want = autoGrid.cells[index]
            guard value.cells[index] != want else { continue }
            edits.append(CellEdit(index: index, previous: value.cells[index], current: want))
        }
        guard !edits.isEmpty else {
            showHint("当前没有手绘改动")
            return
        }
        for edit in edits {
            value.cells[edit.index] = edit.current
        }
        grid = value
        pushUndo(EditOp(edits: edits, cellCount: value.cells.count))
        recount()
        showHint("已清空手绘（可撤销）")
    }

    func undo() {
        guard let op = undoStack.last, let value = grid, op.cellCount == value.cells.count else {
            resetHistory()
            return
        }
        undoStack.removeLast()
        apply(op.edits, forward: false)
        redoStack.append(op)
        syncHistoryFlags()
    }

    func redo() {
        guard let op = redoStack.last, let value = grid, op.cellCount == value.cells.count else {
            resetHistory()
            return
        }
        redoStack.removeLast()
        apply(op.edits, forward: true)
        undoStack.append(op)
        syncHistoryFlags()
    }

    private func pushUndo(_ op: EditOp) {
        guard !op.edits.isEmpty else { return }
        undoStack.append(op)
        if undoStack.count > 60 { undoStack.removeFirst() }
        redoStack.removeAll()
        syncHistoryFlags()
    }

    private func resetHistory() {
        undoStack.removeAll()
        redoStack.removeAll()
        syncHistoryFlags()
    }

    private func syncHistoryFlags() {
        canUndo = !undoStack.isEmpty
        canRedo = !redoStack.isEmpty
    }

    // MARK: - 分板

    /// 与 H5 一致：全图 ↔ 首/末板循环切换。
    func previousBoard() {
        let total = boardCount
        if total <= 1 {
            boardIndex = -1
        } else if boardIndex < 0 {
            boardIndex = total - 1
        } else if boardIndex == 0 {
            boardIndex = -1
        } else {
            boardIndex -= 1
        }
        highlightedCode = nil
    }

    func nextBoard() {
        let total = boardCount
        if total <= 1 {
            boardIndex = -1
        } else if boardIndex < 0 {
            boardIndex = 0
        } else if boardIndex >= total - 1 {
            boardIndex = -1
        } else {
            boardIndex += 1
        }
        highlightedCode = nil
    }

    func showAllBoards() {
        boardIndex = -1
        highlightedCode = nil
    }

    // MARK: - 3D

    func toggleViewMode() {
        viewMode = viewMode == .flat ? .threeD : .flat
        if viewMode == .threeD {
            isEditing = false
        }
    }

    func resetCamera() {
        camera = Bead3DCamera()
    }

    /// 直接落一个相机值（会夹到 `pitchRange` / `zoomRange`）。
    ///
    /// 3D 手势与相机动画都走这里，避免各处各自 `next.clamped` 漏掉夹取；
    /// 与 `@Published` 的 `camera` 赋值在同一处，也便于以后加节流。
    func setCamera(_ camera: Bead3DCamera) {
        self.camera = camera.clamped
    }

    /// 单指拖动旋转相机。方向与 H5 保持一致：右拖 yaw 减小、下拖 pitch 增大（更俯视）。
    ///
    /// 注意手势那边**不用**这个逐帧增量接口，而是用手势起点记下的基准相机 +
    /// 累计位移算绝对位置（见 `BeadPreviewPane.rotated(_:by:)`）：增量一旦被
    /// 打断就会残留偏差。这里保留给需要按帧步进的场景。
    func rotateCamera(deltaX: Double, deltaY: Double) {
        var next = camera
        next.yaw -= deltaX * 0.012
        next.pitch += deltaY * 0.008
        camera = next.clamped
    }

    func zoomCamera(factor: Double) {
        var next = camera
        next.zoom *= factor
        camera = next.clamped
    }

    func setZoom(_ zoom: Double) {
        var next = camera
        next.zoom = zoom
        camera = next.clamped
    }

    // MARK: - 导出

    /// 分板导出时返回多张，整幅时返回一张。
    func makeArtworks() -> [UIImage] {
        guard let grid else { return [] }
        if settings.export.boardScope == .each, grid.boardCount > 1 {
            return (0..<grid.boardCount).compactMap { index in
                let rect = grid.rect(forBoard: index)
                return BeadArtworkRenderer.render(
                    grid: grid,
                    palette: palette,
                    settings: settings,
                    rect: rect,
                    boardLabel: "第\(index + 1)板"
                )
            }
        }
        let index = boardIndex
        return [BeadArtworkRenderer.render(
            grid: grid,
            palette: palette,
            settings: settings,
            rect: grid.rect(forBoard: index),
            boardLabel: index < 0 ? "全图" : "第\(index + 1)板"
        )].compactMap { $0 }
    }

    func saveArtwork() async {
        let images = makeArtworks()
        guard !images.isEmpty else {
            message = "图纸尺寸过大，把豆宽调小或改用分板导出再试。"
            return
        }
        do {
            for image in images {
                try await PhotoLibrary.save(image)
            }
            message = images.count > 1 ? "已保存 \(images.count) 张分板图纸到相册" : "图纸已保存到相册"
        } catch {
            message = error.localizedDescription
        }
    }
}
