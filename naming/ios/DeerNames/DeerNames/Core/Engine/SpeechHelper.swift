import AVFoundation
import Foundation

/* 读音体检 + 试听。
 *
 * 粤语方案未确认，本阶段只做普通话（zh-CN）与英语（en-US）。
 * 多音字表是内置小表：只标「名字里常见读音 / 另有读音」，不下唯一结论。 */

struct PolyphoneHint: Hashable {
    let ch: String
    /// 名字里更常见的读音（拼音）。
    let namePy: String
    /// 另有读音。
    let altPy: String
    let note: String
}

struct SpeechCheck {
    let syllables: [(ch: String, py: String)]
    let polyphones: [PolyphoneHint]
    let readability: Readability
    let toneWave: [Int]
}

enum SpeechSpeakResult {
    case started
    case nothingToRead
    case noVoice
}

enum SpeechHelper {
    /// 名字里常见的多音字（内置，后续可换成数据文件）。
    static let polyphones: [String: (name: String, alt: String, note: String)] = [
        "茜": ("qiàn", "xī", "名字里多读 qiàn"),
        "柏": ("bó", "bǎi", "人名里多读 bó"),
        "乐": ("lè", "yuè", "名字里常见 lè，也有 yuè"),
        "行": ("xíng", "háng", "名字里多读 xíng"),
        "予": ("yǔ", "yú", "名字里多读 yǔ"),
        "朝": ("cháo", "zhāo", "名字里两种都常见"),
        "重": ("chóng", "zhòng", "名字里多读 chóng"),
        "长": ("cháng", "zhǎng", "名字里多读 cháng"),
        "单": ("shàn", "dān", "作姓读 shàn"),
        "解": ("xiè", "jiě", "作姓读 xiè"),
        "曾": ("zēng", "céng", "作姓读 zēng"),
        "查": ("zhā", "chá", "作姓读 zhā"),
        "区": ("ōu", "qū", "作姓读 ōu"),
        "朴": ("piáo", "pǔ", "作姓读 piáo"),
        "缪": ("miào", "móu", "作姓读 miào"),
        "覃": ("qín", "tán", "作姓读 qín"),
        "仇": ("qiú", "chóu", "作姓读 qiú"),
        "盖": ("gě", "gài", "作姓读 gě"),
        "翟": ("zhái", "dí", "作姓读 zhái"),
        "员": ("yùn", "yuán", "作姓读 yùn"),
        "秘": ("bì", "mì", "作姓读 bì"),
        "繁": ("pó", "fán", "作姓读 pó"),
        "召": ("shào", "zhào", "作姓读 shào"),
        "万": ("wàn", "mò", "复姓「万俟」读 mò"),
    ]

    private static let synthesizer = AVSpeechSynthesizer()

    static func inspect(surname: NMSurname?, chars: [String]) -> SpeechCheck {
        let engine = NameEngine.shared
        var syllables: [(String, String)] = []
        var hints: [PolyphoneHint] = []
        var tones: [Int] = []

        if let s = surname {
            let pys = s.pys ?? [s.py]
            let tns = s.tones ?? [s.tone]
            for (i, ch) in Array(s.c).map(String.init).enumerated() {
                let py = i < pys.count ? pys[i] : s.py
                syllables.append((ch, py))
                tones.append(i < tns.count ? tns[i] : s.tone)
                if let p = polyphones[ch] {
                    hints.append(PolyphoneHint(ch: ch, namePy: p.name, altPy: p.alt, note: L10n.t(p.note)))
                }
            }
        }
        for ch in chars {
            let c = engine.getChar(ch)
            let py = c?.py ?? ""
            syllables.append((ch, py))
            tones.append(c?.tone ?? 0)
            if let p = polyphones[ch] {
                hints.append(PolyphoneHint(ch: ch, namePy: p.name, altPy: p.alt, note: L10n.t(p.note)))
            }
        }

        let rel = engine.readability(surname, chars)
        return SpeechCheck(syllables: syllables, polyphones: hints, readability: rel, toneWave: tones)
    }

    static func speak(_ text: String, language: String = "zh-CN") -> SpeechSpeakResult {
        let spoken = speakable(text)
        guard !spoken.isEmpty else { return .nothingToRead }

        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.playback, mode: .spokenAudio, options: [.duckOthers])
        try? session.setActive(true)

        let voice = AVSpeechSynthesisVoice(language: language)
            ?? AVSpeechSynthesisVoice(language: language.hasPrefix("zh") ? "zh-CN" : "en-US")
        guard voice != nil else { return .noVoice }

        let utterance = AVSpeechUtterance(string: spoken)
        utterance.voice = voice
        utterance.rate = AVSpeechUtteranceDefaultSpeechRate * 0.92
        /* stopSpeaking 会把同一次调用里紧接着的 speak 一起取消，所以挪到下一轮。 */
        if synthesizer.isSpeaking {
            synthesizer.stopSpeaking(at: .immediate)
        }
        DispatchQueue.main.async {
            synthesizer.speak(utterance)
        }
        return .started
    }

    /// 颜文字、纯符号、Emoji 没有可读音节，滤掉后如果是空的就不要假装在读。
    private static func speakable(_ text: String) -> String {
        let kept = text.unicodeScalars.filter { scalar in
            CharacterSet.letters.contains(scalar) || CharacterSet.decimalDigits.contains(scalar)
        }
        return String(String.UnicodeScalarView(kept))
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    static func stop() {
        synthesizer.stopSpeaking(at: .immediate)
    }
}
