import Foundation
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
        case .brush: "画笔".loc
        case .eraser: "橡皮".loc
        case .dropper: "取色".loc
        }
    }

    var hint: String {
        switch self {
        case .brush: "画笔：单指点涂 · 双指缩放/平移".loc
        case .eraser: "橡皮：擦回自动生成色".loc
        case .dropper: "取色：点一下吸色，按住拖动可连续吸".loc
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
            guard !suppressSettingsEffects else { return }
            guard settings != oldValue else { return }
            scheduleSave()
            if settings.removeBackground != oldValue.removeBackground {
                Task { await refreshWorkingImage() }
                return
            }
            if settings.quantizationSignature != oldValue.quantizationSignature {
                scheduleRegenerate()
            } else {
                // 拼板规格之类只影响分板与裁切，不用重新量化
                applyLayoutOnlyChanges(from: oldValue)
            }
        }
    }

    /// 载入作品时临时关掉 settings 副作用，避免和后面的一次 refresh 打架。
    private var suppressSettingsEffects = false

    /// 未裁切的源图，裁切始终基于它。
    private(set) var originalSourceImage: CGImage?

    /// 裁切后、去背景前的工作底图。
    private var baseImage: CGImage?

    /// 当前工作图（可能是裁切 / 去背景后的）。
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
    /// 每次量化完成 +1。**参数重算不算「换内容」**：预览区读到它只会把取景搬到新
    /// 格子上（保留用户的缩放与位置），不复位。
    private(set) var generation = 0

    /// 内容被整体换掉（裁切 / 换图 / 打开作品）时 +1。
    ///
    /// 与 `boardResetToken` 分开是因为时机不同：这时新格子还没算出来，不能立刻复位
    /// （会先按旧图复位一次），得等 `generation` 变化时再复位（见
    /// `BeadPreviewPane` 里的 `pendingRefit`）。
    private(set) var contentResetToken = 0

    /// 可见区域自己变了（翻板 / 切全图 / 换拼板规格）时 +1：预览区立刻重新适配。
    private(set) var boardResetToken = 0

    var highlightedCode: String?
    var message: String?

    /// 提示里是否要额外给一个「去解锁」入口。
    /// 不能再用 `message.contains("解锁 Pro")` 判断：本地化之后文案里没有这四个字了。
    private(set) var messageOffersPro = false

    /// 统一的提示入口。`offersPro` 决定弹窗里给不给「去解锁」。
    func showMessage(_ text: String, offersPro: Bool = false) {
        message = text
        messageOffersPro = offersPro
    }

    // MARK: - 作品库

    /// 当前作品；nil 表示这张图还没存过。
    private(set) var project: BeadProject?
    /// 作品名。未保存时是默认名。
    var projectName = "未命名作品".loc
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
    /// 量化代数：被取消的旧任务不得清 `isProcessing`，也不能写回结果。
    private var regenSerial = 0
    /// 刷新工作图代数：避免去背景并发互相覆盖。
    private var refreshSerial = 0
    private var saveTask: Task<Void, Never>?
    private var draftSaveTask: Task<Void, Never>?
    private var didRestoreDraft = false
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

    var palette: BeadPalette {
        let full = PaletteLibrary.palette(id: settings.paletteId)
        guard effectiveUseOwnedOnly else { return full }
        return ownedPalette(from: full) ?? full
    }

    /// Pro 且开启豆库限色时才真限色。
    private var effectiveUseOwnedOnly: Bool {
        settings.useOwnedOnly && EntitlementStore.shared.isPro
    }

    /// Pro 且开启去背景时才抠图。
    private var effectiveRemoveBackground: Bool {
        settings.removeBackground && EntitlementStore.shared.isPro
    }

    private func ownedPalette(from full: BeadPalette) -> BeadPalette? {
        InventoryStore.shared.loadIfNeeded()
        let owned = InventoryStore.shared.owned(palette: full.id)
        guard !owned.isEmpty else { return nil }
        return BeadPalette(
            id: full.id,
            name: "%@ · 豆库".loc(full.name),
            colors: owned.map(\.color)
        )
    }

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
        return boardIndex < 0 ? "全图".loc : "\(boardIndex + 1)/\(boardCount)"
    }

    /// 副标题：色卡 + 豆宽（H5 `header-sub`）。
    var headerSubtitle: String {
        guard hasGrid else { return "照片转拼豆色号图纸".loc }
        return "%@ · %ld 豆宽".loc(palette.name, settings.beadWidth)
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
        metaText = "%ld×%ld · %ld色 · %ld颗 · %@×%@cm · %ld×%ld拼板 · %ld×%ld板".loc(
            grid.width, grid.height, usedColorCount, totalBeadCount,
            widthCM.formatted(.number.precision(.fractionLength(1))),
            heightCM.formatted(.number.precision(.fractionLength(1))),
            grid.boardSize, grid.boardSize, grid.boardsX, grid.boardsY
        )
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
        scheduleDraftSave()
    }

    private func scheduleDraftSave() {
        draftSaveTask?.cancel()
        draftSaveTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(2))
            guard !Task.isCancelled, let self, let image = self.baseImage else { return }
            ProjectStore.shared.saveDraft(sourceImage: image, settings: self.settings)
        }
    }

    /// 恢复上次未显式保存的拼豆图草稿。
    func restoreDraftIfNeeded() {
        guard !didRestoreDraft, originalSourceImage == nil,
              let draft = ProjectStore.shared.loadDraft() else { return }
        didRestoreDraft = true
        suppressSettingsEffects = true
        settings = draft.settings
        suppressSettingsEffects = false
        load(image: draft.image)
    }

    func flushPendingSave() {
        saveTask?.cancel()
        saveTask = nil
        SettingsStore.save(settings)
        draftSaveTask?.cancel()
        if let image = baseImage {
            ProjectStore.shared.saveDraft(sourceImage: image, settings: settings)
        }
    }

    // MARK: - 载入图片

    func load(image: CGImage) {
        originalSourceImage = image
        baseImage = image
        sourceImage = image
        cropRect = nil
        // 新图自成一份作品，不复用上一份的名字与手绘
        project = nil
        projectName = "未命名作品".loc
        pendingHandEdits = nil
        grid = nil
        autoGrid = nil
        highlightedCode = nil
        resetHistory()
        recount()
        boardIndex = -1
        applyAutoSampleMode(for: image)
        showHint("单指拖动平移 · 双指缩放 · 双击放大/复位".loc)
        Task { await refreshWorkingImage() }
    }

    /// 打开已保存的作品：源图 + 参数重跑量化，再把手绘贴回去。
    func load(project: BeadProject) {
        guard let image = ProjectStore.shared.image(for: project) else {
            showMessage("作品源图丢失，无法打开。".loc)
            return
        }
        // 先清干净，避免上一份作品的手绘串进来
        pendingHandEdits = nil
        originalSourceImage = image
        baseImage = image
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
        // 只赋参数，不顺带触发 debounce 重算 / 去背景；下面统一 refresh 一次。
        suppressSettingsEffects = true
        settings = project.settings
        suppressSettingsEffects = false
        previousPaletteId = settings.paletteId
        Task { await refreshWorkingImage() }
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
            baseImage = original
            cropRect = nil
            resetHistory()
            applyAutoSampleMode(for: original)
            contentResetToken += 1
            Task { await refreshWorkingImage() }
            showHint("已还原原图".loc)
            return
        }

        guard originalSourceImage != nil else { return }
        baseImage = output.image
        cropRect = output.rect
        // 清空手绘历史，因为图片已变化
        resetHistory()
        applyAutoSampleMode(for: output.image)
        contentResetToken += 1
        Task { await refreshWorkingImage() }
        showHint("已应用裁切".loc)
    }

    /// 按当前开关刷新工作图（去背景），再量化。
    private func refreshWorkingImage() async {
        guard let base = baseImage else { return }
        refreshSerial += 1
        let serial = refreshSerial
        regenTask?.cancel()

        if effectiveRemoveBackground {
            isProcessing = true
            do {
                let removed = try await ImageImport.removeBackground(from: base)
                guard serial == refreshSerial else { return }
                sourceImage = removed
            } catch {
                guard serial == refreshSerial else { return }
                sourceImage = base
                if settings.removeBackground {
                    settings.removeBackground = false
                }
                showMessage(error.localizedDescription)
                isProcessing = false
                return
            }
        } else {
            sourceImage = base
        }
        guard serial == refreshSerial else { return }
        regenerate()
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

        let isNew = project == nil
        if isNew, !ProjectStore.shared.canCreate {
            EntitlementStore.shared.requestPaywall()
            return nil
        }

        if let name {
            let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
            if !trimmed.isEmpty { projectName = trimmed }
        }

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

        // 作品存底图（裁切后），不要存去背景后的透明图，方便以后关掉去背景还能还原
        let persistImage = baseImage ?? sourceImage
        let saved = ProjectStore.shared.save(
            value,
            sourceImage: persistImage,
            thumbnail: ImageImport.thumbnail(from: persistImage)
        )
        project = saved
        projectName = saved.name
        showHint("保存成功".loc)
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
            if !pending.edits.isEmpty { showHint("参数已变，原有手绘未恢复".loc) }
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
        originalSourceImage = nil
        baseImage = nil
        sourceImage = nil
        cropRect = nil
        project = nil
        projectName = "未命名作品".loc
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

        if settings.useOwnedOnly, EntitlementStore.shared.isPro,
           ownedPalette(from: PaletteLibrary.palette(id: settings.paletteId)) == nil {
            showMessage("请先在「我的」登记手头色号，再开豆库限色。".loc)
            return
        }

        let palette = self.palette

        regenTask?.cancel()
        regenSerial += 1
        let serial = regenSerial
        isProcessing = true

        // 生成前先记录旧状态，用于搬运手绘改动
        let oldGrid = grid
        let oldAuto = autoGrid
        let oldPaletteId = previousPaletteId

        regenTask = Task { [weak self] in
            let result = await Task.detached(priority: .userInitiated) {
                BeadQuantizer.quantize(image: image, settings: settings, palette: palette)
            }.value

            guard let self else { return }
            // 已被更新的 regenerate 取代：不要动 isProcessing / grid
            guard serial == self.regenSerial else { return }
            self.isProcessing = false
            self.generation += 1

            guard var newGrid = result else {
                self.grid = nil
                self.autoGrid = nil
                showMessage("图片读取失败，换一张试试。".loc)
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
            self.scheduleDraftSave()
        }
    }

    /// 只改了展示层参数（拼板规格、网格、分板线…）时，就地更新分板并保留手绘。
    private func applyLayoutOnlyChanges(from old: BeadSettings) {
        guard grid != nil else { return }

        if settings.boardSize != old.boardSize {
            let before = boardIndex
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
            // 单板视图下这块板的取景随分板方式一起变（全图时可见区域没变，不复位）。
            if boardIndex >= 0 || boardIndex != before { boardResetToken += 1 }
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
            try? await Task.sleep(for: .milliseconds(2600))
            guard !Task.isCancelled else { return }
            self?.hint = nil
        }
    }

    // MARK: - 参数开关（对齐 H5 的 chips 行）

    func selectPalette(_ id: String) {
        settings.paletteId = id
        showHint("色卡：%@".loc(palette.name))
    }

    func setBoardSize(_ size: Int) {
        guard size != settings.boardSize else { return }
        settings.boardSize = size
        showHint("拼板 %ld×%ld · 共 %ld 板".loc(size, size, boardCount))
    }

    func toggleGrid() {
        settings.showGrid.toggle()
        showHint(settings.showGrid ? "网格：开".loc : "网格：关".loc)
    }

    func toggleMerge() {
        settings.mergeSimilar.toggle()
        showHint(settings.mergeSimilar ? "合并邻近相似色：开".loc : "合并邻近相似色：关".loc)
    }

    func toggleDither() {
        settings.dither.toggle()
        showHint(settings.dither ? "抖动：开".loc : "抖动：关".loc)
    }

    func toggleAverageSampling() {
        let useAverage = settings.sampleMode != .average
        settings.sampleMode = useAverage ? .average : .dominant
        showHint(useAverage ? "取色：格内均值".loc : "取色：格内主色".loc)
    }

    func toggleSeam() {
        settings.showSeam.toggle()
        showHint(settings.showSeam ? "分板线：开".loc : "分板线：关".loc)
    }

    /// 豆库限色（Pro）。开启后只在已登记色号里量化。
    func toggleOwnedOnly() {
        if !settings.useOwnedOnly {
            guard EntitlementStore.shared.requirePro() else { return }
            InventoryStore.shared.loadIfNeeded()
            guard InventoryStore.shared.ownedCount(palette: settings.paletteId) > 0 else {
                showMessage("请先在「我的」登记手头色号，再开豆库限色。".loc)
                return
            }
        }
        settings.useOwnedOnly.toggle()
        showHint(settings.useOwnedOnly ? "豆库限色：开".loc : "豆库限色：关".loc)
    }

    /// 去背景（Pro）。白底/杂景变透明，不铺豆。
    func toggleRemoveBackground() {
        if !settings.removeBackground {
            guard EntitlementStore.shared.requirePro() else { return }
            guard baseImage != nil || sourceImage != nil else { return }
        }
        settings.removeBackground.toggle()
        showHint(settings.removeBackground ? "去背景：开".loc : "去背景：关".loc)
    }

    func setBrush(_ code: String) {
        guard palette.color(for: code) != nil else { return }
        brushCode = code
        tool = .brush
    }

    /// 进入/退出编辑。进入时清掉高亮，避免看不清真实颜色。
    ///
    /// 只能在 2D 编辑：3D 下进编辑会先切回平面；切 3D 见 `toggleViewMode` 会清掉编辑态。
    ///
    /// 用 `withAnimation` 包住：进编辑会顺带切回 2D（预览区换一层），页面本身也会换
    /// （生成页与 `BeadEditView` 之间换），不包的话这一帧会跳一下。
    ///
    /// **只在进入时给一条工具提示，退出不提示**（见下面的 `else` 分支）。
    /// 退出**不**走布局动画：生成页布局并不随 `isEditing` 变，带动画反而会在退栈时
    /// 让底下预览多跳一帧。
    func setEditing(_ on: Bool) {
        guard on == false || grid != nil else { return }
        if on {
            withLayoutAnimation {
                if viewMode == .threeD {
                    viewMode = .flat
                }
                isEditing = true
            }
            if brushCode == nil {
                brushCode = usage.first?.color.code
            }
            highlightedCode = nil
            tool = .brush
            showHint(EditTool.brush.hint)
        } else {
            isEditing = false
            // 退出不提示：退栈本身就是「退出」的反馈；顺手收掉还挂着的提示浮层，
            // 免得退回生成页后继续飘一会儿。
            hintTask?.cancel()
            hintTask = nil
            hint = nil
        }
    }

    /// 布局级过渡（预览区尺寸变化）统一走这一条曲线。
    ///
    /// 预览区不照着它自己补间：容器动画期间画布每帧拿到的 `size` 是**逐帧插值的真实
    /// 尺寸**，取景按当帧尺寸现算（见 `BeadPreviewCanvas`），所以这里只需要保证
    /// 「所有会改预览区高度的状态改动都走同一条动画」。
    ///
    /// `layoutAnimationStartedAt` 供收口用：`proxy.size` 只在起跑那一帧报**最终**
    /// 尺寸、之后不再变，所以「这一步动画还有多久跑完」得靠起跑时刻倒推。
    static let layoutDuration: Double = 0.24
    static let layoutAnimation: Animation = .easeInOut(duration: layoutDuration)

    /// 最近一次布局动画的起跑时刻（见 `previewPane.layoutAnimationStart()` 的用法）。
    private(set) var layoutAnimationStartedAt: Date?

    /// 按布局动画改状态（预览区高度跟着变的那几处统一走这里）。
    func withLayoutAnimation(_ body: () -> Void) {
        layoutAnimationStartedAt = .now
        withAnimation(Self.layoutAnimation, body)
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
            scheduleDraftSave()
        }
    }

    /// 取色：命中则把该格色号设为当前画笔色。**不切回画笔工具** —— 取色常常要连着吸
    /// 好几个色（拖动还支持连续吸），自动切走会让每次都要重新点一下「取色」。
    /// 返回吸到的色号；空格 / 出界返回 nil（画笔色保持不变）。
    func pickColor(at point: CGPoint) -> String? {
        guard let grid else { return nil }
        let col = Int(floor(point.x))
        let row = Int(floor(point.y))
        guard visibleRect.contains(x: col, y: row) else { return nil }
        let cell = grid[col, row]
        guard !cell.isEmpty else { return nil }
        brushCode = cell.code
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
        scheduleDraftSave()
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
            showHint("当前没有手绘改动".loc)
            return
        }
        for edit in edits {
            value.cells[edit.index] = edit.current
        }
        grid = value
        pushUndo(EditOp(edits: edits, cellCount: value.cells.count))
        recount()
        scheduleDraftSave()
        showHint("已清空手绘（可撤销）".loc)
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
        let before = boardIndex
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
        if boardIndex != before { boardResetToken += 1 }
        highlightedCode = nil
    }

    func nextBoard() {
        let before = boardIndex
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
        if boardIndex != before { boardResetToken += 1 }
        highlightedCode = nil
    }

    func showAllBoards() {
        if boardIndex != -1 {
            boardIndex = -1
            boardResetToken += 1
        }
        highlightedCode = nil
    }

    // MARK: - 3D

    func toggleViewMode() {
        // 进 3D 会收起手绘工具条（参数面板因此变矮、预览区变高）。这一下同样走
        // 布局过渡，否则预览会在切模式的第一帧跳一次尺寸，2D 层也跟着重算。
        withLayoutAnimation {
            viewMode = viewMode == .flat ? .threeD : .flat
            if viewMode == .threeD {
                isEditing = false
            }
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
        let quality: BeadArtworkRenderer.Quality =
            EntitlementStore.shared.isPro ? .pro : .free
        if settings.export.boardScope == .each, grid.boardCount > 1 {
            return (0..<grid.boardCount).compactMap { index in
                let rect = grid.rect(forBoard: index)
                return BeadArtworkRenderer.render(
                    grid: grid,
                    palette: palette,
                    settings: settings,
                    rect: rect,
                    boardLabel: "第%ld板".loc(index + 1),
                    quality: quality
                )
            }
        }
        let index = boardIndex
        return [BeadArtworkRenderer.render(
            grid: grid,
            palette: palette,
            settings: settings,
            rect: grid.rect(forBoard: index),
            boardLabel: index < 0 ? "全图".loc : "第%ld板".loc(index + 1),
            quality: quality
        )].compactMap { $0 }
    }

    func saveArtwork() async {
        let images = makeArtworks()
        guard !images.isEmpty else {
            showMessage("图纸尺寸过大，把豆宽调小或改用分板导出再试。".loc)
            return
        }
        do {
            for image in images {
                try await PhotoLibrary.save(image)
            }
            if EntitlementStore.shared.isPro {
                showMessage(images.count > 1
                    ? "已保存 %ld 张分板图纸到相册".loc(images.count)
                    : "图纸已保存到相册".loc)
            } else {
                // 这两条带「去解锁」入口。
                showMessage(images.count > 1
                    ? "已保存 %ld 张预览图纸。解锁 Pro 可导出打印级高清。".loc(images.count)
                    : "已保存预览图纸。解锁 Pro 可导出打印级高清、无署名。".loc,
                    offersPro: true)
            }
        } catch {
            showMessage(error.localizedDescription)
        }
    }
}
