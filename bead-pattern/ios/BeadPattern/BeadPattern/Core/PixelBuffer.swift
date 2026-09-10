import CoreGraphics
import Foundation

/// 降采样后的 RGBA 像素缓冲。用于格内采样，替代 H5 端的 canvas getImageData。
struct PixelBuffer {
    let width: Int
    let height: Int
    /// 非预乘的 RGBA8，按行优先排列。
    let pixels: [UInt8]

    @inline(__always)
    func pixel(x: Int, y: Int) -> (r: UInt8, g: UInt8, b: UInt8, a: UInt8) {
        let o = (y * width + x) * 4
        return (pixels[o], pixels[o + 1], pixels[o + 2], pixels[o + 3])
    }

    /// 等比缩到 `maxSide` 以内再取像素，避免大图全尺寸解码。
    /// 用最近邻（`interpolationQuality = .none`），与 H5 端一致：边界不接受插值糊成的灰边。
    static func make(from image: CGImage, maxSide: Int = 1400) -> PixelBuffer? {
        let sourceW = image.width
        let sourceH = image.height
        guard sourceW > 0, sourceH > 0 else { return nil }

        let side = max(sourceW, sourceH)
        let scale = side > maxSide ? Double(maxSide) / Double(side) : 1
        let width = max(1, Int((Double(sourceW) * scale).rounded()))
        let height = max(1, Int((Double(sourceH) * scale).rounded()))

        var raw = [UInt8](repeating: 0, count: width * height * 4)
        let colorSpace = CGColorSpace(name: CGColorSpace.sRGB) ?? CGColorSpaceCreateDeviceRGB()
        let bitmapInfo = CGImageAlphaInfo.premultipliedLast.rawValue

        let ok: Bool = raw.withUnsafeMutableBytes { buffer -> Bool in
            guard let base = buffer.baseAddress,
                  let ctx = CGContext(
                      data: base,
                      width: width,
                      height: height,
                      bitsPerComponent: 8,
                      bytesPerRow: width * 4,
                      space: colorSpace,
                      bitmapInfo: bitmapInfo
                  ) else { return false }
            ctx.interpolationQuality = .none
            ctx.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
            return true
        }
        guard ok else { return nil }

        // 还原非预乘颜色，跳过完全透明的像素。
        for i in stride(from: 0, to: raw.count, by: 4) {
            let a = raw[i + 3]
            if a == 0 || a == 255 { continue }
            let alpha = Int(a)
            raw[i] = UInt8(min(255, Int(raw[i]) * 255 / alpha))
            raw[i + 1] = UInt8(min(255, Int(raw[i + 1]) * 255 / alpha))
            raw[i + 2] = UInt8(min(255, Int(raw[i + 2]) * 255 / alpha))
        }

        return PixelBuffer(width: width, height: height, pixels: raw)
    }
}
