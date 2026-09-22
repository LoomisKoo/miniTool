import SwiftUI

struct SettingsView: View {
    /* 读一次语言只是为了**订阅**它：设置这几页在 sheet 里，换语言时要跟着重画
     * （`L10n.t` 是普通函数，SwiftUI 不知道它依赖语言）。不能在这儿 `.id(appLanguage)`：
     * 这一页是 sheet 内 NavigationStack 的根，把自己 id 掉会把子页弹回去。 */
    @AppStorage(L10n.storageKey) private var appLanguage = ""

    @Environment(NamingAppModel.self) private var model
    @Environment(ProStore.self) private var pro

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                NamingCard(padding: 8) {
                    settingsLink(L10n.t("语言"), subtitle: languageLabel, systemImage: "globe") {
                        LanguageSettingsView()
                    }
                    Divider().overlay(NamingTheme.hairline)
                    settingsLink(L10n.t("关于仙鹿起名"), subtitle: L10n.t("名字从哪来"), systemImage: "info.circle") {
                        AboutView()
                    }
                    Divider().overlay(NamingTheme.hairline)
                    settingsLink(L10n.t("隐私政策"), subtitle: L10n.t("我们如何处理你的信息"), systemImage: "hand.raised") {
                        LegalDocumentView(document: .privacy)
                    }
                    Divider().overlay(NamingTheme.hairline)
                    settingsLink(L10n.t("服务条款"), subtitle: L10n.t("使用应用前请阅读"), systemImage: "doc.text") {
                        LegalDocumentView(document: .terms)
                    }
                }

                NamingCard {
                    HStack {
                        Text(L10n.t("仙鹿起名 Pro"))
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(NamingTheme.ink)
                        Spacer()
                        if pro.isPro {
                            ProBadge()
                        } else {
                            Text(L10n.t("未开通"))
                                .font(.system(size: 13))
                                .foregroundStyle(NamingTheme.muted)
                        }
                    }
                    if !pro.isPro {
                        Button(L10n.t("了解权益")) {
                            model.showSettings = false
                            pro.showPaywall = true
                        }
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(NamingTheme.primaryDeep)
                        .padding(.top, 12)
                    }
                    Button(L10n.t("恢复购买")) {
                        Task { await pro.restore() }
                    }
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(NamingTheme.primaryDeep)
                    .padding(.top, 8)
                    Text(pro.lastError?.isEmpty == false
                         ? (pro.lastError ?? "")
                         : L10n.t("买断制，不会自动续费。换机后可点「恢复购买」。"))
                        .font(.system(size: 12.5))
                        .foregroundStyle(NamingTheme.muted)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.top, 10)
                }

#if DEBUG
                NamingCard {
                    Button(pro.isPro ? L10n.t("DEBUG：关闭 Pro") : L10n.t("DEBUG：解锁 Pro")) {
                        pro.debugToggleUnlock()
                    }
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(NamingTheme.primaryDeep)
                }
#endif
            }
            .padding(20)
        }
        .namingPageBackground()
        .navigationTitle(L10n.t("设置"))
        .navigationBarTitleDisplayMode(.inline)
        /* 关闭按钮放在这里而不是根视图的 sheet 闭包里：那个闭包不会跟着语言重建，
         * 按钮上就会一直留着旧语言的「关闭」。 */
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button(L10n.t("关闭")) { model.showSettings = false }
            }
        }
    }

    private var languageLabel: String {
        switch appLanguage {
        case "zh-Hans": return "简体中文"
        case "en": return "English"
        default: return L10n.t("跟随系统")
        }
    }

    private func settingsLink<Dest: View>(_ title: String, subtitle: String, systemImage: String,
                                          @ViewBuilder dest: () -> Dest) -> some View {
        NavigationLink {
            dest()
        } label: {
            HStack(spacing: 12) {
                Image(systemName: systemImage)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(NamingTheme.primaryDeep)
                    .frame(width: 28)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(NamingTheme.ink)
                    Text(subtitle)
                        .font(.system(size: 12))
                        .foregroundStyle(NamingTheme.muted)
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(NamingTheme.muted)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 12)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}
