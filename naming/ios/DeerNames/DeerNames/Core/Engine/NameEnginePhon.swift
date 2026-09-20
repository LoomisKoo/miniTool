import Foundation

/* 音译 & 外文名 → 中文名 —— 移植自 engine.js 的
 * phonSim / romanSyllables / translitChars / matchSurnames / soundAffinity / chineseName。 */

struct TranslitResult {
    let given: String
    let chars: [String]
    let phSim: Double
    let score: Double
    let tSim: Double
    let sSim: Double
    let novelty: Double
    let vec: NameVector
    let source: String
    let note: String
}

struct ChineseNameResult {
    let surname: NMSurname
    let given: String
    let chars: [String]
    let full: String
    let score: Double
    let sound: Double
    let euphony: Double
    let surFit: Double
    let source: String
    let note: String
    let vec: NameVector
    let tier: Int
}

struct SurnameMatch {
    let surname: NMSurname
    let head: Double
    let fit: Double
}

extension NameEngine {

    // MARK: - 拼音相似度

    func phonSim(_ a0: String, _ b0: String) -> Double {
        let a = a0.lowercased().filter { $0.isASCII && $0.isLetter }
        let b = b0.lowercased().filter { $0.isASCII && $0.isLetter }
        if a.isEmpty || b.isEmpty { return 0 }
        if a == b { return 1 }
        if a.hasPrefix(b) || b.hasPrefix(a) { return 0.78 }
        let d = levenshtein(a, b)
        let maxLen = max(a.count, b.count)
        var sim = 1 - Double(d) / Double(maxLen)
        if a.first == b.first { sim += 0.12 }
        return clamp(sim, 0, 1)
    }

    private func levenshtein(_ a: String, _ b: String) -> Int {
        let m = Array(a), n = Array(b)
        if m.isEmpty { return n.count }
        if n.isEmpty { return m.count }
        var prev = Array(0...n.count)
        var cur = Array(repeating: 0, count: n.count + 1)
        for i in 1...m.count {
            cur[0] = i
            for j in 1...n.count {
                cur[j] = min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (m[i - 1] == n[j - 1] ? 0 : 1))
            }
            prev = cur
        }
        return prev[n.count]
    }

    // MARK: - 拉丁名切音节

    private static let onsets: Set<String> = [
        "ch", "sh", "th", "ph", "wh", "bl", "br", "cl", "cr", "dr", "fl", "fr",
        "gl", "gr", "pl", "pr", "sc", "sk", "sl", "sm", "sn", "sp", "st", "sw", "tr", "tw",
        "qu", "kn", "wr", "gn", "ps", "pn", "gh",
    ]

    private static func isVowel(_ c: Character) -> Bool { "aeiouy".contains(c) }

    func romanSyllables(_ word: String) -> [String] {
        let w = Array(word.lowercased().filter { $0.isASCII && $0.isLetter })
        if w.isEmpty { return [] }
        var parts: [String] = []
        var cur = ""
        var i = 0
        while i < w.count {
            let c = w[i]
            if !cur.isEmpty, let last = cur.last, Self.isVowel(last), !Self.isVowel(c) {
                let rest = String(w[i...])
                if let regex = try? NSRegularExpression(pattern: "^([^aeiouy]+)([aeiouy][\\s\\S]*)$"),
                   let m = regex.firstMatch(in: rest, range: NSRange(rest.startIndex..., in: rest)),
                   let consR = Range(m.range(at: 1), in: rest) {
                    let cons = String(rest[consR])
                    var on = ""
                    var k = min(3, cons.count)
                    while k >= 1 {
                        let candidate = String(cons.suffix(k))
                        if Self.onsets.contains(candidate) { on = candidate; break }
                        k -= 1
                    }
                    if on.isEmpty { on = String(cons.suffix(1)) }
                    let carry = String(cons.prefix(cons.count - on.count))
                    cur += carry
                    parts.append(cur)
                    cur = on
                    i += cons.count
                    continue
                }
            }
            cur.append(c)
            i += 1
        }
        if !cur.isEmpty { parts.append(cur) }
        return parts.isEmpty ? [String(w)] : parts
    }

    // MARK: - 音节 → 候选拼音

    private static let nucleus: [String: [String]] = [
        "a": ["a", "ai", "ya"], "e": ["e", "ei", "ai", "i"], "ee": ["i"], "ea": ["i"], "i": ["i", "yi"],
        "ie": ["i"], "o": ["o", "uo", "ao"], "oo": ["u"], "u": ["u", "ou", "yu"], "y": ["i"],
        "ai": ["ai"], "ay": ["ai", "ei"], "ou": ["ou", "o"], "ow": ["ou", "ao"], "au": ["ao"],
        "ei": ["ei"], "ey": ["i"], "oe": ["o"], "ue": ["u", "yu"], "ui": ["ui", "u"],
        "ia": ["ia", "ya"], "io": ["io", "o"], "iu": ["iu", "you"], "ua": ["ua", "wa"], "uo": ["uo", "o"],
    ]

    private static let onsetMap: [String: [String]] = [
        "c": ["k", "s"], "k": ["k"], "ch": ["q", "ch"], "sh": ["sh"], "th": ["s", "t"], "ph": ["f"],
        "v": ["w", "f"], "w": ["w", "wei"], "x": ["sh", "s"], "z": ["z", "s"], "j": ["j"],
        "qu": ["q"], "y": ["y", ""], "h": ["h"], "r": ["l", "r"], "l": ["l"], "g": ["g"],
        "gh": ["g"], "kn": ["n"], "wr": ["r"], "wh": ["w"], "ps": ["s"], "gn": ["n"],
    ]

    private static let cStripCoda = 0.20, cMToN = 0.15, cDouble = 0.05, cExpand = 0.15
    private static let cSingleVowel = 0.22, cOnsetFix = 0.10

    func syllCandidates(_ syl: String) -> [(py: String, cost: Double)] {
        if let cached = syllCandidateCache[syl] { return cached }
        var map: [String: Double] = [:]
        func add(_ s: String, _ cost: Double) {
            if s.isEmpty || s.count > 4 { return }
            guard s.allSatisfy({ $0.isASCII && $0.isLetter }) else { return }
            if map[s] == nil || (map[s] ?? 0) > cost { map[s] = cost }
        }
        add(syl, 0)
        add(syl.replacingOccurrences(of: "m$", with: "n", options: .regularExpression), Self.cMToN)
        add(syl.replacingOccurrences(of: "[mn]$", with: "", options: .regularExpression), Self.cStripCoda)
        add(syl.replacingOccurrences(of: "(.)\\1", with: "$1", options: .regularExpression), Self.cDouble)

        if let regex = try? NSRegularExpression(pattern: "^([^aeiouy]*)([aeiouy]+)([a-z]*)$"),
           let m = regex.firstMatch(in: syl, range: NSRange(syl.startIndex..., in: syl)),
           let r1 = Range(m.range(at: 1), in: syl),
           let r2 = Range(m.range(at: 2), in: syl),
           let r3 = Range(m.range(at: 3), in: syl) {
            let onset = String(syl[r1])
            let nucPart = String(syl[r2])
            let codaPart = String(syl[r3])

            var opts: [(on: String, cost: Double)] = []
            if onset.isEmpty {
                opts.append(("", 0))
            } else if let mapped = Self.onsetMap[onset] {
                for o in mapped { opts.append((o, 0)) }
            } else {
                opts.append((onset, 0))
                for ch in onset {
                    for o in (Self.onsetMap[String(ch)] ?? [String(ch)]) {
                        opts.append((o, Self.cOnsetFix))
                    }
                }
            }
            let nuc = Self.nucleus[nucPart] ?? [nucPart]
            var singles: [String] = []
            for ch in nucPart where !nuc.contains(String(ch)) { singles.append(String(ch)) }
            let codas = [codaPart,
                         codaPart.replacingOccurrences(of: "m$", with: "n", options: .regularExpression),
                         ""]
            for o in opts {
                for nu in nuc {
                    for co in codas {
                        add(o.on + nu + co, Self.cExpand + o.cost)
                    }
                }
            }
            for s in singles {
                for co in codas {
                    add((opts.first?.on ?? "") + s + co, Self.cSingleVowel)
                }
            }
        }
        let result = map.map { (py: $0.key, cost: $0.value) }
        syllCandidateCache[syl] = result
        return result
    }

    // MARK: - 音译：拉丁名 → 贴音的中文字

    func translitChars(_ latin: String, _ profile: NMProfile, surname: NMSurname?) -> [TranslitResult] {
        let syls = romanSyllables(latin)
        if syls.isEmpty { return [] }
        let pool = data.phonChars

        let perSyl: [[(ch: NMChar, sim: Double)]] = syls.prefix(2).map { syl in
            let cands = syllCandidates(syl)
            let scored = pool.map { ch -> (ch: NMChar, sim: Double) in
                var best = 0.0
                for c in cands {
                    let s = phonSim(c.py, ch.py) - c.cost
                    if s > best { best = s }
                }
                return (ch, best)
            }.sorted { $0.sim > $1.sim }
            let good = scored.filter { $0.sim > 0.55 }
            return Array((good.count >= 4 ? good : scored).prefix(12))
        }
        if perSyl.isEmpty || perSyl[0].isEmpty { return [] }

        var combos: [(chars: [String], phon: Double)] = []
        if perSyl.count == 1 || perSyl[1].isEmpty {
            for x in perSyl[0] { combos.append(([x.ch.c], x.sim)) }
        } else {
            for a in perSyl[0] {
                for b in perSyl[1] {
                    if a.ch.c == b.ch.c { continue }
                    combos.append(([a.ch.c, b.ch.c], (a.sim + b.sim) / 2))
                }
            }
        }

        let sur = surname ?? emptySurname()
        var out: [TranslitResult] = []
        for combo in combos {
            let chars = combo.chars
            let given = chars.joined()
            if !validate(sur, chars, given, ValidateOptions(skipDomain: true)) { continue }
            guard let vec = givenVec(chars) else { continue }
            let tSim = (cos(vec.trait, profile.trait, data.traitKeys) + 1) / 2
            let sSim = (cos(vec.style, profile.style, data.styleKeys) + 1) / 2
            let nov = 1 - (avgFreq(chars) - 1) / 4
            let syls = chars.map { c -> String in
                L10n.f("%@取%@音", c, getChar(c)?.py ?? "")
            }.joined(separator: L10n.t("、"))
            let note = translitNote(latin, chars, syls)
            out.append(TranslitResult(given: given, chars: chars, phSim: combo.phon,
                                      score: 0.55 * combo.phon + 0.25 * tSim + 0.20 * sSim,
                                      tSim: tSim, sSim: sSim, novelty: nov, vec: vec,
                                      source: "translit", note: note))
        }
        out.sort { $0.score > $1.score }

        // 去重
        var seenGiven = Set<String>()
        out = out.filter { seenGiven.insert($0.given).inserted }

        // 通行译名优先
        let key = latin.filter { $0.isASCII && $0.isLetter }.lowercased()
        var hit: String?
        if !key.isEmpty {
            if let e = data.namesEn.first(where: { $0.n.lowercased() == key }) { hit = e.zh }
            else if let e = data.enGivenZh.first(where: { $0.key.lowercased() == key }) { hit = e.value }
        }
        if let hit, !hit.isEmpty {
            let hitChars = Array(hit).map(String.init)
            if validate(sur, hitChars, hit, ValidateOptions(lite: true)) {
                let hv = givenVec(hitChars) ?? NameVector(trait: zero(data.traitKeys), style: zero(data.styleKeys), chars: hitChars)
                out.removeAll { $0.given == hit }
                out.insert(TranslitResult(given: hit, chars: hitChars, phSim: 1, score: 2,
                                          tSim: 1, sSim: 1, novelty: 0, vec: hv, source: "translit",
                                          note: L10n.f("「%@」的通行中文写法，读音与气质都贴合", latin)), at: 0)
            }
        }
        return out
    }

    /// 音译名的说明：现算，切语言时不用重新生成候选。
    func translitNote(_ latin: String, _ chars: [String], _ syls: String? = nil) -> String {
        let syllables = syls ?? chars.map { c -> String in
            L10n.f("%@取%@音", c, getChar(c)?.py ?? "")
        }.joined(separator: L10n.t("、"))
        return L10n.f("贴「%@」的发音，%@", latin, syllables)
    }

    func emptySurname() -> NMSurname {
        NMSurname(c: "", py: "", tone: 0, m: "", en: "", pop: 3, pys: nil, tones: nil, ro: "")
    }

    // MARK: - 外文名 → 正常中文名

    private static let latinHead: [String: [String]] = [
        "b": ["b"], "p": ["p"], "m": ["m"], "f": ["f"], "v": ["w", "f"],
        "d": ["d"], "t": ["t"], "n": ["n"], "l": ["l"], "r": ["l", "r"],
        "g": ["g"], "k": ["k", "g"], "c": ["k", "s"], "x": ["s", "sh", "x"],
        "s": ["s", "sh", "x"], "z": ["z", "zh"], "j": ["j", "zh"], "q": ["q", "ch"],
        "h": ["h"], "w": ["w", "y"], "y": ["y"], "e": ["", "y"], "a": ["", "y"],
        "i": ["", "y"], "o": ["", "y"], "u": ["", "y"],
    ]

    private func headClasses(_ word: String) -> [String]? {
        let w = Array(word.lowercased().filter { $0.isASCII && $0.isLetter })
        if w.isEmpty { return nil }
        let two = String(w.prefix(2))
        if two == "ch" { return ["ch", "q"] }
        if two == "sh" { return ["sh", "s"] }
        if two == "th" { return ["s", "t"] }
        if two == "ph" { return ["f"] }
        if two == "wh" { return ["w"] }
        if two == "gh" { return ["g"] }
        return Self.latinHead[String(w[0])]
    }

    func matchSurnames(_ latin: String, _ family: String?) -> [SurnameMatch] {
        let src = (family?.isEmpty == false ? family! : latin)
        let want = headClasses(src)
        var list: [SurnameMatch] = []
        for s in data.surnames {
            guard let first = surSyls(s).first else { continue }
            let ini = splitPy(first.py).ini
            var head = 0.0
            if let want {
                if want.contains(ini) { head = 1 }
                else if ini.isEmpty && want.contains("") { head = 1 }
                else if !ini.isEmpty, let f = ini.first, want.contains(String(f)) { head = 0.5 }
            }
            let common = (Double(s.pop) - 1) / 4
            let fit = head * 0.62 + common * 0.30 - (isCompound(s) ? 0.06 : 0)
            list.append(SurnameMatch(surname: s, head: head, fit: fit))
        }
        list.sort { $0.fit > $1.fit }
        return list
    }

    func soundAffinity(_ chars: [String], _ sylls: [String]) -> Double {
        if sylls.isEmpty { return 0 }
        let cands = sylls.map { syllCandidates($0) }
        var total = 0.0, n = 0
        for (c, ch) in chars.enumerated() {
            guard let it = getChar(ch) else { continue }
            let si = chars.count == 1 ? 0
                : Int((Double(c) * Double(cands.count - 1) / Double(max(1, chars.count - 1))).rounded())
            var best = 0.0
            let set = (si >= 0 && si < cands.count) ? cands[si] : []
            for k in set {
                let v = phonSim(it.py, k.py) - k.cost
                if v > best { best = v }
            }
            total += max(0, best)
            n += 1
        }
        return n > 0 ? total / Double(n) : 0
    }

    func chineseName(_ latinRaw: String, _ profile: NMProfile, family: String?, wantGender: String?,
                     count: Int = 8, temperature: Double = 0.34, allowCompound: Bool = true) -> [ChineseNameResult] {
        let latin = latinRaw.trimmingCharacters(in: .whitespacesAndNewlines)
        if latin.isEmpty { return [] }
        let syls = romanSyllables(latin)
        if syls.isEmpty { return [] }

        let matched = matchSurnames(latin, family)
        var surs = Array(matched.prefix(6))
        if !surs.contains(where: { isCompound($0.surname) }) {
            if let comp = matched.first(where: { isCompound($0.surname) }) { surs.append(comp) }
        }
        var out: [ChineseNameResult] = []
        var seen = Set<String>()

        for cand in surs {
            let sur = cand.surname
            let wantLen = isCompound(sur) ? 1 : 2
            let pool = namesForSurname(profile, sur, wantGender: wantGender)
            var taken = 0
            for x in pool where taken < 140 {
                if x.chars.count != wantLen { continue }
                if seen.contains(x.full) { continue }
                let sound = soundAffinity(x.chars, syls)
                let eu = x.euphony ?? euphony(sur, x.chars)
                let mix = x.score * 0.54 + eu * 0.20 + sound * 0.13 + cand.fit * 0.13
                seen.insert(x.full)
                taken += 1
                out.append(ChineseNameResult(surname: sur, given: x.given, chars: x.chars, full: x.full,
                                             score: mix, sound: sound, euphony: eu, surFit: cand.fit,
                                             source: x.source, note: x.note, vec: x.vec, tier: x.tier))
            }
        }
        out.sort { $0.score > $1.score }
        var picked = sampleTop(out, temperature, count, [], score: { $0.score }, key: { $0.full })
        if allowCompound && !picked.contains(where: { isCompound($0.surname) }) {
            if let comp = out.first(where: { isCompound($0.surname) }) {
                if picked.count >= count && picked.count > 1 { picked[picked.count - 1] = comp }
                else { picked.append(comp) }
            }
        }
        return picked
    }
}
