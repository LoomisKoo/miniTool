import SwiftUI

/// 统一配色，对齐 H5 `style.css` 的 CSS 变量。
enum BeadTheme {
    /// 页面底色 `--bg`
    static let background = Color(red: 242 / 255, green: 242 / 255, blue: 247 / 255)
    /// 卡片底色 `--surface`
    static let surface = Color.white
    /// 预览框底色 #e5e5ea
    static let viewport = Color(red: 229 / 255, green: 229 / 255, blue: 234 / 255)
    /// 主色 `--accent`
    static let accent = Color(red: 0, green: 122 / 255, blue: 1)
    /// 主色淡底 `--accent-soft`
    static let accentSoft = Color(red: 0, green: 122 / 255, blue: 1, opacity: 0.12)
    /// 胶囊按钮底色 `--fill`
    static let fill = Color(red: 120 / 255, green: 120 / 255, blue: 128 / 255, opacity: 0.16)
    /// 正文色 `--text`。显式给色，不依赖 `.primary`。
    static let ink = Color(red: 28 / 255, green: 28 / 255, blue: 30 / 255)
    /// 次要文字 `--muted`
    static let muted = Color(red: 142 / 255, green: 142 / 255, blue: 147 / 255)
    /// 分割线 `--separator`
    static let separator = Color(red: 60 / 255, green: 60 / 255, blue: 67 / 255, opacity: 0.12)
    /// 分隔用的浅底（空状态等）
    static let subtleFill = Color(red: 120 / 255, green: 120 / 255, blue: 128 / 255, opacity: 0.1)    /// 格线 GRID_COLOR
    static let gridLine = RGB8(0xC7, 0xC7, 0xCC)
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

/// 小圆角按钮，对应 H5 `.chip`。
///
/// - `hugContent = false`（默认）：等分占满可用宽度，用于 chips 行。
/// - `hugContent = true`：按内容自适应宽度，自带左右内边距，用于「40×40」「分板线」这类独立按钮。
struct BeadChip: View {
    let title: String
    var selected = false
    /// 选中态用主色实底（`.chip.on`）；false 时用主色淡底（`.chip-select`）。
    var prominentWhenSelected = true
    var compact = false
    var hugContent = false
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: compact ? 12 : 13, weight: .semibold))
                .foregroundStyle(foreground)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
                .padding(.horizontal, compact ? 6 : 12)
                .frame(height: compact ? 28 : 32)
                .frame(maxWidth: hugContent ? nil : .infinity)
                .background(
                    background,
                    in: RoundedRectangle(cornerRadius: compact ? 8 : 10)
                )
        }
        .buttonStyle(.plain)
    }

    private var background: Color {
        if selected {
            return prominentWhenSelected ? BeadTheme.accent : BeadTheme.accentSoft
        }
        return BeadTheme.fill
    }

    private var foreground: Color {
        if selected {
            return prominentWhenSelected ? .white : BeadTheme.accent
        }
        return BeadTheme.ink
    }
}

/// 一行参数：标签 + 滑杆 + 数值，对齐 H5 `.row`。
struct BeadSliderRow: View {
    let label: String
    @Binding var value: Int
    let range: ClosedRange<Int>

    var body: some View {
        HStack(spacing: 12) {
            Text(label)
                .font(.system(size: 15))
                .foregroundStyle(BeadTheme.ink)
                .frame(width: 40, alignment: .leading)
            Slider(
                value: Binding(
                    get: { Double(value) },
                    set: { value = Int($0.rounded()) }
                ),
                in: Double(range.lowerBound)...Double(range.upperBound),
                step: 1
            )
            Text("\(value)")
                .font(.system(size: 15))
                .foregroundStyle(BeadTheme.muted)
                .monospacedDigit()
                .frame(width: 28, alignment: .trailing)
        }
        .frame(minHeight: 40)
        .padding(.horizontal, 14)
    }
}

/// 分组卡片，对齐 H5 `.group`。
struct BeadGroup<Content: View>: View {
    @ViewBuilder var content: () -> Content

    var body: some View {
        VStack(spacing: 0) {
            content()
        }
        .background(BeadTheme.surface, in: RoundedRectangle(cornerRadius: 12))
    }
}

/// 分组的行间分割线，对齐 H5 `.group .row + .row::before`。
struct BeadRowDivider: View {
    var body: some View {
        Rectangle()
            .fill(BeadTheme.separator)
            .frame(height: 0.5)
            .padding(.leading, 14)
    }
}

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
