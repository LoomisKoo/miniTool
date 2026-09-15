import Foundation
import Observation

/// 「我的豆子」库存：按色卡登记手头有的色号与颗数。
///
/// 键用 `色卡id/色号`：MARD 是 `A1`、COCO 是 `A01`，两套色卡有 235 个色号同名不同色，
/// 只按色号存会把两边混在一起。
/// 落盘在 `Application Support/BeadPattern/inventory.json`（与作品同一目录），
/// 不放 Caches：系统空间紧张时会清 Caches，用户登记的库存不能这么丢。
@MainActor
@Observable
final class InventoryStore {
    static let shared = InventoryStore()

    /// `"色卡id/色号"` → 已有颗数，只保留 > 0 的项。
    private(set) var counts: [String: Int] = [:]
    /// 保存失败时的提示，供界面弹窗。
    var message: String?

    private var hasLoaded = false

    private init() {}

    // MARK: - 读

    /// 首次进入时载入。可重复调用。
    func loadIfNeeded() {
        guard !hasLoaded else { return }
        hasLoaded = true
        guard let data = try? Data(contentsOf: ProjectPaths.inventory),
              let decoded = try? JSONDecoder().decode([String: Int].self, from: data) else { return }
        counts = decoded
    }

    static func key(palette: String, code: String) -> String { "\(palette)/\(code)" }

    func count(palette: String, code: String) -> Int {
        counts[Self.key(palette: palette, code: code)] ?? 0
    }

    /// 该色卡已登记的色号与颗数，按色号自然序（`A2` 排在 `A10` 前）。
    func owned(palette: String) -> [OwnedBead] {
        let prefix = "\(palette)/"
        var result: [OwnedBead] = []
        for (key, value) in counts where value > 0 && key.hasPrefix(prefix) {
            let code = String(key.dropFirst(prefix.count))
            result.append(OwnedBead(color: color(for: code, palette: palette), count: value))
        }
        return result.sorted {
            $0.color.code.compare($1.color.code, options: .numeric) == .orderedAscending
        }
    }

    func ownedCount(palette: String) -> Int {
        owned(palette: palette).count
    }

    func total(palette: String) -> Int {
        owned(palette: palette).reduce(0) { $0 + $1.count }
    }

    /// 色号取色：先在本色卡里找；找不到（色号来自另一套色卡）时全库找一个兜底。
    func color(for code: String, palette: String) -> PaletteColor {
        PaletteLibrary.palette(id: palette).color(for: code)
            ?? PaletteLibrary.all.lazy.compactMap { $0.color(for: code) }.first
            ?? PaletteColor(code: code, rgb: RGB8(0x8E, 0x8E, 0x93))
    }

    // MARK: - 写

    /// 登记颗数。`0`（或负值）等于移除。
    func setCount(_ value: Int, palette: String, code: String) {
        let key = Self.key(palette: palette, code: code)
        if value <= 0 {
            counts.removeValue(forKey: key)
        } else {
            counts[key] = value
        }
        persist()
    }

    func clear(palette: String) {
        let prefix = "\(palette)/"
        counts = counts.filter { !$0.key.hasPrefix(prefix) }
        persist()
    }

    private func persist() {
        do {
            try ProjectPaths.prepare()
            let data = try JSONEncoder().encode(counts)
            try data.write(to: ProjectPaths.inventory, options: .atomic)
        } catch {
            message = "库存保存失败：\(error.localizedDescription)"
        }
    }
}

/// 一个已登记的色号（库存里的「已有 xx 颗」）。
struct OwnedBead: Identifiable, Hashable {
    let color: PaletteColor
    let count: Int

    var id: String { color.code }
}
