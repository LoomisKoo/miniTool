import PhotosUI
import SwiftUI

/// 编辑页。顶部标题 → 预览 + 工具条 → 参数面板 → 内容末尾操作行。
///
/// 预览区单独放在 `BeadPreviewPane` 里：拖动/缩放只重绘画布，
/// 本视图的 body 不会被牵连重算。
/// `embedded == true` 时用于作品库 push，隐藏自绘标题，交给导航栏。
struct BeadEditorView: View {
    /// 模型由 `BeadRootView` 持有：两个 tab 共用同一份，切 tab 不丢正在编辑的图纸。
    @Bindable var model: BeadEditorModel
    /// 空状态「去我的」入口。
    var onOpenMine: () -> Void = {}
    /// 嵌在导航栈里时隐藏自绘标题（用系统返回 + navigationTitle）。
    var embedded = false

    @State private var photoItem: PhotosPickerItem?

    @State private var showPalette = false
    @State private var showBoardSize = false
    @State private var showColors = false
    @State private var showBrush = false
    @State private var showExport = false
    @State private var isExporting = false
    /// 复位请求：+1 让预览区重新适配
    @State private var resetToken = 0

    private var store: ProjectStore { ProjectStore.shared }
    private var canSave: Bool { store.canCreate || model.project != nil }

    var body: some View {
        VStack(spacing: 0) {
            if !embedded {
                header
            }

            if model.hasGrid {
                previewShell
                    .padding(.horizontal, 16)
                panel
                    .padding(.horizontal, 16)
                    .padding(.top, 4)
                actionsRow
                    .padding(.horizontal, 16)
                    .padding(.top, 10)
                    .padding(.bottom, 16)
            } else if model.isOpeningContent {
                openingPlaceholder
            } else {
                uploadArea
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(BeadTheme.background)
        .sheet(isPresented: $showPalette) {
            BeadPaletteSheet(selectedId: model.settings.paletteId) { id in
                model.selectPalette(id)
            }
        }
        .sheet(isPresented: $showBoardSize) {
            BeadBoardSizeSheet(selectedSize: model.settings.boardSize) { size in
                model.setBoardSize(size)
            }
        }
        .sheet(isPresented: $showColors) {
            BeadColorsSheet(
                usage: model.usage,
                highlightedCode: model.highlightedCode
            ) { code in
                model.highlightedCode = code
            }
        }
        .sheet(isPresented: $showBrush) {
            BeadBrushSheet(
                palette: model.palette,
                counts: model.usageCounts,
                selectedCode: model.brushCode
            ) { code in
                model.setBrush(code)
            }
        }
        .sheet(isPresented: $showExport) {
            BeadExportSheet(
                options: $model.settings.export,
                boardCount: model.boardCount
            ) {
                Task { await export() }
            }
        }
        .overlay { exportBusyOverlay }
        .fullScreenCover(isPresented: $model.showingCrop) {
            if let original = model.originalSourceImage {
                BeadCropView(
                    sourceImage: UIImage(cgImage: original),
                    existingCrop: model.cropRect
                ) { output in
                    model.applyCrop(output)
                }
            }
        }
        .alert("提示", isPresented: messageBinding) {
            Button("好") { model.message = nil }
        } message: {
            Text(model.message ?? "")
        }
        .onChange(of: photoItem) { _, item in
            guard let item else { return }
            Task { await load(item) }
        }
        .task { ProjectStore.shared.loadIfNeeded() }
        .onDisappear { model.flushPendingSave() }
    }

    // MARK: - 标题栏

    private var header: some View {
        Text("兔格拼豆")
            .font(.system(size: 17, weight: .semibold))
            .foregroundStyle(BeadTheme.ink)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
            .padding(.horizontal, 16)
    }

    // MARK: - 空状态（选择图片）

    /// 打开作品 / 重新生成时：不要闪「选择图片」。
    private var openingPlaceholder: some View {
        VStack(spacing: 12) {
            Spacer()
            ProgressView()
            Text(embedded ? "正在打开作品" : "正在生成图纸")
                .font(.system(size: 14))
                .foregroundStyle(BeadTheme.muted)
            Spacer()
        }
        .frame(maxWidth: .infinity)
    }

    private var uploadArea: some View {
        VStack {
            Spacer()
            PhotosPicker(selection: $photoItem, matching: .images, photoLibrary: .shared()) {
                VStack(spacing: 12) {
                    Image(systemName: "photo.on.rectangle.angled")
                        .font(.system(size: 28, weight: .light))
                        .foregroundStyle(BeadTheme.accent)
                        .frame(width: 56, height: 56)
                        .background(BeadTheme.accentSoft, in: RoundedRectangle(cornerRadius: 16))
                    Text("选择图片")
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(BeadTheme.ink)
                    Text("生成可拼的豆格图纸 · 透明处理不铺豆")
                        .font(.system(size: 12))
                        .foregroundStyle(BeadTheme.muted)
                        .multilineTextAlignment(.center)
                }
                .frame(width: 280, height: 280)
                .background(BeadTheme.surface, in: RoundedRectangle(cornerRadius: 24))
                .overlay {
                    RoundedRectangle(cornerRadius: 24)
                        .strokeBorder(
                            Color.black.opacity(0.18),
                            style: StrokeStyle(lineWidth: 1.5, dash: [6, 5])
                        )
                }
            }
            .buttonStyle(.plain)

            if !ProjectStore.shared.projects.isEmpty {
                Button {
                    onOpenMine()
                } label: {
                    Text("去「我的」看已保存的作品（\(ProjectStore.shared.count)）")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(BeadTheme.accent)
                        .padding(.horizontal, 14)
                        .frame(height: 34)
                        .background(BeadTheme.accentSoft, in: RoundedRectangle(cornerRadius: 10))
                }
                .buttonStyle(.plain)
                .padding(.top, 16)
            }

            Spacer()
        }
        .padding(24)
    }

    // MARK: - 预览框 + 预览工具条

    private var previewShell: some View {
        VStack(spacing: 4) {
            BeadPreviewPane(model: model, resetToken: resetToken)
                .overlay(alignment: .bottom) { hintBanner }

            previewBar
        }
    }

    /// 提示浮层（H5 `.view-hint`）。放在预览区外层，避免提示显示时重绘画布。
    @ViewBuilder
    private var hintBanner: some View {
        if let hint = model.hint {
            Text(hint)
                .font(.system(size: 11))
                .foregroundStyle(.white.opacity(0.9))
                .padding(.horizontal, 10)
                .padding(.vertical, 3)
                .background(
                    Color(red: 30 / 255, green: 30 / 255, blue: 32 / 255, opacity: 0.55),
                    in: RoundedRectangle(cornerRadius: 10)
                )
                .padding(.bottom, 10)
                .transition(.opacity)
                .animation(.easeInOut(duration: 0.2), value: hint)
        }
    }

    /// 左下分板翻页，右下视图工具（复位 / 编辑 / 3D）。
    private var previewBar: some View {
        HStack(spacing: 8) {
            if model.boardCount > 1 {
                HStack(spacing: 6) {
                    BarButton(title: "‹", icon: true) { model.previousBoard() }
                    Text(model.boardLabel)
                        .font(.system(size: 12))
                        .foregroundStyle(BeadTheme.muted)
                        .monospacedDigit()
                        .frame(width: 52)
                    BarButton(title: "›", icon: true) { model.nextBoard() }
                    if model.boardIndex >= 0 {
                        BarButton(title: "全图") { model.showAllBoards() }
                    }
                }
            }

            Spacer(minLength: 0)

            HStack(spacing: 6) {
                BarButton(title: "复位") { resetView() }
                BarButton(
                    title: "编辑",
                    isOn: model.isEditing,
                    disabled: model.viewMode == .threeD
                ) {
                    model.setEditing(!model.isEditing)
                }
                BarButton(title: "3D", isOn: model.viewMode == .threeD) {
                    model.toggleViewMode()
                }
            }
        }
        .frame(minHeight: 40)
    }

    // MARK: - 参数面板

    private var panel: some View {
        ScrollView {
            VStack(spacing: 8) {
                if model.isEditing {
                    editGroup
                }
                paramsGroup
                Text(model.metaText)
                    .font(.system(size: 11))
                    .foregroundStyle(BeadTheme.muted)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 2)
                    .padding(.bottom, 2)
            }
        }
        .scrollBounceBehavior(.basedOnSize)
        .frame(maxHeight: 280)
    }

    /// 重选 / 裁切 / 导出 / 保存：放在参数面板下方（内容末尾），不是贴屏幕底。
    private var actionsRow: some View {
        HStack(spacing: 6) {
            PhotosPicker(selection: $photoItem, matching: .images, photoLibrary: .shared()) {
                actionLabel("重选")
            }
            .buttonStyle(.plain)

            Button { model.openCrop() } label: { actionLabel("裁切") }
                .buttonStyle(.plain)

            Button { showExport = true } label: {
                actionLabel("导出", prominent: true)
            }
            .buttonStyle(.plain)
            .disabled(!model.canExport)
            .opacity(model.canExport ? 1 : 0.45)

            Button { model.saveProject() } label: {
                actionLabel(model.project == nil ? "保存" : "更新", prominent: true)
            }
            .buttonStyle(.plain)
            .disabled(!canSave)
            .opacity(canSave ? 1 : 0.45)
        }
    }

    private func actionLabel(_ title: String, prominent: Bool = false) -> some View {
        Text(title)
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(prominent ? Color.white : BeadTheme.accent)
            .frame(maxWidth: .infinity)
            .frame(height: 32)
            .background(
                prominent ? BeadTheme.accent : BeadTheme.accentSoft,
                in: RoundedRectangle(cornerRadius: 10)
            )
    }

    /// 手绘工具条（H5 `#et-group`）。
    private var editGroup: some View {
        BeadGroup {
            VStack(spacing: 8) {
                HStack(spacing: 6) {
                    ForEach(EditTool.allCases) { tool in
                        BeadChip(title: tool.label, selected: model.tool == tool) {
                            model.setTool(tool)
                        }
                    }
                    brushChip
                }

                HStack(spacing: 6) {
                    BeadChip(title: "撤销") { model.undo() }
                        .opacity(model.canUndo ? 1 : 0.4)
                        .disabled(!model.canUndo)
                    BeadChip(title: "重做") { model.redo() }
                        .opacity(model.canRedo ? 1 : 0.4)
                        .disabled(!model.canRedo)
                    BeadChip(title: "清空手绘") { model.clearHandEdits() }
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
        }
    }

    /// 当前画笔豆色，点开选色面板。
    private var brushChip: some View {
        Button {
            showBrush = true
        } label: {
            HStack(spacing: 6) {
                RoundedRectangle(cornerRadius: 4)
                    .fill(model.brush?.rgb.swiftUIColor ?? .clear)
                    .overlay {
                        RoundedRectangle(cornerRadius: 4)
                            .strokeBorder(.black.opacity(0.12), lineWidth: 1)
                    }
                    .frame(width: 16, height: 16)
                Text(model.brush?.code ?? "选色")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(BeadTheme.ink)
                    .monospacedDigit()
                    .lineLimit(1)
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 10)
            .frame(height: 32)
            .frame(maxWidth: .infinity)
            .background(BeadTheme.fill, in: RoundedRectangle(cornerRadius: 10))
        }
        .buttonStyle(.plain)
    }

    private var paramsGroup: some View {
        BeadGroup {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 4) {
                    BeadChip(
                        title: model.palette.name,
                        selected: true,
                        prominentWhenSelected: false,
                        hugContent: true
                    ) {
                        showPalette = true
                    }

                    Button {
                        showColors = true
                    } label: {
                        HStack(spacing: 4) {
                            if let code = model.highlightedCode,
                               let color = model.palette.color(for: code) {
                                RoundedRectangle(cornerRadius: 4)
                                    .fill(color.rgb.swiftUIColor)
                                    .overlay {
                                        RoundedRectangle(cornerRadius: 4)
                                            .strokeBorder(.black.opacity(0.1), lineWidth: 1)
                                    }
                                    .frame(width: 14, height: 14)
                                Text(code)
                                    .font(.system(size: 12, weight: .semibold))
                                    .monospacedDigit()
                            } else {
                                Text("豆色")
                                    .font(.system(size: 12, weight: .semibold))
                            }
                        }
                        .foregroundStyle(BeadTheme.accent)
                        .lineLimit(1)
                        .padding(.horizontal, 8)
                        .frame(height: 28)
                        .background(BeadTheme.accentSoft, in: RoundedRectangle(cornerRadius: 8))
                    }
                    .buttonStyle(.plain)

                    BeadChip(title: "网格", selected: model.settings.showGrid, compact: true, hugContent: true) {
                        model.toggleGrid()
                    }
                    BeadChip(title: "合并", selected: model.settings.mergeSimilar, compact: true, hugContent: true) {
                        model.toggleMerge()
                    }
                    BeadChip(title: "抖动", selected: model.settings.dither, compact: true, hugContent: true) {
                        model.toggleDither()
                    }
                    BeadChip(
                        title: "均值",
                        selected: model.settings.sampleMode == .average,
                        compact: true,
                        hugContent: true
                    ) {
                        model.toggleAverageSampling()
                    }
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)

            BeadRowDivider()

            BeadSliderRow(
                label: "豆宽",
                value: $model.settings.beadWidth,
                range: BeadSettings.widthRange
            )

            BeadRowDivider()

            HStack(spacing: 8) {
                Text("拼板")
                    .font(.system(size: 15))
                    .foregroundStyle(BeadTheme.ink)
                    .frame(width: 40, alignment: .leading)
                Spacer(minLength: 0)
                BeadChip(
                    title: "\(model.settings.boardSize)×\(model.settings.boardSize)",
                    selected: true,
                    prominentWhenSelected: false,
                    hugContent: true
                ) {
                    showBoardSize = true
                }
                BeadChip(
                    title: "分板线",
                    selected: model.settings.showSeam,
                    prominentWhenSelected: false,
                    hugContent: true
                ) {
                    model.toggleSeam()
                }
            }
            .frame(minHeight: 40)
            .padding(.horizontal, 14)

            BeadRowDivider()

            BeadSliderRow(
                label: "限色",
                value: $model.settings.maxColors,
                range: BeadSettings.colorRange
            )
        }
    }

    // MARK: - 导出遮罩

    /// 导出遮罩，对齐 H5 `.export-busy`。
    @ViewBuilder
    private var exportBusyOverlay: some View {
        if isExporting {
            ZStack {
                Color.black.opacity(0.46).ignoresSafeArea()
                VStack(spacing: 8) {
                    Text("正在导出")
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(BeadTheme.ink)
                    Text("正在生成图纸，请勿退出")
                        .font(.system(size: 14))
                        .foregroundStyle(BeadTheme.muted)
                }
                .padding(20)
                .frame(width: 260)
                .background(BeadTheme.surface, in: RoundedRectangle(cornerRadius: 16))
            }
        }
    }

    // MARK: - 动作

    /// 复位：2D / 3D 都交给预览区做过渡动画。
    private func resetView() {
        resetToken += 1
        if model.viewMode == .threeD {
            model.showHint("已复位视角")
        }
    }

    private func load(_ item: PhotosPickerItem) async {
        do {
            guard let data = try await item.loadTransferable(type: Data.self) else {
                model.message = "读取不到这张图片，换一张试试。"
                return
            }
            let image = try ImageImport.cgImage(from: data)
            model.load(image: image)
        } catch {
            model.message = error.localizedDescription
        }
    }

    private func export() async {
        isExporting = true
        await model.saveArtwork()
        isExporting = false
    }

    private var messageBinding: Binding<Bool> {
        Binding(
            get: { model.message != nil },
            set: { if !$0 { model.message = nil } }
        )
    }
}

/// 预览工具条的方形按钮，对齐 H5 `.bar-btn`。
private struct BarButton: View {
    let title: String
    var icon = false
    var isOn = false
    var disabled = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: icon ? 20 : 13, weight: icon ? .regular : .semibold))
                .lineLimit(1)
                .foregroundStyle(foreground)
                .padding(.horizontal, icon ? 0 : 10)
                .frame(minWidth: icon ? 30 : nil)
                .frame(height: 30)
                .background(
                    isOn ? BeadTheme.accent : BeadTheme.surface,
                    in: RoundedRectangle(cornerRadius: 8)
                )
                .overlay {
                    RoundedRectangle(cornerRadius: 8)
                        .strokeBorder(isOn ? BeadTheme.accent : BeadTheme.separator, lineWidth: 1)
                }
        }
        .buttonStyle(.plain)
        .disabled(disabled)
        .opacity(disabled ? 0.45 : 1)
    }

    private var foreground: Color {
        if isOn { return .white }
        return icon ? BeadTheme.accent : BeadTheme.ink
    }
}

#Preview {
    BeadEditorView(model: BeadEditorModel(), onOpenMine: {})
}
