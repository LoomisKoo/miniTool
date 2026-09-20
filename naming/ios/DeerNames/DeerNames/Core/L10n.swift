import Foundation

/* 界面文案的本地化。
 *
 * 约定：**中文原文就是 key**。
 *  - `L10n.t("设置")` 在中文下原样返回，在英文下查 `en.lproj/Localizable.strings`；
 *  - 带参数的文案用 `L10n.f("已收藏 %@", name)`，key 里写 `%@` / `%ld`，中文不需要再写一遍译文
 *    （没有译文时直接拿中文模板做格式化）。
 *
 * 只有「界面文案 + 应用生成的说明文字」进这张表。名字本身（汉字 / 英文名）和数据内容
 * （字义、精选名释义、名人简介、题干选项等）不进表，任何语言下都保持原样。
 *
 * SwiftUI 的 `Text(LocalizedStringKey)` 依赖 `\.locale`，但本 App 里大量文案是 String
 * 变量、模型生成的句子，走不到那条路；所以统一走这里，语言切换时由根视图整体重建来刷新。 */
enum L10n {
    static let storageKey = "appLanguage"

    /// 当前界面语言："zh-Hans" / "en"。
    static var code: String {
        let stored = (UserDefaults.standard.string(forKey: storageKey) ?? "")
            .trimmingCharacters(in: .whitespaces)
        if !stored.isEmpty {
            return stored.lowercased().hasPrefix("en") ? "en" : "zh-Hans"
        }
        let preferred = (Locale.preferredLanguages.first ?? "zh-Hans").lowercased()
        return preferred.hasPrefix("en") ? "en" : "zh-Hans"
    }

    static var isEnglish: Bool { code == "en" }

    /// 本地化一条文案；没有对应译文时原样返回中文原文。
    static func t(_ key: String) -> String {
        guard !key.isEmpty else { return key }
        return table()[key] ?? key
    }

    /// 带参数的文案。key 用 `%@` / `%ld` 占位；没有译文时用中文原文格式化。
    static func f(_ key: String, _ args: CVarArg...) -> String {
        let format = table()[key] ?? key
        guard !args.isEmpty else { return format }
        return String(format: format, arguments: args)
    }

    /// 「A、B、C」这类中文顿号连接，英文下换成逗号。
    static func join(_ items: [String], separator: String = "、") -> String {
        items.joined(separator: t(separator))
    }

    // MARK: - 数据正文的英文覆盖表

    /* 字义 / 释义 / 名人简介 / 题库这类**数据正文**不放 Localizable.strings，单独存在
     * `Resources/Data/engine-en.json` 里：
     *  - 界面文案表保持「只有界面句子」的干净状态；
     *  - 覆盖表的 key 用短标识（「静」而不是整句释义），表能读、能核对；
     *  - 缺哪条就回退中文原文，所以可以分批补，中间态不会崩也不会空白。
     *
     * 结构：
     *   { "chars": {"静": "..."}, "surnames": {"路": "..."}, "given": {"一心": "..."},
     *     "celebs": {"关汉卿": "..."},
     *     "namesEn": {"Erin": {"m": "...", "org": "..."}},
     *     "quiz": {"q1": {"text": "...", "options": ["...", "..."]}} }
     */

    /* 中文名的排版：**英文界面下拼音才是能读的那个**（外国人看一行汉字还是不知道叫什么），
     * 所以主标换成拼音、汉字退到副标；中文界面原样。所有「汉字 + 拼音」的场合都走这两支，
     * 别各自 if 一遍。拼音用 `Pinyin.titleCase(Pinyin.name(...))`。 */
    static func zhPrimary(_ hanzi: String, _ py: String) -> String {
        isEnglish && !py.isEmpty ? py : hanzi
    }

    static func zhSecondary(_ hanzi: String, _ py: String) -> String {
        isEnglish && !py.isEmpty ? hanzi : py
    }

    /// 英文界面下副标要补回汉字（主标已经换成拼音了）。中文界面返回空串，不占位。
    static func zhHanziPrefix(_ hanzi: String) -> String {
        isEnglish && !hanzi.isEmpty ? hanzi + " · " : ""
    }

    /* 列表行里的中文名，方向和大标题**反过来**：
     *
     *   列表：**汉字当主标，拼音当副标**（`listPyPrefix`），不管界面语言。
     *   大标题（详情页 / 分享卡片 / 西名中起的结果）：英文界面下拼音当主标。
     *
     * 区别在于「干什么用」：列表是拿来扫的 —— 汉字才是名字本身，一行行看过去认的是字形，
     * 拼音只是读音提示，小一号完全够；而大标题是拿来读的，外国人得先读得出。
     * 所以列表行**不要**用 `zhPrimary` / `zhSecondary`，用汉字本身 + `listPyPrefix`。 */

    /// 列表行副标开头的拼音（和 `zhHanziPrefix` 对称）：只在英文界面补，中文界面不占位。
    static func listPyPrefix(_ py: String) -> String {
        isEnglish && !py.isEmpty ? py + " · " : ""
    }

    /// 名人标签「唐·诗人」「作家/学者」：按「·」「/」切段后逐段查表，缺条目回退中文。
    static func celebTag(_ raw: String) -> String {
        guard isEnglish, !raw.isEmpty else { return raw }
        return raw.split(separator: "·").map { group -> String in
            group.split(separator: "/").map { piece -> String in
                let s = String(piece).trimmingCharacters(in: .whitespaces)
                return d("celebTags", s, s)
            }.joined(separator: " / ")
        }.joined(separator: " · ")
    }

    /// 一层字典（chars / surnames / given / celebs）。
    static func d(_ section: String, _ key: String, _ fallback: String) -> String {
        guard isEnglish, !key.isEmpty, !fallback.isEmpty, let v = dValue(section, key) else { return fallback }
        return (v as? String) ?? fallback
    }

    /// 两层字典（namesEn：名字 → 字段）。
    static func d(_ section: String, _ key: String, _ field: String, _ fallback: String) -> String {
        guard isEnglish, !key.isEmpty, !fallback.isEmpty,
              let dict = dValue(section, key) as? [String: Any],
              let v = dict[field] as? String else { return fallback }
        return v
    }

    /// 题库选项：按题号 + 序号对（选项不重复，不需要拿中文当 key）。
    static func dOption(_ qid: String, _ index: Int, _ fallback: String) -> String {
        guard isEnglish, !fallback.isEmpty,
              let dict = dValue("quiz", qid) as? [String: Any],
              let list = dict["options"] as? [String],
              index >= 0, index < list.count else { return fallback }
        return list[index]
    }

    private static var dataCache: [String: Any]?

    private static func dValue(_ section: String, _ key: String) -> Any? {
        /* 加载失败**不写缓存**：否则首次取值时资源还没就绪（比如刚装上还没重启），
         * 整张表会被一个空字典顶掉，之后一直回退中文。 */
        if dataCache == nil { dataCache = loadDataTable() }
        return (dataCache?[section] as? [String: Any])?[key]
    }

    private static func loadDataTable() -> [String: Any]? {
        let candidates: [URL?] = [
            Bundle.main.url(forResource: "engine-en", withExtension: "json", subdirectory: "Data"),
            Bundle.main.url(forResource: "engine-en", withExtension: "json"),
            Bundle.main.url(forResource: "engine-en", withExtension: "json", subdirectory: "Resources/Data"),
        ]
        guard let url = candidates.compactMap({ $0 }).first,
              let raw = try? Data(contentsOf: url),
              let dict = try? JSONSerialization.jsonObject(with: raw) as? [String: Any]
        else { return nil }
        return dict
    }

    // MARK: - 词表

    private static var cached: (code: String, table: [String: String])?

    private static func table() -> [String: String] {
        let current = code
        if let cached, cached.code == current { return cached.table }
        let loaded = load(current)
        cached = (current, loaded)
        return loaded
    }

    private static func load(_ code: String) -> [String: String] {
        guard let path = Bundle.main.path(forResource: code, ofType: "lproj"),
              let bundle = Bundle(path: path),
              let file = bundle.path(forResource: "Localizable", ofType: "strings"),
              let dict = NSDictionary(contentsOfFile: file) as? [String: String]
        else { return [:] }
        return dict
    }
}
