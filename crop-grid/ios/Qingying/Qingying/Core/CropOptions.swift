import SwiftUI
import UIKit

/// 裁切比例。对齐 H5 `RATIOS`。
struct CropRatio: Identifiable, Hashable {
    let id: String
    let label: String
    /// 宽 ÷ 高；`nil` 表示自由比例（跟随图片本身的朝向）。
    let aspect: CGFloat?

    static let all: [CropRatio] = [
        CropRatio(id: "1:1", label: "1:1", aspect: 1),
        CropRatio(id: "3:4", label: "3:4", aspect: 3.0 / 4),
        CropRatio(id: "9:16", label: "9:16", aspect: 9.0 / 16),
        CropRatio(id: "4:3", label: "4:3", aspect: 4.0 / 3),
        CropRatio(id: "16:9", label: "16:9", aspect: 16.0 / 9),
        CropRatio(id: "free", label: "自由", aspect: nil)
    ]

    static func find(_ id: String) -> CropRatio {
        all.first { $0.id == id } ?? all[0]
    }
}

/// 裁切形状。对齐 H5 `SHAPES`。
enum CropShape: String, CaseIterable, Identifiable {
    case rect
    case round
    case circle

    var id: String { rawValue }

    var label: String {
        switch self {
        case .rect: "直角"
        case .round: "圆角"
        case .circle: "圆形"
        }
    }

    /// 导出时是否要保留透明通道（圆形/圆角走 PNG）。
    var keepsAlpha: Bool { self != .rect }
}

/// 宫格分割。对齐 H5 `GRIDS`。
struct CropGrid: Identifiable, Hashable {
    let id: String
    let label: String
    let cols: Int
    let rows: Int

    var isSingle: Bool { cols == 1 && rows == 1 }
    var cellCount: Int { cols * rows }

    static let all: [CropGrid] = [
        CropGrid(id: "1", label: "单图", cols: 1, rows: 1),
        CropGrid(id: "3h", label: "横三", cols: 3, rows: 1),
        CropGrid(id: "3v", label: "竖三", cols: 1, rows: 3),
        CropGrid(id: "6a", label: "2×3", cols: 2, rows: 3),
        CropGrid(id: "6b", label: "3×2", cols: 3, rows: 2),
        CropGrid(id: "9", label: "九宫", cols: 3, rows: 3)
    ]

    static func find(_ id: String) -> CropGrid {
        all.first { $0.id == id } ?? all[0]
    }
}

/// 网格线颜色。对齐 H5 的五个预设。
struct GridLineColor: Identifiable, Hashable {
    let id: String
    let label: String
    /// 画在照片上的线色（带透明度）。
    let color: Color
    let uiColor: UIColor
    /// 色板按钮上的实色小圆点。
    let swatch: Color

    static let all: [GridLineColor] = [
        GridLineColor(
            id: "white",
            label: "白",
            color: Color.white.opacity(0.85),
            uiColor: UIColor(white: 1, alpha: 0.85),
            swatch: .white
        ),
        GridLineColor(
            id: "black",
            label: "黑",
            color: Color.black.opacity(0.7),
            uiColor: UIColor(white: 0, alpha: 0.7),
            swatch: Color(red: 28 / 255, green: 28 / 255, blue: 30 / 255)
        ),
        GridLineColor(
            id: "blue",
            label: "蓝",
            color: Color(red: 0, green: 122 / 255, blue: 1, opacity: 0.9),
            uiColor: UIColor(red: 0, green: 122 / 255, blue: 1, alpha: 0.9),
            swatch: Color(red: 0, green: 122 / 255, blue: 1)
        ),
        GridLineColor(
            id: "yellow",
            label: "黄",
            color: Color(red: 1, green: 204 / 255, blue: 0, opacity: 0.95),
            uiColor: UIColor(red: 1, green: 204 / 255, blue: 0, alpha: 0.95),
            swatch: Color(red: 1, green: 204 / 255, blue: 0)
        ),
        GridLineColor(
            id: "red",
            label: "红",
            color: Color(red: 1, green: 59 / 255, blue: 48 / 255, opacity: 0.9),
            uiColor: UIColor(red: 1, green: 59 / 255, blue: 48 / 255, alpha: 0.9),
            swatch: Color(red: 1, green: 59 / 255, blue: 48 / 255)
        )
    ]

    static func find(_ id: String) -> GridLineColor {
        all.first { $0.id == id } ?? all[0]
    }
}
