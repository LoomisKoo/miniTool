import SwiftUI
import UIKit

/// 设计令牌：暗房 + 蓝色品牌色。
///
/// 硬规则：
/// 1. **品牌色只有一个蓝色** `accent`：主 CTA、选中、Tab 着色。
/// 2. **面分三层**：页面底 `bg` → 面板 / 弹层 `panel` → 卡片 `surface`；不用纯黑和系统灰。
/// 3. 线与内嵌底统一用 `line` / `surfaceInset`，不在各处手写 `.white.opacity(x)`。
enum FrameTheme {
    // MARK: 品牌色（= --accent / --accent-strong / --accent-dim / --accent-line）
    static let accent = Color(hex: 0x5B9BFF)
    static let accentStrong = Color(hex: 0x82B5FF)
    static let accentDim = Color(hex: 0x5B9BFF, alpha: 0.16)
    static let accentLine = Color(hex: 0x5B9BFF, alpha: 0.52)
    /// 蓝色按钮上的文字（= --text-invert）
    static let onAccent = Color(hex: 0x111113)

    static var accentGradient: LinearGradient {
        LinearGradient(colors: [accentStrong, accent], startPoint: .topLeading, endPoint: .bottomTrailing)
    }

    // MARK: 面（= --bg / --panel / --surface / --surface-inset）
    static let bg = Color(hex: 0x0E0E10)
    static let panel = Color(hex: 0x18181B)
    static let surface = Color(hex: 0x1F1F23)
    static let surfaceInset = Color.white.opacity(0.06)
    /// 票根缩略图衬底：比 surface 略深，让票根本身跳出来
    static let thumbBackdrop = Color(hex: 0x141416)

    // MARK: 文字（= --text / --muted-strong / --muted）
    static let text = Color(hex: 0xEDEDEE)
    static let textSecondary = Color(hex: 0xEDEDEE, alpha: 0.7)
    static let muted = Color(hex: 0xEDEDEE, alpha: 0.48)

    // MARK: 线（= --line / --line-strong）
    static let line = Color.white.opacity(0.07)
    static let lineStrong = Color.white.opacity(0.14)

    /// 浮层提示底（= --scrim）
    static let scrim = Color.black.opacity(0.55)

    /// 导航栏 / TabBar 统一成 panel 色，避免系统默认的纯黑与灰色毛玻璃割裂
    static func applyAppearance() {
        let tabBar = UITabBarAppearance()
        tabBar.configureWithOpaqueBackground()
        tabBar.backgroundColor = UIColor(panel)
        tabBar.shadowColor = UIColor(line)
        UITabBar.appearance().standardAppearance = tabBar
        UITabBar.appearance().scrollEdgeAppearance = tabBar

        // 顶部透明露出页面 / 弹层自身底色；滚动后才出毛玻璃，弹层（panel）和页面（bg）都不突兀
        let titles: [NSAttributedString.Key: Any] = [.foregroundColor: UIColor(text)]
        let edge = UINavigationBarAppearance()
        edge.configureWithTransparentBackground()
        edge.titleTextAttributes = titles
        edge.largeTitleTextAttributes = titles
        let scrolled = UINavigationBarAppearance()
        scrolled.configureWithDefaultBackground()
        scrolled.shadowColor = UIColor(line)
        scrolled.titleTextAttributes = titles
        scrolled.largeTitleTextAttributes = titles
        UINavigationBar.appearance().standardAppearance = scrolled
        UINavigationBar.appearance().compactAppearance = scrolled
        UINavigationBar.appearance().scrollEdgeAppearance = edge
    }
}
