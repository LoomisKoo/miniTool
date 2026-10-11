import CoreGraphics
import UIKit

private final class JigsawPathBuilder {
    let path = UIBezierPath()
    var cur = CGPoint.zero
    var moved = false
    let samples: Int
    init(samples: Int) { self.samples = samples }
    func moveTo(_ x: CGFloat, _ y: CGFloat) {
        if !moved {
            path.move(to: CGPoint(x: x, y: -y))
            moved = true
        }
        cur = CGPoint(x: x, y: y)
    }
    func lineTo(_ x: CGFloat, _ y: CGFloat) {
        path.addLine(to: CGPoint(x: x, y: -y))
        cur = CGPoint(x: x, y: y)
    }
    func bezierCurveTo(_ c1x: CGFloat, _ c1y: CGFloat, _ c2x: CGFloat, _ c2y: CGFloat, _ x: CGFloat, _ y: CGFloat) {
        let p0 = cur
        for i in 1...samples {
            let t = CGFloat(i) / CGFloat(samples)
            let m = 1 - t
            let a = m * m * m
            let b = 3 * m * m * t
            let c = 3 * m * t * t
            let d = t * t * t
            let px = a * p0.x + b * c1x + c * c2x + d * x
            let py = a * p0.y + b * c1y + c * c2y + d * y
            lineTo(px, py)
        }
        cur = CGPoint(x: x, y: y)
    }
}

struct PieceTabs: Equatable, Codable {
    var top: Int
    var right: Int
    var bottom: Int
    var left: Int
}

enum JigsawGeometry {
    /// 凹凸部分相对单边长度的比例；比原来的轮廓更宽、更深。
    static let tabRatio: CGFloat = 0.32

    static func buildTabMap(cols: Int, rows: Int) -> (h: [[Int]], v: [[Int]]) {
        var seed = UInt32(cols * 997 + rows * 131 + 42)
        func rand() -> Double {
            seed = seed &* 1_664_525 &+ 1_013_904_223
            return Double(seed) / Double(UInt32.max)
        }
        var h = [[Int]]()
        var v = [[Int]]()
        for r in 0..<rows {
            var row = [Int]()
            for c in 0..<(cols - 1) { row.append(rand() > 0.5 ? 1 : -1) }
            h.append(row)
        }
        for r in 0..<(rows - 1) {
            var row = [Int]()
            for c in 0..<cols { row.append(rand() > 0.5 ? 1 : -1) }
            v.append(row)
        }
        return (h, v)
    }

    static func rotateTabs(_ tabs: PieceTabs, turns: Int) -> PieceTabs {
        var t = tabs
        let n = ((turns % 4) + 4) % 4
        for _ in 0..<n {
            t = PieceTabs(top: t.left, right: t.top, bottom: t.right, left: t.bottom)
        }
        return t
    }

    static func shapeKey(_ tabs: PieceTabs) -> String {
        "\(tabs.top),\(tabs.right),\(tabs.bottom),\(tabs.left)"
    }

    static func tabsFor(r: Int, c: Int, cols: Int, rows: Int, map: (h: [[Int]], v: [[Int]])) -> PieceTabs {
        PieceTabs(
            top: r == 0 ? 0 : -map.v[r - 1][c],
            right: c == cols - 1 ? 0 : map.h[r][c],
            bottom: r == rows - 1 ? 0 : map.v[r][c],
            left: c == 0 ? 0 : -map.h[r][c - 1]
        )
    }

    static func cropRect(iw: Int, ih: Int, cols: Int, rows: Int, view: CropView) -> CGRect {
        let a = CGFloat(cols) / CGFloat(rows)
        let zoom = max(1, view.zoom)
        var w = CGFloat(iw) / CGFloat(ih) > a ? CGFloat(ih) * a : CGFloat(iw)
        var h = w / a
        w /= zoom
        h /= zoom
        let cx = min(max(view.cx * CGFloat(iw), w / 2), CGFloat(iw) - w / 2)
        let cy = min(max(view.cy * CGFloat(ih), h / 2), CGFloat(ih) - h / 2)
        return CGRect(x: cx - w / 2, y: cy - h / 2, width: w, height: h)
    }

    /// 中心原点、y 向上；路径 y 取反以适配 UIBezierPath / 2D 绘制
    static func piecePath(hw: CGFloat, tabs: PieceTabs, knobSamples: Int = 10) -> UIBezierPath {
        let b = JigsawPathBuilder(samples: knobSamples)
        tracePieceEdges(api: b, hw: hw, tabs: tabs)
        b.path.close()
        return b.path
    }

    /// 拼盘 / SceneKit 用：抵消 UIKit 的 Y 翻转，使 top 朝向与烘焙孔位一致（世界 -Z）
    static func piecePathForBoard(hw: CGFloat, tabs: PieceTabs, knobSamples: Int = 10) -> UIBezierPath {
        let path = piecePath(hw: hw, tabs: tabs, knobSamples: knobSamples)
        path.apply(CGAffineTransform(scaleX: 1, y: -1))
        return path
    }

    private static func tracePieceEdges(api: JigsawPathBuilder, hw: CGFloat, tabs: PieceTabs) {
        edgeWithTab(api: api, x0: -hw, y0: hw, x1: hw, y1: hw, dir: tabs.top, first: true)
        edgeWithTab(api: api, x0: hw, y0: hw, x1: hw, y1: -hw, dir: tabs.right, first: false)
        edgeWithTab(api: api, x0: hw, y0: -hw, x1: -hw, y1: -hw, dir: tabs.bottom, first: false)
        edgeWithTab(api: api, x0: -hw, y0: -hw, x1: -hw, y1: hw, dir: tabs.left, first: false)
    }

    private static func edgeWithTab(api: JigsawPathBuilder, x0: CGFloat, y0: CGFloat, x1: CGFloat, y1: CGFloat, dir: Int, first: Bool) {
        if first { api.moveTo(x0, y0) }
        if dir == 0 { api.lineTo(x1, y1) }
        else { appendClassicKnob(api: api, x0: x0, y0: y0, x1: x1, y1: y1, sign: CGFloat(dir)) }
    }

    private static func appendClassicKnob(api: JigsawPathBuilder, x0: CGFloat, y0: CGFloat, x1: CGFloat, y1: CGFloat, sign: CGFloat) {
        let dx = x1 - x0
        let dy = y1 - y0
        let len = hypot(dx, dy)
        let ux = dx / (len == 0 ? 1 : len)
        let uy = dy / (len == 0 ? 1 : len)
        let nx = -uy * sign
        let ny = ux * sign

        func p(_ u: CGFloat, _ n: CGFloat) -> CGPoint {
            CGPoint(x: x0 + ux * len * u + nx * len * n, y: y0 + uy * len * u + ny * len * n)
        }

        let tabLeft = 0.5 - tabRatio / 2
        let tabRight = 0.5 + tabRatio / 2
        let tabNeck = 0.21
        let tabDepth = 0.30
        var segs: [(c1: CGPoint, c2: CGPoint, p: CGPoint)] = [
            (p(0.12, 0), p(0.3, -0.03), p(0.4, -0.01)),
            (p(0.44, 0.005), p(0.45, 0.04), p(0.44, 0.07)),
            (p(0.43, 0.10), p(tabLeft, 0.13), p(tabLeft, tabNeck)),
            (p(tabLeft, tabDepth - 0.05), p(0.44, tabDepth), p(0.5, tabDepth)),
            (p(0.56, tabDepth), p(tabRight, tabDepth - 0.05), p(tabRight, tabNeck)),
            (p(tabRight, 0.13), p(0.57, 0.10), p(0.56, 0.07)),
            (p(0.55, 0.04), p(0.56, 0.005), p(0.6, -0.01)),
            (p(0.7, -0.03), p(0.88, 0), p(1, 0)),
        ]

        for i in 1..<segs.count {
            let join = segs[i - 1].p
            let tp = CGPoint(x: join.x - segs[i - 1].c2.x, y: join.y - segs[i - 1].c2.y)
            let tn = CGPoint(x: segs[i].c1.x - join.x, y: segs[i].c1.y - join.y)
            let lp = hypot(tp.x, tp.y)
            let ln = hypot(tn.x, tn.y)
            guard lp > 1e-9, ln > 1e-9 else { continue }
            var bx = tp.x / lp + tn.x / ln
            var by = tp.y / lp + tn.y / ln
            let bl = hypot(bx, by)
            guard bl > 1e-9 else { continue }
            bx /= bl
            by /= bl
            segs[i - 1].c2 = CGPoint(x: join.x - bx * lp, y: join.y - by * lp)
            segs[i].c1 = CGPoint(x: join.x + bx * ln, y: join.y + by * ln)
        }
        segs[segs.count - 1].p = CGPoint(x: x1, y: y1)
        for s in segs {
            api.bezierCurveTo(s.c1.x, s.c1.y, s.c2.x, s.c2.y, s.p.x, s.p.y)
        }
    }
}

struct CropView: Equatable, Codable {
    var cx: CGFloat = 0.5
    var cy: CGFloat = 0.5
    var zoom: CGFloat = 1
}
