import SwiftUI
import UIKit

/* 动效 token —— 对齐 Emil / Apple 的几条硬规则：
 * 1. 进入与按压用 ease-out（立刻动，不拖起步）；布局挪动可用 critically-damped spring。
 * 2. UI 动效压在 ~300ms 内；按压反馈 100–160ms。
 * 3. 尊重「减少动态效果」：直接瞬切，不演。
 *
 * 选姓 / 选名：点一行 → 筛条下长出信息卡 → 列表下挪，必须同一事务，
 * 所以选中一律走 `withAnimation(NamingMotion.pick)`。 */
enum NamingMotion {
    /// 选中 / 筛选项切换 / 信息卡展开 —— 可打断的 critically-damped spring。
    static var pick: Animation {
        reduced ? .easeOut(duration: 0.01)
            : .spring(response: 0.28, dampingFraction: 1.0)
    }

    /// 按压缩放反馈（按钮、回到顶部）。
    static var press: Animation {
        reduced ? .easeOut(duration: 0.01)
            : .easeOut(duration: 0.12)
    }

    /// Toast、回到顶部钮等「出现/消失」。
    static var appear: Animation {
        reduced ? .easeOut(duration: 0.01)
            : .easeOut(duration: 0.2)
    }

    /// 轻量透明度切换（浮层淡入淡出）。
    static var fade: Animation {
        reduced ? .easeOut(duration: 0.01)
            : .easeOut(duration: 0.16)
    }

    private static var reduced: Bool {
        UIAccessibility.isReduceMotionEnabled
    }
}

/* 按下立刻缩小到 0.97 —— 等抬起再变色会「死」。
 * 不跟 `.plain` 抢语义：需要无背景反馈的交互控件统一挂这个。 */
struct NamingPressButtonStyle: ButtonStyle {
    var scale: CGFloat = 0.97

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? scale : 1)
            .animation(NamingMotion.press, value: configuration.isPressed)
    }
}

enum NamingTheme {
    // 仙鹿品牌色：鹿棕主色、森林绿、鹿角金、奶油底。
    // 深色模式使用深林棕，不使用纯黑，避免品牌色被黑底切断。
    static let primary = Color.adaptive(light: 0xC9785C, dark: 0xE2A17F)
    static let primaryDeep = Color.adaptive(light: 0xA95B43, dark: 0xF0B18E)
    static let ink = Color.adaptive(light: 0x4C392F, dark: 0xFFF2DF)
    static let muted = Color.adaptive(light: 0x92766A, dark: 0xCDB09C)
    static let canvas = Color.adaptive(light: 0xFFFCF5, dark: 0x2B211C)
    static let background = Color.adaptive(light: 0xFFF6E9, dark: 0x201915)
    static let pearl = Color.adaptive(light: 0xF8EBDD, dark: 0x392B23)
    static let hairline = Color.adaptive(light: 0xEBD8C6, dark: 0x574238)
    static let mint = Color.adaptive(light: 0x5E9B7F, dark: 0x8BC9A7)
    static let lemon = Color.adaptive(light: 0xD6A85F, dark: 0xE7C47C)

    static var gradient: LinearGradient {
        LinearGradient(
            colors: [
                Color.adaptive(light: 0xE6A07F, dark: 0xE9AD89),
                Color.adaptive(light: 0xC9785C, dark: 0xC9785C),
                Color.adaptive(light: 0xD6A85F, dark: 0xD6A85F)
            ],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }
}

extension Color {
    init(hex: UInt32) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: 1
        )
    }

    static func adaptive(light: UInt32, dark: UInt32) -> Color {
        Color(uiColor: UIColor { traits in
            UIColor(hex: traits.userInterfaceStyle == .dark ? dark : light)
        })
    }
}

extension UIColor {
    convenience init(hex: UInt32) {
        self.init(
            red: CGFloat((hex >> 16) & 0xFF) / 255,
            green: CGFloat((hex >> 8) & 0xFF) / 255,
            blue: CGFloat(hex & 0xFF) / 255,
            alpha: 1
        )
    }
}

enum NamingRadius {
    static let small: CGFloat = 10
    static let medium: CGFloat = 14
    static let large: CGFloat = 20
}

struct NamingCard<Content: View>: View {
    var padding: CGFloat = 24
    @ViewBuilder var content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: 0, content: content)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(padding)
            .background(NamingTheme.canvas, in: RoundedRectangle(cornerRadius: NamingRadius.large, style: .continuous))
            /* 展开动画时内容不能画出圆角，否则会盖住卡头和下一张卡。 */
            .clipShape(RoundedRectangle(cornerRadius: NamingRadius.large, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: NamingRadius.large, style: .continuous)
                    .strokeBorder(NamingTheme.hairline.opacity(0.9), lineWidth: 1)
            }
            .shadow(color: .black.opacity(0.08), radius: 3, x: 0, y: 2)
    }
}

struct NamingPrimaryButton: View {
    let title: LocalizedStringKey
    let systemImage: String?
    let action: () -> Void

    init(_ title: LocalizedStringKey, systemImage: String? = nil, action: @escaping () -> Void) {
        self.title = title
        self.systemImage = systemImage
        self.action = action
    }

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if let systemImage {
                    Image(systemName: systemImage)
                }
                Text(title)
            }
            .font(.system(size: 17, weight: .semibold))
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .frame(height: 50)
            .background(NamingTheme.gradient, in: RoundedRectangle(cornerRadius: NamingRadius.medium, style: .continuous))
            .shadow(color: NamingTheme.primaryDeep.opacity(0.28), radius: 8, x: 0, y: 4)
        }
        .buttonStyle(NamingPressButtonStyle())
    }
}

struct NamingOptionCard: View {
    let title: LocalizedStringKey
    let subtitle: LocalizedStringKey
    let systemImage: String
    let selected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 14) {
                Image(systemName: systemImage)
                    .font(.system(size: 21, weight: .semibold))
                    .foregroundStyle(selected ? .white : NamingTheme.primaryDeep)
                    .frame(width: 44, height: 44)
                    .background {
                        if selected {
                            NamingTheme.gradient
                        } else {
                            NamingTheme.primary.opacity(0.12)
                        }
                    }
                    .clipShape(RoundedRectangle(cornerRadius: NamingRadius.small, style: .continuous))

                VStack(alignment: .leading, spacing: 4) {
                    Text(title)
                        .font(.system(size: 17, weight: .semibold))
                    Text(subtitle)
                        .font(.system(size: 14))
                        .foregroundStyle(selected ? NamingTheme.ink.opacity(0.75) : NamingTheme.muted)
                }
                .foregroundStyle(NamingTheme.ink)

                Spacer()
                Image(systemName: selected ? "checkmark.circle.fill" : "chevron.right")
                    .foregroundStyle(selected ? NamingTheme.primary : NamingTheme.muted)
            }
            .padding(16)
            .background(selected ? NamingTheme.primary.opacity(0.10) : NamingTheme.canvas,
                        in: RoundedRectangle(cornerRadius: NamingRadius.large, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: NamingRadius.large, style: .continuous)
                    .stroke(selected ? NamingTheme.primary : NamingTheme.hairline, lineWidth: 1)
            }
        }
        .buttonStyle(NamingPressButtonStyle())
        .sensoryFeedback(.selection, trigger: selected)
    }
}

extension View {

    /// 页面底色。渐变**只走纵向**：斜的渐变色是跟着页面 frame 走的，push / pop 时上一页
    /// 和下一页各画一份、一起横向滑，交界处两层颜色对不上，看着像背景在「变」；纵向渐变
    /// 在同一 y 上逐行同色，页面横向滑动时底子就是静止的。
    func namingPageBackground() -> some View {
        scrollContentBackground(.hidden)
            .background(
                LinearGradient(
                    colors: [
                        NamingTheme.background,
                        NamingTheme.background.opacity(0.70),
                        NamingTheme.canvas
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .ignoresSafeArea()
            )
    }
}
