import SwiftUI
import UIKit

/* 与 H5 对应的通用小件：胶囊、筛选行、筛选摘要、卡片标题、底部主按钮。 */

struct ChipButton: View {
    let text: String
    var active: Bool
    var action: () -> Void

    var body: some View {
        /* 不用 Button：ScrollView 里密布胶囊时，系统按钮层会残留半透明圆角块（选英文姓页）。 */
        Text(text)
            .font(.system(size: 13, weight: active ? .semibold : .regular))
            .foregroundStyle(active ? .white : NamingTheme.ink)
            .padding(.horizontal, 14)
            .padding(.vertical, 9)
            .background {
                if active {
                    NamingTheme.gradient
                } else {
                    NamingTheme.pearl
                }
            }
            .clipShape(Capsule())
            .contentShape(Capsule())
            .onTapGesture(perform: action)
            .sensoryFeedback(.selection, trigger: active)
            /* 悬停高亮会在这页残留成灰块（见 `namingNoHoverHighlight`）。 */
            .namingNoHoverHighlight()
    }
}

/// 筛选 sheet 用：胶囊自动换行，不横滑。
struct FilterFlow: View {
    let items: [(String, String)]
    let current: String
    var spacing: CGFloat = 10
    var lineSpacing: CGFloat = 12
    var action: (String) -> Void

    var body: some View {
        FlowLayout(spacing: spacing, lineSpacing: lineSpacing) {
            ForEach(items, id: \.0) { item in
                ChipButton(text: item.1, active: current == item.0) { action(item.0) }
            }
        }
    }
}

/* 列表页的搜索框（选英文名 / 选英文姓共用）：输入框 + 尾部清除按钮。
 *
 * 不用系统自带的 clear button：它只在部分配置下出现，图标大小和颜色也跟这一套不一致。
 * 自己画一个，点一下清空输入。 */
struct NamingSearchField: View {
    @Binding var text: String
    let placeholder: String

    var body: some View {
        HStack(spacing: 8) {
            TextField(placeholder, text: $text)
                .textFieldStyle(.plain)
                .font(.system(size: 15))
                .autocorrectionDisabled()
            /* 没输入时不占位：空框右边挂个灰叉看着像出错。 */
            if !text.isEmpty {
                Button {
                    text = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 15))
                        .foregroundStyle(NamingTheme.muted)
                }
                .buttonStyle(.plain)
                .namingNoHoverHighlight()
                .accessibilityLabel(L10n.t("清空"))
            }
        }
        .padding(11)
        .background(NamingTheme.canvas, in: RoundedRectangle(cornerRadius: NamingRadius.small, style: .continuous))
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
 * - iOS 26+：`safeAreaBar`，系统 scroll edge 渐变模糊
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

/* 列表行（英文选名 / 选姓 + 中文选姓氏共用）：序号 + 主标 + 小字 + 右端。
 *
 * 这些页：**点整行＝看详情（弹出 sheet），点右端圆钮＝选中并返回上一页**，
 * 两件事分开，所以在行里是两个各自独立的热区。
 * 右端标识就是胶囊里的字（选名页的年代 / 选姓页的西文姓·华人拼写）。
 *
 * **行版式只此一处**，`EnNameRow` / `EnSurnameRow` / 中文选姓氏都只是把数据拼成人话
 * 再传进来 —— 想改列表样式只改这里，别往各自的 wrapper 里抄一遍。 */
struct NamingPickerRow: View {
    let title: String
    /// 行内小字（拼好的字符串，不传就是没有）。
    let meta: String
    /// 右端胶囊里的字（年代 / 西文姓·华人拼写 / 单复姓）。
    var tag: String = ""
    /// 序号（从 1 起）。选名 / 选姓页不排号，传 nil 就连那 22pt 都不占。
    var index: Int? = nil
    var selected = false
    /// 点整行：看详情。
    var onTap: () -> Void
    /// 右端圆钮：选中 + 返回上一页。推荐列表里不传，就没有这个钮。
    var onPick: (() -> Void)? = nil

    var body: some View {
        /* 不用 Button：列表里密布胶囊（年代 / 类型标签）时，**系统按钮层会在卡片上
         * 残留半透明圆角块** —— 就是那块跟着胶囊大小、位置走的「遮罩」。
         * 点按自己接手势；原来 `.plain` 本来也没有按压反馈，手感不变。 */
        HStack(spacing: 10) {
            /* 只有这一块是「看详情」的热区。右端那两个各自接自己的手势：
             * 全行铺一层 onTapGesture 再接内层手势，内层会被外层吃掉。 */
            HStack(spacing: 10) {
                if let index {
                    Text("\(index + 1)")
                        .font(.system(size: 12))
                        .foregroundStyle(NamingTheme.primaryDeep)
                        .frame(width: 22)
                }
                VStack(alignment: .leading, spacing: 3) {
                    Text(title)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(selected ? NamingTheme.primaryDeep : NamingTheme.ink)
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                    if !meta.isEmpty {
                        Text(meta)
                            .font(.system(size: 12))
                            .foregroundStyle(NamingTheme.muted)
                            .lineLimit(1)
                    }
                }
                Spacer(minLength: 0)
            }
            .contentShape(Rectangle())
            .onTapGesture(perform: onTap)

            if !tag.isEmpty {
                Text(tag)
                    .font(.system(size: 11.5))
                    .foregroundStyle(NamingTheme.primaryDeep)
                    .padding(.horizontal, 9)
                    .padding(.vertical, 4)
                    .background(NamingTheme.primary.opacity(0.12), in: Capsule())
                    .lineLimit(1)
            }

            if let onPick {
                NamingPickCircleButton(selected: selected, action: onPick)
            }
        }
        .padding(.vertical, 12)
        .namingNoHoverHighlight()
    }
}

/// 列表行右端的「选这个」圆钮：点一下＝选中 + 返回上一页。
/// 已选中那行是实心渐变勾，其余是浅底勾 —— 一眼看出现在选的是哪个。
private struct NamingPickCircleButton: View {
    var selected: Bool
    var action: () -> Void

    var body: some View {
        Image(systemName: "checkmark")
            .font(.system(size: 12, weight: .bold))
            .foregroundStyle(selected ? .white : NamingTheme.primaryDeep)
            .frame(width: 30, height: 30)
            .background {
                if selected {
                    NamingTheme.gradient
                } else {
                    NamingTheme.primary.opacity(0.12)
                }
            }
            .clipShape(Circle())
            .contentShape(Circle())
            .onTapGesture(perform: action)
            .namingNoHoverHighlight()
            .accessibilityAddTraits(.isButton)
            .accessibilityLabel(L10n.t("选择"))
    }
}

/* 「点一行看详情」的弹层是系统 sheet（`NamePeekSheet`，挂在根上）：曾经试过页内
 * overlay 来躲开 sheet 弹出时背后列表「缩一下」，但那层盖不住页面栈（根上那层在
 * `.background` 里，会被页面自己的底色压住），视觉上还和页内卡片打架，改回 sheet。 */

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

/// 列表滚远后的「回到顶部」浮钮。
struct ScrollTopButton: View {
    var action: () -> Void
    @State private var pressed = false

    private let size: CGFloat = 44

    var body: some View {
        ZStack {
            Color.clear
                .frame(width: size, height: size)
                .namingFloatingCircleChrome()
            ScrollTopImmediateButton(
                accessibilityLabel: L10n.t("回到顶部"),
                pressed: $pressed,
                action: action
            )
            .frame(width: size, height: size)
        }
        .scaleEffect(pressed ? 0.97 : 1)
        .animation(NamingMotion.press, value: pressed)
        .namingNoHoverHighlight()
        .accessibilityAddTraits(.isButton)
        .accessibilityLabel(L10n.t("回到顶部"))
        .accessibilityAction { action() }
    }
}

/* 惯性滚动时 SwiftUI 手势常被 ScrollView 吃掉；UIKit 在 touchDown 就触发更稳。 */
private struct ScrollTopImmediateButton: UIViewRepresentable {
    var accessibilityLabel: String
    @Binding var pressed: Bool
    var action: () -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(pressed: $pressed, action: action)
    }

    func makeUIView(context: Context) -> UIButton {
        let button = UIButton(type: .system)
        let config = UIImage.SymbolConfiguration(pointSize: 15, weight: .semibold)
        button.setImage(UIImage(systemName: "arrow.up", withConfiguration: config), for: .normal)
        button.tintColor = UIColor(NamingTheme.primaryDeep)
        button.backgroundColor = .clear
        button.accessibilityLabel = accessibilityLabel
        button.addTarget(context.coordinator, action: #selector(Coordinator.touchDown), for: .touchDown)
        button.addTarget(context.coordinator, action: #selector(Coordinator.touchEnded), for: [
            .touchUpInside, .touchUpOutside, .touchCancel
        ])
        return button
    }

    func updateUIView(_ uiView: UIButton, context: Context) {
        context.coordinator.action = action
    }

    final class Coordinator: NSObject {
        @Binding var pressed: Bool
        var action: () -> Void
        private var didFire = false

        init(pressed: Binding<Bool>, action: @escaping () -> Void) {
            _pressed = pressed
            self.action = action
        }

        @objc func touchDown() {
            guard !didFire else { return }
            didFire = true
            pressed = true
            action()
        }

        @objc func touchEnded() {
            didFire = false
            pressed = false
        }
    }
}

extension View {
    /// 浮在页面渐变底上的圆形钮：iOS 26+ 液态玻璃，更早用 Material + 描边阴影。
    @ViewBuilder
    func namingFloatingCircleChrome() -> some View {
        if #available(iOS 26.0, *) {
            glassEffect(.regular.interactive(), in: Circle())
        } else {
            background(.ultraThinMaterial, in: Circle())
                .overlay(Circle().strokeBorder(NamingTheme.hairline.opacity(0.9), lineWidth: 0.5))
                .shadow(color: .black.opacity(0.14), radius: 10, y: 4)
        }
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
/// 「换一个」与姓同一行（`onShuffle` 传 nil 就不显示）。
struct ZhSurnameInfoCard: View {
    let s: NMSurname
    var onShuffle: (() -> Void)? = nil

    var body: some View {
        NamingCard(padding: 18) {
            HStack(alignment: .center, spacing: 10) {
                Text(s.c)
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(NamingTheme.ink)
                    .lineLimit(1)
                SpeechSpeakButton(text: s.c, language: "zh-CN")
                Spacer(minLength: 0)
                if let onShuffle {
                    ShuffleChip(text: L10n.t("换一个"), action: onShuffle)
                }
            }
            Text(surLine)
                .font(.system(size: 12))
                .foregroundStyle(NamingTheme.muted)
                .padding(.top, 6)
            Text(meaning)
                .font(.system(size: 13.5))
                .foregroundStyle(NamingTheme.ink.opacity(0.85))
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 10)
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

/// 英文姓：语源 / 中文姓释义；「换一个」与英文姓同一行。
struct EnSurnameInfoCard: View {
    let n: String
    var onShuffle: (() -> Void)? = nil

    @Environment(NamingAppModel.self) private var model

    var body: some View {
        let entry = model.enSurnameEntry(n)
        let kind = entry.isNative ? L10n.t("西文姓") : L10n.t("华人拼写")
        let meaning: String = {
            if entry.m.isEmpty { return L10n.t("暂无更多介绍") }
            if entry.isNative { return L10n.d("enSurnames", entry.n, entry.m) }
            let c = entry.zh.first.map(String.init) ?? entry.zh
            return L10n.d("surnames", c, entry.m)
        }()
        NamingCard(padding: 14) {
            HStack(alignment: .center, spacing: 10) {
                Text(n)
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(NamingTheme.ink)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                Text(kind)
                    .font(.system(size: 11.5))
                    .foregroundStyle(NamingTheme.primaryDeep)
                    .padding(.horizontal, 9)
                    .padding(.vertical, 4)
                    .background(NamingTheme.primary.opacity(0.12), in: Capsule())
                SpeechSpeakButton(text: n, language: "en-US")
                Spacer(minLength: 0)
                if let onShuffle {
                    ShuffleChip(text: L10n.t("换一个"), action: onShuffle)
                }
            }
            if !entry.zh.isEmpty {
                Text(entry.isNative
                       ? L10n.f("音译：%@", entry.zh)
                       : L10n.f("对应「%@」", entry.zh))
                    .font(.system(size: 12))
                    .foregroundStyle(NamingTheme.muted)
                    .padding(.top, 4)
            }
            Text(meaning)
                .font(.system(size: 13.5))
                .foregroundStyle(NamingTheme.ink.opacity(0.85))
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, entry.zh.isEmpty ? 4 : 8)
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
        /* width 未知时不能按「无限宽单行」估高，否则 place 按实宽换行后会画出父视图、盖住下面列表。 */
        let maxWidth = proposal.width ?? 0
        if maxWidth <= 0 {
            let sizes = subviews.map { $0.sizeThatFits(.unspecified) }
            let height = sizes.reduce(0) { $0 + $1.height }
                + lineSpacing * CGFloat(max(0, sizes.count - 1))
            return CGSize(width: sizes.map(\.width).max() ?? 0, height: height)
        }
        let rows = rows(maxWidth: maxWidth, subviews: subviews)
        let height = rows.reduce(0) { $0 + $1.height }
            + lineSpacing * CGFloat(max(0, rows.count - 1))
        return CGSize(width: maxWidth, height: height)
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
        .contentShape(Capsule())
        .onTapGesture(perform: action)
        .namingNoHoverHighlight()
    }
}

/// 收藏心形按钮 —— 已收藏实心，未收藏空心；不独占一行，和名字并排用。
struct FavoriteHeart: View {
    let saved: Bool
    var size: CGFloat = 20
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: saved ? "heart.fill" : "heart")
                .font(.system(size: size))
                .foregroundStyle(NamingTheme.primaryDeep)
                .frame(width: 40, height: 40)
                .contentShape(Rectangle())
        }
        .buttonStyle(NamingPressButtonStyle())
        .accessibilityLabel(saved ? L10n.t("已收藏") : L10n.t("收藏"))
        .sensoryFeedback(.impact(flexibility: .soft, intensity: 0.6), trigger: saved)
    }
}

