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
        List {
            Section {
                ForEach(options, id: \.0) { option in
                    Button {
                        appLanguage = option.0
                    } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 3) {
                                Text(option.1)
                                    .foregroundStyle(NamingTheme.ink)
                                Text(option.2)
                                    .font(.system(size: 12))
                                    .foregroundStyle(NamingTheme.muted)
                            }
                            Spacer()
                            if appLanguage == option.0 {
                                Image(systemName: "checkmark")
                                    .foregroundStyle(NamingTheme.primaryDeep)
                            }
                        }
                    }
                }
            } footer: {
                Text(L10n.t("名字本身不会被翻译，解释文字会跟随界面语言变化。"))
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(NamingTheme.background.ignoresSafeArea())
        .navigationTitle(L10n.t("语言"))
        .navigationBarTitleDisplayMode(.inline)
    }
}
