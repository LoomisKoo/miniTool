import SwiftUI

/* 「我的」—— 对应 app.js 的 renderMine：性格画像 / 生辰八字两个折叠块 + 收藏列表。 */

struct MineView: View {
    @Environment(NamingAppModel.self) private var model
    @State private var showSettings = false

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                profileFold
                baziFold
                favSection
            }
            .padding(20)
        }
        .namingPageBackground()
        // 设置齿轮在根视图的导航栏上（见 NamingRootView），这里不再重复挂 toolbar ——
        // 反向嵌套（NavigationStack 罩 TabView）时 tab 子视图的 toolbar 不生效。
    }

    // MARK: - 性格画像

    @ViewBuilder
    private var profileFold: some View {
        if let p = model.profile, p.hasAnswered {
            NamingCard {
                FoldHeader(title: L10n.t("性格画像"),
                           subtitle: NameEngine.shared.describe(p),
                           actionLabel: model.mineExpandProfile ? L10n.t("收起") : L10n.t("展开")) {
                    model.mineExpandProfile.toggle()
                }
                if model.mineExpandProfile {
                    RadarBodyView(items: NameEngine.shared.radarSelf(p), selfOnly: true)
                        .padding(.top, 12)
                    HStack {
                        Button(L10n.t("重新测")) { model.openQuiz() }
                            .font(.system(size: 14))
                            .foregroundStyle(NamingTheme.primaryDeep)
                        Spacer()
                    }
                    .padding(.top, 10)
                }
            }
        } else {
            NamingCard {
                FoldHeader(title: L10n.t("性格画像"), subtitle: L10n.t("还没有，去测 8 道题"), actionLabel: L10n.t("去测试")) {
                    model.openQuiz()
                }
            }
        }
    }

    // MARK: - 生辰八字

    @ViewBuilder
    private var baziFold: some View {
        if let bazi = model.currentBazi() {
            NamingCard {
                FoldHeader(title: L10n.t("生辰八字"),
                           subtitle: bazi.pillarStr.isEmpty ? bazi.summary : bazi.pillarStr,
                           actionLabel: model.mineExpandBazi ? L10n.t("收起") : L10n.t("展开")) {
                    model.mineExpandBazi.toggle()
                }
                if model.mineExpandBazi {
                    VStack(alignment: .leading, spacing: 10) {
                        Text(bazi.summary)
                            .font(.system(size: 14))
                            .foregroundStyle(NamingTheme.ink)
                            .fixedSize(horizontal: false, vertical: true)
                        Text("\(bazi.solar?.y ?? 0)/\(bazi.solar?.m ?? 0)/\(bazi.solar?.d ?? 0)"
                             + (bazi.lunar != nil ? " · \(BaziEngine.lunarText(bazi.lunar))" : ""))
                            .font(.system(size: 12))
                            .foregroundStyle(NamingTheme.muted)
                        WxBarsView(counts: bazi.counts)
                        Button(L10n.t("改生辰")) { model.openBazi() }
                            .font(.system(size: 14))
                            .foregroundStyle(NamingTheme.primaryDeep)
                    }
                    .padding(.top, 12)
                }
            }
        } else {
            NamingCard {
                FoldHeader(title: L10n.t("生辰八字"), subtitle: L10n.t("未添加，可作推荐辅助"), actionLabel: L10n.t("添加")) {
                    model.openBazi()
                }
            }
        }
    }

    // MARK: - 收藏

    @ViewBuilder
    private var favSection: some View {
        HStack {
            /* 标题用「我的收藏」：单说「收藏」是全站按钮文案（Save）。 */
            Text(L10n.t("我的收藏") + (model.fav.isEmpty ? "" : " · \(model.fav.count)"))
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(NamingTheme.muted)
            Spacer()
        }
        .padding(.top, 6)

        if model.fav.isEmpty {
            NamingCard {
                Text(L10n.t("还没有收藏。看到喜欢的名字，点「收藏」就存这儿了。"))
                    .font(.system(size: 13.5))
                    .foregroundStyle(NamingTheme.muted)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
            }
        } else {
            NamingCard(padding: 8) {
                VStack(spacing: 0) {
                    ForEach(Array(model.fav.enumerated()), id: \.element.full) { index, item in
                        HStack(spacing: 10) {
                            Button {
                                model.openFav(item)
                            } label: {
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(item.full)
                                        .font(.system(size: 16, weight: .semibold))
                                        .foregroundStyle(NamingTheme.ink)
                                    let meta = metaText(item)
                                    if !meta.isEmpty {
                                        Text(meta)
                                            .font(.system(size: 12))
                                            .foregroundStyle(NamingTheme.muted)
                                    }
                                }
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)

                            Button {
                                guard index < model.fav.count else { return }
                                model.fav.remove(at: index)
                                model.schedulePersist()
                            } label: {
                                Image(systemName: "heart.fill")
                                    .foregroundStyle(NamingTheme.primary)
                            }
                            .buttonStyle(.plain)
                        }
                        .padding(.horizontal, 10)
                        .padding(.vertical, 11)

                        if index != model.fav.count - 1 {
                            Divider().overlay(NamingTheme.hairline)
                        }
                    }
                }
            }
        }
    }

    private func metaText(_ f: FavItem) -> String {
        var parts: [String] = []
        if f.kind == "en" {
            /* 英文名：主标就是英文本身；副标的中文音译只给中文界面（存的时候写进 note）。 */
            if !L10n.isEnglish, !f.note.isEmpty { parts.append(f.note) }
        } else {
            /* 英文界面下主标是汉字，副标补一行拼音。 */
            if L10n.isEnglish, !f.py.isEmpty { parts.append(Pinyin.titleCase(f.py)) }
            if !f.note.isEmpty { parts.append(f.note) }
        }
        if !f.src.isEmpty && f.src != "unknown" { parts.append(model.favSrcLabel(f.src)) }
        return parts.joined(separator: " · ")
    }
}

struct FoldHeader: View {
    let title: String
    let subtitle: String
    let actionLabel: String
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(alignment: .center, spacing: 10) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(title)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(NamingTheme.ink)
                    Text(subtitle)
                        .font(.system(size: 12.5))
                        .foregroundStyle(NamingTheme.muted)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                }
                Spacer(minLength: 0)
                Text(actionLabel)
                    .font(.system(size: 13))
                    .foregroundStyle(NamingTheme.primaryDeep)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

struct WxBarsView: View {
    let counts: [String: Double]

    var body: some View {
        VStack(spacing: 7) {
            ForEach(NameEngine.shared.data.baziWx, id: \.self) { w in
                let n = counts[w] ?? 0
                HStack(spacing: 8) {
                    /* 五行是界面标签，跟着语言走（数据里的木火土金水仍然按中文存）。 */
                    Text(L10n.t(w))
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(NamingTheme.ink)
                        .lineLimit(1)
                        .frame(width: L10n.isEnglish ? 34 : 18, alignment: .leading)
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            Capsule().fill(NamingTheme.pearl)
                            Capsule().fill(NamingTheme.primary.opacity(0.85))
                                .frame(width: geo.size.width * min(1, n / 4))
                        }
                    }
                    .frame(height: 6)
                    Text(String(format: "%.1f", n))
                        .font(.system(size: 11))
                        .foregroundStyle(NamingTheme.muted)
                        .frame(width: 26, alignment: .trailing)
                }
            }
        }
    }
}
