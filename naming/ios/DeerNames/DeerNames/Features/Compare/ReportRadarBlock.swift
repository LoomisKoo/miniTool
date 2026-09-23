import SwiftUI

/* 对比报告里的性格雷达：与分享卡同构，但独立成件方便屏上 + 导出复用。 */

struct ReportRadarBlock: View {
    let items: [RadarItem]
    var chartSize: CGFloat = L10n.isEnglish ? 128 : 140

    var body: some View {
        VStack(spacing: 10) {
            HStack(spacing: 16) {
                legendDot(color: NamingTheme.ink.opacity(0.75), text: L10n.t("你"))
                legendDot(color: NamingTheme.primary, text: L10n.t("这个名字"))
            }
            .font(.system(size: 11.5))
            .foregroundStyle(NamingTheme.muted)

            RadarChartView(items: items, size: chartSize, nameColor: NamingTheme.primary)

            LazyVGrid(columns: [GridItem(.flexible(), spacing: 12),
                                GridItem(.flexible(), spacing: 12)], spacing: 8) {
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
                Text("\(r.name)")
                    .font(.system(size: 10.5, weight: .medium))
                    .foregroundStyle(NamingTheme.primaryDeep)
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(NamingTheme.pearl)
                    Capsule()
                        .fill(NamingTheme.primary.opacity(0.75))
                        .frame(width: geo.size.width * CGFloat(max(0, min(100, r.name))) / 100)
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
