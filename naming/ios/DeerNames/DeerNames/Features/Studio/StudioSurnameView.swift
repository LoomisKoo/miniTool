import SwiftUI

/* 选姓氏（工作台）—— 对应 app.js 的 renderStudioSur。
 * 搜索框贴在导航栏下面不滚走；列表滚远了右下角浮出回顶按钮。
 * 点格子＝选中，选中后字母筛选下面显示这个姓的来历和同姓名人，底部「确定」才返回。 */

struct StudioSurnameView: View {
    @Environment(NamingAppModel.self) private var model
    @State private var showTop = false

    private let columns = [GridItem(.adaptive(minimum: 66), spacing: 10)]
    private let topID = "studio-sur-top"

    var body: some View {
        VStack(spacing: 0) {
            searchField
            Divider().overlay(NamingTheme.hairline)

            ScrollViewReader { proxy in
                ScrollView {
                    VStack(spacing: 14) {
                        Color.clear.frame(height: 0).id(topID)

                        let list = model.studioSurs()
                        let all = NameEngine.shared.allSurnames()

                        FilterRow(items: [("all", L10n.t("全部")), ("single", L10n.t("单姓")), ("compound", L10n.t("复姓"))],
                                  current: model.studioSurF.type) { model.studioSurF.type = $0 }
                        FilterRow(items: [("all", L10n.t("不限常见度")), ("common", L10n.t("常见")), ("rare", L10n.t("少见"))],
                                  current: model.studioSurF.pop) { model.studioSurF.pop = $0 }
                        FilterRow(items: [("all", L10n.t("全部字母"))]
                                  + model.lettersOf(all.map { $0.py }).map { ($0, $0.uppercased()) },
                                  current: model.studioSurF.letter) { model.studioSurF.letter = $0 }

                        /* 选中的姓的来历摆在这儿（筛选条下面），不占底部；
                         * 同姓名人是单独一张卡，没有就不显示。 */
                        if let s = model.studioSurname {
                            VStack(spacing: 14) {
                                ZhSurnameInfoCard(s: s) { shufflePick() }
                                ZhNamesakeCard(items: model.surnameCelebs(s))
                            }
                            .geometryGroup()
                        }

                        FilterSummaryView(parts: filterParts, empty: list.isEmpty) {
                            model.studioSurF = StudioFilters()
                            model.studioSurKeyword = ""
                        }

                        HStack {
                            Text(L10n.f("%ld / %ld 个", list.count, all.count))
                                .font(.system(size: 12))
                                .foregroundStyle(NamingTheme.muted)
                            Spacer()
                        }

                        if list.isEmpty {
                            NamingCard {
                                Text(L10n.t("没筛到这个姓，放宽一下条件。"))
                                    .font(.system(size: 13.5))
                                    .foregroundStyle(NamingTheme.muted)
                            }
                        } else {
                            LazyVGrid(columns: columns, spacing: 10) {
                                ForEach(list, id: \.c) { s in
                                    Button {
                                        /* 选中态和列表下移在一个事务里，见 NamingMotion。 */
                                        withAnimation(NamingMotion.pick) { model.studioSurname = s }
                                    } label: {
                                        VStack(spacing: 3) {
                                            Text(s.c)
                                                .font(.system(size: 18, weight: .semibold))
                                                .foregroundStyle(model.studioSurname?.c == s.c ? .white : NamingTheme.ink)
                                            Text(NameEngine.shared.surnameVibe(s))
                                                .font(.system(size: 10))
                                                .foregroundStyle(model.studioSurname?.c == s.c ? .white.opacity(0.85) : NamingTheme.muted)
                                                .lineLimit(1)
                                        }
                                        .frame(maxWidth: .infinity)
                                        .padding(.vertical, 10)
                                        .background {
                                            if model.studioSurname?.c == s.c {
                                                NamingTheme.gradient
                                            } else {
                                                NamingTheme.canvas
                                            }
                                        }
                                        .clipShape(RoundedRectangle(cornerRadius: NamingRadius.small, style: .continuous))
                                        .overlay {
                                            RoundedRectangle(cornerRadius: NamingRadius.small, style: .continuous)
                                                .strokeBorder(model.studioSurname?.c == s.c ? .clear : NamingTheme.hairline, lineWidth: 1)
                                        }
                                    }
                                    .buttonStyle(.plain)
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
        .navigationTitle(L10n.t("选姓氏"))
        .navigationBarTitleDisplayMode(.inline)
        .safeAreaInset(edge: .bottom) {
            /* 底部只剩一个确定：选中的姓的来历已经挪到筛选条下面了，
             * 这里不再占着屏幕底部显示名字。 */
            DockPrimaryButton(title: L10n.t("确定")) { model.popTo(.studio) }
                .padding(.horizontal, 20)
                .padding(.vertical, 10)
                .background(.regularMaterial)
        }
    }

    /* 底部那行小字：拼音 · 英文写法 · 单/复姓 · 常见度 · 气质 —— 现在由
     * `ZhSurnameInfoCard` 显示（见 UIComponents.swift）。 */

    /// 「换一个」：在**当前筛选结果**里随机挑（筛选太狠没剩几个就先提示）。
    private func shufflePick() {
        let pool = model.studioSurs()
        if pool.isEmpty {
            model.toast(L10n.t("先放宽一下筛选"))
        } else if let pick = pool.randomElement() {
            withAnimation(NamingMotion.pick) { model.studioSurname = pick }
        }
    }

    /* 搜索框贴在导航栏下面，不跟着列表滚。 */
    private var searchField: some View {
        TextField(L10n.t("搜汉字或拼音：苏 / su / ouyang"),
                  text: Binding(get: { model.studioSurKeyword }, set: { model.studioSurKeyword = $0 }))
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
        let f = model.studioSurF
        if f.type == "single" { parts.append(L10n.t("单姓")) }
        if f.type == "compound" { parts.append(L10n.t("复姓")) }
        if f.pop == "common" { parts.append(L10n.t("常见")) }
        if f.pop == "rare" { parts.append(L10n.t("少见")) }
        if f.letter != "all" { parts.append(f.letter.uppercased()) }
        let kw = model.studioSurKeyword.trimmingCharacters(in: .whitespaces)
        if !kw.isEmpty { parts.append(L10n.f("「%@」", kw)) }
        return parts
    }
}
