import SwiftUI

/* 推荐组合 —— 对应 app.js 的 renderResult。 */

struct ResultView: View {
    @Environment(NamingAppModel.self) private var model
    @State private var expandProfile = false
    @State private var expandBazi = false

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                if let p = model.profile {
                    surnamePickerCard

                    let hasSur = model.surname != nil
                    let exProfile = hasSur ? expandProfile : true
                    let exBazi = hasSur ? expandBazi : true

                    if p.hasAnswered {
                        NamingCard {
                            FoldHeader(title: L10n.t("性格画像"),
                                       subtitle: NameEngine.shared.describe(p),
                                       actionLabel: exProfile ? L10n.t("收起") : L10n.t("展开")) {
                                expandProfile.toggle()
                            }
                            if exProfile {
                                RadarBodyView(items: NameEngine.shared.radarSelf(p), selfOnly: true)
                                    .padding(.top, 12)
                                HStack {
                                    Button(L10n.t("重新测")) { model.openQuiz() }
                                        .font(.system(size: 14))
                                        .foregroundStyle(NamingTheme.primaryDeep)
                                    Spacer()
                                }
                                .padding(.top, 10)
                            }
                        }
                    }

                    if let bazi = model.currentBazi() {
                        NamingCard {
                            FoldHeader(title: L10n.t("生辰八字"),
                                       subtitle: bazi.pillarStr.isEmpty ? bazi.summary : bazi.pillarStr,
                                       actionLabel: exBazi ? L10n.t("收起") : L10n.t("展开")) {
                                expandBazi.toggle()
                            }
                            if exBazi {
                                VStack(alignment: .leading, spacing: 10) {
                                    Text(bazi.summary)
                                        .font(.system(size: 14))
                                        .foregroundStyle(NamingTheme.ink)
                                        .fixedSize(horizontal: false, vertical: true)
                                    Text("\(bazi.solar?.y ?? 0)/\(bazi.solar?.m ?? 0)/\(bazi.solar?.d ?? 0)"
                                         + (bazi.lunar != nil ? " · \(BaziEngine.lunarText(bazi.lunar))" : ""))
                                        .font(.system(size: 12))
                                        .foregroundStyle(NamingTheme.muted)
                                    WxBarsView(counts: bazi.counts)
                                    Button(L10n.t("改生辰")) { model.openBazi() }
                                        .font(.system(size: 14))
                                        .foregroundStyle(NamingTheme.primaryDeep)
                                }
                                .padding(.top, 12)
                            }
                        }
                    } else {
                        NamingCard {
                            CardTitleRow(L10n.t("生辰辅助"))
                            Text(L10n.t("补充出生日期，推荐时会参考宜补五行。"))
                                .font(.system(size: 14))
                                .foregroundStyle(NamingTheme.ink)
                                .padding(.bottom, 12)
                            GhostButton(title: L10n.t("加生辰")) { model.openBazi() }
                        }
                    }

                    if let surname = model.surname {
                        FeedbackPrefCard()
                        recList(surname: surname)
                    } else {
                        surnameWaitingHint
                    }
                } else {
                    Text(L10n.t("先做一遍测试，才知道该往哪个方向取。"))
                        .font(.system(size: 14))
                        .foregroundStyle(NamingTheme.muted)
                        .padding(.top, 40)
                }
            }
            .padding(20)
        }
        .namingPageBackground()
        .navigationTitle(L10n.t("推荐组合"))
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: - 姓氏选择

    /* 全页只有这一个选姓氏入口：顶部常驻一行。没选过是「选姓氏」（主色描边，
     * 一眼看出可点），选过显示「姓 + 拼音 + 更换」。底部不再放重复的按钮。 */
    private var surnamePickerCard: some View {
        Button {
            model.sheet = .surname
        } label: {
            HStack(spacing: 12) {
                Text(L10n.t("姓"))
                    .font(.system(size: 14))
                    .foregroundStyle(NamingTheme.muted)
                    /* 英文是 Surname，给足宽度免得竖着断行。 */
                    .lineLimit(1)
                    .frame(width: L10n.isEnglish ? 58 : 24, alignment: .leading)
                if let s = model.surname {
                    Text(s.c)
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundStyle(NamingTheme.ink)
                    Text(NameEngine.shared.surPy(s))
                        .font(.system(size: 12))
                        .foregroundStyle(NamingTheme.muted)
                } else {
                    Text(L10n.t("选姓氏"))
                        .font(.system(size: 16, weight: .medium))
                        .foregroundStyle(NamingTheme.primaryDeep)
                }
                Spacer(minLength: 0)
                Text(model.surname == nil ? "" : L10n.t("更换"))
                    .font(.system(size: 13))
                    .foregroundStyle(NamingTheme.primaryDeep)
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(NamingTheme.muted)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 15)
            .background(NamingTheme.canvas, in: RoundedRectangle(cornerRadius: NamingRadius.large, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: NamingRadius.large, style: .continuous)
                    .strokeBorder(model.surname == nil ? NamingTheme.primary.opacity(0.55) : NamingTheme.hairline, lineWidth: 1)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    /* 没选姓氏时的等待态。只是说明，不带按钮 —— 选姓氏的点就在上面那一行。 */
    private var surnameWaitingHint: some View {
        NamingCard {
            Text(L10n.t("先定姓氏"))
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(NamingTheme.ink)
                .padding(.bottom, 6)
            Text(L10n.t("推荐的名字都挂在你自己的姓下面。点上面的「选姓氏」，选好就按性格排一批出来。"))
                .font(.system(size: 13.5))
                .foregroundStyle(NamingTheme.muted)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    @ViewBuilder
    private func recList(surname: NMSurname) -> some View {
        let p = model.profile
        let hasQuiz = (p?.answered ?? 0) > 0
        let title: String = {
            if p?.bazi != nil && !hasQuiz { return L10n.f("「%@」姓 · 按生辰宜补", surname.c) }
            if p?.bazi != nil { return L10n.f("「%@」姓 · 性格 + 生辰", surname.c) }
            return L10n.f("「%@」姓 · 按性格推荐", surname.c)
        }()

        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Text(title)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(NamingTheme.ink)
                Spacer()
                Button(L10n.t("查看全部")) { model.go(.resultAll) }
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(NamingTheme.primaryDeep)
                Button(L10n.t("换一批")) { model.changeBatch() }
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(NamingTheme.primaryDeep)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(NamingTheme.primary.opacity(0.12), in: Capsule())
            }

            if model.recs.isEmpty {
                NamingCard {
                    Text(L10n.t("没找到合适的名字"))
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(NamingTheme.ink)
                        .padding(.bottom, 6)
                    Text(L10n.t("可换个性别再试，或稍后再换一批。"))
                        .font(.system(size: 13))
                        .foregroundStyle(NamingTheme.muted)
                }
            } else {
                ForEach(Array(model.recs.enumerated()), id: \.offset) { index, rec in
                    Button {
                        model.openRec(rec)
                    } label: {
                        HStack(spacing: 12) {
                            Text("\(index + 1)")
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(NamingTheme.primaryDeep)
                                .frame(width: 24, height: 24)
                                .background(NamingTheme.primary.opacity(0.12), in: Circle())
                            VStack(alignment: .leading, spacing: 4) {
                                HStack(alignment: .firstTextBaseline, spacing: 8) {
                                    Text(rec.full)
                                        .font(.system(size: 18, weight: .semibold))
                                        .foregroundStyle(NamingTheme.ink)
                                    Text(Pinyin.titleCase(Pinyin.name(rec.surname, rec.chars)))
                                        .font(.system(size: 12))
                                        .foregroundStyle(NamingTheme.muted)
                                }
                                Text(NameEngine.shared.euphonyLabel(rec.euphony) + " · " + model.tagOf(rec.name))
                                    .font(.system(size: 12))
                                    .foregroundStyle(NamingTheme.muted)
                            }
                            Spacer(minLength: 0)
                            Image(systemName: "chevron.right")
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(NamingTheme.muted)
                        }
                        .padding(14)
                        .background(NamingTheme.canvas, in: RoundedRectangle(cornerRadius: NamingRadius.medium, style: .continuous))
                        .overlay {
                            RoundedRectangle(cornerRadius: NamingRadius.medium, style: .continuous)
                                .strokeBorder(model.isSaved(rec.full) ? NamingTheme.primary.opacity(0.6) : NamingTheme.hairline, lineWidth: 1)
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }
}

/* 推荐偏好的可管理卡片 —— 对应 feedbackPrefCard。 */
struct FeedbackPrefCard: View {
    @Environment(NamingAppModel.self) private var model

    var body: some View {
        let banNames = Array(model.feedback.banFull)
        let banChars = Array(model.feedback.banChars)
        let keep = model.feedback.keepChars
        if !banNames.isEmpty || !banChars.isEmpty || !keep.isEmpty {
            NamingCard {
                CardTitleRow(title: L10n.t("推荐偏好")) {
                    Button(L10n.t("清空")) {
                        withAnimation(NamingMotion.pick) {
                            model.feedback = FeedbackOptions()
                            model.recShown = []
                            if model.screen == .result { model.refreshRecs() }
                            if model.screen == .detail { model.applyFeedbackToDetail() }
                            model.sheet = nil
                            model.toast(L10n.t("已清空推荐偏好"))
                        }
                    }
                    .font(.system(size: 13))
                    .foregroundStyle(NamingTheme.primaryDeep)
                }

                VStack(alignment: .leading, spacing: 10) {
                    if !keep.isEmpty {
                        prefRow(label: L10n.t("保留"), color: NamingTheme.mint) {
                            ForEach(keep, id: \.self) { ch in
                                prefTag(ch) {
                                    model.feedback.keepChars.removeAll { $0 == ch }
                                    model.toast(L10n.f("已取消保留「%@」", ch))
                                    refreshAfterFeedback()
                                }
                            }
                        }
                    }
                    if !banChars.isEmpty {
                        prefRow(label: L10n.t("排除"), color: NamingTheme.primaryDeep) {
                            ForEach(banChars, id: \.self) { ch in
                                prefTag(ch) {
                                    model.feedback.banChars.remove(ch)
                                    model.toast(L10n.f("已取消排除「%@」", ch))
                                    refreshAfterFeedback()
                                }
                            }
                        }
                    }
                    if !banNames.isEmpty {
                        HStack(spacing: 10) {
                            Text(L10n.t("不喜欢"))
                                .font(.system(size: 13))
                                .foregroundStyle(NamingTheme.muted)
                            Button {
                                model.sheet = .banNames
                            } label: {
                                HStack(spacing: 4) {
                                    Text(L10n.f("%ld 个名字", banNames.count))
                                    Image(systemName: "chevron.right").font(.system(size: 11))
                                }
                                .font(.system(size: 13))
                                .foregroundStyle(NamingTheme.primaryDeep)
                            }
                            Spacer(minLength: 0)
                        }
                    }
                }
            }
        }
    }

    private func refreshAfterFeedback() {
        if model.screen == .detail { model.applyFeedbackToDetail() }
        if model.screen == .result { model.refreshRecs() }
    }

    private func prefRow<Content: View>(label: String, color: Color, @ViewBuilder content: () -> Content) -> some View {
        HStack(alignment: .center, spacing: 10) {
            Text(label)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(color)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) { content() }
            }
            Spacer(minLength: 0)
        }
    }

    private func prefTag(_ ch: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 4) {
                Text(ch)
                Image(systemName: "xmark").font(.system(size: 9, weight: .bold))
            }
            .font(.system(size: 13))
            .foregroundStyle(NamingTheme.ink)
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(NamingTheme.pearl, in: Capsule())
        }
        .buttonStyle(.plain)
    }
}
