import SwiftUI

/* 单个名字的详情 —— 对应 app.js 的 renderDetail。 */

struct DetailView: View {
    @Environment(NamingAppModel.self) private var model

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                if let c = model.current {
                    detailContent(c)
                } else {
                    Text(L10n.t("没找到合适的名字，换个性别偏好再试试。"))
                        .font(.system(size: 14))
                        .foregroundStyle(NamingTheme.muted)
                        .padding(.top, 40)
                }
            }
            .padding(20)
        }
        .namingPageBackground()
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .namingDock(visible: model.current != nil) {
            if let c = model.current {
                DockPrimaryButton(title: L10n.t("生成分享卡片")) { model.openCardZh(c) }
            }
        }
    }

    @ViewBuilder
    private func detailContent(_ c: NameResult) -> some View {
        let p = model.profile
        let radar = (p?.hasAnswered ?? false) ? NameEngine.shared.radar(p!, c.vec) : nil
        let desc = (p?.hasAnswered ?? false)
            ? NameEngine.shared.describe(p!)
            : (p?.bazi?.short ?? L10n.t("从收藏里翻出来的名字"))
        let rel = NameEngine.shared.readability(c.surname, c.chars)
        let saved = model.isSaved(c.full)
        let eu = c.euphony ?? NameEngine.shared.euphony(c.surname, c.chars)
        let wxNote = p?.bazi != nil ? BaziEngine.explainName(c.chars, p!.bazi) : ""

        // 名字主卡
        NamingCard {
            Text(desc)
                .font(.system(size: 12))
                .foregroundStyle(NamingTheme.primaryDeep)
                .padding(.bottom, 10)
            Text(L10n.zhPrimary(c.full, Pinyin.titleCase(Pinyin.name(c.surname, c.chars))))
                .font(.system(size: 40, weight: .bold))
                .foregroundStyle(NamingTheme.ink)
                .frame(maxWidth: .infinity)
            Text(L10n.zhSecondary(c.full, Pinyin.titleCase(Pinyin.name(c.surname, c.chars))))
                .font(.system(size: 14))
                .foregroundStyle(NamingTheme.muted)
                .frame(maxWidth: .infinity)
                .padding(.top, 6)
            Text(model.whyFor(c))
                .font(.system(size: 14))
                .foregroundStyle(NamingTheme.ink.opacity(0.85))
                .multilineTextAlignment(.center)
                .frame(maxWidth: .infinity)
                .padding(.top, 12)
            Text(L10n.t("适合你，是因为：") + reasonBits(c, eu: eu, hasBazi: wxNote.isEmpty == false))
                .font(.system(size: 12.5))
                .foregroundStyle(NamingTheme.muted)
                .multilineTextAlignment(.center)
                .frame(maxWidth: .infinity)
                .padding(.top, 8)

            /* 四个按钮（Another / More names / Save / Choose surname）英文下并排放不下。
             * 早先改成了横滑，但滑动的行只会露出半个按钮，看着像坏了 —— 改成换行：
             * 放不下就整颗挪到下一行，每个按钮都完整。 */
            FlowLayout(spacing: 10, lineSpacing: 10) {
                pill(L10n.t("换名"), primary: true) { model.again() }
                pill(L10n.t("备选名")) { model.sheet = .pool }
                pill(saved ? L10n.t("已收藏") : L10n.t("收藏"), favorite: !saved) {
                    withAnimation(NamingMotion.pick) {
                        model.toggleSave()
                    }
                }
                pill(L10n.t("选姓氏")) { model.sheet = .surname }
            }
            .padding(.top, 16)
        }

        SpeechCheckCard(surname: c.surname, chars: c.chars, speakText: c.full)

        // 名字里有什么
        NamingCard {
            CardTitleRow(L10n.t("名字里有什么"))
            VStack(spacing: 0) {
                ForEach(c.chars, id: \.self) { ch in
                    charRow(ch)
                    if ch != c.chars.last {
                        Divider().overlay(NamingTheme.hairline)
                    }
                }
            }
            let hasFb = !model.feedback.keepChars.isEmpty || !model.feedback.banChars.isEmpty
            /* 两颗按钮上就写着「排除 / 保留」，这句只补一句「之后会怎样」。
             * 早先是一整段解释「换名 = 不喜欢当前名……」，那段没在解释任何新东西。 */
            HintText(text: hasFb
                     ? L10n.t("排除的字之后不再出现，保留的字之后必须带上。")
                     : L10n.t("排除 = 之后不再出现；保留 = 之后必须带上。"))
                .padding(.top, 12)

            /* 读感一行：拼成一句让 `Text` 自己折行。
             * 早先是 HStack 里几段文字，英文下每段都往窄里挤，出现
             * 「· reads / very smooth」这种半句一行。 */
            let readParts = [rel.ok ? L10n.t("读感没问题") : rel.issues.joined(separator: L10n.t("、")),
                             L10n.t("念着") + NameEngine.shared.euphonyLabel(eu)]
                + rel.good.prefix(1).map { $0 }
            Text(readParts.joined(separator: " · "))
                .font(.system(size: 12.5))
                .foregroundStyle(eu >= 0.85 ? NamingTheme.mint : NamingTheme.primaryDeep)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(12)
                .background((eu >= 0.85 ? NamingTheme.mint : NamingTheme.primary).opacity(0.10),
                            in: RoundedRectangle(cornerRadius: NamingRadius.small, style: .continuous))
                .padding(.top, 12)
        }

        if !wxNote.isEmpty {
            NamingCard {
                CardTitleRow(L10n.t("生辰用字"))
                Text(wxNote)
                    .font(.system(size: 14))
                    .foregroundStyle(NamingTheme.ink)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }

        if let radar, !radar.isEmpty {
            NamingCard {
                CardTitleRow(L10n.t("性格画像"))
                RadarBodyView(items: radar)
            }
        }

        CelebSection(given: c.given.isEmpty ? c.chars.joined() : c.given, chars: c.chars)

        if let p, p.hasAnswered, let enAlt = NameEngine.shared.crossCulture(p, wantGender: model.wantGender).en?.name {
            NamingCard {
                CardTitleRow(L10n.t("同一个你，换个文化叫什么"))
                crossRow(L10n.t("中文名"), L10n.zhPrimary(c.full, Pinyin.titleCase(Pinyin.name(c.surname, c.chars))), nil)
                crossRow(L10n.t("英文名"), enAlt.n, L10n.d("namesEn", enAlt.n, "org", enAlt.org))
                GhostButton(title: L10n.t("看更多英文名")) { model.openEn() }
                    .padding(.top, 12)
            }
        }
    }

    /* 一个字一行：第一行是「字 + 读音 + 五行 + 两颗按钮」，第二行才是释义。
     *
     * 早先是全都挤在一个 HStack 里（字 / 读音 / 释义 / 按钮 / 按钮），释义夹在两颗
     * 按钮中间只剩很窄一列，英文下被折成「reed pipes, / blending in / harmony」三行。
     * 释义单独一行就能吃满整个宽度。 */
    private func charRow(_ ch: String) -> some View {
        let engine = NameEngine.shared
        /* 有些意象域没有对应五行（domainWx 给空串），当作没有。 */
        let wx = engine.getChar(ch).flatMap { engine.domainWx($0.dom) }.flatMap { $0.isEmpty ? nil : $0 }
        let banned = model.feedback.banChars.contains(ch)
        let kept = model.feedback.keepChars.contains(ch)
        return VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(ch)
                    .font(.system(size: 24, weight: .semibold))
                    .foregroundStyle(NamingTheme.ink)
                Text(engine.getChar(ch)?.py ?? "")
                    .font(.system(size: 12))
                    .foregroundStyle(NamingTheme.muted)
                if let wx {
                    Text(L10n.t(wx))
                        .font(.system(size: 11))
                        .foregroundStyle(NamingTheme.primaryDeep)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 3)
                        .background(NamingTheme.primary.opacity(0.12), in: Capsule())
                }
                Spacer(minLength: 8)
                feedbackButton(banned ? L10n.t("已排除") : L10n.t("排除"),
                               on: banned, color: NamingTheme.primaryDeep) { toggleBan(ch) }
                feedbackButton(kept ? L10n.t("已保留") : L10n.t("保留"),
                               on: kept, color: NamingTheme.mint) { toggleKeep(ch) }
            }
            Text(engine.charNote(ch).text)
                .font(.system(size: 13.5))
                .foregroundStyle(NamingTheme.ink.opacity(0.85))
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.vertical, 12)
    }

    /// 「排除 / 保留」这两颗小胶囊（详情的字行、字库页都用得上同一种手感）。
    private func feedbackButton(_ title: String, on: Bool, color: Color,
                                action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 11.5))
                .lineLimit(1)
                .fixedSize(horizontal: true, vertical: false)
                .foregroundStyle(on ? .white : NamingTheme.ink)
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(on ? AnyShapeStyle(color) : AnyShapeStyle(NamingTheme.pearl), in: Capsule())
        }
        .buttonStyle(NamingPressButtonStyle())
        .sensoryFeedback(.selection, trigger: on)
    }

    private func crossRow(_ key: String, _ value: String, _ extra: String?) -> some View {
        HStack(spacing: 10) {
            Text(key)
                .font(.system(size: 13))
                .foregroundStyle(NamingTheme.muted)
                .lineLimit(1)
                /* 英文是 Chinese name / English name。 */
                .frame(width: L10n.isEnglish ? 86 : 52, alignment: .leading)
            Text(value)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(NamingTheme.ink)
            if let extra, !extra.isEmpty {
                Text(extra)
                    .font(.system(size: 12))
                    .foregroundStyle(NamingTheme.muted)
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, 6)
    }

    private func pill(_ title: String, primary: Bool = false, favorite: Bool = false,
                      action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(primary ? .white : (favorite ? .white : NamingTheme.ink))
                /* 按钮文字永不换行（挤不下就让整行横滑）。 */
                .lineLimit(1)
                .fixedSize(horizontal: true, vertical: false)
                .padding(.horizontal, 14)
                .padding(.vertical, 9)
                .background {
                    if primary {
                        NamingTheme.gradient
                    } else if favorite {
                        NamingTheme.primaryDeep
                    } else {
                        NamingTheme.pearl
                    }
                }
                .clipShape(Capsule())
        }
        .buttonStyle(NamingPressButtonStyle())
    }

    private func reasonBits(_ c: NameResult, eu: Double, hasBazi: Bool) -> String {
        var bits: [String] = []
        if c.source == "curated" {
            bits.append(model.tagOf(c) == L10n.t("清雅") ? L10n.t("精选清雅名") : L10n.t("精选常见名"))
        } else {
            bits.append(L10n.t("按字义拼成"))
        }
        if eu >= 0.85 { bits.append(L10n.t("念起来顺口")) }
        if model.profile?.hasAnswered ?? false { bits.append(L10n.t("贴合你的性格画像")) }
        if hasBazi { bits.append(L10n.t("兼顾生辰宜补")) }
        return bits.joined(separator: " · ")
    }

    private func toggleBan(_ ch: String) {
        if model.feedback.banChars.contains(ch) {
            model.feedback.banChars.remove(ch)
            model.toast(L10n.f("已取消排除「%@」", ch))
        } else {
            model.feedback.banChars.insert(ch)
            model.feedback.keepChars.removeAll { $0 == ch }
            model.toast(L10n.f("之后绝不再出现「%@」", ch))
        }
        if !model.applyFeedbackToDetail() {
            model.toast(L10n.t("带当前偏好的候选不够了，试试取消部分排除或换姓"))
        }
        if model.screen == .result { model.refreshRecs() }
    }

    private func toggleKeep(_ ch: String) {
        if model.feedback.keepChars.contains(ch) {
            model.feedback.keepChars.removeAll { $0 == ch }
            model.toast(L10n.f("已取消保留「%@」", ch))
        } else {
            if model.feedback.keepChars.count >= 4 {
                model.toast(L10n.t("最多保留 4 个字"))
                return
            }
            model.feedback.keepChars.append(ch)
            model.feedback.banChars.remove(ch)
            model.toast(L10n.f("之后名字都必须带「%@」", ch))
        }
        if !model.applyFeedbackToDetail() {
            model.toast(L10n.t("带这些保留字的候选不够了，试试取消部分保留或换姓"))
        }
        if model.screen == .result { model.refreshRecs() }
    }
}
