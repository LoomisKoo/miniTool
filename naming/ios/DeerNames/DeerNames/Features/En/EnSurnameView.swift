import SwiftUI

/* 选英文姓 —— 「从库里挑」的入口，对应中文名的「选姓氏」页。
 *
 * 172 个姓来自 `latinSurnames`（既有英语姓 Wilson / Baker，也有华人姓氏的拉丁拼写
 * Chen / Wong）。搜索匹配拉丁拼写或中文音译（"wil" / "威" 都搜得到），
 * 再加一排首字母筛选 —— 名字不长，一屏能看到十来个，就不做网格了。
 *
 * 点一行只是**选中**（`enSurname`），选中后筛选条下面会显示这个姓的中文音译和同名人物；
 * 看好了再按底部「确定」返回。这样选错了还能改，不会被立刻弹走。 */

struct EnSurnameView: View {
    @Environment(NamingAppModel.self) private var model
    @State private var showTop = false

    private let topID = "en-sur-top"

    var body: some View {
        VStack(spacing: 0) {
            searchField
            Divider().overlay(NamingTheme.hairline)

            ScrollViewReader { proxy in
                ScrollView {
                    VStack(spacing: 14) {
                        Color.clear.frame(height: 0).id(topID)

                        let list = model.enSurnameList()
                        let all = NameEngine.shared.enSurnames()

                        FilterRow(items: [("all", L10n.t("全部字母"))]
                                  + model.lettersOf(all.map { $0.n }).map { ($0, $0.uppercased()) },
                                  current: model.enSurLetter) { model.enSurLetter = $0 }

                        /* 选中的姓的简介摆在这儿（筛选条下面），不占底部；
                         * 同名人物是单独一张卡，没有就不显示。 */
                        if !model.enSurname.isEmpty {
                            VStack(spacing: 14) {
                                EnSurnameInfoCard(n: model.enSurname) { shufflePick(list) }
                                EnNamesakeCard(celebs: model.enSurnameCelebs(model.enSurname),
                                               title: L10n.t("同名人物"))
                            }
                            .geometryGroup()
                        }

                        FilterSummaryView(parts: filterParts, empty: list.isEmpty) {
                            model.enSurKeyword = ""
                            model.enSurLetter = "all"
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
                            NamingCard(padding: 8) {
                                LazyVStack(spacing: 0) {
                                    ForEach(Array(list.enumerated()), id: \.element.id) { index, s in
                                        row(s)
                                        if index != list.count - 1 {
                                            Divider().overlay(NamingTheme.hairline).padding(.leading, 14)
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
        .navigationTitle(L10n.t("选英文姓"))
        .navigationBarTitleDisplayMode(.inline)
        .safeAreaInset(edge: .bottom) {
            /* 底部只剩一个确定：选中的姓的简介已经挪到筛选条下面了。 */
            DockPrimaryButton(title: L10n.t("确定")) { model.pop() }
                .padding(.horizontal, 20)
                .padding(.vertical, 10)
                .background(.regularMaterial)
        }
    }

    private func row(_ s: NMSurnameEn) -> some View {
        let on = model.enSurname.lowercased() == s.n.lowercased()
        return Button {
            /* 点一下只是选中：下面那张卡会换成这个姓的来历 / 同名人物，
             * 看完再按底部「确定」返回（选错了还能改）。
             * 选中态和列表下移要在一个事务里，不然行先跳、打勾后到。 */
            withAnimation(NamingMotion.pick) { model.setEnSurnameManually(s.n) }
        } label: {
            HStack(spacing: 12) {
                Text(s.n)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(on ? NamingTheme.primaryDeep : NamingTheme.ink)
                if !L10n.isEnglish {
                    Text(s.zh)
                        .font(.system(size: 12.5))
                        .foregroundStyle(NamingTheme.muted)
                }
                Spacer(minLength: 0)
                if on {
                    Image(systemName: "checkmark")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(NamingTheme.primaryDeep)
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    /// 「换一个」：在**当前筛选结果**里随机挑，整个换姓动作放在一个动画事务里。
    private func shufflePick(_ list: [NMSurnameEn]) {
        guard let pick = list.randomElement() else { return }
        withAnimation(NamingMotion.pick) { model.setEnSurnameManually(pick.n) }
    }

    private var searchField: some View {
        TextField(L10n.t("搜姓氏：Wil / 威"),
                  text: Binding(get: { model.enSurKeyword }, set: { model.enSurKeyword = $0 }))
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
        if model.enSurLetter != "all" { parts.append(model.enSurLetter.uppercased()) }
        let kw = model.enSurKeyword.trimmingCharacters(in: .whitespaces)
        if !kw.isEmpty { parts.append(L10n.f("「%@」", kw)) }
        return parts
    }
}
