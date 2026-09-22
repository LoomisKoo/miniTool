import SwiftUI

/* 详情页里的「读音体检」卡：拼音 / 多音字提示永远可见；试听按钮需 Pro。 */

struct SpeechCheckCard: View {
    let surname: NMSurname?
    let chars: [String]
    let speakText: String

    @Environment(ProStore.self) private var pro
    @Environment(NamingAppModel.self) private var model
    @State private var lang = "zh-CN"

    private var check: SpeechCheck {
        SpeechHelper.inspect(surname: surname, chars: chars)
    }

    var body: some View {
        NamingCard {
            CardTitleRow(title: L10n.t("读音体检"), bottomInset: 8) {
                speakButton
            }

            // 音节行
            FlowLayout(spacing: 8, lineSpacing: 8) {
                ForEach(Array(check.syllables.enumerated()), id: \.offset) { _, sy in
                    VStack(spacing: 2) {
                        Text(sy.ch)
                            .font(.system(size: 18, weight: .semibold))
                            .foregroundStyle(NamingTheme.ink)
                        Text(sy.py)
                            .font(.system(size: 11))
                            .foregroundStyle(NamingTheme.muted)
                    }
                    .padding(.horizontal, 8)
                    .padding(.vertical, 6)
                    .background(NamingTheme.pearl, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                }
            }
            .padding(.top, 8)

            // 声调走势
            if !check.toneWave.isEmpty {
                ToneWaveView(tones: check.toneWave)
                    .padding(.top, 12)
            }

            // 读感
            Text(check.readability.ok
                 ? L10n.t("读感没问题")
                 : check.readability.issues.joined(separator: L10n.t("、")))
                .font(.system(size: 12.5))
                .foregroundStyle(check.readability.ok ? NamingTheme.mint : NamingTheme.primaryDeep)
                .padding(.top, 10)

            // 多音字
            if !check.polyphones.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    Text(L10n.t("多音字提示"))
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(NamingTheme.muted)
                        .padding(.top, 8)
                    ForEach(check.polyphones, id: \.ch) { h in
                        Text(L10n.f("%@ · 常见 %@，另有 %@", h.ch, h.namePy, h.altPy)
                             + (h.note.isEmpty ? "" : " — " + h.note))
                            .font(.system(size: 12.5))
                            .foregroundStyle(NamingTheme.ink.opacity(0.85))
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }

            Text(L10n.t("仅供参考，不是唯一正确读音。"))
                .font(.system(size: 11.5))
                .foregroundStyle(NamingTheme.muted)
                .padding(.top, 8)
        }
    }

    private var speakButton: some View {
        Button {
            guard pro.require(.speechListen) else { return }
            switch SpeechHelper.speak(speakText, language: lang) {
            case .started:
                /* 下次点切换一下语种，方便试两种。粤语未确认，暂不提供。 */
                lang = lang == "zh-CN" ? "en-US" : "zh-CN"
            case .nothingToRead:
                model.toast(L10n.t("这段没有可以朗读的字，颜文字和符号读不出来。"))
            case .noVoice:
                model.toast(L10n.t("系统里没有可用的朗读语音。"))
            }
        } label: {
            HStack(spacing: 4) {
                Image(systemName: pro.isPro ? "speaker.wave.2.fill" : "lock.fill")
                Text(pro.isPro
                     ? L10n.f("试听 · %@", lang == "zh-CN" ? L10n.t("普通话") : "English")
                     : L10n.t("试听"))
            }
            .font(.system(size: 13, weight: .medium))
            .foregroundStyle(NamingTheme.primaryDeep)
        }
        .buttonStyle(NamingPressButtonStyle())
        .sensoryFeedback(.impact(flexibility: .soft, intensity: 0.5), trigger: lang)
    }
}

struct EnglishSpeechCard: View {
    let name: String
    @Environment(ProStore.self) private var pro
    @Environment(NamingAppModel.self) private var model

    var body: some View {
        NamingCard {
            CardTitleRow(title: L10n.t("英文读音体检")) {
                Button {
                    guard pro.require(.speechListen) else { return }
                    switch SpeechHelper.speak(name, language: "en-US") {
                    case .started:
                        break
                    case .nothingToRead:
                        model.toast(L10n.t("这段没有可以朗读的字，颜文字和符号读不出来。"))
                    case .noVoice:
                        model.toast(L10n.t("系统里没有可用的朗读语音。"))
                    }
                } label: {
                    Label(L10n.t("试听"), systemImage: pro.isPro ? "speaker.wave.2.fill" : "lock.fill")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(NamingTheme.primaryDeep)
                }
                .buttonStyle(NamingPressButtonStyle())
            }
            Text(L10n.t("帮助不熟悉英语发音的人，先听再决定是否适合自己。"))
                .font(.system(size: 13))
                .foregroundStyle(NamingTheme.muted)
                .padding(.top, 8)
        }
    }
}

struct ToneWaveView: View {
    let tones: [Int]
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var revealed = false

    var body: some View {
        HStack(alignment: .bottom, spacing: 6) {
            ForEach(Array(tones.enumerated()), id: \.offset) { index, t in
                let h = CGFloat(max(1, t)) * 8
                VStack(spacing: 3) {
                    RoundedRectangle(cornerRadius: 3, style: .continuous)
                        .fill(NamingTheme.primary.opacity(0.75))
                        .frame(width: 14, height: revealed || reduceMotion ? h : 2)
                    Text(t == 0 ? "·" : "\(t)")
                        .font(.system(size: 10))
                        .foregroundStyle(NamingTheme.muted)
                }
                .animation(
                    reduceMotion
                        ? nil
                        : NamingMotion.pick.delay(Double(index) * 0.03),
                    value: revealed
                )
            }
            Spacer(minLength: 0)
        }
        .onAppear { revealed = true }
    }
}
