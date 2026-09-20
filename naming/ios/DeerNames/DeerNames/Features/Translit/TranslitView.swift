import SwiftUI

/* 西名中起 —— 对应 app.js 的 renderTranslit + runTranslit。 */

struct TranslitView: View {
    @Environment(NamingAppModel.self) private var model

    private let examples = ["Emma Wilson", "Grace", "Silas", "Olivia Chen", "Anouk", "Liam"]

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                NamingCard {
                    CardTitleRow(L10n.t("输入原名"), subtitle: L10n.t("取一个中国式名字"))
                    TextField(L10n.t("例如 Emma Wilson / Liam / Sofia"),
                              text: Binding(get: { model.translit }, set: { model.translit = $0 }))
                        .textFieldStyle(.plain)
                        .font(.system(size: 16))
                        .padding(12)
                        .background(NamingTheme.background, in: RoundedRectangle(cornerRadius: NamingRadius.small, style: .continuous))
                        .overlay {
                            RoundedRectangle(cornerRadius: NamingRadius.small, style: .continuous)
                                .strokeBorder(NamingTheme.hairline, lineWidth: 1)
                        }
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                        .onSubmit { if model.translitResult == nil { model.runTranslit() } }

                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(examples, id: \.self) { x in
                                ChipButton(text: x, active: false) {
                                    model.translit = x
                                    model.runTranslit()
                                }
                            }
                        }
                    }
                    .padding(.top, 10)

                    HintText(text: L10n.t("给的是中国人真会取的名字（两三个字，姓照原名的音头配，也可能是欧阳、司马这样的复姓），不是「格蕾丝」这类只贴读音的音译。"))
                        .padding(.top, 10)
                }

                if let r = model.translitResult {
                    resultSection(r)
                }
            }
            .padding(20)
        }
        .namingPageBackground()
        .navigationTitle(L10n.t("西名中起"))
        .navigationBarTitleDisplayMode(.inline)
        .safeAreaInset(edge: .bottom) {
            DockPrimaryButton(title: model.translitResult == nil ? L10n.t("生成姓名") : L10n.t("收藏")) {
                if model.translitResult == nil {
                    model.runTranslit()
                } else {
                    model.translitSave()
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 10)
            .background(.regularMaterial)
        }
    }

    @ViewBuilder
    private func resultSection(_ r: TranslitResultState) -> some View {
        let m = r.main
        let rel = NameEngine.shared.readability(r.surname, m.chars)

        NamingCard {
            Text(L10n.f("照 %@ 取的中文名", r.latin))
                .font(.system(size: 12))
                .foregroundStyle(NamingTheme.primaryDeep)
                .padding(.bottom, 10)
            Text(L10n.zhPrimary(m.full, Pinyin.titleCase(Pinyin.name(r.surname, m.chars))))
                .font(.system(size: 38, weight: .bold))
                .foregroundStyle(NamingTheme.ink)
                .frame(maxWidth: .infinity)
            Text(L10n.zhSecondary(m.full, Pinyin.titleCase(Pinyin.name(r.surname, m.chars))) + " · " + r.latin)
                .font(.system(size: 13))
                .foregroundStyle(NamingTheme.muted)
                .frame(maxWidth: .infinity)
                .padding(.top, 6)
            Text(model.whyFor(nameResult(m)))
                .font(.system(size: 14))
                .foregroundStyle(NamingTheme.ink.opacity(0.85))
                .multilineTextAlignment(.center)
                .frame(maxWidth: .infinity)
                .padding(.top, 12)
            HStack(spacing: 10) {
                pill(L10n.t("换一组姓名")) { model.translitAgain() }
                pill(L10n.t("存卡片")) { model.openCardZh(nameResult(m)) }
            }
            .padding(.top, 14)
        }

        NamingCard {
            CardTitleRow(L10n.t("姓是怎么定的"))
            HStack(spacing: 10) {
                Text(L10n.t("姓氏")).font(.system(size: 13)).foregroundStyle(NamingTheme.muted)
                Text(r.surname.c).font(.system(size: 15, weight: .semibold)).foregroundStyle(NamingTheme.ink)
                Text(NameEngine.shared.surnameVibe(r.surname)).font(.system(size: 12)).foregroundStyle(NamingTheme.muted)
                Spacer(minLength: 0)
            }
            Text(model.surnameWhy(r))
                .font(.system(size: 13.5))
                .foregroundStyle(NamingTheme.ink.opacity(0.85))
                .padding(.top, 8)
        }

        NamingCard {
            CardTitleRow(L10n.t("名字里有什么"))
            ForEach(m.chars, id: \.self) { c in
                HStack(spacing: 10) {
                    Text(c)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(NamingTheme.ink.opacity(0.7))
                        .frame(width: 22, alignment: .leading)
                    Text(NameEngine.shared.getChar(c)?.py ?? "")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(NamingTheme.ink)
                    Text(NameEngine.shared.charNote(c).text)
                        .font(.system(size: 13.5))
                        .foregroundStyle(NamingTheme.muted)
                    Spacer(minLength: 0)
                }
                .padding(.vertical, 6)
            }
            Text((rel.ok ? L10n.t("读感没问题") : rel.issues.joined(separator: L10n.t("、")))
                 + L10n.t("· 念着") + NameEngine.shared.euphonyLabel(m.euphony))
                .font(.system(size: 12.5))
                .foregroundStyle(m.euphony >= 0.85 ? NamingTheme.mint : NamingTheme.primaryDeep)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.top, 10)
        }

        if !r.translitStyle.isEmpty {
            NamingCard {
                CardTitleRow(L10n.t("如果要音译写法"))
                HStack(spacing: 10) {
                    Text(L10n.t("音译")).font(.system(size: 13)).foregroundStyle(NamingTheme.muted)
                    Text(r.translitStyle).font(.system(size: 15, weight: .semibold)).foregroundStyle(NamingTheme.ink)
                    Text(L10n.t("证件、护照上用的写法")).font(.system(size: 12)).foregroundStyle(NamingTheme.muted)
                    Spacer(minLength: 0)
                }
            }
        }

        CelebSection(given: m.given, chars: m.chars)

        NamingCard {
            CardTitleRow(L10n.t("换几个名字试试"))
            VStack(spacing: 0) {
                ForEach(Array(r.alts.enumerated()), id: \.offset) { index, a in
                    Button {
                        model.translitPick(index)
                    } label: {
                        HStack(spacing: 10) {
                            VStack(alignment: .leading, spacing: 3) {
                                Text(a.full)
                                    .font(.system(size: 16, weight: .semibold))
                                    .foregroundStyle(NamingTheme.ink)
                                Text(L10n.listPyPrefix(Pinyin.titleCase(Pinyin.name(a.surname, a.chars))) + a.chars.map { model.charLabel($0) }.joined(separator: " / "))
                                    .font(.system(size: 12))
                                    .foregroundStyle(NamingTheme.muted)
                            }
                            Spacer(minLength: 0)
                            Text(NameEngine.shared.euphonyLabel(a.euphony))
                                .font(.system(size: 12))
                                .foregroundStyle(NamingTheme.primaryDeep)
                                .padding(.horizontal, 9)
                                .padding(.vertical, 4)
                                .background(NamingTheme.primary.opacity(0.12), in: Capsule())
                        }
                        .padding(.vertical, 11)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    if index != r.alts.count - 1 {
                        Divider().overlay(NamingTheme.hairline)
                    }
                }
            }
        }
    }

    private func nameResult(_ m: ChineseNameResult) -> NameResult {
        let vec = NameEngine.shared.givenVec(m.chars)
            ?? NameVector(trait: NameEngine.shared.zero(NameEngine.shared.data.traitKeys),
                          style: NameEngine.shared.zero(NameEngine.shared.data.styleKeys), chars: m.chars)
        return NameResult(given: m.given, chars: m.chars, surname: m.surname, full: m.full,
                          score: m.score, tSim: 0, sSim: 0, novelty: 0, source: m.source,
                          note: NameEngine.shared.translitNote(model.translitResult?.latin ?? "", m.chars),
                          vec: vec, tier: m.tier, euphony: m.euphony, mix: nil)
    }

    private func pill(_ title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(NamingTheme.ink)
                .padding(.horizontal, 14)
                .padding(.vertical, 9)
                .background(NamingTheme.pearl, in: Capsule())
        }
        .buttonStyle(.plain)
    }
}
