import SwiftUI

/* 选姓氏（工作台）—— 搜索贴顶；**点一行＝弹出详情 sheet，点行右端圆钮＝选中并回自选页**；
 * 筛选进漏斗 sheet，点「完成」才应用；列表滚远后出现回顶部。
 *
 * 版式从「4 列紧凑网格」改成和英文选姓一致的列表行：格子里塞不下「详情 + 选择」两套点击，
 * 一行只占一格的高度，但横着能放下姓、拼音/常见度/气质、单复姓胶囊和那个选择钮。
 * 详情 sheet 的壳在 `NamePeekSheet`（挂在根上，页面 body 不读它，列表也不会跟着重算）。 */

struct StudioSurnameView: View {
    @Environment(NamingAppModel.self) private var model
    @State private var showFilters = false
    @State private var showTop = false

    private let topID = "studio-sur-top"

    private var filterActive: Bool {
        let f = model.studioSurF
        return f.type != "all" || f.pop != "all" || f.letter != "all"
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

                        let list = model.studioSurs()
                        let all = NameEngine.shared.allSurnames()

                        HStack {
                            Text(L10n.f("%ld / %ld 个", list.count, all.count))
                                .font(.system(size: 12))
                                .foregroundStyle(NamingTheme.muted)
                            Spacer()
                            if filterActive {
                                Text(L10n.t("已筛选"))
                                    .font(.system(size: 12))
                                    .foregroundStyle(NamingTheme.primaryDeep)
                            }
                        }

                        if list.isEmpty {
                            NamingCard {
                                Text(L10n.t("没筛到这个姓，放宽一下条件。"))
                                    .font(.system(size: 13.5))
                                    .foregroundStyle(NamingTheme.muted)
                            }
                        } else {
                            /* 整库列表（一千多条），不要投影和圆角裁剪：见 `NamingCard(elevated:)`。 */
                            NamingCard(elevated: false) {
                                LazyVStack(spacing: 0) {
                                    ForEach(Array(list.enumerated()), id: \.offset) { index, s in
                                        NamingPickerRow(
                                            title: s.c,
                                            meta: meta(s),
                                            tag: NameEngine.shared.isCompound(s) ? L10n.t("复姓") : L10n.t("单姓"),
                                            selected: model.studioSurname?.c == s.c,
                                            onTap: { model.peek = .zhSurname(s) },
                                            onPick: { pickSurname(s) }
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
        .navigationTitle(L10n.t("选姓氏"))
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
            StudioSurnameFilterSheet()
                .environment(model)
                .presentationDetents([.medium, .large])
        }
        .namingDock {
            DockPrimaryButton(title: L10n.t("确定")) { model.popTo(.studio) }
        }
    }

    /// 行内小字：拼音 · 常见度 · 气质（单/复姓单独放右端胶囊，比图标清楚）。
    private func meta(_ s: NMSurname) -> String {
        let eng = NameEngine.shared
        let pop = L10n.t(["", "少见", "较少", "一般", "常见", "大姓"][max(0, min(5, s.pop))])
        return [eng.surPy(s), pop, eng.surnameVibe(s)]
            .filter { !$0.isEmpty }
            .joined(separator: " · ")
    }

    /// 选中这个姓并回自选页 —— 行右端圆钮走这条（sheet 里的「选这个」走根上的 `model.pickStudioSurname`）。
    private func pickSurname(_ s: NMSurname) {
        withAnimation(NamingMotion.pick) { model.studioSurname = s }
        model.popTo(.studio)
    }

    private var searchField: some View {
        TextField(L10n.t("搜汉字或拼音：苏 / su / ouyang"),
                  text: Binding(get: { model.studioSurKeyword }, set: { model.studioSurKeyword = $0 }))
            .textFieldStyle(.plain)
            .font(.system(size: 15))
            .padding(11)
            .background(NamingTheme.canvas, in: RoundedRectangle(cornerRadius: NamingRadius.small, style: .continuous))
            .autocorrectionDisabled()
            .padding(.horizontal, 20)
            .padding(.top, 8)
            .padding(.bottom, 10)
    }
}

/* 选姓页点一行，sheet 里的内容：释义 + 同姓人物。
 * sheet 的壳（标题 / 关闭 / 底部「选这个」）在 `NamePeekSheet`，这里只管内容。 */
struct StudioSurnamePeekContent: View {
    let s: NMSurname

    @Environment(NamingAppModel.self) private var model

    var body: some View {
        VStack(spacing: 14) {
            ZhSurnameInfoCard(s: s)
            ZhNamesakeCard(items: model.surnameCelebs(s))
        }
    }
}

struct StudioSurnameFilterSheet: View {
    @Environment(NamingAppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var draft = StudioFilters()

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    filterBlock(title: L10n.t("类型")) {
                        FilterFlow(items: [("all", L10n.t("全部")), ("single", L10n.t("单姓")),
                                           ("compound", L10n.t("复姓"))],
                                   current: draft.type,
                                   spacing: 10, lineSpacing: 12) { draft.type = $0 }
                    }
                    filterBlock(title: L10n.t("常见度")) {
                        FilterFlow(items: [("all", L10n.t("不限常见度")), ("common", L10n.t("常见")),
                                           ("rare", L10n.t("少见"))],
                                   current: draft.pop,
                                   spacing: 10, lineSpacing: 12) { draft.pop = $0 }
                    }
                    filterBlock(title: L10n.t("拼音首字母")) {
                        let all = NameEngine.shared.allSurnames()
                        FilterFlow(items: [("all", L10n.t("全部字母"))]
                                   + model.lettersOf(all.map { $0.py }).map { ($0, $0.uppercased()) },
                                   current: draft.letter,
                                   spacing: 10, lineSpacing: 12) { draft.letter = $0 }
                    }
                }
                .padding(24)
            }
            .namingPageBackground()
            .navigationTitle(L10n.t("筛选"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(L10n.t("重置")) { draft = StudioFilters() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(L10n.t("完成")) {
                        model.studioSurF = draft
                        dismiss()
                    }
                }
            }
            .onAppear { draft = model.studioSurF }
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
