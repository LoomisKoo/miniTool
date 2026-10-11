import Foundation
import Observation
import UIKit

struct PuzzleSaveSummary: Identifiable, Codable, Equatable {
    var id: String
    var title: String
    var progress: String
    var updatedAt: Date
    var thumbPath: String?
}

struct PuzzleSavePiece: Codable {
    var id: Int
    var placedSlot: Int?
    var rotationSteps: Int
    var trayOrder: Int
}

struct PuzzleSavedData {
    var id: String
    var title: String
    var sourceImage: UIImage
    var cols: Int
    var rows: Int
    var crop: CropView
    var pieces: [PuzzleSavePiece]
}

private struct PuzzleSavePayload: Codable {
    var id: String
    var title: String
    var puzzleKey: String
    var sourceImageData: Data
    var cols: Int
    var rows: Int
    var crop: CropView
    var pieces: [PuzzleSavePiece]
}

enum PuzzleSaveResult {
    case saved(id: String, created: Bool)
    case limitReached
    case failed
}

/// 本地拼图存档：索引保存摘要，单独 JSON 保存当前拼图的完整进度。
@Observable
@MainActor
final class PuzzleSaveStore {
    private let indexFileName = "saves-index.json"
    private var rootURL: URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        let dir = base.appendingPathComponent("PandaPuzzle/saves", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    private(set) var items: [PuzzleSaveSummary] = []
    var requestedSaveID: String?

    func reload() {
        let url = rootURL.appendingPathComponent(indexFileName)
        guard let data = try? Data(contentsOf: url),
              let list = try? JSONDecoder().decode([PuzzleSaveSummary].self, from: data) else {
            items = []
            return
        }
        items = list.sorted { $0.updatedAt > $1.updatedAt }
    }

    func canCreateNew(isPro: Bool) -> Bool {
        items.count < PuzzleLimits.maxSaves(isPro: isPro)
    }

    func save(
        title: String,
        puzzleKey: String,
        sourceImage: UIImage,
        board: PuzzleBoardState,
        existingID: String?,
        isPro: Bool
    ) -> PuzzleSaveResult {
        let updating = existingID.flatMap { id in items.contains { $0.id == id } } ?? false
        guard updating || canCreateNew(isPro: isPro) else { return .limitReached }

        let id = updating ? existingID! : UUID().uuidString
        guard let imageData = sourceImage.jpegData(compressionQuality: 0.92) else {
            return .failed
        }
        let thumbPath = "\(id)-thumb.jpg"
        if let thumb = sourceImage.preparingThumbnail(of: CGSize(width: 480, height: 480)),
           let thumbData = thumb.jpegData(compressionQuality: 0.82) {
            try? thumbData.write(to: rootURL.appendingPathComponent(thumbPath), options: .atomic)
        }
        let payload = PuzzleSavePayload(
            id: id,
            title: title,
            puzzleKey: puzzleKey,
            sourceImageData: imageData,
            cols: board.cols,
            rows: board.rows,
            crop: board.crop,
            pieces: board.pieces.map {
                PuzzleSavePiece(
                    id: $0.id,
                    placedSlot: $0.placedSlot,
                    rotationSteps: $0.rotationSteps,
                    trayOrder: $0.trayOrder
                )
            }
        )
        guard let data = try? JSONEncoder().encode(payload) else { return .failed }
        do {
            try data.write(to: rootURL.appendingPathComponent("\(id).json"), options: .atomic)
        } catch {
            return .failed
        }

        let summary = PuzzleSaveSummary(
            id: id,
            title: title,
            progress: "\(board.placedCount)/\(board.total)",
            updatedAt: Date(),
            thumbPath: thumbPath
        )
        items.removeAll { $0.id == id }
        items.append(summary)
        items.sort { $0.updatedAt > $1.updatedAt }
        persist()
        return .saved(id: id, created: !updating)
    }

    func delete(id: String) {
        let thumbPath = items.first(where: { $0.id == id })?.thumbPath
        items.removeAll { $0.id == id }
        persist()
        let payload = rootURL.appendingPathComponent("\(id).json")
        try? FileManager.default.removeItem(at: payload)
        if let thumbPath {
            try? FileManager.default.removeItem(at: rootURL.appendingPathComponent(thumbPath))
        }
    }

    func thumbnail(for item: PuzzleSaveSummary) -> UIImage? {
        if let path = item.thumbPath,
           let image = UIImage(contentsOfFile: rootURL.appendingPathComponent(path).path) {
            return image
        }

        // 兼容没有缩略图的旧存档：从完整存档图片懒生成封面。
        let url = rootURL.appendingPathComponent("\(item.id).json")
        guard let data = try? Data(contentsOf: url),
              let payload = try? JSONDecoder().decode(PuzzleSavePayload.self, from: data),
              let image = UIImage(data: payload.sourceImageData) else {
            return nil
        }
        return image.preparingThumbnail(of: CGSize(width: 480, height: 480)) ?? image
    }

    func load(id: String) -> PuzzleSavedData? {
        let url = rootURL.appendingPathComponent("\(id).json")
        guard let data = try? Data(contentsOf: url),
              let payload = try? JSONDecoder().decode(PuzzleSavePayload.self, from: data),
              let image = UIImage(data: payload.sourceImageData) else {
            return nil
        }
        return PuzzleSavedData(
            id: payload.id,
            title: payload.title,
            sourceImage: image,
            cols: payload.cols,
            rows: payload.rows,
            crop: payload.crop,
            pieces: payload.pieces
        )
    }

    private func persist() {
        let url = rootURL.appendingPathComponent(indexFileName)
        guard let data = try? JSONEncoder().encode(items) else { return }
        try? data.write(to: url, options: .atomic)
    }
}
