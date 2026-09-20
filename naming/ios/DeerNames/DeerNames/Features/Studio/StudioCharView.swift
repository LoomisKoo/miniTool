import SwiftUI

/* 挑选姓名 —— 对应 app.js 的 renderStudioChar。
 * 一千多个字格，搜索框贴在导航栏下不滚走；底部固定「已选」栏，选字不会把内容顶下去。 */

private enum StudioCharScroll {
    static let topID = "studio-char-top"
}

struct StudioCharView: View {
    @Environment(NamingAppModel.self) private var model
    @State private var showTop = false

    private let columns = [GridItem(.adaptive(minimum: 46), spacing: 8)]

    var body: some View {
        VStack(spacing: 0) {
            searchField
            Divider().overlay(NamingTheme.hairline)

            ScrollViewReader { proxy in
                ScrollView {
                    VStack(spacing: 14) {
                        Color.clear.frame(height: 0).id(StudioCharScroll.topID)

                        let engine = NameEngine.shared
                        let list = model.studioChars()

                        FilterRow(items: [("all", L10n.t("全部意象"))]
                                  + engine.data.domainKeyList.map { ($0, domainLabel($0)) },
                                  current: model.studioCharF.dom) { model.studioCharF.dom = $0 }
                        FilterRow(items: [("all", L10n.t("不限性别")), ("f", L10n.t("偏女")), ("m", L10n.t("偏男")), ("u", L10n.t("中性"))],
                                  current: model.studioCharF.g) { model.studioCharF.g = $0 }
                        FilterRow(items: [("all", L10n.t("不限常用度")), ("common", L10n.t("常用")), ("rare", L10n.t("少见"))],
                                  current: model.studioCharF.freq) { model.studioCharF.freq = $0 }
                        FilterRow(items: [("all", L10n.t("全部字母"))]
                                  + model.lettersOf(engine.data.chars.map { $0.py }).map { ($0, $0.uppercased()) },
                                  current: model.studioCharF.letter) { model.studioCharF.letter = $0 }

                        FilterSummaryView(parts: filterParts, empty: list.isEmpty) {
                            model.studioCharF = CharFilters()
                            model.studioCharKeyword = ""
                        }

                        /* 选中的字就地摊开：读音 / 五行 / 释义。
                         * 早先这里什么都不显示，得按「确定」回自选页才看得到释义。 */
                        SelectedCharInfoCard(chars: model.studioSlots)

                        NamingCard {
                            CardTitleRow(L10n.t("全部字库"), subtitle: L10n.f("%ld / %ld 个", list.count, engine.data.chars.count))
                            if list.isEmpty {
                                Text(L10n.t("没筛到这个字，放宽一下条件。"))
                                    .font(.system(size: 13.5))
                                    .foregroundStyle(NamingTheme.muted)
                            } else {
                                LazyVGrid(columns: columns, spacing: 8) {
                                    ForEach(list, id: \.c) { c in
                                        let on = model.studioSlots.contains(c.c)
                                        Button {
                                            /* 填充 / 描边的切换也走同一个动效，不然点字是硬切。 */
                                            withAnimation(NamingMotion.pick) { model.toggleStudioChar(c.c) }
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
                            withAnimation(.easeOut(duration: 0.25)) {
                                proxy.scrollTo(StudioCharScroll.topID, anchor: .top)
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
        .navigationTitle(L10n.t("挑选姓名"))
        .navigationBarTitleDisplayMode(.inline)
        .safeAreaInset(edge: .bottom) {
            VStack(spacing: 8) {
                if !model.studioSlots.isEmpty {
                    HStack(spacing: 8) {
                        /* 「已选 N 字」和释义在上面那张卡里，这里只管快速取消。 */
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 8) {
                                ForEach(model.studioSlots, id: \.self) { ch in
                                    Button {
                                        model.toggleStudioChar(ch)
                                    } label: {
                                        HStack(spacing: 4) {
                                            Text(ch)
                                            Image(systemName: "xmark").font(.system(size: 9, weight: .bold))
                                        }
                                        .font(.system(size: 14, weight: .semibold))
                                        .foregroundStyle(.white)
                                        .padding(.horizontal, 11)
                                        .padding(.vertical, 6)
                                        .background {
                                            RoundedRectangle(cornerRadius: 8, style: .continuous)
                                                .fill(NamingTheme.primary)
                                        }
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                        Button(L10n.t("清空")) { model.studioSlots = [] }
                            .font(.system(size: 13))
                            .foregroundStyle(NamingTheme.primaryDeep)
                    }
                }
                DockPrimaryButton(title: L10n.t("确定")) { model.popTo(.studio) }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 10)
            .background(.regularMaterial)
        }
    }

    /* 搜索框贴在导航栏下面，不跟着列表滚。 */
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

    /* 意象域的名字是「水 · 清透」这种，筛选条上只取前半段。 */
    private func domainLabel(_ key: String) -> String {
        guard let d = NameEngine.shared.data.domains[key] else { return key }
        let head = d.label.split(separator: "·").first.map(String.init) ?? d.label
        return L10n.t(head.trimmingCharacters(in: .whitespaces))
    }

    private var filterParts: [String] {
        var parts: [String] = []
        let f = model.studioCharF
        if f.dom != "all", let d = NameEngine.shared.data.domains[f.dom] {
            let head = String(d.label.split(separator: "·").first ?? "").trimmingCharacters(in: .whitespaces)
            parts.append(L10n.t(head))
        }
        if f.g == "f" { parts.append(L10n.t("偏女")) }
        if f.g == "m" { parts.append(L10n.t("偏男")) }
        if f.g == "u" { parts.append(L10n.t("中性")) }
        if f.freq == "common" { parts.append(L10n.t("常用")) }
        if f.freq == "rare" { parts.append(L10n.t("少见")) }
        if f.letter != "all" { parts.append(f.letter.uppercased()) }
        let kw = model.studioCharKeyword.trimmingCharacters(in: .whitespaces)
        if !kw.isEmpty { parts.append(L10n.f("「%@」", kw)) }
        return parts
    }
}
