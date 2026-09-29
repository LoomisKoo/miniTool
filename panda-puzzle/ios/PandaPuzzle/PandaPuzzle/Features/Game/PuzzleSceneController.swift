import SceneKit
import UIKit

/// 手势在主线程写入，渲染线程每帧渲染前读取，避免相机更新和帧不同步
final class CameraTarget: @unchecked Sendable {
    private let lock = NSLock()
    private var position = SIMD3<Float>(0, 20, 0)
    private var orthoScale: Double = 4
    private var dirty = false

    func set(position: SIMD3<Float>, orthoScale: Double) {
        lock.lock()
        self.position = position
        self.orthoScale = orthoScale
        dirty = true
        lock.unlock()
    }

    func discard() {
        lock.lock()
        dirty = false
        lock.unlock()
    }

    func take() -> (position: SIMD3<Float>, orthoScale: Double)? {
        lock.lock()
        defer { lock.unlock() }
        guard dirty else { return nil }
        dirty = false
        return (position, orthoScale)
    }
}

@MainActor
final class PuzzleSceneController: NSObject {
    let scene = SCNScene()
    let cameraNode = SCNNode()
    nonisolated let cameraTarget = CameraTarget()
    private let boardNode = SCNNode()
    private let piecesRoot = SCNNode()
    private var pieceNodes: [Int: SCNNode] = [:]
    private var topMat: SCNMaterial?
    private var cachedBoardPieces: [PuzzlePieceModel] = []
    private var cachedCols = 0
    private var cachedRows = 0
    private var hitTestCols = 0
    private var hitTestRows = 0
    private var boardLayoutKey: String?
    private var hasCelebrated = false
    private var pieceBuildGeneration = 0
    private var pieceBuildQueued = false
    private var revealNode: SCNNode?

    private let cellSize: Float = 1.0
    private let thickness: CGFloat = 0.06

    /// 俯视平移 / 缩放（仍锁定 90°）
    private var panX: Float = 0
    private var panZ: Float = 0
    private var viewZoom: Float = 1
    private var fitOrthoScale: Float = 4

    override init() {
        super.init()
        setupLights()
        scene.rootNode.addChildNode(boardNode)
        scene.rootNode.addChildNode(piecesRoot)
        let cam = SCNCamera()
        cam.usesOrthographicProjection = true
        cam.orthographicScale = 4
        cam.zNear = 0.1
        cam.zFar = 100
        cameraNode.camera = cam
        scene.rootNode.addChildNode(cameraNode)
    }

    func sync(board: PuzzleBoardState, sourceImage: UIImage, animatePlace: Bool = true) {
        let cols = board.cols
        let rows = board.rows
        let layoutKey = board.pieces.map {
            "\($0.id):\($0.tabs.top),\($0.tabs.right),\($0.tabs.bottom),\($0.tabs.left)"
        }.joined(separator: "|") + "|\(cols)x\(rows)"

        if boardLayoutKey != layoutKey {
            pieceBuildGeneration += 1
            pieceBuildQueued = false
            rebuildBoard(board: board)
            boardLayoutKey = layoutKey
            hasCelebrated = false
            fitCamera(cols: cols, rows: rows)
            pieceNodes.values.forEach { $0.removeFromParentNode() }
            pieceNodes.removeAll()
        }

        let w = Float(cols) * cellSize
        let h = Float(rows) * cellSize
        let ox = -w / 2 + cellSize / 2
        let oz = -h / 2 + cellSize / 2
        let hw = CGFloat(cellSize) * 0.5

        // 揭晓不需要把每个拼块重新做成 SCNShape。
        // 一张完整图片只需一个平面，避免一次生成几十个几何体和遮罩纹理。
        if board.placedCount == board.total {
            pieceBuildGeneration += 1
            pieceBuildQueued = false
            pieceNodes.values.forEach { $0.removeFromParentNode() }
            pieceNodes.removeAll()
            revealNode?.removeFromParentNode()
            let node = makeRevealNode(
                image: sourceImage,
                pieces: board.pieces,
                cols: cols,
                rows: rows,
                width: w,
                height: h
            )
            piecesRoot.addChildNode(node)
            revealNode = node
            node.opacity = 0
            node.runAction(.fadeIn(duration: 0.28))
            updateSlotHighlights(board: board)
            highlightSelection(board: board)
            hasCelebrated = true
            return
        }

        revealNode?.removeFromParentNode()
        revealNode = nil

        let placedIds = Set(board.pieces.filter(\.isPlaced).map(\.id))
        let newPlacedCount = board.pieces.filter { $0.isPlaced && pieceNodes[$0.id] == nil }.count
        let shouldAnimatePlace = animatePlace && newPlacedCount <= 10
        for (id, node) in pieceNodes where !placedIds.contains(id) {
            node.removeFromParentNode()
            pieceNodes.removeValue(forKey: id)
        }

        // 揭晓时可能一次新增几十个拼块。每帧只创建少量 SceneKit 节点，
        // 把 SCNShape/纹理生成的开销摊开，避免点击后主线程长时间阻塞。
        let maxNodes = shouldAnimatePlace ? Int.max : 4
        var createdNodes = 0
        for piece in board.pieces where piece.isPlaced {
            if pieceNodes[piece.id] != nil { continue }
            if createdNodes >= maxNodes { break }
            guard let slot = piece.placedSlot else { continue }
            let r = slot / cols
            let c = slot % cols
            let node = makePieceNode(piece: piece, hw: hw, cols: cols, rows: rows)
            let target = SCNVector3(
                ox + Float(c) * cellSize,
                Float(thickness) / 2 + 0.008,
                oz + Float(r) * cellSize
            )
            if shouldAnimatePlace {
                node.position = SCNVector3(target.x + 0.08, target.y + 0.35, target.z - 0.05)
                node.opacity = 0.15
                piecesRoot.addChildNode(node)
                pieceNodes[piece.id] = node
                let move = SCNAction.move(to: target, duration: 0.28)
                move.timingMode = .easeOut
                node.runAction(.group([move, .fadeIn(duration: 0.14)]))
            } else {
                node.position = target
                piecesRoot.addChildNode(node)
                pieceNodes[piece.id] = node
            }
            createdNodes += 1
        }

        if pieceNodes.count < placedIds.count, !pieceBuildQueued {
            pieceBuildQueued = true
            let generation = pieceBuildGeneration
            DispatchQueue.main.async { [weak self] in
                guard let self, self.pieceBuildGeneration == generation else { return }
                self.pieceBuildQueued = false
                self.sync(board: board, sourceImage: sourceImage, animatePlace: false)
            }
        }

        updateSlotHighlights(board: board)
        highlightSelection(board: board)
        if board.placedCount < board.total {
            hasCelebrated = false
        }
    }

    private func makeRevealNode(
        image: UIImage,
        pieces: [PuzzlePieceModel],
        cols: Int,
        rows: Int,
        width: Float,
        height: Float
    ) -> SCNNode {
        let plane = SCNPlane(width: CGFloat(width), height: CGFloat(height))
        let material = SCNMaterial()
        material.diffuse.contents = image
        material.lightingModel = .constant
        material.isDoubleSided = false
        plane.materials = [material]

        let node = SCNNode(geometry: plane)
        node.eulerAngles.x = -Float.pi / 2
        node.position = SCNVector3(0, Float(thickness) / 2 + 0.012, 0)
        node.renderingOrder = 30

        // 完整图只负责显示照片，另外叠一层透明缝线，保留拼接完成后的纹路。
        let seamImage = Self.bakeInterlockingBoard(
            pieces: pieces,
            cols: cols,
            rows: rows,
            includeFill: false
        )
        let seamPlane = SCNPlane(width: CGFloat(width), height: CGFloat(height))
        let seamMaterial = SCNMaterial()
        seamMaterial.diffuse.contents = seamImage
        seamMaterial.transparent.contents = seamImage
        seamMaterial.lightingModel = .constant
        seamMaterial.isDoubleSided = false
        seamMaterial.blendMode = .alpha
        seamPlane.materials = [seamMaterial]
        let seamNode = SCNNode(geometry: seamPlane)
        // 节点已在父节点内，沿本地 Z 才是离开图片表面的方向；
        // 沿 Y 会把缝线平移到图片外，导致看起来像没有纹路。
        seamNode.position = SCNVector3(0, 0, 0.002)
        seamNode.renderingOrder = 100
        seamMaterial.writesToDepthBuffer = false
        node.addChildNode(seamNode)
        return node
    }

    func updateHighlights(board: PuzzleBoardState) {
        updateSlotHighlights(board: board)
        highlightSelection(board: board)
    }

    func highlightSelection(board: PuzzleBoardState) {
        SCNTransaction.begin()
        SCNTransaction.animationDuration = 0.16
        SCNTransaction.animationTimingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
        for node in pieceNodes.values {
            clearEmission(on: node)
        }
        if let sid = board.selectedId, let node = pieceNodes[sid] {
            setEmission(on: node, color: UIColor(red: 1, green: 0.71, blue: 0.28, alpha: 0.35))
        }
        SCNTransaction.commit()
    }

    private func clearEmission(on node: SCNNode) {
        node.geometry?.firstMaterial?.emission.contents = UIColor.black
        for child in node.childNodes { clearEmission(on: child) }
    }

    private func setEmission(on node: SCNNode, color: UIColor) {
        if node.name?.hasPrefix("pieceLid:") == true || node.name?.hasPrefix("pieceBody:") == true {
            node.geometry?.firstMaterial?.emission.contents = color
        }
        for child in node.childNodes { setEmission(on: child, color: color) }
    }

    func hitTest(at point: CGPoint, in view: SCNView) -> (slot: Int?, pieceId: Int?) {
        let hits = view.hitTest(point, options: [
            SCNHitTestOption.searchMode: SCNHitTestSearchMode.all.rawValue,
            SCNHitTestOption.ignoreHiddenNodes: NSNumber(value: false),
        ])
        if hitTestCols > 0, let boardHit = hits.first(where: {
            var node: SCNNode? = $0.node
            while let n = node {
                if n.name == "boardTop" { return true }
                node = n.parent
            }
            return false
        }) {
            let world = boardHit.worldCoordinates
            let ox = -Float(hitTestCols) * cellSize / 2 + cellSize / 2
            let oz = -Float(hitTestRows) * cellSize / 2 + cellSize / 2
            let col = Int(floor((world.x - ox) / cellSize + 0.5))
            let row = Int(floor((world.z - oz) / cellSize + 0.5))
            if (0..<hitTestCols).contains(col), (0..<hitTestRows).contains(row) {
                return (row * hitTestCols + col, nil)
            }
        }
        return (nil, nil)
    }

    // MARK: - Board

    private func rebuildBoard(board: PuzzleBoardState) {
        boardNode.childNodes.forEach { $0.removeFromParentNode() }
        topMat = nil

        let cols = board.cols
        let rows = board.rows
        cachedBoardPieces = board.pieces
        cachedCols = cols
        cachedRows = rows
        hitTestCols = cols
        hitTestRows = rows
        let w = Float(cols) * cellSize
        let h = Float(rows) * cellSize
        // 底板与拼面齐平，避免拼好后上下露出一圈米色白边
        let rim: Float = 0.02

        let base = SCNBox(
            width: CGFloat(w + rim),
            height: CGFloat(thickness),
            length: CGFloat(h + rim),
            chamferRadius: min(CGFloat(w + rim), CGFloat(h + rim)) * 0.02
        )
        let face = SCNMaterial()
        face.diffuse.contents = UIColor(red: 0.925, green: 0.898, blue: 0.847, alpha: 1)
        face.lightingModel = .constant
        let side = SCNMaterial()
        side.diffuse.contents = UIColor(red: 0.55, green: 0.48, blue: 0.40, alpha: 1)
        side.lightingModel = .constant
        base.materials = [side, side, side, side, face, side]
        let baseNode = SCNNode(geometry: base)
        baseNode.position = SCNVector3(0, -Float(thickness) / 2, 0)
        boardNode.addChildNode(baseNode)

        // 顶面贴图：互相咬合的孔位+缝线（提示直接画进这张图，最稳）
        let boardImg = Self.bakeInterlockingBoard(
            pieces: board.pieces,
            cols: cols,
            rows: rows,
            hintSlot: board.hintSlot
        )
        let topPlane = SCNPlane(width: CGFloat(w), height: CGFloat(h))
        let mat = SCNMaterial()
        mat.diffuse.contents = boardImg
        mat.diffuse.mipFilter = .linear
        mat.lightingModel = .constant
        mat.isDoubleSided = false
        topPlane.materials = [mat]
        topMat = mat
        let topNode = SCNNode(geometry: topPlane)
        topNode.eulerAngles.x = -Float.pi / 2
        topNode.position = SCNVector3(0, 0.001, 0)
        topNode.renderingOrder = 0
        topNode.name = "boardTop"
        boardNode.addChildNode(topNode)
        // 格位点选统一用 boardTop 坐标计算，不建透明热区节点：
        // 它们肉眼不可见，但每帧都要逐个排序、绘制、混合，拖动会掉帧。
    }

    private func updateSlotHighlights(board: PuzzleBoardState) {
        // 提示画进顶面烘焙图，方向与分割线天然一致
        guard let topMat,
              cachedCols > 0,
              cachedRows > 0,
              !cachedBoardPieces.isEmpty
        else { return }
        let img = Self.bakeInterlockingBoard(
            pieces: cachedBoardPieces,
            cols: cachedCols,
            rows: cachedRows,
            hintSlot: board.hintSlot.flatMap { slot in
                board.occupant(of: slot) == nil ? slot : nil
            }
        )
        topMat.diffuse.contents = img
    }

    private func makePieceNode(piece: PuzzlePieceModel, hw: CGFloat, cols: Int, rows: Int) -> SCNNode {
        let samples = boardKnobSamples(total: cols * rows)
        let bodyPath = JigsawGeometry.piecePathForBoard(hw: hw, tabs: piece.tabs, knobSamples: samples)

        // 纸板本体：纯色挤出
        let bodyShape = SCNShape(path: bodyPath, extrusionDepth: thickness)
        bodyShape.chamferRadius = min(0.01, thickness * 0.16)
        // 固定俯视只看得到正面倒角
        bodyShape.chamferMode = .front
        let core = SCNMaterial()
        core.diffuse.contents = UIColor(red: 0.82, green: 0.76, blue: 0.68, alpha: 1)
        core.lightingModel = .blinn
        core.specular.contents = UIColor(white: 0.1, alpha: 1)
        bodyShape.materials = [core]
        let body = SCNNode(geometry: bodyShape)
        body.name = "pieceBody:\(piece.id)"

        // 印刷面：异形贴图里已带细刀缝（深紫半透明），不再叠白色粗线
        let lidImg = Self.maskedPieceImage(piece)
        let span = CGFloat(cellSize) * CGFloat(piece.cellPx + piece.padPx * 2) / CGFloat(max(1, piece.cellPx))
        let lidPlane = SCNPlane(width: span, height: span)
        let lidMat = SCNMaterial()
        lidMat.diffuse.contents = lidImg
        lidMat.transparent.contents = lidImg
        lidMat.diffuse.mipFilter = .linear
        lidMat.transparent.mipFilter = .linear
        lidMat.lightingModel = .constant
        lidMat.isDoubleSided = false
        lidMat.writesToDepthBuffer = true
        lidMat.blendMode = .alpha
        lidMat.transparencyMode = .aOne
        lidPlane.materials = [lidMat]
        let lid = SCNNode(geometry: lidPlane)
        lid.name = "pieceLid:\(piece.id)"
        lid.position = SCNVector3(0, 0, Float(thickness) / 2 + 0.001)
        lid.renderingOrder = 12 + piece.id

        let node = SCNNode()
        node.name = "piece:\(piece.id)"
        node.addChildNode(body)
        node.addChildNode(lid)

        let yaw = Float(piece.rotation) * (-Float.pi / 2)
        var m = SCNMatrix4MakeRotation(-Float.pi / 2, 1, 0, 0)
        m = SCNMatrix4Mult(SCNMatrix4MakeRotation(yaw, 0, 1, 0), m)
        node.transform = m
        // 略撑满格，盖住孔位边缘，避免露底白边
        node.scale = SCNVector3(1.008, 1, 1.008)
        node.castsShadow = false
        node.renderingOrder = 10 + piece.id
        return node
    }

    private func playCompletionConfetti() {
        let colors: [UIColor] = [
            UIColor(red: 1.0, green: 0.36, blue: 0.48, alpha: 1),
            UIColor(red: 1.0, green: 0.72, blue: 0.22, alpha: 1),
            UIColor(red: 0.35, green: 0.78, blue: 0.72, alpha: 1),
            UIColor(red: 0.48, green: 0.56, blue: 0.95, alpha: 1),
            UIColor(red: 0.82, green: 0.48, blue: 0.88, alpha: 1)
        ]
        let boardWidth = CGFloat(cachedCols) * CGFloat(cellSize)
        let boardHeight = CGFloat(cachedRows) * CGFloat(cellSize)
        let confetti = SCNNode()
        confetti.renderingOrder = 1000

        for side in [-1.0, 1.0] {
            let sideNode = SCNNode()
            sideNode.position = SCNVector3(
                Float(side * (boardWidth * 0.5 + 0.08)),
                0.9,
                0
            )
            // 垂直发射面朝向棋盘中心：左右两边向内喷射。
            sideNode.eulerAngles.y = side < 0 ? Float.pi / 2 : -Float.pi / 2
            for color in colors {
                let particles = SCNParticleSystem()
                particles.birthRate = 20
                particles.birthDirection = .surfaceNormal
                particles.emissionDuration = 0.48
                particles.loops = false
                particles.particleLifeSpan = 1.65
                particles.particleLifeSpanVariation = 0.3
                particles.particleVelocity = 3.6
                particles.particleVelocityVariation = 1.0
                particles.acceleration = SCNVector3(0, -3.4, 0)
                particles.particleAngleVariation = .pi
                particles.particleAngularVelocity = 5
                particles.particleAngularVelocityVariation = 3
                particles.particleSize = 0.13
                particles.particleSizeVariation = 0.22
                particles.particleImage = Self.confettiImage()
                particles.particleColor = color
                particles.blendMode = .alpha
                particles.emitterShape = SCNPlane(
                    width: 0.02,
                    height: boardHeight * 0.72
                )
                sideNode.addParticleSystem(particles)
            }
            confetti.addChildNode(sideNode)
        }

        scene.rootNode.addChildNode(confetti)
        confetti.runAction(.sequence([
            .wait(duration: 2.4),
            .removeFromParentNode()
        ]))
    }

    private static func confettiImage() -> UIImage {
        let format = UIGraphicsImageRendererFormat()
        format.scale = 2
        format.opaque = false
        return UIGraphicsImageRenderer(size: CGSize(width: 10, height: 20), format: format).image { ctx in
            UIColor.white.setFill()
            UIBezierPath(
                roundedRect: CGRect(x: 1, y: 1, width: 8, height: 18),
                cornerRadius: 2
            ).fill()
        }
    }

    /// 按异形轮廓裁出印刷贴图，并描一圈细刀缝（深紫 + 内侧微亮），模拟切口凹陷
    private static func maskedPieceImage(_ piece: PuzzlePieceModel) -> UIImage {
        let size = piece.image.size
        let format = UIGraphicsImageRendererFormat()
        format.opaque = false
        format.scale = max(2, piece.image.scale)
        let cell = CGFloat(piece.cellPx)
        let pad = CGFloat(piece.padPx)
        let hw = cell * 0.5
        let path = JigsawGeometry.piecePath(hw: hw, tabs: piece.tabs, knobSamples: 16)
        let inner = JigsawGeometry.piecePath(hw: hw * 0.965, tabs: piece.tabs, knobSamples: 14)
        return UIGraphicsImageRenderer(size: size, format: format).image { ctx in
            let g = ctx.cgContext
            g.clear(CGRect(origin: .zero, size: size))
            g.saveGState()
            g.translateBy(x: pad + hw, y: pad + hw)
            path.addClip()
            g.translateBy(x: -(pad + hw), y: -(pad + hw))
            piece.image.draw(in: CGRect(origin: .zero, size: size))
            g.restoreGState()

            // 刀缝：半透明梅紫细线（对齐 H5 0x5b5470 @ 0.5），不要白色粗边
            g.saveGState()
            g.translateBy(x: pad + hw, y: pad + hw)
            g.setStrokeColor(UIColor(red: 0x3e / 255, green: 0x38 / 255, blue: 0x4f / 255, alpha: 0.74).cgColor)
            g.setLineWidth(max(1.25, cell * 0.016))
            g.setLineJoin(.round)
            g.setShadow(
                offset: CGSize(width: 0, height: 1.6),
                blur: 2.2,
                color: UIColor.black.withAlphaComponent(0.48).cgColor
            )
            g.addPath(path.cgPath)
            g.strokePath()
            g.setShadow(offset: .zero, blur: 0, color: nil)
            UIColor.white.withAlphaComponent(0.42).setStroke()
            inner.lineWidth = max(0.8, cell * 0.007)
            inner.lineJoinStyle = .round
            inner.stroke()
            g.restoreGState()
        }
    }

    private func boardKnobSamples(total: Int) -> Int {
        if total > 400 { return 6 }
        if total > 150 { return 10 }
        if total > 60 { return 14 }
        return 20
    }

    func fitCamera(cols: Int, rows: Int) {
        let w = Float(cols) * cellSize
        let h = Float(rows) * cellSize
        let rim: Float = 0.04
        fitOrthoScale = max(w + rim, h + rim) * 0.5 * 1.04
        panX = 0
        panZ = 0
        viewZoom = 1
        applyCamera()
    }

    func resetCamera() {
        SCNTransaction.begin()
        SCNTransaction.animationDuration = 0.22
        SCNTransaction.animationTimingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
        panX = 0
        panZ = 0
        viewZoom = 1
        applyCamera()
        SCNTransaction.commit()
    }

    /// 屏幕像素位移 → 世界平移（正交俯视）
    func panBy(screenDelta: CGPoint, viewSize: CGSize) {
        guard viewSize.height > 1 else { return }
        let worldPerPt = (2 * fitOrthoScale / max(viewZoom, 0.01)) / Float(viewSize.height)
        panX -= Float(screenDelta.x) * worldPerPt
        panZ -= Float(screenDelta.y) * worldPerPt
        updateCameraFast()
    }

    func multiplyZoom(_ factor: Float) {
        viewZoom = min(3.2, max(0.5, viewZoom * factor))
        updateCameraFast()
    }

    /// 手势高频调用：只记录目标，由渲染线程在下一帧前应用
    private func updateCameraFast() {
        cameraTarget.set(
            position: SIMD3<Float>(panX, 20, panZ),
            orthoScale: Double(fitOrthoScale / max(viewZoom, 0.01))
        )
    }

    private func applyCamera() {
        cameraTarget.discard()
        SCNTransaction.begin()
        SCNTransaction.animationDuration = 0
        SCNTransaction.disableActions = true
        let cam = cameraNode.camera ?? SCNCamera()
        cameraNode.camera = cam
        cam.usesOrthographicProjection = true
        cam.orthographicScale = CGFloat(fitOrthoScale / max(viewZoom, 0.01))
        cam.zNear = 0.1
        cam.zFar = 80
        cameraNode.transform = SCNMatrix4Identity
        cameraNode.position = SCNVector3(panX, 20, panZ)
        cameraNode.eulerAngles = SCNVector3(-Float.pi / 2, 0, 0)
        SCNTransaction.commit()
    }

    private func setupLights() {
        let amb = SCNNode()
        amb.light = SCNLight()
        amb.light?.type = .ambient
        amb.light?.intensity = 620
        amb.light?.color = UIColor(white: 0.96, alpha: 1)
        scene.rootNode.addChildNode(amb)

        // 略侧向平行光：倒角边缘才有明暗，缝看起来像凹进去
        let sun = SCNNode()
        sun.light = SCNLight()
        sun.light?.type = .directional
        sun.light?.intensity = 520
        sun.light?.color = UIColor(red: 1, green: 0.98, blue: 0.94, alpha: 1)
        sun.light?.castsShadow = false
        sun.eulerAngles = SCNVector3(-1.05, 0.45, 0.15)
        scene.rootNode.addChildNode(sun)
    }

    // MARK: - Bake interlocking board (H5)

    /// 在一张图上按真实格距画所有凹凸孔；`hintSlot` 对应孔用实色橙填，提示一定看得见。
    private static func bakeInterlockingBoard(
        pieces: [PuzzlePieceModel],
        cols: Int,
        rows: Int,
        hintSlot: Int? = nil,
        includeFill: Bool = true
    ) -> UIImage {
        // 棋盘只是 SceneKit 的底图，不需要随拼块数量无限放大。
        // 例如 40×40 时仍使用 160px/格，会创建 6400×6400 的位图并造成
        // 很高的内存峰值；限制整张底图最长边，避免大拼图闪退。
        let cellPx = max(32, min(160, 2048 / CGFloat(max(cols, rows))))
        let W = cellPx * CGFloat(cols)
        let H = cellPx * CGFloat(rows)
        let hw = cellPx / 2
        let fill = UIColor(red: 0x9d / 255, green: 0x93 / 255, blue: 0xb0 / 255, alpha: 0.28)
        let hintFill = UIColor(red: 1, green: 0.71, blue: 0.28, alpha: 0.92)
        let seam = UIColor(red: 0xb3 / 255, green: 0xaa / 255, blue: 0xc2 / 255, alpha: 1)
        let creamTop = UIColor(red: 0.984, green: 0.973, blue: 0.949, alpha: 1)
        let creamBot = UIColor(red: 0.925, green: 0.898, blue: 0.847, alpha: 1)

        let rendererFormat = UIGraphicsImageRendererFormat()
        rendererFormat.scale = 1
        rendererFormat.opaque = includeFill
        let renderer = UIGraphicsImageRenderer(
            size: CGSize(width: W, height: H),
            format: rendererFormat
        )
        return renderer.image { ctx in
            let g = ctx.cgContext
            if includeFill {
                let grad = CGGradient(
                    colorsSpace: CGColorSpaceCreateDeviceRGB(),
                    colors: [creamTop.cgColor, creamBot.cgColor] as CFArray,
                    locations: [0, 1]
                )!
                g.drawLinearGradient(grad, start: .zero, end: CGPoint(x: 0, y: H), options: [])
            } else {
                g.clear(CGRect(x: 0, y: 0, width: W, height: H))
            }

            if includeFill {
                for piece in pieces {
                    let cx = (CGFloat(piece.col) + 0.5) * cellPx
                    let cy = (CGFloat(piece.row) + 0.5) * cellPx
                    let path = JigsawGeometry.piecePath(hw: hw, tabs: piece.tabs, knobSamples: 14)
                    g.saveGState()
                    g.translateBy(x: cx, y: cy)
                    if piece.correctSlot == hintSlot {
                        hintFill.setFill()
                    } else {
                        fill.setFill()
                    }
                    path.fill()
                    g.restoreGState()
                }
            }

            for piece in pieces {
                let cx = (CGFloat(piece.col) + 0.5) * cellPx
                let cy = (CGFloat(piece.row) + 0.5) * cellPx
                let path = JigsawGeometry.piecePath(hw: hw, tabs: piece.tabs, knobSamples: 14)
                let inner = JigsawGeometry.piecePath(hw: hw * 0.965, tabs: piece.tabs, knobSamples: 12)
                g.saveGState()
                g.translateBy(x: cx, y: cy)
                if piece.correctSlot == hintSlot {
                    UIColor(red: 0.85, green: 0.48, blue: 0.08, alpha: 1).setStroke()
                    path.lineWidth = 2.4
                } else {
                    seam.setStroke()
                    path.lineWidth = 1.6
                }
                path.lineJoinStyle = .round
                g.setShadow(
                    offset: CGSize(width: 0, height: 1.2),
                    blur: 1.5,
                    color: UIColor.black.withAlphaComponent(0.26).cgColor
                )
                path.stroke()
                g.setShadow(offset: .zero, blur: 0, color: nil)
                UIColor.white.withAlphaComponent(0.42).setStroke()
                inner.lineWidth = 1.1
                inner.lineJoinStyle = .round
                inner.stroke()
                g.restoreGState()
            }
        }
    }
}
