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
        view.backgroundColor = .clear
        view.isOpaque = false
        view.antialiasingMode = .multisampling4X
        // 固定 90° 俯视；平移/缩放用手势，不用系统自由相机
        view.allowsCameraControl = false
        view.pointOfView = controller.cameraNode
        view.rendersContinuously = false
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
            uiView.isPlaying = true
            uiView.setNeedsDisplay()
        }
    }

    final class Coordinator: NSObject {
        let controller: PuzzleSceneController
        var onTap: (_ slot: Int?, _ pieceId: Int?) -> Void
        weak var view: SCNView?
        var lastGeometry: String?
        var lastSelection: String?
        private var isDraggingBoard = false
        private var lastPinchScale: CGFloat = 1

        init(controller: PuzzleSceneController, onTap: @escaping (_ slot: Int?, _ pieceId: Int?) -> Void) {
            self.controller = controller
            self.onTap = onTap
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
                isDraggingBoard = false
            case .changed:
                let t = gr.translation(in: view)
                if !isDraggingBoard, hypot(t.x, t.y) > 10 {
                    isDraggingBoard = true
                }
                guard isDraggingBoard else { return }
                controller.panBy(screenDelta: t, viewSize: view.bounds.size)
                gr.setTranslation(.zero, in: view)
                view.isPlaying = true
                view.setNeedsDisplay()
            case .ended, .cancelled, .failed:
                isDraggingBoard = false
            default:
                break
            }
        }

        @MainActor @objc func pinched(_ gr: UIPinchGestureRecognizer) {
            guard let view else { return }
            switch gr.state {
            case .began:
                lastPinchScale = gr.scale
            case .changed:
                let factor = Float(gr.scale / max(lastPinchScale, 0.001))
                lastPinchScale = gr.scale
                controller.multiplyZoom(factor)
                view.isPlaying = true
                view.setNeedsDisplay()
            default:
                lastPinchScale = 1
            }
        }
    }
}
