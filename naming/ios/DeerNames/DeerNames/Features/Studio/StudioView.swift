import SwiftUI

/* 自选姓名（台面）—— 对应 app.js 的 renderStudio。 */

struct StudioView: View {
    @Environment(NamingAppModel.self) private var model

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                NamingCard(padding: 8) {                    VStack(spacing: 0) {
                        slotRow(key: L10n.t("姓"), value: model.studioSurname?.c) {
                            model.go(.studioSur)
                        }
                        Divider().overlay(NamingTheme.hairline)
                        slotRow(key: L10n.t("名"), value: model.studioSlots.isEmpty ? nil : model.studioSlots.joined()) {
                            model.go(.studioChar)
                        }
                    }
                }

                if let preview = model.studioPreview() {
                    NamingCard {
                        Text(L10n.zhPrimary(preview.full, Pinyin.titleCase(preview.py)))
                            .font(.system(size: 34, weight: .bold))
                            .foregroundStyle(NamingTheme.ink)
                            .frame(maxWidth: .infinity)
                        Text(L10n.zhSecondary(preview.full, Pinyin.titleCase(preview.py)))
                            .font(.system(size: 13))
                            .foregroundStyle(NamingTheme.muted)
                            .frame(maxWidth: .infinity)
                            .padding(.top, 6)

                        Text(preview.read.ok
                             ? L10n.t("读感没问题") + (preview.read.good.isEmpty ? "" : " · " + preview.read.good.joined(separator: " · "))
                             : preview.read.issues.joined(separator: L10n.t("、")))
                            .font(.system(size: 12.5))
                            .foregroundStyle(preview.read.ok ? NamingTheme.mint : NamingTheme.primaryDeep)
                            .multilineTextAlignment(.center)
                            .frame(maxWidth: .infinity)
                            .padding(.top, 10)

                        if !preview.tips.isEmpty {
                            Text(preview.tips.joined(separator: " "))
                                .font(.system(size: 12))
                                .foregroundStyle(NamingTheme.muted)
                                .multilineTextAlignment(.center)
                                .frame(maxWidth: .infinity)
                                .padding(.top, 8)
                        }

                        /* 逐字释义：选完名字之后，把每个字的读音、字义、五行意象摊开写清楚。 */
                        CardTitleRow(L10n.t("名字里有什么"))
                            .padding(.top, 18)
                        VStack(spacing: 0) {
                            ForEach(model.studioSlots, id: \.self) { ch in
                                CharInfoRow(ch: ch)
                                if ch != model.studioSlots.last {
                                    Divider().overlay(NamingTheme.hairline)
                                }
                            }
                        }

                        HStack(spacing: 10) {
                            pill(model.isSaved(preview.full) ? L10n.t("已收藏") : L10n.t("收藏"),
                                 favorite: !model.isSaved(preview.full)) {
                                withAnimation(NamingMotion.pick) {
                                    model.studioSave()
                                }
                            }
                            pill(L10n.t("配小名")) {
                                model.openNickFromStudio()
                            }
                            pill(L10n.t("清空重选")) {
                                withAnimation(NamingMotion.pick) {
                                    model.studioSlots = []
                                }
                            }
                        }
                        .padding(.top, 14)
                    }

                    similarCard

                    CelebSection(given: model.studioSlots.joined(), chars: model.studioSlots)
                }
            }
            .padding(20)
        }
        .namingPageBackground()
        .navigationTitle(L10n.t("自选姓名"))
        .navigationBarTitleDisplayMode(.inline)
        .namingDock {
            DockPrimaryButton(title: L10n.t("确定"),
                              enabled: model.studioSurname != nil && !model.studioSlots.isEmpty) {
                /* 回「中文名」入口页（自选只是那页上的一扇门），不是一路弹回首页。 */
                model.popTo(.zh)
            }
        }
    }

    private func slotRow(key: String, value: String?, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Text(key)
                    .font(.system(size: 14))
                    .foregroundStyle(NamingTheme.muted)
                    .lineLimit(1)
                    /* 英文是 Surname / Given，宽一点，别断成三行。 */
                    .frame(width: L10n.isEnglish ? 58 : 24, alignment: .leading)
                if let value {
                    Text(value)
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundStyle(NamingTheme.ink)
                } else {
                    Text(L10n.t("选择"))
                        .font(.system(size: 16))
                        .foregroundStyle(NamingTheme.muted)
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(NamingTheme.muted)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 16)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    /* 相似的名字：和当前自选名共用了字，或者气质很近的精选名。点一下换过来。 */
    @ViewBuilder
    private var similarCard: some View {
        let list = model.studioSimilar()
        if !list.isEmpty {
            NamingCard {
                CardTitleRow(L10n.t("相似的名字"), subtitle: L10n.t("点一下换过来"))
                VStack(spacing: 0) {
                    ForEach(list) { s in
                        Button {
                            model.studioUse(s)
                        } label: {
                            HStack(alignment: .top, spacing: 10) {
                                VStack(alignment: .leading, spacing: 5) {
                                    HStack(spacing: 8) {
                                        Text(s.n)
                                            .font(.system(size: 17, weight: .semibold))
                                            .foregroundStyle(NamingTheme.ink)
                                        Text(similarReason(s))
                                            .font(.system(size: 11.5))
                                            .foregroundStyle(NamingTheme.primaryDeep)
                                            .padding(.horizontal, 8)
                                            .padding(.vertical, 3)
                                            .background(NamingTheme.primary.opacity(0.12), in: Capsule())
                                    }
                                    Text(s.m)
                                        .font(.system(size: 12.5))
                                        .foregroundStyle(NamingTheme.ink.opacity(0.85))
                                        .multilineTextAlignment(.leading)
                                        .fixedSize(horizontal: false, vertical: true)
                                }
                                Spacer(minLength: 0)
                            }
                            .padding(.vertical, 10)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        if s.id != list.last?.id {
                            Divider().overlay(NamingTheme.hairline)
                        }
                    }
                }
            }
        }
    }

    private func similarReason(_ s: SimilarName) -> String {
        s.shared.isEmpty ? L10n.t("气质相近") : L10n.f("含「%@」字", s.shared.joined())
    }

    private func pill(_ title: String, favorite: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(favorite ? .white : NamingTheme.ink)
                .padding(.horizontal, 14)
                .padding(.vertical, 9)
                .background(favorite ? AnyShapeStyle(NamingTheme.primaryDeep) : AnyShapeStyle(NamingTheme.pearl))
                .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }
}
