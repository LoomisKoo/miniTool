import Foundation

/* Pro 权益枚举。
 *
 * 未确认的免费额度（每批条数、换一批次数、西名中起次数等）**先不挂 gate**。
 * Pro 锁的是新增能力与决策深度：昵称全量、跨语言读音、无水印卡片、名字对比报告。 */

enum ProFeature: String, CaseIterable, Identifiable {
    case nicknameFull
    case speechListen
    case cardNoWatermark
    case nameReport
    case nickInterpretation

    var id: String { rawValue }

    var title: String {
        switch self {
        case .nicknameFull: return L10n.t("小名昵称全量")
        case .speechListen: return L10n.t("读音试听")
        case .cardNoWatermark: return L10n.t("无水印高清卡片")
        case .nameReport: return L10n.t("名字对比报告")
        case .nickInterpretation: return L10n.t("昵称跨语言详解")
        }
    }

    var blurb: String {
        switch self {
        case .nicknameFull: return L10n.t("按气质抽昵称 + 随机推荐，有性格更准")
        case .speechListen: return L10n.t("跨语言读音体检：多音字 + 普通话 / 英语试听")
        case .cardNoWatermark: return L10n.t("分享卡片去掉水印，更适合发给家人")
        case .nameReport: return L10n.t("并排比较候选名字，导出完整分析")
        case .nickInterpretation: return L10n.t("直译、意境适配、气质说明与适用场景")
        }
    }
}
