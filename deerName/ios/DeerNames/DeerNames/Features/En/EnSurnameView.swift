import SwiftUI

/* 选英文姓 —— 库里同时有两类：
 * 1. 西文姓（Smith / Wilson）：外国人用自己的姓，中国人也可以改用
 * 2. 华人拉丁拼写（Chen / Wong）：中国人按自己中文姓匹配英文写法
 *
 * 搜索可按拉丁拼写或中文（"wil" / "威" / "陈"）；筛选按类型 + 首字母，收进右上角漏斗。
 * 版式与「选英文名」页**统一**：列表收在一张卡里（卡头带计数），不占列表上方那块位置，
 * 一进页面先看到姓。**点整行＝弹出详情 sheet，点行右端圆钮＝选中并返回上一页**；
 * 行右端原本的「西文姓 / 华人拼写」胶囊压成一个图标，位置省下来放那个圆钮。
 * sheet 的壳在 `NamePeekSheet`（挂在根上，页面 body 不读它，列表也不会跟着重算）。 */

struct EnSurnameView: View {
    @Environment(NamingAppModel.self) private var model
    @State private var showFilters = false
    @State private var showTop = false

    private let topID = "en-surname-top"

    private var filterActive: Bool {
        model.enSurLetter != "all" || model.enSurKind != "all"
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

                        let list = model.enSurnameList()

                        /* 这张卡里装着整个姓库（一千多条），所以不要投影和圆角裁剪：见 `NamingCard(elevated:)`。 */
                        NamingCard(elevated: false) {
                            CardTitleRow(title: L10n.t("英文姓库"),
                                         subtitle: "\(list.count) / \(NameEngine.shared.enSurnames().count)") {
                                if filterActive {
                                    Text(L10n.t("已筛选"))
                                        .font(.system(size: 12))
                                        .foregroundStyle(NamingTheme.primaryDeep)
                                }
                            }
                            if list.isEmpty {
                                Text(L10n.t("没筛到这个姓，放宽一下条件。"))
                                    .font(.system(size: 13.5))
                                    .foregroundStyle(NamingTheme.muted)
                            } else {
                                LazyVStack(spacing: 0) {
                                    ForEach(Array(list.enumerated()), id: \.offset) { index, s in
                                        EnSurnameRow(
                                            s: s,
                                            selected: model.enSurname.lowercased() == s.n.lowercased(),
                                            onTap: { model.peek = .enSurname(s) },
                                            onPick: { pick(s) }
                                        )
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
                /* 首屏贴住顶部：见 `namingScrollAnchorTop`。 */
                .namingScrollAnchorTop()
                .namingScrollTopVisible($showTop)
                .overlay(alignment: .bottomTrailing) {
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
                .animation(NamingMotion.fade, value: showTop)
            }
        }
        .namingPageBackground()
        .namingNoHoverHighlight()
        .navigationTitle(L10n.t("选英文姓"))
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
            EnSurnameFilterSheet()
                .environment(model)
                .presentationDetents([.medium, .large])
        }
        .namingDock {
            DockPrimaryButton(title: L10n.t("确定")) { model.pop() }
        }
    }

    /// 行右端圆钮：选中这个姓，直接回上一页 —— 挑完就走，不用再按底部栏。
    private func pick(_ s: NMSurnameEn) {
        withAnimation(NamingMotion.pick) { model.setEnSurnameManually(s.n) }
        model.pop()
    }

    private var searchField: some View {
        NamingSearchField(text: Binding(get: { model.enSurKeyword },
                                        set: { model.enSurKeyword = $0 }),
                          placeholder: L10n.t("搜姓氏：Wil / 威 / 陈"))
            .padding(.horizontal, 20)
            .padding(.top, 8)
            .padding(.bottom, 10)
    }
}

/* 选姓页点一行，sheet 里的内容：释义 + 同姓人物。
 * sheet 的壳（标题 / 关闭 / 底部「选这个」）在 `NamePeekSheet`，这里只管内容。 */
struct EnSurnamePeekContent: View {
    let s: NMSurnameEn

    @Environment(NamingAppModel.self) private var model

    var body: some View {
        VStack(spacing: 14) {
            EnSurnameInfoCard(n: s.n)
            EnNamesakeCard(celebs: model.enSurnameCelebs(s.n), title: L10n.t("同名人物"))
        }
    }
}

struct EnSurnameFilterSheet: View {
    @Environment(NamingAppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var draftLetter = "all"
    @State private var draftKind = "all"

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    filterBlock(title: L10n.t("姓氏类型")) {
                        FilterFlow(items: [
                            ("all", L10n.t("全部类型")),
                            ("native", L10n.t("西文姓")),
                            ("cn", L10n.t("华人拼写"))
                        ], current: draftKind, spacing: 10, lineSpacing: 12) { draftKind = $0 }
                    }
                    filterBlock(title: L10n.t("首字母")) {
                        let all = NameEngine.shared.enSurnames(kind: draftKind)
                        FilterFlow(items: [("all", L10n.t("全部字母"))]
                                   + model.lettersOf(all.map { $0.n }).map { ($0, $0.uppercased()) },
                                   current: draftLetter,
                                   spacing: 10, lineSpacing: 12) { draftLetter = $0 }
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
                        draftLetter = "all"
                        draftKind = "all"
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(L10n.t("完成")) {
                        model.enSurLetter = draftLetter
                        model.enSurKind = draftKind
                        dismiss()
                    }
                }
            }
            .onAppear {
                draftLetter = model.enSurLetter
                draftKind = model.enSurKind
            }
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
