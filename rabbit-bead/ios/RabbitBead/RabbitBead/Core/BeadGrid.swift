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
/// `Equatable` 是给画布用的：视图比较它就能知道「画面是否需要重画」，
/// 不必每帧重绘整块画布。
struct BeadGrid: Sendable, Equatable {
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

    /// 图纸图例清单。与 H5 端 `exportLegendList` 一致：
    /// **先按整幅颗数降序**排出全部色号，再筛掉本板没有的，颗数取本板的。
    /// 所以分板导出时各板图例顺序一致，不会因为某板用量不同而重排。
    func legendList(palette: BeadPalette, in rect: GridRect) -> [(color: PaletteColor, count: Int)] {
        let global = usage(palette: palette)

        var local: [String: Int] = [:]
        for y in rect.y0..<rect.y1 {
            for x in rect.x0..<rect.x1 {
                let cell = self[x, y]
                guard !cell.isEmpty else { continue }
                local[cell.code, default: 0] += 1
            }
        }

        return global.compactMap { item in
            guard let count = local[item.color.code] else { return nil }
            return (color: item.color, count: count)
        }
    }

    /// 指定区域内的用量清单（分板图纸用）。
    ///
    /// 排序必须是**确定性**的：H5 端 `Object.keys(counts)` 按首次出现序，
    /// `Array.prototype.sort` 稳定，所以同颗数的色号保持图上先出现的在前。
    /// 之前直接对 `Dictionary` 排序（Swift 的 sort 不稳定、Dictionary 遍历序
    /// 每进程还会变），同一张图两次运行会得到不同的清单顺序。
    func usage(palette: BeadPalette, in rect: GridRect) -> [(color: PaletteColor, count: Int)] {
        var counts: [String: Int] = [:]
        var order: [String] = []
        for y in rect.y0..<rect.y1 {
            for x in rect.x0..<rect.x1 {
                let cell = self[x, y]
                guard !cell.isEmpty else { continue }
                if counts[cell.code] == nil { order.append(cell.code) }
                counts[cell.code, default: 0] += 1
            }
        }
        return Self.rankedCodes(order: order, counts: counts)
            .compactMap { code -> (PaletteColor, Int)? in
                guard let color = palette.color(for: code), let count = counts[code] else { return nil }
                return (color, count)
            }
    }

    /// 按颗数降序排色号；颗数相同时保持 `order`（图上首次出现序），与 H5 一致。
    static func rankedCodes(order: [String], counts: [String: Int]) -> [String] {
        order.enumerated()
            .sorted { a, b in
                let ca = counts[a.element] ?? 0
                let cb = counts[b.element] ?? 0
                return ca == cb ? a.offset < b.offset : ca > cb
            }
            .map(\.element)
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
