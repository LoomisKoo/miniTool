import CoreGraphics
import SwiftUI

/// 裁切比例预设。
struct CropRatio: Identifiable, Equatable {
    let id: String
    let label: String
    let width: CGFloat?
    let height: CGFloat?
    
    var aspectRatio: CGFloat? {
        guard let w = width, let h = height else { return nil }
        return w / h
    }
    
    static let presets: [CropRatio] = [
        CropRatio(id: "orig", label: "原始", width: nil, height: nil),
        CropRatio(id: "1:1", label: "1:1", width: 1, height: 1),
        CropRatio(id: "3:4", label: "3:4", width: 3, height: 4),
        CropRatio(id: "4:3", label: "4:3", width: 4, height: 3),
        CropRatio(id: "9:16", label: "9:16", width: 9, height: 16),
        CropRatio(id: "16:9", label: "16:9", width: 16, height: 9),
        CropRatio(id: "free", label: "自由", width: nil, height: nil)
    ]
}

/// 裁切区域（相对源图归一化坐标，0-1范围）。
struct CropRect: Codable, Equatable {
    var x: CGFloat
    var y: CGFloat
    var width: CGFloat
    var height: CGFloat
    
    /// 完整图片（未裁切）。
    static let full = CropRect(x: 0, y: 0, width: 1, height: 1)
    
    /// 是否接近完整图片。
    var isFull: Bool {
        x <= 0.002 && y <= 0.002 && width >= 0.996 && height >= 0.996
    }
    
    /// 转换为 CGRect。
    func toCGRect(in imageSize: CGSize) -> CGRect {
        CGRect(
            x: x * imageSize.width,
            y: y * imageSize.height,
            width: width * imageSize.width,
            height: height * imageSize.height
        )
    }
    
    /// 从 CGRect 创建（归一化）。
    static func from(_ rect: CGRect, in imageSize: CGSize) -> CropRect {
        CropRect(
            x: rect.minX / imageSize.width,
            y: rect.minY / imageSize.height,
            width: rect.width / imageSize.width,
            height: rect.height / imageSize.height
        )
    }
}

/// 裁切变换状态。
struct CropTransform: Equatable {
    /// 缩放（源图像素 → 屏幕像素）。
    var scale: CGFloat = 1

    /// 偏移（屏幕坐标）。
    var offset: CGSize = .zero
    
    /// 旋转角度（弧度，顺时针为正）。
    var rotation: CGFloat = 0
    
    /// 水平翻转。
    var isFlipped: Bool = false
    
    /// 重置为初始状态。
    mutating func reset() {
        scale = 1
        offset = .zero
        rotation = 0
        isFlipped = false
    }
    
    /// 旋转 90 度。
    mutating func rotate90() {
        rotation += .pi / 2
        // 归一化到 [0, 2π)
        rotation = rotation.truncatingRemainder(dividingBy: .pi * 2)
        if rotation < 0 {
            rotation += .pi * 2
        }
    }
    
    /// 切换翻转状态。
    mutating func toggleFlip() {
        isFlipped.toggle()
    }
}

/// 裁切页面的产物：已按旋转 / 镜像渲染并裁好的图，加上用于累积的归一化区域。
struct CropOutput {
    /// 渲染后的工作图（旋转 / 镜像已落到像素上）。
    let image: CGImage
    /// 相对源图归一化的裁切区域，下次打开裁切页基于它初始化。
    let rect: CropRect
    /// 覆盖全图且未旋转 / 未镜像：可直接回填原图，避免重采样。
    let isOriginal: Bool
}
