import Foundation
import SwiftUI

/// 豆色用量面板。系统导航栏 + 四列色块。
struct BeadColorsSheet: View {
    let usage: [(color: PaletteColor, count: Int)]
    let highlightedCode: String?
    let onSelect: (String?) -> Void

    @Environment(\.dismiss) private var dismiss

    private let columns = Array(repeating: GridItem(.flexible(), spacing: BeadSpace.xs), count: 4)

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVGrid(columns: columns, spacing: BeadSpace.xs) {
                    Button {
                        onSelect(nil)
                    } label: {
                        cellBackground(selected: highlightedCode == nil) {
                            Image(systemName: "square.grid.2x2")
                                .font(.system(size: 18, weight: .semibold))
                                .foregroundStyle(
                                    highlightedCode == nil ? BeadTheme.primary : BeadTheme.ink
                                )
                                .frame(width: 28, height: 28)
                            Text("全选")
                                .beadDigits(12, weight: .semibold)
                                .foregroundStyle(BeadTheme.ink)
                            Text(" ")
                                .beadMicroLegal()
                        }
                    }
                    .buttonStyle(BeadPressStyle(pressedScale: 0.97))

                    ForEach(usage, id: \.color.code) { item in
                        Button {
                            onSelect(highlightedCode == item.color.code ? nil : item.color.code)
                        } label: {
                            cellBackground(selected: highlightedCode == item.color.code) {
                                BeadSwatch(color: item.color.rgb.swiftUIColor, size: 28, radius: BeadRadius.sm)
                                Text(item.color.code)
                                    .beadDigits(12, weight: .semibold)
                                    .foregroundStyle(BeadTheme.ink)
                                    .lineLimit(1)
                                    .minimumScaleFactor(0.7)
                                Text("%ld颗".loc(item.count))
                                    .beadDigits(11, weight: .regular)
                                    .foregroundStyle(BeadTheme.inkMuted48)
                            }
                        }
                        .buttonStyle(BeadPressStyle(pressedScale: 0.97))
                    }
                }
                .padding(BeadSpace.md)
            }
            .background(BeadTheme.parchment)
            .navigationTitle("豆色")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("完成") { dismiss() }
                }
            }
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarBackground(BeadTheme.parchment.opacity(0.8), for: .navigationBar)
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    /// 白色工具小卡：1px 细边 + 选中时换 1.5pt 蓝边。
    private func cellBackground<Content: View>(
        selected: Bool,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(spacing: BeadSpace.xxs) { content() }
            .frame(maxWidth: .infinity)
            .padding(.vertical, BeadSpace.sm)
            .background(
                BeadTheme.canvas,
                in: RoundedRectangle(cornerRadius: BeadRadius.md, style: .continuous)
            )
            .overlay {
                RoundedRectangle(cornerRadius: BeadRadius.md, style: .continuous)
                    .strokeBorder(
                        selected ? BeadTheme.primaryFocus : BeadTheme.hairline,
                        lineWidth: selected ? 1.5 : 1
                    )
            }
    }
}

/// 画笔豆色选择。系统导航栏 + 整张色卡。
struct BeadBrushSheet: View {
    let palette: BeadPalette
    let counts: [String: Int]
    let selectedCode: String?
    let onSelect: (String) -> Void

    @Environment(\.dismiss) private var dismiss

    private let columns = Array(repeating: GridItem(.flexible(), spacing: BeadSpace.xs), count: 4)

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVGrid(columns: columns, spacing: BeadSpace.xs) {
                    ForEach(palette.colors) { color in
                        Button {
                            onSelect(color.code)
                            dismiss()
                        } label: {
                            VStack(spacing: BeadSpace.xxs) {
                                BeadSwatch(color: color.rgb.swiftUIColor, size: 28, radius: BeadRadius.sm)
                                Text(color.code)
                                    .beadDigits(12, weight: .semibold)
                                    .foregroundStyle(BeadTheme.ink)
                                    .lineLimit(1)
                                    .minimumScaleFactor(0.7)
                                Text(counts[color.code].map { "%ld颗".loc($0) } ?? " ")
                                    .beadDigits(11, weight: .regular)
                                    .foregroundStyle(BeadTheme.inkMuted48)
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, BeadSpace.sm)
                            .background(
                                BeadTheme.canvas,
                                in: RoundedRectangle(cornerRadius: BeadRadius.md, style: .continuous)
                            )
                            .overlay {
                                RoundedRectangle(cornerRadius: BeadRadius.md, style: .continuous)
                                    .strokeBorder(
                                        selectedCode == color.code
                                            ? BeadTheme.primaryFocus
                                            : BeadTheme.hairline,
                                        lineWidth: selectedCode == color.code ? 1.5 : 1
                                    )
                            }
                        }
                        .buttonStyle(BeadPressStyle(pressedScale: 0.97))
                    }
                }
                .padding(BeadSpace.md)
            }
            .background(BeadTheme.parchment)
            .navigationTitle("画笔豆色")
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
}
