import SwiftUI
import UIKit

/// 豆子库存页：统一列表浏览色号，顶部可过滤「全部 / 已有」。
///
/// 点色块登记/修改颗数；右侧 A–Z 索引快速跳转。
struct BeadInventoryView: View {
    let paletteId: String

    private enum Filter: String, CaseIterable, Identifiable {
        case all = "全部"
        case owned = "已有"

        var id: String { rawValue }
    }

    private var inventory: InventoryStore { InventoryStore.shared }
    private var palette: BeadPalette { PaletteLibrary.palette(id: paletteId) }

    @State private var filter: Filter = .all
    @State private var editing: PaletteColor?
    @State private var confirmClear = false

    /// 当前过滤下的色号（保留色卡原始顺序）。
    private var filteredColors: [PaletteColor] {
        switch filter {
        case .all:
            return palette.colors
        case .owned:
            let owned = Set(inventory.owned(palette: paletteId).map(\.color.code))
            return palette.colors.filter { owned.contains($0.code) }
        }
    }

    /// 按首字母分段。
    private var sections: [(letter: String, colors: [PaletteColor])] {
        var map: [String: [PaletteColor]] = [:]
        var order: [String] = []
        for color in filteredColors {
            let letter = Self.sectionLetter(of: color.code)
            if map[letter] == nil {
                order.append(letter)
                map[letter] = []
            }
            map[letter, default: []].append(color)
        }
        return order.map { ($0, map[$0] ?? []) }
    }

    private var indexLetters: [String] { sections.map(\.letter) }

    var body: some View {
        colorList
            .background(BeadTheme.background)
            .navigationTitle("豆子库存")
            .navigationBarTitleDisplayMode(.inline)
            .safeAreaInset(edge: .top) { summaryBar }
            .sheet(item: $editing) { color in
                BeadCountSheet(
                    color: color,
                    paletteName: palette.name,
                    initial: inventory.count(palette: paletteId, code: color.code)
                ) { value in
                    inventory.setCount(value, palette: paletteId, code: color.code)
                }
            }
            .alert("清空库存？", isPresented: $confirmClear) {
                Button("取消", role: .cancel) {}
                Button("清空", role: .destructive) { inventory.clear(palette: paletteId) }
            } message: {
                Text("会清掉 \(palette.name) 已登记的 \(inventory.ownedCount(palette: paletteId)) 个色号。")
            }
    }

    // MARK: - 列表

    private var colorList: some View {
        ScrollViewReader { proxy in
            ScrollView {
                if filteredColors.isEmpty {
                    emptyHint
                } else {
                    LazyVStack(alignment: .leading, spacing: 10) {
                        ForEach(sections, id: \.letter) { section in
                            VStack(alignment: .leading, spacing: 5) {
                                Text(section.letter)
                                    .font(.system(size: 12, weight: .semibold))
                                    .foregroundStyle(BeadTheme.muted)
                                colorGrid(section.colors)
                            }
                            .padding(.horizontal, 10)
                            .id(section.letter)
                        }
                    }
                    .padding(.vertical, 10)
                    .padding(.trailing, 16)
                }
            }
            .overlay(alignment: .trailing) {
                if !indexLetters.isEmpty {
                    AlphabetIndexBar(letters: indexLetters) { letter in
                        proxy.scrollTo(letter, anchor: .top)
                    }
                }
            }
        }
    }

    private func colorGrid(_ items: [PaletteColor]) -> some View {
        let gap: CGFloat = 5
        return LazyVGrid(
            columns: Array(repeating: GridItem(.flexible(), spacing: gap), count: 6),
            spacing: gap
        ) {
            ForEach(items) { color in
                Button { editing = color } label: { colorCell(color) }
                    .buttonStyle(.plain)
            }
        }
    }

    // MARK: - 顶部汇总 + 筛选

    private var summaryBar: some View {
        VStack(spacing: 8) {
            HStack(spacing: 8) {
                Text("已有 \(inventory.ownedCount(palette: paletteId)) 色 · 共 \(inventory.total(palette: paletteId)) 颗")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(BeadTheme.ink)
                Spacer(minLength: 0)
                Button("清空") { confirmClear = true }
                    .font(.system(size: 13))
                    .disabled(inventory.ownedCount(palette: paletteId) == 0)
            }

            Picker("", selection: $filter) {
                ForEach(Filter.allCases) { item in
                    Text(item.rawValue).tag(item)
                }
            }
            .pickerStyle(.segmented)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(BeadTheme.surface)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(BeadTheme.separator)
                .frame(height: 1)
        }
    }

    private var emptyHint: some View {
        VStack(spacing: 8) {
            Image(systemName: "circle.grid.2x2")
                .font(.system(size: 24, weight: .light))
                .foregroundStyle(BeadTheme.muted)
            Text("还没有登记豆子")
                .font(.system(size: 15, weight: .medium))
                .foregroundStyle(BeadTheme.ink)
            Text("切到「全部」，点色块登记颗数。")
                .font(.system(size: 12))
                .foregroundStyle(BeadTheme.muted)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 60)
    }

    // MARK: - 色块

    private func colorCell(_ color: PaletteColor) -> some View {
        let count = inventory.count(palette: paletteId, code: color.code)
        let ink: Color = color.rgb.wantsDarkOverlayText
            ? Color.black.opacity(0.78)
            : Color.white.opacity(0.95)

        return RoundedRectangle(cornerRadius: 6)
            .fill(color.rgb.swiftUIColor)
            .aspectRatio(1, contentMode: .fit)
            .overlay {
                RoundedRectangle(cornerRadius: 6)
                    .strokeBorder(.black.opacity(0.08), lineWidth: 1)
            }
            .overlay {
                Text(color.code)
                    .font(.system(size: 13, weight: .bold))
                    .monospacedDigit()
                    .foregroundStyle(ink)
            }
            .overlay(alignment: .bottomTrailing) {
                if count > 0 {
                    Text("\(count)")
                        .font(.system(size: 9, weight: .bold))
                        .monospacedDigit()
                        .foregroundStyle(ink)
                        .padding(.horizontal, 3)
                        .padding(.vertical, 1)
                        .background(.white.opacity(0.78), in: Capsule())
                        .padding(2)
                }
            }
            .overlay {
                if count > 0 {
                    RoundedRectangle(cornerRadius: 7)
                        .strokeBorder(BeadTheme.accent, lineWidth: 1.5)
                        .padding(-2)
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

private struct AlphabetIndexBar: View {
    let letters: [String]
    let onSelect: (String) -> Void

    /// 当前选中字母：松手后仍保留圆底高亮。
    @State private var selected: String?
    /// 手指按住时才显示左侧气泡。
    @State private var scrubbing = false

    private let letterH: CGFloat = 13

    var body: some View {
        VStack(spacing: 0) {
            ForEach(letters, id: \.self) { letter in
                Text(letter)
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(selected == letter ? Color.white : BeadTheme.muted)
                    .frame(width: letterH, height: letterH)
                    .background {
                        if selected == letter {
                            Circle().fill(BeadTheme.accent)
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
                    if letter != selected {
                        selected = letter
                        UIImpactFeedbackGenerator(style: .medium).impactOccurred(intensity: 1.0)
                        onSelect(letter)
                    }
                }
                .onEnded { _ in scrubbing = false }
        )
        .overlay(alignment: .leading) {
            if scrubbing, let selected {
                indexBubble(selected)
                    // 再往左一些，避免被拇指挡住。
                    .offset(x: -78, y: bubbleOffset)
                    .allowsHitTesting(false)
            }
        }
        .padding(.trailing, 2)
    }

    private var bubbleOffset: CGFloat {
        guard let selected, let index = letters.firstIndex(of: selected), !letters.isEmpty else { return 0 }
        let barH = CGFloat(letters.count) * letterH
        let y = (CGFloat(index) + 0.5) * letterH
        return y - barH / 2
    }

    private func indexBubble(_ letter: String) -> some View {
        ZStack {
            HStack(spacing: 0) {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(BeadTheme.accent.opacity(0.92))
                    .frame(width: 56, height: 56)
                IndexBubbleArrow()
                    .fill(BeadTheme.accent.opacity(0.92))
                    .frame(width: 10, height: 16)
            }
            Text(letter)
                .font(.system(size: 28, weight: .bold))
                .foregroundStyle(.white)
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

/// 改颗数的小面板：快捷增减 + 直接填数。清零 / 填 0 等于移除。
private struct BeadCountSheet: View {
    let color: PaletteColor
    let paletteName: String
    let initial: Int
    let onSave: (Int) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var text = ""
    @FocusState private var focused: Bool

    var body: some View {
        NavigationStack {
            VStack(spacing: 16) {
                HStack(spacing: 10) {
                    RoundedRectangle(cornerRadius: 8)
                        .fill(color.rgb.swiftUIColor)
                        .frame(width: 44, height: 44)
                        .overlay {
                            RoundedRectangle(cornerRadius: 8)
                                .strokeBorder(.black.opacity(0.1), lineWidth: 1)
                        }
                    VStack(alignment: .leading, spacing: 2) {
                        Text(color.code)
                            .font(.system(size: 17, weight: .semibold))
                            .monospacedDigit()
                            .foregroundStyle(BeadTheme.ink)
                        Text(paletteName)
                            .font(.system(size: 12))
                            .foregroundStyle(BeadTheme.muted)
                    }
                    Spacer(minLength: 0)
                }

                HStack(spacing: 8) {
                    ForEach([-10, -1, 1, 10], id: \.self) { delta in
                        Button {
                            bump(delta)
                        } label: {
                            Text(delta > 0 ? "+\(delta)" : "\(delta)")
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(BeadTheme.ink)
                                .frame(maxWidth: .infinity)
                                .frame(height: 40)
                                .background(BeadTheme.fill, in: RoundedRectangle(cornerRadius: 10))
                        }
                        .buttonStyle(.plain)
                    }
                }

                HStack(spacing: 10) {
                    Text("已有")
                        .font(.system(size: 15))
                        .foregroundStyle(BeadTheme.ink)
                    TextField("0", text: $text)
                        .keyboardType(.numberPad)
                        .focused($focused)
                        .multilineTextAlignment(.trailing)
                        .font(.system(size: 16, weight: .semibold))
                        .monospacedDigit()
                        .frame(height: 40)
                        .padding(.horizontal, 10)
                        .background(BeadTheme.fill, in: RoundedRectangle(cornerRadius: 10))
                    Text("颗")
                        .font(.system(size: 15))
                        .foregroundStyle(BeadTheme.muted)
                }

                Button {
                    onSave(0)
                    dismiss()
                } label: {
                    Text("清零")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(.red)
                        .frame(maxWidth: .infinity)
                        .frame(height: 40)
                        .background(Color.red.opacity(0.1), in: RoundedRectangle(cornerRadius: 10))
                }
                .buttonStyle(.plain)
                .disabled(value == 0 && initial == 0)
                .opacity(value == 0 && initial == 0 ? 0.4 : 1)

                Text("清零或填 0 等于移除这个色号。")
                    .font(.system(size: 12))
                    .foregroundStyle(BeadTheme.muted)

                Spacer(minLength: 0)
            }
            .padding(16)
            .navigationTitle("登记颗数")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("取消") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("保存") {
                        onSave(value)
                        dismiss()
                    }
                }
            }
        }
        .presentationDetents([.height(360)])
        .presentationDragIndicator(.visible)
        .onAppear {
            text = initial > 0 ? String(initial) : ""
            focused = true
        }
    }

    private var value: Int { max(0, Int(text) ?? 0) }

    private func bump(_ delta: Int) {
        text = String(max(0, (Int(text) ?? 0) + delta))
    }
}

#Preview {
    NavigationStack {
        BeadInventoryView(paletteId: "mard")
    }
    .preferredColorScheme(.light)
}
