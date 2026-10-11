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
                    feature("全部高级模板与 Pro 特效")
                    feature("2× 超高清与透明背景导出")
                    feature("无限作品与年度合集海报")
                    feature("保存自己的票根模板")
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
                        if pro.isPurchasing || pro.isLoadingProduct {
                            ProgressView().tint(FrameTheme.onAccent)
                        } else {
                            Text(purchaseTitle)
                                .font(.system(size: 17, weight: .bold))
                        }
                        Spacer()
                    }
                    .padding(.vertical, 15)
                    .background(FrameTheme.accentGradient, in: RoundedRectangle(cornerRadius: 16))
                    .foregroundStyle(FrameTheme.onAccent)
                }
                .disabled(pro.isPurchasing || pro.isLoadingProduct)

                #if DEBUG
                if pro.isLocalTestMode {
                    Text("当前为 Debug 本地测试模式，不会产生真实扣款。")
                        .font(.system(size: 11))
                        .foregroundStyle(FrameTheme.muted)
                        .frame(maxWidth: .infinity, alignment: .center)
                }
                #endif

                if pro.product == nil && !pro.isLoadingProduct {
                    Button("重新加载商品") {
                        Task { await pro.loadProduct() }
                    }
                    .frame(maxWidth: .infinity)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(FrameTheme.accent)
                }

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

    private var purchaseTitle: String {
        #if DEBUG
        return pro.isLocalTestMode ? AppLocalization.text("本地测试解锁") : (pro.product?.displayPrice ?? AppLocalization.text("购买 Pro"))
        #else
        return pro.product?.displayPrice ?? AppLocalization.text("购买 Pro")
        #endif
    }

    private func feature(_ title: String) -> some View {
        Label {
            Text(LocalizedStringKey(title)).foregroundStyle(FrameTheme.text)
        } icon: {
            Image(systemName: "checkmark.circle.fill").foregroundStyle(FrameTheme.accent)
        }
    }
}
