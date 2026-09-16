import CoreGraphics
import Observation
import UIKit

/// 作品库。负责索引与图片的落盘 / 读取，是 App 内唯一的作品数据源。
///
/// 索引是一份 JSON（`projects.json`），源图与缩略图各自一个文件。
/// 数据量很小（几十个作品），读写都在主线程同步完成，够快也少一层时序问题。
@MainActor
@Observable
final class ProjectStore {
    static let shared = ProjectStore()

    /// 免费版可保存的作品数上限。接入 StoreKit 后由 Pro 解除。
    static let freeLimit = 3

    /// 按 `updatedAt` 倒序，最近改过的排最前。
    private(set) var projects: [BeadProject] = []
    /// 保存 / 读取失败的提示，供界面弹窗。
    var message: String?

    private var hasLoaded = false

    private init() {}

    var count: Int { projects.count }

    /// 还能不能再建一个作品（Pro 不限；免费版有额度）。
    var canCreate: Bool {
        EntitlementStore.shared.isPro || projects.count < Self.freeLimit
    }

    // MARK: - 读

    /// 首次进入时载入索引。可重复调用。
    func loadIfNeeded() {
        guard !hasLoaded else { return }
        hasLoaded = true
        load()
    }

    func load() {
        do {
            try ProjectPaths.prepare()
        } catch {
            message = "无法创建作品目录：%@".loc(error.localizedDescription)
            return
        }
        guard let data = try? Data(contentsOf: ProjectPaths.index) else {
            projects = []
            return
        }
        do {
            projects = try JSONDecoder().decode([BeadProject].self, from: data)
                .sorted { $0.updatedAt > $1.updatedAt }
        } catch {
            // 整份失败时尽量逐条抢救，避免一个坏字段清空整个作品库。
            if let rescued = Self.decodeProjectsLeniently(from: data), !rescued.isEmpty {
                projects = rescued.sorted { $0.updatedAt > $1.updatedAt }
                try? writeIndex()
            } else {
                message = "作品索引损坏，已跳过载入：%@".loc(error.localizedDescription)
                projects = []
            }
        }
    }

    /// 逐条解码：某条坏了就跳过，其余保留。
    private static func decodeProjectsLeniently(from data: Data) -> [BeadProject]? {
        guard let array = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
            return nil
        }
        let decoder = JSONDecoder()
        var result: [BeadProject] = []
        for item in array {
            guard let itemData = try? JSONSerialization.data(withJSONObject: item),
                  let project = try? decoder.decode(BeadProject.self, from: itemData) else {
                continue
            }
            result.append(project)
        }
        return result
    }

    /// 作品源图。文件被清掉时返回 nil。
    func image(for project: BeadProject) -> CGImage? {
        guard let data = try? Data(contentsOf: ProjectPaths.imageURL(project.imageFile)) else { return nil }
        return UIImage(data: data)?.cgImage
    }

    func thumbnail(for project: BeadProject) -> UIImage? {
        UIImage(contentsOfFile: ProjectPaths.thumbURL(project.id).path)
    }

    // MARK: - 写

    /// 新增或覆盖一个作品，并把源图与缩略图落盘。
    @discardableResult
    func save(_ project: BeadProject, sourceImage: CGImage, thumbnail: UIImage?) -> BeadProject {
        var value = project
        value.updatedAt = Date()
        do {
            try ProjectPaths.prepare()
            try Self.writeImage(sourceImage, to: ProjectPaths.imageURL(value.imageFile))
            if let thumbnail {
                try Self.writeJPEG(thumbnail, to: ProjectPaths.thumbURL(value.id))
            }
            if let index = projects.firstIndex(where: { $0.id == value.id }) {
                projects[index] = value
            } else {
                projects.insert(value, at: 0)
            }
            projects.sort { $0.updatedAt > $1.updatedAt }
            try writeIndex()
        } catch {
            message = "保存失败：%@".loc(error.localizedDescription)
        }
        return value
    }

    func rename(_ project: BeadProject, to name: String) {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty,
              let index = projects.firstIndex(where: { $0.id == project.id }) else { return }
        projects[index].name = trimmed
        projects[index].updatedAt = Date()
        projects.sort { $0.updatedAt > $1.updatedAt }
        try? writeIndex()
    }

    func delete(_ project: BeadProject) {
        projects.removeAll { $0.id == project.id }
        try? FileManager.default.removeItem(at: ProjectPaths.imageURL(project.imageFile))
        try? FileManager.default.removeItem(at: ProjectPaths.thumbURL(project.id))
        try? writeIndex()
    }

    /// 复制一个作品（含源图与缩略图），用于「另存为」。
    @discardableResult
    func duplicate(_ project: BeadProject) -> BeadProject? {
        guard canCreate else {
            EntitlementStore.shared.requestPaywall()
            return nil
        }
        guard let image = image(for: project) else {
            message = "作品源图丢失，无法复制。".loc
            return nil
        }
        let id = UUID()
        let copy = BeadProject(
            id: id,
            name: "%@ 副本".loc(project.name),
            createdAt: Date(),
            updatedAt: Date(),
            imageFile: "\(id.uuidString).jpg",
            settings: project.settings,
            handEdits: project.handEdits,
            gridWidth: project.gridWidth,
            gridHeight: project.gridHeight
        )
        return save(copy, sourceImage: image, thumbnail: thumbnail(for: project))
    }

    // MARK: - 内部

    private func writeIndex() throws {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        let data = try encoder.encode(projects)
        try data.write(to: ProjectPaths.index, options: .atomic)
    }

    private static func writeImage(_ image: CGImage, to url: URL) throws {
        try writeJPEG(UIImage(cgImage: image), to: url)
    }

    private static func writeJPEG(_ image: UIImage, to url: URL, quality: CGFloat = 0.9) throws {
        guard let data = image.jpegData(compressionQuality: quality) else {
            throw StoreError.encodeFailed
        }
        try data.write(to: url, options: .atomic)
    }

    enum StoreError: LocalizedError {
        case encodeFailed

        var errorDescription: String? { "图片编码失败。".loc }
    }
}
