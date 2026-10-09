import SwiftUI

struct PaywallView: View {
    @Environment(ProStore.self) private var pro
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 18) {
                Image(systemName: "sparkles.rectangle.stack")
                    .font(.system(size: 26, weight: .regular))
                    .foregroundStyle(FrameTheme.onAccent)
                    .frame(width: 60, height: 60)
                    .background(FrameTheme.accentGradient, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                Text("帧藏 Pro")
                    .font(.system(size: 30, weight: .bold, design: .serif))
                    .foregroundStyle(FrameTheme.accentStrong)
                Text("解锁完整的票根素材库，把每一段记忆做成更像收藏品的票根。")
                    .foregroundStyle(FrameTheme.textSecondary)

                VStack(alignment: .leading, spacing: 12) {
                    feature("高级票根模板与特效")
                    feature("高清无水印导出")
                    feature("更多本地作品保存")
                }
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(FrameTheme.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(FrameTheme.line, lineWidth: 1))

                if pro.isPro {
                    Label("已解锁全部 Pro 功能", systemImage: "crown.fill")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(FrameTheme.accent)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 15)
                        .background(FrameTheme.accentDim, in: RoundedRectangle(cornerRadius: 16))
                } else {
                Button {
                    Task { await pro.purchase() }
                } label: {
                    HStack {
                        Spacer()
                        if pro.isPurchasing {
                            ProgressView().tint(FrameTheme.onAccent)
                        } else {
                            Text(pro.product?.displayPrice ?? "购买 Pro")
                                .font(.system(size: 17, weight: .bold))
                        }
                        Spacer()
                    }
                    .padding(.vertical, 15)
                    .background(FrameTheme.accentGradient, in: RoundedRectangle(cornerRadius: 16))
                    .foregroundStyle(FrameTheme.onAccent)
                }
                .disabled(pro.isPurchasing || pro.product == nil)

                Button("恢复购买") {
                    Task { await pro.restore() }
                }
                .frame(maxWidth: .infinity)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(FrameTheme.textSecondary)
                }

                if let error = pro.errorMessage {
                    Text(error)
                        .font(.caption)
                        .foregroundStyle(.red)
                }
                Spacer()
            }
            .padding(24)
            .foregroundStyle(FrameTheme.text)
            .navigationTitle("升级")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("关闭") { dismiss() }
                }
            }
        }
        .tint(FrameTheme.accent)
        .presentationBackground(FrameTheme.panel)
        .task { await pro.loadProduct() }
    }

    private func feature(_ title: String) -> some View {
        Label {
            Text(title).foregroundStyle(FrameTheme.text)
        } icon: {
            Image(systemName: "checkmark.circle.fill").foregroundStyle(FrameTheme.accent)
        }
    }
}
