import Foundation

/// 8 位 sRGB 颜色。
struct RGB8: Hashable, Sendable {
    var r: UInt8
    var g: UInt8
    var b: UInt8

    init(_ r: UInt8, _ g: UInt8, _ b: UInt8) {
        self.r = r
        self.g = g
        self.b = b
    }

    var hex: String {
        String(format: "#%02X%02X%02X", r, g, b)
    }

    /// 5bit 量化 key，用于 JPEG 那种颜色过于分散时的降级统计。
    var coarseKey: Int {
        (Int(r >> 3) << 10) | (Int(g >> 3) << 5) | Int(b >> 3)
    }

    /// sRGB 空间的平方欧氏距离（拼豆端用于相似色连通域合并，与 Oklab 无关）。
    func squaredDistance(to other: RGB8) -> Int {
        let dr = Int(r) - Int(other.r)
        let dg = Int(g) - Int(other.g)
        let db = Int(b) - Int(other.b)
        return dr * dr + dg * dg + db * db
    }

    /// 向另一个颜色线性插值，`t` 取 0…1。
    func mixed(with other: RGB8, t: Double) -> RGB8 {
        let k = min(max(t, 0), 1)
        func blend(_ a: UInt8, _ b: UInt8) -> UInt8 {
            UInt8((Double(a) + (Double(b) - Double(a)) * k).rounded())
        }
        return RGB8(blend(r, other.r), blend(g, other.g), blend(b, other.b))
    }

    /// 明暗调整：负数加深、正数提亮（与 H5 端 `shadeHex` 一致）。
    func shaded(_ factor: Double) -> RGB8 {
        if factor < 0 {
            return mixed(with: RGB8(0, 0, 0), t: min(1, -factor))
        }
        return mixed(with: RGB8(255, 255, 255), t: min(1, factor))
    }

    /// 加权亮度（0…255），与 H5 端 `luma(hex)` 同公式。
    var luma: Double {
        0.299 * Double(r) + 0.587 * Double(g) + 0.114 * Double(b)
    }

    /// 叠在本色上的色号该用深色还是浅色。
    ///
    /// 沿用 H5 端口径（`luma > 160` 用深字），这样 App 与小工具的
    /// 预览格内编号、导出图纸色号选色完全一致。
    var wantsDarkOverlayText: Bool {
        luma > 160
    }

    /// 图纸图例色块内的色号颜色。与 H5 端 `contrastInk` 的三档阈值一致。
    var legendInk: RGB8 {
        // H5 用整数除法：y = (r*299 + g*587 + b*114) / 1000
        let y = (299 * Int(r) + 587 * Int(g) + 114 * Int(b)) / 1000
        if y >= 170 { return RGB8(0x1A, 0x1A, 0x1A) }
        if y <= 90 { return RGB8(255, 255, 255) }
        return y >= 140 ? RGB8(0x11, 0x11, 0x11) : RGB8(255, 255, 255)
    }
}

/// Oklab 感知色彩空间。与 H5 端一致，用于拼豆最近色匹配。
struct Oklab: Hashable, Sendable {
    var l: Double
    var a: Double
    var b: Double

    private static func srgbToLinear(_ value: UInt8) -> Double {
        let c = Double(value) / 255
        return c > 0.04045 ? pow((c + 0.055) / 1.055, 2.4) : c / 12.92
    }

    private static func linearToSrgb(_ value: Double) -> UInt8 {
        let c = value > 0.0031308 ? 1.055 * pow(value, 1 / 2.4) - 0.055 : 12.92 * value
        return UInt8(min(max(c * 255, 0), 255).rounded())
    }

    init(rgb: RGB8) {
        let r = Self.srgbToLinear(rgb.r)
        let g = Self.srgbToLinear(rgb.g)
        let b = Self.srgbToLinear(rgb.b)

        let l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
        let m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
        let s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b

        let l_ = cbrt(l)
        let m_ = cbrt(m)
        let s_ = cbrt(s)

        self.l = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_
        self.a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_
        self.b = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
    }

    func squaredDistance(to other: Oklab) -> Double {
        let dl = l - other.l
        let da = a - other.a
        let db = b - other.b
        return dl * dl + da * da + db * db
    }

    /// 色相分桶：8 个色相段 + 1 个灰阶段（索引 8），用于限色时保证色相覆盖。
    /// 与 H5 端 `colorHueBucket` 一致。
    var hueBucket: Int {
        let chroma = (a * a + b * b).squareRoot()
        if chroma < 0.02 { return 8 }
        let hue = atan2(b, a) // -π…π
        let bucket = Int(floor((hue + Double.pi) / (Double.pi / 4)))
        return min(bucket, 7)
    }

    /// sRGB 线性空间的均值还原，用于「均值」采样模式。
    static func averaged(_ pixels: [RGB8]) -> RGB8 {
        guard !pixels.isEmpty else { return RGB8(0, 0, 0) }
        var r = 0.0, g = 0.0, b = 0.0
        for p in pixels {
            r += srgbToLinear(p.r)
            g += srgbToLinear(p.g)
            b += srgbToLinear(p.b)
        }
        let n = Double(pixels.count)
        return RGB8(linearToSrgb(r / n), linearToSrgb(g / n), linearToSrgb(b / n))
    }
}
