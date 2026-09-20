import SwiftUI

struct AboutView: View {
    /* 订阅语言，换语言时这一页跟着重画（见 SettingsView 的说明）。 */
    @AppStorage(L10n.storageKey) private var appLanguage = ""

    private var usesEnglish: Bool { L10n.isEnglish }

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                ZStack {
                    Circle()
                        .fill(NamingTheme.gradient)
                        .frame(width: 76, height: 76)
                    /* 品牌印记：始终是一头「鹿」，不随语言变。 */
                    Text("鹿")
                        .font(.system(size: 35, weight: .semibold))
                        .foregroundStyle(.white)
                }
                .padding(.top, 20)

                Text("DeerNames")
                    .font(.system(size: 26, weight: .semibold))
                    .foregroundStyle(NamingTheme.ink)

                Text(usesEnglish ? "DeerNames" : "仙鹿起名")
                    .font(.system(size: 15))
                    .foregroundStyle(NamingTheme.muted)

                NamingCard {
                    VStack(alignment: .leading, spacing: 12) {
                        Text(L10n.t("关于这个名字"))
                            .font(.system(size: 18, weight: .semibold))
                        Text(L10n.t("仙鹿起名从性格、含义、读音和文化语境出发，帮助你找到愿意长期使用的名字。"))
                            .font(.system(size: 15))
                            .foregroundStyle(NamingTheme.muted)
                            .lineSpacing(4)
                    }
                    .foregroundStyle(NamingTheme.ink)
                }

                Text("Version 1.0.0")
                    .font(.system(size: 12))
                    .foregroundStyle(NamingTheme.muted)
            }
            .frame(maxWidth: .infinity)
            .padding(.horizontal, 20)
            .padding(.bottom, 30)
        }
        .navigationTitle(L10n.t("关于"))
        .navigationBarTitleDisplayMode(.inline)
        .namingPageBackground()
    }
}
