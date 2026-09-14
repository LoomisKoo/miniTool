import SwiftUI

/// 选择类弹层的单行选项：标题在左、说明并在行尾，选中行用主色 + 勾。
///
/// 说明不再单独占一行，行高固定 44pt，列表比系统默认样式紧凑不少。
struct BeadSheetOptionRow: View {
    let title: String
    let detail: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Text(title)
                    .font(.system(size: 16, weight: isSelected ? .semibold : .regular))
                    .foregroundStyle(isSelected ? BeadTheme.accent : BeadTheme.ink)
                    .monospacedDigit()
                Spacer(minLength: 8)
                Text(detail)
                    .font(.system(size: 13))
                    .foregroundStyle(BeadTheme.muted)
                    .lineLimit(1)
                if isSelected {
                    Image(systemName: "checkmark")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(BeadTheme.accent)
                }
            }
            .padding(.horizontal, 16)
            .frame(height: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

/// 选择类弹层的外壳：白底、贴着导航栏起内容的滚动列表。
///
/// 不用 `List`：`List` 的默认分组样式会在导航栏下留一大段空白，
/// 直接 `ScrollView` 排布才能贴齐（对齐 H5 `.sheet-option` 的紧凑观感）。
struct BeadPickerSheet<Content: View>: View {
    let title: String
    @ViewBuilder var content: () -> Content

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(spacing: 0) {
                    content()
                }
            }
            .background(BeadTheme.surface)
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("取消") { dismiss() }
                }
            }
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarBackground(BeadTheme.surface, for: .navigationBar)
        }
    }
}

/// 列表里两行之间的细分隔线（与卡片里的 `BeadRowDivider` 同一套观感）。
struct BeadSheetRowDivider: View {
    var body: some View {
        Rectangle()
            .fill(BeadTheme.separator)
            .frame(height: 0.5)
            .padding(.leading, 16)
    }
}

/// 色卡选择。
struct BeadPaletteSheet: View {
    let selectedId: String
    let onSelect: (String) -> Void

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        BeadPickerSheet(title: "色卡") {
            ForEach(Array(PaletteLibrary.all.enumerated()), id: \.element.id) { index, palette in
                BeadSheetOptionRow(
                    title: palette.name,
                    detail: "\(palette.colors.count) 色",
                    isSelected: palette.id == selectedId
                ) {
                    onSelect(palette.id)
                    dismiss()
                }
                if index < PaletteLibrary.all.count - 1 {
                    BeadSheetRowDivider()
                }
            }
        }
        .presentationDetents([.medium])
        .presentationDragIndicator(.visible)
    }
}

/// 拼板规格选择。紧凑单行列表：一行一个规格，「xx方板」这类说明并在行尾。
struct BeadBoardSizeSheet: View {
    let selectedSize: Int
    let onSelect: (Int) -> Void

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        BeadPickerSheet(title: "拼板规格") {
            ForEach(Array(BoardSizeOption.all.enumerated()), id: \.element.id) { index, option in
                BeadSheetOptionRow(
                    title: option.title,
                    detail: option.detail,
                    isSelected: option.size == selectedSize
                ) {
                    onSelect(option.size)
                    dismiss()
                }
                if index < BoardSizeOption.all.count - 1 {
                    BeadSheetRowDivider()
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }
}
