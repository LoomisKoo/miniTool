import SwiftUI
import UIKit

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

                if pro.isPro {
                    ForEach(names, id: \.full) { name in
                        detailCard(name)
                    }
                    if !names.isEmpty {
                        reportAction
                        exportCardAction
                    }
                } else if !names.isEmpty {
                    previewCard
                    ProLockRow(feature: .nameReport)
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
        ShareLink(item: reportText) {
            reportButtonLabel
        }
    }

    private var exportCardAction: some View {
        Button {
            renderReportCard()
        } label: {
            Label(L10n.t("导出高清报告卡片"), systemImage: "photo")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(NamingTheme.primaryDeep)
                .frame(maxWidth: .infinity)
                .frame(height: 44)
                .background(NamingTheme.primary.opacity(0.12),
                            in: RoundedRectangle(cornerRadius: NamingRadius.medium, style: .continuous))
        }
        .buttonStyle(NamingPressButtonStyle())
    }

    private var previewCard: some View {
        NamingCard {
            Text(L10n.t("免费预览"))
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(NamingTheme.primaryDeep)
            Text(L10n.t("你可以先查看候选名字的基础对比；Pro 解锁完整解释、详细避雷和可分享报告。"))
                .font(.system(size: 13.5))
                .foregroundStyle(NamingTheme.muted)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 5)

            ForEach(names, id: \.full) { name in
                let read = NameEngine.shared.readability(name.surname, name.chars)
                HStack {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(name.full)
                            .font(.system(size: 17, weight: .semibold))
                            .foregroundStyle(NamingTheme.ink)
                        Text(Pinyin.titleCase(Pinyin.name(name.surname, name.chars)))
                            .font(.system(size: 12))
                            .foregroundStyle(NamingTheme.muted)
                    }
                    Spacer()
                    Text(read.ok ? L10n.t("读感顺口") : L10n.t("需进一步检查"))
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(read.ok ? NamingTheme.mint : NamingTheme.primaryDeep)
                }
                .padding(.top, 12)
            }
        }
    }

    @MainActor
    private func renderReportCard() {
        guard let image = NameReportCardRenderer.render(names: names, best: best) else {
            model.toast(L10n.t("暂时无法生成报告卡片"))
            return
        }
        model.cardImage = image
    }

    private var reportButtonLabel: some View {
        Label(L10n.t("分享这份报告"), systemImage: "square.and.arrow.up")
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
                let speech = SpeechHelper.inspect(surname: name.surname, chars: name.chars)
                if !speech.polyphones.isEmpty {
                    reportLine(L10n.t("读音提醒"),
                               speech.polyphones.map { "\($0.ch)：\($0.namePy)" }.joined(separator: " · "))
                }
                if let profile = model.profile, profile.hasAnswered {
                    let radar = NameEngine.shared.radar(profile, name.vec)
                    let fit = radar.isEmpty ? 0 : radar.map(\.name).reduce(0, +) / radar.count
                    reportLine(L10n.t("性格匹配"), "\(fit)%")
                }
            }
            .padding(.top, 12)

            Text(L10n.t("字义拆解") + " · " +
                 name.chars.map { "\($0)：\(NameEngine.shared.charNote($0).text)" }
                    .joined(separator: L10n.t("；")))
                .font(.system(size: 12.5))
                .foregroundStyle(NamingTheme.muted)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 10)
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
        var score = Int((sound * 55).rounded())
        if read.ok { score += 25 }
        let speech = SpeechHelper.inspect(surname: name.surname, chars: name.chars)
        if speech.polyphones.isEmpty { score += 10 }
        if let profile = model.profile, profile.hasAnswered {
            let radar = NameEngine.shared.radar(profile, name.vec)
            if !radar.isEmpty {
                score += radar.map(\.name).reduce(0, +) / radar.count / 10
            }
        }
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
            let speech = SpeechHelper.inspect(surname: name.surname, chars: name.chars)
            if !speech.polyphones.isEmpty {
                lines.append(L10n.t("读音提醒") + "："
                             + speech.polyphones.map { "\($0.ch)：\($0.namePy)" }.joined(separator: " · "))
            }
            lines.append(L10n.t("字义拆解") + "："
                         + name.chars.map { "\($0)：\(NameEngine.shared.charNote($0).text)" }
                            .joined(separator: L10n.t("；")))
            lines.append("")
        }
        return lines.joined(separator: "\n")
    }
}

enum NameReportCardRenderer {
    @MainActor
    static func render(names: [NameResult], best: NameResult?) -> UIImage? {
        let view = NameReportCard(names: names, best: best)
            .frame(width: 675, height: 900)
        let renderer = ImageRenderer(content: view)
        renderer.scale = 1
        return renderer.uiImage
    }
}

private struct NameReportCard: View {
    let names: [NameResult]
    let best: NameResult?

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text(L10n.t("仙鹿起名"))
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(NamingTheme.ink)
                Spacer()
                Text(L10n.t("取名对比报告"))
                    .font(.system(size: 13))
                    .foregroundStyle(NamingTheme.primaryDeep)
            }
            .padding(.bottom, 26)

            Text(L10n.t("推荐结论"))
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(NamingTheme.primaryDeep)
            Text(best?.full ?? "")
                .font(.system(size: 38, weight: .bold))
                .foregroundStyle(NamingTheme.ink)
                .padding(.top, 6)
            Text(L10n.t("综合读感、含义与避雷结果后的优先选择"))
                .font(.system(size: 14))
                .foregroundStyle(NamingTheme.muted)
                .padding(.top, 6)

            Divider()
                .overlay(NamingTheme.hairline)
                .padding(.vertical, 24)

            Text(L10n.t("候选对比"))
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(NamingTheme.ink)

            VStack(spacing: 0) {
                ForEach(names, id: \.full) { name in
                    let read = NameEngine.shared.readability(name.surname, name.chars)
                    HStack(spacing: 12) {
                        VStack(alignment: .leading, spacing: 5) {
                            Text(name.full)
                                .font(.system(size: 20, weight: .semibold))
                                .foregroundStyle(NamingTheme.ink)
                            Text(Pinyin.titleCase(Pinyin.name(name.surname, name.chars)))
                                .font(.system(size: 12.5))
                                .foregroundStyle(NamingTheme.muted)
                        }
                        Spacer()
                        Text(read.ok ? L10n.t("读感顺口") : L10n.t("需进一步检查"))
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(read.ok ? NamingTheme.mint : NamingTheme.primaryDeep)
                    }
                    .padding(.vertical, 15)
                    if name.full != names.last?.full {
                        Divider().overlay(NamingTheme.hairline)
                    }
                }
            }

            Spacer(minLength: 0)

            Text(L10n.t("仙鹿起名 Pro · 名字对比报告"))
                .font(.system(size: 12))
                .foregroundStyle(NamingTheme.muted)
                .frame(maxWidth: .infinity, alignment: .center)
        }
        .padding(34)
        .background(
            LinearGradient(
                colors: [NamingTheme.background, NamingTheme.canvas],
                startPoint: .top,
                endPoint: .bottom
            )
        )
    }
}
