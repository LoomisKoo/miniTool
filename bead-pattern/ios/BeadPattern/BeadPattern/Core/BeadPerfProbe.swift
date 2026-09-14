import Foundation
import os
import QuartzCore

/// 3D 预览的每帧埋点：**只往控制台打慢帧，不做任何 UI**。
///
/// 记两个**不同**的耗时，用来分开「渲染慢」和「手势 / 视图路径慢」：
///
/// - `canvas`：CPU 路径是画布闭包的耗时（背景铺底 + 逐豆填充，即 Core Graphics
///   的 CPU 栅格化）；Metal 路径换成 GPU 真实耗时（`recordGPU` 回填）。这一项才是
///   「渲染用掉多少时间」。
/// - `gap`：相邻两帧的间隔，也就是实际出帧节奏。
///
/// 判读方式：
/// - `gap ≈ canvas`：瓶颈在渲染，降 `canvas` 才有用（减笔数 / 降分辨率 / 换后端）。
/// - `gap` 明显大于 `canvas`（例如 33ms vs 8ms）：瓶颈在 SwiftUI 的视图求值或手势
///   事件投递，换渲染后端不会变快。
/// - `gap` 偶尔很大（几百 ms~几秒）而后续帧正常：那是空闲后的第一帧，不是每帧耗时。
///
/// 只在主线程写（画布闭包是同步绘制的），锁只为 `recordGPU` 在命令缓冲回调线程回填。
/// 超过 `slowFrameMS` 的帧按「最多 1 秒一条」的频率打到
/// `subsystem: beadpattern, category: perf`，用 Console.app 过滤 `beadpattern` 即可。
final class BeadPerfProbe: @unchecked Sendable {
    static let shared = BeadPerfProbe()

    private let lock = NSLock()
    private var lastDrawAt: CFAbsoluteTime = 0

    private var canvasMS: Double = 0
    private var frameGapMS: Double = 0
    private var lod = 0
    private var segments = 0
    private var beads = 0
    private var wallPx: Double = 0
    private var quality = "—"
    /// 超过这个耗时就在控制台记一笔。
    private static let slowFrameMS: Double = 20
    private var lastLogAt: CFAbsoluteTime = 0

    private let logger = Logger(subsystem: "beadpattern", category: "perf")

    private init() {}

    /// 画布闭包执行完调用一次（CPU 路径）。`quality` 用单字符档位标记（i/s/m）。
    func record(canvasMS value: Double, quality label: String, stats: Bead3DRenderer.FrameStats) {
        let now = CACurrentMediaTime()
        var slow: (Double, Double, Int, Int, Int, Double, String)?

        lock.withLock {
            let gap = lastDrawAt > 0 ? (now - lastDrawAt) * 1000 : 0
            lastDrawAt = now

            canvasMS = value
            lod = stats.lod
            segments = stats.segments
            beads = stats.beads
            wallPx = stats.wallPx
            quality = label

            if gap > 0.1 {
                frameGapMS = frameGapMS == 0 ? gap : frameGapMS * 0.8 + gap * 0.2
            }

            if value > Self.slowFrameMS, now - lastLogAt > 1 {
                lastLogAt = now
                slow = (value, frameGapMS, lod, segments, beads, wallPx, label)
            }
        }

        if let slow { log(slow) }
    }

    /// Metal 路径的 GPU 耗时（`MTLCommandBuffer.gpuEndTime - gpuStartTime`）。
    /// 只有这个数才是「渲染用掉多少时间」，CPU 侧编码那点开销可以忽略。
    func recordGPU(milliseconds value: Double) {
        var slow: (Double, Double, Int, Int, Int, Double, String)?
        lock.withLock {
            canvasMS = value
            let now = CACurrentMediaTime()
            if value > Self.slowFrameMS, now - lastLogAt > 1 {
                lastLogAt = now
                slow = (value, frameGapMS, lod, segments, beads, wallPx, quality)
            }
        }
        if let slow { log(slow) }
    }

    private func log(_ slow: (Double, Double, Int, Int, Int, Double, String)) {
        let text = String(
            format: "slow frame canvas=%.1fms gap=%.1fms lod=%d seg=%d wall=%.1fpx beads=%d q=%@",
            slow.0, slow.1, slow.2, slow.3, slow.4, slow.5, slow.6
        )
        logger.debug("\(text, privacy: .public)")
    }

    /// 切到别的图 / 离开页面时清掉，避免 `gap` 把上一张图的那一帧算进来。
    func reset() {
        lock.withLock {
            lastDrawAt = 0
            canvasMS = 0
            frameGapMS = 0
            beads = 0
        }
    }
}
