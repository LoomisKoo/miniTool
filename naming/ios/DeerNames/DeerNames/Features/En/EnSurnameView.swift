import SwiftUI

/* 选英文姓 —— 库里同时有两类：
 * 1. 西文姓（Smith / Wilson）：外国人用自己的姓，中国人也可以改用
 * 2. 华人拉丁拼写（Chen / Wong）：中国人按自己中文姓匹配英文写法
 *
 * 搜索可按拉丁拼写或中文（"wil" / "威" / "陈"）；筛选按类型 + 首字母，收进右上角漏斗。
 * 版式与「选英文名」页**统一**：已选卡摊在列表上面、列表收在一张卡里（卡头带计数），
 * 不占列表上方那块位置，一进页面先看到名字。 */

struct EnSurnameView: View {
    @Environment(NamingAppModel.self) private var model
    @State private var showFilters = false

    private var filterActive: Bool {
        model.enSurLetter != "all" || model.enSurKind != "all"
    }

    /// 正在搜索（关键词非空，光打空格不算）。搜索时列表只出结果，
    /// 把已选卡让开位置，取消搜索再回来。
    private var searching: Bool {
        !model.enSurKeyword.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var body: some View {
        VStack(spacing: 0) {
            searchField
            Divider().overlay(NamingTheme.hairline)

            ScrollView {
                VStack(spacing: 14) {
                    let list = model.enSurnameList()

                    /* 选中的姓直接摊开显示在这儿（不再要「查看详情」跳页），
                     * 右上角能换一个；同姓人物是单独一张卡。
                     *
                     * 正在搜索时不显示：这时用户要的是搜索结果，已选卡只会把结果往下推。
                     * 取消搜索（清空关键词）后自己回来。
                     *
                     * 这一块一出现就会把列表整体往下推，所以**不写 `.id(...)`**：
                     * 换姓时卡片原地更新（跟着 `withAnimation` 一起重排），
                     * 而不是销毁重建 —— 重建会晚一帧落地，看着就是「卡一下」。 */
                    if !model.enSurname.isEmpty && !searching {
                        VStack(spacing: 14) {
                            EnSurnameInfoCard(n: model.enSurname) { shufflePick() }
                            EnNamesakeCard(celebs: model.enSurnameCelebs(model.enSurname),
                                           title: L10n.t("同名人物"))
                        }
                    }

                    NamingCard {
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
                                        selected: model.enSurname.lowercased() == s.n.lowercased()
                                    ) {
                                        withAnimation(NamingMotion.pick) {
                                            model.setEnSurnameManually(s.n)
                                        }
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

    /// 「换一个」：在**当前筛选结果**里随机挑，整个换姓动作放在一个动画事务里。
    private func shufflePick() {
        guard let pick = model.enSurnameList().randomElement() else {
            model.toast(L10n.t("先放宽一下筛选"))
            return
        }
        withAnimation(NamingMotion.pick) { model.setEnSurnameManually(pick.n) }
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
