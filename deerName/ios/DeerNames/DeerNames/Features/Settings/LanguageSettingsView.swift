import SwiftUI

struct LanguageSettingsView: View {
    @AppStorage(L10n.storageKey) private var appLanguage = ""
    private var usesEnglish: Bool { L10n.isEnglish }

    /* 语言名本身不翻译：中文项始终写「简体中文」，英文项始终写「English」。 */
    private var options: [(String, String, String)] {
        usesEnglish
            ? [("", "System", "Follow system"), ("zh-Hans", "简体中文", "Simplified Chinese"), ("en", "English", "English")]
            : [("", "跟随系统", "System"), ("zh-Hans", "简体中文", "简体中文"), ("en", "English", "English")]
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                NamingCard(padding: 8) {
                    ForEach(Array(options.enumerated()), id: \.element.0) { index, option in
                        Button {
                            appLanguage = option.0
                        } label: {
                            HStack(spacing: 12) {
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(option.1)
                                        .font(.system(size: 16, weight: .semibold))
                                        .foregroundStyle(NamingTheme.ink)
                                    Text(option.2)
                                        .font(.system(size: 12))
                                        .foregroundStyle(NamingTheme.muted)
                                }
                                Spacer(minLength: 0)
                                if appLanguage == option.0 {
                                    Image(systemName: "checkmark")
                                        .font(.system(size: 15, weight: .semibold))
                                        .foregroundStyle(NamingTheme.primaryDeep)
                                }
                            }
                            .padding(.horizontal, 10)
                            .padding(.vertical, 12)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        if index != options.count - 1 {
                            Divider().overlay(NamingTheme.hairline)
                        }
                    }
                }
                Text(L10n.t("名字本身不会被翻译，解释文字会跟随界面语言变化。"))
                    .font(.system(size: 12.5))
                    .foregroundStyle(NamingTheme.muted)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 4)
            }
            .padding(20)
        }
        .namingPageBackground()
        .navigationTitle(L10n.t("语言"))
        .navigationBarTitleDisplayMode(.inline)
    }
}
