import SwiftUI

/* 浮层内容 —— 对应 app.js 的 surnamePickerHtml / poolPickerHtml / banNamesSheetHtml。 */

struct SurnameSheet: View {
    @Environment(NamingAppModel.self) private var model
    @State private var showTop = false
    private let columns = [GridItem(.adaptive(minimum: 70), spacing: 10)]
    private let topID = "surname-top"

    var body: some View {
        Group {
            if model.profile == nil {
                Text(L10n.t("先做一遍测试，再来选姓氏。"))
                    .font(.system(size: 14))
                    .foregroundStyle(NamingTheme.muted)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                    .padding(.top, 30)
            } else {
                VStack(spacing: 0) {
                    // 搜索框固定在顶部，不跟着列表滚
                    searchField

                    Divider().overlay(NamingTheme.hairline)

                    ScrollViewReader { proxy in
                        ScrollView {
                            let kw = model.surKeyword.trimmingCharacters(in: .whitespaces).lowercased()
                            let all = NameEngine.shared.allSurnames()
                            let list = kw.isEmpty ? all : NameEngine.shared.searchSurnames(all, kw)

                            VStack(spacing: 12) {
                                Color.clear.frame(height: 0).id(topID)

                                NamingCard {
                                    if !kw.isEmpty {
                                        CardTitleRow(L10n.f("搜索「%@」", kw), subtitle: "\(list.count)")
                                    }
                                    if list.isEmpty {
                                        Text(L10n.t("没搜到这个姓。"))
                                            .font(.system(size: 13.5))
                                            .foregroundStyle(NamingTheme.muted)
                                    } else {
                                        LazyVGrid(columns: columns, spacing: 10) {
                                            ForEach(Array(list.prefix(400)), id: \.c) { s in
                                                surnameCell(s)
                                            }
                                        }
                                    }
                                }
                            }
                            .padding(16)
                            .namingScrollProbe()
                        }
                        .namingScrollTopDetector { showTop = $0 }
                        .overlay(alignment: .bottomTrailing) {
                            if showTop {
                                ScrollTopButton {
                                    withAnimation(.easeOut(duration: 0.25)) {
                                        proxy.scrollTo(topID, anchor: .top)
                                    }
                                }
                                .padding(.trailing, 16)
                                .padding(.bottom, 16)
                                .transition(.opacity)
                            }
                        }
                        .animation(.easeInOut(duration: 0.18), value: showTop)
                    }
                }
            }
        }
        .background(NamingTheme.background)
    }

    private var searchField: some View {
        TextField(L10n.t("搜汉字或拼音：苏 / su / ouyang"),
                  text: Binding(get: { model.surKeyword }, set: { model.surKeyword = $0 }))
            .textFieldStyle(.plain)
            .font(.system(size: 15))
            .padding(11)
            .background(NamingTheme.canvas, in: RoundedRectangle(cornerRadius: NamingRadius.small, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: NamingRadius.small, style: .continuous)
                    .strokeBorder(NamingTheme.hairline, lineWidth: 1)
            }
            .autocorrectionDisabled()
            .padding(.horizontal, 16)
            .padding(.top, 6)
            .padding(.bottom, 10)
    }

    private func surnameCell(_ s: NMSurname) -> some View {
        let on = model.surname?.c == s.c
        return Button {
            model.pickSurname(s)
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
                    NamingTheme.background
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

struct PoolSheet: View {
    @Environment(NamingAppModel.self) private var model
    @State private var showTop = false
    private let poolTopID = "pool-top"

    var body: some View {
        VStack(spacing: 0) {
            if model.surname == nil {
                Text(L10n.t("先挑一个姓，再看这个姓下的名字。"))
                    .font(.system(size: 14))
                    .foregroundStyle(NamingTheme.muted)
                    .padding(.top, 30)
                Spacer()
            } else {
                VStack(spacing: 10) {
                    HStack(spacing: 8) {
                        ForEach([("u", L10n.t("不限")), ("f", L10n.t("女")), ("m", L10n.t("男"))], id: \.0) { g in
                            ChipButton(text: g.1, active: model.poolGender == g.0) {
                                model.poolGender = g.0
                                model.rebuildPool()
                            }
                        }
                        Spacer(minLength: 0)
                    }
                    HStack(spacing: 8) {
                        ForEach([("all", L10n.t("全部")), ("common", L10n.t("常见")), ("literary", L10n.t("清雅"))], id: \.0) { t in
                            ChipButton(text: t.1, active: model.poolTag == t.0) { model.poolTag = t.0 }
                        }
                        Spacer(minLength: 0)
                    }
                    HStack(spacing: 8) {
                        Text(L10n.t("姓氏："))
                            .font(.system(size: 13))
                            .foregroundStyle(NamingTheme.muted)
                        Text(model.surname?.c ?? "")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(NamingTheme.ink)
                        Text(NameEngine.shared.surnameVibe(model.surname))
                            .font(.system(size: 12))
                            .foregroundStyle(NamingTheme.muted)
                        Spacer(minLength: 0)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 8)
                .padding(.bottom, 12)

                let rows = model.poolNameRows()
                if rows.isEmpty {
                    Text(L10n.t("没有符合条件的名字。"))
                        .font(.system(size: 14))
                        .foregroundStyle(NamingTheme.muted)
                        .padding(.top, 24)
                    Spacer()
                } else {
                    ScrollViewReader { proxy in
                        ScrollView {
                            VStack(spacing: 0) {
                                Color.clear.frame(height: 0).id(poolTopID)

                                ForEach(rows, id: \.full) { x in
                                    Button {
                                        model.pickPoolName(x.given)
                                    } label: {
                                        HStack(spacing: 10) {
                                            VStack(alignment: .leading, spacing: 3) {
                                                Text(x.full)
                                                    .font(.system(size: 16, weight: .semibold))
                                                    .foregroundStyle(NamingTheme.ink)
                                                Text(L10n.listPyPrefix(Pinyin.titleCase(Pinyin.name(x.surname, x.chars))) + model.tagOf(x) + " · " + truncatedWhy(x))
                                                    .font(.system(size: 12))
                                                    .foregroundStyle(NamingTheme.muted)
                                                    .lineLimit(1)
                                            }
                                            Spacer(minLength: 0)
                                            Text(NameEngine.shared.euphonyLabel(
                                                x.euphony ?? NameEngine.shared.euphony(model.surname, x.chars)))
                                                .font(.system(size: 12))
                                                .foregroundStyle(NamingTheme.primaryDeep)
                                                .padding(.horizontal, 9)
                                                .padding(.vertical, 4)
                                                .background(NamingTheme.primary.opacity(0.12), in: Capsule())
                                        }
                                        .padding(.horizontal, 16)
                                        .padding(.vertical, 12)
                                        .contentShape(Rectangle())
                                    }
                                    .buttonStyle(.plain)
                                    Divider().overlay(NamingTheme.hairline)
                                }
                            }
                        }
                        .namingScrollProbe()
                        .namingScrollTopDetector { showTop = $0 }
                        .overlay(alignment: .bottomTrailing) {
                            if showTop {
                                ScrollTopButton {
                                    withAnimation(.easeOut(duration: 0.25)) {
                                        proxy.scrollTo(poolTopID, anchor: .top)
                                    }
                                }
                                .padding(.trailing, 16)
                                .padding(.bottom, 16)
                                .transition(.opacity)
                            }
                        }
                        .animation(.easeInOut(duration: 0.18), value: showTop)
                    }
                }
            }
        }
        .background(NamingTheme.background)
        .onAppear { model.rebuildPool() }
    }

    private func truncatedWhy(_ x: NameResult) -> String {
        let why = model.whyFor(x)
        return why.count > 26 ? String(why.prefix(26)) + "…" : why
    }
}

struct BanNamesSheet: View {
    @Environment(NamingAppModel.self) private var model

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                let names = Array(model.feedback.banFull)
                if names.isEmpty {
                    Text(L10n.t("还没有标记不喜欢的名字。在详情页点「换名」会自动记下来。"))
                        .font(.system(size: 14))
                        .foregroundStyle(NamingTheme.muted)
                } else {
                    HintText(text: L10n.t("这些名字不会再出现在推荐里。点「恢复」取消一条。"))
                    NamingCard {
                        VStack(spacing: 0) {
                            ForEach(names, id: \.self) { full in
                                HStack {
                                    Text(full)
                                        .font(.system(size: 16, weight: .semibold))
                                        .foregroundStyle(NamingTheme.ink)
                                    Spacer()
                                    Button(L10n.t("恢复")) {
                                        model.feedback.banFull.remove(full)
                                        model.toast(L10n.f("已恢复「%@」", full))
                                        if model.screen == .detail { model.applyFeedbackToDetail() }
                                        if model.screen == .result { model.refreshRecs() }
                                        if model.feedback.banFull.isEmpty { model.sheet = nil }
                                    }
                                    .font(.system(size: 13))
                                    .foregroundStyle(NamingTheme.primaryDeep)
                                }
                                .padding(.vertical, 12)
                                if full != names.last {
                                    Divider().overlay(NamingTheme.hairline)
                                }
                            }
                        }
                    }
                }
            }
            .padding(16)
        }
        .background(NamingTheme.background)
    }
}
