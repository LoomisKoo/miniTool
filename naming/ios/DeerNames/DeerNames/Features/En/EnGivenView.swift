import SwiftUI

/* 选英文名 —— 自选英文名的另一半，对应中文名的「选字」页。
 *
 * 就是原来的「英文名库」列表（1496 条 + 性别 / 年代 / 气质 / 寓意 / 语源五组筛选），
 * 只是从「浏览并看详情」改成「挑一个名字」：**点整行＝弹出详情 sheet，点行右端圆钮＝选中并返回自选页**。
 * 详情不再摊在列表上面 —— 那一块会把整列名字往下推，看着就是列表在抖。
 * sheet 的壳在 `NamePeekSheet`（挂在根上，页面 body 不读它，列表也不会跟着重算）。
 *
 * 筛选和选姓页**版式统一**：不占着列表上面那块位置，收进右上角漏斗、点开才是 sheet
 * —— 五组筛选条铺在顶上，一进页面就先看到一片胶囊，名字反而要往下翻。
 * 搜索框留在顶上（选名时最常用的是搜，不是筛）。
 * 列表滚远后右下角浮出「回到顶部」。
 *
 * **一进来卡头和最前面几条看不见**：卡的高度是系统先按估算量出来的，一张卡里装 1496 行时
 * 这个估算偏小，而卡里的内容默认居中 —— 差的那一截就从**顶部**裁掉了（卡的投影还得为整块
 * 几万点高的内容做一次离屏渲染，首帧更容易画不全）。所以：卡内内容改成顶对齐（见 `NamingCard`），
 * 这张超长的卡也不再加投影 / 圆角裁剪（`NamingCard(elevated: false)`）。估算修正前误差都落在卡片
 * 底部，屏幕上看到的始终是从第一条开始。
 * 滚动位置本身也锚 top（`namingScrollAnchorTop`）；行的身份用名字而不是下标，「回到顶部」的
 * 淡入淡出动画只挂在那个按钮上 —— 这些是防「整列挪一截 / 像被重排」的保险。 */

struct EnGivenView: View {
    @Environment(NamingAppModel.self) private var model
    @State private var showFilters = false
    @State private var showTop = false

    private let topID = "en-given-top"

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

            ScrollViewReader { proxy in
                ScrollView {
                    VStack(spacing: 14) {
                        Color.clear.frame(height: 0).id(topID)
                            .namingScrollTopAnchor()

                        let list = model.browseEnNames()

                        /* 这张卡里装着 1496 行，所以不要投影和圆角裁剪：见 `NamingCard(elevated:)`。 */
                        NamingCard(elevated: false) {
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
                                    /* 行的身份用**名字**，不用下标：这张列表有 1496 行，用下标
                                     * 当 id 时任何一次重排都可能让 SwiftUI 把行和内容对错位
                                     * （看起来就是「数据顺序变了」）。名字在本库里唯一。 */
                                    ForEach(Array(list.enumerated()), id: \.element.n) { index, it in
                                        EnNameRow(it: it,
                                                  selected: model.enGivenPick?.n == it.n,
                                                  onTap: { model.peek = .enName(it) },
                                                  onPick: { pick(it) })
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
                .coordinateSpace(name: "namingScroll")
                .namingScrollSurface()
                /* 一进页面从**顶部**开始（首帧之后补上的导航栏/底栏 inset 不会再把内容挪走）。
                 * 见 `namingScrollAnchorTop`。 */
                .namingScrollAnchorTop()
                .namingScrollTopVisible($showTop)
                .overlay(alignment: .bottomTrailing) {
                    Group {
                        if showTop {
                            ScrollTopButton {
                                withAnimation(NamingMotion.appear) {
                                    proxy.scrollTo(topID, anchor: .top)
                                }
                            }
                            .padding(.trailing, 18)
                            .padding(.bottom, 16)
                            .transition(.opacity)
                        }
                    }
                    /* 动画只挂在这个按钮上：挂在 ScrollView 上时，弹 sheet 那一刻系统动
                     * 一下安全区引发的重排会被一起「动画」，整列名字滑着走，就是那个抖动。 */
                    .animation(NamingMotion.fade, value: showTop)
                }
            }
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
            DockPrimaryButton(title: L10n.t("确定")) { model.pop() }
        }
    }

    /// 行右端圆钮：选中这个名，直接回自选页 —— 挑完就走，不用再按底部栏。
    private func pick(_ it: NMEnName) {
        withAnimation(NamingMotion.pick) { model.enGivenPick = it }
        model.pop()
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

/* 选名页点一行，sheet 里的内容：完整释义 + 同姓名人。
 * 顺序是「先看，再决定」：名人卡压在按钮**上面** —— 按钮塞在名字卡里时，
 * 视觉上内容到那个大按钮就结束了，下面的名人整块被当成「没了」。
 * sheet 的壳（标题 / 关闭 / 底部「选这个」）在 `NamePeekSheet`，这里只管内容。 */
struct EnGivenPeekContent: View {
    let it: NMEnName

    @Environment(NamingAppModel.self) private var model

    var body: some View {
        VStack(spacing: 14) {
            EnNameCard(it: it)
            /* 没有同名人物时这张卡自己整块消失（有就显示，没有就不显示）。 */
            EnNamesakeCard(celebs: model.enCelebs(it))
        }
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
