import SwiftUI
import UIKit

/* 分享卡片 —— 对应 card.js 的 renderCard：竖版 3:4，名字 + 拼音 + 一句话 + 字义 + 雷达。 */

struct NamingCardData {
    var surname: NMSurname
    var chars: [String]
    var given: String
    var full: String
    var desc: String
    var radar: [RadarItem]?
    var bazi: BaziInfo?
    var baziNote: String
    var answered: Bool
    var enName: NMEnName?
    var mode: String
    /// 自选英文名时选的姓（只有 mode == "enStudio" 会有）。
    var enSurname: NMSurnameEn? = nil
    /* 照中文名取英文名时，卡片上要回填的**原来那个中文名**（李慕白）和它的拼音。
     * 空着就退回以前的行为：显示英文名的音译（艾玛）。 */
    var zhSource: String? = nil
    var zhSourcePy: String? = nil
}

enum NamingCardRenderer {
    @MainActor
    static func render(_ data: NamingCardData) -> UIImage? {
        let view = NamingShareCard(data: data)
            .frame(width: 675, height: 900)
        let renderer = ImageRenderer(content: view)
        renderer.scale = 1
        return renderer.uiImage
    }
}

/* 分享卡片 —— 对应 card.js 的 renderCard：竖版 3:4，名字 + 音译 + 一句话 + 字义 + 雷达。
 *
 * 尺寸固定 675×900，所有内容都得挤进这个高度里，所以：
 *  - 雷达**不用** `RadarBodyView`：它英文下改成竖排（图 180 + 七行对照），
 *    在卡片上会顶到 400+ 点，把下面全挤出去；这里用 156 的图 + 两列小条。
 *  - 中文卡片给「字义拆解」，英文卡片没有字，改给一行**含义**（库里查得到才有），
 *    否则英文卡片只有名字和音译，空得慌。 */

struct NamingShareCard: View {
    let data: NamingCardData

    private var label: String {
        let hasRadar = !(data.radar ?? []).isEmpty
        if data.mode == "enStudio" { return hasRadar ? L10n.t("按性格取的自选英文名") : L10n.t("自选的英文名") }
        if data.mode == "enSound" { return hasRadar ? L10n.t("照中文名读音配的英文名") : L10n.t("读音贴近的英文名") }
        if data.mode == "en" { return hasRadar ? L10n.t("由性格取的英文名") : L10n.t("精选英文名") }
        if data.bazi != nil && hasRadar { return L10n.t("性格 · 生辰取名") }
        if data.bazi != nil { return L10n.t("由生辰取的中文名") }
        if hasRadar { return L10n.t("按性格取的中文名") }
        return L10n.t("仙鹿起名")
    }

    private var pinyinLine: String {
        if let en = data.enName {
            /* 照着中文名取的时候，这一行给**原来那个中文名**（李慕白 → 拼音 Li Mubai），
             * 不是英文名的音译（艾玛）—— 音译看着像另一个名字，反而把人绕晕。 */
            if let src = data.zhSource, !src.isEmpty {
                return L10n.zhPrimary(src, data.zhSourcePy ?? "")
            }
            /* 英文界面下不给中文音译：那是一串看不懂的汉字，卡片上留白更干净。 */
            if L10n.isEnglish { return "" }
            /* 中文音译：名 + 姓（姓填了才有）。自选卡片只给这一行，
             * 其它英文名卡片前面再加音标（/ˈemə/）。 */
            let zh = ([en.zh, data.enSurname?.zh ?? ""].filter { !$0.isEmpty }).joined(separator: " ")
            if data.mode == "enStudio" { return zh }
            return (en.ph.isEmpty ? "" : "/\(en.ph)/  ·  ") + zh
        }
        return Pinyin.name(data.surname, data.chars)
    }

    /* 卡片 675×900，字不多但排版是全 App 最讲究的一处。
     * 英文界面下中文名以拼音为主标（外国人读得出），汉字退成副标；中文界面照旧。
     * 英文名卡片（mode == "en"）不参与对调 —— 它本身就是拉丁字母。 */

    private var isZhName: Bool { data.enName == nil }

    private var zhPinyin: String { Pinyin.titleCase(Pinyin.name(data.surname, data.chars)) }

    /// 主标：英文界面下中文名给拼音。拼音比汉字长（`Ōuyáng Jiànshān`），
    /// 所以英文模式下字号要收一档，再留 `minimumScaleFactor` 兜住长名。
    private var primaryName: String { isZhName ? L10n.zhPrimary(data.full, zhPinyin) : data.full }

    private var primarySize: CGFloat { isZhName && L10n.isEnglish ? 58 : 78 }

    /// 副标：只有「英文界面 + 中文名」时才需要补回汉字，其余情况走下面的拼音行。
    private var secondaryHanzi: String? {
        guard isZhName, L10n.isEnglish, !data.full.isEmpty else { return nil }
        return data.full
    }

    /// 顶部标签的逐字空格是汉字版式（字距），英文照做会变成「A C h i n e s e」。
    private var labelText: String {
        L10n.isEnglish ? label : label.map { String($0) }.joined(separator: " ")
    }

    /// 英文名的含义（库里查不到含义就退回语源）。
    private var enMeaning: String? {
        guard let en = data.enName else { return nil }
        let m = L10n.d("namesEn", en.n, "m", en.m).trimmingCharacters(in: .whitespaces)
        if !m.isEmpty { return m }
        let org = L10n.d("namesEn", en.n, "org", en.org).trimmingCharacters(in: .whitespaces)
        return org.isEmpty ? nil : org
    }

    var body: some View {
        VStack(spacing: 0) {
            /* 顶部标签做成胶囊：裸文字摆在空白顶上显得飘。 */
            Text(labelText)
                .font(.system(size: 13.5, weight: .semibold))
                .tracking(L10n.isEnglish ? 1.2 : 3)
                .foregroundStyle(NamingTheme.primaryDeep)
                .padding(.horizontal, 18)
                .padding(.vertical, 8)
                .background(NamingTheme.primary.opacity(0.12), in: Capsule())
                .padding(.top, 40)

            Spacer(minLength: 10)

            nameBlock

            /* 名字与正文之间一条短横线：卡片最需要的是一点呼吸。 */
            Rectangle()
                .fill(NamingTheme.hairline)
                .frame(width: 54, height: 1)
                .padding(.top, 22)

            if !data.desc.isEmpty {
                Text("“\(data.desc)”")
                    .font(.system(size: 16.5))
                    .lineSpacing(5)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(NamingTheme.ink.opacity(0.82))
                    .lineLimit(3)
                    .padding(.horizontal, 56)
                    .padding(.top, 18)
            }

            if let m = enMeaning {
                Text(m)
                    .font(.system(size: 14))
                    .lineSpacing(5)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(NamingTheme.muted)
                    .lineLimit(4)
                    .padding(.horizontal, 58)
                    .padding(.top, 16)
            }

            if !data.chars.isEmpty {
                charBlock.padding(.top, 18)
            }

            if let bazi = data.bazi {
                VStack(spacing: 8) {
                    Text(bazi.pillarStr)
                        .font(.system(size: 22, weight: .semibold))
                        .foregroundStyle(NamingTheme.primaryDeep)
                    if !(data.baziNote.isEmpty && bazi.short.isEmpty) {
                        Text(data.baziNote.isEmpty ? bazi.short : data.baziNote)
                            .font(.system(size: 14))
                            .multilineTextAlignment(.center)
                            .foregroundStyle(NamingTheme.muted)
                            .padding(.horizontal, 48)
                    }
                }
                .padding(.top, 20)
            }

            if let radar = data.radar, !radar.isEmpty {
                radarBlock(radar)
                    .padding(.horizontal, 54)
                    .padding(.top, 16)
            }

            Spacer(minLength: 12)

            VStack(spacing: 10) {
                Rectangle()
                    .fill(NamingTheme.hairline)
                    .frame(width: 40, height: 1)
                Text(L10n.t("仙鹿起名 · 名字实验室"))
                    .font(.system(size: 12.5))
                    .tracking(2)
                    .foregroundStyle(NamingTheme.muted)
            }
            .padding(.bottom, 30)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(
            LinearGradient(colors: [NamingTheme.background, NamingTheme.canvas],
                           startPoint: .top, endPoint: .bottom)
        )
    }

    private var nameBlock: some View {
        VStack(spacing: 0) {
            Text(primaryName)
                .font(.system(size: primarySize, weight: .bold))
                .foregroundStyle(NamingTheme.ink)
                .lineLimit(1)
                .minimumScaleFactor(0.5)
                .padding(.horizontal, 40)

            if let hanzi = secondaryHanzi {
                Text(hanzi)
                    .font(.system(size: 24, weight: .medium))
                    .foregroundStyle(NamingTheme.muted)
                    .padding(.top, 10)
            } else if !pinyinLine.isEmpty {
                Text(pinyinLine)
                    .font(.system(size: 18))
                    .foregroundStyle(NamingTheme.muted)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                    .padding(.horizontal, 40)
                    .padding(.top, 12)
            }
        }
    }

    /// 字义拆解（只有中文名卡片有字）。
    private var charBlock: some View {
        VStack(alignment: .leading, spacing: 11) {
            Text(L10n.t("字义拆解"))
                .font(.system(size: 13.5, weight: .semibold))
                .tracking(2)
                .foregroundStyle(NamingTheme.muted)
            ForEach(data.chars, id: \.self) { ch in
                HStack(spacing: 14) {
                    Text(ch)
                        .font(.system(size: 28, weight: .semibold))
                        .foregroundStyle(NamingTheme.ink)
                        .frame(width: 44, height: 44)
                        .background(NamingTheme.pearl, in: RoundedRectangle(cornerRadius: 11, style: .continuous))
                    VStack(alignment: .leading, spacing: 4) {
                        Text(Pinyin.name(nil, [ch]))
                            .font(.system(size: 13.5, weight: .medium))
                            .foregroundStyle(NamingTheme.primaryDeep)
                        Text(NameEngine.shared.charNote(ch).text)
                            .font(.system(size: 13.5))
                            .foregroundStyle(NamingTheme.ink.opacity(0.8))
                            .lineLimit(2)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Spacer(minLength: 0)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 56)
    }

    /* 卡片上的雷达：图 + 两列小条。
     * 不能直接用 `RadarBodyView` —— 英文下它是竖排（图 180 + 七行），900 的高度装不下。 */
    private func radarBlock(_ items: [RadarItem]) -> some View {
        VStack(spacing: 10) {
            HStack(spacing: 16) {
                legendDot(color: NamingTheme.ink.opacity(0.75), text: L10n.t("你"))
                legendDot(color: Color(hex: 0xF26D8D), text: L10n.t("这个名字"))
            }
            .font(.system(size: 11.5))
            .foregroundStyle(NamingTheme.muted)

            RadarChartView(items: items, size: L10n.isEnglish ? 142 : 150)

            LazyVGrid(columns: [GridItem(.flexible(), spacing: 16),
                                GridItem(.flexible(), spacing: 16)], spacing: 9) {
                ForEach(items, id: \.key) { miniAxis($0) }
            }
        }
    }

    private func miniAxis(_ r: RadarItem) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 6) {
                Text(r.label)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(NamingTheme.ink)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                Spacer(minLength: 0)
                Text("\(r.mine)")
                    .font(.system(size: 10.5))
                    .foregroundStyle(NamingTheme.muted)
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(NamingTheme.pearl)
                    Capsule()
                        .fill(NamingTheme.ink.opacity(0.7))
                        .frame(width: geo.size.width * CGFloat(max(0, min(100, r.mine))) / 100)
                }
            }
            .frame(height: 5)
        }
    }

    private func legendDot(color: Color, text: String) -> some View {
        HStack(spacing: 6) {
            Circle().fill(color).frame(width: 8, height: 8)
            Text(text)
        }
    }
}
