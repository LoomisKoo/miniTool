import Foundation

/* 拼音标注 —— 移植自 card.js 的 toned / namePinyin。 */

enum Pinyin {
    private static let toneMark: [Character: [Character]] = [
        "a": ["ā", "á", "ǎ", "à"], "o": ["ō", "ó", "ǒ", "ò"], "e": ["ē", "é", "ě", "è"],
        "i": ["ī", "í", "ǐ", "ì"], "u": ["ū", "ú", "ǔ", "ù"], "v": ["ǖ", "ǘ", "ǚ", "ǜ"],
    ]

    /// 给一个拼音标上声调（1-4）。
    static func toned(_ py: String, _ tone: Int) -> String {
        if tone == 0 { return py }
        var idx = -1
        var ch: Character = " "
        if let r = py.firstIndex(of: "a") { idx = py.distance(from: py.startIndex, to: r); ch = "a" }
        else if let r = py.firstIndex(of: "o") { idx = py.distance(from: py.startIndex, to: r); ch = "o" }
        else if let r = py.firstIndex(of: "e") { idx = py.distance(from: py.startIndex, to: r); ch = "e" }
        else if let r = py.range(of: "iu") { idx = py.distance(from: py.startIndex, to: r.lowerBound) + 1; ch = "u" }
        else {
            for (i, c) in py.enumerated() {
                if "iuv".contains(c) && !"aoe".contains(c) { idx = i; ch = c }
            }
        }
        if idx < 0 { return py }
        guard let marks = toneMark[ch], tone >= 1, tone <= 4 else { return py }
        var chars = Array(py)
        if idx < chars.count { chars[idx] = marks[tone - 1] }
        return String(chars)
    }

    /// 整名拼音：姓的每个音节 + 名用字，空格分隔，带声调。
    static func name(_ surname: NMSurname?, _ chars: [String]) -> String {
        let engine = NameEngine.shared
        var out: [String] = []
        if let surname {
            for s in engine.surSyls(surname) where !s.py.isEmpty {
                out.append(toned(s.py, s.tone))
            }
        }
        for c in chars {
            if let it = engine.getChar(c) { out.append(toned(it.py, it.tone)) }
        }
        return out.joined(separator: " ")
    }

    /// 主标用的拼音：每个音节首字母大写（`yuán luò` → `Yuán Luò`）。
    /// 英文界面下拼音当主标（外国人读不出汉字），大写看着才像个名字。
    static func titleCase(_ py: String) -> String {
        py.split(separator: " ")
            .map { $0.prefix(1).uppercased() + $0.dropFirst() }
            .joined(separator: " ")
    }
}
