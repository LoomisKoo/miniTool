import Foundation

/// 一个拼豆色号。
struct PaletteColor: Identifiable, Hashable, Sendable {
    let code: String
    let rgb: RGB8

    var id: String { code }
    var hex: String { rgb.hex }

    /// Oklab 值只算一次，供最近色匹配复用。
    let oklab: Oklab

    init(code: String, rgb: RGB8) {
        self.code = code
        self.rgb = rgb
        self.oklab = Oklab(rgb: rgb)
    }

    private enum CodingKeys: String, CodingKey {
        case code, r, g, b
    }
}

extension PaletteColor: Decodable {
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let code = try c.decode(String.self, forKey: .code)
        let r = try c.decode(UInt8.self, forKey: .r)
        let g = try c.decode(UInt8.self, forKey: .g)
        let b = try c.decode(UInt8.self, forKey: .b)
        self.init(code: code, rgb: RGB8(r, g, b))
    }
}

/// 一套完整色卡（MARD 291 / COCO 291）。
struct BeadPalette: Identifiable, Hashable, Sendable {
    let id: String
    let name: String
    let colors: [PaletteColor]

    func color(for code: String) -> PaletteColor? {
        colors.first { $0.code == code }
    }

    func nearest(to rgb: RGB8) -> PaletteColor {
        let target = Oklab(rgb: rgb)
        var best = colors[0]
        var bestDistance = Double.infinity
        for color in colors {
            let d = target.squaredDistance(to: color.oklab)
            if d < bestDistance {
                bestDistance = d
                best = color
            }
        }
        return best
    }

    /// 在一组候选色里找最近色（限色重映射用）。
    func nearest(to rgb: RGB8, among candidates: [PaletteColor]) -> PaletteColor {
        let target = Oklab(rgb: rgb)
        var best = candidates[0]
        var bestDistance = Double.infinity
        for color in candidates {
            let d = target.squaredDistance(to: color.oklab)
            if d < bestDistance {
                bestDistance = d
                best = color
            }
        }
        return best
    }
}

extension BeadPalette: Decodable {
    private enum CodingKeys: String, CodingKey {
        case id, name, colors
    }
}

/// 从 bundle 内 `Palettes.json` 加载色卡。
///
/// 数据源：HansBug/pindou-color-data (MIT License, Copyright (c) 2026 HansBug)。
/// 许可要求的署名 + 许可全文在「关于」页（`BeadAboutView`），改这里时别忘了那边。
/// 重新生成：`node ios/scripts/gen-palettes.mjs`
enum PaletteLibrary {
    static let all: [BeadPalette] = load()
    static let fallback = BeadPalette(id: "empty", name: "空".loc, colors: [PaletteColor(code: "—", rgb: RGB8(0, 0, 0))])

    static var `default`: BeadPalette {
        all.first { $0.id == "mard" } ?? all.first ?? fallback
    }

    static func palette(id: String) -> BeadPalette {
        all.first { $0.id == id } ?? `default`
    }

    private static func load() -> [BeadPalette] {
        guard let url = Bundle.main.url(forResource: "Palettes", withExtension: "json"),
              let data = try? Data(contentsOf: url) else {
            assertionFailure("Palettes.json 缺失，请运行 node ios/scripts/gen-palettes.mjs")
            return []
        }
        do {
            return try JSONDecoder().decode([BeadPalette].self, from: data)
        } catch {
            assertionFailure("Palettes.json 解析失败：\(error)")
            return []
        }
    }
}
