import Foundation

/* 名字对比报告：把字义、名人、性格雷达、生辰五行等拼成「为什么合适 / 要注意什么」的叙述。
 * 不编造诗词原句（数据里没有出处库），名人传记与引擎已有判定为准。 */

struct NameReportSection: Hashable {
    let title: String
    let lines: [String]
}

struct NameReportComparePick: Hashable, Identifiable {
    var id: String { dimension }
    let dimension: String
    let winner: String
    let detail: String
}

struct NameReportComparison: Hashable {
    let picks: [NameReportComparePick]
    let summary: [String]
}

enum NameReportAnalyzer {
    static func compareCandidates(names: [NameResult],
                                  profile: NMProfile?,
                                  bazi: BaziInfo?) -> NameReportComparison? {
        guard names.count >= 2 else { return nil }
        let engine = NameEngine.shared
        var picks: [NameReportComparePick] = []

        let scored = names.map { ($0, qualityScore($0, profile: profile, bazi: bazi)) }
        if let top = scored.max(by: { $0.1 < $1.1 }) {
            picks.append(NameReportComparePick(
                dimension: L10n.t("综合评分"),
                winner: top.0.full,
                detail: L10n.f("%ld/100——读感、音韵、性格与生辰一起权衡后的领先者。", top.1)
            ))
        }

        if let profile, profile.hasAnswered {
            let fits = names.map { ($0, personalityFit($0, profile: profile, engine: engine)) }
            if let top = fits.max(by: { $0.1 < $1.1 }) {
                picks.append(NameReportComparePick(
                    dimension: L10n.t("性格贴合"),
                    winner: top.0.full,
                    detail: L10n.f("七维综合约 %ld%%，和你测出来的气质画像最接近。", top.1)
                ))
            }
        }

        let sounds = names.map {
            ($0, $0.euphony ?? engine.euphony($0.surname, $0.chars))
        }
        if let top = sounds.max(by: { $0.1 < $1.1 }) {
            picks.append(NameReportComparePick(
                dimension: L10n.t("读音顺口"),
                winner: top.0.full,
                detail: engine.euphonyLabel(top.1) + L10n.t("——日常被叫、点名时更省力。")
            ))
        }

        let reads = names.map { name -> (NameResult, Int, Bool) in
            let r = engine.readability(name.surname, name.chars)
            return (name, r.issues.count, r.ok)
        }
        if let top = reads.min(by: {
            if $0.1 != $1.1 { return $0.1 > $1.1 }
            return !$0.2 && $1.2
        }) {
            let detail = top.2
                ? L10n.t("未发现明显拗口、谐音或意象冲突。")
                : L10n.t("仍有需要注意的读感点，见该名下方「读音与避雷」。")
            picks.append(NameReportComparePick(
                dimension: L10n.t("读感避雷"),
                winner: top.0.full,
                detail: detail
            ))
        }

        if let bazi, bazi.ok, !bazi.favor.isEmpty {
            let wx = names.map { ($0, favorTouchCount($0.chars, bazi: bazi, engine: engine)) }
            if let top = wx.max(by: { $0.1 < $1.1 }), top.1 > 0 {
                picks.append(NameReportComparePick(
                    dimension: L10n.t("生辰五行"),
                    winner: top.0.full,
                    detail: L10n.f("有 %ld 个字踩在宜补的五行上，更贴近传统「补缺」取名。", top.1)
                ))
            } else {
                picks.append(NameReportComparePick(
                    dimension: L10n.t("生辰五行"),
                    winner: L10n.t("都不算补运向"),
                    detail: L10n.f("几个名字都未直接带出宜补的%@，更适合按字义、气质来选。", BaziEngine.wxText(bazi.favor))
                ))
            }
        }

        let celebLoad = names.map { name -> (NameResult, Int) in
            let given = name.given.isEmpty ? name.chars.joined() : name.given
            let topScore = engine.celebsForName(given, name.chars, limit: 1).first?.score ?? 0
            return (name, topScore)
        }
        if let light = celebLoad.min(by: { $0.1 < $1.1 }) {
            picks.append(NameReportComparePick(
                dimension: L10n.t("名人联想"),
                winner: light.0.full,
                detail: light.1 >= 180
                    ? L10n.t("几个名字联想都偏强，这项只是相对更低调。")
                    : L10n.t("名人标签相对轻，不容易被公众人物「抢戏」。")
            ))
        }

        var summary: [String] = []
        if names.count == 2 {
            let left = scored[0], right = scored[1]
            if left.0.full != right.0.full {
                if left.1 != right.1 {
                    summary.append(L10n.f("综合分上「%1$@」领先 %2$ld 分；若家人更看重顺口或八字，请看上表对应项的胜出名字。", left.1 >= right.1 ? left.0.full : right.0.full, abs(left.1 - right.1)))
                }
                if let profile, profile.hasAnswered {
                    let f0 = personalityFit(left.0, profile: profile, engine: engine)
                    let f1 = personalityFit(right.0, profile: profile, engine: engine)
                    if abs(f0 - f1) >= 8 {
                        let better = f0 >= f1 ? left.0.full : right.0.full
                        let weaker = f0 >= f1 ? right.0.full : left.0.full
                        summary.append(L10n.f("性格上更贴你的是「%@」；若选「%@」，名字气质会和本人印象差一截，要靠寓意说服家人。", better, weaker))
                    }
                }
            }
        }
        if summary.isEmpty {
            summary.append(L10n.t("家人讨论时先对齐：更看重顺口、补运、还是文化寓意，再按上表对应项拍板。"))
        }

        return NameReportComparison(picks: picks, summary: summary)
    }

    static func qualityScore(_ name: NameResult, profile: NMProfile?, bazi: BaziInfo?) -> Int {
        let engine = NameEngine.shared
        let read = engine.readability(name.surname, name.chars)
        let sound = name.euphony ?? engine.euphony(name.surname, name.chars)
        var score = Int((sound * 55).rounded())
        if read.ok { score += 25 }
        let speech = SpeechHelper.inspect(surname: name.surname, chars: name.chars)
        if speech.polyphones.isEmpty { score += 10 }
        if let profile, profile.hasAnswered {
            let fit = personalityFit(name, profile: profile, engine: engine)
            score += fit / 10
        }
        let chart = (bazi?.ok == true) ? bazi : profile?.bazi
        if let chart, chart.ok, favorTouchCount(name.chars, bazi: chart, engine: engine) > 0 {
            score += 5
        }
        return min(100, max(0, score))
    }

    static func radarItems(profile: NMProfile, vec: NameVector) -> [RadarItem] {
        NameEngine.shared.radar(profile, vec)
    }

    static func analyze(name: NameResult,
                        profile: NMProfile?,
                        bazi: BaziInfo?) -> [NameReportSection] {
        let engine = NameEngine.shared
        let given = name.given.isEmpty ? name.chars.joined() : name.given
        var sections: [NameReportSection] = []

        let culture = cultureSection(given: given, chars: name.chars, engine: engine)
        if !culture.isEmpty {
            sections.append(NameReportSection(title: L10n.t("文化联想与名义"), lines: culture))
        }

        let chars = charSection(surname: name.surname, chars: name.chars, bazi: bazi, engine: engine)
        if !chars.isEmpty {
            sections.append(NameReportSection(title: L10n.t("用字来由与意象"), lines: chars))
        }

        if let profile, profile.hasAnswered {
            let personality = personalitySection(profile: profile, vec: name.vec, engine: engine)
            if !personality.isEmpty {
                sections.append(NameReportSection(title: L10n.t("性格气质是否合拍"), lines: personality))
            }
        }

        let wx = baziSection(chars: name.chars, bazi: bazi, engine: engine)
        if !wx.isEmpty {
            sections.append(NameReportSection(title: L10n.t("生辰与五行"), lines: wx))
        }

        let caution = cautionSection(surname: name.surname, chars: name.chars, given: given, engine: engine)
        if !caution.isEmpty {
            sections.append(NameReportSection(title: L10n.t("读音与避雷"), lines: caution))
        }

        return sections
    }

    // MARK: - 文化 / 名人

    private static func cultureSection(given: String, chars: [String], engine: NameEngine) -> [String] {
        var lines: [String] = []
        let literary = literaryEchoLines(given: given, engine: engine)
        lines.append(contentsOf: literary)

        let curated = engine.data.given.first(where: { $0.n == given })
        if let curated {
            if curated.tag == "literary" {
                lines.append(L10n.t("这是精选「清雅」名，多从诗词意境、典籍语感里挑字组合，文化气质偏文气、书卷，不是口语化的流行组合。"))
            } else {
                lines.append(L10n.t("这是常见精选名，字义清晰、好认好叫，文化联想相对中性，适合希望稳妥、少争议的家庭。"))
            }
        }
        if literary.isEmpty, let meaning = engine.givenMeaning(given), !meaning.isEmpty {
            lines.append(L10n.f("名义脉络：%@。向长辈解释「为什么选这个名字」时，可以先把这句说清楚。", meaning))
        }

        let celebs = engine.celebsForName(given, chars, limit: 2)
        for hit in celebs {
            let era = L10n.celebTag(hit.era)
            let bio = L10n.d("celebs", hit.name, hit.bio)
            let shortBio = bio.count > 120 ? String(bio.prefix(117)) + "…" : bio
            lines.append(L10n.f("因%@会联想到 %@（%@）。%@", hit.how, hit.name, era, shortBio))
            lines.append(celebVerdict(hit))
        }

        if lines.isEmpty, chars.count == 2,
           let d0 = engine.getChar(chars[0])?.dom,
           let d1 = engine.getChar(chars[1])?.dom,
           let l0 = domainLabel(d0, engine: engine),
           let l1 = domainLabel(d1, engine: engine) {
            if engine.domainsCompatible(d0, d1) {
                lines.append(L10n.f("两字意象「%@」与「%@」能放在同一幅画里，不是硬凑的生僻组合。", l0, l1))
            } else {
                lines.append(L10n.f("两字意象「%@」与「%@」跨度较大，名字会更有反差感；若你喜欢独特可以保留，若追求一体感要再斟酌。", l0, l1))
            }
        }
        return lines
    }

    private static func celebVerdict(_ hit: CelebrityHit) -> String {
        let era = hit.era
        let literary = era.contains("诗") || era.contains("词") || era.contains("文学") || era.contains("作家")
        if hit.score >= 180 {
            return L10n.t("和名字几乎绑在一起，日常被叫时很难避开这位名人的标签；喜欢这种文化辨识度是加分，想低调则要慎重。")
        }
        if hit.score >= 90 {
            return literary
                ? L10n.t("联想偏文人、历史感，一般不会显得俗气，适合希望名字有故事感的家庭。")
                : L10n.t("联想比较具体，建议在家庭里先对齐：能否接受这类公众人物带来的第一印象。")
        }
        return L10n.t("属于轻量文化联想，不会像「完全同名」那样压过孩子自己的气质。")
    }

    // MARK: - 单字

    private static func charSection(surname: NMSurname?,
                                    chars: [String],
                                    bazi: BaziInfo?,
                                    engine: NameEngine) -> [String] {
        var lines: [String] = []
        let favor = Set(bazi?.favor ?? [])
        for ch in chars {
            guard let it = engine.getChar(ch) else { continue }
            let note = engine.charNote(ch)
            let dom = domainLabel(it.dom, engine: engine) ?? it.dom
            var line = L10n.f("「%@」读 %@，字义取「%@」，意象「%@」。", ch, note.py, note.text, dom)
            if let wx = engine.domainWx(it.dom), !wx.isEmpty {
                let wxName = L10n.t(wx)
                if bazi?.ok == true, !favor.isEmpty {
                    if favor.contains(wx) {
                        line += L10n.f("五行属%@，和你生辰里宜补的方向一致。", wxName)
                    } else if bazi?.lack.contains(wx) == true {
                        line += L10n.f("五行属%@，而你八字里偏偏缺这一行——不是不能用，但「补运」角度不算贴切。", wxName)
                    } else {
                        line += L10n.f("五行属%@，不冲突，但也不是专门来补你八字的。", wxName)
                    }
                } else {
                    line += L10n.f("五行属%@。", wxName)
                }
            }
            lines.append(line)
        }
        if chars.count == 2,
           let d0 = engine.getChar(chars[0])?.dom,
           let d1 = engine.getChar(chars[1])?.dom {
            if engine.domainsCompatible(d0, d1) {
                lines.append(L10n.t("两个字意象能互相托住，读起来像一个完整意思，而不是各说各话。"))
            } else {
                lines.append(L10n.t("两个字意象差别大，名字会更「跳」、更有记忆点，但也更考验你是否喜欢这种反差。"))
            }
        }
        return lines
    }

    // MARK: - 性格

    private static func personalitySection(profile: NMProfile,
                                           vec: NameVector,
                                           engine: NameEngine) -> [String] {
        let radar = engine.radar(profile, vec)
        guard !radar.isEmpty else { return [] }
        var lines: [String] = []
        let fit = radar.map(\.name).reduce(0, +) / radar.count
        lines.append(L10n.f("七维综合贴合约 %ld%%——不是「像不像你」的唯一标准，但能帮家人理解气质方向。", fit))

        let ranked = radar
            .map { (item: $0, gap: abs($0.name - $0.mine)) }
            .sorted { $0.gap < $1.gap }

        if let best = ranked.first, best.gap <= 14 {
            let lean = best.item.name >= best.item.mine ? best.item.high : best.item.low
            lines.append(L10n.f("最合拍的是「%@」：你偏%@，名字也偏%@，被称呼时不容易违和。", best.item.label, mineLean(best.item), lean))
        }
        if let loose = ranked.last, loose.gap >= 24, ranked.count > 1 {
            let mineSide = loose.item.mine >= 50 ? loose.item.high : loose.item.low
            let nameSide = loose.item.name >= 50 ? loose.item.high : loose.item.low
            lines.append(L10n.f("「%@」差得最明显：你更%@，名字更%@。若你希望名字和本人印象一致，这是要权衡的一点。", loose.item.label, mineSide, nameSide))
        }
        return lines
    }

    private static func mineLean(_ item: RadarItem) -> String {
        item.mine >= 50 ? item.high : item.low
    }

    // MARK: - 八字

    private static func baziSection(chars: [String], bazi: BaziInfo?, engine: NameEngine) -> [String] {
        guard let bazi, bazi.ok else {
            return [L10n.t("未填生辰时，下面五行只按字义与意象理解，不作「补运」结论。")]
        }
        var lines: [String] = [bazi.summary]
        let explain = BaziEngine.explainName(chars, bazi)
        if !explain.isEmpty {
            if touchesFavorWx(chars: chars, favor: bazi.favor, engine: engine) {
                lines.append(L10n.f("从五行看：%@——和传统「生辰补缺」方向一致。", explain))
            } else {
                lines.append(L10n.f("从五行看：名字没有带出宜补的%@（%@）。更适合当「好义、好听」名；若家里极重八字补运，需再斟酌。", BaziEngine.wxText(bazi.favor), explain))
            }
        }
        let lack = Set(bazi.lack)
        let weak = Set(bazi.weak)
        for ch in chars {
            guard let it = engine.getChar(ch), let wx = engine.domainWx(it.dom) else { continue }
            if lack.contains(wx) {
                lines.append(L10n.f("「%@」属%@，而八字里缺这一行——若讲究五行平衡，这不是优先选择。", ch, L10n.t(wx)))
            } else if weak.contains(wx) {
                lines.append(L10n.f("「%@」属%@，对应你偏弱的一行，不算冲突，但也不是最省心的补法。", ch, L10n.t(wx)))
            }
        }
        return lines
    }

    // MARK: - 避雷

    private static func cautionSection(surname: NMSurname?,
                                       chars: [String],
                                       given: String,
                                       engine: NameEngine) -> [String] {
        let read = engine.readability(surname, chars)
        let speech = SpeechHelper.inspect(surname: surname, chars: chars)
        var lines: [String] = []
        for hint in speech.polyphones {
            lines.append(L10n.f("多音字「%@」名字里更常读 %@（另有 %@）。向老师、护士说明读音，可以避免被念错。", hint.ch, hint.namePy, hint.altPy))
        }
        for issue in read.issues {
            lines.append(L10n.f("要注意：%@——长期被叫时，这个问题比纸面看名字更影响体验。", issue))
        }
        if !engine.validate(surname, chars, given, ValidateOptions(lite: true)) {
            lines.append(L10n.t("谐音或连读触发了内置避雷规则，不建议作为正式大名，除非你们非常确定要承担误会风险。"))
        }
        for good in read.good.prefix(3) {
            lines.append(L10n.f("顺口方面：%@。", good))
        }
        if read.ok, lines.isEmpty {
            lines.append(L10n.t("读音与连读未发现明显雷点，日常称呼比较省心。"))
        }
        return lines
    }

    private static func domainLabel(_ dom: String, engine: NameEngine) -> String? {
        guard let d = engine.data.domains[dom] else { return nil }
        return L10n.t(d.label)
    }

    private static func literaryEchoLines(given: String, engine: NameEngine) -> [String] {
        guard let g = engine.data.given.first(where: { $0.n == given }) else { return [] }
        let meaning = engine.givenMeaning(given) ?? g.m
        guard !meaning.isEmpty else { return [] }

        var lines: [String] = []
        let hasCitation = meaning.contains("《") || meaning.contains("》")
            || meaning.contains(L10n.t("出自"))
        if g.tag == "literary" {
            if hasCitation {
                lines.append(L10n.f("典故与出处：%@。这类名字的优势是「说得清来历」；若孩子性格很外放、很现代，名字会显得略重，要提前接受这份文化期待。", meaning))
            } else {
                lines.append(L10n.f("古典意境：%@。没有固定到某一句诗，但字义组合偏山水、节气、器物等传统意象——适合重视审美、愿意向孩子讲名字故事的家庭。", meaning))
            }
        } else if hasCitation {
            lines.append(L10n.f("名义里带有典籍线索：%@。不算典型文艺名，但解释起来仍有抓手。", meaning))
        }
        return lines
    }

    private static func personalityFit(_ name: NameResult, profile: NMProfile, engine: NameEngine) -> Int {
        let radar = engine.radar(profile, name.vec)
        guard !radar.isEmpty else { return 0 }
        return radar.map(\.name).reduce(0, +) / radar.count
    }

    private static func favorTouchCount(_ chars: [String], bazi: BaziInfo, engine: NameEngine) -> Int {
        let favor = Set(bazi.favor)
        var n = 0
        for ch in chars {
            guard let it = engine.getChar(ch),
                  let wx = engine.domainWx(it.dom),
                  favor.contains(wx) else { continue }
            n += 1
        }
        return n
    }

    private static func touchesFavorWx(chars: [String], favor: [String], engine: NameEngine) -> Bool {
        let set = Set(favor)
        for ch in chars {
            guard let it = engine.getChar(ch),
                  let wx = engine.domainWx(it.dom),
                  set.contains(wx) else { continue }
            return true
        }
        return false
    }
}
