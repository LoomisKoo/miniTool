import Foundation

struct NickInterpretation: Hashable {
    let literal: String
    let adapted: String
    let explanationZh: String
    let explanationEn: String
    let scenes: [String]

    var explanation: String {
        L10n.isEnglish ? explanationEn : explanationZh
    }

    var sceneText: String {
        scenes.map { L10n.t($0) }.joined(separator: L10n.t("、"))
    }
}

/// 开发阶段生成的昵称解读。优先使用人工筛选过的语义映射，未知词再按分类兜底。
enum NickInterpreter {
    static func interpret(text: String, category: String, note: String,
                          zhNote: String = "", enNote: String = "") -> NickInterpretation {
        if let known = known[text] {
            return known
        }

        let isEnglish = text.unicodeScalars.contains { scalar in
            (65...90).contains(scalar.value) || (97...122).contains(scalar.value)
        }
        if isEnglish {
            return NickInterpretation(
                literal: text,
                adapted: text,
                explanationZh: zhNote.isEmpty ? (note.isEmpty ? "保留英文原貌，适合英文社交场景。" : note) : zhNote,
                explanationEn: enNote.isEmpty ? englishFallback(for: category) : enNote,
                scenes: scenes(for: category)
            )
        }

        return NickInterpretation(
            literal: romanized(text),
            adapted: englishAdaptation(for: text, category: category),
            explanationZh: zhNote.isEmpty ? (note.isEmpty ? "一个带有\(category)气质的社交昵称。" : note) : zhNote,
            explanationEn: enNote.isEmpty ? englishFallback(for: category) : enNote,
            scenes: scenes(for: category)
        )
    }

    private static func englishFallback(for category: String) -> String {
        let table: [String: String] = [
            "简洁": "A clean, understated nickname that is easy to remember.",
            "文艺": "A poetic nickname with a visual and atmospheric feeling.",
            "轻松": "A light and casual nickname for everyday social use.",
            "个性": "A distinctive nickname with a slightly unconventional edge.",
            "游戏": "A nickname that fits games and interest communities.",
            "英文": "An English nickname whose original wording is part of its appeal.",
            "古风": "A nickname inspired by classical Chinese imagery.",
            "自然": "A nickname inspired by landscapes and the outdoors.",
            "情侣": "A paired nickname with a warm, relational feeling.",
            "繁体": "A traditional-character nickname with a classic visual style.",
            "两字": "A compact two-character nickname that is easy to remember.",
            "三字": "A rhythmic three-character nickname with a clear identity.",
            "四字": "A four-character nickname with a phrase-like rhythm.",
            "简单": "A straightforward nickname for everyday use.",
            "好听": "A nickname chosen for its pleasant sound.",
            "符号": "A decorated nickname using visual symbols.",
            "非主流": "A niche, scene-inspired nickname with a strong style.",
            "微信": "A casual nickname suited to everyday messaging.",
            "微博": "A nickname suited to public posts and online discussion.",
            "空间": "A nostalgic nickname with a personal-diary feeling.",
            "家族": "A nickname connected to family identity.",
            "兄弟": "A friendly nickname for close male friends.",
            "姐妹": "A warm nickname for close female friends.",
            "小孩": "A playful nickname with a youthful feeling."
        ]
        return table[category] ?? "A distinctive social nickname with its own mood."
    }

    private static func englishAdaptation(for text: String, category: String) -> String {
        let table: [String: String] = [
            "晚风": "Evening Breeze",
            "清和": "Quiet Grace",
            "向晚": "Toward Dusk",
            "见山": "See the Mountain",
            "听风": "Listening to Wind",
            "见鹿": "Find the Deer",
            "未央": "Never Ending",
            "小透明": "Lowkey",
            "在逃公主": "Princess on the Run",
            "社恐本恐": "Introvert Energy",
            "摆烂中": "Currently Unbothered",
            "醉花阴": "Blossom Reverie"
        ]
        if let value = table[text] { return value }
        let fallback: [String: String] = [
            "古风": "Classical Echo",
            "诗意": "Poetic Reverie",
            "意境": "Atmospheric Note",
            "唯美": "Quiet Beauty",
            "自然": "Nature Note",
            "简洁": "Quiet Form",
            "文艺": "Poetic Mood",
            "轻松": "Easygoing Mood",
            "年轻风": "Current Vibe",
            "情绪": "Mood Note",
            "酷感": "Cool Edge",
            "温柔": "Gentle Tone",
            "女生": "Feminine Vibe",
            "男生": "Masculine Vibe",
            "可爱": "Cute Vibe",
            "小清新": "Fresh Air",
            "帅气": "Sharp Style",
            "霸气": "Bold Energy",
            "超拽": "Bold Attitude",
            "搞笑": "Comic Relief",
            "爱情": "Love Note",
            "情侣": "Pair Vibe",
            "幸福": "Happy Note",
            "励志": "Motivated Spirit",
            "成熟": "Mature Calm",
            "内涵": "Subtle Meaning",
            "经典": "Classic Feel",
            "游戏": "Gaming Handle",
            "战队": "Team Handle",
            "英文": "English Handle",
            "中英": "Bilingual Vibe"
        ]
        return fallback[category] ?? "A distinctive social mood"
    }

    private static func romanized(_ text: String) -> String {
        // 社交昵称不受姓名字库限制，使用系统 ICU 转写覆盖词库外的汉字。
        let chars = Array(text).map(String.init)
        let pieces = chars.compactMap { char -> String? in
            guard let latin = char.applyingTransform(.toLatin, reverse: false)?
                .trimmingCharacters(in: .whitespacesAndNewlines),
                  !latin.isEmpty, latin != char else { return nil }
            return latin
        }
        if pieces.count == chars.count {
            return pieces
                .map { $0.prefix(1).uppercased() + $0.dropFirst() }
                .joined(separator: " ")
        }

        if let latin = text.applyingTransform(.toLatin, reverse: false)?
            .replacingOccurrences(of: "-", with: " ")
            .split(whereSeparator: { $0.isWhitespace })
            .map({ $0.prefix(1).uppercased() + $0.dropFirst() })
            .joined(separator: " "),
           !latin.isEmpty, latin != text {
            return latin
        }

        let py = Pinyin.titleCase(Pinyin.name(nil, chars))
        let syllables = py.split(separator: " ")
        if syllables.count == chars.count {
            return py
        }
        // 社交昵称不一定来自姓名字库；未知字不能被静默丢掉。
        return "Original Chinese nickname"
    }

    private static func scenes(for category: String) -> [String] {
        switch category {
        case "游戏": return ["游戏", "社交昵称"]
        case "英文": return ["英文界面", "个人主页"]
        case "情侣": return ["情侣", "社交昵称"]
        case "微信": return ["微信", "日常社交"]
        default: return ["社交昵称", "个人主页"]
        }
    }

    private static let known: [String: NickInterpretation] = [
        "晚风": NickInterpretation(
            literal: "Evening Breeze",
            adapted: "Soft Breeze",
            explanationZh: "像傍晚吹来的风，安静、温柔，不刻意制造距离感。",
            explanationEn: "A quiet, gentle feeling like a breeze at dusk; calm without feeling distant.",
            scenes: ["微信", "个人主页"]
        ),
        "清和": NickInterpretation(
            literal: "Clear and Harmonious",
            adapted: "Quiet Grace",
            explanationZh: "气质干净平和，带一点克制和分寸感，适合长期使用。",
            explanationEn: "Clean, calm, and quietly graceful; understated enough to use for a long time.",
            scenes: ["微信", "个人主页"]
        ),
        "在逃公主": NickInterpretation(
            literal: "Princess on the Run",
            adapted: "Runaway Royalty",
            explanationZh: "带一点俏皮和反差感，不是真的严肃自称，而是轻松地玩一个角色设定。",
            explanationEn: "A playful role-play identity with a little contrast, not a serious claim of royalty.",
            scenes: ["社交昵称", "个人主页"]
        ),
        "left on read": NickInterpretation(
            literal: "Left on Read",
            adapted: "Seen, Not Answered",
            explanationZh: "表达已读但暂时不回复的状态，带一点冷幽默和边界感。",
            explanationEn: "A dry, slightly humorous way to express being seen but intentionally unanswered.",
            scenes: ["英文界面", "社交昵称"]
        ),
        "soft launch": NickInterpretation(
            literal: "Soft Launch",
            adapted: "Quiet Reveal",
            explanationZh: "不高调宣布，只用一种低调的方式让别人慢慢发现。",
            explanationEn: "A low-key reveal that lets people discover the story gradually.",
            scenes: ["英文界面", "个人主页"]
        ),
        "main character": NickInterpretation(
            literal: "Main Character",
            adapted: "The Story Is Mine",
            explanationZh: "强调把自己的生活当成主线，带一点自信和戏剧感。",
            explanationEn: "A confident, slightly theatrical feeling of treating your own life as the main story.",
            scenes: ["英文界面", "个人主页"]
        ),
        "听风": NickInterpretation(
            literal: "Listen to the Wind",
            adapted: "Wind Listener",
            explanationZh: "有倾听和留白的感觉，安静但不孤僻。",
            explanationEn: "Quiet and observant, with a sense of openness rather than loneliness.",
            scenes: ["微信", "个人主页"]
        ),
        "见鹿": NickInterpretation(
            literal: "See the Deer",
            adapted: "Find the Deer",
            explanationZh: "带有自然、温柔和一点偶然相遇的画面感。",
            explanationEn: "A gentle nature image with the feeling of an unexpected encounter.",
            scenes: ["微信", "个人主页"]
        ),
        "向晚": NickInterpretation(
            literal: "Toward Evening",
            adapted: "Toward Dusk",
            explanationZh: "像一天将晚未晚的时刻，安静、成熟，也有一点浪漫。",
            explanationEn: "A mature, quiet, slightly romantic feeling like the moment before dusk.",
            scenes: ["微信", "个人主页"]
        ),
        "小透明": NickInterpretation(
            literal: "Little Transparent",
            adapted: "Lowkey",
            explanationZh: "自嘲地表达低调、不抢镜，但不代表没有自己的存在感。",
            explanationEn: "A self-deprecating way to be low-key without saying you have no presence.",
            scenes: ["社交昵称", "个人主页"]
        ),
        "社恐本恐": NickInterpretation(
            literal: "Social Anxiety Personified",
            adapted: "Introvert Energy",
            explanationZh: "用夸张和自嘲表达不擅长社交，语气偏轻松。",
            explanationEn: "A playful, self-deprecating way to say social situations are not your strength.",
            scenes: ["社交昵称", "游戏"]
        ),
        "摆烂中": NickInterpretation(
            literal: "Currently Giving Up",
            adapted: "Currently Unbothered",
            explanationZh: "表达暂时不想卷、不想解释，带一点网络式的松弛感。",
            explanationEn: "A relaxed internet-style way to say you are opting out of pressure for now.",
            scenes: ["社交昵称", "游戏"]
        ),
        "把春天寄来": NickInterpretation(
            literal: "Bǎ Chūn Tiān Jì Lái",
            adapted: "Send Spring Here",
            explanationZh: "像把春天写成一封信寄来，轻盈、明亮，带有期待感。",
            explanationEn: "A poetic image of sending spring like a letter; light, hopeful, and full of anticipation.",
            scenes: ["微信", "个人主页"]
        ),
        "still here": NickInterpretation(
            literal: "Still Here",
            adapted: "Quietly Present",
            explanationZh: "表示虽然安静或低调，但仍然在自己的位置上。",
            explanationEn: "Quietly present, even when not seeking attention.",
            scenes: ["英文界面", "个人主页"]
        ),
        "not today": NickInterpretation(
            literal: "Not Today",
            adapted: "Maybe Tomorrow",
            explanationZh: "今天先不处理麻烦和压力，简短又有边界感。",
            explanationEn: "A short, boundary-setting way to decline today's noise or pressure.",
            scenes: ["英文界面", "社交昵称"]
        ),
        "slow burn": NickInterpretation(
            literal: "Slow Burn",
            adapted: "Gradually Glowing",
            explanationZh: "不是一眼惊艳，而是相处后慢慢显出味道。",
            explanationEn: "Not instantly loud or flashy; its appeal grows with time.",
            scenes: ["英文界面", "个人主页"]
        ),
        "final boss": NickInterpretation(
            literal: "Final Boss",
            adapted: "Last Challenge",
            explanationZh: "带一点游戏感和夸张自信，适合表达强势或难搞的气质。",
            explanationEn: "Playfully dramatic and confident, with a gaming-inspired sense of difficulty.",
            scenes: ["英文界面", "游戏"]
        ),
        "quiet flex": NickInterpretation(
            literal: "Quiet Flex",
            adapted: "Low-Key Confidence",
            explanationZh: "不大声炫耀，但让人看得出有能力和底气。",
            explanationEn: "Confidence shown without loud boasting or trying too hard.",
            scenes: ["英文界面", "个人主页"]
        ),
        "醉花阴": NickInterpretation(
            literal: "Drunk Among Flowers",
            adapted: "Blossom Reverie",
            explanationZh: "古典词牌名，带有花影、微醺和含蓄的古典画面感。",
            explanationEn: "A classical Chinese lyric title evoking flowers, gentle intoxication, and restrained romance.",
            scenes: ["英文界面", "个人主页"]
        )
    ]
}
