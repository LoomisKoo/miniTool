import SwiftUI
import UIKit

// MARK: - 报告数据（屏上展示与导出卡片共用）

private struct NameReportSnapshot {
    struct Context {
        var hasProfile: Bool
        var profileDescribe: String
        var baziPillars: String?
        var baziSummary: String?
    }

    struct Candidate {
        let full: String
        let score: Int
        let py: String
        let why: String
        let radar: [RadarItem]?
        let sections: [NameReportSection]
    }

    var context: Context
    var comparison: NameReportComparison?
    var candidates: [Candidate]
    var bestFull: String?
}

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
        let bazi = model.currentBazi()
        return names.max {
            NameReportAnalyzer.qualityScore($0, profile: model.profile, bazi: bazi)
                < NameReportAnalyzer.qualityScore($1, profile: model.profile, bazi: bazi)
        }
    }

    private var snapshot: NameReportSnapshot {
        buildSnapshot(names: names, best: best)
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                if pro.isPro || !names.isEmpty {
                    contextCard(snapshot.context)
                }

                if pro.isPro, let comparison = snapshot.comparison {
                    comparisonCard(comparison)
                }

                if let best {
                    NamingCard {
                        Text(L10n.t("推荐结论"))
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(NamingTheme.primaryDeep)
                        Text(best.full)
                            .font(.system(size: 30, weight: .bold))
                            .foregroundStyle(NamingTheme.ink)
                            .padding(.top, 4)
                        Text(L10n.t("综合读感、含义、性格与生辰参考后，作为当前候选中的优先选择。"))
                            .font(.system(size: 13.5))
                            .foregroundStyle(NamingTheme.muted)
                            .fixedSize(horizontal: false, vertical: true)
                            .padding(.top, 5)
                    }
                }

                if pro.isPro {
                    ForEach(snapshot.candidates, id: \.full) { item in
                        candidateCard(item)
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

    private func comparisonCard(_ comparison: NameReportComparison) -> some View {
        NamingCard {
            CardTitleRow(L10n.t("横向对照"))
            ForEach(comparison.picks) { pick in
                VStack(alignment: .leading, spacing: 4) {
                    HStack(alignment: .firstTextBaseline) {
                        Text(pick.dimension)
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(NamingTheme.muted)
                        Spacer(minLength: 8)
                        Text(pick.winner)
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(NamingTheme.primaryDeep)
                    }
                    Text(pick.detail)
                        .font(.system(size: 12.5))
                        .foregroundStyle(NamingTheme.ink.opacity(0.85))
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.top, 12)
            }
            ForEach(comparison.summary, id: \.self) { line in
                Text(line)
                    .font(.system(size: 13))
                    .foregroundStyle(NamingTheme.ink.opacity(0.88))
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 10)
            }
        }
    }

    private func contextCard(_ ctx: NameReportSnapshot.Context) -> some View {
        NamingCard {
            CardTitleRow(L10n.t("参考条件"))
            if ctx.hasProfile {
                Text(L10n.t("性格画像"))
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(NamingTheme.muted)
                    .padding(.top, 4)
                Text(ctx.profileDescribe)
                    .font(.system(size: 13.5))
                    .foregroundStyle(NamingTheme.ink.opacity(0.88))
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 4)
            } else {
                Text(L10n.t("尚未完成性格测试，性格匹配度仅供参考。"))
                    .font(.system(size: 13))
                    .foregroundStyle(NamingTheme.muted)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 4)
            }

            if let pillars = ctx.baziPillars, !pillars.isEmpty {
                Divider().overlay(NamingTheme.hairline).padding(.vertical, 10)
                Text(L10n.t("生辰八字"))
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(NamingTheme.muted)
                Text(pillars)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(NamingTheme.primaryDeep)
                    .padding(.top, 4)
                if let summary = ctx.baziSummary, !summary.isEmpty {
                    Text(summary)
                        .font(.system(size: 13))
                        .foregroundStyle(NamingTheme.muted)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.top, 4)
                }
            }
        }
    }

    private func candidateCard(_ item: NameReportSnapshot.Candidate) -> some View {
        NamingCard {
            HStack {
                Text(item.full)
                    .font(.system(size: 21, weight: .bold))
                    .foregroundStyle(NamingTheme.ink)
                Spacer()
                Text("\(item.score)/100")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(NamingTheme.primaryDeep)
            }
            Text(item.py)
                .font(.system(size: 12))
                .foregroundStyle(NamingTheme.muted)
                .padding(.top, 2)
            Text(item.why)
                .font(.system(size: 13.5))
                .foregroundStyle(NamingTheme.ink.opacity(0.85))
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 8)

            if let radar = item.radar, !radar.isEmpty {
                Text(L10n.t("性格画像"))
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(NamingTheme.primaryDeep)
                    .padding(.top, 14)
                ReportRadarBlock(items: radar)
                    .padding(.top, 8)
            }

            ForEach(item.sections, id: \.title) { section in
                VStack(alignment: .leading, spacing: 6) {
                    Text(section.title)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(NamingTheme.primaryDeep)
                        .padding(.top, 12)
                    ForEach(section.lines, id: \.self) { line in
                        Text(line)
                            .font(.system(size: 13))
                            .foregroundStyle(NamingTheme.ink.opacity(0.88))
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
        }
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
        guard let image = NameReportCardRenderer.render(snapshot: snapshot) else {
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

    private func buildSnapshot(names: [NameResult], best: NameResult?) -> NameReportSnapshot {
        let profile = model.profile
        let bazi = model.currentBazi()
        let ctx = NameReportSnapshot.Context(
            hasProfile: profile?.hasAnswered ?? false,
            profileDescribe: profile?.hasAnswered == true
                ? NameEngine.shared.describe(profile!)
                : "",
            baziPillars: (bazi?.ok == true && !(bazi?.pillarStr.isEmpty ?? true)) ? bazi?.pillarStr : nil,
            baziSummary: (bazi?.ok == true) ? bazi?.summary : nil
        )

        let chart = bazi?.ok == true ? bazi : nil
        let candidates = names.map { candidateSlice($0, bazi: chart) }
        let comparison = NameReportAnalyzer.compareCandidates(
            names: names,
            profile: model.profile,
            bazi: chart
        )

        return NameReportSnapshot(
            context: ctx,
            comparison: comparison,
            candidates: candidates,
            bestFull: best?.full
        )
    }

    private func candidateSlice(_ name: NameResult, bazi: BaziInfo?) -> NameReportSnapshot.Candidate {
        let sections = NameReportAnalyzer.analyze(
            name: name,
            profile: model.profile,
            bazi: bazi
        )
        var radar: [RadarItem]?
        if let profile = model.profile, profile.hasAnswered {
            radar = NameReportAnalyzer.radarItems(profile: profile, vec: name.vec)
        }
        return NameReportSnapshot.Candidate(
            full: name.full,
            score: NameReportAnalyzer.qualityScore(name, profile: model.profile, bazi: bazi),
            py: Pinyin.titleCase(Pinyin.name(name.surname, name.chars)),
            why: model.whyFor(name),
            radar: radar,
            sections: sections
        )
    }

    private var reportText: String {
        let snap = snapshot
        var lines = [L10n.t("仙鹿起名 · 取名对比报告"), ""]
        lines.append(L10n.t("参考条件"))
        if snap.context.hasProfile {
            lines.append(L10n.t("性格画像") + "：" + snap.context.profileDescribe)
        }
        if let p = snap.context.baziPillars {
            lines.append(L10n.t("生辰八字") + "：" + p)
            if let s = snap.context.baziSummary { lines.append(s) }
        }
        lines.append("")
        if let comparison = snap.comparison {
            lines.append(L10n.t("横向对照"))
            for pick in comparison.picks {
                lines.append("\(pick.dimension)：\(pick.winner) — \(pick.detail)")
            }
            lines.append(contentsOf: comparison.summary)
            lines.append("")
        }
        if let best = snap.bestFull { lines += [L10n.f("优先推荐：%@", best), ""] }
        for item in snap.candidates {
            lines.append("\(item.full) · \(item.py) · \(item.score)/100")
            lines.append(item.why)
            for section in item.sections {
                lines.append(section.title)
                lines.append(contentsOf: section.lines)
            }
            lines.append("")
        }
        return lines.joined(separator: "\n")
    }
}

private enum NameReportCardRenderer {
    @MainActor
    static func render(snapshot: NameReportSnapshot) -> UIImage? {
        NamingImageExport.render(NameReportCard(snapshot: snapshot))
    }
}

private struct NameReportCard: View {
    let snapshot: NameReportSnapshot

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
            .padding(.bottom, 20)

            panel {
                Text(L10n.t("参考条件"))
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(NamingTheme.ink)
                if snapshot.context.hasProfile {
                    Text(L10n.t("性格画像"))
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(NamingTheme.muted)
                        .padding(.top, 8)
                    Text(snapshot.context.profileDescribe)
                        .font(.system(size: 13))
                        .foregroundStyle(NamingTheme.ink.opacity(0.88))
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.top, 4)
                }
                if let pillars = snapshot.context.baziPillars {
                    Text(L10n.t("生辰八字"))
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(NamingTheme.muted)
                        .padding(.top, 10)
                    Text(pillars)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(NamingTheme.primaryDeep)
                        .padding(.top, 4)
                    if let summary = snapshot.context.baziSummary {
                        Text(summary)
                            .font(.system(size: 12.5))
                            .foregroundStyle(NamingTheme.muted)
                            .fixedSize(horizontal: false, vertical: true)
                            .padding(.top, 4)
                    }
                }
            }
            .padding(.bottom, 16)

            if let comparison = snapshot.comparison {
                panel {
                    Text(L10n.t("横向对照"))
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(NamingTheme.ink)
                    ForEach(comparison.picks) { pick in
                        HStack(alignment: .firstTextBaseline) {
                            Text(pick.dimension)
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(NamingTheme.muted)
                            Spacer(minLength: 6)
                            Text(pick.winner)
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(NamingTheme.primaryDeep)
                        }
                        .padding(.top, 8)
                        Text(pick.detail)
                            .font(.system(size: 10.5))
                            .foregroundStyle(NamingTheme.ink.opacity(0.85))
                            .fixedSize(horizontal: false, vertical: true)
                            .padding(.top, 3)
                    }
                    ForEach(comparison.summary, id: \.self) { line in
                        Text(line)
                            .font(.system(size: 11))
                            .foregroundStyle(NamingTheme.ink.opacity(0.88))
                            .fixedSize(horizontal: false, vertical: true)
                            .padding(.top, 8)
                    }
                }
                .padding(.bottom, 16)
            }

            if let best = snapshot.bestFull {
                Text(L10n.t("推荐结论"))
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(NamingTheme.primaryDeep)
                Text(best)
                    .font(.system(size: 34, weight: .bold))
                    .foregroundStyle(NamingTheme.ink)
                    .padding(.top, 6)
                Text(L10n.t("综合读感、含义、性格与生辰参考后的优先选择"))
                    .font(.system(size: 13))
                    .foregroundStyle(NamingTheme.muted)
                    .padding(.top, 6)
                    .padding(.bottom, 18)
            }

            ForEach(snapshot.candidates, id: \.full) { item in
                panel {
                    HStack(alignment: .firstTextBaseline) {
                        Text(item.full)
                            .font(.system(size: 20, weight: .bold))
                            .foregroundStyle(NamingTheme.ink)
                        Spacer(minLength: 8)
                        Text("\(item.score)/100")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(NamingTheme.primaryDeep)
                    }
                    Text(item.py)
                        .font(.system(size: 12))
                        .foregroundStyle(NamingTheme.muted)
                        .padding(.top, 2)
                    Text(item.why)
                        .font(.system(size: 12.5))
                        .foregroundStyle(NamingTheme.ink.opacity(0.85))
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.top, 8)
                    if let radar = item.radar, !radar.isEmpty {
                        ReportRadarBlock(items: radar, chartSize: 112)
                            .padding(.top, 10)
                    }
                    ForEach(item.sections, id: \.title) { section in
                        Text(section.title)
                            .font(.system(size: 11.5, weight: .semibold))
                            .foregroundStyle(NamingTheme.primaryDeep)
                            .padding(.top, 10)
                        ForEach(section.lines, id: \.self) { line in
                            Text(line)
                                .font(.system(size: 11))
                                .foregroundStyle(NamingTheme.ink.opacity(0.86))
                                .fixedSize(horizontal: false, vertical: true)
                                .padding(.top, 4)
                        }
                    }
                }
                .padding(.bottom, 12)
            }

            Text(L10n.t("仙鹿起名 Pro · 名字对比报告"))
                .font(.system(size: 12))
                .foregroundStyle(NamingTheme.muted)
                .frame(maxWidth: .infinity, alignment: .center)
                .padding(.top, 8)
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

    private func panel<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 0, content: content)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(14)
            .background(NamingTheme.canvas, in: RoundedRectangle(cornerRadius: NamingRadius.large, style: .continuous))
    }

}
