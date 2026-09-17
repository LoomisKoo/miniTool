import SwiftUI

/// 首页：两个入口卡片。对齐 H5 的 `tool-list`。
struct QingyingHomeView: View {
    let onCrop: () -> Void
    let onStitch: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            header

            VStack(spacing: 12) {
                ToolCard(
                    systemName: "crop",
                    title: "裁图",
                    subtitle: "比例裁切 · 圆角圆形 · 宫格分图",
                    action: onCrop
                )

                ToolCard(
                    systemName: "square.stack.3d.down.right",
                    title: "拼图",
                    subtitle: "2～9 张竖向拼成长图（开发中）",
                    action: onStitch
                )
            }
            .padding(.horizontal, 16)
            .padding(.top, 20)

            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(QingyingTheme.background)
    }

    private var header: some View {
        VStack(spacing: 6) {
            HStack(spacing: 8) {
                Image(systemName: "crop")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(width: 26, height: 26)
                    .background(QingyingTheme.accent, in: RoundedRectangle(cornerRadius: 7))

                Text("轻映")
                    .font(.system(size: 20, weight: .bold))
                    .foregroundStyle(QingyingTheme.ink)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 14)
        .background(QingyingTheme.background)
        .overlay(alignment: .bottom) {
            Rectangle().fill(QingyingTheme.separator).frame(height: 0.5)
        }
    }
}

/// 工具入口卡片，对应 H5 `.tool-card`。
private struct ToolCard: View {
    let systemName: String
    let title: String
    let subtitle: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: systemName)
                    .font(.system(size: 20, weight: .regular))
                    .foregroundStyle(QingyingTheme.accent)
                    .frame(width: 44, height: 44)
                    .background(QingyingTheme.accentSoft, in: RoundedRectangle(cornerRadius: 12))

                VStack(alignment: .leading, spacing: 3) {
                    Text(title)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(QingyingTheme.ink)
                    Text(subtitle)
                        .font(.system(size: 13))
                        .foregroundStyle(QingyingTheme.muted)
                        .lineLimit(1)
                        .minimumScaleFactor(0.85)
                }

                Spacer(minLength: 4)

                Image(systemName: "chevron.right")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(QingyingTheme.muted.opacity(0.6))
            }
            .padding(14)
            .background(QingyingTheme.surface, in: RoundedRectangle(cornerRadius: 14))
        }
        .buttonStyle(.plain)
    }
}
