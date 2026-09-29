import Foundation

/* Swift 版生辰八字 —— 移植自 `src/bazi.js`。
 * 公历 →（农历展示）→ 四柱干支 → 五行统计 → 宜补五行。
 * 年柱以立春为界，月柱以「节」为界；日柱用固定锚点推干支。
 * 不做完整旺衰/大运，只服务取名「缺什么补什么」。 */

struct BaziSolar: Codable, Hashable {
    let y: Int
    let m: Int
    let d: Int
    let hour: Int
}

struct BaziLunar: Codable, Hashable {
    let y: Int
    let m: Int
    let d: Int
    let leap: Bool
}

struct BaziPillars: Codable, Hashable {
    let year: String
    let month: String
    let day: String
    let hour: String
}

struct BaziInfo: Codable, Hashable {
    let ok: Bool
    let error: String?
    let solar: BaziSolar?
    let lunar: BaziLunar?
    let pillars: BaziPillars?
    let dayMaster: String
    let dayWx: String
    let counts: [String: Double]
    let lack: [String]
    let weak: [String]
    let favor: [String]

    /* 下面三条是**展示文案**，跟着界面语言走，所以每次现算。
     * 之前把它们存进结构体（结构体又存进画像/收藏），切语言后旧的句子会残留成中文。 */

    var pillarStr: String {
        let labels = [pillars?.year, pillars?.month, pillars?.day, pillars?.hour]
            .compactMap { $0 }.filter { !$0.isEmpty }
        return (L10n.isEnglish ? labels.map(BaziEngine.pillarLabelEn) : labels)
            .joined(separator: " · ")
    }

    var summary: String {
        guard ok else { return "" }
        let dm = L10n.isEnglish ? BaziEngine.ganPinyin(dayMaster) : dayMaster
        return L10n.f("日主%@%@，%@，%@", dm, L10n.t(dayWx), lackText, L10n.f("宜补%@", BaziEngine.wxText(favor)))
    }

    var short: String {
        guard ok else { return "" }
        return L10n.f("%@ · %@", lackText, L10n.f("宜补%@", BaziEngine.wxText(favor)))
    }

    private var lackText: String {
        !lack.isEmpty ? L10n.f("五行缺%@", BaziEngine.wxText(lack))
            : (!weak.isEmpty ? L10n.f("五行偏弱于%@", BaziEngine.wxText(weak)) : L10n.t("五行较均衡"))
    }

    static func failure(_ message: String) -> BaziInfo {
        BaziInfo(ok: false, error: message, solar: nil, lunar: nil, pillars: nil,
                 dayMaster: "", dayWx: "", counts: [:], lack: [], weak: [], favor: [])
    }
}

enum BaziEngine {
    static let gan = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"]
    static let zhi = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"]
    static let wx = ["木", "火", "土", "金", "水"]
    static let ganWx = ["木", "木", "火", "火", "土", "土", "金", "金", "水", "水"]
    /* 英文界面下把干支写成拼音：「癸水」→「Gui (Water)」「戊寅」→「Wu-Yin」，
     * 汉字本身（数据）不动，只是多一种读法。 */
    static let ganPy = ["Jia", "Yi", "Bing", "Ding", "Wu", "Ji", "Geng", "Xin", "Ren", "Gui"]
    static let zhiPy = ["Zi", "Chou", "Yin", "Mao", "Chen", "Si", "Wu", "Wei", "Shen", "You", "Xu", "Hai"]
    static let zhiWx = ["水", "土", "木", "木", "土", "火", "火", "土", "金", "金", "土", "水"]
    static let zhiHidden: [String: [String]] = [
        "子": ["癸"], "丑": ["己", "癸", "辛"], "寅": ["甲", "丙", "戊"], "卯": ["乙"],
        "辰": ["戊", "乙", "癸"], "巳": ["丙", "庚", "戊"], "午": ["丁", "己"], "未": ["己", "丁", "乙"],
        "申": ["庚", "壬", "戊"], "酉": ["辛"], "戌": ["戊", "辛", "丁"], "亥": ["壬", "甲"],
    ]

    static let hourNames = [
        "子时 · 23–01", "丑时 · 01–03", "寅时 · 03–05", "卯时 · 05–07",
        "辰时 · 07–09", "巳时 · 09–11", "午时 · 11–13", "未时 · 13–15",
        "申时 · 15–17", "酉时 · 17–19", "戌时 · 19–21", "亥时 · 21–23",
    ]

    /* 农历年数据 1900–2100（经典压缩表） */
    static let lunarTable: [Int] = [
        0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2,
        0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977,
        0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970,
        0x06566, 0x0d4a0, 0x0ea50, 0x06e95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950,
        0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557,
        0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5b0, 0x14573, 0x052b0, 0x0a9a8, 0x0e950, 0x06aa0,
        0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0,
        0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b6a0, 0x195a6,
        0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570,
        0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x05ac0, 0x0ab60, 0x096d5, 0x092e0,
        0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5,
        0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930,
        0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530,
        0x05aa0, 0x076a3, 0x096d0, 0x04afb, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45,
        0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0,
        0x14b63, 0x09370, 0x049f8, 0x04970, 0x064b0, 0x168a6, 0x0ea50, 0x06b20, 0x1a6c4, 0x0aae0,
        0x092e0, 0x0d2e3, 0x0c960, 0x0d557, 0x0d4a0, 0x0da50, 0x05d55, 0x056a0, 0x0a6d0, 0x055d4,
        0x052d0, 0x0a9b8, 0x0a950, 0x0b4a0, 0x0b6a6, 0x0ad50, 0x055a0, 0x0aba4, 0x0a5b0, 0x052b0,
        0x0b273, 0x06930, 0x07337, 0x06aa0, 0x0ad50, 0x14b55, 0x04b60, 0x0a570, 0x054e4, 0x0d160,
        0x0e968, 0x0d520, 0x0daa0, 0x16aa6, 0x056d0, 0x04ae0, 0x0a9d4, 0x0a4d0, 0x0d150, 0x0f252,
        0x0d520,
    ]

    static let termMin = [
        0, 21208, 42467, 63836, 85337, 107014, 128867, 150921,
        173149, 195551, 218072, 240693, 263343, 285989, 308563, 331033,
        353350, 375494, 397447, 419210, 440795, 462224, 483532, 504758,
    ]

    private static let termBase = utcMillis(1900, 1, 6, 2, 5)

    private static func utcMillis(_ y: Int, _ m: Int, _ d: Int, _ h: Int = 0, _ mi: Int = 0) -> Double {
        var comps = DateComponents()
        comps.year = y; comps.month = m; comps.day = d; comps.hour = h; comps.minute = mi
        comps.timeZone = TimeZone(identifier: "UTC")
        let date = Calendar(identifier: .gregorian).date(from: comps) ?? Date(timeIntervalSince1970: 0)
        return date.timeIntervalSince1970 * 1000
    }

    private static func termDate(_ y: Int, _ n: Int) -> (y: Int, m: Int, d: Int, h: Int) {
        let ms = 31556925974.7 * Double(y - 1900) + Double(termMin[n]) * 60000
        let date = Date(timeIntervalSince1970: (termBase + ms) / 1000)
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC")!
        let c = cal.dateComponents([.year, .month, .day, .hour], from: date)
        return (c.year ?? 0, c.month ?? 0, c.day ?? 0, c.hour ?? 0)
    }

    private static func ymdNum(_ y: Int, _ m: Int, _ d: Int) -> Int { y * 10000 + m * 100 + d }

    private static func leapMonth(_ y: Int) -> Int { lunarTable[y - 1900] & 0xf }
    private static func leapDays(_ y: Int) -> Int {
        leapMonth(y) != 0 ? ((lunarTable[y - 1900] & 0x10000) != 0 ? 30 : 29) : 0
    }
    private static func monthDays(_ y: Int, _ m: Int) -> Int {
        (lunarTable[y - 1900] & (0x10000 >> m)) != 0 ? 30 : 29
    }
    private static func yearDays(_ y: Int) -> Int {
        var sum = 348
        var i = 0x8000
        while i > 0x8 {
            if (lunarTable[y - 1900] & i) != 0 { sum += 1 }
            i >>= 1
        }
        return sum + leapDays(y)
    }

    static func solarToLunar(_ y: Int, _ m: Int, _ d: Int) -> BaziLunar? {
        if y < 1900 || y > 2100 { return nil }
        let base = utcMillis(1900, 1, 31)
        let target = utcMillis(y, m, d)
        var offset = Int(((target - base) / 86400000).rounded())
        var temp = 0
        var i = 1900
        while i < 2101 && offset > 0 {
            temp = yearDays(i)
            offset -= temp
            i += 1
        }
        if offset < 0 { offset += temp; i -= 1 }
        let ly = i
        let leap = leapMonth(ly)
        var isLeap = false
        i = 1
        while i < 13 && offset > 0 {
            if leap > 0 && i == leap + 1 && !isLeap {
                i -= 1; isLeap = true; temp = leapDays(ly)
            } else {
                temp = monthDays(ly, i)
            }
            if isLeap && i == leap + 1 { isLeap = false }
            offset -= temp
            i += 1
        }
        if offset == 0 && leap > 0 && i == leap + 1 {
            if isLeap { isLeap = false } else { isLeap = true; i -= 1 }
        }
        if offset < 0 { offset += temp; i -= 1 }
        return BaziLunar(y: ly, m: i, d: offset + 1, leap: isLeap)
    }

    private static func gzLabel(_ gi: Int, _ zi: Int) -> String { gan[gi] + zhi[zi] }

    private static func dayGZ(_ y: Int, _ m: Int, _ d: Int) -> (gan: Int, zhi: Int, idx: Int, label: String) {
        let base = utcMillis(1900, 1, 1)
        let t = utcMillis(y, m, d)
        let offset = Int(((t - base) / 86400000).rounded())
        var idx = (10 + offset) % 60
        if idx < 0 { idx += 60 }
        _ = offset
        return (idx % 10, idx % 12, idx, gzLabel(idx % 10, idx % 12))
    }

    private static func yearGZ(_ y: Int, _ m: Int, _ d: Int) -> (gan: Int, zhi: Int, label: String, year: Int) {
        let lichun = termDate(y, 2)
        var yy = y
        if ymdNum(y, m, d) < ymdNum(lichun.y, lichun.m, lichun.d) { yy = y - 1 }
        var gan = (yy - 4) % 10
        var zhi = (yy - 4) % 12
        if gan < 0 { gan += 10 }
        if zhi < 0 { zhi += 12 }
        return (gan, zhi, gzLabel(gan, zhi), yy)
    }

    private static func monthGZ(_ y: Int, _ m: Int, _ d: Int, _ yearGan: Int) -> (gan: Int, zhi: Int, label: String) {
        let jie = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 0]
        var monthZhi = 2
        for i in 0..<12 {
            let ty = jie[i] == 0 ? y + 1 : y
            let t = termDate(ty, jie[i] == 0 ? 0 : jie[i])
            if ymdNum(y, m, d) >= ymdNum(t.y, t.m, t.d) { monthZhi = (i + 2) % 12 }
        }
        let startGan = [2, 4, 6, 8, 0][yearGan % 5]
        let gan = (startGan + ((monthZhi - 2 + 12) % 12)) % 10
        return (gan, monthZhi, gzLabel(gan, monthZhi))
    }

    private static func hourGZ(_ dayGan: Int, _ hour: Int) -> (gan: Int, zhi: Int, label: String)? {
        if hour < 0 { return nil }
        let zhi = ((hour + 1) % 24) / 2
        let start = [0, 2, 4, 6, 8][dayGan % 5]
        let gan = (start + zhi) % 10
        return (gan, zhi, gzLabel(gan, zhi))
    }

    private static func analyze(_ pillars: (year: (gan: Int, zhi: Int, label: String, year: Int),
                                            month: (gan: Int, zhi: Int, label: String),
                                            day: (gan: Int, zhi: Int, idx: Int, label: String),
                                            hour: (gan: Int, zhi: Int, label: String)?))
        -> (counts: [String: Double], lack: [String], weak: [String], favor: [String]) {
        var counts: [String: Double] = ["木": 0, "火": 0, "土": 0, "金": 0, "水": 0]
        var list: [(gan: Int, zhi: Int)] = [(pillars.year.gan, pillars.year.zhi),
                                            (pillars.month.gan, pillars.month.zhi),
                                            (pillars.day.gan, pillars.day.zhi)]
        if let h = pillars.hour { list.append((h.gan, h.zhi)) }
        for p in list {
            let g = p.gan, z = p.zhi
            counts[ganWx[g]] = (counts[ganWx[g]] ?? 0) + 1
            counts[zhiWx[z]] = (counts[zhiWx[z]] ?? 0) + 1
            let hidden = zhiHidden[zhi[z]] ?? []
            for h in hidden {
                if let gi = gan.firstIndex(of: h) {
                    counts[ganWx[gi]] = (counts[ganWx[gi]] ?? 0) + 0.4
                }
            }
        }
        var lack: [String] = [], weak: [String] = []
        for w in wx {
            let c = counts[w] ?? 0
            if c < 0.5 { lack.append(w) }
            else if c < 1.8 { weak.append(w) }
        }
        var favor = lack.isEmpty ? Array(weak.prefix(2)) : lack
        if favor.isEmpty {
            let dm = ganWx[pillars.day.gan]
            let sheng = ["木": "火", "火": "土", "土": "金", "金": "水", "水": "木"]
            let ke = ["木": "土", "火": "金", "土": "水", "金": "木", "水": "火"]
            favor = [sheng[dm] ?? "", ke[dm] ?? ""].filter { !$0.isEmpty }
        }
        return (counts, lack, weak, favor)
    }

    /// `NM.baziFromSolar`
    static func fromSolar(_ y: Int, _ m: Int, _ d: Int, _ hour: Int) -> BaziInfo {
        if y == 0 || m == 0 || d == 0 || y < 1900 || y > 2100 {
            return .failure(L10n.t("请选择 1900–2100 之间的公历生日"))
        }
        let day = dayGZ(y, m, d)
        let year = yearGZ(y, m, d)
        let month = monthGZ(y, m, d, year.gan)
        let hourPillar = hourGZ(day.gan, hour)
        let ax = analyze((year, month, day, hourPillar))
        let lunar = solarToLunar(y, m, d)
        let dm = gan[day.gan]
        let dmWx = ganWx[day.gan]
        return BaziInfo(
            ok: true, error: nil,
            solar: BaziSolar(y: y, m: m, d: d, hour: hour),
            lunar: lunar,
            pillars: BaziPillars(year: year.label, month: month.label, day: day.label,
                                 hour: hourPillar?.label ?? ""),
            dayMaster: dm, dayWx: dmWx,
            counts: ax.counts, lack: ax.lack, weak: ax.weak, favor: ax.favor
        )
    }

    /// 五行列表：中文之间用顿号，英文用逗号。
    static func wxText(_ list: [String]) -> String {
        list.map { L10n.t($0) }.joined(separator: L10n.t("、"))
    }

    /// 单个天干的拼音（英文界面下的日主写法）。
    static func ganPinyin(_ ch: String) -> String {
        guard let i = gan.firstIndex(of: ch) else { return ch }
        return ganPy[i]
    }

    /// 干支标签转拼音：「甲子」→「Jia-Zi」。
    static func pillarLabelEn(_ label: String) -> String {
        var out: [String] = []
        for ch in label {
            let s = String(ch)
            if let i = gan.firstIndex(of: s) { out.append(ganPy[i]) }
            else if let i = zhi.firstIndex(of: s) { out.append(zhiPy[i]) }
        }
        return out.isEmpty ? label : out.joined(separator: "-")
    }

    /// 农历展示文案（app.js 的 `lunarText`）
    static func lunarText(_ lu: BaziLunar?) -> String {
        guard let lu else { return "" }
        let mn = ["正", "二", "三", "四", "五", "六", "七", "八", "九", "十", "冬", "腊"]
        let dn = ["", "初一", "初二", "初三", "初四", "初五", "初六", "初七", "初八", "初九", "初十",
                  "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九", "二十",
                  "廿一", "廿二", "廿三", "廿四", "廿五", "廿六", "廿七", "廿八", "廿九", "三十"]
        let monthName = (lu.m >= 1 && lu.m <= 12) ? mn[lu.m - 1] : "\(lu.m)"
        let dayName = (lu.d < dn.count) ? dn[lu.d] : "\(lu.d)日"
        guard L10n.isEnglish else {
            return "农历\(lu.y)年\(lu.leap ? "闰" : "")\(monthName)月\(dayName)"
        }
        return L10n.f("农历 %@", "\(lu.y)-\(lu.m)-\(lu.d)")
    }

    static func hourLabel(_ h: Int) -> String {
        if h < 0 { return L10n.t("时辰未知") }
        let zi = ((h + 1) % 24) / 2
        guard zi >= 0, zi < hourNames.count else { return L10n.t("时辰未知") }
        let name = hourNames[zi]
        /* 「子时 · 23–01」里「子时」是中文术语，英文界面下只留时段。 */
        if L10n.isEnglish, let range = name.split(separator: "·").last {
            return range.trimmingCharacters(in: .whitespaces)
        }
        return name
    }

    // MARK: - 用宜补五行合成性格向量 / 附着到画像

    static func profileFromBazi(_ info: BaziInfo?) -> NMProfile {
        let engine = NameEngine.shared
        let favor = info?.favor ?? []
        let wxDom: [String: [String]] = [
            "金": ["sound", "sky"], "木": ["wood", "beast"], "水": ["water", "quiet"],
            "火": ["fire", "bright"], "土": ["earth", "gift"],
        ]
        var packs: [NMVec] = []
        for w in favor {
            for domKey in wxDom[w] ?? [] {
                guard let dom = engine.data.domains[domKey] else { continue }
                var pack: NMVec = [:]
                pack["warm"] = dom.tr["warm"]; pack["out"] = dom.tr["out"]
                pack["rat"] = dom.tr["rat"]; pack["sta"] = dom.tr["sta"]
                pack["cla"] = dom.st["cla"]; pack["sim"] = dom.st["sim"]; pack["exp"] = dom.st["exp"]
                packs.append(pack.compactMapValues { $0 })
            }
        }
        func avg(_ keys: [String]) -> NMVec {
            var out: NMVec = [:]
            for k in keys {
                var sum = 0.0, cnt = 0
                for p in packs {
                    if let v = p[k] { sum += v; cnt += 1 }
                }
                out[k] = cnt > 0 ? sum / Double(cnt) : 0
            }
            return out
        }
        let traitKeys = engine.data.traitKeys
        let styleKeys = engine.data.styleKeys
        return NMProfile(
            trait: packs.isEmpty ? Dictionary(uniqueKeysWithValues: traitKeys.map { ($0, 0.0) }) : avg(traitKeys),
            style: packs.isEmpty ? Dictionary(uniqueKeysWithValues: styleKeys.map { ($0, 0.0) }) : avg(styleKeys),
            nov: 0.45, answered: 0, favorWx: favor, bazi: info
        )
    }

    static func attachBazi(_ profile: NMProfile, _ info: BaziInfo?) -> NMProfile {
        var p = profile
        p.bazi = info
        p.favorWx = info?.favor ?? []
        return p
    }

    static func explainName(_ chars: [String], _ info: BaziInfo?) -> String {
        guard let info, !info.favor.isEmpty else { return "" }
        let engine = NameEngine.shared
        var hits: [String] = []
        for c in chars {
            guard let it = engine.getChar(c) else { continue }
            if let wx = engine.domainWx(it.dom), info.favor.contains(wx) {
                hits.append(L10n.f("%@属%@", c, L10n.t(wx)))
            }
        }
        if hits.isEmpty { return L10n.f("宜补%@", wxText(info.favor)) }
        return L10n.f("%@，合宜补%@", hits.joined(separator: L10n.t("、")), wxText(info.favor))
    }
}
