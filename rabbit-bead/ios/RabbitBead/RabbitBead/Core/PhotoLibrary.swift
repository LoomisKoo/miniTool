import Foundation
import Photos
import UIKit

/// 相册写入。只申请「仅添加」权限，避免不必要的相册读取授权。
enum PhotoLibrary {

    enum SaveError: LocalizedError {
        case denied
        case failed(String)

        var errorDescription: String? {
            switch self {
            case .denied: "没有相册写入权限，可在「设置 → 隐私与安全性 → 照片」中开启。".loc
            case .failed(let reason): "保存失败：%@".loc(reason)
            }
        }
    }

    static func save(_ image: UIImage) async throws {
        let status = PHPhotoLibrary.authorizationStatus(for: .addOnly)
        let granted: PHAuthorizationStatus
        if status == .notDetermined {
            granted = await PHPhotoLibrary.requestAuthorization(for: .addOnly)
        } else {
            granted = status
        }

        guard granted == .authorized || granted == .limited else {
            throw SaveError.denied
        }

        // 编码放在写相册之前，失败直接报错，不进 performChanges
        guard let data = JpegEncoder.data(from: image, dpi: BeadArtworkRenderer.printDPI) else {
            throw SaveError.failed("图纸编码失败".loc)
        }

        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            PHPhotoLibrary.shared().performChanges {
                PHAssetCreationRequest.forAsset().addResource(
                    with: .photo,
                    data: data,
                    options: nil
                )
            } completionHandler: { success, error in
                if success {
                    continuation.resume()
                } else {
                    continuation.resume(throwing: SaveError.failed(error?.localizedDescription ?? "未知错误".loc))
                }
            }
        }
    }
}

/// 图纸编码：JPEG + JFIF 密度，与 H5 端 `toDataURL('image/jpeg')` + `jpegDataUrlWithDpi` 对齐。
///
/// 用 JPEG 而不是 PNG，一是和 H5 产物一致，二是 300 DPI 得靠 JFIF 密度段
/// 才能在打印时按「实际大小」还原成 5mm/格（PNG 的 pHYs 系统相册不认）。
enum JpegEncoder {
    /// 按面积挑质量档，与 H5 `exportDataUrl` 一致（图越大压得越狠，避免写盘失败）。
    private static func quality(pixelArea: Int) -> CGFloat {
        if pixelArea > 8_000_000 { return 0.72 }
        if pixelArea > 3_500_000 { return 0.82 }
        return 0.92
    }

    static func data(from image: UIImage, dpi: Int) -> Data? {
        let area = Int(image.size.width * image.scale) * Int(image.size.height * image.scale)
        guard let jpeg = image.jpegData(compressionQuality: quality(pixelArea: area)) else {
            return image.pngData()
        }
        return patchDPI(jpeg, dpi: dpi) ?? jpeg
    }

    /// 改写 APP0/JFIF 的密度字段（units=1 表示 DPI）。找不到 JFIF 段就原样返回。
    private static func patchDPI(_ data: Data, dpi: Int) -> Data? {
        var bytes = [UInt8](data)
        guard bytes.count > 20, bytes[0] == 0xFF, bytes[1] == 0xD8 else { return nil }

        // SOI 之后逐段找 APP0，段结构：FF En | lenHi lenLo | payload
        var offset = 2
        while offset + 4 <= bytes.count, bytes[offset] == 0xFF {
            let marker = bytes[offset + 1]
            if marker == 0xDA { break } // 进入扫描数据，后面不再有 APPn
            let length = Int(bytes[offset + 2]) << 8 | Int(bytes[offset + 3])
            guard length >= 2, offset + 2 + length <= bytes.count else { return nil }
            if marker == 0xE0, length >= 16 {
                let payload = offset + 4
                let isJFIF = bytes[payload] == 0x4A && bytes[payload + 1] == 0x46
                    && bytes[payload + 2] == 0x49 && bytes[payload + 3] == 0x46
                    && bytes[payload + 4] == 0x00
                if isJFIF {
                    bytes[payload + 7] = 1 // units: 1 = dots per inch
                    bytes[payload + 8] = UInt8((dpi >> 8) & 0xFF)
                    bytes[payload + 9] = UInt8(dpi & 0xFF)
                    bytes[payload + 10] = UInt8((dpi >> 8) & 0xFF)
                    bytes[payload + 11] = UInt8(dpi & 0xFF)
                    return Data(bytes)
                }
            }
            offset += 2 + length
        }
        return nil
    }
}
