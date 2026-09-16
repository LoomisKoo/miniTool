import CoreGraphics
import Foundation

/// 图像 → 拼豆格子的量化管线。
///
/// 与 H5 端 `rabbit-bead/app.js` 的 `mapImage()` 流程保持一致：
/// 格内采样 → 去灰边 → 最近色匹配（或抖动）→ 相似色连通域合并 → 限色。
/// 改动任一步都会导致两端成品不同，改前先看 `docs/ios/development.md`。
enum BeadQuantizer {

    // 与 H5 端一致的常量
    private static let alphaCutoff: UInt8 = 128
    private static let opaqueRatio = 0.4
    private static let sourceMaxSide = 1400

    /// 建议的采样模式：5bit 桶颜色数少（卡通/插画，描边 + 大色块）用主色保锐利，
    /// 颜色数多（照片，渐变 + 噪声）用均值降色差。与 H5 端 `readSourcePixels` 的口径一致。
    static func suggestedSampleMode(for image: CGImage) -> SampleMode {
        guard let buffer = PixelBuffer.make(from: image, maxSide: sourceMaxSide) else { return .dominant }
        var seen = [Bool](repeating: false, count: 32768)
        var colorCount = 0
        let pixels = buffer.pixels
        var i = 0
        while i < pixels.count {
            if pixels[i + 3] >= alphaCutoff {
                let key = (Int(pixels[i] >> 3) << 10) | (Int(pixels[i + 1] >> 3) << 5) | Int(pixels[i + 2] >> 3)
                if !seen[key] {
                    seen[key] = true
                    colorCount += 1
                }
            }
            i += 4
        }
        return colorCount < 3000 ? .dominant : .average
    }

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

    /// 单格直方图容器：定长数组 + 线性探测，跨格复用。
    ///
    /// 采样是整条量化管线里唯一的瓶颈（实测占 95%+）。原实现每格 new 一个
    /// `Dictionary`（一张 1400px 的图有上千个字典、上百万次哈希），
    /// 这里换成数组 + 递增 stamp：「清空」只是把 stamp 加一，完全不碰内存。
    private final class CellHistogram {
        /// 精确色（24bit）直方图。每槽位 4 个 Int32：key / count / stamp / 备用，
        /// 合成一条数组是为了探测时只碰一条缓存行。
        private var slots: [Int32]
        private var stamp: Int32 = 0
        private let mask: Int

        /// 5bit 粗桶（精确色过于分散时的降级路径）。
        /// 每桶 8 个 Int32（对齐到整块）：count / r / g / b / stamp / 备用。
        private var coarse: [Int32]
        private var coarseStamp: Int32 = 0

        var bestKey = 0
        var bestCount: Int32 = 0
        var coarseBestKey = 0
        var coarseBestCount: Int32 = 0

        init(maxArea: Int) {
            var capacity = 16
            while capacity < maxArea * 2 { capacity <<= 1 }
            mask = capacity - 1
            slots = [Int32](repeating: 0, count: capacity * 4)
            coarse = [Int32](repeating: 0, count: 32768 * 8)
        }

        func reset() {
            stamp &+= 1
            coarseStamp &+= 1
            bestCount = 0
            coarseBestCount = 0
        }

        @inline(__always)
        func addExact(_ key: Int32) {
            var slot = ((Int(key) &* 0x9E37_79B1) & mask) * 4
            while slots[slot + 2] == stamp {
                if slots[slot] == key {
                    let next = slots[slot + 1] + 1
                    slots[slot + 1] = next
                    if next > bestCount {
                        bestCount = next
                        bestKey = Int(key)
                    }
                    return
                }
                slot = (((slot >> 2) + 1) & mask) * 4
            }
            slots[slot + 2] = stamp
            slots[slot] = key
            slots[slot + 1] = 1
            if bestCount == 0 {
                bestCount = 1
                bestKey = Int(key)
            }
        }

        @inline(__always)
        func addCoarse(_ key: Int, _ r: Int32, _ g: Int32, _ b: Int32) {
            let base = key << 3
            if coarse[base + 4] != coarseStamp {
                coarse[base + 4] = coarseStamp
                coarse[base] = 0
                coarse[base + 1] = 0
                coarse[base + 2] = 0
                coarse[base + 3] = 0
            }
            let next = coarse[base] + 1
            coarse[base] = next
            coarse[base + 1] += r
            coarse[base + 2] += g
            coarse[base + 3] += b
            if next > coarseBestCount {
                coarseBestCount = next
                coarseBestKey = key
            }
        }

        @inline(__always)
        func coarseCount(_ key: Int) -> Int32 {
            coarse[key << 3]
        }

        @inline(__always)
        func coarseSum(_ key: Int, _ channel: Int) -> Int32 {
            coarse[(key << 3) + 1 + channel]
        }
    }

    private static func sampleCells(
        buffer: PixelBuffer,
        width: Int,
        height: Int,
        mode: SampleMode
    ) -> [RGB8?] {
        let sx = Double(buffer.width) / Double(width)
        let sy = Double(buffer.height) / Double(height)
        var samples = [RGB8?](repeating: nil, count: width * height)

        let hist = CellHistogram(maxArea: max(4, Int(ceil(sx)) * Int(ceil(sy)) + 4))
        let bufferWidth = buffer.width
        let bufferHeight = buffer.height

        // 整图取一次裸指针，循环里不再走数组边界检查
        buffer.pixels.withUnsafeBufferPointer { pixels in
            for y in 0..<height {
                let y0 = Int(floor(Double(y) * sy))
                var y1 = max(y0 + 1, Int(floor(Double(y + 1) * sy)))
                y1 = min(y1, bufferHeight)

                for x in 0..<width {
                    let x0 = Int(floor(Double(x) * sx))
                    var x1 = max(x0 + 1, Int(floor(Double(x + 1) * sx)))
                    x1 = min(x1, bufferWidth)

                    samples[y * width + x] = regionStats(
                        pixels: pixels,
                        width: bufferWidth,
                        x0: x0, y0: y0, x1: x1, y1: y1,
                        mode: mode,
                        hist: hist
                    )
                }
            }
        }
        return samples
    }

    /// 格内取色，与 H5 `regionStats` 一致。
    ///
    /// - `average`：线性光均值，渐变区更柔。
    /// - `dominant`：众数；但众数占比低于 `dominantRatio`（边缘格 / JPEG 过渡色）
    ///   自动回退均值——纯色区保描边锐利，边缘格平方去杂色。
    private static func regionStats(
        pixels: UnsafeBufferPointer<UInt8>,
        width: Int,
        x0: Int,
        y0: Int,
        x1: Int,
        y1: Int,
        mode: SampleMode,
        hist: CellHistogram
    ) -> RGB8? {
        /// 众数占比低于该值就改用均值。
        let dominantRatio = 0.55

        var linearR = 0.0
        var linearG = 0.0
        var linearB = 0.0
        var n = 0

        hist.reset()

        for y in y0..<y1 {
            var offset = (y * width + x0) * 4
            for _ in x0..<x1 {
                let a = pixels[offset + 3]
                if a >= alphaCutoff {
                    let r = pixels[offset]
                    let g = pixels[offset + 1]
                    let b = pixels[offset + 2]
                    n += 1

                    // 始终累加线性均值，供边缘格回退
                    linearR += Self.linear(r)
                    linearG += Self.linear(g)
                    linearB += Self.linear(b)

                    if mode == .dominant {
                        hist.addExact(Int32(r) << 16 | Int32(g) << 8 | Int32(b))
                        hist.addCoarse(
                            Int(r >> 3) << 10 | Int(g >> 3) << 5 | Int(b >> 3),
                            Int32(r), Int32(g), Int32(b)
                        )
                    }
                }
                offset += 4
            }
        }

        let area = max(1, (x1 - x0) * (y1 - y0))
        guard n > 0, Double(n) >= Double(area) * opaqueRatio else { return nil }

        let count = Double(n)
        let average = RGB8(
            Self.unlinear(linearR / count),
            Self.unlinear(linearG / count),
            Self.unlinear(linearB / count)
        )
        if mode == .average { return average }

        // JPEG 之类的图片精确色过于分散 → 退到 5bit 桶主导色
        if hist.bestCount < 2 || (n > 40 && Int(hist.bestCount) * 12 < n) {
            guard hist.coarseBestCount > 0 else { return average }
            if Double(hist.coarseBestCount) / count < dominantRatio { return average }
            let key = hist.coarseBestKey
            let total = hist.coarseCount(key)
            return RGB8(
                UInt8(hist.coarseSum(key, 0) / total),
                UInt8(hist.coarseSum(key, 1) / total),
                UInt8(hist.coarseSum(key, 2) / total)
            )
        }

        if Double(hist.bestCount) / count < dominantRatio { return average }
        let key = hist.bestKey
        return RGB8(UInt8((key >> 16) & 0xFF), UInt8((key >> 8) & 0xFF), UInt8(key & 0xFF))
    }

    /// sRGB → 线性光的 256 项查表。
    ///
    /// 逐像素调 `pow` 是采样阶段的另一处大头，8bit 输入只有 256 种取值，直接建表。
    private static let linearTable: [Double] = (0...255).map { value in
        let c = Double(value) / 255
        return c > 0.04045 ? pow((c + 0.055) / 1.055, 2.4) : c / 12.92
    }

    @inline(__always)
    private static func linear(_ value: UInt8) -> Double {
        linearTable[Int(value)]
    }

    private static func unlinear(_ value: Double) -> UInt8 {
        let c = value > 0.0031308 ? 1.055 * pow(value, 1 / 2.4) - 0.055 : 12.92 * value
        return UInt8(min(max(c * 255, 0), 255).rounded())
    }

    /// 抗锯齿灰边：仅钳位接近纯黑/纯白的低彩度像素，避免描边发毛。
    /// 阈值放宽（luma<20、>248），保留深棕 / 米白等暗部亮部豆色。
    private static func cleanSample(_ rgb: RGB8) -> RGB8 {
        let maxChannel = max(rgb.r, max(rgb.g, rgb.b))
        let minChannel = min(rgb.r, min(rgb.g, rgb.b))
        let chroma = Int(maxChannel) - Int(minChannel)
        let luma = 0.299 * Double(rgb.r) + 0.587 * Double(rgb.g) + 0.114 * Double(rgb.b)

        if luma < 20, chroma < 25 { return RGB8(0, 0, 0) }
        if luma > 248, chroma < 18 { return RGB8(255, 255, 255) }
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

    /// BFS 连通域：域内任意相邻格 Oklab 感知距离小于阈值即视为同域，整域取出现最多的色号。
    ///
    /// 阈值口径与 H5 一致（`mergeThreshold` 是距离本身，不是 RGB 欧氏距离），
    /// 默认 0.10，和最近色匹配用同一套感知距离。
    static func mergeSimilarRegions(
        _ mapped: [BeadCell],
        width: Int,
        height: Int,
        threshold: Double
    ) -> [BeadCell] {
        let total = width * height
        var visited = [Bool](repeating: false, count: total)
        let thresholdSquared = threshold * threshold
        var out = mapped
        let dirs = [(1, 0), (-1, 0), (0, 1), (0, -1)]

        // 预算每格 Oklab，BFS 内只查表，避免重复转换
        var oklabCache = [Oklab?](repeating: nil, count: total)
        for i in 0..<total where !mapped[i].isEmpty {
            oklabCache[i] = Oklab(rgb: mapped[i].rgb)
        }

        for start in 0..<total where !visited[start] {
            if mapped[start].isEmpty {
                visited[start] = true
                continue
            }

            // 用栈（后进先出）遍历，与 H5 的 `queue.pop()` 一致：遍历顺序一致，
            // 色号的「首次出现序」才一致，并列名次才能和 H5 对齐。
            var stack = [start]
            var region: [Int] = []
            var codeOrder: [String] = []
            var codeCounts: [String: Int] = [:]
            visited[start] = true

            while let current = stack.popLast() {
                region.append(current)

                let base = mapped[current]
                if codeCounts[base.code] == nil { codeOrder.append(base.code) }
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
                    guard let a = oklabCache[current], let b = oklabCache[ni] else { continue }
                    if a.squaredDistance(to: b) > thresholdSquared { continue }
                    visited[ni] = true
                    stack.append(ni)
                }
            }

            // 整域取出现次数最多的色号
            // 颗数最多的色号胜出；并列时取先出现的（与 H5 的 `for (k in codeCount)` 一致）
            var bestCode = codeOrder[0]
            var bestN = 0
            for code in codeOrder {
                let n = codeCounts[code] ?? 0
                if n > bestN {
                    bestN = n
                    bestCode = code
                }
            }
            let winner = mapped[region.first { mapped[$0].code == bestCode } ?? region[0]]
            for index in region {
                out[index] = winner
            }
        }
        return out
    }

    // MARK: - 限色

    /// 限色：先按颗数取基础集，再保证每个色相桶至少留 1 颗，避免小面积关键色
    /// （嘴唇红、高光、眼白等）被砍后跨色相重映射。与 H5 `limitColors` 一致。
    static func limitColors(
        _ mapped: [BeadCell],
        samples: [RGB8?],
        maxColors: Int,
        palette: BeadPalette
    ) -> [BeadCell] {
        var counts: [String: Int] = [:]
        var cellsByCode: [String: BeadCell] = [:]
        var order: [String] = []
        for cell in mapped where !cell.isEmpty {
            if counts[cell.code] == nil { order.append(cell.code) }
            counts[cell.code, default: 0] += 1
            cellsByCode[cell.code] = cell
        }

        guard counts.count > maxColors else { return mapped }

        // 并列名次按「图上首次出现序」，与 H5 的稳定排序一致（不能用 Dictionary 遍历序）
        let ranked = BeadGrid.rankedCodes(order: order, counts: counts)

        let hueBuckets = 9 // 8 色相 + 1 灰阶
        let reserve = hueBuckets
        let baseKeep = max(1, maxColors - reserve)

        var keptCodes = Set<String>()
        var keptCells: [BeadCell] = []
        // 1) 按颗数取前 baseKeep 作为基础保留集
        for i in 0..<min(baseKeep, ranked.count) {
            let code = ranked[i]
            if keptCodes.insert(code).inserted, let cell = cellsByCode[code] {
                keptCells.append(cell)
            }
        }

        // 2) 色相覆盖：每个未覆盖桶强制纳入该桶内颗数最多的 code
        var coveredBuckets = Set(keptCells.map { Oklab(rgb: $0.rgb).hueBucket })
        for bucket in 0..<hueBuckets where keptCells.count < maxColors {
            if coveredBuckets.contains(bucket) { continue }
            var bestCode: String?
            for code in ranked where !keptCodes.contains(code) {
                guard let cell = cellsByCode[code], Oklab(rgb: cell.rgb).hueBucket == bucket else { continue }
                if bestCode == nil || counts[code]! > counts[bestCode!]! { bestCode = code }
            }
            if let bestCode, let cell = cellsByCode[bestCode] {
                keptCodes.insert(bestCode)
                keptCells.append(cell)
                coveredBuckets.insert(bucket)
            }
        }

        // 3) 剩余名额按颗数从高到低补
        for code in ranked where keptCells.count < maxColors {
            if keptCodes.contains(code) { continue }
            if let cell = cellsByCode[code] {
                keptCodes.insert(code)
                keptCells.append(cell)
            }
        }

        let keptColors = keptCells.compactMap { palette.color(for: $0.code) }
        guard !keptColors.isEmpty else { return mapped }

        // 4) 被砍掉的色号用原始采样色重新匹配到保留集
        var out = mapped
        for i in out.indices where !out[i].isEmpty {
            guard !keptCodes.contains(out[i].code) else { continue }
            guard let sample = samples[i] else { continue }
            out[i] = cell(for: palette.nearest(to: sample, among: keptColors))
        }
        return out
    }
}
