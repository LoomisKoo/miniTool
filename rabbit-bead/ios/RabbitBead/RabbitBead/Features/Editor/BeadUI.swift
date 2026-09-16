import SwiftUI
import UIKit

// MARK: - 颜色

/// 设计令牌，对齐 Apple 设计语言（getdesign · apple）。
///
/// 三条硬规则：
/// 1. **只有一个交互色**：`primary`（Action Blue）。所有可点的东西都是它，
///    不再有第二种彩色（红色只留给「删除」这类破坏性动作）。
/// 2. **层级靠「面」不靠「阴影」**：浅底 / 卡面 / 深色块之间直接切换，卡片不加投影。
/// 3. 全系统只有一处投影（`beadProductShadow`），只给「作品本身」（预览画布）用。
///
/// 每个色都是「浅色 / 深色」两态，跟随系统外观（`Color.adaptive`）。深色态照
/// Apple 的路子走：页面退成纯黑、卡面抬到 `#1C1C1E`，交互蓝换更亮的 `#0071E3`，
/// 文字从近黑翻成近白。
enum BeadTheme {
    // MARK: 交互色
    /// 主交互色 Action Blue。所有链接、药丸按钮、选中态、focus 环的根。
    static let primary = Color.adaptive(light: 0x0066CC, dark: 0x0071E3)
    /// 选中 / 聚焦的略亮蓝。
    static let primaryFocus = Color.adaptive(light: 0x0071E3, dark: 0x2997FF)
    /// 深色面上的链接蓝（Action Blue 在深色块上会糊掉）。
    static let primaryOnDark = Color(hex: 0x2997FF)
    /// 主色实底上的文字。
    static let onPrimary = Color.white

    // MARK: 文字
    /// 唯一的正文色（浅色近黑、深色近白）。
    static let ink = Color.adaptive(light: 0x1D1D1F, dark: 0xF5F5F7)
    /// 次级面上的正文。
    static let inkMuted80 = Color.adaptive(light: 0x333333, dark: 0xD2D2D7)
    /// 次要说明、失效文字、法务小字。
    static let inkMuted48 = Color.adaptive(light: 0x7A7A7A, dark: 0x8E8E93)
    /// 深色块上的次要文字。
    static let bodyMuted = Color.adaptive(light: 0xCCCCCC, dark: 0xA1A1A6)
    /// 深色块上的正文。
    static let onDark = Color.white

    // MARK: 面
    /// 卡面 / 列表底。
    static let canvas = Color.adaptive(light: 0xFFFFFF, dark: 0x1C1C1E)
    /// 页面底色（浅色羊皮纸 / 深色纯黑）。
    static let parchment = Color.adaptive(light: 0xF5F5F7, dark: 0x000000)
    /// 珍珠面：次级「幽灵」按钮的底，比页面底再抬一档。
    static let pearl = Color.adaptive(light: 0xFAFAFC, dark: 0x2C2C2E)
    /// Pro 卡底：浅色是**淡蓝**（在白底页面上拎出一块彩色面，而不是贴一块近黑），
    /// 深色退成抬升卡面。
    static let proTile = Color.adaptive(light: 0xEAF2FD, dark: 0x1C1C1E)
    /// Pro 卡描边：浅色给一圈淡蓝边，深色几乎看不见。
    static let proTileBorder = Color.adaptive(light: 0xD3E3F8, dark: 0x2C2C2E)
    /// 深色块 1（浅色模式下是近黑整幅；深色模式退成抬升卡面）。
    static let tile1 = Color.adaptive(light: 0x272729, dark: 0x1C1C1E)
    /// 深色块 2：相邻深块之间的微差。
    static let tile2 = Color.adaptive(light: 0x2A2A2C, dark: 0x232325)
    /// 深色块 3：栈底 / 播放器框。
    static let tile3 = Color.adaptive(light: 0x252527, dark: 0x171719)
    /// 浮在作品上的半透明控制片基色（配 `ink` 图标）。
    static let chipTranslucent = Color.adaptive(light: 0xD2D2D7, dark: 0x48484A)
    /// 浮层的实底（提示条）：两边都配白字，所以深色模式不能跟着 `ink` 变白。
    static let overlaySurface = Color.adaptive(light: 0x1D1D1F, dark: 0x3A3A3C)
    /// 3D 底板（豆插在上面的塑料板）。
    static let plate = Color.adaptive(light: 0x232329, dark: 0x3A3A3C)

    // MARK: 线
    /// 次级按钮的「环」，几乎看不见的柔和边。
    static let dividerSoft = Color.adaptive(light: 0xF0F0F0, dark: 0x2C2C2E)
    /// 卡片 / 胶囊的 1px 细边。
    static let hairline = Color.adaptive(light: 0xE0E0E0, dark: 0x38383A)
    /// 色块描边：浅色压暗、深色提亮，否则深色下小色块的边缘会糊掉。
    static let swatchStroke = Color.adaptive(
        light: 0x000000, dark: 0xFFFFFF,
        lightAlpha: 0.12, darkAlpha: 0.20
    )
    /// 更淡的色块描边（叠色点、缩略图这类更小的块）。
    static let swatchStrokeSoft = Color.adaptive(
        light: 0x000000, dark: 0xFFFFFF,
        lightAlpha: 0.08, darkAlpha: 0.16
    )

    // MARK: 语义别名
    /// 页面底色。
    static let background = parchment
    /// 卡片 / 弹层底色。
    static let surface = canvas
    /// 预览框底 + 空格豆。比页面底略抬一档，让「图纸区域」自成一块。
    static let viewport = Color.adaptive(light: 0xE5E5EA, dark: 0x1C1C1E)
    /// 主色别名。
    static let accent = primary
    /// 主色淡底（选中行的浅底）。深色模式要更实一点才看得出来。
    static var accentSoft: Color {
        Color.adaptive(light: 0x0066CC, dark: 0x0A84FF).opacity(0.14)
    }
    /// 次要文字。
    static let muted = inkMuted48
    /// 分割线。
    static let separator = hairline
    /// 中性胶囊底（未选中 chip、输入框）。
    static let fill = Color.adaptive(light: 0xF0F0F2, dark: 0x2C2C2E)
    /// 更浅的中性底（空状态、占位图）。
    static let subtleFill = Color.adaptive(light: 0xF5F5F7, dark: 0x1C1C1E)
    /// 破坏性动作（删除 / 清零）。
    static let danger = Color.adaptive(light: 0xD70015, dark: 0xFF453A)
    /// 图纸格线。深色下压到中灰，压在浅色豆和深色底上都还能看见。
    static let gridLine = Color.adaptive(light: 0xC7C7CC, dark: 0x8E8E93)
}

extension Color {
    /// `Color(hex: 0x0066CC)` 这类写法，省掉一堆 /255。
    init(hex: UInt32) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: 1
        )
    }

    /// 一套「浅色 / 深色」两态色，跟随系统外观。
    ///
    /// 用动态 `UIColor` 而不是自己读 `colorScheme`：这样 `Canvas` 内的填充、
    /// `.tint`、`List` 背景、导航栏毛玻璃都能各自在正确的 trait 下解析，
    /// 不需要把外观一路往下传。
    static func adaptive(
        light: UInt32,
        dark: UInt32,
        lightAlpha: CGFloat = 1,
        darkAlpha: CGFloat = 1
    ) -> Color {
        Color(uiColor: UIColor { traits in
            let isDark = traits.userInterfaceStyle == .dark
            return UIColor(hex: isDark ? dark : light)
                .withAlphaComponent(isDark ? darkAlpha : lightAlpha)
        })
    }
}

extension UIColor {
    /// 与 `Color(hex:)` 同口径。
    convenience init(hex: UInt32) {
        self.init(
            red: CGFloat((hex >> 16) & 0xFF) / 255,
            green: CGFloat((hex >> 8) & 0xFF) / 255,
            blue: CGFloat(hex & 0xFF) / 255,
            alpha: 1
        )
    }
}

// MARK: - 外观

/// 当前外观。
///
/// 颜色本身交给动态 `UIColor` 自己解析，但**淡化（高亮某个色号时其余豆退场）**
/// 是在 `RGB8` 上做的插值，算不出「系统当前是深色还是浅色」，只能显式传进来。
enum BeadAppearance: Sendable, Equatable {
    case light
    case dark

    init(_ scheme: ColorScheme) {
        self = scheme == .dark ? .dark : .light
    }

    /// 其余豆「退到背景里」的目标色：浅色向白，深色向预览框底色。
    var dimTarget: RGB8 {
        switch self {
        case .light: return RGB8(255, 255, 255)
        case .dark: return RGB8(0x1C, 0x1C, 0x1E)
        }
    }
}

extension RGB8 {
    /// SwiftUI 颜色（sRGB，不做线性化）。
    var swiftUIColor: Color {
        Color(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: 1
        )
    }
}

// MARK: - 尺度

/// 圆角阶梯：8 给紧凑工具、18 给卡片、药丸给一切「动作」。
enum BeadRadius {
    static let xs: CGFloat = 5
    static let sm: CGFloat = 8
    static let md: CGFloat = 11
    static let lg: CGFloat = 18
    static let pill: CGFloat = 9999
}

/// 间距阶梯，基准 8。
enum BeadSpace {
    static let xxs: CGFloat = 4
    static let xs: CGFloat = 8
    static let sm: CGFloat = 12
    static let md: CGFloat = 17
    static let lg: CGFloat = 24
    static let xl: CGFloat = 32
    static let xxl: CGFloat = 48
    static let section: CGFloat = 80
}

// MARK: - 字体

/// 字号 + 字距 + 行距，同一个 modifier 里给全。
///
/// Apple 的关键字距是**负的**：17pt 以上一律收紧（-0.12 → -0.374），
/// 这套「紧」才让标题有那股味道；正文固定在 17pt 而不是 16pt。
private struct BeadTextStyle: ViewModifier {
    let size: CGFloat
    let weight: Font.Weight
    let tracking: CGFloat
    let lineSpacing: CGFloat

    func body(content: Content) -> some View {
        content
            .font(.system(size: size, weight: weight))
            .tracking(tracking)
            .lineSpacing(lineSpacing)
    }
}

extension View {
    /// 页头大标题（56pt 在手机端降到 34pt）。
    func beadHero() -> some View {
        modifier(BeadTextStyle(size: 34, weight: .semibold, tracking: -0.4, lineSpacing: 2))
    }

    /// 区块大标题 28/600。
    func beadDisplayLg() -> some View {
        modifier(BeadTextStyle(size: 28, weight: .semibold, tracking: -0.28, lineSpacing: 2))
    }

    /// 区块标题 22/600。
    func beadDisplayMd() -> some View {
        modifier(BeadTextStyle(size: 22, weight: .semibold, tracking: -0.26, lineSpacing: 1))
    }

    /// 副标题 / 分类名 21/600，唯一带正字距的一档。
    func beadTagline() -> some View {
        modifier(BeadTextStyle(size: 21, weight: .semibold, tracking: 0.23, lineSpacing: 1))
    }

    /// 一句话说明 17/400。
    func beadLead() -> some View {
        modifier(BeadTextStyle(size: 17, weight: .regular, tracking: 0.2, lineSpacing: 3))
    }

    /// 正文 17/400（不用 16pt）。
    func beadBody() -> some View {
        modifier(BeadTextStyle(size: 17, weight: .regular, tracking: -0.374, lineSpacing: 4))
    }

    /// 强调正文 17/600（字重阶梯是 300/400/600/700，没有 500）。
    func beadBodyStrong() -> some View {
        modifier(BeadTextStyle(size: 17, weight: .semibold, tracking: -0.374, lineSpacing: 2))
    }

    /// 行内标题 15/600。列表主文案用这一档。
    func beadRowTitle() -> some View {
        modifier(BeadTextStyle(size: 15, weight: .semibold, tracking: -0.24, lineSpacing: 1))
    }

    /// 说明文字 14/400。
    func beadCaption() -> some View {
        modifier(BeadTextStyle(size: 14, weight: .regular, tracking: -0.224, lineSpacing: 3))
    }

    /// 强调说明 14/600。分组标题用这一档。
    func beadCaptionStrong() -> some View {
        modifier(BeadTextStyle(size: 14, weight: .semibold, tracking: -0.224, lineSpacing: 1))
    }

    /// 小字 12/400。
    func beadFinePrint() -> some View {
        modifier(BeadTextStyle(size: 12, weight: .regular, tracking: -0.12, lineSpacing: 2))
    }

    /// 微法务 10/400。
    func beadMicroLegal() -> some View {
        modifier(BeadTextStyle(size: 10, weight: .regular, tracking: -0.08, lineSpacing: 1))
    }

    /// 等宽数字（颗数、尺寸、价格）。
    func beadDigits(_ size: CGFloat = 15, weight: Font.Weight = .semibold) -> some View {
        font(.system(size: size, weight: weight)).monospacedDigit()
    }

    /// 全系统唯一投影：只给「作品本身」（预览画布里的图纸）压在台面上用。
    /// 卡片、按钮、文字都不加。
    func beadProductShadow() -> some View {
        shadow(color: .black.opacity(0.22), radius: 15, x: 3, y: 5)
    }
}

// MARK: - 按压反馈

/// 全系统统一的按压微交互：`scale(0.95)`。
struct BeadPressStyle: ButtonStyle {
    var pressedScale: CGFloat = 0.95

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? pressedScale : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

// MARK: - 按钮

/// 按钮语法只有四种，别再造第五种。
enum BeadButtonKind {
    /// 蓝实底药丸：一件事的主入口（导出、解锁、保存）。
    case primary
    /// 蓝描边药丸：与主按钮并排的第二个动作。
    case ghost
    /// 深色小方块：导航级工具动作（返回、完成）。
    case utility
    /// 浅灰胶囊：列表内次级动作、内联小按钮。
    case pearl
}

struct BeadButton: View {
    let title: String
    var kind: BeadButtonKind = .primary
    var systemImage: String?
    var fullWidth = false
    var enabled = true
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                if let systemImage {
                    Image(systemName: systemImage)
                        .font(.system(size: kind == .utility ? 12 : 15, weight: .semibold))
                }
                Text(title)
                    .lineLimit(1)
            }
            .modifier(BeadButtonLabelStyle(kind: kind, fullWidth: fullWidth))
        }
        .buttonStyle(BeadPressStyle())
        .disabled(!enabled)
        .opacity(enabled ? 1 : 0.36)
    }
}

private struct BeadButtonLabelStyle: ViewModifier {
    let kind: BeadButtonKind
    let fullWidth: Bool

    func body(content: Content) -> some View {
        switch kind {
        case .primary:
            content
                .beadBody()
                .foregroundStyle(BeadTheme.onPrimary)
                .padding(.horizontal, 22)
                .frame(height: 44)
                .frame(maxWidth: fullWidth ? .infinity : nil)
                .background(BeadTheme.primary, in: Capsule())
        case .ghost:
            content
                .beadBody()
                .foregroundStyle(BeadTheme.primary)
                .padding(.horizontal, 22)
                .frame(height: 44)
                .frame(maxWidth: fullWidth ? .infinity : nil)
                .overlay { Capsule().strokeBorder(BeadTheme.primary, lineWidth: 1) }
        case .utility:
            content
                .beadCaption()
                .foregroundStyle(BeadTheme.onDark)
                .padding(.horizontal, 15)
                .frame(height: 32)
                .background(
                    BeadTheme.overlaySurface,
                    in: RoundedRectangle(cornerRadius: BeadRadius.sm)
                )
        case .pearl:
            content
                .beadCaption()
                .foregroundStyle(BeadTheme.inkMuted80)
                .padding(.horizontal, 14)
                .frame(height: 34)
                .frame(maxWidth: fullWidth ? .infinity : nil)
                .background(BeadTheme.pearl, in: RoundedRectangle(cornerRadius: BeadRadius.md))
                .overlay {
                    RoundedRectangle(cornerRadius: BeadRadius.md)
                        .strokeBorder(BeadTheme.hairline, lineWidth: 1)
                }
        }
    }
}

/// 浮在作品上的圆形控制片（复位 / 3D / 编辑）。
struct BeadIconButton: View {
    let systemName: String
    var isOn = false
    var enabled = true
    var size: CGFloat = 40
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.system(size: size * 0.4, weight: .semibold))
                .foregroundStyle(isOn ? BeadTheme.onPrimary : BeadTheme.ink)
                .frame(width: size, height: size)
                .background(
                    isOn ? BeadTheme.primary : BeadTheme.chipTranslucent.opacity(0.64),
                    in: Circle()
                )
        }
        .buttonStyle(BeadPressStyle())
        .disabled(!enabled)
        .opacity(enabled ? 1 : 0.4)
    }
}

// MARK: - 卡片 & 分组

/// 白色工具卡：1px 细边 + 18pt 圆角，**没有投影**。
struct BeadCard<Content: View>: View {
    var padding: CGFloat = BeadSpace.lg
    var background: Color = BeadTheme.canvas
    @ViewBuilder var content: () -> Content

    var body: some View {
        VStack(spacing: 0) { content() }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(padding)
            .background(
                background,
                in: RoundedRectangle(cornerRadius: BeadRadius.lg, style: .continuous)
            )
            .overlay {
                RoundedRectangle(cornerRadius: BeadRadius.lg, style: .continuous)
                    .strokeBorder(BeadTheme.hairline, lineWidth: 1)
            }
    }
}

/// 分组卡片（行自带内边距，所以这里不加 padding）。
struct BeadGroup<Content: View>: View {
    @ViewBuilder var content: () -> Content

    var body: some View {
        VStack(spacing: 0) {
            content()
        }
        .background(
            BeadTheme.canvas,
            in: RoundedRectangle(cornerRadius: BeadRadius.lg, style: .continuous)
        )
        .overlay {
            RoundedRectangle(cornerRadius: BeadRadius.lg, style: .continuous)
                .strokeBorder(BeadTheme.hairline, lineWidth: 1)
        }
    }
}

/// Pro 入口卡（付费墙头部 /「我的」会员入口）。
///
/// 浅色模式**不再是一整块近黑**：白底页面上压一块黑卡太重，把「一次买断」说得
/// 像警告；改成淡蓝卡 + 淡蓝细边，靠「彩色面」而不是明度反转来拎出会员。
/// 深色模式退成抬升卡面（黑底上再压黑块会糊成一片）。
struct BeadProTile<Content: View>: View {
    var padding: CGFloat = BeadSpace.lg
    @ViewBuilder var content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: 0) { content() }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(padding)
            .background(
                BeadTheme.proTile,
                in: RoundedRectangle(cornerRadius: BeadRadius.lg, style: .continuous)
            )
            .overlay {
                RoundedRectangle(cornerRadius: BeadRadius.lg, style: .continuous)
                    .strokeBorder(BeadTheme.proTileBorder, lineWidth: 1)
            }
    }
}

/// 分组的行间分割线（右侧留出内容缩进）。
struct BeadRowDivider: View {
    var inset: CGFloat = 16

    var body: some View {
        Rectangle()
            .fill(BeadTheme.hairline)
            .frame(height: 0.5)
            .padding(.leading, inset)
    }
}

/// 分组小标题：14/600 + 灰，Apple 的 footer 语法。
struct BeadSectionLabel: View {
    let text: String

    var body: some View {
        Text(text)
            .beadCaptionStrong()
            .foregroundStyle(BeadTheme.inkMuted48)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - 胶囊 chip

/// 选项胶囊，对齐 Apple 的 configurator chip。
///
/// - `hugContent = false`（默认）：等分占满可用宽度，用于 chips 行。
/// - `hugContent = true`：按内容自适应宽度，用于「40×40」「分板线」这类独立按钮。
/// - `prominentWhenSelected = false`：选中态改成「珍珠底 + 蓝描边」，用于信息型 chip。
/// - `locked = true`：没买断 Pro 时给功能 chip 挂一把小锁（点了会弹付费墙）。
struct BeadChip: View {
    let title: String
    var selected = false
    var prominentWhenSelected = true
    var compact = false
    var hugContent = false
    /// 功能需要 Pro 且当前未买断。
    var locked = false
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 4) {
                if locked {
                    Image(systemName: "lock.fill")
                        .font(.system(size: compact ? 8 : 9, weight: .bold))
                        .opacity(0.8)
                }
                Text(title)
                    .font(.system(size: compact ? 12 : 14, weight: selected ? .semibold : .regular))
                    .tracking(-0.224)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            .foregroundStyle(foreground)
            .padding(.horizontal, compact ? 10 : 16)
            .frame(height: compact ? 28 : 34)
            .frame(maxWidth: hugContent ? nil : .infinity)
            .background(background, in: Capsule())
            .overlay {
                Capsule().strokeBorder(border, lineWidth: highlighted ? 1.5 : 1)
            }
        }
        .buttonStyle(BeadPressStyle(pressedScale: 0.96))
    }

    private var highlighted: Bool {
        selected && !prominentWhenSelected
    }

    private var background: Color {
        if selected {
            return prominentWhenSelected ? BeadTheme.primary : BeadTheme.pearl
        }
        return BeadTheme.pearl
    }

    private var foreground: Color {
        if selected {
            return prominentWhenSelected ? BeadTheme.onPrimary : BeadTheme.primary
        }
        return BeadTheme.inkMuted80
    }

    private var border: Color {
        if highlighted { return BeadTheme.primaryFocus }
        return BeadTheme.hairline
    }
}

// MARK: - 行

/// 一行参数：标签 + 滑杆 + 数值。
struct BeadSliderRow: View {
    let label: String
    @Binding var value: Int
    let range: ClosedRange<Int>

    var body: some View {
        HStack(spacing: BeadSpace.sm) {
            Text(label)
                .beadCaption()
                .foregroundStyle(BeadTheme.inkMuted80)
                .frame(width: 36, alignment: .leading)
            Slider(
                value: Binding(
                    get: { Double(value) },
                    set: { value = Int($0.rounded()) }
                ),
                in: Double(range.lowerBound)...Double(range.upperBound),
                step: 1
            )
            .tint(BeadTheme.primary)
            Text("\(value)")
                .beadDigits(14, weight: .regular)
                .foregroundStyle(BeadTheme.inkMuted48)
                .frame(width: 30, alignment: .trailing)
        }
        .frame(minHeight: 44)
        .padding(.horizontal, 16)
    }
}

/// 标签在左、控件在右的工具行。
struct BeadToolRow<Content: View>: View {
    let label: String
    @ViewBuilder var content: () -> Content

    var body: some View {
        HStack(spacing: BeadSpace.xs) {
            Text(label)
                .beadCaption()
                .foregroundStyle(BeadTheme.inkMuted80)
                .frame(width: 36, alignment: .leading)
            Spacer(minLength: 0)
            content()
        }
        .frame(minHeight: 44)
        .padding(.horizontal, 16)
    }
}

/// 色块预览小方片（豆色、画笔色）。
struct BeadSwatch: View {
    let color: Color
    var size: CGFloat = 16
    var radius: CGFloat = 4

    var body: some View {
        RoundedRectangle(cornerRadius: radius, style: .continuous)
            .fill(color)
            .frame(width: size, height: size)
            .overlay {
                RoundedRectangle(cornerRadius: radius, style: .continuous)
                    .strokeBorder(BeadTheme.swatchStroke, lineWidth: 1)
            }
    }
}

// MARK: - 画布样式

/// 画布真正用到的那部分设置。
///
/// `BeadSettings` 里大部分字段（豆宽、限色、阈值、抖动…）只影响量化，
/// 量化结果没变之前画面不该重画。画布只吃这个结构 + `.equatable()`：
/// 拖滑块时画布直接跳过，只重算参数行，省掉每帧一次全画布重绘。
struct BeadCanvasStyle: Equatable {
    var showGrid: Bool
    var showSeam: Bool
    var showCodes: Bool

    init(_ settings: BeadSettings) {
        showGrid = settings.showGrid
        showSeam = settings.showSeam
        showCodes = settings.showCodes
    }
}
