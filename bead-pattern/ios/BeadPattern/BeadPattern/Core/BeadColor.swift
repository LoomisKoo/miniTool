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

    private func linear(_ value: UInt8) -> Double {
        let c = Double(value) / 255
        return c > 0.04045 ? pow((c + 0.055) / 1.055, 2.4) : c / 12.92
    }

    /// WCAG 相对亮度（0…1）。
    var relativeLuminance: Double {
        0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
    }

    /// 叠在本色上的文字该用深色还是浅色。
    ///
    /// 按 WCAG 对比度取更清楚的一侧，黑白对比度相等时 `L ≈ 0.179`。
    /// 图纸上的色号、预览里的格内编号都按这个选色，
    /// 否则深色豆上的黑字（或浅色豆上的白字）会看不出来。
    var prefersDarkOverlayText: Bool {
        relativeLuminance > 0.179
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
