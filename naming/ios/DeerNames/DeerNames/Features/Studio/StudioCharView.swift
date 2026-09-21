import SwiftUI

/* 挑选姓名 —— 搜索贴顶；已选固定在列表上方（不进 ScrollView，避免选字时网格被顶下去）；
 * 筛选进漏斗 sheet，点「完成」才应用。 */

private enum StudioCharScroll {
    static let topID = "studio-char-top"
}

struct StudioCharView: View {
    @Environment(NamingAppModel.self) private var model
    @State private var showTop = false
    @State private var showFilters = false

    private let columns = [GridItem(.adaptive(minimum: 46), spacing: 8)]

    private var filterActive: Bool {
        let f = model.studioCharF
        return f.dom != "all" || f.g != "all" || f.freq != "all" || f.letter != "all"
    }

    var body: some View {
        VStack(spacing: 0) {
            searchField
            Divider().overlay(NamingTheme.hairline)

            /* 已选卡放在滚动区外：高度变化只压缩列表视口，格子坐标不动，不会拖着选中动画跑。 */
            if !model.studioSlots.isEmpty {
                SelectedCharInfoCard(
                    chars: model.studioSlots,
                    onRemove: { ch in
                        toggleChar(ch)
                    },
                    onClear: {
                        withAnimation(NamingMotion.pick) { model.studioSlots = [] }
                    }
                )
                .padding(.horizontal, 20)
                .padding(.top, 12)
            }

            ScrollViewReader { proxy in
                ScrollView {
                    VStack(spacing: 14) {
                        Color.clear.frame(height: 0).id(StudioCharScroll.topID)

                        let engine = NameEngine.shared
                        let list = model.studioChars()

                        NamingCard {
                            CardTitleRow(L10n.t("全部字库"),
                                         subtitle: L10n.f("%ld / %ld 个", list.count, engine.data.chars.count))
                            if list.isEmpty {
                                Text(L10n.t("没筛到这个字，放宽一下条件。"))
                                    .font(.system(size: 13.5))
                                    .foregroundStyle(NamingTheme.muted)
                            } else {
                                LazyVGrid(columns: columns, spacing: 8) {
                                    ForEach(list, id: \.c) { c in
                                        let on = model.studioSlots.contains(c.c)
                                        Button {
                                            toggleChar(c.c)
                                        } label: {
                                            Text(c.c)
                                                .font(.system(size: 19, weight: on ? .semibold : .regular))
                                                .foregroundStyle(on ? .white : NamingTheme.ink)
                                                .frame(maxWidth: .infinity)
                                                .frame(height: 46)
                                                .background {
                                                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                                                        .fill(on ? AnyShapeStyle(NamingTheme.primary)
                                                              : AnyShapeStyle(c.phon ? NamingTheme.pearl : NamingTheme.background))
                                                }
                                                .overlay {
                                                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                                                        .strokeBorder(on ? NamingTheme.primaryDeep : NamingTheme.hairline,
                                                                      lineWidth: on ? 2 : 1)
                                                }
                                        }
                                        .buttonStyle(.plain)
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
                .namingScrollTopDetector(threshold: 260) { showTop = $0 }
                .overlay(alignment: .bottomTrailing) {
                    if showTop {
                        ScrollTopButton {
                            withAnimation(NamingMotion.appear) {
                                proxy.scrollTo(StudioCharScroll.topID, anchor: .top)
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
        .navigationTitle(L10n.t("挑选姓名"))
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
            StudioCharFilterSheet()
                .environment(model)
                .presentationDetents([.medium, .large])
        }
        .namingDock {
            DockPrimaryButton(title: L10n.t("确定")) { model.popTo(.studio) }
        }
    }

    /// 已选卡在滚动区外，可以用动画做选中态，不会再拖着网格位移。
    private func toggleChar(_ ch: String) {
        withAnimation(NamingMotion.pick) { model.toggleStudioChar(ch) }
    }

    private var searchField: some View {
        TextField(L10n.t("搜汉字或拼音：沐 / mu"),
                  text: Binding(get: { model.studioCharKeyword }, set: { model.studioCharKeyword = $0 }))
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
}

/* 字库筛选：草稿态，点「完成」才写回 model。 */
struct StudioCharFilterSheet: View {
    @Environment(NamingAppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var draft = CharFilters()

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    filterBlock(title: L10n.t("意象")) {
                        FilterFlow(items: [("all", L10n.t("全部意象"))]
                                   + NameEngine.shared.data.domainKeyList.map { ($0, domainLabel($0)) },
                                   current: draft.dom) { draft.dom = $0 }
                    }
                    filterBlock(title: L10n.t("性别倾向")) {
                        FilterFlow(items: [("all", L10n.t("不限性别")), ("f", L10n.t("偏女")),
                                           ("m", L10n.t("偏男")), ("u", L10n.t("中性"))],
                                   current: draft.g) { draft.g = $0 }
                    }
                    filterBlock(title: L10n.t("常用度")) {
                        FilterFlow(items: [("all", L10n.t("不限常用度")), ("common", L10n.t("常用")),
                                           ("rare", L10n.t("少见"))],
                                   current: draft.freq) { draft.freq = $0 }
                    }
                    filterBlock(title: L10n.t("拼音首字母")) {
                        FilterFlow(items: [("all", L10n.t("全部字母"))]
                                   + model.lettersOf(NameEngine.shared.data.chars.map { $0.py })
                                    .map { ($0, $0.uppercased()) },
                                   current: draft.letter) { draft.letter = $0 }
                    }
                }
                .padding(20)
            }
            .namingPageBackground()
            .navigationTitle(L10n.t("筛选"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(L10n.t("重置")) { draft = CharFilters() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(L10n.t("完成")) {
                        model.studioCharF = draft
                        dismiss()
                    }
                }
            }
            .onAppear { draft = model.studioCharF }
        }
    }

    private func filterBlock<Content: View>(title: String,
                                            @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(NamingTheme.muted)
            content()
        }
    }

    private func domainLabel(_ key: String) -> String {
        guard let d = NameEngine.shared.data.domains[key] else { return key }
        let head = d.label.split(separator: "·").first.map(String.init) ?? d.label
        return L10n.t(head.trimmingCharacters(in: .whitespaces))
    }
}
