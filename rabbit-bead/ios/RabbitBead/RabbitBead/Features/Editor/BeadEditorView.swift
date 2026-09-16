import Foundation
import PhotosUI
import SwiftUI

/// 编辑页。预览（含 meta）→ 设置折叠条 → 导出/保存。
///
/// 预览区单独放在 `BeadPreviewPane` 里：拖动/缩放只重绘画布，
/// 本视图的 body 不会被牵连重算。
/// `embedded == true` 时用于作品库 push（导航栏已有标题）。
struct BeadEditorView: View {
    /// 模型由 `BeadRootView` 持有：两个 tab 共用同一份，切 tab 不丢正在编辑的图纸。
    @Bindable var model: BeadEditorModel
    /// 空状态「去我的」入口。
    var onOpenMine: () -> Void = {}
    /// 嵌在导航栈里时（作品详情）为 true。
    var embedded = false

    @State private var photoItem: PhotosPickerItem?
    /// 相册选择器：由 `uploadArea` / 「重选」把 Bool 置 true 来弹出。
    @State private var showLibraryPicker = false

    @State private var showPalette = false
    @State private var showBoardSize = false
    @State private var showColors = false
    @State private var showBrush = false
    @State private var showExport = false
    @State private var isExporting = false
    @State private var showSaveName = false
    @State private var saveNameDraft = ""
    /// 参数面板默认收起，预览占更高；点「设置」展开。
    @State private var showSettings = false
    /// 复位请求：+1 让预览区重新适配
    @State private var resetToken = 0

    private var store: ProjectStore { ProjectStore.shared }
    private var entitlements: EntitlementStore { EntitlementStore.shared }

    /// 展开/收起、编辑条显隐、切 3D 都走 `model.withLayoutAnimation` 发起（而不是
    /// 自己 `withAnimation`）：它们都会改预览区高度，必须走同一条布局动画，预览区
    /// 才能把「当帧容器尺寸」当成取景的唯一来源（见 `BeadPreviewCanvas`）。
    var body: some View {
        VStack(spacing: 0) {
            if model.hasGrid {
                previewShell
                    .padding(.horizontal, 16)
                    .padding(.top, embedded ? 0 : 12)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)

                settingsBlock
                    .padding(.horizontal, 16)
                    .padding(.top, BeadSpace.sm)
                    .padding(.bottom, BeadSpace.md)
            } else if model.isOpeningContent {
                openingPlaceholder
            } else {
                uploadArea
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(BeadTheme.parchment)
        .onChange(of: model.isEditing) { _, editing in
            // 编辑与设置互斥：进手绘只出编辑条，收起设置参数。
            guard editing else { return }
            model.withLayoutAnimation { showSettings = false }
        }
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
            if model.messageOffersPro {
                Button("去解锁") {
                    model.message = nil
                    entitlements.requestPaywall()
                }
            }
        } message: {
            Text(model.message ?? "")
        }
        .sheet(isPresented: paywallBinding) {
            BeadPaywallView()
        }
        .alert("保存作品", isPresented: $showSaveName) {
            TextField("作品名称", text: $saveNameDraft)
            Button("取消", role: .cancel) {}
            Button("保存") {
                let name = saveNameDraft.trimmingCharacters(in: .whitespacesAndNewlines)
                model.saveProject(name: name.isEmpty ? nil : name)
            }
        } message: {
            Text("给这个作品起个名字，方便以后找到。")
        }
        .onChange(of: photoItem) { _, item in
            guard let item else { return }
            Task { await load(item) }
        }
        // 相册选择器挂在根上（不是包住某个 label）：入口只有「置 Bool」这一步。
        .photosPicker(
            isPresented: $showLibraryPicker,
            selection: $photoItem,
            matching: .images,
            preferredItemEncoding: .compatible
        )
        .task { ProjectStore.shared.loadIfNeeded() }
        .onDisappear { model.flushPendingSave() }
    }

    // MARK: - 空状态（选择图片）

    /// 打开作品 / 重新生成时：不要闪「选择图片」。
    private var openingPlaceholder: some View {
        VStack(spacing: BeadSpace.sm) {
            Spacer()
            ProgressView()
                .tint(BeadTheme.primary)
            Text(embedded ? "正在打开作品" : "正在生成图纸")
                .beadCaption()
                .foregroundStyle(BeadTheme.inkMuted48)
            Spacer()
        }
        .frame(maxWidth: .infinity)
    }

    /// 空状态：一块**正方形**卡面就是入口。
    ///
    /// 整块卡都能点，所以里面不再套一个蓝色药丸按钮 —— 那会让人以为只有药丸可点。
    /// 「选择图片」只作为卡内的文案（配一个图标），点击热区由 `.contentShape` 铺满整块。
    private var uploadArea: some View {
        // 外层用「撑满 + 居中」而不是上下各放一个 Spacer：Spacer 和方形卡都是
        // 弹性尺寸，VStack 会把剩余高度三分，方形卡会被压矮（不再是正方形）。
        Button {
            showLibraryPicker = true
        } label: {
            // 普通 Button + `.photosPicker(isPresented:)`，**不要**把整块卡片做成
            // `PhotosPicker` 的 label：label 版的点击判定在 Picker 内部，包一块自定义
            // 卡片时命中区域不由我们决定，实测点了完全没反应。
            VStack(spacing: BeadSpace.sm) {
                Image(systemName: "photo.on.rectangle.angled")
                    .font(.system(size: 30, weight: .light))
                    .foregroundStyle(BeadTheme.primary)
                Text("选择图片")
                    .beadBodyStrong()
                    .foregroundStyle(BeadTheme.ink)
                Text("生成可拼的豆格图纸\n透明处理不铺豆")
                    .beadFinePrint()
                    .foregroundStyle(BeadTheme.inkMuted48)
                    .multilineTextAlignment(.center)
            }
            // 先铺满可用空间，再由 `aspectRatio` 收回成正方形（居中）。
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .aspectRatio(1, contentMode: .fit)
            .background(
                BeadTheme.canvas,
                in: RoundedRectangle(cornerRadius: BeadRadius.lg, style: .continuous)
            )
            .overlay {
                RoundedRectangle(cornerRadius: BeadRadius.lg, style: .continuous)
                    .strokeBorder(
                        BeadTheme.hairline,
                        style: StrokeStyle(lineWidth: 1, dash: [6, 5])
                    )
            }
            .contentShape(RoundedRectangle(cornerRadius: BeadRadius.lg, style: .continuous))
        }
        .buttonStyle(BeadPressStyle(pressedScale: 0.98))
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
        .padding(.horizontal, BeadSpace.lg)
    }

    // MARK: - 预览框 + 预览工具条

    private var previewShell: some View {
        VStack(spacing: 4) {
            BeadPreviewPane(model: model, resetToken: resetToken)
                .overlay(alignment: .bottom) { hintBanner }

            Text(model.metaText)
                .beadFinePrint()
                .foregroundStyle(BeadTheme.inkMuted48)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, BeadSpace.xxs)
                .padding(.top, 2)

            previewBar
        }
    }

    /// 提示浮层。浮在作品上，用近黑胶囊 + 白字（对齐 Apple 浮层控制片的明度关系）。
    @ViewBuilder
    private var hintBanner: some View {
        if let hint = model.hint {
            Text(hint)
                .font(.system(size: 14, weight: .semibold))
                .tracking(-0.224)
                .foregroundStyle(BeadTheme.onDark)
                .padding(.horizontal, 18)
                .padding(.vertical, 11)
                .background(BeadTheme.overlaySurface, in: Capsule())
                .padding(.bottom, BeadSpace.sm)
                .transition(.opacity.combined(with: .move(edge: .bottom)))
                .animation(.easeInOut(duration: 0.2), value: hint)
        }
    }

    /// 左下分板翻页，右下视图工具（复位 / 编辑 / 3D）。
    private var previewBar: some View {
        HStack(spacing: BeadSpace.xs) {
            if model.boardCount > 1 {
                HStack(spacing: 6) {
                    pagerButton("chevron.left") { model.previousBoard() }
                    Text(model.boardLabel)
                        .beadDigits(12, weight: .medium)
                        .foregroundStyle(BeadTheme.inkMuted48)
                        .frame(width: 52)
                    pagerButton("chevron.right") { model.nextBoard() }
                    if model.boardIndex >= 0 {
                        compactBarButton("全图".loc, kind: .neutral) {
                            model.showAllBoards()
                        }
                    }
                }
            }

            Spacer(minLength: 0)

            HStack(spacing: 6) {
                BeadIconButton(systemName: "arrow.counterclockwise", size: 30) { resetView() }
                    .accessibilityLabel("复位")
                BeadIconButton(
                    systemName: "paintbrush.pointed",
                    isOn: model.isEditing,
                    size: 30
                ) {
                    model.setEditing(!model.isEditing)
                }
                .accessibilityLabel("编辑")
                BeadIconButton(
                    systemName: "cube",
                    isOn: model.viewMode == .threeD,
                    size: 30
                ) {
                    model.toggleViewMode()
                }
                .accessibilityLabel("3D 预览")
            }
        }
        .frame(minHeight: 30)
    }

    private func pagerButton(_ systemName: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(BeadTheme.inkMuted80)
                .frame(width: 30, height: 30)
                .background(
                    BeadTheme.pearl,
                    in: RoundedRectangle(cornerRadius: BeadRadius.sm, style: .continuous)
                )
                .overlay {
                    RoundedRectangle(cornerRadius: BeadRadius.sm, style: .continuous)
                        .strokeBorder(BeadTheme.hairline, lineWidth: 1)
                }
        }
        .buttonStyle(BeadPressStyle(pressedScale: 0.94))
    }

    // MARK: - 设置折叠 + 底栏

    /// 编辑条与设置参数互斥；底栏始终一行。
    private var settingsBlock: some View {
        VStack(spacing: BeadSpace.xs) {
            if model.isEditing {
                editGroup
                    .transition(.opacity.combined(with: .move(edge: .bottom)))
            } else if showSettings {
                ScrollView {
                    paramsGroup
                }
                .scrollBounceBehavior(.basedOnSize)
                .frame(maxHeight: 280)
                .transition(.opacity.combined(with: .move(edge: .bottom)))
            }

            footerActions
        }
    }

    /// 同一排：设置 · 裁切 · 重选 · 导出 · 保存。
    private var footerActions: some View {
        HStack(spacing: 6) {
            compactBarButton("更多".loc, kind: .neutral, isOn: showSettings && !model.isEditing) {
                // 走模型的布局动画入口：预览区高度跟着变，得和「更多」面板同一条动画。
                model.withLayoutAnimation {
                    if model.isEditing {
                        model.setEditing(false)
                        showSettings = true
                    } else {
                        showSettings.toggle()
                    }
                }
            }

            compactBarButton("裁切".loc, kind: .neutral) {
                model.openCrop()
            }

            compactBarButton("重选".loc, kind: .neutral) {
                showLibraryPicker = true
            }

            Spacer(minLength: 4)

            compactBarButton("导出".loc, kind: .primary, enabled: model.canExport) {
                showExport = true
            }

            compactBarButton("保存".loc, kind: .ghost, locked: saveNeedsPro) {
                beginSave()
            }
        }
    }

    private enum CompactBarKind {
        case neutral
        case primary
        case ghost
    }

    private func compactBarButton(
        _ title: String,
        kind: CompactBarKind,
        isOn: Bool = false,
        enabled: Bool = true,
        locked: Bool = false,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: 4) {
                if locked { lockBadge() }
                Text(title)
            }
            .beadCaption()
            .foregroundStyle(compactForeground(kind: kind, isOn: isOn))
            .padding(.horizontal, 10)
            .frame(height: 30)
            .background(
                compactBackground(kind: kind, isOn: isOn),
                in: RoundedRectangle(cornerRadius: BeadRadius.sm, style: .continuous)
            )
            .overlay {
                if kind == .ghost || (kind == .neutral && !isOn) {
                    RoundedRectangle(cornerRadius: BeadRadius.sm, style: .continuous)
                        .strokeBorder(
                            kind == .ghost ? BeadTheme.primary : BeadTheme.hairline,
                            lineWidth: 1
                        )
                }
            }
        }
        .buttonStyle(BeadPressStyle(pressedScale: 0.96))
        .disabled(!enabled)
        .opacity(enabled ? 1 : 0.36)
    }

    private func compactForeground(kind: CompactBarKind, isOn: Bool) -> Color {
        switch kind {
        case .primary:
            return BeadTheme.onPrimary
        case .ghost:
            return BeadTheme.primary
        case .neutral:
            return isOn ? BeadTheme.onPrimary : BeadTheme.inkMuted80
        }
    }

    private func compactBackground(kind: CompactBarKind, isOn: Bool) -> Color {
        switch kind {
        case .primary:
            return BeadTheme.primary
        case .ghost:
            return .clear
        case .neutral:
            return isOn ? BeadTheme.primary : BeadTheme.pearl
        }
    }

    /// 免费额度用完且还没买断 —— 保存按钮要挂锁。
    private var saveNeedsPro: Bool {
        model.project == nil && !entitlements.isPro && !store.canCreate
    }

    private func beginSave() {
        if model.project != nil {
            model.saveProject()
            return
        }
        if store.canCreate {
            saveNameDraft = ""
            showSaveName = true
        } else {
            entitlements.requestPaywall()
        }
    }

    /// 「这个动作要买断 Pro」的小锁头。
    private func lockBadge() -> some View {
        Image(systemName: "lock.fill")
            .font(.system(size: 10, weight: .bold))
            .opacity(0.85)
    }

    /// 手绘工具条（H5 `#et-group`）。
    private var editGroup: some View {
        BeadGroup {
            VStack(spacing: BeadSpace.xs) {
                HStack(spacing: 6) {
                    ForEach(EditTool.allCases) { tool in
                        BeadChip(title: tool.label, selected: model.tool == tool) {
                            model.setTool(tool)
                        }
                    }
                    brushChip
                }

                HStack(spacing: 6) {
                    BeadChip(title: "撤销".loc) { model.undo() }
                        .opacity(model.canUndo ? 1 : 0.36)
                        .disabled(!model.canUndo)
                    BeadChip(title: "重做".loc) { model.redo() }
                        .opacity(model.canRedo ? 1 : 0.36)
                        .disabled(!model.canRedo)
                    BeadChip(title: "清空手绘".loc) { model.clearHandEdits() }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, BeadSpace.sm)
        }
    }

    /// 当前画笔豆色，点开选色面板。
    private var brushChip: some View {
        Button {
            showBrush = true
        } label: {
            HStack(spacing: 6) {
                BeadSwatch(color: model.brush?.rgb.swiftUIColor ?? .clear, size: 15)
                Text(model.brush?.code ?? "选色".loc)
                    .beadCaption()
                    .foregroundStyle(BeadTheme.inkMuted80)
                    .monospacedDigit()
                    .lineLimit(1)
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 14)
            .frame(height: 34)
            .frame(maxWidth: .infinity)
            .background(BeadTheme.pearl, in: Capsule())
            .overlay { Capsule().strokeBorder(BeadTheme.hairline, lineWidth: 1) }
        }
        .buttonStyle(BeadPressStyle(pressedScale: 0.96))
    }

    private var paramsGroup: some View {
        BeadGroup {
            VStack(alignment: .leading, spacing: BeadSpace.sm) {
                HStack(spacing: BeadSpace.xs) {
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
                        HStack(spacing: 6) {
                            if let code = model.highlightedCode,
                               let color = model.palette.color(for: code) {
                                BeadSwatch(color: color.rgb.swiftUIColor, size: 15)
                                Text(code)
                                    .beadCaption()
                                    .monospacedDigit()
                            } else {
                                Text("豆色")
                                    .beadCaption()
                            }
                        }
                        .foregroundStyle(BeadTheme.primary)
                        .lineLimit(1)
                        .padding(.horizontal, 14)
                        .frame(height: 34)
                        .overlay { Capsule().strokeBorder(BeadTheme.primary, lineWidth: 1) }
                    }
                    .buttonStyle(BeadPressStyle(pressedScale: 0.96))

                    Spacer(minLength: 0)
                }

                // 开关类：同一行横滑，间距拉开一点。
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: BeadSpace.xs) {
                        BeadChip(title: "网格".loc, selected: model.settings.showGrid, hugContent: true) {
                            model.toggleGrid()
                        }
                        BeadChip(title: "合并".loc, selected: model.settings.mergeSimilar, hugContent: true) {
                            model.toggleMerge()
                        }
                        BeadChip(title: "抖动".loc, selected: model.settings.dither, hugContent: true) {
                            model.toggleDither()
                        }
                        BeadChip(
                            title: "均值".loc,
                            selected: model.settings.sampleMode == .average,
                            hugContent: true
                        ) {
                            model.toggleAverageSampling()
                        }
                        // 「豆库」「去背景」是 Pro 能力：没买断时挂小锁（点了弹付费墙）。
                        BeadChip(
                            title: "豆库".loc,
                            selected: model.settings.useOwnedOnly,
                            hugContent: true,
                            locked: !entitlements.isPro
                        ) {
                            model.toggleOwnedOnly()
                        }
                        BeadChip(
                            title: "去背景".loc,
                            selected: model.settings.removeBackground,
                            hugContent: true,
                            locked: !entitlements.isPro
                        ) {
                            model.toggleRemoveBackground()
                        }
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, BeadSpace.sm)

            BeadRowDivider()

            BeadSliderRow(
                label: "豆宽".loc,
                value: $model.settings.beadWidth,
                range: BeadSettings.widthRange
            )

            BeadRowDivider()

            BeadToolRow(label: "拼板".loc) {
                BeadChip(
                    title: "\(model.settings.boardSize)×\(model.settings.boardSize)",
                    selected: true,
                    prominentWhenSelected: false,
                    hugContent: true
                ) {
                    showBoardSize = true
                }
                BeadChip(
                    title: "分板线".loc,
                    selected: model.settings.showSeam,
                    prominentWhenSelected: false,
                    hugContent: true
                ) {
                    model.toggleSeam()
                }
            }

            BeadRowDivider()

            BeadSliderRow(
                label: "限色".loc,
                value: $model.settings.maxColors,
                range: BeadSettings.colorRange
            )
        }
    }

    // MARK: - 导出遮罩

    /// 导出遮罩：白卡 + 大标题，不加投影。
    @ViewBuilder
    private var exportBusyOverlay: some View {
        if isExporting {
            ZStack {
                Color.black.opacity(0.46).ignoresSafeArea()
                VStack(spacing: BeadSpace.xs) {
                    ProgressView()
                        .tint(BeadTheme.primary)
                    Text("正在导出")
                        .beadDisplayMd()
                        .foregroundStyle(BeadTheme.ink)
                    Text("正在生成图纸，请勿退出")
                        .beadCaption()
                        .foregroundStyle(BeadTheme.inkMuted48)
                }
                .padding(BeadSpace.lg)
                .frame(width: 260)
                .background(
                    BeadTheme.canvas,
                    in: RoundedRectangle(cornerRadius: BeadRadius.lg, style: .continuous)
                )
            }
        }
    }

    // MARK: - 动作

    /// 复位：2D / 3D 都交给预览区做过渡动画。
    private func resetView() {
        resetToken += 1
        if model.viewMode == .threeD {
            model.showHint("已复位视角".loc)
        }
    }

    private func load(_ item: PhotosPickerItem) async {
        defer { photoItem = nil }
        do {
            let image = try await ImageImport.cgImage(from: item)
            model.load(image: image)
        } catch {
            model.showMessage((error as? LocalizedError)?.errorDescription ?? "读取不到这张图片，换一张试试。".loc)
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

    private var paywallBinding: Binding<Bool> {
        Binding(
            get: { entitlements.showPaywall },
            set: { entitlements.showPaywall = $0 }
        )
    }
}

#Preview {
    BeadEditorView(model: BeadEditorModel(), onOpenMine: {})
}
