import Foundation

/* Swift 版命名引擎 —— 逐函数移植自 `src/engine.js`（以及 card.js 里的拼音工具）。
 * 数据来自 EngineDataStore（由 H5 数据导出）。逻辑保持不变，随机采样用 Double.random，
 * 因此结果与 H5 同分布。 */

typealias NMVec = [String: Double]

/// 性格画像。字段与 H5 `NM.profileFromAnswers` 的返回对象对应。
struct NMProfile: Codable, Hashable {
    var trait: NMVec = [:]
    var style: NMVec = [:]
    var nov: Double = 0.4
    var answered: Int = 0
    /// 宜补五行（生辰辅助）
    var favorWx: [String] = []
    var bazi: BaziInfo?

    /// 是否做过性格测试（H5 里的 `profile.answered` 是答过的题数，不是布尔）。
    var hasAnswered: Bool { answered > 0 }
}

/// 名字（由字合成）的向量。
struct NameVector {
    var trait: NMVec
    var style: NMVec
    var chars: [String]
}

struct CharNote {
    let py: String
    let text: String
    let phon: Bool
}

struct Readability {
    let ok: Bool
    let issues: [String]
    let good: [String]
    let full: String
}

struct ScoreParts {
    let score: Double
    let tSim: Double
    let sSim: Double
    let novelty: Double
    let wx: Double
}

/// `rankNames` 的候选。
struct NameResult {
    var given: String
    var chars: [String]
    var surname: NMSurname
    var full: String
    var score: Double
    var tSim: Double
    var sSim: Double
    var novelty: Double
    var source: String
    var note: String
    var vec: NameVector
    var tier: Int = 0
    /// namesForSurname 追加
    var euphony: Double?
    var mix: Double?
}

/// `recommend` 的候选（姓也参与打分）。
struct SurnameFit {
    let sur: NMSurname
    let fit: Double
    let cosFit: Double
    let vec: SurnameVector
}

struct SurnameVector {
    var trait: NMVec
    var style: NMVec
}

struct RecResult {
    let surname: NMSurname
    let name: NameResult
    let given: String
    let chars: [String]
    let full: String
    let fit: Double
    let euphony: Double
    let score: Double
}

struct RadarItem: Hashable {
    let key: String
    let label: String
    let low: String
    let high: String
    let mine: Int
    let name: Int
}

struct CelebrityHit {
    let name: String
    let era: String
    let bio: String
    let how: String
    let score: Int
}

struct FeedbackOptions {
    var banFull: Set<String> = []
    var banGiven: Set<String> = []
    var banChars: Set<String> = []
    var keepChars: [String] = []
}

struct RankOptions {
    var surname: NMSurname
    var wantGender: String?
    var wantTags: [String]?
    var limit: Int?
    var feedback: FeedbackOptions
}

struct ValidateOptions {
    var skipDomain = false
    var lite = false
}

final class NameEngine {
    static let shared = NameEngine(EngineDataStore.shared)

    let data: EngineData
    private let charIndex: [String: NMChar]
    private let syllableSet: Set<String>
    private let celebByKey: [String: [Int]]

    // 打分权重（engine.js 常量）
    private let W_TRAIT = 0.45
    private let W_STYLE = 0.40
    private let W_NOV = 0.15
    private let W_WX = 0.14

    // topChars 缓存
    private var topMemoKey = ""
    private var topMemoBox: [Int: [String]] = [:]

    // 姓的气质范围缓存
    private var vibeRangeCache: (keys: [String], min: NMVec, max: NMVec, scale: Double)?

    /// 音节 → 候选拼音的缓存（音译/贴音打分要反复用，正则在里面，必须缓存）。
    var syllCandidateCache: [String: [(py: String, cost: Double)]] = [:]

    init(_ data: EngineData) {
        self.data = data

        var idx: [String: NMChar] = [:]
        for c in data.chars { idx[c.c] = c }
        for c in data.phonChars where idx[c.c] == nil { idx[c.c] = c }
        self.charIndex = idx

        var sset = Set<String>()
        for s in data.surnames {
            for p in (s.pys ?? [s.py]) where !p.isEmpty { sset.insert(p) }
        }
        for c in data.chars where !c.py.isEmpty { sset.insert(c.py) }
        for c in data.phonChars where !c.py.isEmpty { sset.insert(c.py) }
        self.syllableSet = sset

        var byKey: [String: [Int]] = [:]
        for (i, c) in data.celebs.enumerated() {
            for k in c.keys where !k.isEmpty {
                byKey[k, default: []].append(i)
            }
        }
        self.celebByKey = byKey
    }

    // MARK: - 向量工具

    func zero(_ keys: [String]) -> NMVec {
        var v: NMVec = [:]
        for k in keys { v[k] = 0 }
        return v
    }

    func clamp(_ x: Double, _ a: Double, _ b: Double) -> Double {
        x < a ? a : (x > b ? b : x)
    }

    private func averageVec(_ packs: [NMVec], _ keys: [String]) -> NMVec {
        var sum = zero(keys)
        var cnt = zero(keys)
        for p in packs {
            for key in keys {
                if let val = p[key] {
                    sum[key, default: 0] += val
                    cnt[key, default: 0] += 1
                }
            }
        }
        var out: NMVec = [:]
        for k in keys {
            let c = cnt[k] ?? 0
            out[k] = c > 0 ? clamp((sum[k] ?? 0) / c, -1, 1) : 0
        }
        return out
    }

    func cos(_ a: NMVec, _ b: NMVec, _ keys: [String]) -> Double {
        var dot = 0.0, na = 0.0, nb = 0.0
        for k in keys {
            let x = a[k] ?? 0
            let y = b[k] ?? 0
            dot += x * y; na += x * x; nb += y * y
        }
        if na == 0 || nb == 0 { return 0 }
        return dot / (na.squareRoot() * nb.squareRoot())
    }

    func addVec(_ target: inout NMVec, _ src: NMVec, _ scale: Double) {
        for (k, v) in src { target[k, default: 0] += v * scale }
    }

    // MARK: - 字 → 向量

    func getChar(_ c: String) -> NMChar? { charIndex[c] }

    func charVec(_ ch: String) -> NameVector? {
        guard let item = charIndex[ch] else { return nil }
        let dom = data.domains[item.dom] ?? data.domains["com"]!
        var t = zero(data.traitKeys)
        var s = zero(data.styleKeys)
        addVec(&t, dom.tr, 1)
        addVec(&s, dom.st, 1)
        if let adj = item.adj {
            addVec(&t, adj.tr ?? [:], 1)
            addVec(&s, adj.st ?? [:], 1)
        }
        for k in data.traitKeys { t[k] = clamp(t[k] ?? 0, -1, 1) }
        for k in data.styleKeys { s[k] = clamp(s[k] ?? 0, -1, 1) }
        return NameVector(trait: t, style: s, chars: [ch])
    }

    /// 名字向量 = 组成字的平均。对应 `NM.vectorOf`。
    func givenVec(_ chars: [String]) -> NameVector? {
        var ts: [NMVec] = []
        var ss: [NMVec] = []
        var used: [String] = []
        for ch in chars {
            guard let v = charVec(ch) else { continue }
            ts.append(v.trait); ss.append(v.style); used.append(ch)
        }
        if ts.isEmpty { return nil }
        return NameVector(trait: averageVec(ts, data.traitKeys),
                          style: averageVec(ss, data.styleKeys),
                          chars: used)
    }

    func avgFreq(_ chars: [String]) -> Double {
        var n = 0, sum = 0
        for ch in chars {
            if let it = charIndex[ch] { sum += it.freq; n += 1 }
        }
        return n > 0 ? Double(sum) / Double(n) : 3
    }

    // MARK: - 从回答得到性格向量

    func profileFromAnswers(_ answers: [NMQuestionOption?]) -> NMProfile {
        var packs: [NMVec] = []
        var novSum = 0.0, novCnt = 0
        for opt in answers {
            guard let opt else { continue }
            packs.append(opt.w)
            if let nov = opt.nov { novSum += nov; novCnt += 1 }
        }
        return NMProfile(
            trait: averageVec(packs, data.traitKeys),
            style: averageVec(packs, data.styleKeys),
            nov: novCnt > 0 ? novSum / Double(novCnt) : 0.4,
            answered: packs.count
        )
    }

    // MARK: - 姓氏音节

    func surSyls(_ s: NMSurname?) -> [(py: String, tone: Int)] {
        guard let s else { return [] }
        if let pys = s.pys, !pys.isEmpty {
            return pys.enumerated().map { (i, p) in
                (p, (s.tones?.indices.contains(i) ?? false) ? (s.tones?[i] ?? 0) : 0)
            }
        }
        return [(s.py, s.tone)]
    }

    func surPy(_ s: NMSurname?) -> String {
        surSyls(s).map { $0.py }.joined()
    }

    func isCompound(_ s: NMSurname?) -> Bool {
        guard let s else { return false }
        return (s.pys?.count ?? 0) > 1
    }

    func allSurnames() -> [NMSurname] { data.surnames }

    // MARK: - 姓的搜索

    /// `pyHit`
    private func pyHit(_ pys: [String], _ kw: String) -> Bool {
        let full = pys.joined()
        if full.isEmpty { return false }
        if kw.count == 1 { return full.hasPrefix(kw) }
        var i = 0
        let chars = Array(kw)
        for p in pys {
            if i >= chars.count { return true }
            let rest = String(chars[i...])
            if rest.count >= p.count {
                if String(chars[i..<min(i + p.count, chars.count)]) != p { return false }
                i += p.count
                continue
            }
            if !p.hasPrefix(rest) { return false }
            if syllableSet.contains(rest) { return false }
            return true
        }
        return i >= chars.count
    }

    /// 是否含非 ASCII 字符
    private func hasNonASCII(_ s: String) -> Bool {
        s.unicodeScalars.contains { $0.value > 0x7f }
    }

    private func surHit(_ s: NMSurname, _ kw: String, _ loose: Bool) -> Bool {
        if hasNonASCII(kw) { return s.c.contains(kw) }
        let pys = surSyls(s).map { $0.py }.filter { !$0.isEmpty }
        if pys.isEmpty { return false }
        return loose ? pys.joined().hasPrefix(kw) : pyHit(pys, kw)
    }

    /// `NM.searchSurnames`
    func searchSurnames(_ list: [NMSurname], _ rawKeyword: String) -> [NMSurname] {
        let cleaned = rawKeyword.lowercased().filter { ch in
            ch.isLetter && ch.isASCII || (ch.unicodeScalars.first.map { $0.value >= 0x4e00 && $0.value <= 0x9fa5 } ?? false)
        }
        let kw = String(cleaned)
        if kw.isEmpty { return list }
        let hit = list.filter { surHit($0, kw, false) }
        return hit.isEmpty ? list.filter { surHit($0, kw, true) } : hit
    }

    // MARK: - 校验与黑名单

    func isCharBanned(_ ch: String) -> Bool { data.badChars.contains(ch) }
    func isGivenBanned(_ given: String) -> Bool { data.badGiven.contains(given) }
    func isFullBanned(_ surnamePy: String, _ given: String) -> Bool {
        data.badFull.contains((surnamePy + given).lowercased())
    }

    func validate(_ surname: NMSurname?, _ chars: [String], _ given: String, _ opts: ValidateOptions) -> Bool {
        if let surname {
            for ch in surname.c.map(String.init) {
                if chars.contains(ch) { return false }
                if given.contains(ch) { return false }
            }
        }
        let pyOf = { (c: String) -> String in self.charIndex[c]?.py ?? "" }
        if opts.lite {
            if isGivenBanned(given) { return false }
            if isFullBanned(surPy(surname), chars.map(pyOf).joined()) { return false }
            return true
        }
        if isGivenBanned(given) { return false }
        if isFullBanned(surPy(surname), chars.map(pyOf).joined()) { return false }

        var tones: [Int] = []
        var pys: [String] = []
        for s in surSyls(surname) { tones.append(s.tone); pys.append(s.py) }
        var nameSyls = 0
        for c in chars {
            guard let it = charIndex[c] else { return false }
            if isCharBanned(it.c) { return false }
            tones.append(it.tone)
            pys.append(it.py)
            nameSyls += 1
        }

        // 1. 三声连读
        let tone3 = tones.filter { $0 == 3 }.count
        if tones.count == 3 && tone3 == 3 { return false }
        if nameSyls >= 2 && tones.suffix(nameSyls).allSatisfy({ $0 == 3 }) { return false }
        // 2. 声调全同
        if tones.count > 1, let first = tones.first, tones.allSatisfy({ $0 == first }) { return false }
        // 3. 音节重复
        for a in 0..<pys.count {
            for b in (a + 1)..<pys.count where pys[a] == pys[b] { return false }
        }
        // 4. 两个字不能重复
        if chars.count == 2 && chars[0] == chars[1] { return false }
        // 5. 意象域相容
        if !opts.skipDomain && chars.count == 2 {
            let d0 = charIndex[chars[0]]?.dom ?? ""
            let d1 = charIndex[chars[1]]?.dom ?? ""
            if !domainsCompatible(d0, d1) { return false }
        }
        return true
    }

    // MARK: - 打分

    private func wxHit(_ chars: [String], _ favor: [String]) -> Double {
        if favor.isEmpty { return 0 }
        var hit = 0, n = 0
        for c in chars {
            guard let it = charIndex[c], !it.phon else { continue }
            n += 1
            if let wx = domainWx(it.dom), favor.contains(wx) { hit += 1 }
        }
        return n > 0 ? Double(hit) / Double(n) : 0
    }

    private func scoreVector(_ vec: NameVector, _ chars: [String], _ profile: NMProfile, _ extra: Double) -> ScoreParts {
        let tSim = (cos(vec.trait, profile.trait, data.traitKeys) + 1) / 2
        let sSim = (cos(vec.style, profile.style, data.styleKeys) + 1) / 2
        let novelty = 1 - (avgFreq(chars) - 1) / 4
        let wx = wxHit(chars, profile.favorWx)
        let sc = W_TRAIT * tSim + W_STYLE * sSim + W_NOV * profile.nov * novelty + W_WX * wx
        return ScoreParts(score: sc + extra, tSim: tSim, sSim: sSim, novelty: novelty, wx: wx)
    }

    // MARK: - 候选生成

    private func profileKey(_ p: NMProfile) -> String {
        var a: [String] = []
        for k in data.traitKeys { a.append(String(format: "%.3f", p.trait[k] ?? 0)) }
        for k in data.styleKeys { a.append(String(format: "%.3f", p.style[k] ?? 0)) }
        a.append(String(format: "%.3f", p.nov))
        a.append(p.favorWx.isEmpty ? "" : p.favorWx.joined())
        return a.joined(separator: ",")
    }

    private func buildTopChars(_ profile: NMProfile, _ floor: Int) -> [String] {
        var list: [(ch: String, s: Double)] = []
        let favor = profile.favorWx
        for ch in data.chars {
            if ch.freq < floor { continue }
            guard let v = charVec(ch.c) else { continue }
            let tSim = (cos(v.trait, profile.trait, data.traitKeys) + 1) / 2
            let sSim = (cos(v.style, profile.style, data.styleKeys) + 1) / 2
            let nov = 1 - Double(ch.freq - 1) / 4
            var wx = 0.0
            if !favor.isEmpty, let w = domainWx(ch.dom), favor.contains(w) { wx = 1 }
            list.append((ch.c, W_TRAIT * tSim + W_STYLE * sSim + W_NOV * profile.nov * nov + W_WX * wx))
        }
        list.sort { $0.s > $1.s }
        return list.map { $0.ch }
    }

    private func topChars(_ profile: NMProfile, _ n: Int, _ minFreq: Int) -> [String] {
        let floor = minFreq
        let pk = profileKey(profile)
        if topMemoKey != pk { topMemoKey = pk; topMemoBox = [:] }
        if topMemoBox[floor] == nil { topMemoBox[floor] = buildTopChars(profile, floor) }
        return Array((topMemoBox[floor] ?? []).prefix(n))
    }

    private func genderOk(_ chars: [String], _ want: String?) -> Bool {
        guard let want, want != "u" else { return true }
        for c in chars {
            guard let it = charIndex[c] else { continue }
            if it.g == "u" { continue }
            if it.g != want { return false }
        }
        return true
    }

    private func passesFeedback(_ chars: [String], _ given: String, _ full: String, _ opts: FeedbackOptions) -> Bool {
        if opts.banFull.contains(full) { return false }
        if opts.banGiven.contains(given) { return false }
        for c in chars where opts.banChars.contains(c) { return false }
        if !opts.keepChars.isEmpty {
            for k in opts.keepChars where !chars.contains(k) { return false }
        }
        return true
    }

    /// `NM.rankNames`
    func rankNames(_ profile: NMProfile, _ options: RankOptions) -> [NameResult] {
        let surname = options.surname
        var out: [NameResult] = []
        var seen = Set<String>()

        func push(_ given: String, _ chars: [String], _ extra: Double, _ source: String, _ note: String) {
            if seen.contains(given) { return }
            if !validate(surname, chars, given, ValidateOptions(skipDomain: source == "curated")) { return }
            if !passesFeedback(chars, given, surname.c + given, options.feedback) { return }
            if !genderOk(chars, options.wantGender) { return }
            guard let vec = givenVec(chars) else { return }
            let sc = scoreVector(vec, chars, profile, extra)
            seen.insert(given)
            out.append(NameResult(given: given, chars: chars, surname: surname,
                                  full: surname.c + given, score: sc.score, tSim: sc.tSim,
                                  sSim: sc.sSim, novelty: sc.novelty, source: source,
                                  note: note, vec: vec, tier: 0))
        }

        // 1) 精选名
        for g in data.given {
            if let tags = options.wantTags, !tags.isEmpty, !tags.contains(g.tag) { continue }
            if let wg = options.wantGender, wg != "u", g.g != "u", g.g != wg { continue }
            push(g.n, Array(g.n).map(String.init), 0, "curated", L10n.d("given", g.n, g.m))
        }
        for i in out.indices { out[i].tier = 0 }

        // 2) 字库拼装
        let poolLo = topChars(profile, 40, 2)
        let pool = topChars(profile, 30, 3)
        let first = out.count
        for a in poolLo { push(a, [a], -0.05, "created", "") }
        for a2 in pool {
            for b in pool where b != a2 {
                push(a2 + b, [a2, b], 0, "created", "")
            }
        }
        for r in first..<out.count { out[r].tier = 1 }

        out.sort { x, y in
            if x.tier != y.tier { return x.tier < y.tier }
            return x.score > y.score
        }
        if let limit = options.limit { return Array(out.prefix(limit)) }
        return out
    }

    /// `NM.charNote`
    func charNote(_ ch: String) -> CharNote {
        guard let it = charIndex[ch] else {
            return CharNote(py: "", text: L10n.t("音译用字，取其读音"), phon: true)
        }
        /* 字义是数据正文，走英文覆盖表（缺条目回退中文），不是界面词表。 */
        return CharNote(py: it.py,
                        text: it.phon ? L10n.t("音译用字，取其读音") : L10n.d("chars", it.c, it.m),
                        phon: it.phon)
    }

    /// 精选名的释义（数据）：现查，切语言不用重排名字。
    func givenMeaning(_ given: String) -> String? {
        guard let g = data.given.first(where: { $0.n == given }) else { return nil }
        return L10n.d("given", g.n, g.m)
    }

    // MARK: - 采样

    func sampleTop<T>(_ list: [T], _ temperature: Double, _ count: Int, _ exclude: Set<String>,
                      score scoreOf: (T) -> Double, key: (T) -> String) -> [T] {
        let pool = Array(list.filter { !exclude.contains(key($0)) }.prefix(60))
        if pool.isEmpty { return [] }
        let T = temperature
        let maxScore = scoreOf(pool[0])
        let weights = pool.map { exp((scoreOf($0) - maxScore) / T) }
        var idxLeft = Array(pool.indices)
        var picked: [T] = []
        for _ in 0..<max(1, count) {
            let total = idxLeft.reduce(0.0) { $0 + weights[$1] }
            if total <= 0 { break }
            let r = Double.random(in: 0..<1) * total
            var acc = 0.0
            var chosen = idxLeft[0]
            for j in idxLeft {
                acc += weights[j]
                if r <= acc { chosen = j; break }
            }
            picked.append(pool[chosen])
            idxLeft.removeAll { $0 == chosen }
            if idxLeft.isEmpty { break }
        }
        return picked
    }

    // MARK: - 读感

    private let iniRE = try! NSRegularExpression(pattern: "^(zh|ch|sh|[bpmfdtnlgkhjqxrzcsyw])")

    func splitPy(_ py: String) -> (ini: String, fin: String) {
        let s = py.lowercased()
        let range = NSRange(s.startIndex..., in: s)
        if let m = iniRE.firstMatch(in: s, range: range), let r = Range(m.range, in: s) {
            let ini = String(s[r])
            return (ini, String(s[s.index(s.startIndex, offsetBy: ini.count)...]))
        }
        return ("", s)
    }

    private func iniClass(_ ini: String) -> String {
        if ini.isEmpty { return "zero" }
        if ["zh", "ch", "sh", "r"].contains(ini) { return "retro" }
        if ["z", "c", "s"].contains(ini) { return "sibilant" }
        if ["j", "q", "x"].contains(ini) { return "palatal" }
        if ["g", "k", "h"].contains(ini) { return "velar" }
        if ["b", "p", "m", "f"].contains(ini) { return "labial" }
        if ["d", "t", "n", "l"].contains(ini) { return "apical" }
        return "zero"
    }

    private func finClass(_ fin: String) -> String {
        if fin.isEmpty { return "open" }
        if fin.hasPrefix("v") { return "tucked" }
        if fin.hasPrefix("u") { return "round" }
        if fin.hasPrefix("i") { return "front" }
        return "open"
    }

    func readability(_ surname: NMSurname?, _ chars: [String]) -> Readability {
        var issues: [String] = []
        var good: [String] = []
        var tones: [Int] = []
        var pys: [String] = []
        var names: [String] = []
        for s in surSyls(surname) { tones.append(s.tone); pys.append(s.py) }
        names.append(surname?.c ?? "")
        for c in chars {
            guard let it = charIndex[c] else { issues.append(L10n.f("「%@」不在字库里", c)); continue }
            tones.append(it.tone); pys.append(it.py); names.append(it.c)
        }
        if tones.count == 3 && tones.allSatisfy({ $0 == 3 }) {
            issues.append(L10n.t("三个三声连读，念着拗口"))
        } else if tones.count > 1, let first = tones.first, tones.allSatisfy({ $0 == first }) {
            issues.append(L10n.t("声调全同，念起来太平"))
        } else {
            good.append(L10n.t("声调有起伏"))
        }
        var dupSyl = false
        for a in 0..<pys.count {
            for b in (a + 1)..<pys.count where pys[a] == pys[b] { dupSyl = true }
        }
        if dupSyl { issues.append(L10n.t("有音节重复，容易混淆")) } else { good.append(L10n.t("没有重音")) }

        if chars.count == 2 {
            if chars[0] == chars[1] {
                issues.append(L10n.t("两个字重复了"))
            } else if let d0 = charIndex[chars[0]]?.dom, let d1 = charIndex[chars[1]]?.dom,
                      !domainsCompatible(d0, d1) {
                issues.append(L10n.t("两个字意象差得远，凑在一起不像名字"))
            } else {
                good.append(L10n.t("字与字意象相容"))
            }
        }
        if isGivenBanned(chars.joined()) { issues.append(L10n.t("这个组合有负面谐音，不建议")) }
        if isFullBanned(surPy(surname), chars.map { charIndex[$0]?.py ?? "" }.joined()) {
            issues.append(L10n.t("连起来读会撞上不好的词"))
        }
        var avg = 0.0, n = 0
        for c in chars where charIndex[c] != nil { avg += Double(charIndex[c]!.freq); n += 1 }
        avg = n > 0 ? avg / Double(n) : 3
        if avg <= 1.6 { good.append(L10n.t("用字少见，不容易撞名")) }
        else if avg >= 4.6 { good.append(L10n.t("用字常见，稳妥好认")) }

        return Readability(ok: issues.isEmpty, issues: issues, good: good, full: names.joined())
    }

    // MARK: - 姓氏气质与顺口度

    func surnameVec(_ s: NMSurname?) -> SurnameVector {
        var t = zero(data.traitKeys)
        var st = zero(data.styleKeys)
        guard let s else { return SurnameVector(trait: t, style: st) }
        let syls = surSyls(s)
        if syls.isEmpty { return SurnameVector(trait: t, style: st) }
        for syl in syls {
            let parts = splitPy(syl.py)
            if let g = data.initialTrait[iniClass(parts.ini)] {
                addVec(&t, g.tr ?? [:], 1); addVec(&st, g.st ?? [:], 1)
            }
            if let f = data.finalTrait[finClass(parts.fin)] {
                addVec(&t, f.tr ?? [:], 1); addVec(&st, f.st ?? [:], 1)
            }
            if let tn = data.toneTrait[String(syl.tone)] {
                addVec(&t, tn.tr ?? [:], 1); addVec(&st, tn.st ?? [:], 1)
            }
        }
        let scale = syls.count > 1 ? 1.0 / Double(syls.count) : 1
        for k in data.traitKeys { t[k] = (t[k] ?? 0) * scale }
        for k in data.styleKeys { st[k] = (st[k] ?? 0) * scale }
        if let ov = data.surnameOverride[s.c] {
            addVec(&t, ov.tr ?? [:], 1); addVec(&st, ov.st ?? [:], 1)
        }
        for k in data.traitKeys { t[k] = clamp((t[k] ?? 0) / 1.6, -1, 1) }
        for k in data.styleKeys { st[k] = clamp((st[k] ?? 0) / 1.6, -1, 1) }
        return SurnameVector(trait: t, style: st)
    }

    private let vibeLabel: [String: (String, String)] = [
        "warm": ("温润", "清冷"), "out": ("开阔", "内敛"), "sta": ("端稳", "轻灵"),
        "rat": ("谨严", "疏朗"), "cla": ("古典", "时新"), "sim": ("简洁", "华美"),
        "exp": ("爽利", "含蕴"),
    ]

    private func vibeRange() -> (keys: [String], min: NMVec, max: NMVec, scale: Double) {
        if let cache = vibeRangeCache { return cache }
        let keys = data.traitKeys + data.styleKeys
        var minV: NMVec = [:], maxV: NMVec = [:]
        for k in keys { minV[k] = 9; maxV[k] = -9 }
        for s in data.surnames {
            let v = surnameVec(s)
            for k in keys {
                let x = v.trait[k] ?? v.style[k] ?? 0
                if x < (minV[k] ?? 9) { minV[k] = x }
                if x > (maxV[k] ?? -9) { maxV[k] = x }
            }
        }
        var scale = 0.0
        for k in keys {
            let half = ((maxV[k] ?? 0) - (minV[k] ?? 0)) / 2
            if half > scale { scale = half }
        }
        if scale == 0 { scale = 1 }
        let result = (keys, minV, maxV, scale)
        vibeRangeCache = result
        return result
    }

    func surnameVibe(_ s: NMSurname?) -> String {
        let v = surnameVec(s)
        let R = vibeRange()
        var pick: [(n: Double, label: String)] = []
        for key in R.keys {
            let x = v.trait[key] ?? v.style[key] ?? 0
            if (R.max[key] ?? 0) - (R.min[key] ?? 0) < 0.06 { continue }
            let mid = ((R.max[key] ?? 0) + (R.min[key] ?? 0)) / 2
            let n = (x - mid) / R.scale
            if abs(n) < 0.34 { continue }
            let labels = vibeLabel[key] ?? ("", "")
            pick.append((n, n > 0 ? L10n.t(labels.0) : L10n.t(labels.1)))
        }
        pick.sort { abs($0.n) > abs($1.n) }
        let bits = pick.prefix(2).map { $0.label }
        return bits.isEmpty ? L10n.t("百搭") : bits.joined(separator: " · ")
    }

    func euphony(_ surname: NMSurname?, _ chars: [String]) -> Double {
        var tones: [Int] = []
        var pys: [String] = []
        for s in surSyls(surname) where !s.py.isEmpty { tones.append(s.tone); pys.append(s.py) }
        for c in chars {
            if let it = charIndex[c] { tones.append(it.tone); pys.append(it.py) }
        }
        if pys.isEmpty { return 0.5 }
        var score = 0.60

        let allSame = tones.count > 1 && tones.allSatisfy { $0 == tones[0] }
        let threeThird = tones.count >= 3 && tones.allSatisfy { $0 == 3 }
        if threeThird { score -= 0.34 } else if allSame { score -= 0.24 }
        for a in 0..<(tones.count - 1) where tones[a] == tones[a + 1] { score -= 0.09 }

        let pitch: [Int: Double] = [1: 5, 2: 4, 3: 2.5, 4: 3]
        var hi = 0.0, lo = 9.0
        for t in tones {
            let p = pitch[t] ?? 3
            if p > hi { hi = p }
            if p < lo { lo = p }
        }
        score += ((hi - lo) / 2.5) * 0.10

        var alt = 0, pairs = 0
        for b in 0..<(tones.count - 1) {
            pairs += 1
            if (tones[b] <= 2) != (tones[b + 1] <= 2) { alt += 1 }
        }
        if pairs > 0 { score += (Double(alt) / Double(pairs)) * 0.08 }

        for x in 0..<pys.count {
            for y in (x + 1)..<pys.count where !pys[x].isEmpty && pys[x] == pys[y] { score -= 0.32 }
        }
        for k in 0..<(pys.count - 1) {
            let p1 = splitPy(pys[k]), p2 = splitPy(pys[k + 1])
            if !p1.ini.isEmpty && p1.ini == p2.ini { score -= 0.11 }
            if !p1.fin.isEmpty && p1.fin == p2.fin { score -= 0.04 }
        }
        let cls = pys.map { finClass(splitPy($0).fin) }
        if pys.count > 1 {
            var ch = 0
            for n in 0..<(cls.count - 1) where cls[n] != cls[n + 1] { ch += 1 }
            score += (Double(ch) / Double(pys.count - 1)) * 0.08
        }
        let open = cls.filter { $0 == "open" || $0 == "round" }.count
        score += (Double(open) / Double(cls.count)) * 0.14

        if pys.count == 2 { score -= 0.05 } else if pys.count >= 5 { score -= 0.08 }
        return clamp(score, 0, 1)
    }

    func euphonyLabel(_ e: Double) -> String {
        if e >= 0.93 { return L10n.t("朗朗上口") }
        if e >= 0.85 { return L10n.t("顺口") }
        if e >= 0.72 { return L10n.t("念着顺") }
        return L10n.t("稍拗口")
    }

    // MARK: - 按性格给姓氏排序

    func rankSurnames(_ profile: NMProfile, all: Bool = false) -> [SurnameFit] {
        var list: [SurnameFit] = []
        for s in data.surnames {
            let sv = surnameVec(s)
            let tSim = (cos(sv.trait, profile.trait, data.traitKeys) + 1) / 2
            let sSim = (cos(sv.style, profile.style, data.styleKeys) + 1) / 2
            let cosFit = 0.58 * tSim + 0.42 * sSim
            let common = (Double(s.pop) - 1) / 4
            list.append(SurnameFit(sur: s, fit: 0.62 * cosFit + 0.38 * common, cosFit: cosFit, vec: sv))
        }
        list.sort { $0.fit > $1.fit }
        return list
    }

    // MARK: - 推荐

    func recommend(_ profile: NMProfile, wantGender: String?, count: Int, breadth: Int = 44,
                   temperature: Double = 0.28, exclude: Set<String> = [],
                   feedback: FeedbackOptions = FeedbackOptions()) -> [RecResult] {
        let ranked = rankSurnames(profile)
        var out: [RecResult] = []
        var usedGiven = Set<String>()
        for k in 0..<min(breadth, ranked.count) {
            let item = ranked[k]
            let names = rankNames(profile, RankOptions(surname: item.sur, wantGender: wantGender,
                                                       wantTags: nil, limit: 80, feedback: feedback))
            if names.isEmpty { continue }
            var best: (name: NameResult, eu: Double, combined: Double)?
            for n in names {
                if usedGiven.contains(n.given) { continue }
                if feedback.banFull.contains(item.sur.c + n.given) { continue }
                let eu = euphony(item.sur, n.chars)
                let sc = n.score * 0.70 + eu * 0.30
                if best == nil || sc > best!.combined { best = (n, eu, sc) }
            }
            guard let b = best else { continue }
            usedGiven.insert(b.name.given)
            out.append(RecResult(surname: item.sur, name: b.name, given: b.name.given,
                                 chars: b.name.chars, full: item.sur.c + b.name.given,
                                 fit: item.fit, euphony: b.eu, score: b.combined * (0.70 + 0.30 * item.fit)))
        }
        out.sort { $0.score > $1.score }
        let picked = sampleTop(out, temperature, count, exclude,
                               score: { $0.score }, key: { $0.surname.c })
        return picked.isEmpty ? Array(out.prefix(count)) : picked
    }

    func namesForSurname(_ profile: NMProfile, _ surname: NMSurname, wantGender: String?,
                         feedback: FeedbackOptions = FeedbackOptions()) -> [NameResult] {
        var list = rankNames(profile, RankOptions(surname: surname, wantGender: wantGender,
                                                  wantTags: nil, limit: nil, feedback: feedback))
        for i in list.indices {
            let eu = euphony(surname, list[i].chars)
            list[i].euphony = eu
            list[i].mix = list[i].score * 0.70 + eu * 0.30
        }
        list.sort { a, b in
            if a.tier != b.tier { return a.tier < b.tier }
            return (a.mix ?? 0) > (b.mix ?? 0)
        }
        return list
    }

    // MARK: - 雷达 / 描述 / 跨文化

    func radar(_ profile: NMProfile, _ vec: NameVector) -> [RadarItem] {
        data.axes.map { ax in
            let isStyle = ax.group == "style"
            let mine = (isStyle ? profile.style[ax.key] : profile.trait[ax.key]) ?? 0
            let name = (isStyle ? vec.style[ax.key] : vec.trait[ax.key]) ?? 0
            return RadarItem(key: ax.key, label: L10n.t(ax.label), low: L10n.t(ax.low), high: L10n.t(ax.high),
                             mine: Int((((mine + 1) / 2) * 100).rounded()),
                             name: Int((((name + 1) / 2) * 100).rounded()))
        }
    }

    func radarSelf(_ profile: NMProfile) -> [RadarItem] {
        data.axes.map { ax in
            let isStyle = ax.group == "style"
            let v = (isStyle ? profile.style[ax.key] : profile.trait[ax.key]) ?? 0
            let pct = Int((((v + 1) / 2) * 100).rounded())
            return RadarItem(key: ax.key, label: L10n.t(ax.label), low: L10n.t(ax.low), high: L10n.t(ax.high), mine: pct, name: pct)
        }
    }

    func describe(_ profile: NMProfile) -> String {
        let t = profile.trait
        var parts: [String] = []
        parts.append((t["warm"] ?? 0) >= 0.15 ? L10n.t("温和") : ((t["warm"] ?? 0) <= -0.15 ? L10n.t("清冷") : L10n.t("不冷不热")))
        parts.append((t["out"] ?? 0) >= 0.15 ? L10n.t("外向") : ((t["out"] ?? 0) <= -0.15 ? L10n.t("内敛") : L10n.t("张弛有度")))
        parts.append((t["rat"] ?? 0) >= 0.15 ? L10n.t("偏理性") : ((t["rat"] ?? 0) <= -0.15 ? L10n.t("凭感觉") : L10n.t("理性与直觉各半")))
        parts.append((t["sta"] ?? 0) >= 0.15 ? L10n.t("稳") : ((t["sta"] ?? 0) <= -0.15 ? L10n.t("跳脱") : L10n.t("节奏自由")))
        return parts.joined(separator: L10n.t("、"))
    }

    func crossCulture(_ profile: NMProfile, wantGender: String?) -> (zh: NameResult?, en: EnRank?) {
        let zhList = rankNames(profile, RankOptions(surname: defaultSurname(), wantGender: wantGender,
                                                    wantTags: nil, limit: nil, feedback: FeedbackOptions()))
        let zh = sampleTop(zhList, 0.6, 1, [], score: { $0.score }, key: { $0.full }).first
        let enList = rankEnNames(profile, wantGender: wantGender)
        let en = sampleTop(enList, 0.6, 1, [], score: { $0.score }, key: { $0.name.n }).first
        return (zh, en)
    }

    func defaultSurname() -> NMSurname {
        data.surnames.first { $0.c == "李" } ?? data.surnames[0]
    }

    func domainWx(_ dom: String) -> String? { data.domainWx[dom] }

    func domainsCompatible(_ a: String, _ b: String) -> Bool {
        if a == b { return true }
        return (data.domainCompat[a] ?? []).contains(b)
    }

    // MARK: - 名人

    func celebsForName(_ given: String, _ chars: [String], limit: Int = 3) -> [CelebrityHit] {
        var seen = Set<Int>()
        var out: [Int] = []
        var score: [Int: Int] = [:]
        var howMap: [Int: String] = [:]

        func add(_ ix: Int, _ sc: Int, _ how: String) {
            if seen.contains(ix) {
                if sc > (score[ix] ?? 0) { score[ix] = sc; howMap[ix] = how }
                return
            }
            seen.insert(ix)
            score[ix] = sc
            howMap[ix] = how
            out.append(ix)
        }

        let allKeys = celebByKey.keys.sorted { $0.count > $1.count }
        for key in allKeys {
            if key.count < 2 { continue }
            if !given.contains(key) { continue }
            for ix in celebByKey[key] ?? [] { add(ix, 100 + key.count, "同名「\(key)」") }
        }
        if let list = celebByKey[given] {
            for ix in list { add(ix, 200, "同名") }
        }
        let strong = out.count
        if strong < limit {
            for c in chars {
                guard let list = celebByKey[c] else { continue }
                for ix in list { add(ix, 20, "同字「\(c)」") }
            }
        }
        out.sort { (score[$0] ?? 0) > (score[$1] ?? 0) }
        var hit: [CelebrityHit] = []
        for ix in out where hit.count < limit {
            let s = data.celebs[ix]
            hit.append(CelebrityHit(name: s.name, era: s.era, bio: s.bio, how: howMap[ix] ?? "", score: score[ix] ?? 0))
        }
        return hit
    }
}
