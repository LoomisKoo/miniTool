import StoreKit
import SwiftUI

/* Pro 付费墙与标识组件。价格一律走 StoreKit Product.displayPrice，不写死。 */

struct ProBadge: View {
    var body: some View {
        Text("PRO")
            .font(.system(size: 10, weight: .bold))
            .foregroundStyle(.white)
            .padding(.horizontal, 7)
            .padding(.vertical, 3)
            .background(NamingTheme.gradient, in: Capsule())
    }
}

struct ProLockRow: View {
    let feature: ProFeature
    @Environment(ProStore.self) private var pro

    var body: some View {
        Button {
            _ = pro.require(feature)
        } label: {
            HStack(spacing: 10) {
                Image(systemName: "lock.fill")
                    .font(.system(size: 13))
                    .foregroundStyle(NamingTheme.primaryDeep)
                VStack(alignment: .leading, spacing: 2) {
                    Text(L10n.t("解锁全部") + " · " + feature.title)
                        .font(.system(size: 13.5, weight: .semibold))
                        .foregroundStyle(NamingTheme.ink)
                    Text(feature.blurb)
                        .font(.system(size: 12))
                        .foregroundStyle(NamingTheme.muted)
                        .lineLimit(2)
                }
                Spacer(minLength: 0)
                ProBadge()
            }
            .padding(14)
            .background(NamingTheme.primary.opacity(0.08),
                        in: RoundedRectangle(cornerRadius: NamingRadius.medium, style: .continuous))
        }
        .buttonStyle(NamingPressButtonStyle())
    }
}

struct ProSheet: View {
    @Environment(ProStore.self) private var pro
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    Text(L10n.t("仙鹿起名 Pro"))
                        .font(.system(size: 26, weight: .bold))
                        .foregroundStyle(NamingTheme.ink)
                    Text(L10n.t("一次买断，永久解锁。适合取完名就收起来的工具。"))
                        .font(.system(size: 14))
                        .foregroundStyle(NamingTheme.muted)

                    VStack(spacing: 10) {
                        ForEach(ProFeature.allCases) { f in
                            HStack(alignment: .top, spacing: 12) {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundStyle(NamingTheme.primaryDeep)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(f.title)
                                        .font(.system(size: 15, weight: .semibold))
                                        .foregroundStyle(NamingTheme.ink)
                                    Text(f.blurb)
                                        .font(.system(size: 13))
                                        .foregroundStyle(NamingTheme.muted)
                                }
                                Spacer(minLength: 0)
                            }
                            .padding(12)
                            .background(NamingTheme.canvas,
                                        in: RoundedRectangle(cornerRadius: NamingRadius.medium, style: .continuous))
                        }
                    }

                    if let err = pro.lastError, !err.isEmpty {
                        Text(err)
                            .font(.system(size: 12.5))
                            .foregroundStyle(NamingTheme.primaryDeep)
                    }

                    Button {
                        Task { await pro.purchase() }
                    } label: {
                        HStack {
                            if pro.purchasing { ProgressView().tint(.white) }
                            Text(buyLabel)
                                .font(.system(size: 16, weight: .semibold))
                        }
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(NamingTheme.gradient, in: Capsule())
                    }
                    .buttonStyle(NamingPressButtonStyle())
                    .disabled(pro.purchasing || pro.isPro)

                    Button(L10n.t("恢复购买")) {
                        Task { await pro.restore() }
                    }
                    .font(.system(size: 14))
                    .foregroundStyle(NamingTheme.primaryDeep)
                    .frame(maxWidth: .infinity)

                    HStack(spacing: 18) {
                        NavigationLink(L10n.t("隐私政策")) {
                            LegalDocumentView(document: .privacy)
                        }
                        NavigationLink(L10n.t("服务条款")) {
                            LegalDocumentView(document: .terms)
                        }
                    }
                    .font(.system(size: 12.5))
                    .foregroundStyle(NamingTheme.primaryDeep)
                    .frame(maxWidth: .infinity)

                    Text(L10n.t("购买为一次性买断，不会自动续费。家庭共享可用。"))
                        .font(.system(size: 11.5))
                        .foregroundStyle(NamingTheme.muted)
                        .frame(maxWidth: .infinity)
                }
                .padding(22)
            }
            .namingPageBackground()
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(L10n.t("关闭")) { dismiss() }
                }
            }
        }
        .onAppear {
            Task { await pro.loadProduct() }
        }
        .onChange(of: pro.isPro) { _, unlocked in
            if unlocked { dismiss() }
        }
    }

    private var buyLabel: String {
        if pro.isPro { return L10n.t("已解锁") }
        if let p = pro.product {
            return L10n.f("立即解锁 · %@", p.displayPrice)
        }
        return L10n.t("立即解锁")
    }
}

struct ProStatusCard: View {
    @Environment(ProStore.self) private var pro

    var body: some View {
        Button {
            if !pro.isPro { pro.showPaywall = true }
        } label: {
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 8) {
                        Text(L10n.t("仙鹿起名 Pro"))
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(NamingTheme.ink)
                        if pro.isPro { ProBadge() }
                    }
                    Text(pro.isPro
                         ? L10n.t("已解锁终身权益")
                         : L10n.t("解锁小名、试听与无水印卡片"))
                        .font(.system(size: 12.5))
                        .foregroundStyle(NamingTheme.muted)
                }
                Spacer(minLength: 0)
                Text(pro.isPro ? L10n.t("已开通") : L10n.t("了解权益"))
                    .font(.system(size: 13))
                    .foregroundStyle(NamingTheme.primaryDeep)
            }
            .padding(16)
            .background(NamingTheme.canvas,
                        in: RoundedRectangle(cornerRadius: NamingRadius.large, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: NamingRadius.large, style: .continuous)
                    .strokeBorder(NamingTheme.hairline, lineWidth: 1)
            }
        }
        .buttonStyle(NamingPressButtonStyle())
    }
}
