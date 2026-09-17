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

    @State private var showBoardSize = false
    @State private var showColors = false
    @State private var showExport = false
    /// 手绘编辑是**另一页**（`BeadEditView`），由预览条上的「编辑」用 `NavigationLink`
    /// 推出去（目的地注册在 `BeadRootView` 的拼豆导航栈）。
    @State private var isExporting = false
    @State private var showSaveName = false
    @State private var saveNameDraft = ""
    /// 参数面板默认展开，方便用户调整参数。
    @State private var showSettings = true
    /// 复位请求：+1 让预览区重新适配
    @State private var resetToken = 0
    /// 步进缩放：token +1 时按 zoomStepFactor 缩放
    @State private var zoomStepToken = 0
    @State private var zoomStepFactor: CGFloat = 1

    private var store: ProjectStore { ProjectStore.shared }
    private var entitlements: EntitlementStore { EntitlementStore.shared }

    /// 展开/收起、切 3D 都走 `model.withLayoutAnimation` 发起（而不是自己
    /// `withAnimation`）：它们都会改预览区高度，必须走同一条布局动画，预览区才能把
    /// 「当帧容器尺寸」当成取景的唯一来源（见 `BeadPreviewCanvas`）。
    ///
    /// 手绘编辑不在这里：点「编辑」由 `NavigationLink` 推到 `BeadEditView`
    /// （`BeadRootView` 里那条包在 `TabView` 外层的栈）。
    var body: some View {
        editorContent
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
        .sheet(isPresented: $showExport) {
            BeadExportSheet(
                options: $model.settings.export,
                boardCount: model.boardCount
            ) {
                Task { await export() }
            }
        }
        .overlay { exportBusyOverlay }
        .alert("提示", isPresented: messageBinding) {
            Button("好") { model.message = nil }
            if model.messageOffersPro {
                Button("去解锁") {
                    model.message = nil
                    Task { @MainActor in
                        try? await Task.sleep(for: .milliseconds(280))
                        entitlements.showPaywall = true
                    }
                }
            }
        } message: {
            Text(model.message ?? "")
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

    /// 生成页本体：预览（含 meta）→ 设置折叠条 → 导出/保存。
    @ViewBuilder
    private var editorContent: some View {
        VStack(spacing: 0) {
            if model.hasGrid {
                previewShell
                    .padding(.horizontal, 16)
                    .padding(.top, embedded ? 0 : 12)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)

                settingsBlock
                    .padding(.horizontal, 16)
                    .padding(.top, BeadSpace.xs)
                    .padding(.bottom, BeadSpace.md)
            } else if model.isOpeningContent {
                openingPlaceholder
            } else {
                uploadArea
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background {
            BeadTheme.parchmentGradient.ignoresSafeArea()
        }
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

    /// 空状态：控制高度的入口卡，避免在大屏上占满首屏。
    ///
    /// 只置 `showLibraryPicker`，真正的相册由根上的 `.photosPicker(isPresented:)` 弹出。
    /// 不要在这里再嵌一层 `PhotosPicker`：和根上的共用 `$photoItem` 时，真机常出现
    /// 「看得见卡、点了没反应」。
    private var uploadArea: some View {
        GeometryReader { geo in
            let cardWidth = min(geo.size.width, 520)
            let cardHeight = min(300, max(220, geo.size.height * 0.42))
            Button {
                showLibraryPicker = true
            } label: {
                uploadCardLabel
                    .frame(width: cardWidth, height: cardHeight)
            }
            .buttonStyle(.automatic)
            .frame(width: cardWidth, height: cardHeight)
            .beadCardShadow()
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
        }
        .padding(.horizontal, BeadSpace.lg)
    }

    /// 选图卡面外观（热区由外层 Button 的固定正方形 frame 决定）。
    private var uploadCardLabel: some View {
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
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background {
            RoundedRectangle(cornerRadius: BeadRadius.lg, style: .continuous)
                .fill(
                    // 卡面两态：浅色是白→极浅蓝（H5 upload-box）；深色抬到比页面底
                    // 高一档的灰（页面底是近黑），否则「空状态卡」会糊进背景里、
                    // 只剩一圈虚线浮着。这一档和 `canvas`（0x1C1C1E）同族。
                    LinearGradient(
                        colors: [
                            Color.adaptive(light: 0xFFFFFF, dark: 0x222226),
                            Color.adaptive(light: 0xF7FAFF, dark: 0x191A1D)
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .overlay {
                    RoundedRectangle(cornerRadius: BeadRadius.lg, style: .continuous)
                        .fill(
                            RadialGradient(
                                colors: [
                                    Color(hex: 0x6AA4F7).opacity(0.14),
                                    Color.clear
                                ],
                                center: .top,
                                startRadius: 0,
                                endRadius: 180
                            )
                        )
                }
        }
        .overlay {
            RoundedRectangle(cornerRadius: BeadRadius.lg, style: .continuous)
                .strokeBorder(
                    BeadTheme.primary.opacity(0.45),
                    style: StrokeStyle(lineWidth: 1.5, dash: [7, 5])
                )
        }
        .contentShape(RoundedRectangle(cornerRadius: BeadRadius.lg, style: .continuous))
    }

    // MARK: - 预览框 + 预览工具条

    private var previewShell: some View {
        VStack(spacing: 4) {
            BeadPreviewPane(
                model: model,
                resetToken: resetToken,
                zoomStepToken: zoomStepToken,
                zoomStepFactor: zoomStepFactor
            )
                .overlay(alignment: .bottom) { BeadHintBanner(hint: model.hint) }

            Text(model.metaText)
                .beadFinePrint()
                .foregroundStyle(BeadTheme.inkMuted48)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, BeadSpace.xxs)
                .padding(.top, 2)

            previewBar
        }
    }

    /// 左下分板翻页，右下视图工具（+ / 复位 / − · 3D）—— 对齐 H5 白底分段模块。
    private var previewBar: some View {
        HStack(spacing: BeadSpace.xs) {
            if model.boardCount > 1 {
                boardSegment
            }

            Spacer(minLength: 0)

            HStack(spacing: 6) {
                zoomSegment
                threeDButton
            }
        }
        .frame(minHeight: 36)
    }

    /// ‹ 板号 › | 全图
    private var boardSegment: some View {
        HStack(spacing: 0) {
            segmentChevron(systemName: "chevron.left") { model.previousBoard() }
            Text(model.boardLabel)
                .font(.system(size: 12, weight: .regular))
                .foregroundStyle(BeadTheme.inkMuted80)
                .monospacedDigit()
                .frame(minWidth: 48, minHeight: 36, maxHeight: 36)
                .lineLimit(1)
                .fixedSize(horizontal: true, vertical: false)
                .multilineTextAlignment(.center)
            segmentChevron(systemName: "chevron.right") { model.nextBoard() }
            if model.boardIndex >= 0 {
                segmentDivider
                Button {
                    model.showAllBoards()
                } label: {
                    Text("全图".loc)
                        .font(.system(size: 12, weight: .regular))
                        .foregroundStyle(BeadTheme.inkMuted80)
                        .padding(.horizontal, 10)
                        .frame(height: 36)
                }
                .buttonStyle(.automatic)
            }
        }
        .background(
            BeadTheme.canvas,
            in: RoundedRectangle(cornerRadius: BeadRadius.sm, style: .continuous)
        )
        .beadGlassButton(cornerRadius: BeadRadius.sm)
        .animation(.easeInOut(duration: 0.28), value: model.boardIndex >= 0)
    }
    private var zoomSegment: some View {
        HStack(spacing: 0) {
            segmentGlyph("+") { stepZoom(1.28) }
            segmentDivider
            Button { resetView() } label: {
                Text("复位".loc)
                    .font(.system(size: 12, weight: .regular))
                    .foregroundStyle(BeadTheme.inkMuted80)
                    .padding(.horizontal, 10)
                    .frame(height: 36)
            }
            .buttonStyle(.automatic)
            .accessibilityLabel("复位")
            segmentDivider
            segmentGlyph("−") { stepZoom(1 / 1.28) }
        }
        .background(
            BeadTheme.canvas,
            in: RoundedRectangle(cornerRadius: BeadRadius.sm, style: .continuous)
        )
        .beadGlassButton(cornerRadius: BeadRadius.sm)
    }

    private var threeDButton: some View {
        Button {
            model.toggleViewMode()
        } label: {
            Text(model.viewMode == .threeD ? "2D" : "3D")
                .font(.system(size: 12, weight: .regular))
                .foregroundStyle(model.viewMode == .threeD ? BeadTheme.onPrimary : BeadTheme.inkMuted80)
                .padding(.horizontal, 10)
                .frame(height: 36)
                .background {
                    RoundedRectangle(cornerRadius: BeadRadius.sm, style: .continuous)
                        .fill(model.viewMode == .threeD ? AnyShapeStyle(BeadTheme.primaryGradient) : AnyShapeStyle(BeadTheme.canvas))
                }
        }
        .buttonStyle(.automatic)
        .beadGlassButton(cornerRadius: BeadRadius.sm)
        .accessibilityLabel("3D 预览")
    }

    private var segmentDivider: some View {
        Rectangle()
            .fill(BeadTheme.hairline)
            .frame(width: 1, height: 14)
    }

    private func segmentChevron(systemName: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(BeadTheme.inkMuted80)
                .frame(width: 36, height: 36)
                .contentShape(Rectangle())
        }
        .buttonStyle(.automatic)
    }

    private func segmentGlyph(_ text: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(text)
                .font(.system(size: 18, weight: .regular))
                .foregroundStyle(BeadTheme.inkMuted80)
                .frame(width: 36, height: 36)
                .contentShape(Rectangle())
        }
        .buttonStyle(.automatic)
    }

    private func stepZoom(_ factor: CGFloat) {
        zoomStepFactor = factor
        zoomStepToken += 1
    }

    // MARK: - 设置折叠 + 底栏

    /// 设置面板：编辑（手绘）已经独立成一页，这里只剩生成参数。
    private var settingsBlock: some View {
        VStack(spacing: BeadSpace.xs) {
            if showSettings {
                ScrollView {
                    paramsGroup
                        // 给卡片阴影预留空间，避免 ScrollView 边界裁掉四角。
                        .padding(.vertical, 8)
                }
                .scrollClipDisabled()
                .scrollBounceBehavior(.basedOnSize)
                .fixedSize(horizontal: false, vertical: true)
                .transition(.opacity.combined(with: .move(edge: .bottom)))
            }

            footerActions
        }
    }

    /// 同一排：更多 · 裁切 · 编辑 · 重选 · 导出 · 保存。
    private var footerActions: some View {
        HStack(spacing: 8) {
            // 左侧图标按钮组
            HStack(spacing: 8) {
                iconBarButton(systemName: "ellipsis", kind: .neutral, isOn: showSettings) {
                    // 走模型的布局动画入口：预览区高度跟着变，得和「更多」面板同一条动画。
                    model.withLayoutAnimation {
                        showSettings.toggle()
                    }
                }
                .accessibilityLabel("更多".loc)

                NavigationLink(value: BeadRoute.crop) {
                    Image(systemName: "crop")
                        .font(.system(size: 16, weight: .medium))
                        .foregroundStyle(BeadTheme.inkMuted80)
                        .frame(width: 36, height: 36)
                        .background {
                            RoundedRectangle(cornerRadius: BeadRadius.sm, style: .continuous)
                                .fill(BeadTheme.canvas)
                        }
                }
                .buttonStyle(.automatic)
                .disabled(model.originalSourceImage == nil)
                .accessibilityLabel("裁切".loc)

                // 编辑按钮：推到 `BeadEditView`
                NavigationLink(value: BeadRoute.handEdit) {
                    Image(systemName: "paintbrush.pointed")
                        .font(.system(size: 16, weight: .medium))
                        .foregroundStyle(BeadTheme.inkMuted80)
                        .frame(width: 36, height: 36)
                        .background {
                            RoundedRectangle(cornerRadius: BeadRadius.sm, style: .continuous)
                                .fill(BeadTheme.canvas)
                        }
                }
                .buttonStyle(.automatic)
                .accessibilityLabel("编辑".loc)

                iconBarButton(systemName: "photo", kind: .neutral) {
                    showLibraryPicker = true
                }
                .accessibilityLabel("重选".loc)
            }

            Spacer(minLength: 4)

            // 右侧文字按钮组
            HStack(spacing: 8) {
                compactBarButton("导出".loc, kind: .ghost, enabled: model.canExport) {
                    showExport = true
                }

                compactBarButton("保存".loc, kind: .ghost, locked: saveNeedsPro) {
                    beginSave()
                }
            }
        }
    }

    private enum CompactBarKind {
        case neutral
        case primary
        case ghost
    }

    /// 图标样式的底栏按钮（用于更多、裁切、重选）
    private func iconBarButton(
        systemName: String,
        kind: CompactBarKind,
        isOn: Bool = false,
        enabled: Bool = true,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.system(size: 16, weight: .medium))
                .foregroundStyle(compactForeground(kind: kind, isOn: isOn))
                .frame(width: 36, height: 36)
                .background {
                    RoundedRectangle(cornerRadius: BeadRadius.sm, style: .continuous)
                        .fill(compactBackgroundStyle(kind: kind, isOn: isOn))
                }
                .shadow(
                    color: (kind == .primary || (kind == .neutral && isOn))
                        ? Color(hex: 0x3478E0).opacity(0.28)
                        : .clear,
                    radius: 6,
                    y: 3
                )
        }
        .buttonStyle(.automatic)
        .beadGlassButton(cornerRadius: BeadRadius.sm)
        .disabled(!enabled)
        .opacity(enabled ? 1 : 0.36)
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
            .font(.system(size: 14, weight: .medium))
            .foregroundStyle(compactForeground(kind: kind, isOn: isOn))
            .padding(.horizontal, 12)
            .frame(height: 36)
            .background {
                RoundedRectangle(cornerRadius: BeadRadius.sm, style: .continuous)
                    .fill(compactBackgroundStyle(kind: kind, isOn: isOn))
            }
            .shadow(
                color: (kind == .primary || (kind == .neutral && isOn))
                    ? Color(hex: 0x3478E0).opacity(0.28)
                    : .clear,
                radius: 6,
                y: 3
            )
        }
        .buttonStyle(.automatic)
        .beadGlassButton(cornerRadius: BeadRadius.sm)
        .disabled(!enabled)
        .opacity(enabled ? 1 : 0.36)
    }

    private func compactForeground(kind: CompactBarKind, isOn: Bool) -> Color {
        switch kind {
        case .primary:
            return BeadTheme.onPrimary
        case .ghost:
            return BeadTheme.primaryDeep
        case .neutral:
            return isOn ? BeadTheme.onPrimary : BeadTheme.inkMuted80
        }
    }

    private func compactBackgroundStyle(kind: CompactBarKind, isOn: Bool) -> AnyShapeStyle {
        switch kind {
        case .primary:
            return AnyShapeStyle(BeadTheme.primaryGradient)
        case .ghost:
            // 保存按钮必须使用不透明底色，避免预览内容从按钮后方穿出。
            return AnyShapeStyle(BeadTheme.canvas)
        case .neutral:
            return isOn
                ? AnyShapeStyle(BeadTheme.primaryGradient)
                : AnyShapeStyle(BeadTheme.canvas)
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

    /// 生成参数（H5 `#params-group`）。
    private var paramsGroup: some View {
        BeadGroup {
            VStack(alignment: .leading, spacing: BeadSpace.sm) {
                HStack(spacing: BeadSpace.xs) {
                    Picker(selection: Binding(
                        get: { model.settings.paletteId },
                        set: { model.selectPalette($0) }
                    )) {
                        ForEach(PaletteLibrary.all) { palette in
                            Text(palette.name)
                                .tag(palette.id)
                        }
                    } label: {
                        Text(model.palette.name)
                            .foregroundStyle(BeadTheme.primaryDeep)
                    }
                    .pickerStyle(.menu)
                    .tint(BeadTheme.primary)
                    .padding(.horizontal, 2)
                    .frame(height: 28)
                    .background(
                        BeadTheme.canvas,
                        in: RoundedRectangle(cornerRadius: BeadRadius.sm, style: .continuous)
                    )
                    .overlay {
                        RoundedRectangle(cornerRadius: BeadRadius.sm, style: .continuous)
                            .strokeBorder(BeadTheme.primary, lineWidth: 1)
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
                                    .beadBody()
                            }
                        }
                        .foregroundStyle(BeadTheme.primary)
                        .lineLimit(1)
                        .padding(.horizontal, 14)
                        .frame(height: 28)
                        .overlay { 
                            RoundedRectangle(cornerRadius: BeadRadius.sm, style: .continuous)
                                .strokeBorder(BeadTheme.primary, lineWidth: 1) 
                        }
                    }
                    .buttonStyle(.automatic)

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

    // MARK: - 载入

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
}

#Preview {
    BeadEditorView(model: BeadEditorModel(), onOpenMine: {})
}
