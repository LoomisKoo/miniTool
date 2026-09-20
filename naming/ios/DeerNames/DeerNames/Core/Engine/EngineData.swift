import Foundation

/* H5 引擎的数据模型。
 *
 * 数据来源：`tools/export-data.mjs` 把 `src/data` 下的 JS 文件在 Node 里跑一遍后
 * 导出成 `Resources/Data/engine.json`，字段与 H5 的 pack 系列一一对应，只是补齐了
 * 可选字段的默认值，方便 Codable 直接解码。引擎逻辑在 Swift 侧重写
 * （NameEngine / BaziEngine），数据不手抄。 */

struct NMAxis: Codable, Hashable {
    let key: String
    let group: String
    let label: String
    let low: String
    let high: String
}

struct NMWeight: Codable, Hashable {
    var tr: [String: Double]?
    var st: [String: Double]?

    var traitVec: [String: Double] { tr ?? [:] }
    var styleVec: [String: Double] { st ?? [:] }
}

struct NMDomain: Codable, Hashable {
    let label: String
    let tr: [String: Double]
    let st: [String: Double]
}

struct NMChar: Codable, Hashable {
    let c: String
    let py: String
    let tone: Int
    let dom: String
    let m: String
    let freq: Int
    let g: String
    let adj: NMWeight?
    let phon: Bool
}

struct NMSurname: Codable, Hashable {
    let c: String
    let py: String
    let tone: Int
    let m: String
    let en: String
    let pop: Int
    let pys: [String]?
    let tones: [Int]?
    let ro: String
    /// 粤语（港式）写法：古 → Koo、张 → Cheung。数据里查不到就是 nil，
    /// 界面不给这一档（不猜）。
    var yue: String? = nil
}

struct NMGiven: Codable, Hashable {
    let n: String
    let g: String
    let tag: String
    let m: String
}

struct NMEnName: Codable, Hashable {
    let n: String
    let zh: String
    let ph: String
    let org: String
    let era: String
    let g: String
    let snd: String
    let nick: [String]
    let tr: [String: Double]
    let st: [String: Double]
    let m: String
}

struct NMCeleb: Codable, Hashable {
    let name: String
    let keys: [String]
    let era: String
    let bio: String
}

/// 英文姓氏 —— `latinSurnames` 的 key 是拉丁拼写，值是 `[中文音译, 音头字]`。
///
/// 表里既有英语姓（Wilson / Baker），也有华人姓氏的拉丁拼写（Chen / Wong）：
/// 后者本来是为「西名中起」配的姓，自选英文名时同样认，所以中英两边都能用。
struct NMSurnameEn: Hashable, Identifiable {
    let n: String
    let zh: String
    /// 音头字（Wilson → 威）。目前只有「西名中起」用得上，界面还没展示。
    let head: String

    var id: String { n }
    /// 首字母，选姓页按它筛选。
    var letter: String { String(n.prefix(1)).uppercased() }
}

struct NMQuestion: Codable, Hashable {
    let id: String
    let text: String
    let options: [NMQuestionOption]
}

struct NMQuestionOption: Codable, Hashable {
    let text: String
    let w: [String: Double]
    let nov: Double?
}

struct EngineData: Codable {
    let version: Int
    let axes: [NMAxis]
    let traitKeys: [String]
    let styleKeys: [String]
    let questions: [NMQuestion]
    let domains: [String: NMDomain]
    /// 意象的展示顺序（Dictionary 不保序，所以导出时单独存一份）。
    let domainKeys: [String]?
    let domainCompat: [String: [String]]
    let domainWx: [String: String]
    let baziHours: [String]
    let baziWx: [String]
    let chars: [NMChar]
    let phonChars: [NMChar]
    /// 单姓 + 复姓统一放这里（复姓带 `pys` / `tones`）。
    let surnames: [NMSurname]
    let given: [NMGiven]
    let namesEn: [NMEnName]
    let celebs: [NMCeleb]
    let initialTrait: [String: NMWeight]
    let finalTrait: [String: NMWeight]
    let toneTrait: [String: NMWeight]
    let surnameOverride: [String: NMWeight]
    let latinSurnames: [String: [String]]
    let enCelebs: [String: [[String]]]
    let enCelebSearch: [String: [String]]
    let enGivenZh: [String: String]
    let badChars: [String]
    let badGiven: [String]
    let badFull: [String]

    /// 意象筛选的展示顺序，缺字段时退化为字典序。
    var domainKeyList: [String] { domainKeys ?? domains.keys.sorted() }
}

enum EngineDataStore {
    static let shared: EngineData = load()

    private static func load() -> EngineData {
        let candidates: [URL?] = [
            Bundle.main.url(forResource: "engine", withExtension: "json", subdirectory: "Data"),
            Bundle.main.url(forResource: "engine", withExtension: "json"),
            Bundle.main.url(forResource: "engine", withExtension: "json", subdirectory: "Resources/Data"),
        ]
        guard let url = candidates.compactMap({ $0 }).first,
              let data = try? Data(contentsOf: url) else {
            fatalError("找不到 engine.json，请确认 Resources/Data/engine.json 已加入 App 资源")
        }
        do {
            return try JSONDecoder().decode(EngineData.self, from: data)
        } catch {
            fatalError("engine.json 解码失败：\(error)")
        }
    }
}
