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

        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            PHPhotoLibrary.shared().performChanges {
                PHAssetCreationRequest.forAsset().addResource(
                    with: .photo,
                    data: image.pngData() ?? Data(),
                    options: nil
                )
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
