import SwiftUI

/// 图纸选项面板。系统导航栏 + 分组列表。
struct BeadExportSheet: View {
    @Binding var options: ExportOptions
    let boardCount: Int
    let onSave: () -> Void

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Text(scopeText)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                if boardCount > 1 {
                    Section("导出范围") {
                        ForEach(BoardScope.allCases) { scope in
                            Button {
                                options.boardScope = scope
                            } label: {
                                HStack {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(scope.title)
                                            .foregroundStyle(.primary)
                                        Text(scope.detail)
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                    }
                                    Spacer()
                                    if options.boardScope == scope {
                                        Image(systemName: "checkmark")
                                            .foregroundStyle(BeadTheme.accent)
                                    }
                                }
                            }
                        }
                    }
                }

                Section("图纸内容") {
                    Toggle(isOn: $options.coordinates) {
                        labeled("行列坐标", "顶行列号 + 左侧行号")
                    }
                    Toggle(isOn: $options.codes) {
                        labeled("格内色号", "每格标注豆色编号")
                    }
                    Toggle(isOn: $options.legend) {
                        labeled("用量图例", "色块 + 编号 + 颗数")
                    }
                    Toggle(isOn: $options.title) {
                        labeled("标题信息", "品牌 + 尺寸 + 第几板")
                    }
                    if boardCount > 1, options.boardScope == .full {
                        Toggle(isOn: $options.boardSeams) {
                            labeled("板间分割线", "拼板对位用")
                        }
                    }
                }
            }
            .navigationTitle("图纸选项")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("取消") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("保存") {
                        dismiss()
                        onSave()
                    }
                    .fontWeight(.semibold)
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    private func labeled(_ title: String, _ detail: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
            Text(detail)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }

    private var scopeText: String {
        guard boardCount > 1 else { return "将导出整幅拼图" }
        if options.boardScope == .each {
            return "将依次导出 \(boardCount) 张分板图纸（每板含本板用量）"
        }
        return options.boardSeams
            ? "将导出整幅拼图（含板间分割线）"
            : "将导出整幅拼图"
    }
}
