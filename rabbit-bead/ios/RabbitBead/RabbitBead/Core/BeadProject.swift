import Foundation

/// 手绘改动的一条记录：某个格位与自动量化结果不同。
///
/// 只存格位序号与色号，不存整张格子：载入时用「原图 + 参数」重跑一遍量化就还原了自动结果，
/// 再把这几条贴回去。这样既省空间（通常只有几十条），算法以后改了老作品也会跟着变好。
struct BeadHandEdit: Codable, Hashable {
    /// 格位序号（行优先）。
    var index: Int
    /// 手绘后的色号；`rgb` 由色卡还原，不用存。
    var code: String
}

/// 一个已保存的作品。
///
/// 源图与缩略图按 `id` 存在 `ProjectPaths` 下，这里只存文件名，避免把大二进制塞进索引 JSON。
struct BeadProject: Codable, Identifiable, Hashable {
    var id: UUID
    var name: String
    var createdAt: Date
    var updatedAt: Date
    /// 源图文件名（位于 `ProjectPaths.images`）。
    var imageFile: String
    /// 生成这张图纸的全部参数。
    var settings: BeadSettings
    /// 手绘改动。
    var handEdits: [BeadHandEdit]
    /// 量化结果的格子尺寸。载入时用来校验手绘还能不能贴回去。
    var gridWidth: Int
    var gridHeight: Int

    /// 列表副标题：尺寸 + 板数。
    var summary: String {
        "%ld×%ld · %ld 豆宽 · %ld 限色".loc(gridWidth, gridHeight, settings.beadWidth, settings.maxColors)
    }

    /// 载入后手绘生效的前提：格子形状与色卡都没变。
    func canApplyHandEdits(toGridWidth width: Int, height: Int, paletteId: String) -> Bool {
        gridWidth == width && gridHeight == height && settings.paletteId == paletteId
    }
}

/// 作品落盘位置：`Application Support/RabbitBead/`。
///
/// 不放 Caches：系统在空间紧张时会清空 Caches，用户的作品不能这么丢。
enum ProjectPaths {
    static let root: URL = {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        return base.appendingPathComponent("RabbitBead", isDirectory: true)
    }()

    static var images: URL { root.appendingPathComponent("images", isDirectory: true) }
    static var thumbs: URL { root.appendingPathComponent("thumbs", isDirectory: true) }
    static var index: URL { root.appendingPathComponent("projects.json") }
    static var draftImage: URL { root.appendingPathComponent("draft.jpg") }
    static var draftSettings: URL { root.appendingPathComponent("draft-settings.json") }
    /// 「我的豆子」库存（色卡/色号 → 已有颗数）。
    static var inventory: URL { root.appendingPathComponent("inventory.json") }

    static func imageURL(_ file: String) -> URL { images.appendingPathComponent(file) }
    static func thumbURL(_ id: UUID) -> URL { thumbs.appendingPathComponent("\(id.uuidString).jpg") }

    /// 建目录。可重复调用。
    static func prepare() throws {
        for directory in [root, images, thumbs] {
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        }
    }
}
