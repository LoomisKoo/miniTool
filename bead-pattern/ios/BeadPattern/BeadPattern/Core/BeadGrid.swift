import Foundation

/// 一格拼豆。`isEmpty` 表示该格透明/无有效像素，不参与统计与导出。
struct BeadCell: Hashable, Sendable {
    var code: String
    var rgb: RGB8

    static let empty = BeadCell(code: "", rgb: RGB8(0, 0, 0))

    var isEmpty: Bool { code.isEmpty }

    var hex: String { rgb.hex }
}

/// 一块矩形区域（含起点、不含终点），单位是格。整幅图用 `full`。
struct GridRect: Hashable, Sendable {
    var x0: Int
    var y0: Int
    var x1: Int
    var y1: Int

    var width: Int { max(0, x1 - x0) }
    var height: Int { max(0, y1 - y0) }

    func contains(x: Int, y: Int) -> Bool {
        x >= x0 && x < x1 && y >= y0 && y < y1
    }
}

/// 量化结果：二维拼豆格子。
struct BeadGrid: Sendable {
    let width: Int
    let height: Int
    let boardSize: Int
    var cells: [BeadCell]

    init(width: Int, height: Int, boardSize: Int, cells: [BeadCell]) {
        self.width = width
        self.height = height
        self.boardSize = boardSize
        self.cells = cells
    }

    subscript(x: Int, y: Int) -> BeadCell {
        get {
            guard x >= 0, y >= 0, x < width, y < height else { return .empty }
            return cells[y * width + x]
        }
        set {
            guard x >= 0, y >= 0, x < width, y < height else { return }
            cells[y * width + x] = newValue
        }
    }

    var boardsX: Int { (width + boardSize - 1) / boardSize }
    var boardsY: Int { (height + boardSize - 1) / boardSize }
    var boardCount: Int { boardsX * boardsY }

    var fullRect: GridRect { GridRect(x0: 0, y0: 0, x1: width, y1: height) }

    /// `index < 0` 表示全图。与 H5 端 `boardRect` 一致。
    func rect(forBoard index: Int) -> GridRect {
        guard index >= 0, index < boardCount else { return fullRect }
        let bx = index % boardsX
        let by = index / boardsX
        let x0 = bx * boardSize
        let y0 = by * boardSize
        return GridRect(
            x0: x0,
            y0: y0,
            x1: min(width, x0 + boardSize),
            y1: min(height, y0 + boardSize)
        )
    }

    var beadCount: Int { cells.reduce(0) { $0 + ($1.isEmpty ? 0 : 1) } }

    /// 用量清单，按数量降序。
    func usage(palette: BeadPalette) -> [(color: PaletteColor, count: Int)] {
        usage(palette: palette, in: fullRect)
    }

    /// 指定区域内的用量清单（分板图纸用）。
    func usage(palette: BeadPalette, in rect: GridRect) -> [(color: PaletteColor, count: Int)] {
        var counts: [String: Int] = [:]
        for y in rect.y0..<rect.y1 {
            for x in rect.x0..<rect.x1 {
                let cell = self[x, y]
                guard !cell.isEmpty else { continue }
                counts[cell.code, default: 0] += 1
            }
        }
        return counts
            .compactMap { code, count -> (PaletteColor, Int)? in
                guard let color = palette.color(for: code) else { return nil }
                return (color, count)
            }
            .sorted { $0.1 > $1.1 }
            .map { (color: $0.0, count: $0.1) }
    }

    /// 区域内的豆数。
    func beadCount(in rect: GridRect) -> Int {
        var total = 0
        for y in rect.y0..<rect.y1 {
            for x in rect.x0..<rect.x1 where !self[x, y].isEmpty {
                total += 1
            }
        }
        return total
    }

    /// 总尺寸（毫米）。拼豆标准 5mm。
    var sizeInMM: (width: Double, height: Double) {
        (Double(width) * 5, Double(height) * 5)
    }
}
