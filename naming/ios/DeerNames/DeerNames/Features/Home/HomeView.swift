import SwiftUI

/* 首页 —— 对应 app.js 的 renderHome：中文名 / 英文名 / 社交昵称。
 *
 * **入口按「要什么名字」分，不按「你是谁」分**：取名字的具体方式（按性格 / 按已有的名字 /
 * 自选姓名）收在各自的入口页里；社交昵称是独立一级能力，不从详情里进。 */

struct HomeView: View {
    @Environment(NamingAppModel.self) private var model

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                /* 入口图标是纯装饰的字章，英文界面下换成首字母，不参与词表。 */
                EntryRow(icon: L10n.isEnglish ? "Z" : "中", title: L10n.t("中文名"),
                         subtitle: L10n.t("按性格、按外文名，或自己挑字")) {
                    model.openZh()
                }
                EntryRow(icon: L10n.isEnglish ? "E" : "英", title: L10n.t("英文名"),
                         subtitle: L10n.t("按性格、按中文名读音，或自己挑姓和名")) {
                    model.openEn()
                }
                EntryRow(icon: L10n.isEnglish ? "N" : "昵", title: L10n.t("社交昵称"),
                         subtitle: L10n.t("按气质抽一批，也可随机；有性格更准")) {
                    model.openSocialNick()
                }
            }
            .padding(20)
        }
        .namingPageBackground()
        // 标题由 NavigationStack 根视图统一给（跟着当前 tab 走）
    }
}

struct EntryRow: View {
    let icon: String
    let title: String
    let subtitle: String
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 14) {
                Text(icon)
                    .font(.system(size: 19, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(width: 46, height: 46)
                    .background(NamingTheme.gradient, in: RoundedRectangle(cornerRadius: NamingRadius.small, style: .continuous))
                VStack(alignment: .leading, spacing: 4) {
                    Text(title)
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(NamingTheme.ink)
                    Text(subtitle)
                        .font(.system(size: 13))
                        .foregroundStyle(NamingTheme.muted)
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.right")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(NamingTheme.muted)
            }
            .padding(16)
            .background(NamingTheme.canvas, in: RoundedRectangle(cornerRadius: NamingRadius.large, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: NamingRadius.large, style: .continuous)
                    .strokeBorder(NamingTheme.hairline, lineWidth: 1)
            }
            .shadow(color: .black.opacity(0.06), radius: 3, y: 2)
        }
        .buttonStyle(.plain)
    }
}
