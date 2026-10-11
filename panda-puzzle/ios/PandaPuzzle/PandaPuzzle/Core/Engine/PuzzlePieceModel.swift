import UIKit

struct PuzzlePieceModel: Identifiable {
    let id: Int
    let row: Int
    let col: Int
    let image: UIImage
    let correctSlot: Int
    let tabs: PieceTabs
    let cellPx: Int
    let padPx: Int

    /// 已放到的格位；nil 表示还在托盘
    var placedSlot: Int? = nil
    /// 只增不减，供旋转动画连续转（逻辑朝向用 rotation）
    var rotationSteps: Int = 0
    var trayOrder: Int = 0

    var isPlaced: Bool { placedSlot != nil }
    var rotation: Int { ((rotationSteps % 4) + 4) % 4 }

    var placedCorrectly: Bool {
        placedSlot == correctSlot && rotation == 0
    }
}

enum TrayMode: String {
    case list
    case stack
}

struct PuzzleBoardState {
    var cols: Int
    var rows: Int
    var pieces: [PuzzlePieceModel]
    var selectedId: Int?
    var hintSlot: Int?
    var crop: CropView
    var trayMode: TrayMode = .list
    var traySeed: Int = 0
    /// 拼盘震动标记
    var shakeTick: Int = 0

    var total: Int { cols * rows }
    var placedCount: Int { pieces.filter(\.isPlaced).count }

    var geometrySignature: String {
        let body = pieces.map {
            "\($0.id):\($0.placedSlot ?? -1):\($0.rotationSteps)"
        }.joined(separator: ",")
        return "\(cols)x\(rows)|\(body)"
    }

    var selectionSignature: String {
        "\(selectedId ?? -1)|\(hintSlot ?? -1)|\(shakeTick)"
    }

    func pieceAtSlot(_ slot: Int) -> PuzzlePieceModel? {
        pieces.first { $0.correctSlot == slot }
    }

    func occupant(of slot: Int) -> PuzzlePieceModel? {
        pieces.first { $0.placedSlot == slot }
    }
}
