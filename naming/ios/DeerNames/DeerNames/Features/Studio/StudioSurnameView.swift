import SwiftUI

/* 选姓氏（工作台）—— 搜索贴顶；选中简介固定在列表上方；筛选进漏斗 sheet，点「完成」才应用。 */

struct StudioSurnameView: View {
    @Environment(NamingAppModel.self) private var model
    @State private var showTop = false
    @State private var showFilters = false

    private let columns = [GridItem(.adaptive(minimum: 66), spacing: 10)]
    private let topID = "studio-sur-top"

    private var filterActive: Bool {
        let f = model.studioSurF
        return f.type != "all" || f.pop != "all" || f.letter != "all"
    }

    var body: some View {
        VStack(spacing: 0) {
            searchField
            Divider().overlay(NamingTheme.hairline)

            if let s = model.studioSurname {
                VStack(spacing: 12) {
                    ZhSurnameInfoCard(s: s) { shufflePick() }
                    ZhNamesakeCard(items: model.surnameCelebs(s))
                }
                .padding(.horizontal, 20)
                .padding(.top, 12)
            }

            ScrollViewReader { proxy in
                ScrollView {
                    VStack(spacing: 14) {
                        Color.clear.frame(height: 0).id(topID)

                        let list = model.studioSurs()
                        let all = NameEngine.shared.allSurnames()

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
                                    let on = model.studioSurname?.c == s.c
                                    Button {
                                        pickSurname(s)
                                    } label: {
                                        VStack(spacing: 3) {
                                            Text(s.c)
                                                .font(.system(size: 18, weight: .semibold))
                                                .foregroundStyle(on ? .white : NamingTheme.ink)
                                            Text(NameEngine.shared.surnameVibe(s))
                                                .font(.system(size: 10))
                                                .foregroundStyle(on ? .white.opacity(0.85) : NamingTheme.muted)
                                                .lineLimit(1)
                                        }
                                        .frame(maxWidth: .infinity)
                                        .padding(.vertical, 10)
                                        .background {
                                            if on {
                                                NamingTheme.gradient
                                            } else {
                                                NamingTheme.canvas
                                            }
                                        }
                                        .clipShape(RoundedRectangle(cornerRadius: NamingRadius.small, style: .continuous))
                                        .overlay {
                                            RoundedRectangle(cornerRadius: NamingRadius.small, style: .continuous)
                                                .strokeBorder(on ? .clear : NamingTheme.hairline, lineWidth: 1)
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

    private func pickSurname(_ s: NMSurname) {
        withAnimation(NamingMotion.pick) { model.studioSurname = s }
    }

    private func shufflePick() {
        let pool = model.studioSurs()
        if pool.isEmpty {
            model.toast(L10n.t("先放宽一下筛选"))
        } else if let pick = pool.randomElement() {
            pickSurname(pick)
        }
    }

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
}

struct StudioSurnameFilterSheet: View {
    @Environment(NamingAppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var draft = StudioFilters()

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    filterBlock(title: L10n.t("类型")) {
                        FilterFlow(items: [("all", L10n.t("全部")), ("single", L10n.t("单姓")),
                                           ("compound", L10n.t("复姓"))],
                                   current: draft.type) { draft.type = $0 }
                    }
                    filterBlock(title: L10n.t("常见度")) {
                        FilterFlow(items: [("all", L10n.t("不限常见度")), ("common", L10n.t("常见")),
                                           ("rare", L10n.t("少见"))],
                                   current: draft.pop) { draft.pop = $0 }
                    }
                    filterBlock(title: L10n.t("拼音首字母")) {
                        let all = NameEngine.shared.allSurnames()
                        FilterFlow(items: [("all", L10n.t("全部字母"))]
                                   + model.lettersOf(all.map { $0.py }).map { ($0, $0.uppercased()) },
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
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(NamingTheme.muted)
            content()
        }
    }
}
