import SwiftUI

/// 豆色用量面板。系统导航栏 + 四列色块。
struct BeadColorsSheet: View {
    let usage: [(color: PaletteColor, count: Int)]
    let highlightedCode: String?
    let onSelect: (String?) -> Void

    @Environment(\.dismiss) private var dismiss

    private let columns = Array(repeating: GridItem(.flexible(), spacing: 8), count: 4)

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVGrid(columns: columns, spacing: 8) {
                    Button {
                        onSelect(nil)
                    } label: {
                        VStack(spacing: 4) {
                            Image(systemName: "square.grid.2x2")
                                .font(.system(size: 18, weight: .semibold))
                                .frame(width: 28, height: 28)
                            Text("全选")
                                .font(.system(size: 12, weight: .semibold))
                            Text(" ")
                                .font(.system(size: 11))
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 12))
                    }
                    .buttonStyle(.plain)
                    .overlay {
                        if highlightedCode == nil {
                            RoundedRectangle(cornerRadius: 12)
                                .strokeBorder(BeadTheme.accent, lineWidth: 1.5)
                        }
                    }

                    ForEach(usage, id: \.color.code) { item in
                        Button {
                            onSelect(highlightedCode == item.color.code ? nil : item.color.code)
                        } label: {
                            VStack(spacing: 4) {
                                RoundedRectangle(cornerRadius: 8)
                                    .fill(item.color.rgb.swiftUIColor)
                                    .overlay {
                                        RoundedRectangle(cornerRadius: 8)
                                            .strokeBorder(.black.opacity(0.08), lineWidth: 1)
                                    }
                                    .frame(width: 28, height: 28)
                                Text(item.color.code)
                                    .font(.system(size: 12, weight: .semibold))
                                    .lineLimit(1)
                                    .minimumScaleFactor(0.7)
                                Text("\(item.count)颗")
                                    .font(.system(size: 11))
                                    .foregroundStyle(.secondary)
                                    .monospacedDigit()
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                            .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 12))
                        }
                        .buttonStyle(.plain)
                        .overlay {
                            if highlightedCode == item.color.code {
                                RoundedRectangle(cornerRadius: 12)
                                    .strokeBorder(BeadTheme.accent, lineWidth: 1.5)
                            }
                        }
                    }
                }
                .padding(16)
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("豆色")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("完成") { dismiss() }
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }
}

/// 画笔豆色选择。系统导航栏 + 整张色卡。
struct BeadBrushSheet: View {
    let palette: BeadPalette
    let counts: [String: Int]
    let selectedCode: String?
    let onSelect: (String) -> Void

    @Environment(\.dismiss) private var dismiss

    private let columns = Array(repeating: GridItem(.flexible(), spacing: 8), count: 4)

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVGrid(columns: columns, spacing: 8) {
                    ForEach(palette.colors) { color in
                        Button {
                            onSelect(color.code)
                            dismiss()
                        } label: {
                            VStack(spacing: 4) {
                                RoundedRectangle(cornerRadius: 8)
                                    .fill(color.rgb.swiftUIColor)
                                    .overlay {
                                        RoundedRectangle(cornerRadius: 8)
                                            .strokeBorder(.black.opacity(0.08), lineWidth: 1)
                                    }
                                    .frame(width: 28, height: 28)
                                Text(color.code)
                                    .font(.system(size: 12, weight: .semibold))
                                    .lineLimit(1)
                                    .minimumScaleFactor(0.7)
                                Text(counts[color.code].map { "\($0)颗" } ?? " ")
                                    .font(.system(size: 11))
                                    .foregroundStyle(.secondary)
                                    .monospacedDigit()
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                            .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 12))
                        }
                        .buttonStyle(.plain)
                        .overlay {
                            if selectedCode == color.code {
                                RoundedRectangle(cornerRadius: 12)
                                    .strokeBorder(BeadTheme.accent, lineWidth: 1.5)
                            }
                        }
                    }
                }
                .padding(16)
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("画笔豆色")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("取消") { dismiss() }
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }
}
