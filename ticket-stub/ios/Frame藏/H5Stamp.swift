import SwiftUI

private let roseGlitter = H5Glitter(opacity: 0.42, tint: Color(red: 1, green: 0.85, blue: 0.72))
private let stampRed = Color(hex: 0x9A3F2C)

private func pts(_ list: [(Double, Double)]) -> [CGPoint] {
    list.map { CGPoint(x: $0.0 / 100, y: $0.1 / 100) }
}

// MARK: - 经典邮票 stamp-classic

struct TkStampClassic: View {
    @Environment(\.ticket) private var t

    var body: some View {
        let slate = Color(hex: 0x4A5560)
        VStack(alignment: .leading, spacing: 9) {
            HStack(spacing: 8) {
                Text("CHINA POST")
                Spacer(minLength: 0)
                Text("120")
                    .foregroundStyle(Color(hex: 0x9A4030))
                    .padding(.vertical, 2)
                    .padding(.horizontal, 7)
                    .overlay(RoundedRectangle(cornerRadius: 3).strokeBorder(Color(hex: 0x28323C, alpha: 0.3), lineWidth: 1))
            }
            .font(.h5Mono(rem(0.56)))
            .trackingEm(0.16, size: rem(0.56))
            .foregroundStyle(slate)
            .padding(.bottom, 8)
            .overlay(alignment: .bottom) { Rectangle().fill(Color(hex: 0x28323C, alpha: 0.18)).frame(height: 1) }
            H5Photo().aspectRatio(4 / 5, contentMode: .fit)
            Text(t.title).font(.h5Serif(rem(1.34))).fontWeight(.bold)
            Text(t.place).font(.h5Sans(rem(0.74))).foregroundStyle(Color(hex: 0x6A7078))
            HStack {
                Text(t.date)
                Spacer(minLength: 10)
                Text(t.seat)
            }
            .font(.h5Mono(rem(0.64)))
            .foregroundStyle(slate)
            .padding(.top, 8)
            .overlay(alignment: .top) { H5Dash(color: Color(hex: 0x28323C, alpha: 0.24), dash: [3, 3]).frame(height: 1) }
            Text(t.mood).font(.h5Sans(rem(0.76))).italic().foregroundStyle(Color(hex: 0x5C636B))
        }
        .lineLimit(1)
        .padding(12)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(LinearGradient(colors: [Color(hex: 0xFDFCF8), Color(hex: 0xF4F1E8)], startPoint: .top, endPoint: .bottom))
        .overlay(Rectangle().strokeBorder(Color(hex: 0x28323C, alpha: 0.22), lineWidth: 1))
        .padding(16)
        .foregroundStyle(Color(hex: 0x24292F))
        .frame(width: 292, height: 504)
        .background(Color(hex: 0xFBFAF5))
        .overlay { roseGlitter }
        .perforated()
    }
}

// MARK: - 小全张 stamp-sheet

struct TkStampSheet: View {
    @Environment(\.ticket) private var t

    var body: some View {
        VStack(spacing: 11) {
            HStack(spacing: 8) {
                Text("SPECIMEN SET")
                Spacer(minLength: 0)
                Text(t.seat)
            }
            .lineLimit(1)
            .font(.h5Mono(rem(0.55)))
            .trackingEm(0.16, size: rem(0.55))
            .foregroundStyle(Color(hex: 0x7A7166))
            Grid(horizontalSpacing: 9, verticalSpacing: 9) {
                GridRow {
                    photoCell(0)
                    textCell {
                        Text("60").font(.h5Mono(rem(0.52))).trackingEm(0.12, size: rem(0.52)).foregroundStyle(Color(hex: 0x9A4030))
                        Text(t.title).font(.h5Serif(rem(1.02))).fontWeight(.bold)
                        Text(t.place).font(.h5Sans(rem(0.66))).foregroundStyle(Color(hex: 0x6A7078))
                    }
                }
                GridRow {
                    textCell {
                        Text("80").font(.h5Mono(rem(0.52))).trackingEm(0.12, size: rem(0.52)).foregroundStyle(Color(hex: 0x9A4030))
                        Text(t.date).font(.h5Mono(rem(0.58))).foregroundStyle(Color(hex: 0x4A5560))
                        Text(t.mood).font(.h5Sans(rem(0.7))).italic().foregroundStyle(Color(hex: 0x5C636B)).lineLimit(2)
                    }
                    photoCell(1)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(13)
        .foregroundStyle(Color(hex: 0x24292F))
        .frame(width: 304, height: 250)
        .background(Color(hex: 0xFBFAF5))
        .overlay { roseGlitter }
        .perforated()
    }

    private func photoCell(_ slot: Int) -> some View {
        H5Photo(slot: slot)
            .frame(maxWidth: .infinity, minHeight: 96, maxHeight: .infinity)
            .clipped()
            .overlay(Rectangle().strokeBorder(Color(hex: 0x28323C, alpha: 0.2), lineWidth: 1))
    }

    private func textCell<C: View>(@ViewBuilder _ content: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 6) { content() }
            .lineLimit(1)
            .padding(9)
            .frame(maxWidth: .infinity, minHeight: 96, maxHeight: .infinity, alignment: .topLeading)
            .background(LinearGradient(colors: [Color(hex: 0xFDFCF8), Color(hex: 0xF3F0E6)], startPoint: .top, endPoint: .bottom))
            .overlay(Rectangle().strokeBorder(Color(hex: 0x28323C, alpha: 0.2), lineWidth: 1))
    }
}

// MARK: - 邮戳明信片 stamp-postmark

struct WaveCancel: View {
    var color: Color

    var body: some View {
        Canvas { ctx, size in
            var path = Path()
            for y0 in [9.0, 27.0, 45.0] {
                path.move(to: CGPoint(x: 0, y: y0))
                var x = 0.0
                var up = true
                while x < size.width {
                    path.addQuadCurve(to: CGPoint(x: x + 20, y: y0), control: CGPoint(x: x + 10, y: up ? y0 - 8 : y0 + 8))
                    x += 20
                    up.toggle()
                }
            }
            ctx.stroke(path, with: .color(color), lineWidth: 1.4)
        }
    }
}

struct TkStampPostmark: View {
    @Environment(\.ticket) private var t

    var body: some View {
        let mark = Color(hex: 0x96372D)
        VStack(alignment: .leading, spacing: 0) {
            H5Photo().aspectRatio(16 / 10, contentMode: .fit)
            VStack(alignment: .leading, spacing: 0) {
                WaveCancel(color: Color(hex: 0x33302A)).frame(height: 54).opacity(0.45).padding(.bottom, 10)
                Text(t.title).font(.h5Serif(rem(1.48))).fontWeight(.bold).frame(maxWidth: 296 * 0.64, alignment: .leading).padding(.bottom, 7)
                HStack {
                    Text(t.place)
                    Spacer(minLength: 10)
                    Text(t.seat)
                }
                .font(.h5Mono(rem(0.64)))
                .foregroundStyle(Color(hex: 0x6A6258))
                Text(t.mood)
                    .font(.h5Serif(rem(1.04), italic: true))
                    .foregroundStyle(Color(hex: 0x46413A))
                    .padding(.top, 12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .overlay(alignment: .top) { H5Dash(color: Color(hex: 0x5A5037, alpha: 0.3), dash: [3, 3]).frame(height: 1) }
                    .padding(.top, 14)
            }
            .lineLimit(1)
            .padding(EdgeInsets(top: 16, leading: 16, bottom: 18, trailing: 16))
            .overlay(alignment: .topTrailing) {
                ZStack {
                    Circle().strokeBorder(mark.opacity(0.5), lineWidth: 2)
                    Circle().strokeBorder(mark.opacity(0.4), style: StrokeStyle(lineWidth: 1, dash: [3, 3])).padding(5)
                    VStack(spacing: 2) {
                        Text("POST")
                        Text(t.date).lineLimit(2).multilineTextAlignment(.center)
                    }
                    .font(.h5Sans(rem(0.5)))
                    .trackingEm(0.08, size: rem(0.5))
                    .foregroundStyle(mark.opacity(0.7))
                    .padding(12)
                }
                .frame(width: 84, height: 84)
                .rotationEffect(.degrees(-10))
                .padding(.trailing, 14)
                .padding(.top, 6)
            }
            Spacer(minLength: 0)
        }
        .foregroundStyle(Color(hex: 0x33302A))
        .frame(width: 328, height: 402)
        .background { H5Stripes(color: Color(hex: 0x33302A), angle: 45, line: 1, period: 9, opacity: 0.08) }
        .background(LinearGradient(colors: [Color(hex: 0xFAF6EC), Color(hex: 0xEFE7D6)], startPoint: .top, endPoint: .bottom))
        .overlay(RoundedRectangle(cornerRadius: 3).strokeBorder(Color(hex: 0x5A5037, alpha: 0.16), lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 3))
    }
}

// MARK: - 首日封 stamp-firstday

struct TkStampFirstday: View {
    @Environment(\.ticket) private var t

    var body: some View {
        let mark = Color(hex: 0x96372D)
        let label = Color(hex: 0x8A8172)
        VStack(alignment: .leading, spacing: 0) {
            Text("TO").font(.h5Mono(rem(0.55))).trackingEm(0.24, size: rem(0.55)).foregroundStyle(label).padding(.bottom, 6)
            Text(t.title).font(.h5Serif(rem(1.5))).fontWeight(.bold).padding(.bottom, 6)
            Canvas { ctx, size in
                var y: CGFloat = 10
                while y < size.height {
                    ctx.fill(Path(CGRect(x: 0, y: y, width: size.width, height: 1)), with: .color(Color(hex: 0x5A5037, alpha: 0.24)))
                    y += 11
                }
            }
            .frame(height: 34)
            .padding(.vertical, 12)
            Text(t.mood).font(.h5Sans(rem(0.79))).italic().foregroundStyle(Color(hex: 0x5C554C))
            HStack {
                Text(t.date)
                Spacer(minLength: 10)
                Text(t.seat)
            }
            .font(.h5Mono(rem(0.62)))
            .foregroundStyle(Color(hex: 0x7D7466))
            .padding(.top, 11)
            .overlay(alignment: .top) { Rectangle().fill(Color(hex: 0x5A5037, alpha: 0.18)).frame(height: 1) }
            .padding(.top, 14)
        }
        .lineLimit(1)
        .padding(EdgeInsets(top: 128 + 18, leading: 18, bottom: 18, trailing: 18))
        .frame(width: 328, height: 324, alignment: .topLeading)
        .overlay(alignment: .topLeading) {
            VStack(alignment: .leading, spacing: 5) {
                Text("FROM").font(.h5Mono(rem(0.55))).trackingEm(0.24, size: rem(0.55)).foregroundStyle(label)
                Text(t.place).font(.h5Serif(rem(1.04))).fontWeight(.bold).lineLimit(2)
            }
            .frame(maxWidth: 292 * 0.44, alignment: .leading)
            .padding(.leading, 36)
            .padding(.top, 38)
        }
        .overlay(alignment: .topTrailing) {
            H5Photo()
                .frame(width: 96, height: 116)
                .background(Color(hex: 0xFDFCF8))
                .perforated(step: 11, radius: 5)
                .shadow(color: Color(hex: 0x3C3223, alpha: 0.18), radius: 7, y: 4)
                .padding(.trailing, 36)
                .padding(.top, 36)
        }
        .overlay(alignment: .topTrailing) {
            ZStack {
                Circle().strokeBorder(mark.opacity(0.42), lineWidth: 2)
                VStack(spacing: 2) {
                    Text("FIRST DAY")
                    Text(t.date).lineLimit(2).multilineTextAlignment(.center)
                }
                .font(.h5Sans(rem(0.46)))
                .trackingEm(0.06, size: rem(0.46))
                .foregroundStyle(mark.opacity(0.62))
                .padding(8)
            }
            .frame(width: 78, height: 78)
            .rotationEffect(.degrees(-14))
            .padding(.trailing, 94)
            .padding(.top, 118)
        }
        .foregroundStyle(Color(hex: 0x33302A))
        .background { H5Dots(color: Color(hex: 0x33302A)) }
        .background(LinearGradient(colors: [Color(hex: 0xFDFBF5), Color(hex: 0xF2ECDF)], startPoint: .top, endPoint: .bottom))
        .overlay(RoundedRectangle(cornerRadius: 3).strokeBorder(Color(hex: 0x5A5037, alpha: 0.14), lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 3))
        .perforatedTopBottom(step: 12, radius: 4)
    }
}

// MARK: - 火漆封缄 stamp-wax

struct TkStampWax: View {
    @Environment(\.ticket) private var t

    private static let seal = pts([
        (50, 1.2), (63.1, 5.5), (76.1, 9.3), (89.2, 16), (94.9, 29.5), (97.7, 43.1), (100, 57.3), (96.7, 71.3),
        (83.7, 79.2), (78.1, 93.7), (62.9, 93.8), (50, 95.5), (35.4, 99.8), (26, 87.4), (14.4, 80.8), (9.8, 68.4),
        (5.9, 56.3), (1.1, 43), (3.3, 28.7), (11.9, 16.9), (23, 8), (37.5, 7.3),
    ])

    var body: some View {
        let dash = Color(hex: 0x786446, alpha: 0.34)
        VStack(spacing: 0) {
            ZStack {
                RadialGradient(stops: [
                    .init(color: Color(hex: 0xA83226), location: 0), .init(color: Color(hex: 0x7D1D17), location: 0.7),
                    .init(color: Color(hex: 0x5E1310), location: 1),
                ], center: UnitPoint(x: 0.5, y: 0.52), startRadius: 0, endRadius: 46)
                RadialGradient(colors: [Color(red: 1, green: 150 / 255, blue: 130 / 255).opacity(0.5), .clear], center: UnitPoint(x: 0.36, y: 0.3), startRadius: 0, endRadius: 42)
                Text("SEALED")
                    .font(.h5Mono(rem(0.5)))
                    .trackingEm(0.16, size: rem(0.5))
                    .foregroundStyle(Color(red: 1, green: 226 / 255, blue: 205 / 255).opacity(0.72))
                    .shadow(color: .black.opacity(0.35), radius: 0, y: 1)
            }
            .frame(width: 92, height: 92)
            .clipShape(H5Polygon(points: Self.seal))
            .shadow(color: Color(hex: 0x46191A, alpha: 0.4), radius: 10, y: 8)
            .padding(.top, 4)
            .padding(.bottom, 16)
            VStack(spacing: 0) {
                H5Photo()
                    .aspectRatio(4 / 3, contentMode: .fit)
                    .clipShape(RoundedRectangle(cornerRadius: 4))
                    .padding(.bottom, 14)
                Text(t.title).font(.h5Serif(rem(1.5))).fontWeight(.bold).padding(.bottom, 6)
                Text(t.place).font(.h5Sans(rem(0.75))).foregroundStyle(Color(hex: 0x6D6353))
                VStack(spacing: 7) {
                    row("DATE", t.date)
                    row("NO.", t.seat)
                }
                .padding(.vertical, 12)
                .overlay(alignment: .top) { H5Dash(color: dash, dash: [3, 3]).frame(height: 1) }
                .overlay(alignment: .bottom) { H5Dash(color: dash, dash: [3, 3]).frame(height: 1) }
                .padding(.vertical, 14)
                Text(t.mood).font(.h5Sans(rem(0.8))).italic().foregroundStyle(Color(hex: 0x5C5546))
            }
            .lineLimit(1)
            .multilineTextAlignment(.center)
            .padding(.top, 8)
            Spacer(minLength: 0)
        }
        .padding(EdgeInsets(top: 22, leading: 20, bottom: 20, trailing: 20))
        .foregroundStyle(Color(hex: 0x3A3228))
        .frame(width: 316, height: 542)
        .background(alignment: .top) {
            ZStack(alignment: .top) {
                ribbon.rotationEffect(.degrees(-5)).offset(y: 44)
                ribbon.rotationEffect(.degrees(5)).opacity(0.92).offset(y: 58)
            }
        }
        .background(LinearGradient(colors: [Color(hex: 0xF7F1E3), Color(hex: 0xECE1CB)], startPoint: .top, endPoint: .bottom))
        .overlay { roseGlitter }
        .overlay(RoundedRectangle(cornerRadius: 3).strokeBorder(Color(hex: 0x786446, alpha: 0.18), lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 3))
        .perforatedTopBottom(step: 12, radius: 4)
    }

    private var ribbon: some View {
        LinearGradient(colors: [Color(hex: 0x9E3E34, alpha: 0.9), Color(hex: 0x742620, alpha: 0.9)], startPoint: .top, endPoint: .bottom)
            .frame(width: 316, height: 20)
            .shadow(color: Color(hex: 0x3C1E19, alpha: 0.22), radius: 3, y: 2)
    }

    private func row(_ key: String, _ value: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Text(key).font(.h5Sans(rem(0.55))).trackingEm(0.14, size: rem(0.55)).foregroundStyle(Color(hex: 0x8A7D66))
            Spacer(minLength: 0)
            Text(value).font(.h5Mono(rem(0.72))).fontWeight(.medium)
        }
    }
}

// MARK: - 双连票 stamp-pair

private struct StampValue: View {
    var text: String

    var body: some View {
        Text(text)
            .font(.h5Mono(rem(0.56)))
            .foregroundStyle(stampRed)
            .padding(.vertical, 2)
            .padding(.horizontal, 6)
            .overlay(RoundedRectangle(cornerRadius: 3).strokeBorder(stampRed.opacity(0.42), lineWidth: 1))
    }
}

struct TkStampPair: View {
    @Environment(\.ticket) private var t

    var body: some View {
        HStack(spacing: 9) {
            cell {
                H5Photo().aspectRatio(1, contentMode: .fit).clipShape(RoundedRectangle(cornerRadius: 2))
                Spacer(minLength: 0)
                StampValue(text: "80")
            }
            cell {
                VStack(alignment: .leading, spacing: 2) {
                    Text(t.title).font(.h5Serif(rem(1.02))).fontWeight(.bold)
                    Text(t.place).font(.h5Mono(rem(0.5))).trackingEm(0.12, size: rem(0.5)).foregroundStyle(Color(hex: 0x7D6C56))
                }
                Spacer(minLength: 0)
                VStack(spacing: 4) {
                    HStack { Text("DATE"); Spacer(minLength: 6); Text(t.date) }
                    HStack { Text("NO."); Spacer(minLength: 6); Text(t.seat) }
                }
                .font(.h5Mono(rem(0.52)))
                .foregroundStyle(Color(hex: 0x5C5145))
                Spacer(minLength: 0)
                Text(t.mood).font(.h5Sans(rem(0.62))).italic().foregroundStyle(Color(hex: 0x6A5D4C))
                Spacer(minLength: 0)
                StampValue(text: "80")
            }
        }
        .lineLimit(1)
        .padding(11)
        .foregroundStyle(Color(hex: 0x2B2320))
        .frame(width: 320, height: 193)
        .background(LinearGradient(colors: [Color(hex: 0xFDF8EE), Color(hex: 0xF4ECDA)], startPoint: UnitPoint(x: 0.33, y: 0), endPoint: UnitPoint(x: 0.67, y: 1)))
        .overlay { H5Glitter() }
        .overlay(Rectangle().strokeBorder(Color(hex: 0x785A3C, alpha: 0.16), lineWidth: 1))
    }

    private func cell<C: View>(@ViewBuilder _ content: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 6) { content() }
            .padding(.vertical, 9)
            .padding(.horizontal, 10)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .overlay(Rectangle().strokeBorder(Color(hex: 0x785A3C, alpha: 0.26), lineWidth: 1))
    }
}

// MARK: - 四方连 stamp-four

struct TkStampFour: View {
    @Environment(\.ticket) private var t

    var body: some View {
        Grid(horizontalSpacing: 8, verticalSpacing: 8) {
            GridRow {
                cell {
                    H5Photo(slot: 0).aspectRatio(1, contentMode: .fit).clipShape(RoundedRectangle(cornerRadius: 2))
                    Spacer(minLength: 0)
                    value("40")
                }
                cell {
                    key("SPECIMEN")
                    Spacer(minLength: 0)
                    Text(t.title).font(.h5Serif(rem(0.94))).fontWeight(.bold)
                    Spacer(minLength: 0)
                    key(t.date)
                }
            }
            GridRow {
                cell {
                    key(t.place)
                    Spacer(minLength: 0)
                    Text(t.mood).font(.h5Sans(rem(0.6))).italic().foregroundStyle(Color(hex: 0x6A5D4C)).lineLimit(2)
                    Spacer(minLength: 0)
                    value("60")
                }
                cell {
                    H5Photo(slot: 1).aspectRatio(1, contentMode: .fit).clipShape(RoundedRectangle(cornerRadius: 2))
                    Spacer(minLength: 0)
                    key(t.seat)
                }
            }
        }
        .lineLimit(1)
        .padding(10)
        .foregroundStyle(Color(hex: 0x2B2320))
        .frame(width: 300, height: 340)
        .background(Color(hex: 0xFBF6EC))
        .overlay { H5Glitter() }
        .overlay(Rectangle().strokeBorder(Color(hex: 0x785A3C, alpha: 0.16), lineWidth: 1))
    }

    private func key(_ s: String) -> some View {
        Text(s).font(.h5Mono(rem(0.46))).trackingEm(0.14, size: rem(0.46)).foregroundStyle(Color(hex: 0x8D7C62))
    }

    private func value(_ s: String) -> some View {
        Text(s).font(.h5Mono(rem(0.84))).fontWeight(.bold).foregroundStyle(stampRed)
    }

    private func cell<C: View>(@ViewBuilder _ content: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 6) { content() }
            .padding(10)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .overlay(Rectangle().strokeBorder(Color(hex: 0x785A3C, alpha: 0.24), lineWidth: 1))
    }
}

// MARK: - 小型张 stamp-miniature

struct TkStampMiniature: View {
    @Environment(\.ticket) private var t

    var body: some View {
        let brown = Color(hex: 0x8A7452)
        VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 9) {
                H5Photo()
                    .aspectRatio(4 / 3, contentMode: .fit)
                    .overlay(Rectangle().strokeBorder(Color(hex: 0xFBF5E7), lineWidth: 3))
                    .overlay(Rectangle().inset(by: 3).stroke(Color(hex: 0x8C6E46, alpha: 0.42), lineWidth: 1))
                HStack(alignment: .bottom, spacing: 10) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(t.title).font(.h5Serif(rem(1.28))).fontWeight(.bold)
                        Text(t.place).font(.h5Mono(rem(0.52))).trackingEm(0.14, size: rem(0.52)).foregroundStyle(brown)
                    }
                    Spacer(minLength: 0)
                    Text("120").font(.h5Mono(rem(1.1))).fontWeight(.bold).foregroundStyle(stampRed)
                }
                Text(t.mood).font(.h5Sans(rem(0.7))).italic().foregroundStyle(Color(hex: 0x6A5D4C))
            }
            .padding(14)
            .overlay(Rectangle().strokeBorder(Color(hex: 0x8C6E46, alpha: 0.35), lineWidth: 1))
            HStack(spacing: 10) {
                Text("CHINA POST")
                Spacer(minLength: 0)
                Text("\(t.date) · \(t.seat)")
            }
            .font(.h5Mono(rem(0.46)))
            .trackingEm(0.14, size: rem(0.46))
            .foregroundStyle(brown)
            .padding(EdgeInsets(top: 8, leading: 6, bottom: 2, trailing: 6))
            Spacer(minLength: 0)
        }
        .lineLimit(1)
        .padding(9)
        .foregroundStyle(Color(hex: 0x2E2820))
        .frame(width: 302, height: 329)
        .background { H5Rings(color: Color(hex: 0x2E2820)) }
        .background(LinearGradient(colors: [Color(hex: 0xFBF5E7), Color(hex: 0xF0E6D1)], startPoint: UnitPoint(x: 0.37, y: 0), endPoint: UnitPoint(x: 0.63, y: 1)))
        .overlay(Rectangle().strokeBorder(Color(hex: 0x8C6E46, alpha: 0.22), lineWidth: 1))
    }
}

// MARK: - 全景邮票 stamp-panorama

struct TkStampPanorama: View {
    @Environment(\.ticket) private var t

    var body: some View {
        VStack(spacing: 0) {
            H5Photo()
                .aspectRatio(3, contentMode: .fit)
                .overlay {
                    LinearGradient(stops: [
                        .init(color: Color(hex: 0x0A1018, alpha: 0.5), location: 0), .init(color: .clear, location: 0.44),
                        .init(color: Color(hex: 0x0A1018, alpha: 0.74), location: 1),
                    ], startPoint: .top, endPoint: .bottom)
                }
                .overlay(alignment: .topLeading) {
                    Text("PANORAMA · \(t.date)")
                        .font(.h5Mono(rem(0.5)))
                        .trackingEm(0.18, size: rem(0.5))
                        .foregroundStyle(.white.opacity(0.85))
                        .padding(.top, 10)
                        .padding(.leading, 13)
                }
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(t.title).font(.h5Serif(rem(1.2))).fontWeight(.bold)
                    Text(t.place).font(.h5Mono(rem(0.5))).trackingEm(0.14, size: rem(0.5)).foregroundStyle(.white.opacity(0.6))
                }
                Text(t.mood).font(.h5Sans(rem(0.64))).italic().foregroundStyle(.white.opacity(0.66)).frame(maxWidth: .infinity, alignment: .leading)
                Text(t.seat)
                    .font(.h5Mono(rem(0.5)))
                    .fontWeight(.bold)
                    .lineLimit(3)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(Color(hex: 0x0D1520))
                    .padding(4)
                    .frame(width: 48, height: 48)
                    .background(Color(hex: 0xE8C982), in: Circle())
            }
            .lineLimit(1)
            .padding(.vertical, 13)
            .padding(.horizontal, 14)
            .frame(maxHeight: .infinity)
        }
        .foregroundStyle(Color(hex: 0xF2ECE0))
        .frame(width: 336, height: 186)
        .background(Color(hex: 0x131B26))
        .clipped()
    }
}

// MARK: - 人物邮票 stamp-portrait

struct TkStampPortrait: View {
    @Environment(\.ticket) private var t

    var body: some View {
        let line = Color(hex: 0x825F3C)
        VStack(spacing: 9) {
            H5Photo()
                .frame(width: 156, height: 208)
                .clipShape(Ellipse())
                .padding(12)
                .overlay(Ellipse().strokeBorder(Color(hex: 0x826946, alpha: 0.42), lineWidth: 1))
                .overlay(Ellipse().inset(by: 6).stroke(Color(hex: 0x826946, alpha: 0.34), lineWidth: 1))
            Text(t.title).font(.h5Serif(rem(1.24))).fontWeight(.bold)
            Rectangle().fill(Color(hex: 0x785F3C, alpha: 0.45)).frame(width: 46, height: 1)
            Text(t.place).font(.h5Sans(rem(0.86)))
            VStack(spacing: 4) {
                row("LIFE", t.date, line)
                row("NO.", t.seat, line)
            }
            Text(t.mood).font(.h5Sans(rem(0.66))).italic().foregroundStyle(Color(hex: 0x6A5D4C))
            Spacer(minLength: 0)
        }
        .lineLimit(1)
        .multilineTextAlignment(.center)
        .padding(16)
        .foregroundStyle(Color(hex: 0x2A2520))
        .frame(width: 292, height: 403)
        .background(RadialGradient(stops: [.init(color: Color(hex: 0xFFFDF7), location: 0), .init(color: Color(hex: 0xEEE5D3), location: 0.78)], center: UnitPoint(x: 0.5, y: 0.22), startRadius: 0, endRadius: 400))
        .overlay { H5Glitter() }
        .overlay(RoundedRectangle(cornerRadius: 5).strokeBorder(Color(hex: 0x826946, alpha: 0.2), lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 5))
    }

    private func row(_ key: String, _ value: String, _ line: Color) -> some View {
        HStack(spacing: 8) {
            Text(key)
            Spacer(minLength: 0)
            Text(value)
        }
        .font(.h5Mono(rem(0.52)))
        .trackingEm(0.1, size: rem(0.52))
        .foregroundStyle(Color(hex: 0x6D5F4C))
        .padding(.bottom, 3)
        .overlay(alignment: .bottom) { H5Dash(color: line.opacity(0.35), dash: [1, 2]).frame(height: 1) }
    }
}

// MARK: - 航空邮票 stamp-airmail

struct AirmailStripe: View {
    var body: some View {
        Canvas { ctx, size in
            let colors = [Color(hex: 0xC8443A), Color(hex: 0xFDFBF5), Color(hex: 0x2B5C96), Color(hex: 0xFDFBF5)]
            let widths: [CGFloat] = [9, 6, 9, 6]
            let a = 115.0 * .pi / 180
            let dir = CGPoint(x: sin(a), y: -cos(a))
            let normal = CGPoint(x: -dir.y, y: dir.x)
            let diag = size.width + size.height
            var offset: CGFloat = -diag
            var i = 0
            while offset < diag {
                let w = widths[i % 4]
                var p = Path()
                func pt(_ d: CGFloat, _ s: CGFloat) -> CGPoint {
                    CGPoint(x: dir.x * d + normal.x * s, y: dir.y * d + normal.y * s)
                }
                p.move(to: pt(offset, -diag))
                p.addLine(to: pt(offset, diag))
                p.addLine(to: pt(offset + w, diag))
                p.addLine(to: pt(offset + w, -diag))
                p.closeSubpath()
                ctx.fill(p, with: .color(colors[i % 4]))
                offset += w
                i += 1
            }
        }
    }
}

struct TkStampAirmail: View {
    @Environment(\.ticket) private var t

    var body: some View {
        let blue = Color(hex: 0x2B5C96)
        VStack(spacing: 0) {
            AirmailStripe().frame(height: 9).clipShape(UnevenRoundedRectangle(topLeadingRadius: 3, topTrailingRadius: 3))
            HStack(alignment: .top, spacing: 12) {
                H5Photo().frame(width: 104, height: 104).clipShape(RoundedRectangle(cornerRadius: 3))
                VStack(alignment: .leading, spacing: 0) {
                    HStack(spacing: 8) {
                        HStack(spacing: 4) {
                            LIcon("plane", size: 13)
                            Text("PAR AVION")
                        }
                        .font(.h5Mono(rem(0.48)))
                        .trackingEm(0.16, size: rem(0.48))
                        .foregroundStyle(blue)
                        Spacer(minLength: 0)
                        Text(t.seat)
                            .font(.h5Mono(rem(0.54)))
                            .fontWeight(.bold)
                            .foregroundStyle(.white)
                            .padding(.vertical, 1)
                            .padding(.horizontal, 5)
                            .background(Color(hex: 0xC8443A), in: Capsule())
                    }
                    .padding(.bottom, 6)
                    Text(t.title).font(.h5Serif(rem(1.16))).fontWeight(.bold)
                    Text(t.place).font(.h5Mono(rem(0.52))).trackingEm(0.12, size: rem(0.52)).foregroundStyle(Color(hex: 0x7186A0)).padding(.top, 2).padding(.bottom, 8)
                    HStack(spacing: 8) {
                        Text("FLIGHT")
                        Spacer(minLength: 0)
                        Text(t.date)
                    }
                    .font(.h5Mono(rem(0.54)))
                    .foregroundStyle(Color(hex: 0x38536F))
                    .padding(.bottom, 3)
                    .overlay(alignment: .bottom) { H5Dash(color: blue.opacity(0.35), dash: [1, 2]).frame(height: 1) }
                    Text(t.mood).font(.h5Sans(rem(0.64))).italic().foregroundStyle(Color(hex: 0x5B6B80)).padding(.top, 8)
                }
                .lineLimit(1)
            }
            .padding(.vertical, 12)
            .padding(.horizontal, 4)
            .frame(maxHeight: .infinity)
            AirmailStripe().frame(height: 9).clipShape(UnevenRoundedRectangle(bottomLeadingRadius: 3, bottomTrailingRadius: 3))
        }
        .padding(10)
        .foregroundStyle(Color(hex: 0x1E3A5F))
        .frame(width: 322, height: 166)
        .background(Color(hex: 0xFDFBF5))
        .overlay(Rectangle().strokeBorder(Color(hex: 0x1E3A5F, alpha: 0.18), lineWidth: 1))
    }
}

// MARK: - 复古邮票 stamp-vintage

struct TkStampVintage: View {
    @Environment(\.ticket) private var t

    private static let shape: [CGPoint] = {
        var right: [(Double, Double)] = [(0, 0), (100, 0)]
        for i in 1...14 { right.append((i % 2 == 1 ? 100 : 93, Double(i) * 100 / 14)) }
        var left: [(Double, Double)] = [(0, 100)]
        for i in stride(from: 13, through: 0, by: -1) { left.append((i % 2 == 1 ? 0 : 7, Double(i) * 100 / 14)) }
        return pts(right + left)
    }()

    var body: some View {
        let brown = Color(hex: 0x7A6440)
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 8) {
                Text("CHINA POST")
                Spacer(minLength: 0)
                Text(t.date)
            }
            .font(.h5Mono(rem(0.46)))
            .trackingEm(0.18, size: rem(0.46))
            .foregroundStyle(brown)
            .padding(.bottom, 7)
            .overlay(alignment: .bottom) { Rectangle().fill(Color(hex: 0x785C32, alpha: 0.35)).frame(height: 1) }
            H5Photo()
                .aspectRatio(5 / 4, contentMode: .fit)
                .sepia(0.5)
                .contrast(1.06)
                .overlay(Rectangle().strokeBorder(Color(hex: 0x785C32, alpha: 0.45), lineWidth: 1))
                .padding(.top, 9)
            H5Stripes(color: Color(hex: 0x46351F), angle: 100, line: 3, period: 8, opacity: 0.34)
                .frame(height: 22)
                .opacity(0.5)
                .padding(.horizontal, -17)
                .padding(.top, 7)
            Text(t.title).font(.h5Serif(rem(1.34))).fontWeight(.bold).padding(.top, 5)
            Text("\(t.place) · \(t.seat)").font(.h5Mono(rem(0.5))).trackingEm(0.14, size: rem(0.5)).foregroundStyle(Color(hex: 0x8A7452)).padding(.top, 3)
            Text(t.mood).font(.h5Sans(rem(0.66))).italic().foregroundStyle(Color(hex: 0x6B5637)).padding(.top, 6)
            Spacer(minLength: 0)
        }
        .lineLimit(1)
        .padding(.vertical, 15)
        .padding(.horizontal, 17)
        .foregroundStyle(Color(hex: 0x46351F))
        .frame(width: 300, height: 355)
        .background {
            ZStack {
                LinearGradient(colors: [Color(hex: 0xEFE0C4), Color(hex: 0xDDC9A3)], startPoint: UnitPoint(x: 0.4, y: 0), endPoint: UnitPoint(x: 0.6, y: 1))
                RadialGradient(colors: [Color(hex: 0x966E3C, alpha: 0.24), .clear], center: UnitPoint(x: 0.78, y: 0.14), startRadius: 0, endRadius: 160)
                RadialGradient(colors: [Color(hex: 0x966E3C, alpha: 0.2), .clear], center: UnitPoint(x: 0.14, y: 0.84), startRadius: 0, endRadius: 150)
            }
        }
        .overlay { H5Glitter() }
        .clipShape(H5Polygon(points: Self.shape))
    }
}

private extension View {
    func sepia(_ amount: Double) -> some View {
        self.colorMultiply(Color(red: 1, green: 1 - 0.08 * amount * 2, blue: 1 - 0.25 * amount * 2)).saturation(1 - amount * 0.5)
    }
}

// MARK: - 荧光邮票 stamp-night

struct TkStampNight: View {
    @Environment(\.ticket) private var t

    var body: some View {
        let ice = Color(red: 170 / 255, green: 200 / 255, blue: 1)
        VStack(alignment: .leading, spacing: 9) {
            HStack(spacing: 8) {
                Text("CHINA POST")
                Spacer(minLength: 0)
                Text("FLUORESCENT")
            }
            .font(.h5Mono(rem(0.48)))
            .trackingEm(0.16, size: rem(0.48))
            .foregroundStyle(ice.opacity(0.75))
            H5Photo()
                .aspectRatio(4 / 5, contentMode: .fit)
                .clipShape(RoundedRectangle(cornerRadius: 3))
                .overlay(RoundedRectangle(cornerRadius: 3).strokeBorder(Color(red: 140 / 255, green: 180 / 255, blue: 1).opacity(0.42), lineWidth: 1))
                .shadow(color: Color(red: 90 / 255, green: 140 / 255, blue: 1).opacity(0.4), radius: 11)
            VStack(alignment: .leading, spacing: 2) {
                Text(t.title)
                    .font(.h5Serif(rem(1.22)))
                    .fontWeight(.bold)
                    .shadow(color: Color(red: 120 / 255, green: 170 / 255, blue: 1).opacity(0.6), radius: 6)
                Text(t.place).font(.h5Mono(rem(0.52))).trackingEm(0.14, size: rem(0.52)).foregroundStyle(ice.opacity(0.7))
            }
            HStack(spacing: 8) {
                Text(t.date)
                Spacer(minLength: 0)
                Text(t.seat)
            }
            .font(.h5Mono(rem(0.52)))
            .foregroundStyle(Color(red: 190 / 255, green: 214 / 255, blue: 1).opacity(0.8))
            .padding(.top, 8)
            .overlay(alignment: .top) { Rectangle().fill(Color(red: 120 / 255, green: 170 / 255, blue: 1).opacity(0.28)).frame(height: 1) }
            Text(t.mood).font(.h5Sans(rem(0.66))).italic().foregroundStyle(Color(red: 196 / 255, green: 214 / 255, blue: 1).opacity(0.72))
            Spacer(minLength: 0)
        }
        .lineLimit(1)
        .padding(16)
        .foregroundStyle(Color(hex: 0xDBE6FF))
        .frame(width: 292, height: 482)
        .background {
            ZStack {
                LinearGradient(colors: [Color(hex: 0x101A33), Color(hex: 0x070B16)], startPoint: UnitPoint(x: 0.37, y: 0), endPoint: UnitPoint(x: 0.63, y: 1))
                RadialGradient(colors: [Color(red: 96 / 255, green: 150 / 255, blue: 1).opacity(0.42), .clear], center: UnitPoint(x: 0.26, y: 0.14), startRadius: 0, endRadius: 250)
                RadialGradient(colors: [Color(red: 178 / 255, green: 110 / 255, blue: 1).opacity(0.34), .clear], center: UnitPoint(x: 0.84, y: 0.88), startRadius: 0, endRadius: 230)
            }
        }
        .overlay { H5Glitter() }
        .overlay {
            Rectangle()
                .strokeBorder(Color(red: 80 / 255, green: 130 / 255, blue: 1).opacity(0.3), lineWidth: 20)
                .blur(radius: 14)
        }
        .overlay(Rectangle().strokeBorder(Color(red: 120 / 255, green: 170 / 255, blue: 1).opacity(0.34), lineWidth: 1))
        .clipped()
    }
}

// MARK: - 三角邮票 stamp-tri

struct TkStampTri: View {
    @Environment(\.ticket) private var t

    private static let tri = pts([(48.1, 7.6), (51.9, 7.6), (95.1, 89.4), (93.2, 93), (6.8, 93), (4.9, 89.4)])

    var body: some View {
        VStack(spacing: 6) {
            Spacer(minLength: 0)
            H5Photo()
                .frame(width: 74, height: 74)
                .clipShape(RoundedRectangle(cornerRadius: 3))
                .overlay(RoundedRectangle(cornerRadius: 3).strokeBorder(Color(hex: 0x1F3050, alpha: 0.3), lineWidth: 1))
            Text(t.title).font(.h5Serif(rem(1.06))).fontWeight(.bold)
            Text("\(t.date) · \(t.seat)").font(.h5Mono(rem(0.5))).trackingEm(0.1, size: rem(0.5)).foregroundStyle(Color(hex: 0x5D729B))
        }
        .lineLimit(1)
        .multilineTextAlignment(.center)
        .padding(EdgeInsets(top: 0, leading: 30, bottom: 18, trailing: 30))
        .foregroundStyle(Color(hex: 0x1F3050))
        .frame(width: 296, height: 266)
        .overlay(alignment: .top) {
            Text("CHINA POST")
                .font(.h5Mono(rem(0.46)))
                .trackingEm(0.2, size: rem(0.46))
                .foregroundStyle(Color(hex: 0x6B82AA))
                .padding(.top, 266 * 0.21)
        }
        .background(LinearGradient(colors: [Color(hex: 0xF3F7FF), Color(hex: 0xDBE6F7)], startPoint: .top, endPoint: .bottom))
        .overlay { H5Glitter() }
        .clipShape(H5Polygon(points: Self.tri))
    }
}

// MARK: - 圆形邮票 stamp-round

struct TkStampRound: View {
    @Environment(\.ticket) private var t

    var body: some View {
        let brown = Color(hex: 0x8A7452)
        VStack(spacing: 8) {
            Text("CHINA POST").font(.h5Mono(rem(0.46))).trackingEm(0.2, size: rem(0.46)).foregroundStyle(brown)
            H5Photo().frame(width: 112, height: 112).clipShape(Circle())
            Text(t.title).font(.h5Serif(rem(1.12))).fontWeight(.bold)
            Text(t.place).font(.h5Mono(rem(0.5))).trackingEm(0.12, size: rem(0.5)).foregroundStyle(Color(hex: 0x7D6C56)).padding(.top, -6)
            Text(t.mood).font(.h5Sans(rem(0.62))).italic().foregroundStyle(Color(hex: 0x6A5D4C))
            Text("\(t.date) · \(t.seat)").font(.h5Mono(rem(0.46))).trackingEm(0.2, size: rem(0.46)).foregroundStyle(brown)
        }
        .lineLimit(1)
        .multilineTextAlignment(.center)
        .padding(36)
        .foregroundStyle(Color(hex: 0x2B2A26))
        .frame(width: 296, height: 296)
        .background(RadialGradient(stops: [.init(color: Color(hex: 0xFFFEF9), location: 0), .init(color: Color(hex: 0xEBE3D0), location: 0.78)], center: UnitPoint(x: 0.5, y: 0.38), startRadius: 0, endRadius: 210))
        .overlay {
            ZStack {
                Circle().strokeBorder(Color(hex: 0x826946, alpha: 0.3), lineWidth: 1)
                Circle().inset(by: 1).strokeBorder(Color(hex: 0xFBF6EA), lineWidth: 9)
                Circle().inset(by: 10).strokeBorder(Color(hex: 0x826946, alpha: 0.32), lineWidth: 1)
            }
        }
        .overlay { H5Glitter() }
        .clipShape(Circle())
    }
}

// MARK: - 六边邮票 stamp-hex

struct TkStampHex: View {
    @Environment(\.ticket) private var t

    private static let hex = pts([
        (23.8, 2.5), (28.8, 0), (72.5, 0), (76.3, 2.5), (98.8, 47.5), (98.8, 52.5),
        (76.3, 97.5), (72.5, 100), (27.5, 100), (23.8, 97.5), (1.3, 52.5), (1.3, 47.5),
    ])

    var body: some View {
        let meta = Color(hex: 0x5C5480)
        VStack(spacing: 7) {
            H5Photo()
                .frame(width: 116, height: 116)
                .clipShape(RoundedRectangle(cornerRadius: 4))
                .shadow(color: Color(hex: 0x463C6E, alpha: 0.28), radius: 8, y: 6)
            Text(t.title).font(.h5Serif(rem(1.1))).fontWeight(.bold)
            Text(t.place).font(.h5Mono(rem(0.5))).trackingEm(0.14, size: rem(0.5)).foregroundStyle(Color(hex: 0x6C6191)).padding(.top, -5)
            HStack(spacing: 10) {
                Text(t.date)
                Rectangle().fill(meta.opacity(0.35)).frame(width: 1, height: 10)
                Text(t.seat)
            }
            .font(.h5Mono(rem(0.5)))
            .trackingEm(0.1, size: rem(0.5))
            .foregroundStyle(meta)
        }
        .lineLimit(1)
        .multilineTextAlignment(.center)
        .padding(.vertical, 36)
        .padding(.horizontal, 34)
        .foregroundStyle(Color(hex: 0x2A2438))
        .frame(width: 300, height: 318)
        .background {
            AngularGradient(colors: [Color(hex: 0xEFE6FF), Color(hex: 0xFFE9E2), Color(hex: 0xE2F0FF), Color(hex: 0xE8FFF4), Color(hex: 0xEFE6FF)], center: .center, angle: .degrees(210 - 90))
        }
        .overlay { H5Glitter() }
        .clipShape(H5Polygon(points: Self.hex))
    }
}

// MARK: - 附捐邮票 stamp-tab

struct TkStampTab: View {
    @Environment(\.ticket) private var t

    var body: some View {
        let brown = Color(hex: 0x8A7452)
        VStack(spacing: 0) {
            VStack(spacing: 8) {
                H5Photo().aspectRatio(5 / 4, contentMode: .fit).clipShape(RoundedRectangle(cornerRadius: 2))
                HStack(alignment: .bottom, spacing: 10) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(t.title).font(.h5Serif(rem(1.14))).fontWeight(.bold)
                        Text(t.place).font(.h5Mono(rem(0.5))).trackingEm(0.14, size: rem(0.5)).foregroundStyle(brown)
                    }
                    Spacer(minLength: 0)
                    Text("120").font(.h5Mono(rem(1))).fontWeight(.bold).foregroundStyle(stampRed)
                }
            }
            .padding(10)
            .overlay(Rectangle().strokeBorder(Color(hex: 0x785A3C, alpha: 0.26), lineWidth: 1))
            VStack(alignment: .leading, spacing: 5) {
                Text("附捐 · SURTAX").font(.h5Mono(rem(0.46))).trackingEm(0.16, size: rem(0.46)).foregroundStyle(brown)
                Text(t.mood).font(.h5Sans(rem(0.64))).italic().foregroundStyle(Color(hex: 0x6A5D4C))
                HStack(spacing: 8) {
                    Text(t.date)
                    Spacer(minLength: 0)
                    Text(t.seat)
                }
                .font(.h5Mono(rem(0.5)))
                .foregroundStyle(Color(hex: 0x5C5145))
            }
            .padding(10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .overlay(alignment: .top) { H5Dash(color: Color(hex: 0x785A3C, alpha: 0.5), dash: [3, 3]).frame(height: 1) }
            .padding(.top, 9)
            Spacer(minLength: 0)
        }
        .lineLimit(1)
        .padding(11)
        .foregroundStyle(Color(hex: 0x2B2320))
        .frame(width: 300, height: 367)
        .background(Color(hex: 0xFBF7EE))
        .overlay(Rectangle().strokeBorder(Color(hex: 0x785A3C, alpha: 0.16), lineWidth: 1))
    }
}
