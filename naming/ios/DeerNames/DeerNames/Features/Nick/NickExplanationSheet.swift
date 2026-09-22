import SwiftUI

struct NickExplanationSheet: View {
    let item: NickItem
    @Environment(\.dismiss) private var dismiss

    private var interpretation: NickInterpretation {
        NickEngine.interpretation(for: item)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    NamingCard {
                        Text(item.text)
                            .font(.system(size: 30, weight: .bold))
                            .foregroundStyle(NamingTheme.ink)
                        Text(L10n.t(item.category))
                            .font(.system(size: 13))
                            .foregroundStyle(NamingTheme.primaryDeep)
                            .padding(.top, 4)
                    }

                    NamingCard {
                        explanationLine(L10n.isEnglish ? L10n.t("原名读法") : L10n.t("直译"),
                                        interpretation.literal)
                        Divider().overlay(NamingTheme.hairline).padding(.vertical, 10)
                        explanationLine(L10n.t("意境适配"), interpretation.adapted)
                    }

                    NamingCard {
                        Text(L10n.t("昵称解读"))
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(NamingTheme.ink)
                        Text(interpretation.explanation)
                            .font(.system(size: 14))
                            .foregroundStyle(NamingTheme.ink.opacity(0.85))
                            .fixedSize(horizontal: false, vertical: true)
                            .padding(.top, 8)

                        Text(L10n.t("适用场景"))
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(NamingTheme.muted)
                            .padding(.top, 14)
                        Text(interpretation.sceneText)
                            .font(.system(size: 13))
                            .foregroundStyle(NamingTheme.ink)
                            .padding(.top, 3)
                    }
                }
                .padding(20)
            }
            .namingPageBackground()
            .navigationTitle(L10n.t("昵称详解"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(L10n.t("关闭")) { dismiss() }
                }
            }
        }
    }

    private func explanationLine(_ title: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(title)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(NamingTheme.muted)
            Text(value)
                .font(.system(size: 16, weight: .medium))
                .foregroundStyle(NamingTheme.ink)
        }
    }
}
