import SwiftUI
import UIKit

/// iOS 26+ 的系统液态玻璃按钮效果；旧系统保持现有自绘样式。
struct BeadGlassButtonModifier: ViewModifier {
    let cornerRadius: CGFloat

    @ViewBuilder
    func body(content: Content) -> some View {
        if #available(iOS 26.0, *) {
            content.glassEffect(.regular, in: .rect(cornerRadius: cornerRadius))
        } else {
            content
        }
    }
}

extension View {
    func beadGlassButton(cornerRadius: CGFloat = BeadRadius.sm) -> some View {
        modifier(BeadGlassButtonModifier(cornerRadius: cornerRadius))
    }
}

// MARK: - 颜色

/// 设计令牌：对齐 H5 `style.css`（清爽蓝 + soft UI）。
///
/// 硬规则：
/// 1. **品牌主色柔亮蓝** `primary`：主 CTA、强选中、链接。红只留给破坏性 / 渠道色。
/// 2. **选中优先「淡蓝底 + 蓝边」**；实心蓝留给主推进 / 强选中 chip。
/// 3. **面有厚度**：淡蓝氛围底 → 白卡（轻阴影）→ 内容。
///
/// 每个色都是「浅色 / 深色」两态（`Color.adaptive`）。
enum BeadTheme {
    // MARK: 交互色（= H5 --primary / --primary-deep / --primary-focus）
    static let primary = Color.adaptive(light: 0x4B8EF0, dark: 0x6BA4F7)
    static let primaryDeep = Color.adaptive(light: 0x3478E0, dark: 0x4B8EF0)
    static let primaryFocus = Color.adaptive(light: 0x2F6FD6, dark: 0x7EB0E0)
    static let primaryOnDark = Color(hex: 0x7EB0E0)
    static let onPrimary = Color.white

    /// 主 CTA 渐变（对齐 H5 --primary-grad）。
    static var primaryGradient: LinearGradient {
        LinearGradient(
            colors: [Color(hex: 0x6AA4F7), Color(hex: 0x3D7EF0), Color(hex: 0x3478E0)],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    // MARK: 文字
    static let ink = Color.adaptive(light: 0x1F2937, dark: 0xF5F5F7)
    static let inkMuted80 = Color.adaptive(light: 0x4B5563, dark: 0xD2D2D7)
    static let inkMuted48 = Color.adaptive(light: 0x8B95A5, dark: 0x8E8E93)
    static let bodyMuted = Color.adaptive(light: 0xC8C4BE, dark: 0xA1A1A6)
    static let onDark = Color.white

    // MARK: 面
    static let canvas = Color.adaptive(light: 0xFFFFFF, dark: 0x1C1C1E)
    /// 页面底（= H5 --parchment）。
    static let parchment = Color.adaptive(light: 0xE8EEF8, dark: 0x000000)
    /// 页面氛围渐变（对齐 H5 --parchment-grad）。
    ///
    /// 两态都要给：浅色是柔蓝往白走，深色是比 `parchment`（纯黑）略抬一点的黑，
    /// 让页面底和卡片（`canvas` = 0x1C1C1E）之间还留一层可辨的「氛围」，
    /// 而不是整屏一块死黑。
    ///
    /// 早先这里只有三个裸的浅色，深色下不跟随系统 —— 页面底会一直是浅蓝。
    static var parchmentGradient: LinearGradient {
        LinearGradient(
            colors: [
                Color.adaptive(light: 0xD9E7FC, dark: 0x15171C),
                Color.adaptive(light: 0xE8EEF8, dark: 0x000000),
                Color.adaptive(light: 0xF2F5FA, dark: 0x0C0D10)
            ],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }
    static let pearl = Color.adaptive(light: 0xF3F6FB, dark: 0x2C2C2E)
    /// Pro 入口面：比 parchment 更饱和的柔蓝，不当灰卡、也不靠描边抢眼。
    static let proTile = Color.adaptive(light: 0xD6E8FF, dark: 0x1A2740)
    static var proTileGradient: LinearGradient {
        LinearGradient(
            colors: [
                Color.adaptive(light: 0xE8F3FF, dark: 0x243552),
                Color.adaptive(light: 0xD0E4FF, dark: 0x152338)
            ],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }
    static let tile1 = Color.adaptive(light: 0x272729, dark: 0x1C1C1E)
    static let tile2 = Color.adaptive(light: 0x2A2A2C, dark: 0x232325)
    static let tile3 = Color.adaptive(light: 0x252527, dark: 0x171719)
    static let chipTranslucent = Color.adaptive(light: 0xD8E0EC, dark: 0x48484A)
    static let overlaySurface = Color.adaptive(light: 0x1F2937, dark: 0x3A3A3C)
    static let plate = Color.adaptive(light: 0x232329, dark: 0x3A3A3C)

    // MARK: 线
    static let dividerSoft = Color.adaptive(light: 0xE8EEF7, dark: 0x2C2C2E)
    static let hairline = Color.adaptive(light: 0xDCE3EE, dark: 0x38383A)
    static let swatchStroke = Color.adaptive(
        light: 0x1F2937, dark: 0xFFFFFF,
        lightAlpha: 0.12, darkAlpha: 0.20
    )
    static let swatchStrokeSoft = Color.adaptive(
        light: 0x1F2937, dark: 0xFFFFFF,
        lightAlpha: 0.08, darkAlpha: 0.16
    )

    // MARK: 语义别名
    static let background = parchment
    static let surface = canvas
    /// 预览框底（= H5 --viewport）。
    static let viewport = Color.adaptive(light: 0xE4EAF3, dark: 0x1C1C1E)
    /// 裁切视口底（= H5 #E5EAF2）。
    static let cropSurface = Color.adaptive(light: 0xE5EAF2, dark: 0x1C1C1E)
    static let accent = primary
    static var accentSoft: Color {
        Color.adaptive(light: 0x4B8EF0, dark: 0x6BA4F7).opacity(0.12)
    }
    static let muted = inkMuted48
    static let separator = hairline
    static let fill = Color.adaptive(light: 0xE8EEF7, dark: 0x2C2C2E)
    static let subtleFill = Color.adaptive(light: 0xEEF2F8, dark: 0x1C1C1E)
    static let danger = Color.adaptive(light: 0xE5484D, dark: 0xFF6B6B)
    static let gridLine = Color.adaptive(light: 0xC9C4BC, dark: 0x8E8E93)
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

/// 圆角阶梯：对齐 H5 —— 控件 10、内容块 14、卡片 20。
enum BeadRadius {
    static let xs: CGFloat = 8
    static let sm: CGFloat = 10
    static let md: CGFloat = 14
    static let lg: CGFloat = 20
    static let xl: CGFloat = 24
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

    /// 作品预览投影。
    func beadProductShadow() -> some View {
        shadow(color: .black.opacity(0.12), radius: 14, x: 0, y: 6)
            .shadow(color: Color(hex: 0x2F5A96).opacity(0.08), radius: 10, x: 0, y: 4)
    }

    /// 卡片轻阴影（对齐 H5 --shadow-card）。
    func beadCardShadow() -> some View {
        shadow(color: Color(hex: 0x2F5A96).opacity(0.06), radius: 2, x: 0, y: 2)
            .shadow(color: Color(hex: 0x2F5A96).opacity(0.14), radius: 14, x: 0, y: 8)
    }

    /// 主按钮色影。
    func beadPrimaryShadow() -> some View {
        shadow(color: Color(hex: 0x3478E0).opacity(0.32), radius: 8, x: 0, y: 4)
    }
}

// MARK: - 按钮

/// 按钮语法只有四种。
/// 工具 / 辅助用圆角矩形；主 CTA 才用胶囊。
enum BeadButtonKind {
    /// 渐变蓝胶囊：本屏主推进。
    case primary
    /// 淡蓝底 + 蓝字圆角矩形：次要确认。
    case ghost
    /// 深色小方块：导航级工具。
    case utility
    /// 浅底圆角矩形：取消 / 重置 / 辅助。
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
                        .font(.system(size: kind == .utility ? 12 : 13, weight: .semibold))
                }
                Text(title)
                    .lineLimit(1)
            }
            .modifier(BeadButtonLabelStyle(kind: kind, fullWidth: fullWidth))
        }
        .buttonStyle(.automatic)
        .beadGlassButton(cornerRadius: fullWidth ? BeadRadius.md : BeadRadius.sm)
        .disabled(!enabled)
        .opacity(enabled ? 1 : 0.36)
    }
}

private struct BeadButtonLabelStyle: ViewModifier {
    let kind: BeadButtonKind
    let fullWidth: Bool

    /// 全宽 CTA（付费墙等）要更敦实；工具条小钮保持 28。
    private var height: CGFloat { fullWidth ? 48 : 28 }
    private var fontSize: CGFloat { fullWidth ? 16 : 12 }
    private var corner: CGFloat { fullWidth ? BeadRadius.md : BeadRadius.sm }

    func body(content: Content) -> some View {
        switch kind {
        case .primary:
            content
                .font(.system(size: fontSize, weight: .semibold))
                .foregroundStyle(BeadTheme.onPrimary)
                .padding(.horizontal, fullWidth ? 18 : 12)
                .frame(height: height)
                .frame(maxWidth: fullWidth ? .infinity : nil)
                .background(
                    BeadTheme.primaryGradient,
                    in: RoundedRectangle(cornerRadius: fullWidth ? BeadRadius.md : BeadRadius.pill, style: .continuous)
                )
                .beadPrimaryShadow()
        case .ghost:
            content
                .font(.system(size: fontSize, weight: fullWidth ? .medium : .regular))
                .foregroundStyle(BeadTheme.primaryDeep)
                .padding(.horizontal, fullWidth ? 18 : 12)
                .frame(height: height)
                .frame(maxWidth: fullWidth ? .infinity : nil)
                .background(
                    BeadTheme.accentSoft,
                    in: RoundedRectangle(cornerRadius: corner, style: .continuous)
                )
                .overlay {
                    RoundedRectangle(cornerRadius: corner, style: .continuous)
                        .strokeBorder(BeadTheme.primary.opacity(0.35), lineWidth: 1)
                }
        case .utility:
            content
                .beadFinePrint()
                .foregroundStyle(BeadTheme.onDark)
                .padding(.horizontal, 12)
                .frame(height: 28)
                .background(
                    BeadTheme.overlaySurface,
                    in: RoundedRectangle(cornerRadius: BeadRadius.sm, style: .continuous)
                )
        case .pearl:
            content
                .font(.system(size: fontSize, weight: .regular))
                .foregroundStyle(BeadTheme.inkMuted80)
                .padding(.horizontal, fullWidth ? 18 : 10)
                .frame(height: height)
                .frame(maxWidth: fullWidth ? .infinity : nil)
                .background(
                    BeadTheme.pearl,
                    in: RoundedRectangle(cornerRadius: corner, style: .continuous)
                )
                .overlay {
                    RoundedRectangle(cornerRadius: corner, style: .continuous)
                        .strokeBorder(BeadTheme.hairline, lineWidth: 1)
                }
        }
    }
}

/// 浮在作品上的圆形控制片**外观**（不含按钮行为）。
///
/// 单独拆出来是为了能当 `NavigationLink` 的 label：`BeadIconButton` 是 `Button`，
/// 而「编辑」要的是 push 语义（见 `BeadEditorView`）。
struct BeadIconChip: View {
    let systemName: String
    var isOn = false
    var size: CGFloat = 40

    var body: some View {
        Image(systemName: systemName)
            .font(.system(size: size * 0.4, weight: .semibold))
            .foregroundStyle(isOn ? BeadTheme.onPrimary : BeadTheme.ink)
            .frame(width: size, height: size)
            .background {
                if isOn {
                    Circle().fill(BeadTheme.primaryGradient)
                } else {
                    Circle().fill(BeadTheme.chipTranslucent.opacity(0.64))
                }
            }
    }
}

/// 浮在作品上的圆形控制片（复位 / 3D）。
struct BeadIconButton: View {
    let systemName: String
    var isOn = false
    var enabled = true
    var size: CGFloat = 40
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            BeadIconChip(systemName: systemName, isOn: isOn, size: size)
        }
        .buttonStyle(.automatic)
        .beadGlassButton(cornerRadius: BeadRadius.sm)
        .disabled(!enabled)
        .opacity(enabled ? 1 : 0.4)
    }
}

// MARK: - 卡片 & 分组

/// 白色工具卡：大圆角 + 轻阴影（soft UI）。
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
            .beadCardShadow()
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
        .beadCardShadow()
    }
}

/// Pro 入口卡（付费墙头部 /「我的」会员入口）。
///
/// 柔蓝渐变面，无描边：靠色差从页面底里浮出来。
struct BeadProTile<Content: View>: View {
    var padding: CGFloat = BeadSpace.lg
    @ViewBuilder var content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: 0) { content() }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(padding)
            .background(
                BeadTheme.proTileGradient,
                in: RoundedRectangle(cornerRadius: BeadRadius.lg, style: .continuous)
            )
            .beadCardShadow()
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

/// 选项芯片：圆角矩形（不是胶囊）。
struct BeadChip: View {
    let title: String
    var selected = false
    var prominentWhenSelected = true
    var compact = false
    var hugContent = false
    /// 功能需要 Pro 且当前未买断。
    var locked = false
    var action: () -> Void

    private var shape: RoundedRectangle {
        RoundedRectangle(cornerRadius: BeadRadius.sm, style: .continuous)
    }

    private var softSelected: Bool { selected && !prominentWhenSelected }
    private var prominentSelected: Bool { selected && prominentWhenSelected }

    var body: some View {
        Button(action: action) {
            HStack(spacing: 4) {
                if locked {
                    Image(systemName: "lock.fill")
                        .font(.system(size: compact ? 8 : 9, weight: .bold))
                        .opacity(0.8)
                }
                Text(title)
                    .font(.system(size: compact ? 11 : 12, weight: .regular))
                    .tracking(-0.12)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            .foregroundStyle(foreground)
            .padding(.horizontal, compact ? 8 : 10)
            .frame(height: compact ? 26 : 28)
            .frame(maxWidth: hugContent ? nil : .infinity)
            .background { chipBackground }
            .clipShape(shape)
            .overlay {
                // 始终保持1pt边框宽度，避免选中时布局跳动
                shape.strokeBorder(border, lineWidth: 1)
            }
        }
        .buttonStyle(.automatic)
    }

    @ViewBuilder
    private var chipBackground: some View {
        if prominentSelected {
            shape.fill(BeadTheme.primaryGradient)
        } else if softSelected {
            shape.fill(BeadTheme.accentSoft)
        } else {
            shape.fill(BeadTheme.pearl)
        }
    }

    private var foreground: Color {
        if selected {
            return prominentWhenSelected ? BeadTheme.onPrimary : BeadTheme.primaryDeep
        }
        return BeadTheme.inkMuted80
    }

    private var border: Color {
        if softSelected { return BeadTheme.primary }
        if prominentSelected { return .clear }
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
                .frame(width: 48, alignment: .leading)
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
                .frame(width: 48, alignment: .leading)
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

    init(showGrid: Bool, showSeam: Bool, showCodes: Bool) {
        self.showGrid = showGrid
        self.showSeam = showSeam
        self.showCodes = showCodes
    }

    init(_ settings: BeadSettings) {
        self.init(
            showGrid: settings.showGrid,
            showSeam: settings.showSeam,
            showCodes: settings.showCodes
        )
    }

    /// 放大镜用：格线恒开（放大的意义就是看清落在哪一格），
    /// 色号跟着格宽走（见 `Bead2DRenderer` 的 `codeShowCell`）。分板线不画。
    static let loupe = BeadCanvasStyle(showGrid: true, showSeam: false, showCodes: true)
}

// MARK: - 提示浮层

/// 浮在作品上的提示胶囊（近黑底 + 白字，对齐 Apple 浮层控制片的明度关系）。
struct BeadHintBanner: View {
    let hint: String?

    var body: some View {
        if let hint {
            Text(hint)
                .font(.system(size: 14, weight: .semibold))
                .tracking(-0.224)
                .foregroundStyle(BeadTheme.onDark)
                .padding(.horizontal, 18)
                .padding(.vertical, 11)
                .background(BeadTheme.overlaySurface, in: Capsule())
                .padding(.bottom, BeadSpace.sm)
                .transition(.opacity.combined(with: .move(edge: .bottom)))
                .animation(.easeInOut(duration: 0.2), value: hint)
        }
    }
}
