import CoreGraphics
import Foundation
import SwiftUI
import simd

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

/// 3D 预览画质档位。手势/过渡进行中降级，松手后再补一帧完整细节。
///
/// 降级方式曾经是「交互期压到 LOD0」——每颗豆只填一次顶面，不画外壁/孔壁。
/// 那样确实最省（实测 390x500 @3x、zoom 2.0、21 次中位数、已减去空画布基线）：
///
/// | 网格 | 颗数 | LOD0(只顶面) | LOD2/3 + 色号 |
/// | --- | --- | --- | --- |
/// | 64x85 | 5440 | 4.8ms | 15.3ms |
/// | 80x106 | 8480 | 7.2ms | 25.0ms |
/// | 100x133 | 13300 | 10.8ms | 23.1ms |
///
/// **但 LOD0 的豆就是一个纯色圆盘，拖动时整幅看起来和 2D 扁平视图没区别**
/// （H5 端没有这一档，所以同一个手势在 H5 上一直是完整 3D）。侧壁才是立体感的
/// 主要来源，所以这一档现在只做两件事：不画色号、顶点数封顶（见 `segmentCap`）；
/// 外壁/孔的取舍全部交给「上屏像素够不够」判（`Bead3DRenderer.draw` 里）。
///
/// 代价：交互期和稳定态基本同价（笔数一样，只是省掉色号那一笔 Text）。
/// 真实的出帧间隔有没有掉，用 `BeadPerfProbe` 的 HUD 看（`画` vs `出`）。
///
/// 注意：`fill` 走的是 Core Graphics 的 CPU 栅格化，代价基本正比于**笔数**与
/// 覆盖像素，与 Debug/Release 几乎无关（实测两档差异 <10%，热点在 CG 里）。
/// 要再往下压只能减少豆数、降分辨率或改走 Metal。
enum Bead3DQuality {
    case interactive
    case settled

    /// 交互期的顶点数上限。fill 的笔数才是大头（每颗豆的每层各一笔），
    /// 顶点数只影响 CG 的路径准备，收一档基本不损观感。
    var segmentCap: Int { self == .interactive ? 12 : Int.max }
}

/// 拼豆 3D 预览：把每颗豆画成带中心孔的圆柱，按深度排序后依次绘制。
///
/// 与 H5 端 `render3d` 的几何与配色口径一致（`roundness = 1`、`hFactor = 1` 的稳定态）：
/// 底板近黑、豆外壁 `-0.32/-0.52`、孔内壁 `-0.22/-0.42`、顶面 `+0.06`。
/// 差异：视角旋转不做拟合重算（与 H5 相同，锁定在 yaw 0 / pitch 0.5 的初始 fit），
/// 且未实现双指平移。
///
/// ## 为什么逐豆不构造 Path
///
/// 投影后每颗豆的顶/底环都是**同一个单位圆的仿射像**：
/// `P(θ) = 圆心 + k · (cosθ·A + sinθ·B)`，其中 `A`/`B` 是全幅共用的屏幕基向量、`k` 只跟深度有关。
/// 所以圆、圆环（顶面带孔）、侧壁带都能预计算成单位路径，逐豆只写一个仿射变换再填充。
/// 之前每颗豆要新建 3 个 `Path`（约 1200 颗 × 40 个点/帧），是卡顿的主因。
///
/// ## 可见弧为什么要分桶
///
/// 「哪半圈朝向相机」取决于**这颗豆到眼睛的方向**，不是全幅一个方向。
/// 原先全幅共用一条按原点算出来的弧，靠边的豆方向能差 40°，侧壁会画到错误的半边，
/// 看起来就是「穿模/空心」。这里按方向分 `arcBuckets` 个桶，桶内的弧形状预计算复用，
/// 逐豆只做一次 `atan2`。
enum Bead3DRenderer {

    // 与 H5 一致的几何常量（Metal 路径也读这几个值，改一处两边同步）
    static let beadHeight = 0.52
    static let outerRadius = 0.46
    static let innerRadius = 0.20
    static let plateMargin = 0.55
    static let fitPadding = 28.0

    /// 侧壁可见弧的方向桶数。32 桶 ≈ 11° 一档，边缘豆的轮廓误差在 6° 以内。
    private static let arcBuckets = 32

    /// 3D 底板（豆插在上面的塑料板）。浅色模式是近黑硬板，深色模式要抬亮，
    /// 否则黑板压在黑底上会整块消失。
    static func plateRGB(_ appearance: BeadAppearance) -> RGB8 {
        switch appearance {
        case .light: return RGB8(0x23, 0x23, 0x29)
        case .dark: return RGB8(0x3A, 0x3A, 0x3C)
        }
    }

    /// 预览框底色（与 `BeadTheme.viewport` 的两态同值）。
    static func viewportRGB(_ appearance: BeadAppearance) -> RGB8 {
        switch appearance {
        case .light: return RGB8(0xE5, 0xE5, 0xEA)
        case .dark: return RGB8(0x1C, 0x1C, 0x1E)
        }
    }

    /// 过渡期的底板色。`tilt = 0`（正俯视）时贴到预览框底色，`1` 是正常底板色。
    ///
    /// 交叉淡入的那一刻两层都是正俯视：如果 3D 层带着近黑底板进来，整幅会在
    /// 0.2s 里由浅灰翻成黑，看起来像「闪了一下」。把底板也当成一块**随视角立起来
    /// 才显影**的面（视角越平越接近底色），淡入就只剩豆本身的差别，几乎看不出换层。
    static func plateRGB(_ appearance: BeadAppearance, tilt: Double) -> RGB8 {
        plateRGB(appearance).mixed(with: viewportRGB(appearance), t: 1 - min(max(tilt, 0), 1))
    }

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

    // MARK: - 单位形状

    /// 单位圆（半径 `radius`）追加到 `path`。
    private static func appendUnitRing(segments: Int, radius: Double, into path: inout Path) {
        for i in 0..<segments {
            let angle = Double(i) / Double(segments) * 2 * .pi
            let point = CGPoint(x: cos(angle) * radius, y: sin(angle) * radius)
            if i == 0 {
                path.move(to: point)
            } else {
                path.addLine(to: point)
            }
        }
        path.closeSubpath()
    }

    /// 单位空间里的一段侧壁带：顶弧正向 + 同一段弧沿 `(0, dY)` 下移后回程，闭合成多边形。
    ///
    /// `center` 是这段弧在世界 xz 平面上的中心角。两端各多盖半格，
    /// 压住与顶面之间的接缝（顶面随后覆盖上来）。
    private static func unitWallBand(segments: Int, center: Double, dY: Double) -> Path {
        let half = max(3, segments / 2)
        let span = Double.pi / 2 + Double.pi / Double(segments)
        var path = Path()

        @inline(__always)
        func point(_ index: Int, offset: Double) -> CGPoint {
            let t = Double(index) / Double(half)
            let angle = center - span + t * 2 * span
            return CGPoint(x: cos(angle), y: sin(angle) + offset)
        }

        for i in 0...half {
            let p = point(i, offset: 0)
            if i == 0 {
                path.move(to: p)
            } else {
                path.addLine(to: p)
            }
        }
        for i in stride(from: half, through: 0, by: -1) {
            path.addLine(to: point(i, offset: dY))
        }
        path.closeSubpath()
        return path
    }

    /// 豆 → 眼睛方向落在哪个弧桶。
    private static func arcBucket(cx: Double, cz: Double, eyeX: Double, eyeZ: Double) -> Int {
        var angle = atan2(eyeZ - cz, eyeX - cx)
        if angle < 0 { angle += 2 * .pi }
        let index = Int((angle / (2 * .pi) * Double(arcBuckets)).rounded())
        return ((index % arcBuckets) + arcBuckets) % arcBuckets
    }

    private static func bucketCenter(_ bucket: Int) -> Double {
        Double(bucket) / Double(arcBuckets) * 2 * .pi
    }

    /// 单位路径 → 屏幕：`(u, v) ↦ 圆心 + k·(u·A + v·B)`。
    @inline(__always)
    private static func unitTransform(
        k: Double,
        a: CGPoint,
        b: CGPoint,
        center: CGPoint
    ) -> CGAffineTransform {
        CGAffineTransform(
            a: k * a.x,
            b: k * a.y,
            c: k * b.x,
            d: k * b.y,
            tx: center.x,
            ty: center.y
        )
    }

    // MARK: - 绘制

    /// 一帧实际用到的档位与颗数，给性能埋点（`BeadPerfProbe`）判读用。
    struct FrameStats {
        var lod = 0
        var segments = 0
        var beads = 0
        /// 外壁在屏幕上的高度（pt）。< 1.5 时这一帧不画外壁（豆太小，看不出来）。
        var wallPx = 0.0
    }

    @discardableResult
    static func draw(
        context: inout GraphicsContext,
        size: CGSize,
        grid: BeadGrid,
        rect: GridRect,
        camera: Bead3DCamera,
        style: BeadCanvasStyle,
        highlightedCode: String?,
        quality: Bead3DQuality = .settled,
        appearance: BeadAppearance = .light,
        /// 2D↔3D 过渡里「立起来」的进度（0 = 正俯视）。只影响底板色，见 `plateRGB(_:tilt:)`。
        plateTilt: Double = 1
    ) -> FrameStats {
        var stats = FrameStats()
        let pw = rect.width
        let ph = rect.height
        guard pw > 0, ph > 0, size.width > 0, size.height > 0 else { return stats }

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
            context.fill(plate, with: .color(plateRGB(appearance, tilt: plateTilt).swiftUIColor))
        }

        // ---------- LOD ----------
        // `auto` 只由「豆上屏多大 / 一共多少颗」决定，与手势无关；它决定孔与顶点数。
        let totalCells = pw * ph
        let cellPxEst = focal / max(0.2, eyeR - lookY)
        let auto: Int
        if cellPxEst < 2.5 || totalCells > 16000 {
            auto = 0
        } else if cellPxEst < 5 || totalCells > 9000 {
            auto = 1
        } else if cellPxEst < 9 || totalCells > 5000 {
            auto = 2
        } else {
            auto = 3
        }
        // 交互期只砍「色号」与顶点数，**不再改几何**（H5 也没有交互降级档）。
        // 外壁是立体感的唯一来源，而「拖动时看起来是扁的」正是因为以前这里压到
        // LOD0（只有顶面圆盘，和 2D 扁平视图没区别）；外壁现在改由像素判（见下）。
        let lod = auto
        var segments: Int
        switch lod {
        case 0, 1: segments = 10
        case 2: segments = 14
        default: segments = cellPxEst > 24 ? 28 : (cellPxEst > 14 ? 22 : 16)
        }
        segments = min(segments, quality.segmentCap)
        // 孔洞（顶面 eoFill 挖孔）与孔内壁必须**同时**存在，不能只留孔：
        // 孔是挖出来的透明区，背后是已经画好的深色底板，只挖不填会在每颗豆
        // 正中留下一个深色点。要么「挖孔 + 填内壁」，要么「实心圆」。
        //
        // 门槛 9px 的由来：豆上屏直径 ≈ 0.92×cellPxEst，孔直径 = (ri/ro)×它
        // ≈ 0.4×cellPxEst。所以 cellPxEst ≤ 9 时孔只有 2.4~3.6px，看不出是孔，
        // 而孔内壁是每颗豆的第 3 笔——这一笔省掉能减约 1/3 的稳定态开销。
        //
        // 判据用 cellPxEst 而不是 lod：lod 会被「总格数」上限压下来，那是为了
        // 少画豆子，不该连带把大孔的内壁也省掉（大格子时又被视口裁掉大半，
        // 这一笔本来就不贵）。
        let holeVisible = lod >= 2 && cellPxEst > 9

        // 顶面单位形状：整圆 / 带孔圆环（孔半径比恒为 ri/ro）
        var disk = Path()
        appendUnitRing(segments: segments, radius: 1, into: &disk)
        var annulus = Path()
        appendUnitRing(segments: segments, radius: 1, into: &annulus)
        appendUnitRing(segments: segments, radius: ri / ro, into: &annulus)

        let basisA = CGPoint(x: b.rx, y: b.ux)
        let basisB = CGPoint(x: b.rz, y: b.uz)

        // 侧壁带：全幅共用一套。下移量按单位空间算，与豆的位置无关
        // （屏幕位移 Δy 与 k 都正比于 1/vz，比值恒定）。
        var outerBands: [Path] = []
        var innerBands: [Path] = []
        let originTop = project(0, hB, 0)
        let originBottom = project(0, 0, 0)
        // 低视角下孔内壁只有上段可见：再往下就被近侧边缘挡住了。
        // 画满整段会溢出到近侧外壁上，看起来就是「空心/穿模」。
        let visibleInnerBottom = max(0, hB - 2 * ri * tan(cam.pitch))
        let originInnerBottom = project(0, visibleInnerBottom, 0)

        // 画不画外壁：只看**上屏高度**，与颗数、与交互态都无关。
        // 以前的判据是 `lod >= 1`，而 lod 会被「总格数 > 16000」直接压成 0 ——
        // 于是大网格哪怕放大到能看清，也永远只有一层扁平顶面。此外侧壁不足
        // ~1.5px 时看不出立体感，画它是纯浪费（与上面孔的 9px 门槛同一套口径）。
        var wallPx = 0.0
        if cam.pitch < 1.45, let top0 = originTop, let bottom0 = originBottom {
            wallPx = abs(bottom0.y - top0.y)
            if wallPx >= 1.5 {
                let dY =
                    (bottom0.y - top0.y) * top0.vz / (ro * focal)
                outerBands = (0..<arcBuckets).map {
                    unitWallBand(segments: segments, center: bucketCenter($0), dY: dY)
                }
            }
        }
        if holeVisible, let top0 = originTop, let inner0 = originInnerBottom {
            let dY = (inner0.y - top0.y) * top0.vz / (ri * focal)
            innerBands = (0..<arcBuckets).map {
                unitWallBand(segments: segments, center: bucketCenter($0), dY: dY)
            }
        }

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
        // 与 H5 一致：cellPx * 0.36 无衬线，够大才画
        let codeCell = style.showCodes && quality == .settled && cellPxEst >= 30
            ? cellPxEst * 0.36
            : 0
        let codeFont = Font.system(size: codeCell)
        let codeFade = cam.pitch > 0.95 ? min(1, (cam.pitch - 0.95) / 0.4) : 0
        let canDrawWalls = !outerBands.isEmpty
        let canDrawInner = !innerBands.isEmpty
        var drawnBeads = 0

        for col in columnOrder {
            let cx = Double(col - rect.x0) - halfX
            for row in rowOrder {
                let cell = grid[col, row]
                guard !cell.isEmpty else { continue }
                let cz = Double(row - rect.y0) - halfZ

                // 顶环的投影就够用：底环只差一个与深度无关的屏幕位移，
                // 已经并进上面预计算的侧壁带里了。
                guard let top = project(cx, hB, cz) else { continue }
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
                    let resolved = BeadShades(rgb: cell.rgb, dimmed: isDimmed, appearance: appearance)
                    shadeCache[cell.code] = resolved
                    shades = resolved
                }

                let topCenter = CGPoint(x: top.x, y: top.y)
                let kOuter = ro * focal / top.vz
                let kInner = ri * focal / top.vz
                let bucket = arcBucket(cx: cx, cz: cz, eyeX: eyeX, eyeZ: eyeZ)

                // 先画孔内壁（最远），再画近侧外壁，最后顶面。
                // 顺序反了的话，内壁会盖住近侧外壁，豆看起来就是空心的。
                if canDrawInner {
                    var ctx = context
                    ctx.transform = unitTransform(k: kInner, a: basisA, b: basisB, center: topCenter)
                    ctx.fill(
                        innerBands[(bucket + arcBuckets / 2) % arcBuckets],
                        with: .color(shades.innerLit)
                    )
                }

                if canDrawWalls {
                    var ctx = context
                    ctx.transform = unitTransform(k: kOuter, a: basisA, b: basisB, center: topCenter)
                    ctx.fill(outerBands[bucket], with: .color(shades.wallLit))
                }

                // 顶面：开了中心孔就是圆环（eoFill 挖孔），否则是整圆
                var topCtx = context
                topCtx.transform = unitTransform(k: kOuter, a: basisA, b: basisB, center: topCenter)
                if holeVisible {
                    topCtx.fill(annulus, with: .color(shades.top), style: FillStyle(eoFill: true))
                } else {
                    topCtx.fill(disk, with: .color(shades.top))
                }
                drawnBeads += 1

                // 俯视且够大时叠加色号，与 2D 放大态衔接
                if codeCell > 0, codeFade > 0.05, !isDimmed {
                    context.draw(
                        Text(cell.code)
                            .font(codeFont)
                            .foregroundStyle(
                                cell.rgb.wantsDarkOverlayText
                                    ? Color.black.opacity(0.6 * codeFade)
                                    : Color.white.opacity(0.85 * codeFade)
                            ),
                        at: topCenter,
                        anchor: .center
                    )
                }
            }
        }

        // 分板红线：全图多板且开关开启时，画在豆顶之上（对齐 H5 render3d）
        if style.showSeam,
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

        stats.lod = lod
        stats.segments = segments
        stats.beads = drawnBeads
        stats.wallPx = wallPx
        return stats
    }

    /// Metal 路径共用的相机参数。
    ///
    /// Metal 那边不再逐豆算投影，改成一个 MVP 矩阵交给 GPU，但**必须与上面 CPU 的
    /// 逐豆投影完全等价**（否则 2D↔3D 过渡结束切到稳定态时会跳一下）：
    /// `project()` 的 `u = (dx·R + dz·rz)/vz`、`v = (dx·ux + dy·uy + dz·uz)/vz`
    /// 本来就是一个针孔投影 —— `R`/`U`/`F` 是正交基，`vz` 是前向深度，`focal`
    /// 是像素焦距。所以这里直接把它写成 view + projection 两个矩阵。
    ///
    /// 注意两点：
    /// - 眼睛的 y 要加上 `lookY`：`project()` 里 `dy` 是相对 `lookY` 量的。
    /// - 投影矩阵里用的是**点**而不是像素（`2focal/W`），和 drawable 的 scale
    ///   约掉了（`W_px = W_pt · scale`），所以拉伸屏/原生倍率都不需要额外处理。
    struct Scene {
        /// 像素焦距（点），与 CPU 路径同一个 `fitFactor × zoom`。
        var focal: Double
        var eye: SIMD3<Double>
        /// 世界 → 裁剪空间，列主序，直接喂 Metal。
        var mvp: simd_float4x4
        /// 豆上屏宽度估计（点），与 CPU 路径同公式。
        var cellPxEst: Double
    }

    static func scene(camera: Bead3DCamera, rect: GridRect, viewport: CGSize) -> Scene? {
        let pw = rect.width
        let ph = rect.height
        guard pw > 0, ph > 0, viewport.width > 0, viewport.height > 0 else { return nil }

        let cam = camera.clamped
        let eyeR = eyeRadius(pw: pw, ph: ph)
        let b = basis(yaw: cam.yaw, pitch: cam.pitch)
        let lookY = beadHeight * 0.5
        let eye = SIMD3(
            eyeR * b.yawC * sin(cam.yaw),
            eyeR * sin(cam.pitch) + lookY,
            eyeR * b.yawC * cos(cam.yaw)
        )
        let focal = fitFactor(
            yaw: 0, pitch: 0.5, pw: pw, ph: ph, viewport: viewport, pad: fitPadding
        ) * cam.zoom

        // 视图空间：x = d·R（屏幕右）、y = d·U（屏幕上）、z = -d·F（前方为负，对齐 Metal）
        let rVec = SIMD3(b.rx, 0, b.rz)
        let uVec = SIMD3(b.ux, b.uy, b.uz)
        let fVec = SIMD3(b.fx, b.fy, b.fz)

        var view = matrix_identity_double4x4
        view.columns.0 = SIMD4(rVec.x, uVec.x, -fVec.x, 0)
        view.columns.1 = SIMD4(rVec.y, uVec.y, -fVec.y, 0)
        view.columns.2 = SIMD4(rVec.z, uVec.z, -fVec.z, 0)
        view.columns.3 = SIMD4(
            -simd_dot(rVec, eye),
            -simd_dot(uVec, eye),
            simd_dot(fVec, eye),
            1
        )

        // 针孔：ndc.x = 2·focal·(d·R)/(W·vz)；y 要**取负** —— CPU 那边
        // `screenY = centerY + uy·focal` 且屏幕 y 向下，而 Metal 的 NDC y 向上
        // （`Basis.U` 指向的就是屏幕向下方向：正俯视时 U = +Z = 行号增大方向）。
        // `clip.w = -z_view = vz`，所以透视除法拿到的正好是 CPU 那边的 `vz`。
        let w = Double(viewport.width)
        let h = Double(viewport.height)
        let near = max(0.05, eyeR * 0.02)
        let far = eyeR * 6
        var proj = matrix_identity_double4x4
        proj.columns.0 = SIMD4(2 * focal / w, 0, 0, 0)
        proj.columns.1 = SIMD4(0, -2 * focal / h, 0, 0)
        proj.columns.2 = SIMD4(0, 0, far / (near - far), -1)
        proj.columns.3 = SIMD4(0, 0, far * near / (near - far), 0)

        return Scene(
            focal: focal,
            eye: eye,
            mvp: floatMatrix(proj * view),
            cellPxEst: focal / max(0.2, eyeR - lookY)
        )
    }

    /// `simd_double4x4` → `simd_float4x4`。simd 没有跨精度的矩阵转换初始化器，
    /// 逐列转一次。
    private static func floatMatrix(_ matrix: simd_double4x4) -> simd_float4x4 {
        let columns = matrix.columns
        func cast(_ column: SIMD4<Double>) -> SIMD4<Float> {
            SIMD4<Float>(Float(column.x), Float(column.y), Float(column.z), Float(column.w))
        }
        return simd_float4x4(cast(columns.0), cast(columns.1), cast(columns.2), cast(columns.3))
    }

    /// 让**正俯视**的 3D 画面与 2D 图层完全同尺寸所需的 `camera.zoom`。
    ///
    /// 2D 里 1 格 = `cell * scale` pt（`cell` 是 `Bead2DRenderer.contentCell`）；
    /// 3D 正俯视下 1 个世界单位 = `focal / (eyeR - lookY)` pt（与 `cellPxEst` 同一个
    /// 口径，`eyeR - lookY` 就是正俯视时的眼距），而 `focal = fitFactor × zoom`。
    /// 两者相等即可解出 `zoom`。
    ///
    /// 过渡起点必须用这个值：2D 的 fit 是 `min(...) × 0.94`，3D 的 fit 是
    /// `fitFactor(pitch: 0.5, pad: 28)`，两套公式不相等，各用各的就会出现
    /// 「交叉淡入时 2D 与 3D 一大一小、叠不上」。
    static func flatMatchedZoom(
        pw: Int,
        ph: Int,
        viewport: CGSize,
        cell: CGFloat,
        scale: CGFloat
    ) -> Double {
        guard pw > 0, ph > 0, viewport.width > 0, viewport.height > 0 else { return 1 }
        let baseFocal = fitFactor(
            yaw: 0, pitch: 0.5, pw: pw, ph: ph, viewport: viewport, pad: fitPadding
        )
        guard baseFocal > 0 else { return 1 }
        let eyeR = eyeRadius(pw: pw, ph: ph)
        let lookY = beadHeight * 0.5
        return Double(cell * scale) * (eyeR - lookY) / baseFocal
    }

    /// 底板四角（世界坐标，`y = -0.02`），顺序 `(-,-) (+,-) (-,+) (+,+)`，
    /// 正好是一个 triangleStrip。与上面 CPU 画底板时的四个角同一口径。
    static func plateWorldCorners(rect: GridRect) -> [SIMD3<Float>] {
        let halfX = (Double(rect.width) - 1) / 2
        let halfZ = (Double(rect.height) - 1) / 2
        let maxX = halfX + outerRadius + plateMargin
        let maxZ = halfZ + outerRadius + plateMargin
        return [
            SIMD3(-Float(maxX), -0.02, -Float(maxZ)),
            SIMD3(Float(maxX), -0.02, -Float(maxZ)),
            SIMD3(-Float(maxX), -0.02, Float(maxZ)),
            SIMD3(Float(maxX), -0.02, Float(maxZ)),
        ]
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

    /// 单个色号的明暗色预解析（正常态/淡化态在初始化时一次算好）。
    ///
    /// 相机的可见弧平均朝向恒 > 0.28，所以只用得上 `Lit` 那组；
    /// `Dark` 保留给后续可能的光照细分。
    private struct BeadShades {
        let top: Color
        let wallLit: Color
        let innerLit: Color

        init(rgb: RGB8, dimmed: Bool, appearance: BeadAppearance) {
            func resolve(_ factor: Double) -> Color {
                var value = rgb.shaded(factor)
                if dimmed {
                    value = value.mixed(with: appearance.dimTarget, t: 0.72)
                }
                return value.swiftUIColor
            }
            top = resolve(0.06)
            wallLit = resolve(-0.32)
            innerLit = resolve(-0.22)
        }
    }
}
