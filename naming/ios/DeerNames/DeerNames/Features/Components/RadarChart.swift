import SwiftUI

/* 雷达图与七轴对照 —— 对应 app.js 的 radarSvg / radarItems / radarBody / portraitBody。
 * 用 Canvas 画形状与标签，右侧那列用 SwiftUI 叠上去。 */

struct RadarChartView: View {
    let items: [RadarItem]
    var selfOnly: Bool = false
    var size: CGFloat = 190

    private let nameColor = Color(hex: 0xF26D8D)

    var body: some View {
        let c = size / 2
        let lr = c - 22
        Canvas { ctx, _ in
            // 圈
            for f in [CGFloat(0.25), 0.5, 0.75, 1.0] {
                var p = Path()
                for i in 0..<items.count {
                    let a = -Double.pi / 2 + Double(i) * 2 * Double.pi / Double(items.count)
                    let pt = CGPoint(x: c + CGFloat(cos(a)) * lr * f, y: c + CGFloat(sin(a)) * lr * f)
                    if i == 0 { p.move(to: pt) } else { p.addLine(to: pt) }
                }
                p.closeSubpath()
                ctx.stroke(p, with: .color(NamingTheme.hairline.opacity(0.7)), lineWidth: 1)
            }
            // 轴
            for i in 0..<items.count {
                let a = -Double.pi / 2 + Double(i) * 2 * Double.pi / Double(items.count)
                var p = Path()
                p.move(to: CGPoint(x: c, y: c))
                p.addLine(to: CGPoint(x: c + CGFloat(cos(a)) * lr, y: c + CGFloat(sin(a)) * lr))
                ctx.stroke(p, with: .color(NamingTheme.hairline.opacity(0.5)), lineWidth: 1)
            }

            if !selfOnly {
                // 名字的形状在下层
                let p = polygonPath({ $0.name }, center: c, radius: lr)
                ctx.fill(p, with: .color(nameColor.opacity(0.18)))
                ctx.stroke(p, with: .color(nameColor.opacity(0.8)), lineWidth: 1.4)
            }
            let minePath = polygonPath({ $0.mine }, center: c, radius: lr)
            ctx.fill(minePath, with: .color(selfOnly ? nameColor.opacity(0.18) : NamingTheme.ink.opacity(0.14)))
            ctx.stroke(minePath, with: .color(selfOnly ? nameColor.opacity(0.9) : NamingTheme.ink.opacity(0.75)),
                       lineWidth: 1.4)

            // 标签
            for (i, it) in items.enumerated() {
                let a = -Double.pi / 2 + Double(i) * 2 * Double.pi / Double(items.count)
                let x = c + CGFloat(cos(a)) * lr
                let y = c + CGFloat(sin(a)) * lr
                let dx = cos(a)
                let text = Text(it.label).font(.system(size: 9)).foregroundStyle(NamingTheme.muted)
                ctx.draw(text, at: CGPoint(x: x + CGFloat(dx) * 10, y: y))
            }
        }
        .frame(width: size, height: size)
    }

    private func polygonPath(_ value: (RadarItem) -> Int, center c: CGFloat, radius lr: CGFloat) -> Path {
        var p = Path()
        for (i, it) in items.enumerated() {
            let a = -Double.pi / 2 + Double(i) * 2 * Double.pi / Double(items.count)
            let r = lr * CGFloat(max(0, min(100, value(it)))) / 100
            let pt = CGPoint(x: c + CGFloat(cos(a)) * r, y: c + CGFloat(sin(a)) * r)
            if i == 0 { p.move(to: pt) } else { p.addLine(to: pt) }
        }
        p.closeSubpath()
        return p
    }
}

struct AxisBarsView: View {
    let items: [RadarItem]
    var selfOnly: Bool

    /* 英文标签长得多（Warmth / Reserved / Expression），窄列会断成一列字母；
     * 所以英文下把两列都放宽，跟 RadarBodyView 的竖排布局配合。 */
    private var labelWidth: CGFloat { L10n.isEnglish ? 64 : 38 }
    private var valueWidth: CGFloat { L10n.isEnglish ? 66 : 34 }

    var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            ForEach(items, id: \.key) { r in
                HStack(spacing: 8) {
                    Text(r.label)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(NamingTheme.ink)
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                        .frame(width: labelWidth, alignment: .leading)
                    VStack(spacing: 3) {
                        track(r.mine, color: NamingTheme.ink.opacity(0.75))
                        if !selfOnly {
                            track(r.name, color: Color(hex: 0xF26D8D).opacity(0.85))
                        }
                    }
                    Text(r.mine >= 50 ? r.high : r.low)
                        .font(.system(size: 11))
                        .foregroundStyle(NamingTheme.muted)
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                        .frame(width: valueWidth, alignment: .trailing)
                }
            }
        }
    }

    private func track(_ pct: Int, color: Color) -> some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(NamingTheme.pearl)
                Capsule().fill(color)
                    .frame(width: geo.size.width * CGFloat(max(0, min(100, pct))) / 100)
            }
        }
        .frame(height: 6)
    }
}

struct RadarBodyView: View {
    let items: [RadarItem]
    var selfOnly: Bool = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if !selfOnly {
                HStack(spacing: 14) {
                    legend(color: NamingTheme.ink.opacity(0.75), text: L10n.t("你"))
                    legend(color: Color(hex: 0xF26D8D), text: L10n.t("这个名字"))
                }
                .font(.system(size: 12))
                .foregroundStyle(NamingTheme.muted)
            }
            /* 中文标签短，雷达图＋七轴并排；英文标签长，竖着排（图在上、对照在下），
             * 否则那两列窄得只能一个字母一个字母换行。 */
            if L10n.isEnglish {
                VStack(alignment: .leading, spacing: 14) {
                    RadarChartView(items: items, selfOnly: selfOnly, size: 180)
                        .frame(maxWidth: .infinity)
                    AxisBarsView(items: items, selfOnly: selfOnly)
                }
            } else {
                HStack(alignment: .center, spacing: 14) {
                    RadarChartView(items: items, selfOnly: selfOnly)
                    AxisBarsView(items: items, selfOnly: selfOnly)
                    Spacer(minLength: 0)
                }
            }
        }
    }

    private func legend(color: Color, text: String) -> some View {
        HStack(spacing: 6) {
            Circle().fill(color).frame(width: 8, height: 8)
            Text(text)
        }
    }
}
