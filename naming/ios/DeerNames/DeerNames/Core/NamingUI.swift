import SwiftUI
import UIKit

/* 布局变化的统一动画。
 *
 * 选姓 / 选名页有个共同的形状：点一行 → 筛选条下面长出一张信息卡 → 下面的列表跟着往下挪。
 * 这两件事必须在**同一个事务**里发生：只让列表挪而不给选中态动画，就会看到行先跳下去、
 * 打勾和字色慢半拍才跟上，像卡了一下。所以选中一律走 `withAnimation(NamingMotion.pick)`。 */
enum NamingMotion {
    static let pick = Animation.easeInOut(duration: 0.24)
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
        .buttonStyle(.plain)
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
