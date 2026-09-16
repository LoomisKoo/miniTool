import Foundation
import CoreGraphics
import CoreImage
import CoreImage.CIFilterBuiltins
import PhotosUI
import SwiftUI
import UniformTypeIdentifiers
import UIKit
import Vision

enum ImageImportError: LocalizedError {
    case decodeFailed
    case backgroundRemovalFailed
    case pickerFailed

    var errorDescription: String? {
        switch self {
        case .decodeFailed:
            "这张图片无法读取，换一张试试。".loc
        case .backgroundRemovalFailed:
            "去背景失败，换一张主体更清晰的图试试。".loc
        case .pickerFailed:
            "读取不到这张图片，换一张或先在「照片」里打开下载后再试。".loc
        }
    }
}

/// PhotosPicker 用 `.image` 导入；直接 `Data.self` 在 HEIC / iCloud 图上常报 TransferableSupportError。
struct PickedImageData: Transferable {
    let data: Data

    static var transferRepresentation: some TransferRepresentation {
        DataRepresentation(importedContentType: .image) { data in
            PickedImageData(data: data)
        }
    }
}

enum ImageImport {
    /// 从相册选中项读取图片（优先 `.image`，再回退 `Data`）。
    static func cgImage(from item: PhotosPickerItem, maxSide: CGFloat = 2400) async throws -> CGImage {
        if let picked = try? await item.loadTransferable(type: PickedImageData.self) {
            return try cgImage(from: picked.data, maxSide: maxSide)
        }
        if let data = try? await item.loadTransferable(type: Data.self) {
            return try cgImage(from: data, maxSide: maxSide)
        }
        throw ImageImportError.pickerFailed
    }

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

    /// 用 Vision 抠前景，背景变透明（量化时透明格不铺豆）。
    static func removeBackground(from image: CGImage) async throws -> CGImage {
        try await Task.detached(priority: .userInitiated) {
            let request = VNGenerateForegroundInstanceMaskRequest()
            let handler = VNImageRequestHandler(cgImage: image, options: [:])
            try handler.perform([request])
            guard let observation = request.results?.first else {
                throw ImageImportError.backgroundRemovalFailed
            }
            let maskBuffer = try observation.generateScaledMaskForImage(
                forInstances: observation.allInstances,
                from: handler
            )

            let ciImage = CIImage(cgImage: image)
            let mask = CIImage(cvPixelBuffer: maskBuffer)
            let filter = CIFilter.blendWithMask()
            filter.inputImage = ciImage
            filter.backgroundImage = CIImage(color: .clear).cropped(to: ciImage.extent)
            filter.maskImage = mask

            guard let output = filter.outputImage else {
                throw ImageImportError.backgroundRemovalFailed
            }
            let context = CIContext(options: [.useSoftwareRenderer: false])
            guard let cgImage = context.createCGImage(output, from: output.extent) else {
                throw ImageImportError.backgroundRemovalFailed
            }
            return cgImage
        }.value
    }

    /// 作品列表缩略图：等比缩到 `maxSide` 像素内，铺白底再画（源图可能带透明）。
    static func thumbnail(from image: CGImage, maxSide: CGFloat = 480) -> UIImage? {
        let width = CGFloat(image.width)
        let height = CGFloat(image.height)
        guard width > 0, height > 0 else { return nil }

        let longest = max(width, height)
        let ratio = longest > maxSide ? maxSide / longest : 1
        let size = CGSize(
            width: max(1, (width * ratio).rounded()),
            height: max(1, (height * ratio).rounded())
        )

        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        format.opaque = true

        return UIGraphicsImageRenderer(size: size, format: format).image { context in
            context.cgContext.setFillColor(UIColor.white.cgColor)
            context.cgContext.fill(CGRect(origin: .zero, size: size))
            UIImage(cgImage: image).draw(in: CGRect(origin: .zero, size: size))
        }
    }
}
