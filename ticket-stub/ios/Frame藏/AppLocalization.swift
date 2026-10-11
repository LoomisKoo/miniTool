import Foundation

/// 统一的文本本地化入口。
/// - 界面文案：Localizable.strings（默认中文 key，英文在 en.lproj）
/// - 数据文案：模板 / 特效 / 字段等内容表（LocalizedContent / Labels / Values）
enum AppLocalization {
    static var languageCode: String {
        let preference = UserDefaults.standard.string(forKey: "appLanguage") ?? "system"
        if preference == "en" { return "en" }
        if preference == "zh-Hans" { return "zh-Hans" }
        return Locale.current.language.languageCode?.identifier == "en" ? "en" : "zh-Hans"
    }

    static var isEnglish: Bool { languageCode == "en" }

    private static let content: [String: String] = LocalizedContent.map
        .merging(LocalizedLabels.map) { current, _ in current }
        .merging(LocalizedValues.map) { current, _ in current }

    /// 翻译任意中文 key；无对应英文时原样返回。
    static func text(_ key: String) -> String {
        guard isEnglish else { return key }
        if let hit = content[key] { return hit }
        if let path = Bundle.main.path(forResource: "en", ofType: "lproj"),
           let bundle = Bundle(path: path) {
            return bundle.localizedString(forKey: key, value: key, table: nil)
        }
        return key
    }

    /// 票面字段展示文本（模板预填内容已在内容表中翻译）。
    static func fieldText(_ value: String) -> String {
        text(value)
    }

    // MARK: 带插值的界面文案
    static func year(_ value: Int) -> String {
        isEnglish ? "\(value)" : "\(value) 年"
    }

    static func memoriesTitle(_ value: Int) -> String {
        isEnglish ? "\(value) · My Memories" : "\(value) · 我的记忆"
    }

    static func ticketsThisYear(_ count: Int) -> String {
        isEnglish ? "\(count) tickets kept this year" : "这一年留下了 \(count) 张票根"
    }
}
