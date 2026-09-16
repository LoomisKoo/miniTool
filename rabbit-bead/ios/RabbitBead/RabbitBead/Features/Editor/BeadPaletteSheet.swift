import Foundation
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
            HStack(spacing: BeadSpace.xs) {
                Text(title)
                    .beadBody()
                    .foregroundStyle(isSelected ? BeadTheme.primary : BeadTheme.ink)
                    .monospacedDigit()
                Spacer(minLength: BeadSpace.xs)
                Text(detail)
                    .beadCaption()
                    .foregroundStyle(BeadTheme.inkMuted48)
                    .lineLimit(1)
                if isSelected {
                    Image(systemName: "checkmark")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(BeadTheme.primary)
                }
            }
            .padding(.horizontal, 16)
            .frame(height: 48)
            .contentShape(Rectangle())
        }
        .buttonStyle(BeadPressStyle(pressedScale: 0.99))
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
            .background(BeadTheme.canvas)
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("取消") { dismiss() }
                }
            }
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarBackground(BeadTheme.parchment.opacity(0.8), for: .navigationBar)
        }
    }
}

/// 列表里两行之间的细分隔线（与卡片里的 `BeadRowDivider` 同一套观感）。
struct BeadSheetRowDivider: View {
    var body: some View {
        Rectangle()
            .fill(BeadTheme.hairline)
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
        BeadPickerSheet(title: "色卡".loc) {
            ForEach(Array(PaletteLibrary.all.enumerated()), id: \.element.id) { index, palette in
                BeadSheetOptionRow(
                    title: palette.name,
                    detail: "%ld 色".loc(palette.colors.count),
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

/// 拼板规格选择：三列卡片网格，尺寸醒目、说明在下，选中描边高亮。
struct BeadBoardSizeSheet: View {
    let selectedSize: Int
    let onSelect: (Int) -> Void

    @Environment(\.dismiss) private var dismiss

    private let columns = [
        GridItem(.flexible(), spacing: 10),
        GridItem(.flexible(), spacing: 10),
        GridItem(.flexible(), spacing: 10),
    ]

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVGrid(columns: columns, spacing: 10) {
                    ForEach(BoardSizeOption.all) { option in
                        boardCard(option)
                    }
                }
                .padding(16)
            }
            .background(BeadTheme.parchment)
            .navigationTitle("拼板规格")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("取消") { dismiss() }
                }
            }
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarBackground(BeadTheme.parchment.opacity(0.8), for: .navigationBar)
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    private func boardCard(_ option: BoardSizeOption) -> some View {
        let selected = option.size == selectedSize
        return Button {
            onSelect(option.size)
            dismiss()
        } label: {
            VStack(spacing: BeadSpace.xxs) {
                Text(option.title)
                    .beadBodyStrong()
                    .monospacedDigit()
                    .foregroundStyle(selected ? BeadTheme.primary : BeadTheme.ink)
                Text(option.detail)
                    .beadFinePrint()
                    .foregroundStyle(BeadTheme.inkMuted48)
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, BeadSpace.md)
            .padding(.horizontal, 6)
            .background(
                BeadTheme.canvas,
                in: RoundedRectangle(cornerRadius: BeadRadius.lg, style: .continuous)
            )
            .overlay {
                RoundedRectangle(cornerRadius: BeadRadius.lg, style: .continuous)
                    .strokeBorder(
                        selected ? BeadTheme.primaryFocus : BeadTheme.hairline,
                        lineWidth: selected ? 1.5 : 1
                    )
            }
        }
        .buttonStyle(BeadPressStyle(pressedScale: 0.97))
    }
}
