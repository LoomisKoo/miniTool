import CoreGraphics
import Foundation

/// 图像 → 拼豆格子的量化管线。
///
/// 与 H5 端 `bead-pattern/app.js` 的 `mapImage()` 流程保持一致：
/// 格内采样 → 去灰边 → 最近色匹配（或抖动）→ 相似色连通域合并 → 限色。
/// 改动任一步都会导致两端成品不同，改前先看 `docs/ios/development.md`。
enum BeadQuantizer {

    // 与 H5 端一致的常量
    private static let alphaCutoff: UInt8 = 128
    private static let opaqueRatio = 0.4
    private static let sourceMaxSide = 1400

    /// 主入口。耗时随 `beadWidth` 增长，调用方放到 `Task` 里并给进度反馈。
    static func quantize(
        image: CGImage,
        settings: BeadSettings,
        palette: BeadPalette
    ) -> BeadGrid? {
        guard let buffer = PixelBuffer.make(from: image, maxSide: sourceMaxSide) else { return nil }

        let width = max(1, settings.beadWidth)
        let height = max(1, Int((Double(width) * Double(image.height) / Double(image.width)).rounded()))

        // 1. 格内采样
        var samples = sampleCells(buffer: buffer, width: width, height: height, mode: settings.sampleMode)
        for i in samples.indices {
            guard let sample = samples[i] else { continue }
            samples[i] = cleanSample(sample)
        }

        // 2. 取色：就近匹配 或 Floyd–Steinberg 抖动
        var mapped: [BeadCell]
        if settings.dither {
            mapped = applyDither(samples: samples, width: width, height: height, palette: palette)
        } else {
            mapped = samples.map { sample in
                guard let sample else { return .empty }
                return cell(for: palette.nearest(to: sample))
            }
        }

        // 3. 相似色连通域合并
        if settings.mergeSimilar {
            mapped = mergeSimilarRegions(
                mapped,
                width: width,
                height: height,
                threshold: settings.mergeThreshold
            )
        }

        // 4. 限色
        mapped = limitColors(mapped, samples: samples, maxColors: settings.maxColors, palette: palette)

        return BeadGrid(width: width, height: height, boardSize: settings.boardSize, cells: mapped)
    }

    private static func cell(for color: PaletteColor) -> BeadCell {
        BeadCell(code: color.code, rgb: color.rgb)
    }

    // MARK: - 格内采样

    private static func sampleCells(
        buffer: PixelBuffer,
        width: Int,
        height: Int,
        mode: SampleMode
    ) -> [RGB8?] {
        let sx = Double(buffer.width) / Double(width)
        let sy = Double(buffer.height) / Double(height)
        var samples = [RGB8?](repeating: nil, count: width * height)

        for y in 0..<height {
            let y0 = Int(floor(Double(y) * sy))
            var y1 = max(y0 + 1, Int(floor(Double(y + 1) * sy)))
            y1 = min(y1, buffer.height)

            for x in 0..<width {
                let x0 = Int(floor(Double(x) * sx))
                var x1 = max(x0 + 1, Int(floor(Double(x + 1) * sx)))
                x1 = min(x1, buffer.width)

                samples[y * width + x] = regionStats(
                    buffer: buffer,
                    x0: x0, y0: y0, x1: x1, y1: y1,
                    mode: mode
                )
            }
        }
        return samples
    }

    /// 格内主导色（出现次数最多），颜色分散时退化为 5bit 桶均值。
    private static func regionStats(
        buffer: PixelBuffer,
        x0: Int,
        y0: Int,
        x1: Int,
        y1: Int,
        mode: SampleMode
    ) -> RGB8? {
        var frequencies: [Int: (n: Int, r: Int, g: Int, b: Int)] = [:]
        var bestKey: Int?
        var bestCount = 0
        var linearSum = (r: 0.0, g: 0.0, b: 0.0)
        var n = 0

        for y in y0..<y1 {
            for x in x0..<x1 {
                let p = buffer.pixel(x: x, y: y)
                if p.a < alphaCutoff { continue }
                n += 1

                switch mode {
                case .average:
                    linearSum.r += Self.linear(p.r)
                    linearSum.g += Self.linear(p.g)
                    linearSum.b += Self.linear(p.b)
                case .dominant:
                    let key = (Int(p.r) << 16) | (Int(p.g) << 8) | Int(p.b)
                    var bucket = frequencies[key] ?? (n: 0, r: Int(p.r), g: Int(p.g), b: Int(p.b))
                    bucket.n += 1
                    frequencies[key] = bucket
                    if bucket.n > bestCount {
                        bestCount = bucket.n
                        bestKey = key
                    }
                }
            }
        }

        let area = max(1, (x1 - x0) * (y1 - y0))
        guard n > 0, Double(n) >= Double(area) * opaqueRatio else { return nil }

        if mode == .average {
            let count = Double(n)
            return RGB8(
                Self.unlinear(linearSum.r / count),
                Self.unlinear(linearSum.g / count),
                Self.unlinear(linearSum.b / count)
            )
        }

        // JPEG 之类的图片精确色过于分散 → 退到 5bit 主导色
        if bestCount < 2 || (n > 40 && bestCount * 12 < n) {
            var coarse: [Int: (n: Int, r: Int, g: Int, b: Int)] = [:]
            var coarseKey: Int?
            var coarseCount = 0
            for y in y0..<y1 {
                for x in x0..<x1 {
                    let p = buffer.pixel(x: x, y: y)
                    if p.a < alphaCutoff { continue }
                    let key = (Int(p.r >> 3) << 10) | (Int(p.g >> 3) << 5) | Int(p.b >> 3)
                    var bucket = coarse[key] ?? (n: 0, r: 0, g: 0, b: 0)
                    bucket.n += 1
                    bucket.r += Int(p.r)
                    bucket.g += Int(p.g)
                    bucket.b += Int(p.b)
                    coarse[key] = bucket
                    if bucket.n > coarseCount {
                        coarseCount = bucket.n
                        coarseKey = key
                    }
                }
            }
            if let coarseKey, let winner = coarse[coarseKey], winner.n > 0 {
                return RGB8(
                    UInt8(winner.r / winner.n),
                    UInt8(winner.g / winner.n),
                    UInt8(winner.b / winner.n)
                )
            }
        }

        guard let bestKey, let top = frequencies[bestKey] else { return nil }
        return RGB8(UInt8(top.r), UInt8(top.g), UInt8(top.b))
    }

    private static func linear(_ value: UInt8) -> Double {
        let c = Double(value) / 255
        return c > 0.04045 ? pow((c + 0.055) / 1.055, 2.4) : c / 12.92
    }

    private static func unlinear(_ value: Double) -> UInt8 {
        let c = value > 0.0031308 ? 1.055 * pow(value, 1 / 2.4) - 0.055 : 12.92 * value
        return UInt8(min(max(c * 255, 0), 255).rounded())
    }

    /// 抗锯齿灰边：很暗→黑、很亮且灰→白，避免描边发毛。
    private static func cleanSample(_ rgb: RGB8) -> RGB8 {
        let maxChannel = max(rgb.r, max(rgb.g, rgb.b))
        let minChannel = min(rgb.r, min(rgb.g, rgb.b))
        let chroma = Int(maxChannel) - Int(minChannel)
        let luma = 0.299 * Double(rgb.r) + 0.587 * Double(rgb.g) + 0.114 * Double(rgb.b)

        if luma < 42, chroma < 55 { return RGB8(0, 0, 0) }
        if luma > 242, chroma < 28 { return RGB8(255, 255, 255) }
        return rgb
    }

    // MARK: - 抖动

    private static func applyDither(
        samples: [RGB8?],
        width: Int,
        height: Int,
        palette: BeadPalette
    ) -> [BeadCell] {
        var buffer = [Double](repeating: 0, count: width * height * 3)
        for i in 0..<(width * height) {
            guard let sample = samples[i] else { continue }
            buffer[i * 3] = Double(sample.r)
            buffer[i * 3 + 1] = Double(sample.g)
            buffer[i * 3 + 2] = Double(sample.b)
        }

        var mapped = [BeadCell](repeating: .empty, count: width * height)

        for y in 0..<height {
            for x in 0..<width {
                let index = y * width + x
                guard samples[index] != nil else {
                    mapped[index] = .empty
                    continue
                }

                let r = clampByte(buffer[index * 3])
                let g = clampByte(buffer[index * 3 + 1])
                let b = clampByte(buffer[index * 3 + 2])

                let color = palette.nearest(to: RGB8(r, g, b))
                mapped[index] = cell(for: color)

                let er = Int(r) - Int(color.rgb.r)
                let eg = Int(g) - Int(color.rgb.g)
                let eb = Int(b) - Int(color.rgb.b)

                distribute(&buffer, width, height, x + 1, y, er, eg, eb, 7.0 / 16)
                distribute(&buffer, width, height, x - 1, y + 1, er, eg, eb, 3.0 / 16)
                distribute(&buffer, width, height, x, y + 1, er, eg, eb, 5.0 / 16)
                distribute(&buffer, width, height, x + 1, y + 1, er, eg, eb, 1.0 / 16)
            }
        }
        return mapped
    }

    private static func distribute(
        _ buffer: inout [Double],
        _ width: Int,
        _ height: Int,
        _ x: Int,
        _ y: Int,
        _ er: Int,
        _ eg: Int,
        _ eb: Int,
        _ factor: Double
    ) {
        guard x >= 0, y >= 0, x < width, y < height else { return }
        let index = (y * width + x) * 3
        buffer[index] += Double(er) * factor
        buffer[index + 1] += Double(eg) * factor
        buffer[index + 2] += Double(eb) * factor
    }

    private static func clampByte(_ value: Double) -> UInt8 {
        UInt8(min(max(value, 0), 255).rounded(.towardZero))
    }

    // MARK: - 相似色连通域合并

    /// BFS 连通域：域内任意相邻格 RGB 欧氏距离小于阈值即视为同域，整域取出现最多的色号。
    static func mergeSimilarRegions(
        _ mapped: [BeadCell],
        width: Int,
        height: Int,
        threshold: Int
    ) -> [BeadCell] {
        let total = width * height
        var visited = [Bool](repeating: false, count: total)
        let thresholdSquared = threshold * threshold
        var out = mapped
        let dirs = [(1, 0), (-1, 0), (0, 1), (0, -1)]

        for start in 0..<total where !visited[start] {
            if mapped[start].isEmpty {
                visited[start] = true
                continue
            }

            var queue = [start]
            var region: [Int] = []
            var codeCounts: [String: Int] = [:]
            var head = 0
            visited[start] = true

            while head < queue.count {
                let current = queue[head]
                head += 1
                region.append(current)

                let base = mapped[current]
                codeCounts[base.code, default: 0] += 1

                let cx = current % width
                let cy = current / width

                for (dx, dy) in dirs {
                    let nx = cx + dx
                    let ny = cy + dy
                    guard nx >= 0, ny >= 0, nx < width, ny < height else { continue }
                    let ni = ny * width + nx
                    guard !visited[ni] else { continue }
                    let candidate = mapped[ni]
                    if candidate.isEmpty { continue }
                    if base.rgb.squaredDistance(to: candidate.rgb) > thresholdSquared { continue }
                    visited[ni] = true
                    queue.append(ni)
                }
            }

            // 整域取出现次数最多的色号
            var bestCode = mapped[region[0]].code
            var bestN = 0
            for (code, count) in codeCounts where count > bestN {
                bestN = count
                bestCode = code
            }
            let winner = mapped[region.first { mapped[$0].code == bestCode } ?? region[0]]
            for index in region {
                out[index] = winner
            }
        }
        return out
    }

    // MARK: - 限色

    /// 只保留用量最多的 `maxColors` 个色号，其余格重映射到保留色中的最近色。
    static func limitColors(
        _ mapped: [BeadCell],
        samples: [RGB8?],
        maxColors: Int,
        palette: BeadPalette
    ) -> [BeadCell] {
        var counts: [String: Int] = [:]
        var sampleByCode: [String: BeadCell] = [:]
        for cell in mapped where !cell.isEmpty {
            counts[cell.code, default: 0] += 1
            sampleByCode[cell.code] = cell
        }

        guard counts.count > maxColors else { return mapped }

        let ranked = counts.sorted { $0.value > $1.value }.map(\.key)
        let keptCodes = Array(ranked.prefix(maxColors))
        let keptSet = Set(keptCodes)
        let keptColors = keptCodes.compactMap { palette.color(for: $0) }
        guard !keptColors.isEmpty else { return mapped }

        var out = mapped
        for i in out.indices where !out[i].isEmpty {
            guard !keptSet.contains(out[i].code) else { continue }
            guard let sample = samples[i] else { continue }
            out[i] = cell(for: palette.nearest(to: sample, among: keptColors))
        }
        return out
    }
}
