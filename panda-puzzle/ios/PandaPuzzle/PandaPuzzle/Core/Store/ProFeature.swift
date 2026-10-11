import Foundation

enum ProFeature: String, CaseIterable, Identifiable {
    case morePieces
    case noWatermark
    case moreSaves
    case unlimitedHints

    var id: String { rawValue }

    var title: String {
        switch self {
        case .morePieces: return "更多拼块"
        case .noWatermark: return "无水印高清导出"
        case .moreSaves: return "多存档进度"
        case .unlimitedHints: return "提示不限次数"
        }
    }

    var blurb: String {
        switch self {
        case .morePieces: return "最高 \(PuzzleLimits.proMaxPieces) 块，大图也能切"
        case .noWatermark: return "成品图去掉署名水印"
        case .moreSaves: return "同时保留 \(PuzzleLimits.proMaxSaves) 幅进行中拼图"
        case .unlimitedHints: return "边缘提示随时可用"
        }
    }
}
