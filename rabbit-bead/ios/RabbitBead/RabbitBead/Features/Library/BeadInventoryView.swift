import PhotosUI
import SwiftUI
import UIKit

/// 豆子库存页：统一列表浏览色号，底部系统 Tab（「全部 / 已有」）切换筛选。
///
/// 点色块登记/修改颗数；右侧 A–Z 索引；也可拍照/相册扫豆子颜色（兼 OCR 包装色号）。
struct BeadInventoryView: View {
    let paletteId: String

    private enum Filter: String, CaseIterable, Identifiable, Hashable {
        case all = "全部"
        case owned = "已有"

        var id: String { rawValue }

        /// 标签文案要查表：rawValue（中文）只当 key / id 用。
        var title: String { rawValue.loc }

        /// 与首页 tab 一样走系统 `Label` + SF Symbol。
        var systemImage: String {
            switch self {
            case .all: "square.grid.2x2"
            case .owned: "checkmark.circle"
            }
        }
    }

    private var inventory: InventoryStore { InventoryStore.shared }
    private var palette: BeadPalette { PaletteLibrary.palette(id: paletteId) }

    @State private var filter: Filter = .all
    /// 列表当前停在哪一段（右侧索引条高亮跟着它走，进页面就是第一段）。
    @State private var currentLetter: String?
    @State private var editing: PaletteColor?
    /// 打开登记面板那一刻的已登记颗数。
    ///
    /// 刻意在这里冻结一份，而不是让面板自己去读 `InventoryStore`：
    /// 面板内容一旦依赖 store，保存时 store 变化会让面板内容跟着重建，
    /// `@State` 里的输入被重置，看起来就像「保存没生效」。
    @State private var editingCount = 0
    @State private var confirmClear = false

    @State private var photoItem: PhotosPickerItem?
    @State private var showScanSource = false
    @State private var showCamera = false
    @State private var showLibraryPicker = false
    @State private var isScanning = false
    @State private var scanResult: ScanHits?
    @State private var scanMessage: String?

    private var indexLetters: [String] { sections(for: filter).map(\.letter) }

    var body: some View {
        // 底部「全部 / 已有」直接用系统 TabView，和首页「拼豆 / 我的」同一条
        // tab bar（毛玻璃、图标尺寸、选中色、home indicator），不再手绘仿一条。
        TabView(selection: $filter) {
            ForEach(Filter.allCases) { item in
                colorList(for: item)
                    .tabItem { Label(item.title, systemImage: item.systemImage) }
                    .tag(item)
            }
        }
        // 本页底部「全部 / 已有」TabView 需要显式可见，避免被导航栈影响。
        .toolbar(.visible, for: .tabBar)
        .background(BeadTheme.parchment)
        .navigationTitle("豆子库存")
        .navigationBarTitleDisplayMode(.inline)
        // 顶部导航：iOS 26+ 交给系统液态玻璃；更早版本用系统 `.bar` 毛玻璃
        //（覆盖外层 NavigationStack 上那层实色 parchment）。
        .modifier(BeadInventoryTopChrome())
        // 「已有 xx 色」进导航栏，不再单独占一条顶栏挡住色块。
        .modifier(BeadInventoryNavSummary(
            text: "已有 %ld 色 · 共 %ld 颗".loc(
                inventory.ownedCount(palette: paletteId),
                inventory.total(palette: paletteId)
            )
        ))
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    confirmClear = true
                } label: {
                    Image(systemName: "trash")
                }
                .accessibilityLabel("清空")
                .disabled(inventory.ownedCount(palette: paletteId) == 0)
            }
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showScanSource = true
                } label: {
                    Image(systemName: "viewfinder")
                }
                .accessibilityLabel("扫豆子")
                .disabled(isScanning)
            }
        }
        .overlay { scanningOverlay }
        .sheet(item: $editing) { color in
            BeadCountSheet(
                color: color,
                paletteName: palette.name,
                initial: editingCount
            ) { value in
                inventory.setCount(value, palette: paletteId, code: color.code)
            }
        }
        .sheet(item: $scanResult) { result in
            BeadScanResultSheet(
                colors: result.colors,
                counts: Dictionary(uniqueKeysWithValues: result.colors.map {
                    ($0.code, inventory.count(palette: paletteId, code: $0.code))
                })
            ) { color in
                scanResult = nil
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
                    beginEditing(color)
                }
            }
        }
        .photosPicker(isPresented: $showLibraryPicker, selection: $photoItem, matching: .images)
        .fullScreenCover(isPresented: $showCamera) {
            BeadCameraPicker(
                onImage: { image in
                    showCamera = false
                    Task { await scan(image: image) }
                },
                onCancel: { showCamera = false }
            )
            .ignoresSafeArea()
        }
        .alert("扫豆子", isPresented: $showScanSource) {
            if UIImagePickerController.isSourceTypeAvailable(.camera) {
                Button("拍照识别") { showCamera = true }
            }
            Button("相册识别") { showLibraryPicker = true }
            Button("取消", role: .cancel) {}
        } message: {
            Text("拍豆子本体识别颜色；包装上有色号时也会一起认出。识别后点色块登记颗数。")
        }
        .alert("清空库存？", isPresented: $confirmClear) {
            Button("取消", role: .cancel) {}
            Button("清空", role: .destructive) { inventory.clear(palette: paletteId) }
        } message: {
            Text("会清掉 %@ 已登记的 %ld 个色号。".loc(
                palette.name,
                inventory.ownedCount(palette: paletteId)
            ))
        }
        .alert("提示", isPresented: scanMessageBinding) {
            Button("好") { scanMessage = nil }
        } message: {
            Text(scanMessage ?? "")
        }
        .onChange(of: photoItem) { _, item in
            guard let item else { return }
            Task { await scan(item: item) }
        }
        .onChange(of: filter) { _, _ in
            // 切筛选后旧的分段可能整段消失，先落回第一段，等分段位置刷新。
            currentLetter = indexLetters.first
        }
    }

    private var scanMessageBinding: Binding<Bool> {
        Binding(
            get: { scanMessage != nil },
            set: { if !$0 { scanMessage = nil } }
        )
    }

    @ViewBuilder
    private var scanningOverlay: some View {
        if isScanning {
            ZStack {
                Color.black.opacity(0.28).ignoresSafeArea()
                VStack(spacing: BeadSpace.xs) {
                    ProgressView()
                        .tint(BeadTheme.primary)
                    Text("正在识别…")
                        .beadCaption()
                        .foregroundStyle(BeadTheme.inkMuted48)
                }
                .padding(BeadSpace.lg)
                .background(
                    BeadTheme.canvas,
                    in: RoundedRectangle(cornerRadius: BeadRadius.lg, style: .continuous)
                )
            }
        }
    }

    // MARK: - 扫豆子

    private func scan(item: PhotosPickerItem) async {
        isScanning = true
        defer {
            isScanning = false
            photoItem = nil
        }
        do {
            let cgImage = try await ImageImport.cgImage(from: item, maxSide: 1600)
            let hits = try await BeadCodeOCR.recognizeColors(in: cgImage, palette: palette)
            scanResult = ScanHits(colors: hits)
        } catch {
            scanMessage = (error as? LocalizedError)?.errorDescription
                ?? "读取不到这张图片，换一张试试。".loc
        }
    }

    private func scan(image: UIImage) async {
        isScanning = true
        defer { isScanning = false }
        do {
            let cgImage = try ImageImport.normalized(image, maxSide: 1600)
            let hits = try await BeadCodeOCR.recognizeColors(in: cgImage, palette: palette)
            scanResult = ScanHits(colors: hits)
        } catch {
            scanMessage = error.localizedDescription
        }
    }

    // MARK: - 列表

    /// 当前过滤下的色号（按传入的 tab，不读 `@State filter`，避免两个 tab
    /// 页共享同一份筛选结果）。
    private func colors(for filter: Filter) -> [PaletteColor] {
        switch filter {
        case .all:
            return palette.colors
        case .owned:
            let owned = Set(inventory.owned(palette: paletteId).map(\.color.code))
            return palette.colors.filter { owned.contains($0.code) }
        }
    }

    private func sections(for filter: Filter) -> [(letter: String, colors: [PaletteColor])] {
        var map: [String: [PaletteColor]] = [:]
        var order: [String] = []
        for color in colors(for: filter) {
            let letter = Self.sectionLetter(of: color.code)
            if map[letter] == nil {
                order.append(letter)
                map[letter] = []
            }
            map[letter, default: []].append(color)
        }
        return order.map { ($0, map[$0] ?? []) }
    }

    private func colorList(for filter: Filter) -> some View {
        let sections = sections(for: filter)
        let letters = sections.map(\.letter)
        let isEmpty = colors(for: filter).isEmpty

        return ScrollViewReader { proxy in
            ScrollView {
                if isEmpty {
                    emptyHint
                } else {
                    LazyVStack(alignment: .leading, spacing: BeadSpace.sm) {
                        ForEach(sections, id: \.letter) { section in
                            VStack(alignment: .leading, spacing: 5) {
                                Text(section.letter)
                                    .beadDigits(12, weight: .semibold)
                                    .foregroundStyle(BeadTheme.inkMuted48)
                                colorGrid(section.colors)
                            }
                            .padding(.horizontal, 10)
                            .id(section.letter)
                            // 每段报一次自己的顶边位置，用来算「当前是哪一段」——
                            // 索引条的高亮不必等用户去点。
                            .background {
                                GeometryReader { geo in
                                    let top = geo.frame(in: .named(Self.scrollSpace)).minY.rounded()
                                    Color.clear.preference(
                                        key: SectionOffsetKey.self,
                                        value: [section.letter: top]
                                    )
                                }
                            }
                        }
                    }
                    .padding(.vertical, BeadSpace.sm)
                    .padding(.trailing, 16)
                }
            }
            .coordinateSpace(.named(Self.scrollSpace))
            .onPreferenceChange(SectionOffsetKey.self) { offsets in
                // 只更新当前可见 tab 的索引高亮，避免另一个 tab 的 preference 抢值。
                guard filter == self.filter else { return }
                let next = Self.activeLetter(offsets: offsets, order: letters)
                if next != currentLetter { currentLetter = next }
            }
            .overlay(alignment: .trailing) {
                if filter == self.filter, !letters.isEmpty {
                    AlphabetIndexBar(letters: letters, current: currentLetter) { letter in
                        proxy.scrollTo(letter, anchor: .top)
                    }
                }
            }
        }
    }

    private static let scrollSpace = "beadInventoryScroll"

    /// 当前段 = 顶边已经越过视口顶部的那一段里最靠下的一个。
    ///
    /// `offsets` 是各段顶边在滚动坐标系里的 minY：还没滚到的段是正数，滚过去的
    /// 是负数，所以「最后一个 minY ≤ 阈值」就是当前段；一段都没越过时取第一段。
    private static func activeLetter(offsets: [String: CGFloat], order: [String]) -> String? {
        var active = order.first
        for letter in order {
            guard let y = offsets[letter] else { continue }
            if y > 8 { break }
            active = letter
        }
        return active
    }

    private func colorGrid(_ items: [PaletteColor]) -> some View {
        let gap: CGFloat = 5
        return LazyVGrid(
            columns: Array(repeating: GridItem(.flexible(), spacing: gap), count: 6),
            spacing: gap
        ) {
            ForEach(items) { color in
                Button { beginEditing(color) } label: { colorCell(color) }
                    .buttonStyle(.plain)
            }
        }
    }

    /// 打开登记面板：先把当前颗数冻结下来。
    private func beginEditing(_ color: PaletteColor) {
        editingCount = inventory.count(palette: paletteId, code: color.code)
        editing = color
    }

    private var emptyHint: some View {
        VStack(spacing: BeadSpace.xs) {
            Image(systemName: "circle.grid.2x2")
                .font(.system(size: 26, weight: .light))
                .foregroundStyle(BeadTheme.inkMuted48)
            Text("还没有登记豆子")
                .beadRowTitle()
                .foregroundStyle(BeadTheme.ink)
            Text("点色块登记，或右上角扫豆子颜色。")
                .beadCaption()
                .foregroundStyle(BeadTheme.inkMuted48)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 72)
    }

    // MARK: - 色块

    /// 色块上的文字配色：按豆色亮度取黑 / 白，再配一层**反向光晕**。
    ///
    /// 色块里不再垫白底胶囊（小方块上一坨白看着很脏），靠这层光晕把文字从豆色上
    /// 拎出来 —— 深色豆用白字 + 暗光晕，浅色豆用黑字 + 亮光晕。
    fileprivate static func ink(for rgb: RGB8) -> (text: Color, halo: Color) {
        rgb.wantsDarkOverlayText
            ? (Color.black.opacity(0.85), Color.white.opacity(0.6))
            : (Color.white.opacity(0.97), Color.black.opacity(0.5))
    }

    @ViewBuilder
    private func colorCell(_ color: PaletteColor) -> some View {
        let count = inventory.count(palette: paletteId, code: color.code)
        let ink = Self.ink(for: color.rgb)

        RoundedRectangle(cornerRadius: BeadRadius.sm, style: .continuous)
            .fill(color.rgb.swiftUIColor)
            .aspectRatio(1, contentMode: .fit)
            .overlay {
                // 只留色块自己的细描边（把相邻同色块分开），登记与否不再画蓝框。
                RoundedRectangle(cornerRadius: BeadRadius.sm, style: .continuous)
                    .strokeBorder(BeadTheme.swatchStrokeSoft, lineWidth: 1)
            }
            .overlay {
                Text(color.code)
                    .beadDigits(13, weight: .bold)
                    .foregroundStyle(ink.text)
                    .shadow(color: ink.halo, radius: 1.5)
            }
            .overlay(alignment: .bottomTrailing) {
                // 有数字就表示登记过了。不垫背景，只把数字写在色块上。
                if count > 0 {
                    Text("\(count)")
                        .beadDigits(11, weight: .bold)
                        .foregroundStyle(ink.text)
                        .shadow(color: ink.halo, radius: 2)
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                        .padding(.trailing, 3)
                        .padding(.bottom, 2)
                }
            }
            .opacity(count > 0 ? 1 : 0.72)
    }

    private static func sectionLetter(of code: String) -> String {
        guard let first = code.first else { return "#" }
        let upper = String(first).uppercased()
        return upper.first?.isLetter == true ? upper : "#"
    }
}

// MARK: - A–Z 索引条（微信联系人式：圆点高亮 + 左侧尖头气泡）

/// 各分段顶边在滚动坐标系里的 minY，用来算索引条的当前高亮。
private struct SectionOffsetKey: PreferenceKey {
    static let defaultValue: [String: CGFloat] = [:]
    static func reduce(value: inout [String: CGFloat], nextValue: () -> [String: CGFloat]) {
        value.merge(nextValue()) { _, new in new }
    }
}

private struct AlphabetIndexBar: View {
    let letters: [String]
    /// 列表当前停留的分段：**进页面就是第一段**，滑动时跟着走，
    /// 不用等用户去点索引才有高亮。
    let current: String?
    let onSelect: (String) -> Void

    /// 拖动中手指所在字母；松手后清掉，高亮交回 `current`。
    @State private var scrubbingLetter: String?
    /// 手指按住时才显示左侧气泡。
    @State private var scrubbing = false

    /// 字母格边长：字号调大后要跟着放大，否则字会挤在一起。
    private let letterH: CGFloat = 16
    private let fontSize: CGFloat = 13.5

    /// 当前高亮的字母。`current` 为 nil（首帧还没来得及收到分段位置）时退回第一段，
    /// 保证进页面就有高亮，而不是空着等用户去点。
    private var highlighted: String? { scrubbingLetter ?? current ?? letters.first }

    var body: some View {
        VStack(spacing: 0) {
            ForEach(letters, id: \.self) { letter in
                Text(letter)
                    .font(.system(size: fontSize, weight: .bold))
                    .foregroundStyle(highlighted == letter ? BeadTheme.onPrimary : BeadTheme.inkMuted48)
                    .frame(width: letterH, height: letterH)
                    .background {
                        if highlighted == letter {
                            Circle().fill(BeadTheme.primary)
                        }
                    }
            }
        }
        .padding(.vertical, 2)
        .padding(.horizontal, 2)
        .contentShape(Rectangle())
        .highPriorityGesture(
            DragGesture(minimumDistance: 0, coordinateSpace: .local)
                .onChanged { value in
                    scrubbing = true
                    guard let letter = letter(at: value.location.y) else { return }
                    if letter != scrubbingLetter {
                        scrubbingLetter = letter
                        UIImpactFeedbackGenerator(style: .medium).impactOccurred(intensity: 1.0)
                        onSelect(letter)
                    }
                }
                .onEnded { _ in
                    scrubbing = false
                    scrubbingLetter = nil
                }
        )
        .overlay(alignment: .leading) {
            if scrubbing, let highlighted {
                indexBubble(highlighted)
                    // 再往左一些，避免被拇指挡住。
                    .offset(x: -78, y: bubbleOffset)
                    .allowsHitTesting(false)
            }
        }
        .padding(.trailing, 2)
    }

    private var bubbleOffset: CGFloat {
        guard let highlighted,
              let index = letters.firstIndex(of: highlighted),
              !letters.isEmpty else { return 0 }
        let barH = CGFloat(letters.count) * letterH
        let y = (CGFloat(index) + 0.5) * letterH
        return y - barH / 2
    }

    private func indexBubble(_ letter: String) -> some View {
        ZStack {
            HStack(spacing: 0) {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(BeadTheme.primary.opacity(0.92))
                    .frame(width: 56, height: 56)
                IndexBubbleArrow()
                    .fill(BeadTheme.primary.opacity(0.92))
                    .frame(width: 10, height: 16)
            }
            Text(letter)
                .font(.system(size: 28, weight: .bold))
                .foregroundStyle(BeadTheme.onPrimary)
                .offset(x: -5)
        }
        .frame(width: 66, height: 56)
    }

    private func letter(at y: CGFloat) -> String? {
        guard !letters.isEmpty else { return nil }
        let local = y - 2
        let index = min(letters.count - 1, max(0, Int(local / letterH)))
        return letters[index]
    }
}

/// 指向右侧索引条的小三角。
private struct IndexBubbleArrow: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.minX, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.midY))
        path.addLine(to: CGPoint(x: rect.minX, y: rect.maxY))
        path.closeSubpath()
        return path
    }
}

private struct ScanHits: Identifiable {
    let id = UUID()
    let colors: [PaletteColor]
}

/// 扫到的候选色号：点一项去登记颗数。
private struct BeadScanResultSheet: View {
    let colors: [PaletteColor]
    let counts: [String: Int]
    let onPick: (PaletteColor) -> Void

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVGrid(
                    columns: Array(repeating: GridItem(.flexible(), spacing: BeadSpace.xs), count: 5),
                    spacing: BeadSpace.xs
                ) {
                    ForEach(colors) { color in
                        Button { onPick(color) } label: {
                            scanCell(color)
                        }
                        .buttonStyle(BeadPressStyle(pressedScale: 0.97))
                    }
                }
                .padding(BeadSpace.md)

                Text("按颜色或包装色号猜的，仅供参考；不对再回列表手动选。")
                    .beadFinePrint()
                    .foregroundStyle(BeadTheme.inkMuted48)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, BeadSpace.md)
                    .padding(.bottom, BeadSpace.md)
            }
            .background(BeadTheme.parchment)
            .navigationTitle("识别到 %ld 个色号".loc(colors.count))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("完成") { dismiss() }
                }
            }
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarBackground(BeadTheme.parchment.opacity(0.8), for: .navigationBar)
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    private func scanCell(_ color: PaletteColor) -> some View {
        let count = counts[color.code] ?? 0
        let ink = BeadInventoryView.ink(for: color.rgb)

        return RoundedRectangle(cornerRadius: BeadRadius.sm, style: .continuous)
            .fill(color.rgb.swiftUIColor)
            .aspectRatio(1, contentMode: .fit)
            .overlay {
                RoundedRectangle(cornerRadius: BeadRadius.sm, style: .continuous)
                    .strokeBorder(BeadTheme.swatchStrokeSoft, lineWidth: 1)
            }
            .overlay {
                Text(color.code)
                    .beadDigits(13, weight: .bold)
                    .foregroundStyle(ink.text)
                    .shadow(color: ink.halo, radius: 1.5)
            }
            .overlay(alignment: .bottomTrailing) {
                if count > 0 {
                    Text("\(count)")
                        .beadDigits(11, weight: .bold)
                        .foregroundStyle(ink.text)
                        .shadow(color: ink.halo, radius: 2)
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                        .padding(.trailing, 3)
                        .padding(.bottom, 2)
                }
            }
    }
}

/// 改颗数的小面板：快捷增减 + 直接填数。填 0 或点「清零」等于移除这个色号。
///
/// 两处刻意的写法：
/// - **不自动聚焦键盘**。面板是贴底的小高度弹层，数字键盘一弹出来就会盖住
///   加减按钮和输入框，用户点不到，只能盲按保存 —— 看起来就是「保存没反应」。
/// - **不在面板里读 `InventoryStore`**。只吃父视图冻结好的 `initial`，
///   保存时 store 变化不会重建面板内容（否则 `@State` 里的输入会被重置）。
private struct BeadCountSheet: View {
    let color: PaletteColor
    let paletteName: String
    /// 打开面板那一刻的已登记颗数。
    let initial: Int
    /// 保存（0 表示移除）。
    let onSave: (Int) -> Void

    @Environment(\.dismiss) private var dismiss
    /// 输入框文本：只保留 ASCII 数字，最多 5 位。
    @State private var text: String
    @FocusState private var focused: Bool

    /// 快捷增减档位。颗数动辄成百上千（一盒豆），±1 / ±10 那种量级按起来没意义。
    private static let deltas = [-1000, -100, 100, 1000]
    /// 颗数上限 999999（6 位），够登记任何真实库存。
    static let maxCount = 999_999

    init(color: PaletteColor, paletteName: String, initial: Int, onSave: @escaping (Int) -> Void) {
        self.color = color
        self.paletteName = paletteName
        self.initial = initial
        self.onSave = onSave
        // 直接把初值放进 `@State`：不用 `onAppear`，避免它再被触发时把输入清掉。
        _text = State(initialValue: initial > 0 ? String(initial) : "")
    }

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: BeadSpace.md) {
                header
                bumpRow
                countRow

                Text("填 0 或点「清零」等于移除这个色号。")
                    .beadFinePrint()
                    .foregroundStyle(BeadTheme.inkMuted48)

                Spacer(minLength: 0)
            }
            .padding(BeadSpace.md)
            .background(BeadTheme.parchment)
            .navigationTitle("登记颗数")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("取消") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("保存") { commit() }
                        .fontWeight(.semibold)
                        // 没有可保存的变化时置灰：避免「点了没反应」的错觉。
                        .disabled(!hasChange)
                }
                // 数字键盘没有回车键，补一个「完成」用来收起键盘。
                ToolbarItemGroup(placement: .keyboard) {
                    Spacer()
                    Button("完成") { focused = false }
                }
            }
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarBackground(BeadTheme.parchment.opacity(0.8), for: .navigationBar)
        }
        // 默认贴底的小高度；输入时系统会自动升到 `.large`，键盘不会盖住输入框。
        .presentationDetents([.height(320), .large])
        .presentationDragIndicator(.visible)
    }

    // MARK: - 子视图

    private var header: some View {
        HStack(spacing: BeadSpace.sm) {
            BeadSwatch(color: color.rgb.swiftUIColor, size: 44, radius: BeadRadius.sm)
            VStack(alignment: .leading, spacing: 2) {
                Text(color.code)
                    .beadBodyStrong()
                    .monospacedDigit()
                    .foregroundStyle(BeadTheme.ink)
                Text(paletteName)
                    .beadFinePrint()
                    .foregroundStyle(BeadTheme.inkMuted48)
            }
            Spacer(minLength: 0)
        }
    }

    /// 加减档位 + 清零：同一行，别让清零单独占一行。
    private var bumpRow: some View {
        HStack(spacing: BeadSpace.xs) {
            ForEach(Self.deltas, id: \.self) { delta in
                Button {
                    bump(delta)
                } label: {
                    Text(delta > 0 ? "+\(delta)" : "\(delta)")
                        .beadBodyStrong()
                        .foregroundStyle(BeadTheme.ink)
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                        .frame(maxWidth: .infinity)
                        .frame(height: 40)
                        .background(BeadTheme.pearl, in: Capsule())
                        .overlay { Capsule().strokeBorder(BeadTheme.hairline, lineWidth: 1) }
                }
                .buttonStyle(BeadPressStyle(pressedScale: 0.95))
            }

            Button {
                commit(force: 0)
            } label: {
                Text("清零")
                    .beadCaption()
                    .foregroundStyle(initial > 0 ? BeadTheme.danger : BeadTheme.inkMuted48)
                    .lineLimit(1)
                    .frame(maxWidth: .infinity)
                    .frame(height: 40)
            }
            .buttonStyle(BeadPressStyle(pressedScale: 0.95))
            .disabled(initial <= 0)
        }
    }

    private var countRow: some View {
        HStack(spacing: BeadSpace.sm) {
            Text("已有")
                .beadBody()
                .foregroundStyle(BeadTheme.ink)
            TextField("0", text: $text)
                .keyboardType(.numberPad)
                .focused($focused)
                .multilineTextAlignment(.trailing)
                .font(.system(size: 17, weight: .semibold))
                .monospacedDigit()
                .frame(maxWidth: .infinity)
                .frame(height: 44)
                .padding(.horizontal, BeadSpace.sm)
                .background(BeadTheme.fill, in: Capsule())
                .onChange(of: text) { _, newValue in
                    let cleaned = Self.sanitize(newValue)
                    if cleaned != newValue { text = cleaned }
                }
            Text("颗")
                .beadBody()
                .foregroundStyle(BeadTheme.inkMuted48)
        }
    }

    // MARK: - 逻辑

    /// 输入框当前的颗数（空 = 0）。
    private var value: Int { Int(text) ?? 0 }

    /// 与打开时相比是否有变化（决定保存按钮能不能点）。
    private var hasChange: Bool { value != initial }

    private func commit(force forced: Int? = nil) {
        let next = forced ?? value
        if next != initial {
            onSave(next)
        }
        dismiss()
    }

    private func bump(_ delta: Int) {
        text = String(min(Self.maxCount, max(0, value + delta)))
    }

    /// 只留 ASCII 数字，并夹到 999999。负号、空格、全角数字一律丢掉。
    private static func sanitize(_ raw: String) -> String {
        var digits = raw.filter { ("0"..."9").contains($0) }
        // 去掉前导零（但保留单个 0 / 空串）
        if digits.count > 1, digits.hasPrefix("0") {
            digits = String(digits.drop { $0 == "0" })
        }
        if let value = Int(digits), value > maxCount {
            return String(maxCount)
        }
        return digits
    }
}

#Preview {
    NavigationStack {
        BeadInventoryView(paletteId: "mard")
    }
    .preferredColorScheme(.light)
}

// MARK: - 顶部毛玻璃 / 液态玻璃

/// 库存页导航栏背景：iOS 26+ 用系统液态玻璃；更早用 `.bar` 毛玻璃。
private struct BeadInventoryTopChrome: ViewModifier {
    @ViewBuilder
    func body(content: Content) -> some View {
        if #available(iOS 26.0, *) {
            // 不盖实色，让系统导航栏自己上 Liquid Glass。
            content
                .toolbarBackground(.automatic, for: .navigationBar)
        } else {
            content
                .toolbarBackground(.visible, for: .navigationBar)
                .toolbarBackground(.bar, for: .navigationBar)
        }
    }
}

/// 把「已有 xx 色 · 共 xx 颗」放进导航栏，和标题共用同一条顶栏背景。
///
/// iOS 26+ 用系统 `navigationSubtitle`；更早版本用 `principal` 标题+副标题。
private struct BeadInventoryNavSummary: ViewModifier {
    let text: String

    @ViewBuilder
    func body(content: Content) -> some View {
        if #available(iOS 26.0, *) {
            content.navigationSubtitle(text)
        } else {
            content
                .navigationTitle("")
                .toolbar {
                    ToolbarItem(placement: .principal) {
                        VStack(spacing: 1) {
                            Text("豆子库存")
                                .font(.headline)
                            Text(text)
                                .font(.caption2)
                                .foregroundStyle(BeadTheme.inkMuted48)
                                .monospacedDigit()
                                .lineLimit(1)
                                .minimumScaleFactor(0.8)
                        }
                        .accessibilityElement(children: .combine)
                    }
                }
        }
    }
}
