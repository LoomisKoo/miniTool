import SwiftUI

/// 竖向图案条纹：H5 里的 --ps-pat / tp-band 等装饰
enum H5Pattern {
    case dots(spacing: CGFloat, radius: CGFloat)
    case diag(angle: Double, period: CGFloat, line: CGFloat)
    case stripes(period: CGFloat)
    case rings(center: UnitPoint, period: CGFloat)
    case grid(step: CGFloat)
    case chevron(step: CGFloat)
    /// linear-gradient(135deg, c 46%, transparent 46% 54%, c 54%) 平铺：整面着色、斜向镂空细线
    case slash(tile: CGFloat)
    /// radial-gradient(circle, transparent r, c, transparent) 平铺：小圆环
    case ringDots(spacing: CGFloat)

    @ViewBuilder
    func view(color: Color, opacity: Double) -> some View {
        switch self {
        case let .dots(spacing, radius): H5Dots(color: color, spacing: spacing, radius: radius, opacity: opacity)
        case let .diag(angle, period, line): H5Stripes(color: color, angle: angle, line: line, period: period, opacity: opacity)
        case let .stripes(period): H5Stripes(color: color, angle: 90, line: 1, period: period, opacity: opacity)
        case let .rings(center, period): H5Rings(color: color, center: center, period: period, opacity: opacity)
        case let .grid(step): H5Grid(color: color, step: step, opacity: opacity)
        case let .chevron(step): H5Chevron(color: color, step: step, opacity: opacity)
        case let .slash(tile):
            ZStack {
                color
                H5Stripes(color: .black, angle: 135, line: tile * 1.414 * 0.08, period: tile * 0.7071, opacity: 1)
                    .blendMode(.destinationOut)
            }
            .compositingGroup()
            .opacity(opacity)
        case let .ringDots(spacing):
            Canvas { ctx, size in
                var y = spacing / 2
                while y < size.height {
                    var x = spacing / 2
                    while x < size.width {
                        ctx.stroke(Path(ellipseIn: CGRect(x: x - 2.9, y: y - 2.9, width: 5.8, height: 5.8)), with: .color(color), lineWidth: 0.9)
                        x += spacing
                    }
                    y += spacing
                }
            }
            .opacity(opacity)
        }
    }
}

// MARK: - 图案通票 trip-*

struct TkTrip: View {
    @Environment(\.ticket) private var t
    let spec: H5Family.Trip

    private struct Pal {
        var info: UInt32, accent: UInt32, band: UInt32, ink: UInt32
        var pattern: H5Pattern = .dots(spacing: 9, radius: 1.1)
        var round = false
        var frame: UInt32 = 0xFDFAF4
    }

    private var pal: Pal {
        switch spec.pal {
        case "sakura": Pal(info: 0xFDF6F7, accent: 0xD98BA0, band: 0xA92B3D, ink: 0x3A2027)
        case "desert": Pal(info: 0xFDF5E8, accent: 0xC9893C, band: 0x8A4A1E, ink: 0x3F2C17, pattern: .slash(tile: 12))
        case "jungle": Pal(info: 0xF1F7F1, accent: 0x3F7A52, band: 0x14402C, ink: 0x1F3325, pattern: .diag(angle: 45, period: 8, line: 1))
        case "aurora": Pal(info: 0xF1F1FB, accent: 0x6A6AC9, band: 0x20264F, ink: 0x232443, pattern: .rings(center: UnitPoint(x: 0.5, y: 1.3), period: 13))
        case "lagoon": Pal(info: 0xEEF7FB, accent: 0x3F8FB5, band: 0x155A75, ink: 0x173742, pattern: .stripes(period: 7))
        case "safari": Pal(info: 0xF8F3E6, accent: 0xA8763C, band: 0x5C4A1E, ink: 0x38301C, pattern: .dots(spacing: 7, radius: 1.5))
        case "mono": Pal(info: 0xF4F4F2, accent: 0x3A3A38, band: 0x14140F, ink: 0x26261F, round: true, frame: 0xFBFBF9)
        case "coral": Pal(info: 0xFDF3EE, accent: 0xD0653F, band: 0x8C2F1C, ink: 0x40241A, pattern: .grid(step: 12))
        case "mint": Pal(info: 0xEEF8F2, accent: 0x3F9A76, band: 0x0F4A37, ink: 0x1C3A2E, pattern: .slash(tile: 12), round: true, frame: 0xFBFDFB)
        case "cobalt": Pal(info: 0xEEF3FB, accent: 0x3F6CC9, band: 0x17306E, ink: 0x1B2743, pattern: .stripes(period: 7))
        case "sand": Pal(info: 0xFAF4E6, accent: 0xC2A05A, band: 0x6B4A1C, ink: 0x3B3018, pattern: .dots(spacing: 8, radius: 1.4))
        case "plum": Pal(info: 0xF8F2FA, accent: 0x8A5AA8, band: 0x431A5C, ink: 0x2F1C3A, pattern: .rings(center: UnitPoint(x: 0.5, y: 1.3), period: 13), round: true, frame: 0xFDFBFE)
        case "neon": Pal(info: 0xFBF2FD, accent: 0xB558D8, band: 0x3D0D52, ink: 0x33163F, pattern: .dots(spacing: 8, radius: 1.2))
        case "fest": Pal(info: 0xFDF4E6, accent: 0xE08A2C, band: 0x8C3A10, ink: 0x3F2A12, pattern: .slash(tile: 12))
        case "rock": Pal(info: 0xF2F2F2, accent: 0xB5332C, band: 0x14100F, ink: 0x26201C, pattern: .diag(angle: 45, period: 7, line: 1))
        case "jazz": Pal(info: 0xF5F3EC, accent: 0xB99A56, band: 0x14233C, ink: 0x232A38, pattern: .dots(spacing: 7, radius: 1.5))
        case "electro": Pal(info: 0xEEFAFB, accent: 0x2F9AA8, band: 0x0B3B4A, ink: 0x12333D, pattern: .stripes(period: 8))
        case "folk": Pal(info: 0xFAF4EA, accent: 0xA8763C, band: 0x4A3418, ink: 0x33281A, pattern: .grid(step: 11))
        case "fjord": Pal(info: 0xEEF4F8, accent: 0x5B8BAB, band: 0x1D3B4E, ink: 0x23343F, pattern: .grid(step: 9))
        case "volcano": Pal(info: 0xFBF1EC, accent: 0xC0522C, band: 0x6D1F14, ink: 0x3A211A, pattern: .slash(tile: 12))
        case "tea": Pal(info: 0xF4F8F0, accent: 0x6F8F4A, band: 0x33501F, ink: 0x27331D, pattern: .diag(angle: 45, period: 8, line: 1))
        case "grunge": Pal(info: 0xF4F3F1, accent: 0x8A8F92, band: 0x23262A, ink: 0x1E2124, pattern: .diag(angle: 135, period: 6, line: 2))
        case "ember": Pal(info: 0xFDF2EF, accent: 0xE0704A, band: 0x7A2A1E, ink: 0x3B211B, pattern: .dots(spacing: 10, radius: 1.1))
        case "drum": Pal(info: 0xFAF3E8, accent: 0xA06A34, band: 0x4A2F16, ink: 0x332417, pattern: .ringDots(spacing: 14))
        default: Pal(info: 0xFBF7F0, accent: 0xC07A52, band: 0x2F4A3C, ink: 0x2F2A22)
        }
    }

    private var labels: [String] {
        t.template.category == .concert ? ["VENUE:", "DATE:", "SEAT:"] : ["DESTINATION:", "DATE:", "TICKET NO:"]
    }

    private var isTop: Bool { spec.layout == "top" || spec.layout == "duo" }
    private var shotWidth: CGFloat {
        switch spec.layout {
        case "tall": 126
        case "wide": 150
        default: 118
        }
    }
    private var bandWidth: CGFloat { spec.layout == "side" ? 50 : 46 }

    var body: some View {
        let p = pal
        let size = t.template.size
        Group {
            if isTop { topLayout(p) } else { sideLayout(p) }
        }
        .foregroundStyle(Color(hex: p.ink))
        .frame(width: size.width, height: size.height)
        .background(Color(hex: p.info))
        .overlay { H5Glitter() }
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(Color(hex: 0x5A503C, alpha: 0.16), lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .punched(punches(size))
    }

    private func punches(_ size: CGSize) -> [Punch] {
        if isTop {
            return [Punch(x: 0, y: 168, r: 8), Punch(x: size.width, y: 168, r: 8)]
        }
        let flip = spec.pos == "left"
        let d1 = flip ? bandWidth : shotWidth
        let d2 = size.width - (flip ? shotWidth : bandWidth)
        return [d1, d2].flatMap { [Punch(x: $0, y: 0, r: 8), Punch(x: $0, y: size.height, r: 8)] }
    }

    private func sideLayout(_ p: Pal) -> some View {
        let flip = spec.pos == "left"
        return HStack(spacing: 0) {
            if flip { band(p).frame(width: bandWidth) } else { shot(p).frame(width: shotWidth) }
            info(p, twoColumn: false)
            if flip { shot(p).frame(width: shotWidth) } else { band(p).frame(width: bandWidth) }
        }
    }

    private func topLayout(_ p: Pal) -> some View {
        VStack(spacing: 0) {
            HStack(spacing: 3) {
                H5Photo(slot: 0)
                if spec.layout == "duo" { H5Photo(slot: 1) }
            }
            .frame(height: 168)
            .clipped()
            .background(Color(hex: p.band))
            HStack(spacing: 0) {
                info(p, twoColumn: true)
                band(p)
                    .frame(width: 46)
                    .overlay(alignment: .leading) { H5Dash(color: .black.opacity(0.16), vertical: true).frame(width: 1) }
            }
        }
    }

    private func shot(_ p: Pal) -> some View {
        let shape = p.round ? AnyShape(Ellipse()) : AnyShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        return H5Photo()
            .clipShape(shape)
            .padding(p.round ? 4 : 5)
            .background(Color(hex: p.frame), in: shape)
            .shadow(color: Color(hex: 0x3C1E0F, alpha: 0.22), radius: 6, y: 4)
            .padding(10)
            .frame(maxHeight: .infinity)
            .background(Color(hex: p.accent))
    }

    private func band(_ p: Pal) -> some View {
        VStack(spacing: 10) {
            LIcon(spec.icons[0], size: 18)
            LIcon(spec.icons[1], size: 18)
        }
        .foregroundStyle(.white.opacity(0.94))
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background {
            ZStack {
                Color(hex: p.band)
                p.pattern.view(color: .white, opacity: 0.2 * 0.85)
            }
        }
    }

    private func kv(_ key: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(key)
                .font(.h5Mono(rem(0.49)))
                .trackingEm(0.12, size: rem(0.49))
                .foregroundStyle(Color(hex: 0x8A8172))
            Text(value.isEmpty ? " " : value)
                .font(.h5Mono(rem(0.73)))
                .fontWeight(.semibold)
                .lineLimit(2)
                .padding(.bottom, 4)
                .frame(maxWidth: .infinity, alignment: .leading)
                .overlay(alignment: .bottom) { Rectangle().fill(Color(hex: 0x463A2C, alpha: 0.26)).frame(height: 1) }
        }
    }

    @ViewBuilder
    private func info(_ p: Pal, twoColumn: Bool) -> some View {
        let l = labels
        VStack(alignment: .leading, spacing: 9) {
            if !t.title.isEmpty {
                Text(t.title).font(.h5Serif(rem(1.16))).fontWeight(.bold).lineLimit(2)
            }
            if twoColumn {
                HStack(alignment: .top, spacing: 12) {
                    kv(l[0], t.place)
                    kv(l[1], t.date)
                }
                HStack(alignment: .top, spacing: 12) {
                    kv(l[2], t.seat)
                    Color.clear.frame(height: 1)
                }
            } else {
                Spacer(minLength: 0)
                kv(l[0], t.place)
                Spacer(minLength: 0)
                kv(l[1], t.date)
                Spacer(minLength: 0)
                kv(l[2], t.seat)
                Spacer(minLength: 0)
            }
            if !t.mood.isEmpty {
                Text(t.mood).font(.h5Sans(rem(0.69))).italic().foregroundStyle(Color(hex: 0x7A7062)).lineLimit(2)
            }
        }
        .padding(EdgeInsets(top: 14, leading: 13, bottom: twoColumn ? 15 : 14, trailing: 13))
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background { H5Dots(color: Color(hex: p.ink), spacing: 11, radius: 1.05, opacity: 0.11) }
    }
}

// MARK: - 竖版海报 pstr-*

struct TkPoster: View {
    @Environment(\.ticket) private var t
    let pal: String

    private var spec: (a: UInt32, strip: UInt32, pattern: H5Pattern) {
        switch pal {
        case "mono": (0x2A2A28, 0x141412, .dots(spacing: 7, radius: 1.4))
        case "sunset": (0x4A2140, 0x2B1230, .slash(tile: 13))
        case "ocean": (0x0D3550, 0x07263C, .stripes(period: 7))
        case "forest": (0x173A2B, 0x0D2A1E, .diag(angle: 45, period: 8, line: 1))
        case "neon": (0x3A0F4A, 0x1D0730, .rings(center: UnitPoint(x: 0.5, y: 1.3), period: 13))
        case "sepia": (0x4A3520, 0x2E2013, .grid(step: 12))
        case "crimson": (0x6B1620, 0x3D0C14, .slash(tile: 12))
        case "moss": (0x24402A, 0x16301C, .diag(angle: 45, period: 8, line: 1))
        case "amber": (0x6A4413, 0x43290A, .dots(spacing: 10, radius: 1.1))
        default: (0x1B2B3A, 0x14202C, .dots(spacing: 10, radius: 1.1))
        }
    }

    var body: some View {
        let s = spec
        VStack(spacing: 0) {
            ZStack(alignment: .bottomLeading) {
                H5Photo().frame(width: 292, height: 292 * 4 / 3)
                VStack(alignment: .leading, spacing: 4) {
                    Text(t.title).font(.h5Serif(rem(1.62))).fontWeight(.bold)
                    Text(t.place).font(.h5Sans(rem(0.72))).foregroundStyle(.white.opacity(0.78))
                }
                .lineLimit(1)
                .padding(EdgeInsets(top: 46, leading: 18, bottom: 13, trailing: 18))
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(LinearGradient(colors: [.clear, .black.opacity(0.78)], startPoint: .top, endPoint: .bottom))
            }
            VStack(alignment: .leading, spacing: 7) {
                HStack {
                    Text(t.date)
                    Spacer(minLength: 10)
                    Text(t.seat)
                }
                .font(.h5Mono(rem(0.66)))
                Text(t.mood)
                    .font(.h5Sans(rem(0.72)))
                    .italic()
                    .foregroundStyle(.white.opacity(0.72))
            }
            .lineLimit(1)
            .padding(EdgeInsets(top: 14, leading: 18, bottom: 16, trailing: 18))
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .background {
                ZStack {
                    Color(hex: s.strip)
                    s.pattern.view(color: .white, opacity: 0.2 * 0.85)
                }
            }
        }
        .foregroundStyle(.white)
        .frame(width: 292, height: 457)
        .background(Color(hex: s.a))
        .overlay { H5Glitter() }
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(.white.opacity(0.1), lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

// MARK: - 邮票 stmp-*

struct TkStamp: View {
    @Environment(\.ticket) private var t
    let spec: H5Family.Stamp

    private struct Pal { let bg, bg2, ink, muted, accent: UInt32 }

    private var pal: Pal {
        switch spec.pal {
        case "ruby": Pal(bg: 0xFDF7F3, bg2: 0xF4E7E1, ink: 0x3A2320, muted: 0x8A6B63, accent: 0xB0382B)
        case "indigo": Pal(bg: 0xF6F8FC, bg2: 0xE7ECF5, ink: 0x1F2A3D, muted: 0x5F6C80, accent: 0x2C4A80)
        case "pine": Pal(bg: 0xF5F9F6, bg2: 0xE6EFE9, ink: 0x1D2F28, muted: 0x5C7268, accent: 0x276B52)
        case "ochre": Pal(bg: 0xFCF7EB, bg2: 0xF3E9D2, ink: 0x3A2D16, muted: 0x7D6A45, accent: 0x9A6A1E)
        case "ink": Pal(bg: 0xF7F7F5, bg2: 0xE8E8E5, ink: 0x17181A, muted: 0x5D6066, accent: 0x2A2C30)
        case "plum": Pal(bg: 0xFBF6F9, bg2: 0xF0E4EC, ink: 0x33202E, muted: 0x77596D, accent: 0x7C2F5C)
        case "lake": Pal(bg: 0xF3F9FB, bg2: 0xE2EEF3, ink: 0x1B2F38, muted: 0x567582, accent: 0x1F6F8B)
        default: Pal(bg: 0xFBF5EF, bg2: 0xF2E5D8, ink: 0x3A2A1E, muted: 0x7D6450, accent: 0xA5542C)
        }
    }

    private var icon: String {
        switch spec.variant {
        case "arch": "sun"
        case "seal": "award"
        case "crest": "compass"
        case "denom": "gem"
        case "coords": "ruler"
        case "banner": "flag"
        case "coil": "mailbox"
        case "oval": "user-round"
        case "gate": "door-open"
        case "vignette": "camera"
        case "ledger": "book-open"
        default: "stamp"
        }
    }

    private var line: Color { Color(hex: pal.ink, alpha: spec.pal == "ink" ? 0.24 : 0.22) }
    private var muted: Color { Color(hex: pal.muted) }
    private var accent: Color { Color(hex: pal.accent) }
    private var bg: Color { Color(hex: pal.bg) }

    var body: some View {
        let size = t.template.size
        let p = pal
        Group {
            switch spec.variant {
            case "seal": seal
            case "coords": coords
            case "gate": gate
            case "ledger": ledger
            default: face
            }
        }
        .foregroundStyle(Color(hex: p.ink))
        .frame(width: size.width, height: size.height, alignment: .top)
        .background(LinearGradient(colors: [Color(hex: p.bg), Color(hex: p.bg2)], startPoint: .top, endPoint: .bottom))
        .modifier(StampEdge(coil: spec.variant == "coil"))
    }

    // MARK: 零件

    private func head(_ right: AnyView? = nil) -> some View {
        HStack(spacing: 8) {
            Text("CHINA POST").fixedSize()
            Spacer(minLength: 0)
            if let right { right } else { Text(t.date).lineLimit(1) }
        }
        .font(.h5Mono(rem(0.5)))
        .trackingEm(0.16, size: rem(0.5))
        .foregroundStyle(muted)
    }

    private var val: AnyView {
        AnyView(
            Text(t.seat)
                .fontWeight(.bold)
                .trackingEm(0.06, size: rem(0.5))
                .foregroundStyle(accent)
                .lineLimit(1)
                .padding(.horizontal, 6)
                .padding(.vertical, 1)
                .overlay(RoundedRectangle(cornerRadius: 3).strokeBorder(line, lineWidth: 1))
                .fixedSize()
        )
    }

    private func photo(_ ratio: CGFloat, radius: CGFloat = 2, inset: Bool = true) -> some View {
        H5Photo()
            .aspectRatio(ratio, contentMode: .fit)
            .frame(maxWidth: .infinity)
            .clipShape(RoundedRectangle(cornerRadius: radius))
            .overlay {
                if inset { RoundedRectangle(cornerRadius: radius).strokeBorder(Color(hex: 0x787060, alpha: 0.4), lineWidth: 1) }
            }
    }

    private var title: some View {
        Text(t.title)
            .font(.h5Serif(rem(1.14)))
            .fontWeight(.medium)
            .trackingEm(0.02, size: rem(1.14))
            .lineLimit(2)
    }

    private var place: some View {
        Text(t.place)
            .font(.h5Mono(rem(0.54)))
            .trackingEm(0.11, size: rem(0.54))
            .foregroundStyle(muted)
            .lineLimit(2)
    }

    private var mood: some View {
        Text(t.mood)
            .font(.h5Sans(rem(0.66)))
            .italic()
            .lineSpacing(rem(0.66) * 0.3)
            .foregroundStyle(muted)
            .lineLimit(2)
    }

    private func solo(_ text: String? = nil) -> some View {
        Text(text ?? t.seat)
            .font(.h5Mono(rem(0.52)))
            .trackingEm(0.16, size: rem(0.52))
            .foregroundStyle(accent)
            .lineLimit(1)
            .frame(maxWidth: .infinity)
            .padding(.top, 6)
            .overlay(alignment: .top) { H5Dash(color: line, dash: [3, 3]).frame(height: 1) }
    }

    private var rule: some View {
        LinearGradient(colors: [.clear, line, .clear], startPoint: .leading, endPoint: .trailing).frame(height: 1)
    }

    @ViewBuilder
    private var flair: some View {
        if spec.flair == "icon" {
            LIcon(icon, size: 15).foregroundStyle(accent).opacity(0.9).frame(maxWidth: .infinity)
        } else if spec.flair == "rule" {
            rule
        }
    }

    private func centered<V: View>(@ViewBuilder _ content: () -> V) -> some View {
        VStack(spacing: 3) { content() }
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity)
    }

    // MARK: 结构

    @ViewBuilder
    private var face: some View {
        VStack(alignment: .leading, spacing: 7) {
            switch spec.variant {
            case "column":
                head(val)
                photo(4 / 5)
                title; place; flair; solo(); mood
            case "arch":
                head()
                H5Photo()
                    .aspectRatio(3 / 4, contentMode: .fit)
                    .clipShape(UnevenRoundedRectangle(topLeadingRadius: 999, bottomLeadingRadius: 2, bottomTrailingRadius: 2, topTrailingRadius: 999))
                    .padding(4)
                    .overlay(UnevenRoundedRectangle(topLeadingRadius: 999, bottomLeadingRadius: 3, bottomTrailingRadius: 3, topTrailingRadius: 999).strokeBorder(line, lineWidth: 1))
                    .frame(maxWidth: .infinity)
                title; place; flair; solo(); mood
            case "crest":
                head()
                photo(16 / 10)
                    .overlay(alignment: .bottom) {
                        LIcon(icon, size: 21)
                            .foregroundStyle(bg)
                            .frame(width: 42, height: 42)
                            .background(accent, in: Circle())
                            .overlay(Circle().inset(by: -3).strokeBorder(bg, lineWidth: 3))
                            .overlay(Circle().inset(by: -4).strokeBorder(line, lineWidth: 1))
                            .offset(y: 42 * 0.48)
                    }
                    .padding(.bottom, 17)
                title; place; solo(); mood
            case "denom":
                head()
                photo(1)
                title; place; solo(); mood
            case "banner":
                head()
                Text(t.title)
                    .font(.h5Serif(rem(1)))
                    .fontWeight(.medium)
                    .trackingEm(0.12, size: rem(1))
                    .foregroundStyle(bg)
                    .lineLimit(1)
                    .padding(.vertical, 5)
                    .padding(.horizontal, 14)
                    .frame(maxWidth: .infinity)
                    .background(accent)
                    .clipShape(BannerCut())
                    .padding(.top, 1)
                    .padding(.bottom, 2)
                photo(4 / 5)
                place; solo(); mood
            case "coil":
                head(val)
                photo(3 / 2)
                title; place; solo(t.date); mood
            case "oval":
                head()
                H5Photo()
                    .aspectRatio(4 / 5, contentMode: .fit)
                    .clipShape(Ellipse())
                    .overlay(Ellipse().strokeBorder(Color(hex: 0x787060, alpha: 0.35), lineWidth: 1))
                    .padding(4)
                    .overlay(Ellipse().strokeBorder(line, lineWidth: 1))
                    .frame(maxWidth: .infinity)
                centered { title; place }
                rule
                solo(); mood
            case "vignette":
                head()
                ZStack(alignment: .bottomLeading) {
                    photo(5 / 4, radius: 0, inset: false)
                    VStack(alignment: .leading, spacing: 2) {
                        title.foregroundStyle(.white)
                        place.foregroundStyle(.white.opacity(0.78))
                    }
                    .padding(EdgeInsets(top: 30, leading: 10, bottom: 9, trailing: 10))
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(LinearGradient(colors: [.clear, .black.opacity(0.74)], startPoint: .top, endPoint: .bottom))
                }
                .clipShape(RoundedRectangle(cornerRadius: 2))
                solo(); mood
            default:
                head()
                photo(1)
                title; place; solo(); mood
            }
        }
        .padding(11)
        .overlay(alignment: .topTrailing) {
            if spec.variant == "denom" {
                Text(String(String(t.seat.filter(\.isNumber)).prefix(3)).isEmpty ? "1" : String(String(t.seat.filter(\.isNumber)).prefix(3)))
                    .font(.h5Serif(rem(4.4)))
                    .foregroundStyle(accent)
                    .opacity(0.12)
                    .offset(x: 4)
                    .allowsHitTesting(false)
            }
        }
        .clipped()
    }

    private var seal: some View {
        VStack(alignment: .leading, spacing: 9) {
            head()
            photo(1)
            centered { title; place }
            flair; solo(); mood
        }
        .padding(12)
        .overlay(Rectangle().inset(by: 3).strokeBorder(line, lineWidth: 1).padding(0.5))
        .overlay(Rectangle().strokeBorder(line, lineWidth: 1))
        .padding(11)
    }

    private var coords: some View {
        VStack(alignment: .leading, spacing: 0) {
            H5Photo().aspectRatio(21 / 9, contentMode: .fit).clipped()
            VStack(alignment: .leading, spacing: 6) {
                title; place
                HStack(alignment: .top, spacing: 8) {
                    scaleCell("ISSUED", t.date).frame(maxWidth: .infinity, alignment: .leading)
                    scaleCell("CAT.NO", t.seat).frame(maxWidth: .infinity, alignment: .leading).layoutPriority(1.15)
                }
                .padding(.top, 6)
                .overlay(alignment: .top) { Rectangle().fill(line).frame(height: 1) }
                mood
            }
            .padding(EdgeInsets(top: 10, leading: 11, bottom: 11, trailing: 11))
        }
    }

    private func scaleCell(_ key: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(key).font(.h5Mono(rem(0.44))).trackingEm(0.16, size: rem(0.44)).foregroundStyle(muted)
            Text(value).font(.h5Mono(rem(0.5))).fontWeight(.bold).trackingEm(0.04, size: rem(0.5)).lineLimit(1)
        }
    }

    private var gate: some View {
        HStack(spacing: 0) {
            Text(t.place)
                .font(.h5Mono(rem(0.56)))
                .fontWeight(.semibold)
                .trackingEm(0.24, size: rem(0.56))
                .lineLimit(1)
                .fixedSize()
                .rotationEffect(.degrees(90))
                .foregroundStyle(bg)
                .frame(width: 38)
                .frame(maxHeight: .infinity)
                .background(accent)
            VStack(alignment: .leading, spacing: 7) {
                head()
                photo(4 / 3)
                title; solo(); mood
            }
            .padding(11)
            .frame(maxHeight: .infinity, alignment: .top)
        }
    }

    private var ledger: some View {
        HStack(alignment: .top, spacing: 10) {
            photo(5 / 6).frame(width: 104)
            VStack(alignment: .leading, spacing: 6) {
                head()
                ledgerRow("TOPIC", t.title)
                ledgerRow("PLACE", t.place)
                ledgerRow("NO.", t.seat)
                mood
            }
        }
        .padding(11)
    }

    private func ledgerRow(_ key: String, _ value: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
            Text(key).foregroundStyle(muted).fixedSize()
            Text(value)
                .lineLimit(1)
                .padding(.bottom, 1)
                .frame(maxWidth: .infinity, alignment: .leading)
                .overlay(alignment: .bottom) { Rectangle().fill(line).frame(height: 1) }
        }
        .font(.h5Mono(rem(0.5)))
        .trackingEm(0.06, size: rem(0.5))
    }
}

/// 缎带两端内凹剪口
struct BannerCut: Shape {
    func path(in r: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: r.minX, y: r.minY))
        p.addLine(to: CGPoint(x: r.maxX, y: r.minY))
        p.addLine(to: CGPoint(x: r.maxX - 9, y: r.midY))
        p.addLine(to: CGPoint(x: r.maxX, y: r.maxY))
        p.addLine(to: CGPoint(x: r.minX, y: r.maxY))
        p.addLine(to: CGPoint(x: r.minX + 9, y: r.midY))
        p.closeSubpath()
        return p
    }
}

private struct StampEdge: ViewModifier {
    let coil: Bool

    func body(content: Content) -> some View {
        if coil {
            content.perforatedTopBottom(step: 15, radius: 6)
        } else {
            content.perforated(step: 13, radius: 5.5)
        }
    }
}

// MARK: - 异形票 shape-*

struct TkShape: View {
    @Environment(\.ticket) private var t
    let shape: String

    private var colors: (bg: UInt32, ink: UInt32, accent: UInt32) {
        switch shape {
        case "hex": (0xEEF4FB, 0x1C3A52, 0x2E6EA3)
        case "ribbon": (0xFDF1F3, 0x4A2230, 0xB0455E)
        case "shield": (0xF3F6EE, 0x27331F, 0x5C7A3C)
        case "slant": (0xFDF6EA, 0x3D2C14, 0xC08A34)
        case "notch": (0xF2F2FB, 0x252547, 0x5A5AC2)
        case "note": (0xFBF3E6, 0x43301A, 0xA8763C)
        case "tri": (0xF4F1FB, 0x2B2447, 0x6A5AC2)
        default: (0xF6F2E8, 0x33302A, 0xA8763C)
        }
    }

    private var isTri: Bool { shape == "tri" }

    private var insets: EdgeInsets {
        switch shape {
        case "shield": EdgeInsets(top: 24, leading: 22, bottom: 78, trailing: 22)
        case "slant": EdgeInsets(top: 24, leading: 22, bottom: 56, trailing: 22)
        case "note": EdgeInsets(top: 24, leading: 22, bottom: 70, trailing: 22)
        case "tri": EdgeInsets(top: 130, leading: 40, bottom: 34, trailing: 40)
        default: EdgeInsets(top: 24, leading: 22, bottom: 24, trailing: 22)
        }
    }

    var body: some View {
        let c = colors
        let polygon = H5Polygon(points: H5ShapePolygons.points[shape] ?? [])
        VStack(spacing: isTri ? 7 : 9) {
            H5Photo()
                .frame(width: isTri ? 78 : 116, height: isTri ? 78 : 116)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                .padding(4)
                .background(Color(hex: 0xFDFAF4, alpha: 0.9), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                .shadow(color: .black.opacity(0.18), radius: 9, y: 8)
            Text(t.title).font(.h5Serif(rem(isTri ? 1.2 : 1.34))).fontWeight(.bold)
            Text(t.place)
                .font(.h5Mono(rem(0.58)))
                .trackingEm(0.16, size: rem(0.58))
                .foregroundStyle(Color(hex: c.accent))
            VStack(spacing: isTri ? 4 : 6) {
                row("DATE", t.date, c.accent)
                row("NO.", t.seat, c.accent)
            }
            .font(.h5Mono(rem(isTri ? 0.58 : 0.62)))
            .padding(.top, isTri ? 7 : 10)
            .frame(maxWidth: isTri ? 150 : 196)
            .overlay(alignment: .top) { H5Dash(color: .black.opacity(0.22)).frame(height: 1) }
            Text(t.mood)
                .font(.h5Sans(rem(isTri ? 0.64 : 0.7)))
                .italic()
                .opacity(0.78)
        }
        .lineLimit(1)
        .multilineTextAlignment(.center)
        .foregroundStyle(Color(hex: c.ink))
        .padding(insets)
        .frame(width: 288, height: 384, alignment: isTri ? .bottom : .center)
        .background(Color(hex: c.bg))
        .overlay { H5Glitter() }
        .clipShape(polygon)
    }

    private func row(_ key: String, _ value: String, _ accent: UInt32) -> some View {
        HStack(spacing: 10) {
            Text(key).foregroundStyle(Color(hex: accent))
            Spacer(minLength: 0)
            Text(value)
        }
    }
}
