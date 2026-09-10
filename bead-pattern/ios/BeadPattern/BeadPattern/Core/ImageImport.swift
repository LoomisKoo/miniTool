import CoreGraphics
import UIKit

enum ImageImportError: LocalizedError {
    case decodeFailed

    var errorDescription: String? {
        "这张图片无法读取，换一张试试。"
    }
}

enum ImageImport {
    /// 相册数据 → 方向已归一的 CGImage。
    ///
    /// `UIImage.cgImage` 会丢掉 EXIF 方向，直接量化会把竖拍照片画横，所以先重绘一遍。
    static func cgImage(from data: Data, maxSide: CGFloat = 2400) throws -> CGImage {
        guard let image = UIImage(data: data) else { throw ImageImportError.decodeFailed }
        return try normalized(image, maxSide: maxSide)
    }

    static func normalized(_ image: UIImage, maxSide: CGFloat = 2400) throws -> CGImage {
        let pixelW = image.size.width * image.scale
        let pixelH = image.size.height * image.scale
        guard pixelW > 0, pixelH > 0 else { throw ImageImportError.decodeFailed }

        let longest = max(pixelW, pixelH)
        let ratio = longest > maxSide ? maxSide / longest : 1
        let width = max(1, Int((pixelW * ratio).rounded()))
        let height = max(1, Int((pixelH * ratio).rounded()))

        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        format.opaque = false

        let renderer = UIGraphicsImageRenderer(size: CGSize(width: width, height: height), format: format)
        let redrawn = renderer.image { _ in
            image.draw(in: CGRect(x: 0, y: 0, width: width, height: height))
        }

        guard let cgImage = redrawn.cgImage else { throw ImageImportError.decodeFailed }
        return cgImage
    }
}
