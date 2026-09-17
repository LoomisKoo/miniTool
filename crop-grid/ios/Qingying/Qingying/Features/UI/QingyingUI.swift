import SwiftUI

/// 统一配色，对齐 H5 `index.html` 里的 CSS 变量。
enum QingyingTheme {
    /// 页面底色 `--bg`
    static let background = Color(red: 242 / 255, green: 242 / 255, blue: 247 / 255)
    /// 卡片底色 `--surface`
    static let surface = Color.white
    /// 预览框底色
    static let viewport = Color(red: 229 / 255, green: 229 / 255, blue: 234 / 255)
    /// 主色 `--accent`
    static let accent = Color(red: 0, green: 122 / 255, blue: 1)
    /// 主色淡底 `--accent-soft`
    static let accentSoft = Color(red: 0, green: 122 / 255, blue: 1, opacity: 0.12)
    /// 胶囊按钮底色 `--fill`
    static let fill = Color(red: 120 / 255, green: 120 / 255, blue: 128 / 255, opacity: 0.12)
    /// 正文色 `--text`
    static let ink = Color.black
    /// 次要文字 `--text-secondary`
    static let muted = Color(red: 60 / 255, green: 60 / 255, blue: 67 / 255, opacity: 0.6)
    /// 分割线 `--separator`
    static let separator = Color(red: 60 / 255, green: 60 / 255, blue: 67 / 255, opacity: 0.18)
    /// 预览区外的压暗遮罩
    static let dim = Color(red: 242 / 255, green: 242 / 255, blue: 247 / 255, opacity: 0.72)
}

/// 小圆角按钮，对应 H5 `.chip`。
///
/// - `equalWidth = true`（默认）：等分占满一行，用于参数 chip 组。
/// - `equalWidth = false`：按内容自适应宽度。
struct QingChip: View {
    let title: String
    var selected = false
    var equalWidth = true
    var height: CGFloat = 32
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(selected ? .white : QingyingTheme.ink)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
                .padding(.horizontal, 8)
                .frame(height: height)
                .frame(maxWidth: equalWidth ? .infinity : nil)
                .background(
                    selected ? QingyingTheme.accent : QingyingTheme.fill,
                    in: RoundedRectangle(cornerRadius: 10)
                )
        }
        .buttonStyle(.plain)
    }
}

/// 图标按钮（旋转 / 镜像），对应 H5 `.icon-btn`。
struct QingIconButton: View {
    let systemName: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.system(size: 15, weight: .medium))
                .foregroundStyle(QingyingTheme.ink)
                .frame(width: 36, height: 32)
                .background(QingyingTheme.fill, in: RoundedRectangle(cornerRadius: 10))
        }
        .buttonStyle(.plain)
    }
}

/// 分组卡片，对应 H5 `.group`。
struct QingGroup<Content: View>: View {
    @ViewBuilder var content: () -> Content

    var body: some View {
        VStack(spacing: 0) {
            content()
        }
        .background(QingyingTheme.surface, in: RoundedRectangle(cornerRadius: 12))
    }
}

/// 分组内的行间分割线。
struct QingRowDivider: View {
    var body: some View {
        Rectangle()
            .fill(QingyingTheme.separator.opacity(0.6))
            .frame(height: 0.5)
            .padding(.leading, 14)
    }
}

/// 主按钮，对应 H5 `.btn-primary`。
struct QingPrimaryButton: View {
    let title: String
    var enabled = true
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .frame(height: 46)
                .background(
                    enabled ? QingyingTheme.accent : QingyingTheme.accent.opacity(0.4),
                    in: RoundedRectangle(cornerRadius: 12)
                )
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
    }
}

/// 描边按钮，对应 H5 `.btn-outline`。
struct QingOutlineButton: View {
    let title: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 16, weight: .medium))
                .foregroundStyle(QingyingTheme.ink)
                .frame(maxWidth: .infinity)
                .frame(height: 46)
                .background(QingyingTheme.surface, in: RoundedRectangle(cornerRadius: 12))
        }
        .buttonStyle(.plain)
    }
}

/// 宫格示意图标，对应 H5 `gridIconSvg`。
struct QingGridIcon: View {
    let grid: CropGrid
    var color: Color = QingyingTheme.ink
    var size: CGFloat = 18

    var body: some View {
        let spacing: CGFloat = 1.5
        let cellW = (size - spacing * CGFloat(grid.cols - 1)) / CGFloat(grid.cols)
        let cellH = (size - spacing * CGFloat(grid.rows - 1)) / CGFloat(grid.rows)

        Canvas { context, _ in
            for row in 0..<grid.rows {
                for col in 0..<grid.cols {
                    let rect = CGRect(
                        x: CGFloat(col) * (cellW + spacing),
                        y: CGFloat(row) * (cellH + spacing),
                        width: cellW,
                        height: cellH
                    )
                    let path = Path(roundedRect: rect, cornerRadius: 1.5)
                    context.fill(path, with: .color(color))
                }
            }
        }
        .frame(width: size, height: size)
    }
}

/// 圆形色点，用于网格线颜色按钮。
struct QingColorDot: View {
    let color: Color

    var body: some View {
        Circle()
            .fill(color)
            .frame(width: 16, height: 16)
            .overlay(Circle().strokeBorder(Color.black.opacity(0.12), lineWidth: 0.5))
    }
}
