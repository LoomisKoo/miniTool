import Foundation

/* 自定义英文名 —— 库里没有的名字怎么办。
 *
 * 1496 条英文名库覆盖不了所有人（家族名、别的语种、自己拼的名字）。这里做三件事：
 *   1. `enLookup`：先在库里找（大小写不敏感，昵称也认）；
 *   2. `guessEnName`：查不到就按**词尾规则**推测语源和性别 —— 只是推测，界面上要标出来；
 *   3. `similarEnNames`：用音近度在库里找相近的名字，给用户一个能落地的选择。
 *
 * 规则表按后缀长度从长到短匹配（"Hanako" 要先命中 -ko 的日语，而不是 -a 的拉丁）。
 * 词尾只说明「像哪一支语言」，不是词源学结论。表里的语源说明按老规矩写中文，
 * 英文界面靠 Localizable.strings 翻（词表只存界面句子）。 */

struct EnNameGuess {
    /// 推测的语源（nil 表示没有把握）。
    let origin: String?
    /// 推测的性别："f" / "m" / nil。
    let gender: String?
}

extension NameEngine {

    /// 在英文名库里查（大小写不敏感；昵称 "Si" → Silas 也认）。
    func enLookup(_ raw: String) -> NMEnName? {
        let key = raw.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !key.isEmpty else { return nil }
        if let hit = data.namesEn.first(where: { $0.n.lowercased() == key }) { return hit }
        return data.namesEn.first { $0.nick.contains { $0.lowercased() == key } }
    }

    /// (词尾, 语源说明, 性别推测)。匹配时按长度从长到短试。
    private static let enSuffixRules: [(suffix: String, origin: String, gender: String?)] = [
        // 父名
        ("sson", "北欧父名（……之子）", "m"),
        ("sen", "北欧／德语父名（……之子）", "m"),
        ("son", "英语父名（……之子）", "m"),
        ("ez", "西班牙语父名", nil),
        // 日耳曼 / 古英语
        ("wald", "古英语／日耳曼语", "m"),
        ("bert", "古英语／日耳曼语", "m"),
        ("mund", "古英语／日耳曼语", "m"),
        ("hard", "古英语／日耳曼语", "m"),
        ("ric", "古英语／日耳曼语", "m"),
        ("gar", "古英语／日耳曼语", "m"),
        ("th", "古北欧／古英语", "m"),
        // 地名姓
        ("worth", "古英语地名", nil),
        ("wick", "古英语地名", nil),
        ("ford", "古英语地名", nil),
        ("ham", "古英语地名", nil),
        ("ley", "古英语地名", nil),
        ("ton", "古英语地名", nil),
        ("dale", "古英语地名", nil),
        ("brook", "古英语地名", nil),
        // 斯拉夫 / 波兰 / 希腊
        ("owski", "波兰语", nil),
        ("ski", "波兰语", nil),
        ("poulos", "希腊语", nil),
        ("akis", "希腊语", nil),
        ("ova", "斯拉夫语", "f"),
        ("ev", "斯拉夫语", nil),
        // 小称（多为女性）
        ("ette", "法语小称", "f"),
        ("otte", "法语小称", "f"),
        ("elle", "法语小称", "f"),
        ("ella", "意大利／拉丁小称", "f"),
        ("eline", "法语小称", "f"),
        ("ina", "拉丁／意大利小称", "f"),
        ("ine", "法语小称", "f"),
        // 希伯来
        ("iah", "希伯来语（神之名）", nil),
        ("yah", "希伯来语（神之名）", nil),
        ("el", "希伯来语（神）", nil),
        ("ah", "希伯来语", nil),
        // 古典
        ("ius", "拉丁语", "m"),
        ("us", "拉丁语", "m"),
        ("as", "希腊语", "m"),
        ("oe", "希腊语", "f"),
        ("os", "希腊语／西葡语", nil),
        ("es", "希腊语／西葡语", nil),
        ("ia", "拉丁／希腊语，多为女性名", "f"),
        ("a", "拉丁／希腊语，多为女性名", "f"),
        // 凯尔特 / 日语
        ("wen", "威尔士语", "f"),
        ("lyn", "威尔士语", "f"),
        ("yn", "威尔士语", nil),
        ("iam", "爱尔兰语，William 的短形式", "m"),
        ("ko", "日语", "f"),
        ("ki", "日语", nil),
        ("mi", "日语", nil),
    ]

    /// 这个词是不是一个中文拼音音节（"Mei" / "Kai" / "Yifan"）——
    /// 自定义时先认这个，比「拉丁语系」的推测有用得多。
    func isPinyinName(_ raw: String) -> Bool {
        let key = raw.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !key.isEmpty, key.allSatisfy({ $0.isASCII && $0.isLetter }) else { return false }
        if data.surnames.contains(where: { $0.py == key }) { return true }
        if data.surnames.contains(where: { ($0.pys ?? []).contains(key) }) { return true }
        return data.chars.contains { $0.py == key }
    }

    /// 库里没有的名字：推测语源 / 性别。查得到库内条目就不用推测（返回 nil）。
    func guessEnName(_ raw: String) -> EnNameGuess {
        let name = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty, enLookup(name) == nil else { return EnNameGuess(origin: nil, gender: nil) }
        let lower = name.lowercased()

        var origin: String?
        var gender: String?
        if isPinyinName(lower) { origin = L10n.t("中文拼音：这更像中文名的拉丁写法") }
        for rule in Self.enSuffixRules.sorted(by: { $0.suffix.count > $1.suffix.count })
        where lower.hasSuffix(rule.suffix) {
            if origin == nil { origin = L10n.t(rule.origin) }
            if gender == nil { gender = rule.gender }
            break
        }

        /* 语源拿不准，但库里音近的名字都是同一个性别时，靠它们兜底 —— 比词尾准。 */
        if gender == nil {
            let close = similarEnNames(name, limit: 6).filter { phonSim(lower, $0.n.lowercased()) >= 0.62 }
            if close.count >= 3 {
                let f = close.filter { $0.g == "f" }.count
                let m = close.filter { $0.g == "m" }.count
                if f * 10 >= close.count * 7 { gender = "f" }
                else if m * 10 >= close.count * 7 { gender = "m" }
            }
        }
        return EnNameGuess(origin: origin, gender: gender)
    }

    /// 音近的库内名字（自定义名字时的「相近的名字」）。完全同名的自己不算。
    func similarEnNames(_ raw: String, limit: Int = 8) -> [NMEnName] {
        let key = raw.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !key.isEmpty else { return [] }
        var out: [(n: NMEnName, s: Double)] = []
        for it in data.namesEn {
            let cand = it.n.lowercased()
            if cand == key { continue }
            var s = phonSim(key, cand)
            /* 首字母和尾字母都对上的，再加一点 —— 读音贴近多半是这样。 */
            if key.first == cand.first { s += 0.08 }
            if key.last == cand.last { s += 0.06 }
            if s >= 0.45 { out.append((it, s)) }
        }
        out.sort { $0.s > $1.s }
        return out.prefix(limit).map { $0.n }
    }

    /// 中文音译参考：把外文名拆成音节（Aurora → ao · ro · la）。
    func enZhSyllables(_ raw: String) -> String {
        romanSyllables(raw).joined(separator: " · ")
    }

    // MARK: - 英文姓氏（latinSurnames）

    /// 172 个英文姓，按字母序。字典序不保序，所以每次从字典建一份排好序的。
    func enSurnames() -> [NMSurnameEn] {
        data.latinSurnames.keys.sorted().map { key in
            let v = data.latinSurnames[key] ?? []
            return NMSurnameEn(n: key, zh: v.first ?? "", head: v.count > 1 ? v[1] : "")
        }
    }

    /// 选姓页的筛选：关键词匹配拉丁拼写或中文音译（"wil" / "威" 都能搜）。
    func enSurnameSearch(_ keyword: String, letter: String) -> [NMSurnameEn] {
        let kw = keyword.trimmingCharacters(in: .whitespaces).lowercased()
        return enSurnames().filter { s in
            if letter != "all" && s.letter != letter { return false }
            if kw.isEmpty { return true }
            return s.n.lowercased().contains(kw) || s.zh.contains(kw)
        }
    }
}
