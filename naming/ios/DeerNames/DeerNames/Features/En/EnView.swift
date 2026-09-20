import SwiftUI

/* 英文名（主入口）—— 和「中文名」页**同构**：顶上同一张性格画像，下面三扇门。
 *
 *   按性格取名  /  中名西取  /  自选姓名
 *
 * 中文名那页是「按性格取名 / 西名中起 / 自选姓名」，两边一一对应：
 *
 *   西名中起（有外文名 → 起中文名）  ←→  中名西取（有中文名 → 配读音贴近的英文名）
 *
 * 差别只在取名逻辑：中文名走字形字义，英文名走语源与读音。门后面是同一份性格数据，
 * 所以画像摆在这一页顶上，换了语言、重测过，回来看一眼就知道现在按什么在排。
 *
 * **列表里不再插卡片**：早先点一行会在列表上方插一张详情卡，把下面整列顶下去，
 * 看着就是列表在抖。现在点一行是推详情页（`.enDetail`）/ 选中并返回，位置不动。
 *
 * 列表有 1400+ 条，必须用 LazyVStack：普通 VStack + ForEach 会在第一帧就把全部行
 * 建出来，界面直接卡住好几秒。 */

struct EnView: View {
    @Environment(NamingAppModel.self) private var model

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                ProfileSummaryCard()

                EntryRow(icon: L10n.isEnglish ? "P" : "性",
                         title: L10n.t("按性格取名"),
                         subtitle: L10n.t("按你的气质推荐英文名")) {
                    model.openEnRec()
                }
                EntryRow(icon: L10n.isEnglish ? "S" : "拼",
                         title: L10n.t("中名西取"),
                         subtitle: L10n.t("填上你现有的中文名，配读音贴近的英文名")) {
                    model.openEnSound()
                }
                EntryRow(icon: L10n.isEnglish ? "C" : "选",
                         title: L10n.t("自选姓名"),
                         subtitle: L10n.t("姓和名都从英文名库里挑")) {
                    model.openEnStudio()
                }
            }
            .padding(20)
        }
        .namingPageBackground()
        .navigationTitle(L10n.t("英文名"))
        .navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: - 门一：按性格取名

/// 只看性格，中文姓名填了也不影响 —— 那是「中名西取」的门。
struct EnRecView: View {
    @Environment(NamingAppModel.self) private var model

    var body: some View {
        EnModePage(topID: "en-rec-top") {
            EnSurnameField(showZh: false)

            NamingCard {
                CardTitleRow(L10n.t("按性格取名"), subtitle: L10n.t("按你的气质排"))
                GenderChips { model.genEnRecs() }
            }

            EnListCard(title: L10n.t("和你的性格最搭的英文名"),
                       empty: L10n.t("先去测一下性格，回来看这里。"),
                       list: Array(model.enRecCache.prefix(24))) { model.openEnDetail($0) }
        }
        .navigationTitle(L10n.t("按性格取名"))
        .navigationBarTitleDisplayMode(.inline)
        // 先让页面画出来，再算列表，别挡着压栈动画
        .task { model.genEnRecs() }
        .onChange(of: model.wantGender) { _, _ in model.genEnRecs() }
    }
}

// MARK: - 门二：中名西取

/// 填中文姓名 → 按读音贴近配英文名。**中文姓名只有这一个入口**，
/// 填了还顺带配出英文姓（李 → Lee、欧阳 → Ouyang）。
struct EnSoundView: View {
    @Environment(NamingAppModel.self) private var model

    var body: some View {
        EnModePage(topID: "en-sound-top") {
            EnSurnameField()

            let zh = model.enZhName.trimmingCharacters(in: .whitespaces)
            NamingCard {
                CardTitleRow(L10n.t("中名西取"),
                             subtitle: zh.isEmpty ? L10n.t("先填中文姓名") : L10n.f("照「%@」的读音贴近", zh))
                GenderChips { model.genEnSounds() }
                HintText(text: zh.isEmpty
                         ? L10n.t("在上面填中文姓名，会按它的读音挑读起来最像的英文名。")
                         : L10n.t("换一个字，这里的名字会跟着重排。"))
                    .padding(.top, 10)
            }

            if !zh.isEmpty {
                EnListCard(title: L10n.f("照「%@」配的英文名", zh),
                           empty: L10n.t("换个字试试。"),
                           list: Array(model.enSoundCache.prefix(24))) { model.openEnDetail($0, mode: "enSound") }
            }
        }
        .navigationTitle(L10n.t("中名西取"))
        .navigationBarTitleDisplayMode(.inline)
        .task { model.ensureEnSounds() }
        .onChange(of: model.enZhName) { _, _ in model.genEnSounds() }
        .onChange(of: model.wantGender) { _, _ in model.genEnSounds() }
    }
}

// MARK: - 门三：自选姓名

/// 像中文名那样自己挑姓和名（`.enSur` / `.enGiven` 两页），**两个都从英文库里找**，
/// 挑完在这里预览、存卡片。
struct EnStudioView: View {
    @Environment(NamingAppModel.self) private var model

    var body: some View {
        EnModePage(topID: "en-studio-top") {
            /* 版式和中文名的自选页一致：卡片自带小内边距，里面两行自己撑开，
             * 这样底部不会多出一截空白。 */
            NamingCard(padding: 8) {
                VStack(spacing: 0) {
                    slotRow(key: L10n.t("姓"),
                            value: model.enSurname.isEmpty ? nil : model.enSurname,
                            extra: L10n.isEnglish ? nil : model.enSurnameZh(model.enSurname),
                            placeholder: L10n.t("从英文姓库里挑（非必须）")) { model.go(.enSur) }
                    Divider().overlay(NamingTheme.hairline)
                    slotRow(key: L10n.t("名"),
                            value: model.enGivenPick?.n,
                            extra: L10n.isEnglish ? nil : model.enGivenPick?.zh,
                            placeholder: L10n.t("从英文名库里挑")) { model.go(.enGiven) }
                }
            }

            /* 选完直接在这儿显示完整信息（含同名人物），不用再点「查看详情」跳页；
             * 收藏在这儿、生成卡片挪到底部固定栏。 */
            if let g = model.enGivenPick {
                EnNameCard(it: g) {
                    HStack(spacing: 10) {
                        FavoritePill(title: model.isSavedEn(model.enFullName(g.n)) ? L10n.t("已收藏") : L10n.t("收藏"),
                                     active: !model.isSavedEn(model.enFullName(g.n))) {
                            model.toggleEnFav(g, src: "enStudio")
                        }
                        Spacer(minLength: 0)
                    }
                    .padding(.top, 14)
                }
                EnNamesakeCard(celebs: model.enCelebs(g))
            }
        }
        .navigationTitle(L10n.t("自选姓名"))
        .navigationBarTitleDisplayMode(.inline)
        .safeAreaInset(edge: .bottom) {
            /* 挑好了就在这儿出卡片，不用滚回上面找按钮。 */
            if model.enGivenPick != nil {
                DockPrimaryButton(title: L10n.t("生成卡片")) { model.openCardEnStudio() }
                    .padding(.horizontal, 20)
                    .padding(.vertical, 10)
                    .background(.regularMaterial)
            }
        }
    }

    /// 自选页的一行：左边是「名」，右边是当前选择（没选就是占位提示）。
    private func slotRow(key: String, value: String?, extra: String?,
                         placeholder: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Text(key)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(NamingTheme.ink)
                    .frame(width: L10n.isEnglish ? 46 : 24, alignment: .leading)
                VStack(alignment: .leading, spacing: 3) {
                    if let value, !value.isEmpty {
                        Text(value)
                            .font(.system(size: 18, weight: .semibold))
                            .foregroundStyle(NamingTheme.ink)
                        if let extra, !extra.isEmpty {
                            Text(extra)
                                .font(.system(size: 12))
                                .foregroundStyle(NamingTheme.muted)
                        }
                    } else {
                        Text(placeholder)
                            .font(.system(size: 14))
                            .foregroundStyle(NamingTheme.muted)
                    }
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(NamingTheme.muted)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 16)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func tag(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 11.5))
            .foregroundStyle(NamingTheme.primaryDeep)
            .padding(.horizontal, 9)
            .padding(.vertical, 4)
            .background(NamingTheme.primary.opacity(0.12), in: Capsule())
    }
}

// MARK: - 各门共用的小件

/// 性别筛选条（两扇门都有，点了重排）。
struct GenderChips: View {
    @Environment(NamingAppModel.self) private var model
    var onChange: () -> Void

    var body: some View {
        HStack(spacing: 8) {
            ForEach([("u", L10n.t("不限")), ("f", L10n.t("偏女")), ("m", L10n.t("偏男"))], id: \.0) { g in
                ChipButton(text: g.1, active: model.wantGender == g.0) {
                    model.wantGender = g.0
                    onChange()
                }
            }
            Spacer(minLength: 0)
        }
    }
}

/// 推荐结果列表卡（两扇门都有：按性格 / 中名西取）。
struct EnListCard: View {
    let title: String
    let empty: String
    let list: [EnRank]
    var onTap: (NMEnName) -> Void

    var body: some View {
        NamingCard {
            CardTitleRow(title, subtitle: list.isEmpty ? nil : L10n.f("%ld 个", list.count))
            if list.isEmpty {
                Text(empty)
                    .font(.system(size: 13.5))
                    .foregroundStyle(NamingTheme.muted)
                    .fixedSize(horizontal: false, vertical: true)
            } else {
                LazyVStack(spacing: 0) {
                    ForEach(Array(list.enumerated()), id: \.offset) { index, rank in
                        EnNameRow(it: rank.name, index: index,
                                  extra: rank.phon.map { L10n.f(" · 音近 %@", "\(Int(($0 * 100).rounded()))%") }) {
                            onTap(rank.name)
                        }
                        if index != list.count - 1 { Divider().overlay(NamingTheme.hairline) }
                    }
                }
            }
        }
    }
}

/* 英文名列表里的一行：序号（或选中勾）+ 名字 + 「译名 · 语源 · 名人」+ 年代标签。
 * 「按性格取名」「中名西取」「选姓 / 选名」几处共用一份，改版式只用改这里。 */
struct EnNameRow: View {
    let it: NMEnName
    /// 序号（从 1 起）。选名页不排号，传 nil 时就显示圆点 / 勾。
    var index: Int? = nil
    var extra: String? = nil
    var selected = false
    var onTap: () -> Void

    @Environment(NamingAppModel.self) private var model

    /* 拼行的小字。**不能写在 body 里**：ViewBuilder 会把 `if let extra { ... }`
     * 当成条件视图，而字符串拼接返回 `()`，报 "Type '()' cannot conform to 'View'"。 */
    private var meta: String {
        let celebNames = model.enCelebs(it)
            .map { $0[0] + (($0.count > 3 && !$0[3].isEmpty) ? "（\($0[3])）" : "") }
            .joined(separator: L10n.t("、"))
        /* 中文音译只在中文界面出现（英文界面下是看不懂的汉字）。 */
        var s = (L10n.isEnglish || it.zh.isEmpty ? "" : it.zh + " · ") + L10n.d("namesEn", it.n, "org", it.org)
        if !celebNames.isEmpty { s += L10n.t(" · 名人：") + celebNames }
        if let extra, !extra.isEmpty { s += extra }
        return s
    }

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 10) {
                if let index {
                    Text("\(index + 1)")
                        .font(.system(size: 12))
                        .foregroundStyle(NamingTheme.primaryDeep)
                        .frame(width: 22)
                }
                VStack(alignment: .leading, spacing: 3) {
                    Text(it.n)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(selected ? NamingTheme.primaryDeep : NamingTheme.ink)
                    Text(meta)
                        .font(.system(size: 12))
                        .foregroundStyle(NamingTheme.muted)
                        .lineLimit(1)
                }
                Spacer(minLength: 0)
                if selected {
                    Image(systemName: "checkmark")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(NamingTheme.primaryDeep)
                } else {
                    Text(NamingAppModel.enEraLabel[it.era] ?? "")
                        .font(.system(size: 11.5))
                        .foregroundStyle(NamingTheme.primaryDeep)
                        .padding(.horizontal, 9)
                        .padding(.vertical, 4)
                        .background(NamingTheme.primary.opacity(0.12), in: Capsule())
                }
            }
            .padding(.vertical, 12)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

/* 英文名的完整介绍卡：名字 + 标签 + 语源含义 + 昵称。
 * 「同名人物」拆成了 `EnNamesakeCard`（单独一张卡），这样没有名人时不会留个空壳。
 * 详情页、选名页、自选姓名页共用一份。
 *
 * 卡头**不写「当前选中」**：卡片本身就是名字，多一行标题只是噪音；右上角只留「换一个」。
 * 底下要给按钮（收藏等）就传 `footer`。 */
struct EnNameCard<Footer: View>: View {
    let it: NMEnName
    /// 选名 / 选姓页右上角的「换一个」（详情页传 nil 就不显示）。
    var onShuffle: (() -> Void)? = nil
    @ViewBuilder var footer: () -> Footer

    @Environment(NamingAppModel.self) private var model

    init(it: NMEnName, onShuffle: (() -> Void)? = nil, @ViewBuilder footer: @escaping () -> Footer) {
        self.it = it
        self.onShuffle = onShuffle
        self.footer = footer
    }

    var body: some View {
        NamingCard {
            if let onShuffle {
                HStack {
                    Spacer(minLength: 0)
                    ShuffleChip(text: L10n.t("换一个"), action: onShuffle)
                }
                .padding(.bottom, 10)
            }
            HStack(alignment: .firstTextBaseline, spacing: 10) {
                /* 主标是完整姓名（姓填了才带）：Emma Wilson。 */
                Text(model.enFullName(it.n))
                    .font(.system(size: 26, weight: .bold))
                    .foregroundStyle(NamingTheme.ink)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
            /* 副标：音标（+ 中文界面的中文音译）。
             * 「赛奇 阿德耶米」这种音译是给中文读者认读音的，英文界面下就是一串看不懂的
             * 汉字，直接不显示 —— 名字本身（拉丁字母）照旧在上面。 */
            let subParts = [
                L10n.isEnglish ? "" : model.enFullZh(it.zh),
                it.ph.isEmpty ? "" : " /\(it.ph)/"
            ].filter { !$0.isEmpty }
            if !subParts.isEmpty {
                Text(subParts.joined())
                    .font(.system(size: 13))
                    .foregroundStyle(NamingTheme.muted)
                    .padding(.top, 4)
            }
            HStack(spacing: 8) {
                tag(NamingAppModel.enEraLabel[it.era] ?? "")
                tag(it.g == "f" ? L10n.t("偏女") : it.g == "m" ? L10n.t("偏男") : L10n.t("中性"))
                if !it.org.isEmpty { tag(model.enLangOf(it).isEmpty ? L10n.t("其他") : L10n.t(model.enLangOf(it))) }
            }
            .padding(.top, 10)
            /* org（语源 + 简短释义）和 m（名字含义）都是数据正文：英文下查覆盖表，
             * 拼句的标点走词表（中文「。」→ 英文「. 」）。 */
            let orgText = L10n.d("namesEn", it.n, "org", it.org)
            let mText = L10n.d("namesEn", it.n, "m", it.m)
            Text(mText.isEmpty ? orgText : L10n.f("%@。%@", orgText, mText))
                .font(.system(size: 13.5))
                .foregroundStyle(NamingTheme.ink.opacity(0.85))
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 10)
            if !it.nick.isEmpty {
                HintText(text: L10n.t("昵称：") + it.nick.joined(separator: " / "))
                    .padding(.top, 8)
            }
            footer()
        }
    }

    private func tag(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 11.5))
            .foregroundStyle(NamingTheme.primaryDeep)
            .padding(.horizontal, 9)
            .padding(.vertical, 4)
            .background(NamingTheme.primary.opacity(0.12), in: Capsule())
    }
}

extension EnNameCard where Footer == EmptyView {
    /// 底下没有按钮时（详情页 / 选名页）的写法：`EnNameCard(it: it)`。
    init(it: NMEnName, onShuffle: (() -> Void)? = nil) {
        self.init(it: it, onShuffle: onShuffle, footer: { EmptyView() })
    }
}

/* 中英姓名对照 —— 三个门共用一张卡，放在每页最上面。
 *
 * 两种场景共用一套输入：
 *  - **中文名取英文名**：填中文姓名，自动解析出姓（复姓按最长前缀认）并配上英文拼写
 *    （李慕白 → 李 → Lee，欧阳修 → 欧阳 → Ouyang）；数据里没有对应关系的罕见姓就不填，
 *    自己写；
 *  - **外国人起名**：直接写英文姓，或点「从库里挑」去 172 个里选。
 *
 * 「自动配的」和「人定的」分得清楚：自动配的跟着中文姓名走；手动改过（或挑过）之后
 * 就不再被覆盖 —— 否则用户改好的姓会被下一个汉字顶掉。 */

struct EnSurnameField: View {
    @Environment(NamingAppModel.self) private var model
    /// 「按性格取名」页关掉中文姓名那一行：那页只看性格，中文姓名属于「中名西取」。
    var showZh = true

    var body: some View {
        NamingCard(padding: 16) {
            if showZh {
                row(label: L10n.t("中文姓名")) {
                    TextField(L10n.t("例如 李慕白 / 欧阳修"),
                              text: Binding(get: { model.enZhName }, set: { model.enZhName = $0 }))
                        .autocorrectionDisabled()
                        .onChange(of: model.enZhName) { _, _ in model.syncEnSurnameFromChineseName() }
                }
                Divider().overlay(NamingTheme.hairline)
            }
            row(label: L10n.t("英文姓")) {
                TextField(L10n.t("你自己的姓：Lee / Wilson"),
                          text: Binding(get: { model.enSurname },
                                        set: { model.setEnSurnameManually($0) }))
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.words)
                if !model.enSurname.isEmpty {
                    Button {
                        model.setEnSurnameManually("")
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 15))
                            .foregroundStyle(NamingTheme.muted)
                    }
                    .buttonStyle(.plain)
                }
                Button(L10n.t("从库里挑")) { model.go(.enSur) }
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(NamingTheme.primaryDeep)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(NamingTheme.primary.opacity(0.12), in: Capsule())
                    .buttonStyle(.plain)
            }

            /* 中文音译：库里查得到才显示（手输的冷门姓没有）。 */
            if !enZh.isEmpty {
                HintText(text: L10n.f("中文常写作：%@", enZh))
                    .padding(.top, 8)
            }

            /* 写法：同一个姓通常有三档（通用 / 拼音 / 港式），像 古 → Koo / Gu / Ku。
             * 没有唯一正确的那个 —— 大陆证件用拼音、香港用粤语、台湾常用威妥玛，所以让用户挑。 */
            let variants = model.enSurnameVariantBase().map { model.enSurnameVariants($0) } ?? []
            if variants.count > 1 {
                VStack(alignment: .leading, spacing: 8) {
                    Text(L10n.t("换个写法"))
                        .font(.system(size: 12.5))
                        .foregroundStyle(NamingTheme.muted)
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(variants, id: \.1) { v in
                                ChipButton(text: "\(v.1) \(v.0)",
                                           active: v.1.lowercased() == model.enSurname.lowercased()) {
                                    model.setEnSurnameManually(v.1)
                                }
                            }
                        }
                    }
                }
                .padding(.top, 10)
            }


            let tips = model.enSurnameSuggestions()
            if !tips.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(tips, id: \.self) { t in
                            ChipButton(text: t, active: false) { model.setEnSurnameManually(t) }
                        }
                    }
                }
                .padding(.top, 10)
            }
        }
    }

    private func row<Content: View>(label: String,
                                    @ViewBuilder content: () -> Content) -> some View {
        HStack(spacing: 10) {
            /* 中文界面「中文姓名」四个字，宽度不够就会折成两行 —— 定死宽度 + 不许换行。 */
            Text(label)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(NamingTheme.ink)
                .lineLimit(1)
                .fixedSize(horizontal: true, vertical: false)
                .frame(width: L10n.isEnglish ? 104 : 76, alignment: .leading)
            content()
        }
        .padding(.vertical, 11)
    }

    private var enZh: String { L10n.isEnglish ? "" : model.enSurnameZh(model.enSurname) }
}

/* 单个模式页：滚动内容 + 回顶按钮。
 * 状态放在这里，三扇门各自有一份，互不干扰。 */

private struct EnModePage<Content: View>: View {
    @State private var showTop = false

    let topID: String
    @ViewBuilder var content: () -> Content

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(spacing: 14) {
                    Color.clear.frame(height: 0).id(topID)
                    content()
                }
                .padding(20)
                .namingScrollProbe()
            }
            .namingPageBackground()
            .namingScrollTopDetector(threshold: 300) { showTop = $0 }
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
}
