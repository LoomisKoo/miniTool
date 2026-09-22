import SwiftUI

/// Pro 对比报告：把横向比较结果整理成可以分享给家人的结论。
struct NameReportView: View {
    @Environment(NamingAppModel.self) private var model
    @Environment(ProStore.self) private var pro

    private var names: [NameResult] {
        model.fav
            .filter { model.compareSelection.contains($0.full) && $0.kind != "en" && $0.kind != "nick" }
            .map { model.favToName($0) }
    }

    private var best: NameResult? {
        names.max {
            qualityScore($0) < qualityScore($1)
        }
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                if let best {
                    NamingCard {
                        Text(L10n.t("推荐结论"))
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(NamingTheme.primaryDeep)
                        Text(best.full)
                            .font(.system(size: 30, weight: .bold))
                            .foregroundStyle(NamingTheme.ink)
                            .padding(.top, 4)
                        Text(L10n.t("综合读感、含义与避雷结果后，作为当前候选中的优先选择。"))
                            .font(.system(size: 13.5))
                            .foregroundStyle(NamingTheme.muted)
                            .fixedSize(horizontal: false, vertical: true)
                            .padding(.top, 5)
                    }
                }

                ForEach(names, id: \.full) { name in
                    detailCard(name)
                }

                if !names.isEmpty {
                    reportAction
                }
            }
            .padding(20)
        }
        .namingPageBackground()
        .navigationTitle(L10n.t("取名对比报告"))
        .navigationBarTitleDisplayMode(.inline)
    }

    @ViewBuilder
    private var reportAction: some View {
        if pro.isPro {
            ShareLink(item: reportText) {
                reportButtonLabel
            }
        } else {
            Button {
                _ = pro.require(.nameReport)
            } label: {
                reportButtonLabel
            }
            .buttonStyle(NamingPressButtonStyle())
        }
    }

    private var reportButtonLabel: some View {
        Label(L10n.t("分享这份报告"), systemImage: pro.isPro ? "square.and.arrow.up" : "lock.fill")
            .font(.system(size: 15, weight: .semibold))
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .frame(height: 46)
            .background(NamingTheme.gradient,
                        in: RoundedRectangle(cornerRadius: NamingRadius.medium, style: .continuous))
    }

    private func detailCard(_ name: NameResult) -> some View {
        let readability = NameEngine.shared.readability(name.surname, name.chars)
        let euphony = name.euphony ?? NameEngine.shared.euphony(name.surname, name.chars)
        return NamingCard {
            HStack {
                Text(name.full)
                    .font(.system(size: 21, weight: .bold))
                    .foregroundStyle(NamingTheme.ink)
                Spacer()
                Text("\(qualityScore(name))/100")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(NamingTheme.primaryDeep)
            }
            Text(model.whyFor(name))
                .font(.system(size: 13.5))
                .foregroundStyle(NamingTheme.ink.opacity(0.85))
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 8)

            VStack(alignment: .leading, spacing: 7) {
                reportLine(L10n.t("读感"), readability.ok ? L10n.t("顺口") : readability.issues.joined(separator: L10n.t("、")))
                reportLine(L10n.t("音韵"), NameEngine.shared.euphonyLabel(euphony))
                reportLine(L10n.t("拼音"), Pinyin.titleCase(Pinyin.name(name.surname, name.chars)))
            }
            .padding(.top, 12)
        }
    }

    private func reportLine(_ title: String, _ value: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Text(title)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(NamingTheme.muted)
                .frame(width: 42, alignment: .leading)
            Text(value)
                .font(.system(size: 13))
                .foregroundStyle(NamingTheme.ink)
        }
    }

    private func qualityScore(_ name: NameResult) -> Int {
        let read = NameEngine.shared.readability(name.surname, name.chars)
        let sound = name.euphony ?? NameEngine.shared.euphony(name.surname, name.chars)
        var score = Int((sound * 70).rounded())
        if read.ok { score += 30 }
        return min(100, max(0, score))
    }

    private var reportText: String {
        var lines = [L10n.t("仙鹿起名 · 取名对比报告"), ""]
        if let best { lines += [L10n.f("优先推荐：%@", best.full), ""] }
        for name in names {
            let read = NameEngine.shared.readability(name.surname, name.chars)
            lines.append("\(name.full) · \(Pinyin.titleCase(Pinyin.name(name.surname, name.chars)))")
            lines.append(model.whyFor(name))
            lines.append(read.ok ? L10n.t("读感顺口") : read.issues.joined(separator: L10n.t("、")))
            lines.append("")
        }
        return lines.joined(separator: "\n")
    }
}
