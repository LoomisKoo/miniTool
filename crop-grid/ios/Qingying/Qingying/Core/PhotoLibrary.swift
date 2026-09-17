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
            case .denied: "没有相册写入权限，可在「设置 → 隐私与安全性 → 照片」中开启。"
            case .failed(let reason): "保存失败：\(reason)"
            }
        }
    }

    /// 待保存的一张图。
    struct Item {
        let image: UIImage
        /// true 用 PNG（保透明），false 用 JPEG。
        let keepsAlpha: Bool
    }

    static func save(_ items: [Item]) async throws {
        guard !items.isEmpty else { return }

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

        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            PHPhotoLibrary.shared().performChanges {
                for item in items {
                    let data = item.keepsAlpha
                        ? item.image.pngData()
                        : item.image.jpegData(compressionQuality: 0.92)
                    guard let data else { continue }
                    PHAssetCreationRequest.forAsset().addResource(
                        with: .photo,
                        data: data,
                        options: nil
                    )
                }
            } completionHandler: { success, error in
                if success {
                    continuation.resume()
                } else {
                    continuation.resume(throwing: SaveError.failed(error?.localizedDescription ?? "未知错误"))
                }
            }
        }
    }
}
