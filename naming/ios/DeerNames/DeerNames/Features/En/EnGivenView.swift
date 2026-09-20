import SwiftUI

/* 选英文名 —— 自选英文名的另一半，对应中文名的「选字」页。
 *
 * 就是原来的「英文名库」列表（1496 条 + 年代 / 气质 / 寓意 / 语源四组筛选），
 * 只是从「浏览并看详情」改成「挑一个名字」：点一行＝选中，底部固定栏确定后回自选页。
 *
 * 列表 1400+ 行，必须 LazyVStack —— 普通 VStack + ForEach 会在第一帧建出全部行，
 * 界面会卡住好几秒。 */

struct EnGivenView: View {
    @Environment(NamingAppModel.self) private var model
    @State private var showTop = false

    private let topID = "en-given-top"

    var body: some View {
        VStack(spacing: 0) {
            searchField
            Divider().overlay(NamingTheme.hairline)

            ScrollViewReader { proxy in
                ScrollView {
                    VStack(spacing: 14) {
                        Color.clear.frame(height: 0).id(topID)

                        let list = model.browseEnNames()

                        NamingCard {
                            FilterRow(items: [("all", L10n.t("不限性别")), ("f", L10n.t("偏女")), ("m", L10n.t("偏男"))], current: model.enF.g) { model.enF.g = $0 }
                            FilterRow(items: NamingAppModel.enEra, current: model.enF.era) { model.enF.era = $0 }
                                .padding(.top, 10)
                            FilterRow(items: NamingAppModel.enVibe, current: model.enF.vibe) { model.enF.vibe = $0 }
                            FilterRow(items: NamingAppModel.enTheme, current: model.enF.theme) { model.enF.theme = $0 }
                            FilterRow(items: NamingAppModel.enLang, current: model.enF.lang) { model.enF.lang = $0 }
                            FilterSummaryView(parts: filterParts, empty: list.isEmpty) {
                                model.enF = EnFilters()
                            }
                            .padding(.top, 8)
                        }

                        /* 选中的名字直接摊开显示在这儿（不再要「查看详情」跳页），
                         * 右上角能换一个；同名人物是单独一张卡。
                         *
                         * 这一块插在筛选条和列表之间，一出现就会把列表整体往下推，
                         * 所以**不写 `.id(...)`**：换名字时卡片原地更新（跟着 `withAnimation`
                         * 一起重排），而不是销毁重建 —— 重建会晚一帧落地，看着就是「卡一下」。 */
                        if let g = model.enGivenPick {
                            VStack(spacing: 14) {
                                EnNameCard(it: g, onShuffle: { shufflePick(list) })
                                EnNamesakeCard(celebs: model.enCelebs(g))
                            }
                            .geometryGroup()
                        }

                        NamingCard {
                            CardTitleRow(L10n.t("英文名库"), subtitle: "\(list.count) / \(NameEngine.shared.data.namesEn.count)")
                            if list.isEmpty {
                                Text(L10n.t("这个分类下没有名字。"))
                                    .font(.system(size: 13.5))
                                    .foregroundStyle(NamingTheme.muted)
                            } else {
                                LazyVStack(spacing: 0) {
                                    ForEach(Array(list.enumerated()), id: \.offset) { index, it in
                                        EnNameRow(it: it, selected: model.enGivenPick?.n == it.n) {
                                            withAnimation(NamingMotion.pick) { model.enGivenPick = it }
                                        }
                                        if index != list.count - 1 {
                                            Divider().overlay(NamingTheme.hairline)
                                        }
                                    }
                                }
                            }
                        }

                    }
                    .padding(.horizontal, 20)
                    .padding(.top, 14)
                    .padding(.bottom, 20)
                    .namingScrollProbe()
                }
                .namingScrollTopDetector(threshold: 220) { showTop = $0 }
                .overlay(alignment: .bottomTrailing) {
                    if showTop {
                        ScrollTopButton {
                            withAnimation(.easeOut(duration: 0.25)) {
                                proxy.scrollTo(topID, anchor: .top)
                            }
                        }
                        .padding(.trailing, 18)
                        .padding(.bottom, 16)
                        .transition(.opacity)
                    }
                }
                .animation(.easeInOut(duration: 0.18), value: showTop)
            }
        }
        .namingPageBackground()
        .navigationTitle(L10n.t("选英文名"))
        .navigationBarTitleDisplayMode(.inline)
        .safeAreaInset(edge: .bottom) {
            /* 底部只剩一个确定：选中的名字的释义已经挪到筛选条下面了。 */
            DockPrimaryButton(title: L10n.t("确定")) { model.pop() }
                .padding(.horizontal, 20)
                .padding(.vertical, 10)
                .background(.regularMaterial)
        }
    }

    /// 「换一个」：在**当前筛选结果**里随机挑，整个换名动作放在一个动画事务里。
    private func shufflePick(_ list: [NMEnName]) {
        guard let pick = list.randomElement() else { return }
        withAnimation(NamingMotion.pick) { model.enGivenPick = pick }
    }

    private var searchField: some View {
        TextField(L10n.t("搜英文 / 译名 / 含义：Ava / 艾娃 / 智慧"),
                  text: Binding(get: { model.enF.keyword }, set: { model.enF.keyword = $0 }))
            .textFieldStyle(.plain)
            .font(.system(size: 15))
            .padding(11)
            .background(NamingTheme.canvas, in: RoundedRectangle(cornerRadius: NamingRadius.small, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: NamingRadius.small, style: .continuous)
                    .strokeBorder(NamingTheme.hairline, lineWidth: 1)
            }
            .autocorrectionDisabled()
            .padding(.horizontal, 20)
            .padding(.top, 8)
            .padding(.bottom, 10)
    }

    private var filterParts: [String] {
        var parts: [String] = []
        let f = model.enF
        if f.g == "f" { parts.append(L10n.t("偏女")) }
        if f.g == "m" { parts.append(L10n.t("偏男")) }
        if f.era != "all" { parts.append(NamingAppModel.enEraLabel[f.era] ?? f.era) }
        if f.vibe != "all" {
            if let v = NamingAppModel.enVibe.first(where: { $0.0 == f.vibe }) { parts.append(v.1) }
        }
        if f.theme != "all" { parts.append(L10n.t(f.theme)) }
        if f.lang != "all" { parts.append(L10n.t(f.lang)) }
        let kw = f.keyword.trimmingCharacters(in: .whitespaces)
        if !kw.isEmpty { parts.append(L10n.f("「%@」", kw)) }
        return parts
    }
}
