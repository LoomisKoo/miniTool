import CoreGraphics
import Foundation
import SwiftUI

/// 3D 视图相机。与 H5 端 `state.view3d` 的可调项一致（不含 morph 过渡）。
struct Bead3DCamera: Equatable {
    var yaw: Double = 0
    var pitch: Double = 0.5
    var zoom: Double = 1

    static let pitchRange = 0.18...(Double.pi / 2)
    static let zoomRange = 0.45...3.5

    var clamped: Bead3DCamera {
        Bead3DCamera(
            yaw: yaw,
            pitch: min(max(pitch, Self.pitchRange.lowerBound), Self.pitchRange.upperBound),
            zoom: min(max(zoom, Self.zoomRange.lowerBound), Self.zoomRange.upperBound)
        )
    }
}

/// 拼豆 3D 预览：把每颗豆画成带中心孔的圆柱，按深度排序后依次绘制。
///
/// 与 H5 端 `render3d` 的几何与配色口径一致（`roundness = 1`、`hFactor = 1` 的稳定态）：
/// 底板近黑、豆外壁 `-0.32/-0.52`、孔内壁 `-0.22/-0.42`、顶面 `+0.06`。
/// 差异：视角旋转不做拟合重算（与 H5 相同，锁定在 yaw 0 / pitch 0.5 的初始 fit），
/// 且未实现双指平移。
///
/// 性能：逐豆只做「投影中心 + 按深度缩放一张预计算好的单位圆环」，
/// 可见弧段与明暗色都按视角/色号缓存，避免每颗豆重复分配数组与 Path。
enum Bead3DRenderer {

    // 与 H5 一致的几何常量
    private static let beadHeight = 0.52
    private static let outerRadius = 0.46
    private static let innerRadius = 0.20
    private static let plateMargin = 0.55
    private static let fitPadding = 28.0

    private static let plateColor = RGB8(0x23, 0x23, 0x29)

    static let backgroundColor = RGB8(0xE5, 0xE5, 0xEA)

    /// 视图坐标基：前向 / 右向 / 上向在屏幕上的投影分量。
    private struct Basis {
        let yawC: Double
        let fx, fy, fz: Double
        let rx, rz: Double
        let ux, uy, uz: Double
    }

    private static func basis(yaw: Double, pitch: Double) -> Basis {
        let yawC = cos(pitch)
        let fx = -yawC * sin(yaw)
        let fy = -sin(pitch)
        let fz = -yawC * cos(yaw)
        let rl = (fx * fx + fz * fz).squareRoot()

        if rl < 1e-5 {
            // 正俯视时前向退化，改用 yaw 定义画面朝向（+x→右、+z→下，对齐 2D）
            let rx = cos(yaw)
            let rz = -sin(yaw)
            return Basis(yawC: yawC, fx: fx, fy: fy, fz: fz, rx: rx, rz: rz, ux: -rz, uy: 0, uz: rx)
        }

        let rx = -fz / rl
        let rz = fx / rl
        return Basis(
            yawC: yawC, fx: fx, fy: fy, fz: fz, rx: rx, rz: rz,
            ux: fy * rz,
            uy: fz * rx - fx * rz,
            uz: -fy * rx
        )
    }

    private static func eyeRadius(pw: Int, ph: Int) -> Double {
        let diagonal = (Double(pw) * Double(pw) + Double(ph) * Double(ph)).squareRoot()
        return max(3.2, diagonal * 1.15)
    }

    /// 铺满视口所需焦距；pad 与 H5 的 28px 一致。
    private static func fitFactor(
        yaw: Double,
        pitch: Double,
        pw: Int,
        ph: Int,
        viewport: CGSize,
        pad: Double
    ) -> Double {
        let halfX = (Double(pw) - 1) / 2
        let halfZ = (Double(ph) - 1) / 2
        let maxX = halfX + outerRadius
        let maxZ = halfZ + outerRadius

        let eyeR = eyeRadius(pw: pw, ph: ph)
        let b = basis(yaw: yaw, pitch: pitch)
        let eyeX = eyeR * b.yawC * sin(yaw)
        let eyeY = eyeR * sin(pitch)
        let eyeZ = eyeR * b.yawC * cos(yaw)
        let lookY = beadHeight * 0.5

        var minX = Double.infinity, maxUx = -Double.infinity
        var minY = Double.infinity, maxUy = -Double.infinity

        let corners = [
            (-maxX, beadHeight, -maxZ), (maxX, beadHeight, -maxZ),
            (maxX, beadHeight, maxZ), (-maxX, beadHeight, maxZ),
        ]
        for corner in corners {
            let dy = corner.1 - lookY - eyeY
            let dx = corner.0 - eyeX
            let dz = corner.2 - eyeZ
            let vz = dx * b.fx + dy * b.fy + dz * b.fz
            guard vz > 0.06 else { continue }
            let ux = (dx * b.rx + dz * b.rz) / vz
            let uy = (dx * b.ux + dy * b.uy + dz * b.uz) / vz
            minX = min(minX, ux)
            maxUx = max(maxUx, ux)
            minY = min(minY, uy)
            maxUy = max(maxUy, uy)
        }

        let spanW = max(1e-3, maxUx - minX)
        let spanH = max(1e-3, maxUy - minY)
        let f0 = min((viewport.width - pad) / spanW, (viewport.height - pad) / spanH)
        return (!f0.isFinite || f0 <= 0) ? 1 : f0
    }

    static func draw(
        context: inout GraphicsContext,
        size: CGSize,
        grid: BeadGrid,
        rect: GridRect,
        camera: Bead3DCamera,
        settings: BeadSettings,
        highlightedCode: String?
    ) {
        let pw = rect.width
        let ph = rect.height
        guard pw > 0, ph > 0, size.width > 0, size.height > 0 else { return }

        let cam = camera.clamped
        let hB = beadHeight
        let ro = outerRadius
        let ri = innerRadius
        let halfX = (Double(pw) - 1) / 2
        let halfZ = (Double(ph) - 1) / 2
        let maxX = halfX + ro
        let maxZ = halfZ + ro
        let eyeR = eyeRadius(pw: pw, ph: ph)
        let b = basis(yaw: cam.yaw, pitch: cam.pitch)
        let eyeX = eyeR * b.yawC * sin(cam.yaw)
        let eyeY = eyeR * sin(cam.pitch)
        let eyeZ = eyeR * b.yawC * cos(cam.yaw)
        let lookY = hB * 0.5
        let baseF = fitFactor(
            yaw: 0, pitch: 0.5,
            pw: pw, ph: ph, viewport: size, pad: fitPadding
        )
        let focal = baseF * cam.zoom
        let centerX = size.width / 2
        let centerY = size.height / 2

        /// 世界坐标 → 屏幕坐标；`vz` 同时是深度（越大越远）。
        func project(_ px: Double, _ py: Double, _ pz: Double) -> (x: Double, y: Double, vz: Double)? {
            let dx = px - eyeX
            let dy = py - lookY - eyeY
            let dz = pz - eyeZ
            let vz = dx * b.fx + dy * b.fy + dz * b.fz
            guard vz > 0.06 else { return nil }
            let ux = (dx * b.rx + dz * b.rz) / vz
            let uy = (dx * b.ux + dy * b.uy + dz * b.uz) / vz
            return (centerX + ux * focal, centerY + uy * focal, vz)
        }

        // ---------- 底板 ----------
        let p = plateMargin
        let plateCorners = [
            (-maxX - p, -0.02, -maxZ - p), (maxX + p, -0.02, -maxZ - p),
            (maxX + p, -0.02, maxZ + p), (-maxX - p, -0.02, maxZ + p),
        ]
        var plate = Path()
        var plateStarted = false
        for corner in plateCorners {
            guard let u = project(corner.0, corner.1, corner.2) else { continue }
            let point = CGPoint(x: u.x, y: u.y)
            if plateStarted {
                plate.addLine(to: point)
            } else {
                plate.move(to: point)
                plateStarted = true
            }
        }
        if plateStarted {
            plate.closeSubpath()
            context.fill(plate, with: .color(plateColor.swiftUIColor))
        }

        // ---------- LOD ----------
        let totalCells = pw * ph
        let cellPxEst = focal / max(0.2, eyeR - lookY)
        let lod: Int
        if cellPxEst < 2.5 || totalCells > 16000 {
            lod = 0
        } else if cellPxEst < 5 || totalCells > 9000 {
            lod = 1
        } else if cellPxEst < 9 || totalCells > 5000 {
            lod = 2
        } else {
            lod = 3
        }
        let segments: Int
        switch lod {
        case 0, 1: segments = 10
        case 2: segments = 14
        default: segments = cellPxEst > 24 ? 28 : (cellPxEst > 14 ? 22 : 16)
        }
        let drawWalls = lod >= 1
        let drawInner = lod >= 2
        // 接近正俯视时侧壁几乎看不见，直接跳过
        let wallsVisible = drawWalls && cam.pitch < 1.45
        let innerVisible = drawInner && cellPxEst > 6

        let total = Double(segments)
        var cosTable = [Double]()
        var sinTable = [Double]()
        cosTable.reserveCapacity(segments)
        sinTable.reserveCapacity(segments)
        for i in 0..<segments {
            let angle = Double(i) / total * 2 * .pi
            cosTable.append(cos(angle))
            sinTable.append(sin(angle))
        }

        // 单位半径在该视角下的屏幕偏移：与具体哪颗豆无关，全幅共用一张
        let basisA = CGPoint(x: b.rx, y: b.ux)
        let basisB = CGPoint(x: b.rz, y: b.uz)
        var unitRing = [CGPoint]()
        unitRing.reserveCapacity(segments)
        for i in 0..<segments {
            unitRing.append(
                CGPoint(
                    x: cosTable[i] * basisA.x + sinTable[i] * basisB.x,
                    y: cosTable[i] * basisA.y + sinTable[i] * basisB.y
                )
            )
        }

        // 可见弧段：相机离得远（eyeR ≈ 1.15 倍对角线），各豆几乎一致，
        // 所以用原点处那颗豆为代表算一次，全幅复用。
        let outerArc = visibleArc(
            segments: segments, cosTable: cosTable, sinTable: sinTable,
            eyeX: eyeX, eyeZ: eyeZ, outward: true
        )
        let innerArc = visibleArc(
            segments: segments, cosTable: cosTable, sinTable: sinTable,
            eyeX: eyeX, eyeZ: eyeZ, outward: false
        )
        let wallLit = outerArc.averageFacing > 0.28
        let innerLit = innerArc.averageFacing > 0.28

        // 每个色号解析一次明暗色，避免逐豆重复插值与 Color 构造
        var shadeCache: [String: BeadShades] = [:]

        // ---------- 逐豆绘制（画家算法：远的先画） ----------
        // 深度是 col/row 的线性函数，按列、行的方向嵌套遍历即为远近顺序，无需排序。
        let columnOrder = b.fx > 0
            ? Array(stride(from: rect.x1 - 1, through: rect.x0, by: -1))
            : Array(rect.x0..<rect.x1)
        let rowOrder = b.fz > 0
            ? Array(stride(from: rect.y1 - 1, through: rect.y0, by: -1))
            : Array(rect.y0..<rect.y1)

        let cullMargin = cellPxEst * 1.5 + 12
        let codeCell = settings.showCodes && cellPxEst >= 30 ? cellPxEst * 0.36 : 0
        let codeFont = Font.system(size: codeCell * 0.9, weight: .medium, design: .monospaced)
        let codeFade = cam.pitch > 0.95 ? min(1, (cam.pitch - 0.95) / 0.4) : 0

        for col in columnOrder {
            let cx = Double(col - rect.x0) - halfX
            for row in rowOrder {
                let cell = grid[col, row]
                guard !cell.isEmpty else { continue }
                let cz = Double(row - rect.y0) - halfZ

                // 顶/底环共用同一深度（弱透视），省掉一次投影
                guard let top = project(cx, hB, cz),
                      let bottom = project(cx, 0, cz)
                else { continue }
                if top.x < -cullMargin || top.y < -cullMargin
                    || top.x > size.width + cullMargin || top.y > size.height + cullMargin {
                    continue
                }

                let isDimmed = highlightedCode != nil && cell.code != highlightedCode
                let shades: BeadShades
                if let cached = shadeCache[cell.code] {
                    shades = cached
                } else {
                    // 同一个色号的淡化状态一致，按色号缓存即可
                    let resolved = BeadShades(rgb: cell.rgb, dimmed: isDimmed)
                    shadeCache[cell.code] = resolved
                    shades = resolved
                }

                let topCenter = CGPoint(x: top.x, y: top.y)
                let bottomCenter = CGPoint(x: bottom.x, y: bottom.y)
                let kOuter = ro * focal / top.vz
                let kInner = ri * focal / top.vz

                if wallsVisible {
                    if let band = bandPath(
                        arc: outerArc, top: topCenter, bottom: bottomCenter,
                        unit: unitRing, k: kOuter
                    ) {
                        context.fill(band, with: .color(wallLit ? shades.wallLit : shades.wallDark))
                    }
                    if innerVisible, let innerBand = bandPath(
                        arc: innerArc, top: topCenter, bottom: bottomCenter,
                        unit: unitRing, k: kInner
                    ) {
                        context.fill(innerBand, with: .color(innerLit ? shades.innerLit : shades.innerDark))
                    }
                }

                // 顶面（环形，必要时挖掉中心孔）
                let topPath = topFacePath(
                    center: topCenter, unit: unitRing, kOuter: kOuter,
                    kInner: innerVisible ? kInner : nil
                )
                context.fill(
                    topPath,
                    with: .color(shades.top),
                    style: FillStyle(eoFill: innerVisible)
                )

                // 俯视且够大时叠加色号，与 2D 放大态衔接
                if codeCell > 0, codeFade > 0.05, !isDimmed {
                    context.draw(
                        Text(cell.code)
                            .font(codeFont)
                            .foregroundStyle(
                                cell.rgb.prefersDarkOverlayText
                                    ? Color.black.opacity(0.55 * codeFade)
                                    : Color.white.opacity(0.75 * codeFade)
                            ),
                        at: topCenter,
                        anchor: .center
                    )
                }
            }
        }

        // 分板红线：全图多板且开关开启时，画在豆顶之上（对齐 H5 render3d）
        if settings.showSeam,
           grid.boardCount > 1,
           rect.x0 == 0, rect.y0 == 0,
           rect.x1 == grid.width, rect.y1 == grid.height {
            drawBoardSeams(
                context: &context,
                project: project,
                pw: pw, ph: ph,
                halfX: halfX, halfZ: halfZ,
                boardSize: grid.boardSize,
                beadTop: hB
            )
        }
    }

    /// 3D 分板红线：沿板缝画在豆顶略上方。
    private static func drawBoardSeams(
        context: inout GraphicsContext,
        project: (Double, Double, Double) -> (x: Double, y: Double, vz: Double)?,
        pw: Int,
        ph: Int,
        halfX: Double,
        halfZ: Double,
        boardSize: Int,
        beadTop: Double
    ) {
        let ySeam = beadTop + 0.01
        let xMin = -halfX - 0.5
        let xMax = halfX + 0.5
        let zMin = -halfZ - 0.5
        let zMax = halfZ + 0.5
        var path = Path()

        for si in 1..<pw {
            guard si % boardSize == 0 else { continue }
            let xs = Double(si) - halfX - 0.5
            guard let u0 = project(xs, ySeam, zMin),
                  let u1 = project(xs, ySeam, zMax) else { continue }
            path.move(to: CGPoint(x: u0.x, y: u0.y))
            path.addLine(to: CGPoint(x: u1.x, y: u1.y))
        }
        for si in 1..<ph {
            guard si % boardSize == 0 else { continue }
            let zs = Double(si) - halfZ - 0.5
            guard let u0 = project(xMin, ySeam, zs),
                  let u1 = project(xMax, ySeam, zs) else { continue }
            path.move(to: CGPoint(x: u0.x, y: u0.y))
            path.addLine(to: CGPoint(x: u1.x, y: u1.y))
        }

        context.stroke(
            path,
            with: .color(Color(red: 1, green: 0.23, blue: 0.19)),
            style: StrokeStyle(lineWidth: 1.5, lineCap: .butt, lineJoin: .miter)
        )
    }

    // MARK: - 环与壁

    /// 单个色号的明暗色预解析（正常态/淡化态在初始化时一次算好）。
    private struct BeadShades {
        let top: Color
        let wallLit: Color
        let wallDark: Color
        let innerLit: Color
        let innerDark: Color

        init(rgb: RGB8, dimmed: Bool) {
            func resolve(_ factor: Double) -> Color {
                var value = rgb.shaded(factor)
                if dimmed {
                    value = value.mixed(with: RGB8(255, 255, 255), t: 0.72)
                }
                return value.swiftUIColor
            }
            top = resolve(0.06)
            wallLit = resolve(-0.32)
            wallDark = resolve(-0.52)
            innerLit = resolve(-0.22)
            innerDark = resolve(-0.42)
        }
    }

    /// 朝向相机的那段圆弧，按绘制顺序给出索引；`averageFacing` 用于挑明/暗壁色。
    private struct Arc {
        let forward: [Int]
        let backward: [Int]
        let averageFacing: Double
    }

    /// 哪些圆周分段朝向相机。`cx`/`cz` 取 0（相机很远，各豆共用一段弧）。
    private static func visibleArc(
        segments: Int,
        cosTable: [Double],
        sinTable: [Double],
        eyeX: Double,
        eyeZ: Double,
        outward: Bool
    ) -> Arc {
        var flags = [Bool](repeating: false, count: segments)
        var sum = 0.0
        var count = 0

        for i in 0..<segments {
            let j = (i == segments - 1) ? 0 : i + 1
            let mx = (cosTable[i] + cosTable[j]) * 0.5
            let mz = (sinTable[i] + sinTable[j]) * 0.5
            var facing = mx * eyeX + mz * eyeZ
            if !outward { facing = -facing }
            let visible = facing > 0.02
            flags[i] = visible
            if visible {
                sum += facing
                count += 1
            }
        }
        guard count > 0 else { return Arc(forward: [], backward: [], averageFacing: 0) }

        // 可见弧的起点：上一点不可见而当前可见
        var first = 0
        for i in 0..<segments {
            let previous = (i == 0) ? segments - 1 : i - 1
            if flags[i], !flags[previous] {
                first = i
                break
            }
        }

        var forward = [Int]()
        forward.reserveCapacity(segments)
        var index = first
        var guardCount = 0
        while guardCount < segments, flags[index] {
            forward.append(index)
            index = (index == segments - 1) ? 0 : index + 1
            guardCount += 1
        }

        var backward = [Int]()
        backward.reserveCapacity(segments)
        if let last = forward.last {
            index = last
            guardCount = 0
            while guardCount < segments, flags[index] {
                backward.append(index)
                index = (index == 0) ? segments - 1 : index - 1
                guardCount += 1
            }
        }

        return Arc(forward: forward, backward: backward, averageFacing: sum / Double(count))
    }

    /// 环上第 `index` 个点：圆心 + 单位偏移 × 深度缩放。
    @inline(__always)
    private static func ringPoint(
        _ index: Int,
        _ unit: [CGPoint],
        _ center: CGPoint,
        _ k: Double
    ) -> CGPoint {
        let u = unit[index]
        return CGPoint(x: center.x + u.x * k, y: center.y + u.y * k)
    }

    /// 顶面：`kInner` 非空时是挖了中心孔的环形（配合 `eoFill`）。
    private static func topFacePath(
        center: CGPoint,
        unit: [CGPoint],
        kOuter: Double,
        kInner: Double?
    ) -> Path {
        let segments = unit.count
        var path = Path()
        for i in 0..<segments {
            let point = ringPoint(i, unit, center, kOuter)
            if i == 0 {
                path.move(to: point)
            } else {
                path.addLine(to: point)
            }
        }
        path.closeSubpath()

        if let kInner {
            for i in 0..<segments {
                let point = ringPoint(i, unit, center, kInner)
                if i == 0 {
                    path.move(to: point)
                } else {
                    path.addLine(to: point)
                }
            }
            path.closeSubpath()
        }
        return path
    }

    /// 壁面：顶环沿可见弧正向 + 底环沿同一弧回程，闭合成一条带状多边形。
    private static func bandPath(
        arc: Arc,
        top: CGPoint,
        bottom: CGPoint,
        unit: [CGPoint],
        k: Double
    ) -> Path? {
        guard !arc.forward.isEmpty, !arc.backward.isEmpty else { return nil }
        var path = Path()

        for (offset, index) in arc.forward.enumerated() {
            let point = ringPoint(index, unit, top, k)
            if offset == 0 {
                path.move(to: point)
            } else {
                path.addLine(to: point)
            }
        }
        for index in arc.backward {
            path.addLine(to: ringPoint(index, unit, bottom, k))
        }
        path.closeSubpath()
        return path
    }
}
