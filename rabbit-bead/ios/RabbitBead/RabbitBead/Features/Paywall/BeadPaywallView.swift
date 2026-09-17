import Foundation
import SwiftUI

/// Pro 买断付费墙。
struct BeadPaywallView: View {
    @Environment(\.dismiss) private var dismiss

    private var store: EntitlementStore { EntitlementStore.shared }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: BeadSpace.md) {
                    header
                    benefits
                    VStack(spacing: BeadSpace.xs) {
                        purchaseButton
                        restoreButton
                    }
                    footnote
                }
                .padding(.horizontal, BeadSpace.md)
                .padding(.top, BeadSpace.xs)
                .padding(.bottom, BeadSpace.lg)
            }
            .background {
                BeadTheme.parchmentGradient.ignoresSafeArea()
            }
            .navigationTitle("解锁 Pro")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("关闭") { dismiss() }
                }
            }
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarBackground(BeadTheme.parchment.opacity(0.8), for: .navigationBar)
            .alert("提示", isPresented: messageBinding) {
                Button("好") { store.message = nil }
            } message: {
                Text(store.message ?? "")
            }
            .task { await store.refresh() }
        }
        // 内容比 medium 高：只给 .large 一档，进来就是完整的，不用手动上拉。
        .presentationDetents([.large])
    }

    /// 淡蓝整幅区块：把一个「买断」的承诺说得像产品，而不是像结算页。
    ///
    /// 浅色模式下用淡蓝面（不是近黑块）：白底页面上压一块黑会显得突兀，
    /// 也把「买断」说得像警告。
    private var header: some View {
        BeadProTile(padding: BeadSpace.lg) {
            Text("一次买断，永久使用")
                .beadDisplayLg()
                .foregroundStyle(BeadTheme.ink)
                .padding(.bottom, BeadSpace.xs)
            Text("核心转图流程继续免费；Pro 解锁认真拼豆才用得到的深度能力。")
                .beadBody()
                .foregroundStyle(BeadTheme.inkMuted48)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var benefits: some View {
        BeadCard(padding: BeadSpace.md) {
            VStack(alignment: .leading, spacing: BeadSpace.sm) {
                benefit("豆库限色".loc, "只用手头有的色号出图，图纸能真拼".loc)
                benefit("高清打印导出".loc, "300DPI 原尺寸，去掉底部署名".loc)
                benefit("智能去背景".loc, "白底照片不再铺出一片白豆".loc)
                benefit("无限作品库".loc, "免费版最多 %ld 个".loc(ProjectStore.freeLimit))
            }
        }
    }

    private func benefit(_ title: String, _ detail: String) -> some View {
        HStack(alignment: .top, spacing: BeadSpace.xs) {
            Image(systemName: "checkmark")
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(BeadTheme.onPrimary)
                .frame(width: 22, height: 22)
                .background(BeadTheme.primaryGradient, in: Circle())
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .beadRowTitle()
                    .foregroundStyle(BeadTheme.ink)
                Text(detail)
                    .beadCaption()
                    .foregroundStyle(BeadTheme.inkMuted48)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private var purchaseButton: some View {
        BeadButton(
            title: purchaseTitle,
            kind: .primary,
            fullWidth: true,
            enabled: !store.isBusy
        ) {
            Task { await store.purchase() }
        }
    }

    private var restoreButton: some View {
        BeadButton(
            title: "恢复购买".loc,
            kind: .ghost,
            fullWidth: true,
            enabled: !store.isBusy
        ) {
            Task { await store.restore() }
        }
    }

    private var footnote: some View {
        Text("非订阅，一次买断。可在此页恢复购买。")
            .beadFinePrint()
            .foregroundStyle(BeadTheme.inkMuted48)
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity, alignment: .center)
            .padding(.top, BeadSpace.xxs)
    }

    /// 商品信息没拉到时不编一个价格出来：国际区价格由 ASC 定，写死「¥18」是错的。
    private var purchaseTitle: String {
        if store.isBusy { return "处理中…".loc }
        guard let price = store.product?.displayPrice else { return "解锁 Pro".loc }
        return "解锁 Pro · %@".loc(price)
    }

    private var messageBinding: Binding<Bool> {
        Binding(
            get: { store.message != nil },
            set: { if !$0 { store.message = nil } }
        )
    }
}
