import Foundation

/// 格内取色方式。
enum SampleMode: String, CaseIterable, Identifiable, Codable {
    /// 格内出现次数最多的像素色（对齐 Zippland / perler-beads）
    case dominant
    /// 线性空间均值，过渡更柔但易灰
    case average

    var id: String { rawValue }

    var label: String {
        switch self {
        case .dominant: "主色"
        case .average: "均值"
        }
    }
}

/// 图纸导出内容选项。
struct ExportOptions: Codable, Hashable {
    /// 行列坐标（顶行列号 + 左侧行号）
    var coordinates = false
    /// 格内色号
    var codes = true
    /// 用量图例（色块 + 编号 + 颗数）
    var legend = true
    /// 标题信息（品牌 + 尺寸 + 第几板）
    var title = true
    /// 整幅导出时画板与板之间的分割线（拼板对位用）
    var boardSeams = false
    /// 多板时导出整幅还是逐板各一张
    var boardScope: BoardScope = .full
}

/// 导出范围。
enum BoardScope: String, CaseIterable, Identifiable, Codable {
    case full
    case each

    var id: String { rawValue }

    var title: String {
        switch self {
        case .full: "导出全图"
        case .each: "分板逐个导出"
        }
    }

    var detail: String {
        switch self {
        case .full: "整幅一张；过大将自动缩小，失败请改分板导出"
        case .each: "每板一张，含本板用量"
        }
    }
}

/// 拼板规格选项（与 H5 端 `board-size-sheet` 一致）。
struct BoardSizeOption: Identifiable, Hashable {
    let size: Int
    let detail: String

    var id: Int { size }
    var title: String { "\(size)×\(size)" }

    static let all: [BoardSizeOption] = [
        BoardSizeOption(size: 14, detail: "小号方板"),
        BoardSizeOption(size: 15, detail: "小号方板"),
        BoardSizeOption(size: 16, detail: "练习小板"),
        BoardSizeOption(size: 22, detail: "中号方板"),
        BoardSizeOption(size: 28, detail: "近标准板"),
        BoardSizeOption(size: 29, detail: "标准大方板 · 默认"),
        BoardSizeOption(size: 32, detail: "大号方板"),
        BoardSizeOption(size: 40, detail: "加大方板"),
        BoardSizeOption(size: 52, detail: "超大方板"),
    ]
}

/// 拼豆生成参数。与 H5 端 `state` 中的可调项一一对应。
struct BeadSettings: Codable, Hashable {
    var paletteId = "mard"
    /// 豆宽：成品横向格数。
    var beadWidth = 29
    /// 单板规格，用于分板与板数统计。
    var boardSize = 29
    /// 限色上限（8–80）。
    var maxColors = 48
    var sampleMode: SampleMode = .dominant
    var dither = false
    /// 邻近相似色连通域合并。
    var mergeSimilar = false
    /// 合并阈值（RGB 欧氏距离）。H5 端固定在 40，无 UI。
    var mergeThreshold = 40
    /// 网格线（H5 的 `showGrid`）。
    var showGrid = true
    /// 分板线：预览与整幅导出时画板间分割线。
    ///
    /// H5 端默认开；这里默认关，需要拼板对位时再打开。
    var showSeam = false
    /// 格内显示色号（屏幕每格够大时才生效）。
    var showCodes = true
    var export = ExportOptions()

    static let widthRange = 16...116
    static let colorRange = 8...80
    static let mergeThresholdRange = 10...90

    /// 与 H5 端 `state` 一致的默认参数。
    static let standard = BeadSettings()

    /// 影响量化的参数签名：只有这些变化才需要重新换算。
    /// 拼板规格、网格、色号显示、导出选项都只是展示层的开关。
    struct QuantizationSignature: Equatable {
        let paletteId: String
        let beadWidth: Int
        let maxColors: Int
        let sampleMode: SampleMode
        let dither: Bool
        let mergeSimilar: Bool
        let mergeThreshold: Int
    }

    var quantizationSignature: QuantizationSignature {
        QuantizationSignature(
            paletteId: paletteId,
            beadWidth: beadWidth,
            maxColors: maxColors,
            sampleMode: sampleMode,
            dither: dither,
            mergeSimilar: mergeSimilar,
            mergeThreshold: mergeThreshold
        )
    }
}

/// 参数本地持久化。用 `UserDefaults`，对应 H5 端的 localStorage。
enum SettingsStore {
    private static let key = "beadpattern.settings.v2"

    static func load() -> BeadSettings {
        guard let data = UserDefaults.standard.data(forKey: key),
              let settings = try? JSONDecoder().decode(BeadSettings.self, from: data) else {
            return .standard
        }
        return settings
    }

    static func save(_ settings: BeadSettings) {
        guard let data = try? JSONEncoder().encode(settings) else { return }
        UserDefaults.standard.set(data, forKey: key)
    }
}
