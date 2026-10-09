import SwiftUI

// MARK: - 复古票 vt-*

struct TkVintage: View {
    @Environment(\.ticket) private var t
    let spec: H5Family.Vintage

    private struct Pal {
        var bg: UInt32 = 0x1D4A52, bg2: UInt32 = 0x153940, gold: UInt32 = 0xD9B977, paper: UInt32 = 0xEFE3C6
        var ink: UInt32 = 0xA8322C, a: UInt32 = 0x7B8757, b: UInt32 = 0xC9693D, accent: UInt32 = 0xC98F2A
    }

    private var pal: Pal {
        var p = Pal()
        switch (spec.variant, spec.pal) {
        case ("liner", "wine"): p.bg = 0x5B1F27; p.bg2 = 0x401319; p.gold = 0xE0BF82; p.paper = 0xF3E4C9
        case ("liner", "forest"): p.bg = 0x25432F; p.bg2 = 0x193122; p.gold = 0xD6B56F; p.paper = 0xEEE2C3
        case ("circus", "navy"): p.ink = 0x253F6E; p.paper = 0xEFE6D2; p.accent = 0xB8892F
        case ("circus", "green"): p.ink = 0x2F5B3C; p.paper = 0xF1E8D2; p.accent = 0xB0772D
        case ("circus", _): p.paper = 0xF3E7D0
        case ("badge", "lake"): p.a = 0x3F6C8C; p.b = 0xD8A440; p.ink = 0x213646; p.paper = 0xEEE6D3
        case ("badge", "plum"): p.a = 0x6D3B5B; p.b = 0xD9867A; p.ink = 0x3B2233; p.paper = 0xF3E6DC
        case ("badge", _): p.ink = 0x3A3A2A; p.paper = 0xEFE5CF
        case ("gallery", "emerald"): p.bg = 0x1F4D42; p.bg2 = 0x153A31; p.gold = 0xD8BD7A; p.paper = 0xEFE3C4
        case ("gallery", "wine"): p.bg = 0x50202F; p.bg2 = 0x3A1521; p.gold = 0xDEB980; p.paper = 0xEFE3C4
        case ("gallery", _): p.bg = 0x1F3263; p.bg2 = 0x152348; p.gold = 0xD9B86E; p.paper = 0xEFE3C4
        default: break
        }
        return p
    }

    var body: some View {
        let size = t.template.size
        Group {
            switch spec.variant {
            case "liner": liner(pal)
            case "circus": circus(pal)
            case "badge": badge(pal)
            default: gallery(pal)
            }
        }
        .frame(width: size.width, height: size.height)
    }

    // MARK: 零件

    private func line(_ key: String, _ value: String, valueColor: Color? = nil) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
            Text(key).font(.h5Mono(rem(0.54))).trackingEm(0.06, size: rem(0.54)).fixedSize()
            Text(value)
                .font(.h5Mono(rem(0.62)))
                .fontWeight(.medium)
                .lineLimit(1)
                .foregroundStyle(valueColor ?? .primary)
                .padding(.bottom, 1)
                .frame(maxWidth: .infinity, alignment: .leading)
                .overlay(alignment: .bottom) { Rectangle().frame(height: 1) }
        }
    }

    private func doubleFrame(_ color: Color, edges: Edge.Set = .all) -> some View {
        ZStack {
            DoubleEdge(edges: edges, inset: 0).stroke(color, lineWidth: 1.33)
            DoubleEdge(edges: edges, inset: 2.67).stroke(color, lineWidth: 1.33)
        }
        .opacity(0.85)
        .allowsHitTesting(false)
    }

    private func paper2(_ p: Pal) -> Color {
        func mix(_ shift: Int) -> Double {
            let a = Double((p.paper >> shift) & 0xFF), b = Double((0xB89A6A >> shift) & 0xFF)
            return (a * 0.88 + b * 0.12) / 255
        }
        return Color(red: mix(16), green: mix(8), blue: mix(0))
    }

    // MARK: 凹角船票

    private func liner(_ p: Pal) -> some View {
        let gold = Color(hex: p.gold), paper = Color(hex: p.paper)
        return HStack(spacing: 0) {
            VStack(spacing: 6) {
                Text(t.place).font(.h5Mono(rem(0.56))).trackingEm(0.24, size: rem(0.56)).lineLimit(1)
                Text(t.title.uppercased())
                    .font(.h5Serif(rem(1.7)))
                    .trackingEm(0.05, size: rem(1.7))
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
                HStack(spacing: 8) {
                    LIcon(spec.icons[0], size: 20).frame(width: 28)
                    H5Photo()
                        .aspectRatio(16 / 9, contentMode: .fit)
                        .clipShape(RoundedRectangle(cornerRadius: 3))
                        .overlay(RoundedRectangle(cornerRadius: 3).strokeBorder(gold, lineWidth: 2))
                        .padding(3)
                        .background(Color(hex: p.bg), in: RoundedRectangle(cornerRadius: 5))
                        .overlay(RoundedRectangle(cornerRadius: 6).inset(by: -0.5).strokeBorder(gold, lineWidth: 1))
                    LIcon(spec.icons[1], size: 20).frame(width: 28)
                }
                .padding(.top, 2)
                .padding(.bottom, 4)
                HStack(spacing: 14) {
                    line("DATE:", t.date, valueColor: paper)
                    line("NO.", t.seat, valueColor: paper)
                }
                Text(t.mood).font(.h5Sans(rem(0.62))).italic().foregroundStyle(paper).lineLimit(1)
            }
            .multilineTextAlignment(.center)
            .padding(EdgeInsets(top: 26, leading: 26, bottom: 24, trailing: 10))
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            VStack(spacing: 12) {
                LIcon(spec.icons[0], size: 20)
                Text(t.seat)
                    .font(.h5Mono(rem(0.66)))
                    .fontWeight(.medium)
                    .trackingEm(0.2, size: rem(0.66))
                    .foregroundStyle(paper)
                    .fixedSize()
                    .rotationEffect(.degrees(90))
                    .frame(width: 14, height: 120)
            }
            .padding(.vertical, 24)
            .frame(width: 68)
            .frame(maxHeight: .infinity)
            .overlay(alignment: .leading) { H5Dash(color: gold, lineWidth: 1.5, dash: [4, 4], vertical: true).frame(width: 1.5) }
        }
        .foregroundStyle(gold)
        .background(RadialGradient(colors: [Color(hex: p.bg), Color(hex: p.bg2)], center: UnitPoint(x: 0.45, y: 0.4), startRadius: 0, endRadius: 380 * 0.75))
        .overlay { doubleFrame(gold).padding(13) }
        .overlay { H5Glitter() }
        .punched(linerPunches)
    }

    private var linerPunches: [Punch] {
        let s = t.template.size
        let cut = s.width - 68
        return [
            Punch(x: 0, y: 0, r: 16), Punch(x: s.width, y: 0, r: 16),
            Punch(x: 0, y: s.height, r: 16), Punch(x: s.width, y: s.height, r: 16),
            Punch(x: cut, y: 0, r: 7), Punch(x: cut, y: s.height, r: 7),
        ]
    }

    // MARK: 拱顶马戏券

    private func circus(_ p: Pal) -> some View {
        let ink = Color(hex: p.ink)
        let paperFill = LinearGradient(colors: [Color(hex: p.paper), paper2(p)], startPoint: .top, endPoint: .bottom)
        let arch = UnevenRoundedRectangle(topLeadingRadius: 116, bottomLeadingRadius: 8, bottomTrailingRadius: 8, topTrailingRadius: 116)
        return HStack(alignment: .top, spacing: 0) {
            VStack(spacing: 10) {
                Text(t.title.uppercased())
                    .font(.h5Serif(rem(1.62)))
                    .trackingEm(0.03, size: rem(1.62))
                    .lineSpacing(-4)
                    .lineLimit(2)
                    .frame(maxWidth: 150)
                H5Photo()
                    .aspectRatio(3 / 4, contentMode: .fit)
                    .clipShape(RoundedRectangle(cornerRadius: 6))
                    .overlay(RoundedRectangle(cornerRadius: 6).strokeBorder(ink, lineWidth: 3))
                    .padding(4)
                    .background(Color(hex: p.paper), in: RoundedRectangle(cornerRadius: 9))
                    .overlay(RoundedRectangle(cornerRadius: 10).inset(by: -0.5).strokeBorder(ink, lineWidth: 1))
                    .frame(width: (232 - 44) * 0.86)
                Text(t.mood).font(.h5Sans(rem(0.64))).italic().lineLimit(2)
            }
            .multilineTextAlignment(.center)
            .padding(EdgeInsets(top: 46, leading: 22, bottom: 22, trailing: 22))
            .frame(width: 232)
            .frame(maxHeight: .infinity, alignment: .top)
            .background(paperFill, in: arch)
            .overlay {
                UnevenRoundedRectangle(topLeadingRadius: 109, bottomLeadingRadius: 4, bottomTrailingRadius: 4, topTrailingRadius: 109)
                    .strokeBorder(ink, lineWidth: 3).padding(7)
            }
            .overlay {
                UnevenRoundedRectangle(topLeadingRadius: 102, bottomLeadingRadius: 2, bottomTrailingRadius: 2, topTrailingRadius: 102)
                    .strokeBorder(ink, lineWidth: 1).padding(14)
            }

            VStack(spacing: 9) {
                LIcon(spec.icons[0], size: 26)
                Text("ADMIT ONE").font(.h5Serif(rem(1.05))).trackingEm(0.04, size: rem(1.05)).lineLimit(1)
                LIcon(spec.icons[1], size: 46).foregroundStyle(Color(hex: p.accent))
                Text(t.seat)
                    .font(.h5Serif(rem(1.05)))
                    .trackingEm(0.04, size: rem(1.05))
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                    .padding(.bottom, 6)
                    .overlay(alignment: .bottom) { Rectangle().fill(ink).frame(height: 2) }
                stubLine("DATE:", t.date)
                stubLine("SECTION:", t.place)
            }
            .padding(EdgeInsets(top: 18, leading: 12, bottom: 18, trailing: 16))
            .frame(width: 112)
            .frame(maxHeight: .infinity, alignment: .top)
            .background(paperFill)
            .overlay(alignment: .leading) { H5Dash(color: ink.opacity(0.55), lineWidth: 2, dash: [5, 4], vertical: true).frame(width: 2) }
            .mask(ScallopRight(step: 15, radius: 5).fill(style: FillStyle(eoFill: true)))
            .padding(.top, 34)
        }
        .foregroundStyle(ink)
    }

    private func stubLine(_ key: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(key).font(.h5Mono(rem(0.5))).trackingEm(0.06, size: rem(0.5))
            Text(value)
                .font(.h5Mono(rem(0.56)))
                .fontWeight(.medium)
                .lineLimit(2)
                .padding(.bottom, 1)
                .frame(maxWidth: .infinity, alignment: .leading)
                .overlay(alignment: .bottom) { Rectangle().frame(height: 1) }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: 六角徽章

    private func badge(_ p: Pal) -> some View {
        let paper = Color(hex: p.paper)
        let octagon = H5Polygon(points: [
            CGPoint(x: 0.3, y: 0), CGPoint(x: 0.7, y: 0), CGPoint(x: 1, y: 0.18), CGPoint(x: 1, y: 0.82),
            CGPoint(x: 0.7, y: 1), CGPoint(x: 0.3, y: 1), CGPoint(x: 0, y: 0.82), CGPoint(x: 0, y: 0.18),
        ])
        let stitch = H5Polygon(points: [
            CGPoint(x: 0.315, y: 0.026), CGPoint(x: 0.685, y: 0.026), CGPoint(x: 0.966, y: 0.196), CGPoint(x: 0.966, y: 0.804),
            CGPoint(x: 0.685, y: 0.974), CGPoint(x: 0.315, y: 0.974), CGPoint(x: 0.034, y: 0.804), CGPoint(x: 0.034, y: 0.196),
        ])
        return VStack(spacing: 0) {
            VStack(spacing: 3) {
                LIcon(spec.icons[0], size: 28)
                Text(t.place).font(.h5Mono(rem(0.54))).trackingEm(0.2, size: rem(0.54)).lineLimit(1)
                Text(t.title.uppercased()).font(.h5Serif(rem(1.4))).lineLimit(2)
            }
            .foregroundStyle(paper)
            .padding(EdgeInsets(top: 24, leading: 56, bottom: 36, trailing: 56))
            .frame(maxWidth: .infinity)
            .background(Color(hex: p.a))

            HStack {
                LIcon(spec.icons[0], size: 26)
                Spacer()
                LIcon(spec.icons[1], size: 26)
            }
            .foregroundStyle(Color(hex: p.a))
            .padding(.horizontal, 24)
            .frame(height: 50)
            .frame(maxWidth: .infinity)
            .background(Color(hex: p.b))
            .overlay {
                H5Photo()
                    .frame(width: 102, height: 102)
                    .clipShape(RoundedRectangle(cornerRadius: 3))
                    .padding(5)
                    .background(paper, in: RoundedRectangle(cornerRadius: 6))
                    .shadow(color: .black.opacity(0.2), radius: 5, y: 4)
            }
            .zIndex(1)

            VStack(spacing: 6) {
                Text(t.mood).font(.h5Serif(rem(0.98))).opacity(0.9).lineLimit(2)
                line("NO.", t.seat)
                line("ISSUED:", t.date)
            }
            .multilineTextAlignment(.center)
            .padding(EdgeInsets(top: 68, leading: 68, bottom: 46, trailing: 68))
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        }
        .foregroundStyle(Color(hex: p.ink))
        .background(paper)
        .overlay { stitch.stroke(Color(hex: p.b), style: StrokeStyle(lineWidth: 1.5, dash: [5, 4])) }
        .overlay { H5Glitter() }
        .clipShape(octagon)
    }

    // MARK: 画廊两段券

    private func gallery(_ p: Pal) -> some View {
        let gold = Color(hex: p.gold)
        let fill = RadialGradient(colors: [Color(hex: p.bg), Color(hex: p.bg2)], center: UnitPoint(x: 0.5, y: 0.3), startRadius: 0, endRadius: 360 * 0.8)
        return VStack(spacing: 0) {
            VStack(spacing: 12) {
                Text(t.title).font(.h5Serif(rem(1.5))).trackingEm(0.02, size: rem(1.5)).lineLimit(1).minimumScaleFactor(0.7)
                HStack(spacing: 12) {
                    H5Photo()
                        .aspectRatio(16 / 9, contentMode: .fit)
                        .clipShape(RoundedRectangle(cornerRadius: 4))
                        .overlay(RoundedRectangle(cornerRadius: 4).strokeBorder(gold, lineWidth: 3))
                    Text(galleryBig).font(.h5Serif(rem(2.2))).lineLimit(1).minimumScaleFactor(0.6).frame(width: 84)
                }
            }
            .padding(EdgeInsets(top: 24, leading: 26, bottom: 18, trailing: 26))
            .frame(maxWidth: .infinity)
            .background(fill)
            .overlay { doubleFrame(gold, edges: [.top, .leading, .trailing]).padding(EdgeInsets(top: 9, leading: 9, bottom: 0, trailing: 9)) }

            HStack(spacing: 10) {
                LIcon(spec.icons[0], size: 28).frame(width: 40)
                VStack(alignment: .leading, spacing: 3) {
                    Text("ADMIT ONE").font(.h5Serif(rem(1.25))).trackingEm(0.04, size: rem(1.25))
                    Group {
                        Text(t.mood.uppercased())
                        Text(t.place.uppercased())
                    }
                    .font(.h5Mono(rem(0.62)))
                    .trackingEm(0.06, size: rem(0.62))
                    .lineLimit(1)
                    line("DATE:", t.date).padding(.top, 3)
                }
                .foregroundStyle(Color(hex: p.bg))
                .padding(.vertical, 10)
                .padding(.horizontal, 14)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color(hex: p.paper))
                .overlay(alignment: .trailing) { H5Dash(color: Color(hex: p.bg, alpha: 0.5), lineWidth: 2, dash: [5, 4], vertical: true).frame(width: 2) }
                LIcon(spec.icons[1], size: 28).frame(width: 40)
            }
            .padding(EdgeInsets(top: 16, leading: 22, bottom: 22, trailing: 22))
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(fill)
            .overlay(alignment: .top) { H5Dash(color: gold, lineWidth: 1.5, dash: [4, 4]).frame(height: 1.5) }
            .overlay { doubleFrame(gold, edges: [.bottom, .leading, .trailing]).padding(EdgeInsets(top: 0, leading: 9, bottom: 9, trailing: 9)) }
        }
        .foregroundStyle(gold)
        .overlay { H5Glitter() }
        .punched(galleryPunches)
    }

    private var galleryBig: String {
        let parts = t.date.split(whereSeparator: { !$0.isNumber })
        if parts.count >= 3, parts[0].count == 4 { return "\(parts[1]).\(parts[2])" }
        return String(t.date.prefix(5))
    }

    private var galleryPunches: [Punch] {
        let s = t.template.size
        let y = s.height * 0.6
        return [Punch(x: 0, y: y, r: 11), Punch(x: s.width, y: y, r: 11)]
    }
}

/// 只描指定边的矩形（双线框的一圈）
private struct DoubleEdge: Shape {
    let edges: Edge.Set
    let inset: CGFloat

    func path(in rect: CGRect) -> Path {
        let r = rect.insetBy(dx: inset, dy: 0)
        let top = edges.contains(.top) ? r.minY + inset : r.minY
        let bottom = edges.contains(.bottom) ? r.maxY - inset : r.maxY
        var p = Path()
        if edges.contains(.top) { p.move(to: CGPoint(x: r.minX, y: top)); p.addLine(to: CGPoint(x: r.maxX, y: top)) }
        if edges.contains(.bottom) { p.move(to: CGPoint(x: r.minX, y: bottom)); p.addLine(to: CGPoint(x: r.maxX, y: bottom)) }
        if edges.contains(.leading) { p.move(to: CGPoint(x: r.minX, y: top)); p.addLine(to: CGPoint(x: r.minX, y: bottom)) }
        if edges.contains(.trailing) { p.move(to: CGPoint(x: r.maxX, y: top)); p.addLine(to: CGPoint(x: r.maxX, y: bottom)) }
        return p
    }
}

/// 右缘一排半圆花边
struct ScallopRight: Shape {
    var step: CGFloat = 15
    var radius: CGFloat = 5

    func path(in rect: CGRect) -> Path {
        var p = Path(rect)
        var y = rect.minY + step / 2
        while y < rect.maxY {
            p.addEllipse(in: CGRect(x: rect.maxX - radius, y: y - radius, width: radius * 2, height: radius * 2))
            y += step
        }
        return p
    }
}

// MARK: - 胶带相片票 sn-*

struct TkSnap: View {
    @Environment(\.ticket) private var t
    let spec: H5Family.Snap

    private var colors: (bg: UInt32, ink: UInt32, mute: UInt32) {
        switch spec.pal {
        case "blush": (0xF2E3D9, 0x2A2420, 0xB3A69C)
        case "moss": (0x1F271B, 0xF3F0E4, 0xA9AD98)
        case "sky": (0xDBE5EA, 0x22323C, 0x8FA0AA)
        case "night": (0x1D2232, 0xEEF0F6, 0x9AA0B5)
        case "cream": (0xF1E9D6, 0x3A2E22, 0xAB9A82)
        default: (0xD8D3C2, 0x2E2E26, 0x9B9683)
        }
    }

    private var flip: Bool { spec.photoPos == "right" }

    var body: some View {
        let c = colors
        let size = t.template.size
        let cardW = size.width - 20
        let holeX = flip ? 150 + 13 : cardW - 150 - 13
        let radius: CGFloat = spec.rounded ? 16 : 0

        HStack(spacing: 0) {
            if flip { info(c) } else { shot }
            Color.clear.frame(width: 26)
            if flip { shot } else { info(c) }
        }
        .foregroundStyle(Color(hex: c.ink))
        .frame(width: cardW, height: size.height - 20)
        .background(Color(hex: c.bg))
        .overlay { H5Glitter() }
        .clipShape(RoundedRectangle(cornerRadius: radius, style: .continuous))
        .mask {
            Canvas { ctx, s in
                ctx.fill(Path(CGRect(origin: .zero, size: s)), with: .color(.black))
                ctx.blendMode = .clear
                var y: CGFloat = 0
                while y <= s.height + 6 {
                    ctx.fill(Path(ellipseIn: CGRect(x: holeX - 6, y: y - 6, width: 12, height: 12)), with: .color(.black))
                    y += 22
                }
            }
        }
        .padding(10)
        .overlay { tapes }
        .frame(width: size.width, height: size.height)
    }

    private var shot: some View {
        H5Photo()
            .aspectRatio(4 / 3, contentMode: .fit)
            .clipShape(RoundedRectangle(cornerRadius: spec.rounded ? 10 : 2, style: .continuous))
            .padding(.vertical, 14)
            .padding(flip ? .trailing : .leading, 14)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func info(_ c: (bg: UInt32, ink: UInt32, mute: UInt32)) -> some View {
        let mute = Color(hex: c.mute)
        let align: HorizontalAlignment = flip ? .leading : .trailing
        return VStack(alignment: align, spacing: 7) {
            HStack(spacing: 6) {
                if flip { Circle().fill(mute).frame(width: 7, height: 7) }
                Text("TICKET")
                if !flip { Circle().fill(mute).frame(width: 7, height: 7) }
            }
            .font(.h5Mono(rem(0.5)))
            .fontWeight(.medium)
            .trackingEm(0.22, size: rem(0.5))
            .foregroundStyle(mute)
            titleText
            if !t.mood.isEmpty {
                Text(t.mood).font(.h5Sans(rem(0.72))).trackingEm(0.1, size: rem(0.72)).opacity(0.9).lineLimit(2)
            }
            VStack(alignment: align, spacing: 1) {
                Text(t.seat).font(.h5Lora(rem(0.78))).fontWeight(.semibold)
                Text(t.place).font(.h5Lora(rem(0.6))).fontWeight(.semibold)
                Text(t.date).font(.h5Lora(rem(0.6))).fontWeight(.semibold)
            }
            .trackingEm(0.14, size: rem(0.6))
            .foregroundStyle(mute)
            .lineLimit(1)
            Spacer(minLength: 0)
            VStack(spacing: 1) {
                H5Bars(color: Color(hex: 0x111111), pattern: [2, 1, 1, 2, 3, 1, 1, 3])
                    .frame(width: 108, height: 26)
                    .padding(2)
                    .background(.white)
                Text("ADMIT ONE").font(.h5Mono(rem(0.42))).trackingEm(0.12, size: rem(0.42))
            }
            .padding(.top, 4)
            .frame(maxWidth: .infinity)
        }
        .multilineTextAlignment(flip ? .leading : .trailing)
        .padding(flip ? EdgeInsets(top: 16, leading: 18, bottom: 12, trailing: 2) : EdgeInsets(top: 16, leading: 2, bottom: 12, trailing: 16))
        .frame(width: 150, alignment: Alignment(horizontal: align, vertical: .top))
        .frame(maxHeight: .infinity)
    }

    @ViewBuilder
    private var titleText: some View {
        switch spec.font {
        case "script":
            Text(t.title).font(.h5Script(rem(1.32))).lineSpacing(2).lineLimit(3)
        case "serif":
            Text(t.title).font(.h5Lora(rem(1.08))).fontWeight(.bold).trackingEm(0.03, size: rem(1.08)).lineLimit(3)
        default:
            Text(t.title).font(.h5Sans(rem(1.16))).fontWeight(.bold).trackingEm(0.08, size: rem(1.16)).lineLimit(3)
        }
    }

    @ViewBuilder
    private var tapes: some View {
        if spec.tape == "kraft" {
            ZStack {
                tape.rotationEffect(.degrees(38)).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing).offset(x: 8, y: 2)
                tape.rotationEffect(.degrees(38)).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomLeading).offset(x: -8, y: -2)
            }
        } else if spec.tape == "grid" {
            ZStack {
                tape.rotationEffect(.degrees(-38)).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading).offset(x: -8, y: 2)
                tape.rotationEffect(.degrees(-38)).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing).offset(x: 8, y: -2)
            }
        }
    }

    private var tape: some View {
        Group {
            if spec.tape == "kraft" {
                ZStack {
                    Color(red: 224 / 255, green: 202 / 255, blue: 150 / 255).opacity(0.85)
                    H5Stripes(color: .white, angle: 90, line: 2, period: 5, opacity: 0.12)
                }
            } else {
                ZStack {
                    Color(red: 238 / 255, green: 238 / 255, blue: 228 / 255).opacity(0.9)
                    H5Grid(color: Color(red: 120 / 255, green: 130 / 255, blue: 110 / 255), step: 5, opacity: 0.45)
                }
            }
        }
        .frame(width: 62, height: 20)
        .shadow(color: .black.opacity(0.12), radius: 1, y: 1)
    }
}
