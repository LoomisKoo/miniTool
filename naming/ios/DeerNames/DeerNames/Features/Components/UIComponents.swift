import SwiftUI

/* 与 H5 对应的通用小件：胶囊、筛选行、筛选摘要、卡片标题、底部主按钮。 */

struct ChipButton: View {
    let text: String
    var active: Bool
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(text)
                .font(.system(size: 13, weight: active ? .semibold : .regular))
                .foregroundStyle(active ? .white : NamingTheme.ink)
                .padding(.horizontal, 12)
                .padding(.vertical, 7)
                .background {
                    if active {
                        NamingTheme.gradient
                    } else {
                        NamingTheme.pearl
                    }
                }
                .clipShape(Capsule())
        }
        .buttonStyle(NamingPressButtonStyle())
        .sensoryFeedback(.selection, trigger: active)
    }
}

struct FilterRow: View {
    let items: [(String, String)]
    let current: String
    var action: (String) -> Void

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(items, id: \.0) { item in
                    ChipButton(text: item.1, active: current == item.0) { action(item.0) }
                }
            }
            .padding(.vertical, 1)
        }
    }
}

/// 筛选 sheet 用：胶囊自动换行，不横滑。
struct FilterFlow: View {
    let items: [(String, String)]
    let current: String
    var action: (String) -> Void

    var body: some View {
        FlowLayout(spacing: 8, lineSpacing: 8) {
            ForEach(items, id: \.0) { item in
                ChipButton(text: item.1, active: current == item.0) { action(item.0) }
            }
        }
    }
}

struct FilterSummaryView: View {
    let parts: [String]
    let empty: Bool
    var onClear: () -> Void

    var body: some View {
        let active = parts.filter { !$0.isEmpty }
        if active.isEmpty && !empty {
            EmptyView()
        } else {
            HStack(spacing: 8) {
                if active.isEmpty {
                    Text(L10n.t("没有符合条件的结果"))
                        .font(.system(size: 13))
                        .foregroundStyle(NamingTheme.muted)
                } else {
                    Text(L10n.t("已筛选"))
                        .font(.system(size: 12))
                        .foregroundStyle(NamingTheme.muted)
                    Text(active.joined(separator: " · "))
                        .font(.system(size: 13))
                        .foregroundStyle(NamingTheme.ink)
                        .lineLimit(2)
                }
                Spacer(minLength: 0)
                Button(active.isEmpty ? L10n.t("清除筛选") : L10n.t("清除"), action: onClear)
                    .font(.system(size: 13))
                    .foregroundStyle(NamingTheme.primaryDeep)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 9)
            .background(NamingTheme.pearl.opacity(0.7), in: RoundedRectangle(cornerRadius: NamingRadius.small, style: .continuous))
        }
    }
}

struct CardTitleRow<Right: View>: View {
    let title: String
    var subtitle: String? = nil
    /// 卡头下面的间距。卡里只有卡头时传 0 —— 否则上下留白不对称，卡显得空高。
    var bottomInset: CGFloat = 12
    @ViewBuilder var right: () -> Right

    init(title: String, subtitle: String? = nil, bottomInset: CGFloat = 12,
         @ViewBuilder right: @escaping () -> Right) {
        self.title = title
        self.subtitle = subtitle
        self.bottomInset = bottomInset
        self.right = right
    }

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text(title)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(NamingTheme.ink)
            if let subtitle {
                Text(subtitle)
                    .font(.system(size: 12))
                    .foregroundStyle(NamingTheme.muted)
            }
            Spacer(minLength: 0)
            right()
        }
        .padding(.bottom, bottomInset)
    }
}

extension CardTitleRow where Right == EmptyView {
    init(_ title: String, subtitle: String? = nil, bottomInset: CGFloat = 12) {
        self.init(title: title, subtitle: subtitle, bottomInset: bottomInset, right: { EmptyView() })
    }
}

struct DockPrimaryButton: View {
    let title: String
    var enabled: Bool = true
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .frame(height: 50)
                .background {
                    if enabled {
                        NamingTheme.gradient
                    } else {
                        NamingTheme.muted.opacity(0.4)
                    }
                }
                .clipShape(RoundedRectangle(cornerRadius: NamingRadius.medium, style: .continuous))
        }
        .buttonStyle(NamingPressButtonStyle())
        .disabled(!enabled)
    }
}

/* 底部操作栏：
 * - iOS 26+：`safeAreaBar`，吃系统 scroll edge 模糊
 * - 以下：`safeAreaInset` + Material 毛玻璃
 * 内置左右 20 / 上下 10 padding，调用方只塞按钮或 Chip 行。 */
extension View {
    func namingDock<Dock: View>(
        visible: Bool = true,
        @ViewBuilder content: @escaping () -> Dock
    ) -> some View {
        modifier(NamingDockModifier(visible: visible, dock: content))
    }
}

private struct NamingDockModifier<Dock: View>: ViewModifier {
    var visible: Bool
    @ViewBuilder var dock: () -> Dock

    func body(content: Content) -> some View {
        if visible {
            docked(content)
        } else {
            content
        }
    }

    @ViewBuilder
    private func docked(_ content: Content) -> some View {
        if #available(iOS 26.0, *) {
            content.safeAreaBar(edge: .bottom) { dockBody }
        } else {
            content.safeAreaInset(edge: .bottom) {
                dockBody
                    .background {
                        ZStack(alignment: .top) {
                            Rectangle()
                                .fill(.ultraThinMaterial)
                                .ignoresSafeArea(edges: .bottom)
                            NamingTheme.hairline
                                .frame(height: 0.5)
                        }
                    }
            }
        }
    }

    private var dockBody: some View {
        dock()
            .padding(.horizontal, 20)
            .padding(.vertical, 10)
    }
}

struct GhostButton: View {
    let title: String
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 15, weight: .medium))
                .foregroundStyle(NamingTheme.primaryDeep)
                .frame(maxWidth: .infinity)
                .frame(height: 44)
                .overlay {
                    RoundedRectangle(cornerRadius: NamingRadius.medium, style: .continuous)
                        .stroke(NamingTheme.primary.opacity(0.5), lineWidth: 1)
                }
        }
        .buttonStyle(NamingPressButtonStyle())
    }
}

struct HintText: View {
    let text: String
    var body: some View {
        Text(text)
            .font(.system(size: 12.5))
            .foregroundStyle(NamingTheme.muted)
            .fixedSize(horizontal: false, vertical: true)
    }
}

struct NamingToastView: View {
    let text: String
    var body: some View {
        Text(text)
            .font(.system(size: 14))
            .foregroundStyle(.white)
            .padding(.horizontal, 18)
            .padding(.vertical, 11)
            .background(.black.opacity(0.78), in: Capsule())
            .padding(.bottom, 90)
    }
}

/* MARK: - 滚动辅助

 * 浮层里的列表很长（姓氏 300+、备选名一屏屏排），所以需要一个「滚远了就浮出来」的
 * 回到顶部钮。
 *
 * 实现上不依赖命名的 coordinateSpace：滚动内容顶部和 ScrollView 自己各埋一个探针，
 * 都取 .global 坐标，两者之差就是滚了多少 —— 这是 SwiftUI 里最不容易失效的测法
 * （0 高度视图的 background 或命名坐标空间在部分版本上会拿不到更新）。
 * 只有跨越阈值时才回调，避免滚动中不停地刷新视图。 */

private struct NamingScrollContentTopKey: PreferenceKey {
    static var defaultValue: CGFloat = .greatestFiniteMagnitude
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = min(value, nextValue())
    }
}

private struct NamingScrollViewportTopKey: PreferenceKey {
    static var defaultValue: CGFloat = .greatestFiniteMagnitude
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = min(value, nextValue())
    }
}

extension View {
    /// 挂在滚动内容里（给一个够高的视图，不要给 0 高度的占位），把内容顶部的位置报上去。
    func namingScrollProbe() -> some View {
        background {
            GeometryReader { geo in
                Color.clear.preference(key: NamingScrollContentTopKey.self,
                                       value: geo.frame(in: .global).minY)
            }
        }
    }

    /// 挂在 ScrollView 上：滚过 `threshold` 就回调 true，回到顶部回调 false。
    func namingScrollTopDetector(threshold: CGFloat = 160,
                                 onChange: @escaping (Bool) -> Void) -> some View {
        modifier(NamingScrollTopDetector(threshold: threshold, onChange: onChange))
    }
}

private struct NamingScrollTopDetector: ViewModifier {
    let threshold: CGFloat
    let onChange: (Bool) -> Void

    @State private var contentTop: CGFloat = .greatestFiniteMagnitude
    @State private var viewportTop: CGFloat = .greatestFiniteMagnitude
    @State private var shown = false

    func body(content: Content) -> some View {
        content
            .background {
                GeometryReader { geo in
                    Color.clear.preference(key: NamingScrollViewportTopKey.self,
                                           value: geo.frame(in: .global).minY)
                }
            }
            .onPreferenceChange(NamingScrollViewportTopKey.self) { y in
                viewportTop = y
                update()
            }
            .onPreferenceChange(NamingScrollContentTopKey.self) { y in
                contentTop = y
                update()
            }
    }

    private func update() {
        guard contentTop < .greatestFiniteMagnitude, viewportTop < .greatestFiniteMagnitude else { return }
        let hidden = max(0, viewportTop - contentTop)
        let next = hidden >= threshold
        guard next != shown else { return }
        shown = next
        onChange(next)
    }
}

struct ScrollTopButton: View {
    var action: () -> Void
    @State private var pressed = false

    var body: some View {
        Image(systemName: "arrow.up")
            .font(.system(size: 15, weight: .semibold))
            .foregroundStyle(NamingTheme.primaryDeep)
            .frame(width: 42, height: 42)
            .background(NamingTheme.background, in: Circle())
            .overlay { Circle().strokeBorder(NamingTheme.hairline, lineWidth: 1) }
            .shadow(color: .black.opacity(0.16), radius: 8, y: 3)
            .contentShape(Circle())
            .scaleEffect(pressed ? 0.97 : 1)
            .animation(NamingMotion.press, value: pressed)
            /* 列表惯性滚动时，ScrollView 的 pan 手势会抢走普通点击（TapGesture 要等
             * 「按下 + 抬起 + 没移动」才成立，减速中这一串常常被打断），所以：
             *   1. 用 minimumDistance: 0 的 DragGesture，手指按下就成立；
             *   2. 用 highPriorityGesture 保证优先于滚动；
             *   3. 在按下那一刻就触发（而不是等抬起），即使触摸随后被取消也一定能生效。 */
            .highPriorityGesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { _ in
                        guard !pressed else { return }
                        pressed = true
                        action()
                    }
                    .onEnded { _ in pressed = false }
            )
            .accessibilityAddTraits(.isButton)
            .accessibilityLabel(L10n.t("回到顶部"))
            .accessibilityAction { action() }
    }
}

struct CelebSection: View {
    let given: String
    let chars: [String]

    var body: some View {
        let list = NameEngine.shared.celebsForName(given, chars, limit: 3)
        if list.isEmpty {
            EmptyView()
        } else {
            NamingCard {
                CardTitleRow(L10n.t("相关名人"), subtitle: L10n.t("灵感参考"))
                VStack(alignment: .leading, spacing: 14) {
                    ForEach(Array(list.enumerated()), id: \.offset) { _, x in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack(spacing: 8) {
                                Text(x.name)
                                    .font(.system(size: 15, weight: .semibold))
                                    .foregroundStyle(NamingTheme.ink)
                                Text(x.how)
                                    .font(.system(size: 12))
                                    .foregroundStyle(NamingTheme.primaryDeep)
                            }
                            /* era 是「唐·诗人」这类数据标签：英文下逐段查表（唐→Tang、诗人→poet）。 */
                            Text(L10n.celebTag(x.era))
                                .font(.system(size: 12))
                                .foregroundStyle(NamingTheme.muted)
                            Text(L10n.d("celebs", x.name, x.bio))
                                .font(.system(size: 13.5))
                                .foregroundStyle(NamingTheme.ink.opacity(0.85))
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }
                    .padding(.top, 12)
            }
        }
    }
}

/* 性格画像摘要 —— 中文名页和英文名页**摆同一张**。
 * 两边用的是同一份 `profile` / 生辰数据，长相不该有两套。
 * 测过就显示性格（和生辰），没测过只给一句说明，不挡路。 */
struct ProfileSummaryCard: View {
    @Environment(NamingAppModel.self) private var model

    var body: some View {
        if let p = model.profile, p.hasAnswered {
            NamingCard {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(L10n.t("性格画像"))
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(NamingTheme.ink)
                    Spacer(minLength: 0)
                    Button(L10n.t("重新测")) { model.openQuiz() }
                        .font(.system(size: 13))
                        .foregroundStyle(NamingTheme.primaryDeep)
                }
                Text(NameEngine.shared.describe(p))
                    .font(.system(size: 13.5))
                    .foregroundStyle(NamingTheme.muted)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 6)
                if let b = model.baziInfo, !b.summary.isEmpty {
                    Text(b.summary)
                        .font(.system(size: 12.5))
                        .foregroundStyle(NamingTheme.muted)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.top, 4)
                }
            }
        } else {
            NamingCard {
                Text(L10n.t("还没测过性格"))
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(NamingTheme.ink)
                Text(L10n.t("做 8 道题，两边的名字都会按你的气质来排。"))
                    .font(.system(size: 13))
                    .foregroundStyle(NamingTheme.muted)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 6)
            }
        }
    }
}

/* 「已选这一项」的卡 —— 英文姓 / 中文姓 / 英文名共用一套版式，
 * 摆在筛选条下面（`StudioSurnameView` / `EnSurnameView` / `EnGivenView`）。
 *
 * 早先这块信息是塞在底部固定栏里、确定按钮上方，占了屏幕底部最显眼的位置还挡着列表；
 * 挪到筛选条下面之后：列表照旧滚，信息跟着筛选条走。
 *
 * **正文和名人拆成两张卡**：没有同名条目时（英文姓常常没有）就只剩一张矮卡，
 * 所以卡头下面不留间距、卡的 padding 也收一档，免得空出一个大壳子。 */

/// 中文姓：拼音 · 英文写法 · 单/复姓 · 常见度 · 气质 + 释义。
/// 右上角「换一个」随机挑一个（`onShuffle` 传 nil 就不显示）。
struct ZhSurnameInfoCard: View {
    let s: NMSurname
    var onShuffle: (() -> Void)? = nil

    var body: some View {
        NamingCard(padding: 18) {
            CardTitleRow(title: s.c, subtitle: surLine, bottomInset: 10) {
                if let onShuffle {
                    ShuffleChip(text: L10n.t("换一个"), action: onShuffle)
                }
            }
            Text(meaning)
                .font(.system(size: 13.5))
                .foregroundStyle(NamingTheme.ink.opacity(0.85))
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var meaning: String {
        s.m.isEmpty ? L10n.t("暂无更多介绍") : L10n.d("surnames", s.c, s.m)
    }

    /// 副标：拼音 · 英文写法 · 单/复姓 · 常见度 · 气质。
    private var surLine: String {
        let eng = NameEngine.shared
        var parts: [String] = [eng.surPy(s)]
        if !s.en.isEmpty || !s.ro.isEmpty { parts.append(s.en.isEmpty ? s.ro : s.en) }
        parts.append(eng.isCompound(s) ? L10n.t("复姓") : L10n.t("单姓"))
        parts.append(L10n.t(["", "少见", "较少", "一般", "常见", "大姓"][max(0, min(5, s.pop))]))
        parts.append(eng.surnameVibe(s))
        return parts.filter { !$0.isEmpty }.joined(separator: " · ")
    }
}

/// 英文姓：中文音译。没有正文，所以只留一个矮卡头。
struct EnSurnameInfoCard: View {
    let n: String
    var onShuffle: (() -> Void)? = nil

    @Environment(NamingAppModel.self) private var model

    var body: some View {
        /* 中文音译只给中文界面看（英文界面下是看不懂的汉字）。 */
        let zh = L10n.isEnglish ? "" : model.enSurnameZh(n)
        NamingCard(padding: 14) {
            CardTitleRow(title: n, subtitle: zh.isEmpty ? nil : L10n.f("中文常写作：%@", zh),
                         bottomInset: 0) {
                if let onShuffle {
                    ShuffleChip(text: L10n.t("换一个"), action: onShuffle)
                }
            }
        }
    }
}

/* 同名人物 —— 单独一张卡，三种「已选」卡共用。
 * `EnNamesakeCard` 吃 `enCelebs` 的那种 `[[String]]`（英文姓 / 英文名都用），
 * `ZhNamesakeCard` 吃中文名人。空的时候两张都自己消失，调用处不用判断。 */

struct EnNamesakeCard: View {
    let celebs: [[String]]
    /// 姓和名共用这张卡，只有标题不一样：「同名人物」（同姓）/「同姓名人」（同名）。
    var title: String = L10n.t("同姓名人")
    var limit: Int = 4

    var body: some View {
        if !celebs.isEmpty {
            NamingCard {
                CardTitleRow(title, subtitle: L10n.t("灵感参考"))
                VStack(alignment: .leading, spacing: 12) {
                    ForEach(Array(celebs.prefix(limit).enumerated()), id: \.offset) { _, x in
                        VStack(alignment: .leading, spacing: 3) {
                            HStack(spacing: 6) {
                                Text(x[0])
                                    .font(.system(size: 14, weight: .semibold))
                                    .foregroundStyle(NamingTheme.ink)
                                if x.count > 3 && !x[3].isEmpty {
                                    Text("（\(x[3])）")
                                        .font(.system(size: 12))
                                        .foregroundStyle(NamingTheme.muted)
                                }
                            }
                            if x.count > 1 && !x[1].isEmpty {
                                Text(L10n.d("enCelebs", x[0], "role", x[1]))
                                    .font(.system(size: 12))
                                    .foregroundStyle(NamingTheme.muted)
                            }
                            if x.count > 2 && !x[2].isEmpty {
                                Text(L10n.d("enCelebs", x[0], "bio", x[2]))
                                    .font(.system(size: 13))
                                    .foregroundStyle(NamingTheme.ink.opacity(0.85))
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                        }
                    }
                }
                    .padding(.top, 12)
            }
        }
    }
}

struct ZhNamesakeCard: View {
    let items: [CelebrityHit]

    var body: some View {
        if !items.isEmpty {
            NamingCard {
                CardTitleRow(L10n.t("同姓名人"), subtitle: L10n.t("灵感参考"))
                VStack(alignment: .leading, spacing: 10) {
                    ForEach(Array(items.enumerated()), id: \.offset) { _, x in
                        VStack(alignment: .leading, spacing: 3) {
                            HStack(spacing: 8) {
                                Text(x.name)
                                    .font(.system(size: 14, weight: .semibold))
                                    .foregroundStyle(NamingTheme.ink)
                                Text(L10n.celebTag(x.era))
                                    .font(.system(size: 11.5))
                                    .foregroundStyle(NamingTheme.primaryDeep)
                            }
                            Text(L10n.d("celebs", x.name, x.bio))
                                .font(.system(size: 13))
                                .foregroundStyle(NamingTheme.ink.opacity(0.8))
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }
                    .padding(.top, 12)
            }
        }
    }
}

/* 一行放不下就换行、每个子视图保持自己的大小 —— 按钮排 / 标签排用。
 * 名字详情页那四个按钮（换名 / 备选名 / 收藏 / 选姓氏）在英文下并排放不下，
 * 横滑会把最后一个切一半（看着像坏了），换行才看得全。 */
struct FlowLayout: Layout {
    var spacing: CGFloat = 8
    var lineSpacing: CGFloat = 8

    private struct Row {
        var indices: [Int] = []
        var width: CGFloat = 0
        var height: CGFloat = 0
    }

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        let rows = rows(maxWidth: maxWidth, subviews: subviews)
        let height = rows.reduce(0) { $0 + $1.height }
            + lineSpacing * CGFloat(max(0, rows.count - 1))
        return CGSize(width: proposal.width ?? (rows.map(\.width).max() ?? 0), height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var y = bounds.minY
        for row in rows(maxWidth: bounds.width, subviews: subviews) {
            var x = bounds.minX
            for index in row.indices {
                let size = subviews[index].sizeThatFits(.unspecified)
                subviews[index].place(at: CGPoint(x: x, y: y + (row.height - size.height) / 2),
                                      proposal: ProposedViewSize(size))
                x += size.width + spacing
            }
            y += row.height + lineSpacing
        }
    }

    private func rows(maxWidth: CGFloat, subviews: Subviews) -> [Row] {
        var result: [Row] = []
        var current = Row()
        for index in subviews.indices {
            let size = subviews[index].sizeThatFits(.unspecified)
            let needed = current.indices.isEmpty ? size.width : current.width + spacing + size.width
            if !current.indices.isEmpty && needed > maxWidth {
                result.append(current)
                current = Row()
                current.indices = [index]
                current.width = size.width
                current.height = size.height
            } else {
                current.width = needed
                current.height = max(current.height, size.height)
                current.indices.append(index)
            }
        }
        if !current.indices.isEmpty { result.append(current) }
        return result
    }
}

/* 选字页的「已选」卡 —— 点一个字就在上面摊开读音 / 五行 / 释义。
 * 取消单字、清空整批都在这张卡上，不占底部栏。 */
struct SelectedCharInfoCard: View {
    let chars: [String]
    var onRemove: ((String) -> Void)? = nil
    var onClear: (() -> Void)? = nil

    var body: some View {
        if !chars.isEmpty {
            NamingCard(padding: 16) {
                CardTitleRow(title: L10n.f("已选 %ld 字", chars.count), bottomInset: 4) {
                    if let onClear {
                        Button(L10n.t("清空"), action: onClear)
                            .font(.system(size: 13))
                            .foregroundStyle(NamingTheme.primaryDeep)
                    }
                }
                VStack(spacing: 0) {
                    ForEach(chars, id: \.self) { ch in
                        CharInfoRow(ch: ch, onRemove: onRemove.map { handler in { handler(ch) } })
                        if ch != chars.last {
                            Divider().overlay(NamingTheme.hairline)
                        }
                    }
                }
            }
        }
    }
}

/// 一个字的信息：大字 + 读音 + 五行 + 释义；可选右侧取消。
struct CharInfoRow: View {
    let ch: String
    var onRemove: (() -> Void)? = nil

    @Environment(NamingAppModel.self) private var model

    var body: some View {
        let info = model.studioCharInfo(ch)
        VStack(alignment: .leading, spacing: 3) {
            HStack(alignment: .firstTextBaseline, spacing: 7) {
                Text(ch)
                    .font(.system(size: 21, weight: .semibold))
                    .foregroundStyle(NamingTheme.ink)
                Text(info.py)
                    .font(.system(size: 11.5))
                    .foregroundStyle(NamingTheme.muted)
                if let wx = info.wx {
                    Text(wx)
                        .font(.system(size: 10.5))
                        .foregroundStyle(NamingTheme.primaryDeep)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(NamingTheme.primary.opacity(0.12), in: Capsule())
                }
                Spacer(minLength: 0)
                if let onRemove {
                    Button(action: onRemove) {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 18))
                            .foregroundStyle(NamingTheme.muted)
                    }
                    .buttonStyle(NamingPressButtonStyle())
                    .accessibilityLabel(L10n.t("取消选中"))
                }
            }
            Text(info.note)
                .font(.system(size: 12.5))
                .foregroundStyle(NamingTheme.ink.opacity(0.85))
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, 8)
    }
}

/* 「换一个」小按钮 —— 选姓 / 选名页的「已选」卡右上角。
 * 随机只能在**当前筛选结果**里挑，所以整块都是筛完的池子里取。 */
struct ShuffleChip: View {
    let text: String
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 4) {
                Image(systemName: "shuffle")
                    .font(.system(size: 11, weight: .semibold))
                Text(text)
                    .font(.system(size: 13, weight: .medium))
            }
            .foregroundStyle(NamingTheme.primaryDeep)
            .padding(.horizontal, 11)
            .padding(.vertical, 6)
            .background(NamingTheme.primary.opacity(0.12), in: Capsule())
        }
        .buttonStyle(NamingPressButtonStyle())
    }
}

/// 「收藏 / 已收藏」胶囊 —— 中文自选页、英文名卡片、详情页共用一套样式。
struct FavoritePill: View {
    let title: String
    let active: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: active ? "heart" : "heart.fill")
                    .font(.system(size: 12, weight: .semibold))
                Text(title)
                    .font(.system(size: 14, weight: .medium))
            }
            .foregroundStyle(active ? .white : NamingTheme.ink)
            .padding(.horizontal, 14)
            .padding(.vertical, 9)
            .background(active ? AnyShapeStyle(NamingTheme.primaryDeep) : AnyShapeStyle(NamingTheme.pearl))
            .clipShape(Capsule())
        }
        .buttonStyle(NamingPressButtonStyle())
        .sensoryFeedback(.impact(flexibility: .soft, intensity: 0.6), trigger: active)
    }
}

