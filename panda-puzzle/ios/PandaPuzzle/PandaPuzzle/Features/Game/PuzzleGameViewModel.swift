import Observation
import PhotosUI
import SwiftUI
import UIKit
import CryptoKit

@Observable
@MainActor
final class PuzzleGameViewModel {
    var board = PuzzleBoardState(cols: 4, rows: 6, pieces: [], selectedId: nil, hintSlot: nil, crop: CropView())
    var hint = "点选拼块，再点棋盘格位归位"
    var hintOn = false
    var showRestartConfirm = false
    var showCropSheet = false
    var cropDraftImage: UIImage?
    var cropApplyTitle = "开始拼图"
    var cropInitialCols = 4
    var cropInitialRows = 6
    var cropInitialCrop = CropView()
    var pendingPickPhoto = false
    var pickerItem: PhotosPickerItem?
    var showSaveName = false
    var saveName = ""
    var isPreparingPuzzle = false
    var celebrationToken = 0

    private var pro: ProStore?
    private(set) var sourceImage: UIImage = PuzzleCutEngine.demoImage()
    private var activeSaveID: String?
    private var activeSaveTitle: String?
    private var activePuzzleKey: String?
    private var preparationToken = 0
    private static let savedColsKey = "pandaPuzzle.lastCols"
    private static let savedRowsKey = "pandaPuzzle.lastRows"

    init() {
        hintOn = UserDefaults.standard.bool(forKey: "pandaPuzzle.hintOn")
        if let raw = UserDefaults.standard.string(forKey: "pandaPuzzle.trayMode"),
           let mode = TrayMode(rawValue: raw) {
            board.trayMode = mode
        }
    }

    func bind(pro: ProStore) {
        self.pro = pro
    }

    var maxPieces: Int {
        PuzzleLimits.maxPieces(isPro: pro?.isPro ?? false)
    }

    func bootIfNeeded() {
        guard board.pieces.isEmpty else { return }
        startNew(image: PuzzleCutEngine.demoImage(), cols: nil, rows: nil, crop: CropView())
    }

    /// 点「选图」：打开当前图的切分设置（可在 sheet 里换图）
    func openCropEditor(applyTitle: String = "按此切分") {
        cropDraftImage = sourceImage
        cropApplyTitle = applyTitle
        cropInitialCols = max(2, board.cols)
        cropInitialRows = max(2, board.rows)
        cropInitialCrop = board.crop
        showCropSheet = true
    }

    func startNew(image: UIImage, cols: Int?, rows: Int?, crop: CropView) {
        sourceImage = image
        preparationToken += 1
        let token = preparationToken
        let limit = maxPieces
        let trayMode = board.trayMode
        isPreparingPuzzle = true
        hint = "正在切分图片…"

        // 切图会为每个拼块生成一张纹理，不能在主线程执行。
        DispatchQueue.global(qos: .userInitiated).async {
            var c = cols ?? 0
            var r = rows ?? 0
            if cols == nil || rows == nil {
                let defaults = UserDefaults.standard
                if let savedCols = defaults.object(forKey: Self.savedColsKey) as? Int,
                   let savedRows = defaults.object(forKey: Self.savedRowsKey) as? Int {
                    c = savedCols
                    r = savedRows
                } else {
                    let suggested = PuzzleCutEngine.suggestGrid(
                        imageWidth: Int(image.size.width),
                        imageHeight: Int(image.size.height),
                        preferTotal: min(24, limit)
                    )
                    c = suggested.cols
                    r = suggested.rows
                }
            }
            while c * r > limit, c > 2 || r > 2 {
                if c >= r { c -= 1 } else { r -= 1 }
            }
            let pieces = PuzzleCutEngine.cut(image: image, cols: c, rows: r, cropView: crop)
            let key = Self.puzzleKey(image: image, cols: c, rows: r, crop: crop)

            DispatchQueue.main.async { [weak self] in
                guard let self, self.preparationToken == token else { return }
                self.finishPreparing(
                    image: image, cols: c, rows: r, crop: crop,
                    pieces: pieces, key: key, trayMode: trayMode
                )
            }
        }
    }

    private func finishPreparing(
        image: UIImage,
        cols c: Int,
        rows r: Int,
        crop: CropView,
        pieces: [PuzzlePieceModel],
        key: String,
        trayMode: TrayMode
    ) {
        if activePuzzleKey != key {
            activeSaveID = nil
            activeSaveTitle = nil
        }
        activePuzzleKey = key
        UserDefaults.standard.set(c, forKey: Self.savedColsKey)
        UserDefaults.standard.set(r, forKey: Self.savedRowsKey)
        board = PuzzleBoardState(
            cols: c,
            rows: r,
            pieces: pieces,
            selectedId: nil,
            hintSlot: nil,
            crop: crop,
            trayMode: trayMode,
            traySeed: Int.random(in: 0..<100_000)
        )
        showCropSheet = false
        cropDraftImage = nil
        isPreparingPuzzle = false
        hint = "\(c)×\(r) · \(pieces.count) 块，开始吧"
    }

    func requestSave(saves: PuzzleSaveStore) {
        guard !board.pieces.isEmpty else {
            hint = "拼盘为空，无法保存"
            return
        }
        if activeSaveID != nil, let title = activeSaveTitle {
            performSave(title: title, saves: saves)
        } else {
            saveName = ""
            showSaveName = true
        }
    }

    func saveNamed(saves: PuzzleSaveStore) {
        let title = saveName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty else { return }
        showSaveName = false
        performSave(title: title, saves: saves)
    }

    private func performSave(title: String, saves: PuzzleSaveStore) {
        guard let key = activePuzzleKey else { return }
        switch saves.save(
            title: title,
            puzzleKey: key,
            sourceImage: sourceImage,
            board: board,
            existingID: activeSaveID,
            isPro: pro?.isPro ?? false
        ) {
        case let .saved(id, created):
            activeSaveID = id
            activeSaveTitle = title
            hint = created ? "已保存「\(title)」" : "已更新「\(title)」"
        case .limitReached:
            hint = "存档数量已达上限，请升级 Pro"
        case .failed:
            hint = "保存失败，请稍后重试"
        }
    }

    nonisolated private static func puzzleKey(image: UIImage, cols: Int, rows: Int, crop: CropView) -> String {
        // 存档标识不需要编码整张相机原图；缩略图足以区分用户选中的照片，
        // 也避免切图完成后再次处理几百万像素图片。
        let thumb = image.preparingThumbnail(of: CGSize(width: 128, height: 128)) ?? image
        let data = thumb.jpegData(compressionQuality: 0.35) ?? Data()
        let digest = SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
        return "\(digest)|\(cols)x\(rows)|\(crop.cx)|\(crop.cy)|\(crop.zoom)"
    }

    func loadPickedPhoto() async {
        guard let pickerItem else { return }
        defer { self.pickerItem = nil }
        guard let data = try? await pickerItem.loadTransferable(type: Data.self),
              let image = UIImage(data: data) else {
            hint = "无法读取照片"
            return
        }
        let suggested = PuzzleCutEngine.suggestGrid(
            imageWidth: Int(image.size.width),
            imageHeight: Int(image.size.height),
            preferTotal: min(24, maxPieces)
        )
        cropDraftImage = image
        cropInitialCols = suggested.cols
        cropInitialRows = suggested.rows
        cropInitialCrop = CropView()
        cropApplyTitle = "开始拼图"
        showCropSheet = true
    }

    func applyCrop(image: UIImage, cols: Int, rows: Int, crop: CropView) {
        startNew(image: image, cols: cols, rows: rows, crop: crop)
    }

    func selectPiece(_ id: Int) {
        guard let piece = board.pieces.first(where: { $0.id == id }), !piece.isPlaced else { return }
        withAnimation(.spring(response: 0.2, dampingFraction: 0.78)) {
            board.selectedId = id
            refreshHintHighlight()
        }
    }

    func tapSlot(_ slot: Int) {
        guard let sid = board.selectedId,
              let idx = board.pieces.firstIndex(where: { $0.id == sid }) else { return }
        if board.occupant(of: slot) != nil {
            shakeBoard()
            return
        }
        guard let home = board.pieceAtSlot(slot) else { return }
        let piece = board.pieces[idx]
        // 与 H5 一致：任意朝向能对上形状就收下，飞入时自动转正
        guard let rot = matchRotation(piece: piece, slotTabs: home.tabs) else {
            shakeBoard()
            return
        }
        let cur = piece.rotation
        let delta = (rot - cur + 4) % 4
        withAnimation(.spring(response: 0.32, dampingFraction: 0.78)) {
            board.pieces[idx].rotationSteps += delta
            board.pieces[idx].placedSlot = slot
            board.selectedId = nil
        }
        refreshHintHighlight()
        let n = board.placedCount
        if n == board.total {
            let perfect = board.pieces.allSatisfy(\.placedCorrectly)
            hint = perfect ? "太棒了，拼图完成！" : "都放上了，但有几块位置不对"
            celebrationToken += 1
        }
    }

    /// 优先当前朝向，其次转得最少的那个；都不吻合返回 nil
    private func matchRotation(piece: PuzzlePieceModel, slotTabs: PieceTabs) -> Int? {
        let cur = piece.rotation
        let slotKey = JigsawGeometry.shapeKey(slotTabs)
        for d in [0, 1, 3, 2] {
            let k = (cur + d) % 4
            if JigsawGeometry.shapeKey(JigsawGeometry.rotateTabs(piece.tabs, turns: k)) == slotKey {
                return k
            }
        }
        return nil
    }

    func rotateSelected() {
        guard let sid = board.selectedId,
              let idx = board.pieces.firstIndex(where: { $0.id == sid }) else { return }
        // 只增不取模，动画连续转；逻辑朝向用 rotationSteps % 4
        withAnimation(.easeInOut(duration: 0.16)) {
            board.pieces[idx].rotationSteps += 1
        }
        refreshHintHighlight()
    }

    func toggleHint() {
        if !(pro?.isPro ?? false) {
            _ = pro?.require(.unlimitedHints)
            if !(pro?.isPro ?? false) { return }
        }
        hintOn.toggle()
        UserDefaults.standard.set(hintOn, forKey: "pandaPuzzle.hintOn")
        refreshHintHighlight()
        if hintOn {
            hint = board.selectedId == nil ? "先选一块拼块，再看提示格" : "已显示正确格位"
        } else {
            hint = "提示已关闭"
        }
    }

    func toggleTrayMode() {
        // 不走 spring：整盘缩略图重建时动画会卡
        var t = Transaction()
        t.disablesAnimations = true
        withTransaction(t) {
            board.trayMode = board.trayMode == .list ? .stack : .list
            if board.trayMode == .stack {
                board.traySeed = Int.random(in: 0..<100_000)
            }
            UserDefaults.standard.set(board.trayMode.rawValue, forKey: "pandaPuzzle.trayMode")
        }
    }

    func requestRestart() {
        if board.placedCount > 0 {
            showRestartConfirm = true
        } else {
            restartConfirmed()
        }
    }

    func restartConfirmed() {
        showRestartConfirm = false
        startNew(image: sourceImage, cols: board.cols, rows: board.rows, crop: board.crop)
    }

    func scatter() {
        let ids = board.pieces.filter { !$0.isPlaced }.map(\.id)
        guard !ids.isEmpty else { return }
        let order = ids.shuffled()
        withAnimation(.spring(response: 0.4, dampingFraction: 0.82)) {
            board.traySeed = Int.random(in: 0..<100_000)
            for idx in board.pieces.indices where !board.pieces[idx].isPlaced {
                if let i = order.firstIndex(of: board.pieces[idx].id) {
                    board.pieces[idx].trayOrder = i
                }
            }
        }
    }

    func solveAll() {
        var transaction = Transaction()
        transaction.disablesAnimations = true
        withTransaction(transaction) {
            for idx in board.pieces.indices {
                board.pieces[idx].placedSlot = board.pieces[idx].correctSlot
                board.pieces[idx].rotationSteps = 0
            }
            board.selectedId = nil
        }
        hintOn = false
        UserDefaults.standard.set(false, forKey: "pandaPuzzle.hintOn")
        celebrationToken += 1
        refreshHintHighlight()
        hint = "已揭晓完整画面"
    }

    private func shakeBoard() {
        board.shakeTick += 1
        let gen = UINotificationFeedbackGenerator()
        gen.notificationOccurred(.error)
    }

    private func refreshHintHighlight() {
        guard hintOn, let sid = board.selectedId,
              let idx = board.pieces.firstIndex(where: { $0.id == sid }),
              !board.pieces[idx].isPlaced else {
            board.hintSlot = nil
            return
        }
        let piece = board.pieces[idx]
        board.hintSlot = piece.correctSlot
        // 与 H5 一致：开提示时把选中块转到能放进正解槽的朝向
        guard let home = board.pieceAtSlot(piece.correctSlot),
              let rot = matchRotation(piece: piece, slotTabs: home.tabs) else { return }
        let delta = (rot - piece.rotation + 4) % 4
        if delta != 0 {
            withAnimation(.easeInOut(duration: 0.16)) {
                board.pieces[idx].rotationSteps += delta
            }
        }
    }
}
