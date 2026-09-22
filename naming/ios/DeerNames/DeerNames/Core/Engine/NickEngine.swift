import Foundation

/* 小名 / 社交昵称引擎。
 *
 * 儿童小名：优先从语义词库取词，再补充「叠字 / 小X / X儿 / 阿X」派生。
 * 成人昵称：从风格词库取词，可与中文名或性格画像一起排序。
 * 两者故意分成两套模式，避免把孩子称呼和成人社交身份混在一起。 */

struct NickItem: Identifiable, Hashable {
    var id: String { text + "|" + type + "|" + category }
    let text: String
    let type: String
    let category: String
    let tags: [String]
    let score: Double
    let note: String
    let zhNote: String
    let enNote: String

    init(text: String, type: String, category: String, tags: [String],
         score: Double, note: String, zhNote: String = "", enNote: String = "") {
        self.text = text
        self.type = type
        self.category = category
        self.tags = tags
        self.score = score
        self.note = note
        self.zhNote = zhNote
        self.enNote = enNote
    }
}

enum NickScript: String, CaseIterable {
    case zh
    case en
    case mix

    var title: String {
        switch self {
        case .zh: return L10n.t("中文")
        case .en: return L10n.t("英文")
        case .mix: return L10n.t("中英混合")
        }
    }

    /// 颜文字、纯符号归在中文和混合里；纯英文不掺进去。
    func matches(_ text: String) -> Bool {
        let cjk = text.unicodeScalars.contains { (0x4E00...0x9FFF).contains($0.value) }
        let latin = text.unicodeScalars.contains { scalar in
            (65...90).contains(scalar.value) || (97...122).contains(scalar.value)
        }
        if cjk && latin { return self == .mix }
        if latin { return self == .en }
        if cjk { return self == .zh }
        return self != .en
    }
}

enum NickMode: String, CaseIterable {
    case child
    case social

    var title: String {
        switch self {
        case .child: return L10n.t("小名")
        case .social: return L10n.t("社交昵称")
        }
    }
}

enum NickEngine {
    /// 免费线只给派生叠字，完整词库和成人模式属于 Pro。
    static let freeStackLimit = 2

    static func derive(given: String, surname: String?, profile: NMProfile?) -> [NickItem] {
        (childLibrary(profile: profile) + derived(given: given, surname: surname, profile: profile))
            .sorted { $0.score > $1.score }
    }

    static func social(profile: NMProfile?, given: String = "") -> [NickItem] {
        let name = given.trimmingCharacters(in: .whitespacesAndNewlines)
        // 无姓名后缀时走静态缓存，避免每次切换筛选项重建千条数据。
        if name.isEmpty { return socialBaseItems }
        return buildSocialItems(given: name)
    }

    /// 按分类取社交昵称；「全部」返回整库引用。
    static func socialItems(in category: String) -> [NickItem] {
        if category == "全部" { return socialBaseItems }
        return socialGrouped[category] ?? []
    }

    static func socialNote(for category: String) -> String? {
        socialNotes[category]
    }

    /// 社交页可选气质（不含「全部」）；顺序与词库一致。
    static var socialVibes: [String] { socialGroups.map(\.0) }

    static let socialBatchSize = 8

    /// 从气质池加权抽取一批；有性格画像时按气质偏好加权。
    static func drawSocial(script: NickScript,
                           vibes: Set<String>,
                           profile: NMProfile?,
                           excluding: Set<String> = [],
                           count: Int = socialBatchSize) -> [NickItem] {
        var items = pool(script: script, vibes: vibes).filter { !excluding.contains($0.text) }
        if items.isEmpty {
            items = pool(script: script, vibes: vibes)
        }
        guard !items.isEmpty else { return [] }

        let keyed: [(NickItem, Double)] = items.map { item in
            let w = socialWeight(category: item.category, profile: profile)
            let jitter = Double.random(in: 0.55...1.45)
            return (item, w * jitter)
        }
        return keyed.sorted { $0.1 > $1.1 }.prefix(count).map { item, score in
            NickItem(text: item.text, type: item.type, category: item.category,
                     tags: item.tags, score: score, note: item.note,
                     zhNote: item.zhNote, enNote: item.enNote)
        }
    }

    static func localizedNote(for item: NickItem) -> String {
        interpretation(for: item).explanation
    }

    static func interpretation(for item: NickItem) -> NickInterpretation {
        NickInterpreter.interpret(text: item.text, category: item.category, note: item.note,
                                 zhNote: item.zhNote, enNote: item.enNote)
    }

    /// 随机一条：优先性格加权，可排除当前展示过的。
    static func randomSocial(script: NickScript,
                             vibes: Set<String>,
                             profile: NMProfile?,
                             excluding: Set<String> = []) -> NickItem? {
        drawSocial(script: script, vibes: vibes, profile: profile, excluding: excluding, count: 1).first
    }

    static func drawChild(from items: [NickItem],
                          excluding: Set<String> = [],
                          count: Int = socialBatchSize) -> [NickItem] {
        var pool = items.filter { !excluding.contains($0.text) }
        if pool.isEmpty { pool = items }
        guard !pool.isEmpty else { return [] }
        return Array(pool.shuffled().prefix(count))
    }

    /// 当前语言下还能点的气质。没有对应昵称的分类不显示。
    static func socialVibes(matching script: NickScript) -> [String] {
        socialGroups.map(\.0).filter { cat in
            (socialGrouped[cat] ?? []).contains { script.matches($0.text) }
        }
    }

    private static func pool(script: NickScript, vibes: Set<String>) -> [NickItem] {
        let base: [NickItem]
        if vibes.isEmpty {
            base = socialBaseItems
        } else {
            base = vibes.flatMap { socialGrouped[$0] ?? [] }
        }
        return base.filter { script.matches($0.text) }
    }

    /// 性格轴系数：warm / out / cla / sim / exp。没测过性格时均匀。
    private static let vibeBias: [String: (Double, Double, Double, Double, Double)] = [
        "温柔": (0.55, 0.1, 0.1, 0, 0), "自然": (0.4, 0, 0.2, 0.2, 0),
        "女生": (0.45, 0.15, -0.1, 0, 0.1), "可爱": (0.5, 0.2, -0.25, 0, 0.15),
        "小清新": (0.35, -0.05, 0.1, 0.25, -0.05), "唯美": (0.25, -0.1, 0.45, 0, -0.1),
        "幸福": (0.5, 0.25, -0.1, 0, 0.1), "爱情": (0.45, 0.15, 0.05, 0, 0.1),
        "情侣": (0.4, 0.2, 0, 0, 0.05),
        "酷感": (-0.45, -0.15, 0, 0.1, -0.1), "霸气": (-0.2, 0.35, 0, -0.1, 0.25),
        "超拽": (-0.25, 0.2, -0.2, 0, 0.15), "帅气": (-0.15, 0.25, 0, 0.1, 0.1),
        "男生": (-0.1, 0.15, 0.05, 0.15, 0), "游戏": (-0.1, 0.3, -0.35, 0, 0.2),
        "战队": (-0.15, 0.35, -0.2, 0, 0.15), "给力": (0.1, 0.4, -0.3, -0.1, 0.3),
        "年轻风": (0.1, 0.35, -0.45, 0, 0.2), "轻松": (0.2, 0.3, -0.3, 0.1, 0.15),
        "情绪": (0.15, 0.1, -0.2, 0, 0.25), "搞笑": (0.15, 0.4, -0.35, 0, 0.35),
        "颜文字": (0.1, 0.15, -0.4, -0.1, 0.25), "Emoji": (0.1, 0.2, -0.4, 0, 0.2),
        "非主流": (0, 0.2, -0.2, -0.2, 0.2), "符号": (0, 0.1, -0.15, -0.1, 0.15),
        "文艺": (0.1, -0.15, 0.55, 0.1, -0.15), "古风": (0, -0.1, 0.6, 0, -0.2),
        "诗意": (0.1, -0.2, 0.55, 0.1, -0.2), "意境": (0.05, -0.25, 0.5, 0.15, -0.25),
        "繁体": (0, -0.1, 0.5, 0.1, -0.15), "经典": (0.15, 0, 0.4, 0.1, 0),
        "简洁": (0, -0.1, 0.1, 0.5, -0.1), "简单": (0, 0, 0, 0.45, 0.05),
        "两字": (0, 0, 0.05, 0.4, 0), "好听": (0.2, 0, 0.25, 0.3, 0),
        "英文": (0, 0.1, -0.1, 0.2, 0.1), "中英": (0.05, 0.2, -0.25, 0, 0.2), "三字": (0, 0.05, -0.05, 0.15, 0.05),
        "四字": (0, 0, 0.15, 0.1, 0), "内涵": (0, -0.2, 0.25, 0.1, -0.25),
        "成熟": (-0.05, -0.1, 0.15, 0.2, -0.15), "励志": (0.15, 0.25, 0, 0, 0.2),
        "伤感": (-0.15, -0.25, 0.15, 0, 0.05), "忧伤": (-0.05, -0.3, 0.35, 0.1, -0.1),
        "颓废": (-0.2, -0.1, -0.25, 0, 0.1), "重口味": (-0.35, 0.05, -0.1, -0.1, 0.1),
        "微信": (0.1, 0, 0, 0.25, 0), "微博": (0, 0.25, -0.2, 0, 0.2),
        "空间": (0.1, 0.05, 0.1, 0, 0.05), "个性": (0, 0.2, -0.15, 0, 0.2),
        "家族": (0.35, 0.2, 0.1, 0, 0.1), "兄弟": (0.1, 0.35, -0.1, 0, 0.2),
        "姐妹": (0.35, 0.35, -0.1, 0, 0.2), "兄妹": (0.3, 0.25, 0, 0, 0.15),
        "小孩": (0.4, 0.2, -0.2, 0.1, 0.15),
    ]

    private static func socialWeight(category: String, profile: NMProfile?) -> Double {
        guard let p = profile, p.hasAnswered else { return 1.0 }
        let b = vibeBias[category] ?? (0, 0, 0, 0, 0)
        let warm = p.trait["warm"] ?? 0
        let out = p.trait["out"] ?? 0
        let cla = p.style["cla"] ?? 0
        let sim = p.style["sim"] ?? 0
        let exp = p.style["exp"] ?? 0
        let w = 1.1 + b.0 * warm + b.1 * out + b.2 * cla + b.3 * sim + b.4 * exp
        return max(0.35, w)
    }

    static func categories(for mode: NickMode) -> [String] {
        switch mode {
        case .child:
            return ["全部", "植物", "动物", "食物", "自然", "性格", "可爱物件", "亲昵派生"]
        case .social:
            return ["全部"] + socialGroups.map(\.0)
        }
    }

    private static let socialBaseItems: [NickItem] = buildSocialItems(given: "")
    private static let socialGrouped: [String: [NickItem]] = Dictionary(grouping: socialBaseItems, by: \.category)
    private static let socialNotes: [String: String] = Dictionary(uniqueKeysWithValues: socialGroups.map { ($0.0, $0.2) })

    private static func derived(given: String, surname: String?, profile: NMProfile?) -> [NickItem] {
        let chars = Array(given).map(String.init).filter { !$0.isEmpty }
        guard !chars.isEmpty else { return [] }

        var raw: [(text: String, type: String, tags: [String], note: String)] = []

        // 叠字：末字叠
        if let last = chars.last, last.count == 1 {
            raw.append((last + last, "叠字", ["亲昵派生"], L10n.t("叠字小名，柔软亲昵")))
        }
        // 小 + 首字
        if let first = chars.first {
            raw.append(("小" + first, "小X", ["亲昵派生"], L10n.t("「小」字开头，日常亲昵")))
        }
        // 末字 + 儿
        if let last = chars.last {
            raw.append((last + "儿", "X儿", ["亲昵派生"], L10n.t("儿化音，北方语感")))
        }
        // 阿 + 首字（或姓首字）
        if let first = chars.first {
            raw.append(("阿" + first, "阿X", ["亲昵派生"], L10n.t("「阿」字开头，南方语感")))
        }
        if let s = surname, let head = s.first.map(String.init), head != chars.first {
            raw.append(("阿" + head, "阿X", ["亲昵派生"], L10n.t("以姓称呼，家里常用")))
        }
        // 单字回读：取意象最「柔」的字（freq 低或 soft domains 优先；没有就取末字）
        if let soft = softest(chars) {
            raw.append((soft, "单字", ["亲昵派生"], L10n.t("单字小名，干净好叫")))
        }

        var seen = Set<String>()
        var items: [NickItem] = []
        for r in raw {
            let t = r.text.trimmingCharacters(in: .whitespaces)
            guard t.count >= 1, t.count <= 3, seen.insert(t).inserted else { continue }
            // 轻护栏：整名拼音撞黑名单时丢掉（validate 需要姓，这里只查字）
            let nickChars = Array(t).map(String.init)
            let allowedExtra: Set<String> = ["儿", "小", "阿"]
            if nickChars.contains(where: { NameEngine.shared.getChar($0) == nil && !allowedExtra.contains($0) }) {
                continue
            }
            let score = scoreNick(nickChars, profile: profile)
            items.append(NickItem(text: t, type: r.type, category: r.tags.first ?? "亲昵派生", tags: r.tags,
                                  score: score, note: r.note))
        }
        return items.sorted { $0.score > $1.score }
    }

    /// 免费可见的子集：只要叠字，最多 2 条。
    static func freeSlice(_ all: [NickItem]) -> [NickItem] {
        Array(all.filter { $0.category == "亲昵派生" && $0.type == "叠字" }.prefix(freeStackLimit))
    }

    private static func childLibrary(profile: NMProfile?) -> [NickItem] {
        let groups: [(String, [String], String)] = [
            ("植物", ["芽芽", "豆豆", "苗苗", "果果", "桃桃", "杏杏", "梨梨", "柚柚", "禾禾", "米米", "朵朵", "葵葵"], "植物意象，清新有生命力"),
            ("动物", ["鹿鹿", "兔兔", "团团", "熊熊", "喵喵", "鱼鱼", "燕燕", "雀雀", "鹅鹅", "虎虎", "糖豆", "小鹿"], "动物意象，亲切有画面感"),
            ("食物", ["饼饼", "果冻", "布丁", "奶糖", "糯米", "汤圆", "年糕", "小麦", "芝麻", "花生", "柿子", "团子"], "食物意象，软糯又好叫"),
            ("自然", ["星星", "月月", "云云", "阳阳", "晨晨", "露露", "风风", "雨雨", "雪雪", "溪溪", "暖暖", "晴晴"], "自然意象，轻盈明亮"),
            ("性格", ["乐乐", "安安", "宁宁", "笑笑", "欢欢", "甜甜", "乖乖", "慢慢", "灵灵", "暖宝", "开心", "自在"], "性格意象，表达家人的祝愿"),
            ("可爱物件", ["铃铛", "泡泡", "点点", "圆圆", "球球", "果冻", "饺子", "小满", "糖糖", "星宝", "团子", "萌萌"], "可爱物件，轻松有记忆点")
        ]
        return groups.flatMap { category, words, note in
            words.map { word in
                libraryItem(word, type: "词库", category: category, tags: [category, "可爱"], note: note, profile: profile)
            }
        }
    }

    private static func buildSocialItems(given: String) -> [NickItem] {
        // 社交昵称要能长期使用；颜文字和纯 Emoji 更适合签名装饰，不进入主推荐池。
        // 同一个词可能同时出现在「简洁 / 好听 / 两字」等分类中，这里按文本去重。
        var seen = Set<String>()
        var items: [NickItem] = []

        for (category, words, note) in socialGroups {
            for word in words {
                let text = given.isEmpty ? word : "\(word)·\(String(given.prefix(1)))"
                let normalized = text
                    .trimmingCharacters(in: .whitespacesAndNewlines)
                    .replacingOccurrences(of: "　", with: "")
                guard seen.insert(normalized).inserted else { continue }
                let zhNote = chineseNickMeanings[word] ?? note
                let enNote = englishNote(for: category, text: word)
                items.append(
                    NickItem(text: text, type: "社交昵称", category: category,
                             tags: [category, "成人"], score: 0.5, note: note,
                             zhNote: zhNote, enNote: enNote)
                )
            }
        }
        return items
    }

    private static let socialGroups: [(String, [String], String)] = loadNickGroups()

    // 少量人工精选的长期可用词，补足原始词库里重复多、短期网感词偏多的问题。
    private static let curatedSocialGroups: [(String, [String], String)] = [
        ("简洁", ["松声", "云岫", "川页", "知微", "见素", "清昼", "和光", "栖迟", "向晚", "微澜", "听松", "照野"],
         "短而耐看，适合长期使用"),
        ("文艺", ["借一场风", "月落之后", "把春天寄来", "路过人间", "山止于此", "听见潮汐", "风从远方来", "灯下有诗", "在雾里行走", "把日子写成诗"],
         "有画面感，不局限于单一情绪"),
        ("轻松", ["今天不赶路", "先吃饭再说", "随手一朵云", "偶尔认真", "快乐有回声", "暂时不营业", "给生活加糖", "散步选手", "低调开心", "刚好路过"],
         "轻松自然，适合日常社交"),
        ("个性", ["偏航日记", "备用频道", "无固定答案", "正在成形", "不按剧本", "低频发光", "自带留白", "慢速更新", "隐藏章节", "另一个版本"],
         "有辨识度，但不过分中二"),
        ("游戏", ["夜行频道", "静默开局", "边线观察员", "最后一局", "野区散步", "反向输出", "不急着赢", "暂停一下", "备用血条", "凌晨排位"],
         "适合游戏或兴趣社区"),
        ("英文", ["quiet orbit", "soft signal", "northbound", "afterglow", "slow morning", "open secret", "blue note", "small wonder", "common ground", "off the record"],
         "简短自然，适合英文社交场景")
    ]

    private struct NickPackFile: Decodable {
        struct Group: Decodable {
            let category: String
            let note: String
            let words: [String]
        }
        let groups: [Group]
    }

    private static func loadNickGroups() -> [(String, [String], String)] {
        let candidates = [
            Bundle.main.url(forResource: "nicks", withExtension: "json", subdirectory: "Data"),
            Bundle.main.url(forResource: "nicks", withExtension: "json"),
            Bundle.main.url(forResource: "nicks", withExtension: "json", subdirectory: "Resources/Data"),
        ]
        guard let url = candidates.compactMap({ $0 }).first,
              let data = try? Data(contentsOf: url),
              let pack = try? JSONDecoder().decode(NickPackFile.self, from: data),
              !pack.groups.isEmpty else {
            fatalError("找不到 nicks.json")
        }
        let excluded: Set<String> = ["颜文字", "Emoji"]
        let loaded = pack.groups
            .filter { !excluded.contains($0.category) }
            .map { ($0.category, $0.words, $0.note) }

        var merged = curatedSocialGroups
        for group in loaded {
            guard let index = merged.firstIndex(where: { $0.0 == group.0 }) else {
                merged.append(group)
                continue
            }
            let existing = merged[index].1
            let additions = group.1.filter { !existing.contains($0) }
            merged[index] = (group.0, existing + additions, merged[index].2)
        }
        return merged
    }

    private static func englishNote(for category: String, text: String? = nil) -> String {
        if let text, let translated = englishNickMeanings[text] {
            return translated
        }
        let notes: [String: String] = [
            "年轻风": "A current, internet-friendly nickname with a playful tone.",
            "情绪": "A nickname that expresses a mood or state.",
            "轻松": "Light, casual, and easy to use in daily social settings.",
            "酷感": "A cool, restrained nickname with a little distance.",
            "温柔": "A gentle, warm nickname with a calm feeling.",
            "简洁": "Clean and understated; easy to remember.",
            "文艺": "Poetic and atmospheric, with a visual feeling.",
            "古风": "Inspired by classical Chinese imagery and language.",
            "自然": "Inspired by landscapes, weather, and the outdoors.",
            "女生": "A softer, feminine-leaning social nickname.",
            "男生": "A clean, masculine-leaning social nickname.",
            "可爱": "Cute, friendly, and approachable.",
            "小清新": "Fresh, light, and youthful.",
            "唯美": "Elegant and visual, with a romantic feeling.",
            "帅气": "A confident nickname with a stylish edge.",
            "霸气": "Bold, direct, and high-energy.",
            "个性": "Distinctive and a little unconventional.",
            "游戏": "A nickname suited to games and interest communities.",
            "英文": "An English social nickname; the original wording is kept.",
            "中英": "A mixed Chinese-English nickname with a playful tone.",
            "情侣": "A paired nickname with a warm, relational feeling.",
            "繁体": "A traditional-character nickname with a classic visual style.",
            "两字": "A compact two-character nickname.",
            "三字": "A rhythmic three-character nickname.",
            "四字": "A phrase-like four-character nickname.",
            "简单": "A straightforward nickname for everyday use.",
            "好听": "Chosen for its pleasant sound.",
            "符号": "A decorated nickname using visual symbols.",
            "非主流": "A niche nickname with a strong visual style.",
            "微信": "A casual nickname suited to everyday messaging.",
            "微博": "A nickname suited to public posts and online discussion.",
            "空间": "A nostalgic nickname with a personal-diary feeling.",
            "家族": "A nickname connected to family identity.",
            "兄弟": "A friendly nickname for close male friends.",
            "姐妹": "A warm nickname for close female friends.",
            "小孩": "A playful nickname with a youthful feeling."
        ]
        return notes[category] ?? "A distinctive social nickname with its own mood."
    }

    private static let englishNickMeanings: [String: String] = [
        "left on read": "Seen, but deliberately left unanswered.",
        "still here": "Quietly staying present.",
        "not today": "Not dealing with that today.",
        "after hours": "A person who comes alive after work or late at night.",
        "soft launch": "A low-key reveal, without making a big announcement.",
        "main character": "Living with the feeling that your story matters.",
        "side quest": "Taking an unexpected but interesting detour.",
        "final boss": "The last challenge, or the strongest one in the room.",
        "plot twist": "Something unexpected is about to happen.",
        "slow burn": "A feeling or relationship that grows gradually.",
        "guest mode": "Here temporarily, without sharing too much.",
        "name taken": "The name you wanted has already been claimed.",
        "user deleted": "A playful way to say you have disappeared.",
        "untitled": "Open-ended, undefined, and intentionally unfinished.",
        "low battery": "Running low on energy, socially or literally.",
        "blue hour": "The quiet blue light just before sunrise or after sunset.",
        "golden hour": "A warm, optimistic moment worth holding onto.",
        "close friends": "A private space reserved for people you trust.",
        "lurker": "Someone who quietly watches without posting much.",
        "quiet flex": "Showing confidence without making a scene."
    ]

    private static let chineseNickMeanings: [String: String] = [
        "left on read": "已读但故意没有回复。",
        "still here": "安静地保持在线，也保持自己的存在感。",
        "not today": "今天先不处理这些事。",
        "after hours": "下班后或深夜才真正有精神的人。",
        "soft launch": "低调公开，不刻意宣布。",
        "main character": "把自己的生活当成值得认真书写的故事。",
        "side quest": "暂时离开主线，去探索有趣的支线。",
        "final boss": "最后的挑战，也可以指全场最强的人。",
        "plot twist": "事情即将出现意料之外的转折。",
        "slow burn": "慢慢升温、逐渐产生感觉。",
        "guest mode": "只是暂时路过，不透露太多自己。",
        "name taken": "想用的名字已经被别人占用了。",
        "user deleted": "俏皮地表示自己暂时消失。",
        "untitled": "没有定义，也故意不急着完成。",
        "low battery": "社交或现实电量都快用完了。",
        "blue hour": "日出前或日落后的安静蓝调时刻。",
        "golden hour": "温暖明亮、值得记住的一段时间。",
        "close friends": "只留给熟悉和信任的人的小空间。",
        "lurker": "安静围观，不太主动发言的人。",
        "quiet flex": "不张扬地展示自信和实力。"
    ]

    private static func libraryItem(_ text: String, type: String, category: String,
                                    tags: [String], note: String, profile: NMProfile?) -> NickItem {
        let score = scoreNick(Array(text).map(String.init), profile: profile)
        return NickItem(text: text, type: type, category: category, tags: tags, score: score, note: note)
    }

    // MARK: - private

    private static func softest(_ chars: [String]) -> String? {
        let softDoms: Set<String> = ["quiet", "water", "gift", "mind", "sound"]
        var best: (String, Double)?
        for ch in chars {
            guard let c = NameEngine.shared.getChar(ch) else { continue }
            var s = 1.0 - Double(c.freq) / 5.0
            if softDoms.contains(c.dom) { s += 0.35 }
            if c.g == "f" { s += 0.1 }
            if best == nil || s > best!.1 { best = (ch, s) }
        }
        return best?.0 ?? chars.last
    }

    private static func scoreNick(_ chars: [String], profile: NMProfile?) -> Double {
        guard let profile,
              let vec = NameEngine.shared.givenVec(chars.filter { NameEngine.shared.getChar($0) != nil })
        else { return 0.5 }
        let engine = NameEngine.shared
        let t = (engine.cos(vec.trait, profile.trait, engine.data.traitKeys) + 1) / 2
        let s = (engine.cos(vec.style, profile.style, engine.data.styleKeys) + 1) / 2
        return 0.6 * t + 0.4 * s
    }
}
