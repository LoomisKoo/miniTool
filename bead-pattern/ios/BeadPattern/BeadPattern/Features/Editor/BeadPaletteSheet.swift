import SwiftUI

/// 色卡选择。系统导航栏 + 列表。
struct BeadPaletteSheet: View {
    let selectedId: String
    let onSelect: (String) -> Void

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                ForEach(PaletteLibrary.all) { palette in
                    Button {
                        onSelect(palette.id)
                        dismiss()
                    } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(palette.name)
                                    .font(.body.weight(.semibold))
                                    .foregroundStyle(.primary)
                                Text("\(palette.colors.count) 色")
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            if palette.id == selectedId {
                                Image(systemName: "checkmark")
                                    .foregroundStyle(BeadTheme.accent)
                                    .fontWeight(.semibold)
                            }
                        }
                    }
                }
            }
            .navigationTitle("色卡")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("取消") { dismiss() }
                }
            }
        }
        .presentationDetents([.medium])
        .presentationDragIndicator(.visible)
    }
}

/// 拼板规格选择。系统导航栏 + 列表。
struct BeadBoardSizeSheet: View {
    let selectedSize: Int
    let onSelect: (Int) -> Void

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                ForEach(BoardSizeOption.all) { option in
                    Button {
                        onSelect(option.size)
                        dismiss()
                    } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(option.title)
                                    .font(.body.weight(.semibold))
                                    .foregroundStyle(.primary)
                                Text(option.detail)
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            if option.size == selectedSize {
                                Image(systemName: "checkmark")
                                    .foregroundStyle(BeadTheme.accent)
                                    .fontWeight(.semibold)
                            }
                        }
                    }
                }
            }
            .navigationTitle("拼板规格")
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
