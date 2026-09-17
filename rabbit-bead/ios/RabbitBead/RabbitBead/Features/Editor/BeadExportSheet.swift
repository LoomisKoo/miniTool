import Foundation
import SwiftUI

/// 图纸选项面板。系统导航栏 + 分组列表。
struct BeadExportSheet: View {
    @Binding var options: ExportOptions
    let boardCount: Int
    let onSave: () -> Void

    @Environment(\.dismiss) private var dismiss

    private var isPro: Bool { EntitlementStore.shared.isPro }

    var body: some View {
        NavigationStack {
            List {
                // 导出范围 + 免费 / Pro 差别合成一块，且不带卡片底：
                // 这两句只是说明，各自铺白底会把本来就不高的面板撑得很重。
                Section {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(scopeText)
                            .beadFinePrint()
                            .foregroundStyle(BeadTheme.inkMuted48)
                        qualityLine
                    }
                    .fixedSize(horizontal: false, vertical: true)
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)
                    .listRowInsets(EdgeInsets(top: 0, leading: 4, bottom: 0, trailing: 4))
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
                                            .beadBody()
                                            .foregroundStyle(BeadTheme.ink)
                                        Text(scope.detail)
                                            .beadFinePrint()
                                            .foregroundStyle(BeadTheme.inkMuted48)
                                    }
                                    Spacer()
                                    if options.boardScope == scope {
                                        Image(systemName: "checkmark")
                                            .foregroundStyle(BeadTheme.primary)
                                    }
                                }
                            }
                        }
                    }
                }

                Section("图纸内容") {
                    Toggle(isOn: $options.coordinates) {
                        labeled("行列坐标".loc, "四边一圈坐标格，紧贴图案".loc)
                    }
                    Toggle(isOn: $options.codes) {
                        labeled("格内色号".loc, "每格标注豆色编号".loc)
                    }
                    Toggle(isOn: $options.legend) {
                        labeled("用量图例".loc, "色块 + 编号 + 颗数".loc)
                    }
                    Toggle(isOn: $options.title) {
                        labeled("标题信息".loc, "品牌 + 尺寸 + 第几板".loc)
                    }
                    if boardCount > 1, options.boardScope == .full {
                        Toggle(isOn: $options.boardSeams) {
                            labeled("板间分割线".loc, "拼板对位用".loc)
                        }
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .background {
                BeadTheme.parchmentGradient.ignoresSafeArea()
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
                    .foregroundStyle(BeadTheme.primary)
                }
            }
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarBackground(BeadTheme.parchment.opacity(0.8), for: .navigationBar)
        }
        // 一开始就要能看到全部选项（medium 那档会把「图纸内容」切掉一半，
        // 必须手动上拉才看得全）。
        .presentationDetents([.large])
    }

    /// 免费 / Pro 差别这一句。需要 Pro 时挂小锁：点一下先收导出面板，再由根上弹付费墙
    /// （嵌套 sheet 容易闪一下就没）。
    @ViewBuilder
    private var qualityLine: some View {
        if isPro {
            HStack(spacing: 4) {
                Image(systemName: "checkmark.seal.fill")
                    .font(.system(size: 11, weight: .bold))
                Text("Pro：300DPI 原尺寸，无底部署名")
            }
            .beadFinePrint()
            .foregroundStyle(BeadTheme.primary)
        } else {
            Button {
                dismiss()
                // 等导出面板收完再弹根上的付费墙，避免两层 sheet 抢 present。
                Task { @MainActor in
                    try? await Task.sleep(for: .milliseconds(320))
                    EntitlementStore.shared.showPaywall = true
                }
            } label: {
                HStack(spacing: 4) {
                    Image(systemName: "lock.fill")
                        .font(.system(size: 10, weight: .bold))
                        .opacity(0.85)
                    Text("免费版为预览尺寸并带署名；解锁 Pro 可导出打印级高清")
                }
                .beadFinePrint()
                .foregroundStyle(BeadTheme.inkMuted48)
                .multilineTextAlignment(.leading)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("解锁 Pro，导出打印级高清")
        }
    }

    private func labeled(_ title: String, _ detail: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .beadBody()
                .foregroundStyle(BeadTheme.ink)
            Text(detail)
                .beadFinePrint()
                .foregroundStyle(BeadTheme.inkMuted48)
        }
    }

    private var scopeText: String {
        guard boardCount > 1 else { return "将导出整幅拼图".loc }
        if options.boardScope == .each {
            return "将依次导出 %ld 张分板图纸（每板含本板用量）".loc(boardCount)
        }
        return options.boardSeams
            ? "将导出整幅拼图（含板间分割线）".loc
            : "将导出整幅拼图".loc
    }
}
