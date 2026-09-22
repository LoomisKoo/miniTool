import SwiftUI

/* 选英文名 —— 自选英文名的另一半，对应中文名的「选字」页。
 *
 * 就是原来的「英文名库」列表（1496 条 + 性别 / 年代 / 气质 / 寓意 / 语源五组筛选），
 * 只是从「浏览并看详情」改成「挑一个名字」：点一行＝选中，底部固定栏确定后回自选页。
 *
 * 筛选和选姓页**版式统一**：不占着列表上面那块位置，收进右上角漏斗、点开才是 sheet
 * —— 五组筛选条铺在顶上，一进页面就先看到一片胶囊，名字反而要往下翻。
 * 搜索框留在顶上（选名时最常用的是搜，不是筛）。 */

struct EnGivenView: View {
    @Environment(NamingAppModel.self) private var model
    @State private var showFilters = false

    /// 有没有用到筛选组（关键词不算：它在搜索框里看得见）。
    private var filterActive: Bool {
        let f = model.enF
        return f.g != "all" || f.era != "all" || f.vibe != "all"
            || f.theme != "all" || f.lang != "all"
    }

    var body: some View {
        VStack(spacing: 0) {
            searchField
            Divider().overlay(NamingTheme.hairline)

            ScrollView {
                VStack(spacing: 14) {
                    let list = model.browseEnNames()

                    /* 选中的名字直接摊开显示在这儿（不再要「查看详情」跳页），
                     * 右上角能换一个；同名人物是单独一张卡。
                     *
                     * 这一块一出现就会把列表整体往下推，所以**不写 `.id(...)`**：
                     * 换名字时卡片原地更新（跟着 `withAnimation` 一起重排），
                     * 而不是销毁重建 —— 重建会晚一帧落地，看着就是「卡一下」。 */
                    if let g = model.enGivenPick {
                        VStack(spacing: 14) {
                            EnNameCard(it: g, onShuffle: { shufflePick(list) })
                            EnNamesakeCard(celebs: model.enCelebs(g))
                        }
                    }

                    NamingCard {
                        CardTitleRow(title: L10n.t("英文名库"),
                                     subtitle: "\(list.count) / \(NameEngine.shared.data.namesEn.count)") {
                            if filterActive {
                                Text(L10n.t("已筛选"))
                                    .font(.system(size: 12))
                                    .foregroundStyle(NamingTheme.primaryDeep)
                            }
                        }
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
            }
            .namingScrollSurface()
        }
        .namingPageBackground()
        .namingNoHoverHighlight()
        .navigationTitle(L10n.t("选英文名"))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { showFilters = true } label: {
                    Image(systemName: filterActive
                          ? "line.3.horizontal.decrease.circle.fill"
                          : "line.3.horizontal.decrease.circle")
                        .foregroundStyle(filterActive ? NamingTheme.primaryDeep : NamingTheme.ink)
                }
                .accessibilityLabel(L10n.t("筛选"))
            }
        }
        .sheet(isPresented: $showFilters) {
            EnGivenFilterSheet()
                .environment(model)
                .presentationDetents([.medium, .large])
        }
        .namingDock {
            /* 底部只剩一个确定：选中的名字的释义已经摊在上面了。 */
            DockPrimaryButton(title: L10n.t("确定")) { model.pop() }
        }
    }

    /// 「换一个」：在**当前筛选结果**里随机挑，整个换名动作放在一个动画事务里。
    private func shufflePick(_ list: [NMEnName]) {
        guard let pick = list.randomElement() else { return }
        withAnimation(NamingMotion.pick) { model.enGivenPick = pick }
    }

    private var searchField: some View {
        NamingSearchField(text: Binding(get: { model.enF.keyword },
                                        set: { model.enF.keyword = $0 }),
                          placeholder: L10n.t("搜英文 / 译名 / 含义：Ava / 艾娃 / 智慧"))
            .padding(.horizontal, 20)
            .padding(.top, 8)
            .padding(.bottom, 10)
    }
}

/* 选名页的筛选 sheet —— 和选姓页那张同构：草稿态改完点「完成」才生效，
 * 这样点着玩不会每一下都让背后 1450 行的列表重算。 */
struct EnGivenFilterSheet: View {
    @Environment(NamingAppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var draft = EnFilters()

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    filterBlock(title: L10n.t("性别")) {
                        FilterFlow(items: [("all", L10n.t("不限性别")), ("f", L10n.t("偏女")), ("m", L10n.t("偏男"))],
                                   current: draft.g, spacing: 10, lineSpacing: 12) { draft.g = $0 }
                    }
                    filterBlock(title: L10n.t("年代")) {
                        FilterFlow(items: NamingAppModel.enEra, current: draft.era,
                                   spacing: 10, lineSpacing: 12) { draft.era = $0 }
                    }
                    filterBlock(title: L10n.t("气质")) {
                        FilterFlow(items: NamingAppModel.enVibe, current: draft.vibe,
                                   spacing: 10, lineSpacing: 12) { draft.vibe = $0 }
                    }
                    filterBlock(title: L10n.t("寓意")) {
                        FilterFlow(items: NamingAppModel.enTheme, current: draft.theme,
                                   spacing: 10, lineSpacing: 12) { draft.theme = $0 }
                    }
                    filterBlock(title: L10n.t("语源")) {
                        FilterFlow(items: NamingAppModel.enLang, current: draft.lang,
                                   spacing: 10, lineSpacing: 12) { draft.lang = $0 }
                    }
                }
                .padding(24)
            }
            .namingPageBackground()
            .navigationTitle(L10n.t("筛选"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(L10n.t("重置")) {
                        /* 只清筛选组：关键词是搜索框那块的事，别把用户打的字也抹了。 */
                        draft = EnFilters(keyword: draft.keyword)
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(L10n.t("完成")) {
                        model.enF = draft
                        dismiss()
                    }
                }
            }
            .onAppear { draft = model.enF }
        }
    }

    private func filterBlock<Content: View>(title: String,
                                            @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(NamingTheme.muted)
            content()
        }
    }
}
