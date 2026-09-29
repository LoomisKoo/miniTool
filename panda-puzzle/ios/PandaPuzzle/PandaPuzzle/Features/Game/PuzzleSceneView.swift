import SceneKit
import SwiftUI

struct PuzzleSceneView: UIViewRepresentable {
    let controller: PuzzleSceneController
    let board: PuzzleBoardState
    let sourceImage: UIImage
    var onTap: (_ slot: Int?, _ pieceId: Int?) -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(controller: controller, onTap: onTap)
    }

    func makeUIView(context: Context) -> SCNView {
        let view = SCNView()
        view.scene = controller.scene
        // 背景是纯色，用不透明图层省掉每帧与下层的 alpha 合成
        view.backgroundColor = UIColor(PandaTheme.canvas)
        view.isOpaque = true
        view.antialiasingMode = .none
        view.contentScaleFactor = min(2, UIScreen.main.scale)
        // 固定 90° 俯视；平移/缩放用手势，不用系统自由相机
        view.allowsCameraControl = false
        view.pointOfView = controller.cameraNode
        view.delegate = context.coordinator
        view.rendersContinuously = false
        view.preferredFramesPerSecond = UIScreen.main.maximumFramesPerSecond
        view.isPlaying = true

        let tap = UITapGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.tapped(_:)))
        let pan = UIPanGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.panned(_:)))
        pan.maximumNumberOfTouches = 1
        let pinch = UIPinchGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.pinched(_:)))
        let doubleTap = UITapGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.doubleTapped(_:)))
        doubleTap.numberOfTapsRequired = 2
        tap.require(toFail: doubleTap)

        view.addGestureRecognizer(tap)
        view.addGestureRecognizer(pan)
        view.addGestureRecognizer(pinch)
        view.addGestureRecognizer(doubleTap)

        context.coordinator.view = view
        context.coordinator.lastGeometry = board.geometrySignature
        context.coordinator.lastSelection = board.selectionSignature
        controller.sync(board: board, sourceImage: sourceImage, animatePlace: false)
        return view
    }

    func updateUIView(_ uiView: SCNView, context: Context) {
        context.coordinator.onTap = onTap
        let geo = board.geometrySignature
        let sel = board.selectionSignature
        if context.coordinator.lastGeometry != geo {
            context.coordinator.lastGeometry = geo
            context.coordinator.lastSelection = sel
            controller.sync(board: board, sourceImage: sourceImage, animatePlace: true)
            return
        }
        if context.coordinator.lastSelection != sel {
            context.coordinator.lastSelection = sel
            controller.updateHighlights(board: board)
            uiView.setNeedsDisplay()
        }
    }

    final class Coordinator: NSObject, SCNSceneRendererDelegate {
        let controller: PuzzleSceneController
        let cameraTarget: CameraTarget
        var onTap: (_ slot: Int?, _ pieceId: Int?) -> Void
        weak var view: SCNView?
        var lastGeometry: String?
        var lastSelection: String?
        private var isDraggingBoard = false
        private var lastPinchScale: CGFloat = 1

        init(controller: PuzzleSceneController, onTap: @escaping (_ slot: Int?, _ pieceId: Int?) -> Void) {
            self.controller = controller
            self.cameraTarget = controller.cameraTarget
            self.onTap = onTap
        }

        func renderer(_ renderer: SCNSceneRenderer, updateAtTime time: TimeInterval) {
            guard let target = cameraTarget.take(), let pov = renderer.pointOfView else { return }
            SCNTransaction.begin()
            SCNTransaction.disableActions = true
            pov.simdPosition = target.position
            pov.camera?.orthographicScale = target.orthoScale
            SCNTransaction.commit()
        }

        @MainActor @objc func tapped(_ gr: UITapGestureRecognizer) {
            guard !isDraggingBoard, let view else { return }
            let p = gr.location(in: view)
            let hit = controller.hitTest(at: p, in: view)
            if let piece = hit.pieceId {
                onTap(nil, piece)
            } else if let slot = hit.slot {
                onTap(slot, nil)
            }
        }

        @MainActor @objc func doubleTapped(_ gr: UITapGestureRecognizer) {
            controller.resetCamera()
            view?.setNeedsDisplay()
        }

        @MainActor @objc func panned(_ gr: UIPanGestureRecognizer) {
            guard let view else { return }
            switch gr.state {
            case .began:
                // 系统 pan 已有启动阈值，这里不再叠加，否则起手发黏且会跳一下
                isDraggingBoard = true
                view.rendersContinuously = true
                gr.setTranslation(.zero, in: view)
            case .changed:
                let t = gr.translation(in: view)
                controller.panBy(screenDelta: t, viewSize: view.bounds.size)
                gr.setTranslation(.zero, in: view)
            case .ended, .cancelled, .failed:
                isDraggingBoard = false
                view.rendersContinuously = false
                view.setNeedsDisplay()
            default:
                break
            }
        }

        @MainActor @objc func pinched(_ gr: UIPinchGestureRecognizer) {
            guard let view else { return }
            switch gr.state {
            case .began:
                lastPinchScale = gr.scale
                view.rendersContinuously = true
            case .changed:
                let factor = Float(gr.scale / max(lastPinchScale, 0.001))
                lastPinchScale = gr.scale
                controller.multiplyZoom(factor)
            default:
                lastPinchScale = 1
                view.rendersContinuously = false
                view.setNeedsDisplay()
            }
        }
    }
}
