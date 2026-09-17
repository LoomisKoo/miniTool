import CoreGraphics
import Observation
import SwiftUI
import UIKit

/// 裁图工作台状态。与 H5 的 `state` 一一对应。
@Observable
final class CropEditorModel {

    /// 缩放范围：1 = 图片刚好盖满裁切框（框内不留白），上限放大 6 倍。
    static let maxZoom: CGFloat = CropGeometry.maxZoom

    // MARK: - 源图

    private(set) var image: CGImage?
    private(set) var displayImage: UIImage?
    private(set) var imagePixelSize: CGSize = .zero

    var hasImage: Bool { image != nil }

    // MARK: - 参数

    var ratioId = "1:1"
    var shapeId = CropShape.rect.rawValue
    var gridId = "1"
    var lineColorId = "white"
    var radiusPercent: CGFloat = 20

    var ratio: CropRatio { CropRatio.find(ratioId) }
    var shape: CropShape { CropShape(rawValue: shapeId) ?? .rect }
    var grid: CropGrid { CropGrid.find(gridId) }
    var lineColor: GridLineColor { GridLineColor.find(lineColorId) }

    // MARK: - 相机

    var zoom: CGFloat = 1
    var offset: CGPoint = .zero
    var quarterTurns = 0
    var flipX = false

    // MARK: - 视口

    var viewportSize: CGSize = .zero

    // MARK: - 结果 / 提示

    private(set) var results: [CropRenderer.Output] = []
    var toast: String?
    var isWorking = false

    @ObservationIgnored private var flashTask: Task<Void, Never>?

    /// 当前几何（每次读取重算，开销很小）。
    var geometry: CropGeometry {
        CropGeometry(
            viewportSize: viewportSize,
            imagePixelSize: imagePixelSize,
            ratioId: ratioId,
            zoom: zoom,
            offset: offset,
            quarterTurns: quarterTurns,
            flipX: flipX
        )
    }

    /// 缩放下限：1 = 图片刚好盖满裁切框。
    static let minZoom: CGFloat = 1

    // MARK: - 载入

    func load(data: Data) throws {
        let cg = try ImageImport.cgImage(from: data)
        image = cg
        displayImage = UIImage(cgImage: cg)
        imagePixelSize = CGSize(width: cg.width, height: cg.height)
        resetCamera()
        results = []
    }

    func clear() {
        image = nil
        displayImage = nil
        imagePixelSize = .zero
        viewportSize = .zero
        results = []
        resetCamera()
    }

    // MARK: - 相机操作

    /// 把相机写入并夹紧（图片必须始终覆盖裁切框）。
    private func applyCamera(zoom newZoom: CGFloat, offset newOffset: CGPoint) {
        let probe = CropGeometry(
            viewportSize: viewportSize,
            imagePixelSize: imagePixelSize,
            ratioId: ratioId,
            zoom: newZoom,
            offset: newOffset,
            quarterTurns: quarterTurns,
            flipX: flipX
        )
        zoom = probe.zoom
        offset = probe.offset
    }

    func setOffset(_ value: CGPoint) {
        applyCamera(zoom: zoom, offset: value)
    }

    func setZoom(_ value: CGFloat) {
        applyCamera(zoom: value, offset: offset)
    }

    /// 捏合缩放：以捏合中心为锚点，避免内容往正中收。
    func magnify(to newZoom: CGFloat, anchorInViewport anchor: CGPoint) {
        let old = max(zoom, 0.0001)
        let target = min(max(newZoom, Self.minZoom), Self.maxZoom)
        let center = CGPoint(x: viewportSize.width / 2, y: viewportSize.height / 2)
        let a = CGPoint(x: anchor.x - center.x, y: anchor.y - center.y)
        let k = target / old
        let newOffset = CGPoint(
            x: a.x - (a.x - offset.x) * k,
            y: a.y - (a.y - offset.y) * k
        )
        applyCamera(zoom: target, offset: newOffset)
    }

    func updateViewport(_ size: CGSize) {
        guard size.width > 1, size.height > 1, size != viewportSize else { return }
        viewportSize = size
        applyCamera(zoom: zoom, offset: offset)
    }

    func resetCamera() {
        zoom = 1
        offset = .zero
        quarterTurns = 0
        flipX = false
        applyCamera(zoom: zoom, offset: offset)
    }

    func rotateClockwise() {
        quarterTurns = (quarterTurns + 1) % 4
        applyCamera(zoom: zoom, offset: offset)
    }

    func toggleFlip() {
        flipX.toggle()
        applyCamera(zoom: zoom, offset: offset)
    }

    /// 换比例：H5 的做法是裁切框重新居中，相机回到最小缩放。
    func selectRatio(_ id: String) {
        guard id != ratioId else { return }
        ratioId = id
        zoom = 1
        offset = .zero
        applyCamera(zoom: zoom, offset: offset)
    }

    func selectShape(_ id: String) {
        shapeId = id
        if id != CropShape.rect.rawValue, grid.cellCount > 1 {
            // 形状蒙版只作用于单图，换成形状时退回单图，避免"设了圆形却看不到圆"。
            gridId = "1"
            flash("圆形/圆角只作用于单图，已切回单图")
        }
    }

    func selectGrid(_ id: String) {
        gridId = id
        if !grid.isSingle, shape.keepsAlpha {
            shapeId = CropShape.rect.rawValue
            flash("宫格按直角切分，已切回直角")
        }
    }

    // MARK: - 导出

    /// 烘焙成品（宫格会切成多张）。结果同时写入 `results` 供结果页使用。
    @discardableResult
    func makeOutputs() -> [CropRenderer.Output] {
        guard let image else { return [] }
        let outputs = CropRenderer.render(
            image: image,
            geometry: geometry,
            grid: grid,
            shape: shape,
            radiusPercent: radiusPercent
        )
        results = outputs
        return outputs
    }

    func clearResults() {
        results = []
    }

    // MARK: - 提示

    func flash(_ message: String) {
        withAnimation(.easeOut(duration: 0.2)) { toast = message }
        flashTask?.cancel()
        flashTask = Task { @MainActor [weak self] in
            try? await Task.sleep(nanoseconds: 2_000_000_000)
            guard !Task.isCancelled else { return }
            withAnimation(.easeIn(duration: 0.2)) { self?.toast = nil }
        }
    }
}
