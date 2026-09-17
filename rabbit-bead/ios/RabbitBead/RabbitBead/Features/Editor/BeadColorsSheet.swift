import Foundation
import SwiftUI

/// 豆色用量面板。系统导航栏 + 四列色块。
struct BeadColorsSheet: View {
    let usage: [(color: PaletteColor, count: Int)]
    let highlightedCode: String?
    let onSelect: (String?) -> Void

    @Environment(\.dismiss) private var dismiss

    private let columns = Array(repeating: GridItem(.flexible(), spacing: 5), count: 6)

    var body: some View {
        NavigationStack {
            ScrollView {
                Text("当前图纸包含的颜色，点击后高亮".loc)
                    .beadFinePrint()
                    .foregroundStyle(BeadTheme.inkMuted48)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, BeadSpace.md)
                    .padding(.top, BeadSpace.xs)
                    .padding(.bottom, BeadSpace.xs)
                
                LazyVGrid(columns: columns, spacing: BeadSpace.xs) {
                    Button {
                        onSelect(nil)
                    } label: {
                        selectAllCell(selected: highlightedCode == nil) {
                            Text("全部".loc)
                                .beadDigits(12, weight: .semibold)
                                .foregroundStyle(BeadTheme.ink)
                        }
                    }
                    .buttonStyle(.automatic)

                    ForEach(usage, id: \.color.code) { item in
                        Button {
                            onSelect(highlightedCode == item.color.code ? nil : item.color.code)
                        } label: {
                            colorCell(item)
                        }
                        .buttonStyle(.automatic)
                    }
                }
                .padding(.horizontal, BeadSpace.md)
                .padding(.bottom, BeadSpace.md)
            }
            .background {
                BeadTheme.parchmentGradient.ignoresSafeArea()
            }
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

    /// 工具小卡：选中时淡蓝底 + 蓝边。
    private func cellBackground<Content: View>(
        selected: Bool,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(spacing: BeadSpace.xxs) { content() }
            .frame(maxWidth: .infinity)
            .padding(.vertical, BeadSpace.sm)
            .background(
                selected ? BeadTheme.accentSoft : BeadTheme.canvas,
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

    /// 与色卡页一致的实色色块：色号居中，数量放在底部。
    private func colorCell(_ item: (color: PaletteColor, count: Int)) -> some View {
        RoundedRectangle(cornerRadius: BeadRadius.sm, style: .continuous)
            .fill(item.color.rgb.swiftUIColor)
            .aspectRatio(1, contentMode: .fit)
            .overlay {
                Text(item.color.code)
                    .beadDigits(13, weight: .semibold)
                    .foregroundStyle(item.color.rgb.legendInk.swiftUIColor)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
            .overlay {
                RoundedRectangle(cornerRadius: BeadRadius.sm, style: .continuous)
                    .strokeBorder(
                        highlightedCode == item.color.code
                            ? BeadTheme.primary
                            : Color.black.opacity(0.08),
                        lineWidth: highlightedCode == item.color.code ? 2 : 1
                    )
            }
            .overlay(alignment: .bottomTrailing) {
                Text("\(item.count)")
                    .beadDigits(10, weight: .semibold)
                    .foregroundStyle(item.color.rgb.legendInk.swiftUIColor)
                    .padding(5)
            }
    }

    private func selectAllCell<Content: View>(
        selected: Bool,
        @ViewBuilder content: () -> Content
    ) -> some View {
        RoundedRectangle(cornerRadius: BeadRadius.sm, style: .continuous)
            .fill(selected ? BeadTheme.accentSoft : BeadTheme.canvas)
            .aspectRatio(1, contentMode: .fit)
            .overlay {
                content()
            }
            .overlay {
                RoundedRectangle(cornerRadius: BeadRadius.sm, style: .continuous)
                    .strokeBorder(
                        selected ? BeadTheme.primaryFocus : BeadTheme.swatchStrokeSoft,
                        lineWidth: selected ? 2 : 1
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
                                selectedCode == color.code
                                    ? BeadTheme.accentSoft
                                    : BeadTheme.canvas,
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
                        .buttonStyle(.automatic)
                    }
                }
                .padding(BeadSpace.md)
            }
            .background {
                BeadTheme.parchmentGradient.ignoresSafeArea()
            }
            .navigationTitle("画笔豆色")
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
}
