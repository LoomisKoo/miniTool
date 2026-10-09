import SwiftUI

// MARK: - 双联撕裂 cinema-tear

struct TkCinemaTear: View {
    @Environment(\.ticket) private var t

    var body: some View {
        VStack(spacing: 0) {
            H5Photo().frame(width: 320, height: 320)
            VStack(alignment: .leading, spacing: 5) {
                HStack {
                    HStack(spacing: 4) {
                        LIcon("film", size: 14)
                        Text("CINEMA")
                    }
                    Spacer()
                    Text(t.seat)
                }
                .font(.h5Sans(rem(0.7)))
                .trackingEm(0.06, size: rem(0.7))
                .foregroundStyle(Color(hex: 0x6A6258))
                Text(t.title)
                    .font(.h5Serif(rem(1.55)))
                    .fontWeight(.bold)
                HStack(spacing: 4) {
                    LIcon("map-pin", size: 14)
                    Text(t.place)
                }
                .font(.h5Sans(rem(0.86)))
                Text(t.date).font(.h5Sans(rem(0.86)))
                Text("「\(t.mood)」")
                    .font(.h5Sans(rem(0.86)))
                    .opacity(0.78)
                    .padding(.top, 4)
            }
            .lineLimit(1)
            .padding(EdgeInsets(top: 11, leading: 15, bottom: 8, trailing: 15))
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(alignment: .topLeading) { H5Dots() }

            H5Dash(color: Color(hex: 0x3C3228, alpha: 0.28), lineWidth: 2, dash: [5, 3])
                .padding(.horizontal, 14)

            VStack(alignment: .leading, spacing: 0) {
                Text("ADMIT ONE")
                    .font(.h5Sans(rem(0.65)))
                    .trackingEm(0.14, size: rem(0.65))
                    .foregroundStyle(Color(hex: 0x7A7166))
                Spacer(minLength: 0)
                HStack(alignment: .firstTextBaseline) {
                    Text(t.title).font(.h5Serif(rem(0.95)))
                    Spacer(minLength: 8)
                    Text(t.seat).font(.h5Sans(rem(0.72))).foregroundStyle(Color(hex: 0x5C554C))
                    Spacer(minLength: 8)
                    Text(t.date).font(.h5Sans(rem(0.72))).foregroundStyle(Color(hex: 0x5C554C))
                }
                .lineLimit(1)
                Spacer(minLength: 0)
                H5Barcode().frame(width: 56, height: 28)
            }
            .padding(EdgeInsets(top: 12, leading: 14, bottom: 14, trailing: 14))
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
            .background(LinearGradient(colors: [Color(hex: 0xEBE3D6), Color(hex: 0xE2D8C8)], startPoint: .top, endPoint: .bottom))
        }
        .foregroundStyle(Color.h5Ink)
        .frame(width: 320, height: 570)
        .background(Color.h5Paper)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .punched([
            Punch(center: { CGPoint(x: 14, y: $0.height - 103) }, radius: 9),
            Punch(center: { CGPoint(x: $0.width - 14, y: $0.height - 103) }, radius: 9),
        ])
    }
}

// MARK: - 拍立得卡 cinema-polaroid

struct TkCinemaPolaroid: View {
    @Environment(\.ticket) private var t

    var body: some View {
        VStack(spacing: 0) {
            H5Photo()
                .frame(width: 276, height: 276 * 1.15)
                .clipShape(RoundedRectangle(cornerRadius: 2))
            VStack(spacing: 0) {
                Text(t.title)
                    .font(.h5Serif(rem(1.4)))
                    .fontWeight(.bold)
                    .padding(.bottom, 6)
                Text("\(t.place) · \(t.date)")
                    .font(.h5Sans(rem(0.82)))
                    .foregroundStyle(Color(hex: 0x6A6258))
                    .padding(.bottom, 10)
                Text(t.mood)
                    .font(.h5Serif(rem(1.1), italic: true))
                    .opacity(0.78)
            }
            .lineLimit(1)
            .padding(EdgeInsets(top: 14, leading: 4, bottom: 2, trailing: 4))
        }
        .foregroundStyle(Color.h5Ink)
        .padding(EdgeInsets(top: 12, leading: 12, bottom: 16, trailing: 12))
        .frame(width: 300, height: 446, alignment: .top)
        .background {
            ZStack {
                Color.h5Paper
                H5Grid()
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
    }
}

// MARK: - 黑金巨幕 cinema-ovation

struct TkCinemaOvation: View {
    @Environment(\.ticket) private var t
    private let gold = Color(hex: 0xE8C27A)
    private let cream = Color(hex: 0xF6ECD8)

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("IMAX")
                    .font(.h5Mono(rem(0.78)))
                    .trackingEm(0.3, size: rem(0.78))
                Spacer()
                Text("PREMIERE")
                    .font(.h5Sans(rem(0.58)))
                    .trackingEm(0.16, size: rem(0.58))
                    .padding(.vertical, 3)
                    .padding(.horizontal, 8)
                    .overlay(Capsule().stroke(gold.opacity(0.5), lineWidth: 1))
            }
            .foregroundStyle(gold)
            .padding(.vertical, 12)
            .padding(.horizontal, 15)

            H5Photo().frame(width: 320, height: 200)

            VStack(alignment: .leading, spacing: 0) {
                Text(t.title)
                    .font(.h5Serif(rem(1.6)))
                    .fontWeight(.bold)
                    .padding(.bottom, 6)
                HStack(spacing: 4) {
                    LIcon("map-pin", size: 14)
                    Text(t.place)
                }
                .font(.h5Sans(rem(0.82)))
                .foregroundStyle(cream.opacity(0.6))

                HStack {
                    Text("SEAT")
                        .font(.h5Sans(rem(0.6)))
                        .trackingEm(0.2, size: rem(0.6))
                        .foregroundStyle(gold)
                    Spacer()
                    Text(t.seat)
                        .font(.h5Mono(rem(1), .bold))
                }
                .padding(.vertical, 10)
                .padding(.horizontal, 13)
                .background(gold.opacity(0.08), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(gold.opacity(0.22), lineWidth: 1))
                .padding(.top, 13)
                .padding(.bottom, 12)

                H5Dash(color: gold.opacity(0.24), lineWidth: 1, dash: [3, 3])
                HStack {
                    Text(t.date).foregroundStyle(cream.opacity(0.72))
                    Spacer(minLength: 10)
                    Text(t.mood).italic().foregroundStyle(cream.opacity(0.45))
                }
                .font(.h5Sans(rem(0.75)))
                .padding(.top, 10)
            }
            .lineLimit(1)
            .padding(EdgeInsets(top: 14, leading: 16, bottom: 16, trailing: 16))
        }
        .foregroundStyle(cream)
        .frame(width: 320, height: 423, alignment: .top)
        .background(LinearGradient(colors: [Color(hex: 0x1C1813), Color(hex: 0x0E0C09)], startPoint: UnitPoint(x: 0.41, y: 0), endPoint: UnitPoint(x: 0.59, y: 1)))
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(gold.opacity(0.22), lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .punched(LeftHoles.holes)
    }
}

enum LeftHoles {
    static let holes = [
        Punch(center: { CGPoint(x: 14, y: $0.height * 0.3) }, radius: 8),
        Punch(center: { CGPoint(x: 14, y: $0.height * 0.7) }, radius: 8),
    ]
    static let right = [
        Punch(center: { CGPoint(x: $0.width - 14, y: $0.height * 0.3) }, radius: 8),
        Punch(center: { CGPoint(x: $0.width - 14, y: $0.height * 0.7) }, radius: 8),
    ]
}

// MARK: - 胶片齿孔 cinema-filmstrip

struct TkCinemaFilmstrip: View {
    @Environment(\.ticket) private var t

    var body: some View {
        VStack(spacing: 0) {
            H5Photo()
                .saturation(0.9)
                .contrast(1.05)
                .frame(width: 268, height: 201)
                .clipShape(RoundedRectangle(cornerRadius: 4))
            VStack(spacing: 0) {
                Text(t.title)
                    .font(.h5Mono(rem(1.02), .bold))
                    .trackingEm(0.06, size: rem(1.02))
                    .padding(.bottom, 7)
                Text(t.place).font(.h5Sans(rem(0.75))).foregroundStyle(Color(hex: 0x6A6258))
                Text("\(t.date) · \(t.seat)").font(.h5Sans(rem(0.75))).foregroundStyle(Color(hex: 0x6A6258))
                Text("「\(t.mood)」")
                    .font(.h5Sans(rem(0.83)))
                    .opacity(0.78)
                    .padding(.top, 10)
            }
            .lineLimit(1)
            .padding(.top, 13)
            H5Barcode(color: Color(hex: 0x262019, alpha: 0.5), bar: 6, period: 12)
                .frame(height: 6)
                .clipShape(Capsule())
                .padding(.top, 13)
        }
        .foregroundStyle(Color.h5Ink)
        .padding(EdgeInsets(top: 14, leading: 26, bottom: 16, trailing: 26))
        .frame(width: 320, height: 352, alignment: .top)
        .background {
            ZStack {
                LinearGradient(colors: [Color(hex: 0xF3ECDF), Color(hex: 0xE6DDCB)], startPoint: .top, endPoint: .bottom)
                HStack {
                    FilmHoles()
                    Spacer()
                    FilmHoles()
                }
                .padding(.horizontal, 6)
                .padding(.vertical, 6)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }
}

struct FilmHoles: View {
    var color = Color(hex: 0x262019)
    var width: CGFloat = 12
    var period: CGFloat = 18

    var body: some View {
        Canvas { ctx, size in
            var y: CGFloat = 0
            let r = width * 0.44
            while y + period <= size.height + 0.1 {
                let c = CGPoint(x: size.width / 2, y: y + period / 2)
                ctx.fill(Path(ellipseIn: CGRect(x: c.x - r, y: c.y - r, width: r * 2, height: r * 2)), with: .color(color))
                y += period
            }
        }
        .frame(width: width)
        .opacity(0.7)
    }
}

// MARK: - 竖版海报 cinema-poster

struct TkCinemaPoster: View {
    @Environment(\.ticket) private var t
    private let gold = Color(hex: 0xE8C27A)
    private let cream = Color(hex: 0xF6EFE3)

    var body: some View {
        VStack(spacing: 0) {
            ZStack(alignment: .bottomLeading) {
                H5Photo().frame(width: 320, height: 480)
                VStack(alignment: .leading, spacing: 0) {
                    Text("NOW SHOWING")
                        .font(.h5Sans(rem(0.58)))
                        .trackingEm(0.26, size: rem(0.58))
                        .foregroundStyle(gold)
                        .padding(.bottom, 7)
                    Text(t.title)
                        .font(.h5Serif(rem(1.74)))
                        .fontWeight(.bold)
                    Text(t.place)
                        .font(.h5Sans(rem(0.78)))
                        .foregroundStyle(cream.opacity(0.66))
                        .padding(.top, 6)
                }
                .lineLimit(1)
                .padding(EdgeInsets(top: 44, leading: 18, bottom: 16, trailing: 18))
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(LinearGradient(colors: [Color(hex: 0x14110D, alpha: 0), Color(hex: 0x14110D, alpha: 0.94)], startPoint: .top, endPoint: .bottom))
            }
            VStack(alignment: .leading, spacing: 8) {
                PosterRow(label: "SHOWTIME", value: t.date, gold: gold, cream: cream)
                PosterRow(label: "HALL / SEAT", value: t.seat, gold: gold, cream: cream)
                Text("「\(t.mood)」")
                    .font(.h5Sans(rem(0.83)))
                    .italic()
                    .foregroundStyle(cream.opacity(0.7))
                    .lineLimit(1)
                    .padding(.top, 4)
            }
            .padding(EdgeInsets(top: 14, leading: 18, bottom: 18, trailing: 18))
        }
        .foregroundStyle(cream)
        .frame(width: 320, height: 600, alignment: .top)
        .background(Color(hex: 0x14110D))
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        .punched(LeftHoles.holes)
    }
}

private struct PosterRow: View {
    let label: String
    let value: String
    let gold: Color
    let cream: Color

    var body: some View {
        VStack(spacing: 7) {
            HStack(alignment: .firstTextBaseline) {
                Text(label)
                    .font(.h5Sans(rem(0.58)))
                    .trackingEm(0.12, size: rem(0.58))
                    .foregroundStyle(gold)
                Spacer(minLength: 10)
                Text(value)
                    .font(.h5Mono(rem(0.76), .medium))
                    .lineLimit(1)
            }
            H5Dash(color: cream.opacity(0.18), lineWidth: 1, dash: [1, 2])
        }
    }
}

// MARK: - 长廊巨幕 cinema-cinescope

struct TkCinemaCinescope: View {
    @Environment(\.ticket) private var t
    private let fg = Color(hex: 0xECEAF2)

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("CINEMASCOPE 2.39:1")
                Spacer()
                Text("REC").foregroundStyle(Color(hex: 0xFF6B6B))
            }
            .font(.h5Mono(rem(0.58)))
            .trackingEm(0.18, size: rem(0.58))
            .foregroundStyle(Color(hex: 0x8F9BB8))
            .padding(.vertical, 11)
            .padding(.horizontal, 14)

            H5Photo().frame(width: 320, height: 320 * 9 / 21)

            VStack(alignment: .leading, spacing: 0) {
                Text(t.title)
                    .font(.h5Serif(rem(1.5)))
                    .fontWeight(.bold)
                    .padding(.bottom, 5)
                Text(t.place)
                    .font(.h5Sans(rem(0.8)))
                    .foregroundStyle(fg.opacity(0.6))
                HStack {
                    Text(t.date)
                    Spacer(minLength: 10)
                    Text(t.seat)
                }
                .font(.h5Mono(rem(0.72)))
                .foregroundStyle(Color(hex: 0xA8C8FF))
                .padding(.vertical, 9)
                .overlay(alignment: .top) { Rectangle().fill(.white.opacity(0.1)).frame(height: 1) }
                .overlay(alignment: .bottom) { Rectangle().fill(.white.opacity(0.1)).frame(height: 1) }
                .padding(.top, 12)
                .padding(.bottom, 10)
                Text(t.mood)
                    .font(.h5Sans(rem(0.8)))
                    .foregroundStyle(fg.opacity(0.55))
            }
            .lineLimit(1)
            .padding(EdgeInsets(top: 15, leading: 16, bottom: 18, trailing: 16))
        }
        .foregroundStyle(fg)
        .frame(width: 320, height: 331, alignment: .top)
        .background(Color(hex: 0x0B0B0E))
        .overlay(RoundedRectangle(cornerRadius: 6, style: .continuous).strokeBorder(.white.opacity(0.07), lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
        .punched(LeftHoles.right)
    }
}

// MARK: - 双栏票卡 cinema-double

struct TkCinemaDouble: View {
    @Environment(\.ticket) private var t

    var body: some View {
        HStack(spacing: 0) {
            H5Photo()
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                .padding(12)
                .frame(width: 160)
                .frame(maxHeight: .infinity)
                .background(Color.black.opacity(0.03))
                .overlay(alignment: .trailing) {
                    H5Dash(color: Color(hex: 0x3C3228, alpha: 0.3), lineWidth: 1, dash: [3, 3], vertical: true)
                }
            VStack(alignment: .leading, spacing: 7) {
                Text("ADMIT ONE")
                    .font(.h5Sans(rem(0.55)))
                    .trackingEm(0.22, size: rem(0.55))
                    .foregroundStyle(Color(hex: 0x9A4030))
                Text(t.title)
                    .font(.h5Serif(rem(1.32)))
                    .fontWeight(.bold)
                    .lineLimit(2)
                Text(t.place).font(.h5Sans(rem(0.74))).foregroundStyle(Color(hex: 0x6A6258)).lineLimit(1)
                Text(t.date).font(.h5Mono(rem(0.68))).foregroundStyle(Color(hex: 0x4A443C)).lineLimit(1)
                Text(t.seat).font(.h5Mono(rem(0.68))).foregroundStyle(Color(hex: 0x4A443C)).lineLimit(1)
                Spacer(minLength: 0)
                Text("「\(t.mood)」")
                    .font(.h5Sans(rem(0.78)))
                    .lineSpacing(rem(0.78) * 0.3)
                    .foregroundStyle(Color(hex: 0x5F574C))
                    .lineLimit(2)
            }
            .padding(.vertical, 16)
            .padding(.horizontal, 14)
            .frame(width: 160, alignment: .leading)
            .frame(maxHeight: .infinity, alignment: .top)
        }
        .foregroundStyle(Color.h5Ink)
        .frame(width: 320, height: 214)
        .background(LinearGradient(colors: [Color(hex: 0xF7F2E8), Color(hex: 0xECE3D3)], startPoint: .top, endPoint: .bottom))
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}

// MARK: - 存根联票 cinema-stubpair

struct TkCinemaStubpair: View {
    @Environment(\.ticket) private var t

    var body: some View {
        HStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 7) {
                Text("ADMIT ONE")
                    .font(.h5Sans(rem(0.56)))
                    .trackingEm(0.24, size: rem(0.56))
                    .foregroundStyle(Color(hex: 0x9A4030))
                Text(t.title).font(.h5Serif(rem(1.5))).fontWeight(.bold).lineLimit(2)
                HStack(spacing: 4) {
                    LIcon("map-pin", size: 14)
                    Text(t.place)
                }
                .font(.h5Sans(rem(0.78)))
                .foregroundStyle(Color(hex: 0x6A6258))
                Group {
                    Text(t.date)
                    Text(t.seat)
                }
                .font(.h5Mono(rem(0.7)))
                .foregroundStyle(Color(hex: 0x4A443C))
                Spacer(minLength: 0)
                Text("「\(t.mood)」")
                    .font(.h5Sans(rem(0.79)))
                    .italic()
                    .foregroundStyle(Color(hex: 0x5F574C))
                    .lineLimit(2)
            }
            .lineLimit(1)
            .padding(EdgeInsets(top: 20, leading: 20, bottom: 20, trailing: 18))
            .frame(width: 196, alignment: .leading)
            .frame(maxHeight: .infinity, alignment: .top)

            VStack(spacing: 10) {
                H5Photo()
                    .aspectRatio(3 / 4, contentMode: .fit)
                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                Spacer(minLength: 0)
                Text("NO.A204")
                    .font(.h5Mono(rem(0.6)))
                    .trackingEm(0.1, size: rem(0.6))
                    .foregroundStyle(Color(hex: 0x7A7166))
                    .fixedSize()
                    .rotationEffect(.degrees(90))
                    .frame(width: 12, height: 64)
            }
            .padding(.vertical, 18)
            .padding(.horizontal, 12)
            .frame(width: 124)
            .frame(maxHeight: .infinity)
            .background(Color(hex: 0x141210, alpha: 0.045))
        }
        .overlay(alignment: .topLeading) {
            H5Dash(color: Color(hex: 0x3C3228, alpha: 0.32), lineWidth: 2, dash: [5, 3], vertical: true)
                .frame(width: 2)
                .padding(.vertical, 26)
                .offset(x: 196)
        }
        .foregroundStyle(Color(hex: 0x26201A))
        .frame(width: 320, height: 226)
        .background {
            ZStack {
                LinearGradient(colors: [Color(hex: 0xF9F5EC), Color(hex: 0xEEE5D5)], startPoint: .top, endPoint: .bottom)
                H5Stripes(color: Color(hex: 0x141210), angle: 115, line: 6, period: 14, opacity: 0.035)
            }
        }
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Color(hex: 0x141210, alpha: 0.06), lineWidth: 1))
        .overlay { H5Glitter() }
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .punched([
            Punch(x: 196, y: 26, r: 8),
            Punch(center: { CGPoint(x: 196, y: $0.height - 26) }, radius: 8),
        ])
    }
}

// MARK: - 经典红票 cinema-redclassic

struct TkCinemaRedclassic: View {
    @Environment(\.ticket) private var t

    var body: some View {
        let cream = Color(hex: 0xFFECCD)
        VStack(spacing: 0) {
            Text("CINEMA TICKET")
                .font(.h5Sans(rem(0.56)))
                .trackingEm(0.3, size: rem(0.56))
                .foregroundStyle(Color(hex: 0xF0C98A))
            H5Photo()
                .frame(width: 132, height: 132)
                .clipShape(Circle())
                .overlay(Circle().inset(by: -4).strokeBorder(Color(hex: 0xFFDCA0, alpha: 0.5), lineWidth: 4))
                .shadow(color: .black.opacity(0.35), radius: 10, y: 8)
                .padding(.top, 12)
                .padding(.bottom, 2)
            Text(t.title)
                .font(.h5Serif(rem(1.62)))
                .fontWeight(.bold)
                .shadow(color: .black.opacity(0.35), radius: 0, y: 1)
                .padding(.top, 10)
                .padding(.bottom, 8)
            Text(t.place).font(.h5Sans(rem(0.76))).foregroundStyle(cream.opacity(0.72))
            HStack(spacing: 14) {
                Text(t.date)
                Text(t.seat)
            }
            .font(.h5Mono(rem(0.7)))
            .foregroundStyle(Color(hex: 0xFFE0AE))
            .padding(.top, 14)
            Text("「\(t.mood)」")
                .font(.h5Sans(rem(0.8)))
                .italic()
                .foregroundStyle(cream.opacity(0.66))
                .padding(.top, 12)
                .frame(maxWidth: .infinity)
                .overlay(alignment: .top) { Rectangle().fill(Color(hex: 0xFFDEA8, alpha: 0.28)).frame(height: 1) }
                .padding(.top, 14)
        }
        .lineLimit(1)
        .multilineTextAlignment(.center)
        .padding(EdgeInsets(top: 14, leading: 12, bottom: 16, trailing: 12))
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .overlay(RoundedRectangle(cornerRadius: 6).strokeBorder(Color(hex: 0xFFDEA8, alpha: 0.55), style: StrokeStyle(lineWidth: 1, dash: [3, 3])))
        .padding(EdgeInsets(top: 26, leading: 22, bottom: 24, trailing: 22))
        .foregroundStyle(cream)
        .frame(width: 320, height: 378)
        .background {
            ZStack {
                RadialGradient(colors: [Color(hex: 0xB2352A), Color(hex: 0x7C1B16)], center: .top, startRadius: 0, endRadius: 378 * 0.72)
                H5Stripes(color: .white, angle: 0, line: 2, period: 7, opacity: 0.05)
                H5Grid(color: Color(red: 232 / 255, green: 194 / 255, blue: 122 / 255), step: 26, opacity: 0.16 * 0.6).blendMode(.screen)
            }
        }
        .overlay { H5Glitter() }
        .overlay { RadialGradient(colors: [.clear, .black.opacity(0.2)], center: UnitPoint(x: 0.5, y: 0.44), startRadius: 120, endRadius: 260) }
        .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).strokeBorder(Color(hex: 0xFFDCA0, alpha: 0.28), lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        .punched([Punch(x: 14, y: 189, r: 8), Punch(x: 306, y: 189, r: 8)])
    }
}

// MARK: - 档案卡 cinema-archive

struct TkCinemaArchive: View {
    @Environment(\.ticket) private var t

    var body: some View {
        let red = Color(hex: 0xA8382C)
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .firstTextBaseline, spacing: 10) {
                Text("ARCHIVE / CINEMA").font(.h5Mono(rem(0.6))).trackingEm(0.2, size: rem(0.6)).foregroundStyle(red)
                Spacer(minLength: 0)
                Text("FILE NO.B073").font(.h5Mono(rem(0.58))).foregroundStyle(Color(hex: 0x7A7468))
            }
            .padding(.bottom, 9)
            .overlay(alignment: .bottom) { Rectangle().fill(red).frame(height: 3) }
            .padding(.bottom, 14)
            H5Photo()
                .aspectRatio(16 / 10, contentMode: .fit)
                .saturation(0.85)
                .clipShape(RoundedRectangle(cornerRadius: 3))
            Text(t.title)
                .font(.h5Mono(rem(1.26)))
                .fontWeight(.bold)
                .padding(.top, 10)
                .padding(.bottom, 8)
            VStack(alignment: .leading, spacing: 7) {
                row("CINEMA", t.place)
                row("SHOWTIME", t.date)
                row("SEAT", t.seat)
            }
            .padding(.top, 6)
            Text("FILED")
                .font(.h5Mono(rem(0.58)))
                .trackingEm(0.16, size: rem(0.58))
                .foregroundStyle(red.opacity(0.8))
                .padding(.vertical, 5)
                .padding(.horizontal, 10)
                .overlay(RoundedRectangle(cornerRadius: 3).strokeBorder(red.opacity(0.55), lineWidth: 2))
                .rotationEffect(.degrees(-3))
                .padding(.top, 14)
            Text(t.mood)
                .font(.h5Sans(rem(0.78)))
                .italic()
                .foregroundStyle(Color(hex: 0x5C6156))
                .padding(.top, 12)
        }
        .lineLimit(1)
        .padding(EdgeInsets(top: 18, leading: 46, bottom: 18, trailing: 18))
        .foregroundStyle(Color(hex: 0x262B2F))
        .frame(width: 320, height: 402, alignment: .top)
        .background {
            ZStack {
                LinearGradient(colors: [Color(hex: 0xFDFCF7), Color(hex: 0xF3EFE3)], startPoint: .top, endPoint: .bottom)
                RuledLines(color: Color(red: 60 / 255, green: 90 / 255, blue: 140 / 255).opacity(0.15), step: 26)
                H5Dots()
            }
        }
        .overlay(Rectangle().strokeBorder(Color(hex: 0x28323C, alpha: 0.1), lineWidth: 1))
        .punched([Punch(x: 22, y: 34, r: 6), Punch(x: 22, y: 66, r: 6)])
    }

    private func row(_ key: String, _ value: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 9) {
            Text(key)
                .font(.h5Mono(rem(0.56)))
                .trackingEm(0.1, size: rem(0.56))
                .foregroundStyle(Color(hex: 0x8A857A))
                .frame(width: 62, alignment: .leading)
            Text(value).font(.h5Mono(rem(0.72))).fontWeight(.medium)
        }
    }
}

/// 横格纸：每 step 一条 1px 线（线在格底）
struct RuledLines: View {
    var color: Color
    var step: CGFloat = 26

    var body: some View {
        Canvas { ctx, size in
            var path = Path()
            var y = step - 1
            while y < size.height {
                path.addRect(CGRect(x: 0, y: y, width: size.width, height: 1))
                y += step
            }
            ctx.fill(path, with: .color(color))
        }
        .allowsHitTesting(false)
    }
}

// MARK: - 锯齿影票 card-reel

struct TkCardReel: View {
    @Environment(\.ticket) private var t

    var body: some View {
        let dash = H5Dash(color: Color(hex: 0x9E2E34, alpha: 0.5), lineWidth: 2, dash: [4, 3], vertical: true).frame(width: 2).padding(.vertical, 2)
        HStack(spacing: 11) {
            LIcon("film", size: 27)
                .foregroundStyle(Color(hex: 0xF4EAD7))
                .frame(width: 48, height: 48)
                .background(RadialGradient(colors: [Color(hex: 0x453A33), Color(hex: 0x201914)], center: UnitPoint(x: 0.36, y: 0.3), startRadius: 0, endRadius: 34), in: Circle())
                .overlay(Circle().strokeBorder(Color(hex: 0xFFF0D2, alpha: 0.25), lineWidth: 1))
            dash
            H5Photo()
                .aspectRatio(4 / 3, contentMode: .fit)
                .clipShape(RoundedRectangle(cornerRadius: 3))
                .overlay(RoundedRectangle(cornerRadius: 3).strokeBorder(Color(hex: 0x786E5E, alpha: 0.45), lineWidth: 1))
                .frame(maxWidth: .infinity)
                .layoutPriority(1.12)
            dash
            VStack(alignment: .leading, spacing: 5) {
                Text(t.title.uppercased())
                    .font(.h5Serif(rem(0.82)))
                    .trackingEm(0.06, size: rem(0.82))
                reelRow(t.place)
                reelRow(t.date)
                reelRow("ADMIT ONE · \(t.seat)")
                Text(t.mood).font(.h5Sans(rem(0.55))).italic().foregroundStyle(Color(hex: 0x7A6549)).padding(.top, 1)
            }
            .lineLimit(1)
            .frame(maxWidth: .infinity, alignment: .leading)
            .layoutPriority(1)
        }
        .padding(.vertical, 12)
        .padding(.horizontal, 14)
        .frame(maxHeight: .infinity)
        .background(LinearGradient(colors: [Color(hex: 0xF5ECD9), Color(hex: 0xECE0C8)], startPoint: .top, endPoint: .bottom), in: RoundedRectangle(cornerRadius: 7))
        .overlay(RoundedRectangle(cornerRadius: 7).strokeBorder(Color(hex: 0xA32A30, alpha: 0.55), lineWidth: 1))
        .overlay(RoundedRectangle(cornerRadius: 7).inset(by: 1).strokeBorder(.white.opacity(0.45), lineWidth: 2))
        .padding(13)
        .foregroundStyle(Color(hex: 0x2B231B))
        .frame(width: 404, height: 151)
        .background(LinearGradient(colors: [Color(hex: 0xC9343D), Color(hex: 0xA62028)], startPoint: .top, endPoint: .bottom))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .mask(SideScallops(step: 11, radius: 3.5).fill(style: FillStyle(eoFill: true)))
    }

    private func reelRow(_ text: String) -> some View {
        Text(text)
            .font(.h5Mono(rem(0.55)))
            .fontWeight(.bold)
            .trackingEm(0.08, size: rem(0.55))
            .padding(.top, 4)
            .frame(maxWidth: .infinity, alignment: .leading)
            .overlay(alignment: .top) { Rectangle().fill(Color(hex: 0x2B231B, alpha: 0.28)).frame(height: 1) }
    }
}

// MARK: - 双联票 cinema-twoup

struct TkCinemaTwoup: View {
    @Environment(\.ticket) private var t

    var body: some View {
        HStack(spacing: 0) {
            pane("ADMIT ONE", slot: 0)
            pane("ADMIT TWO", slot: 1)
                .background(Color(hex: 0x3C2D19, alpha: 0.06))
                .overlay(alignment: .leading) {
                    H5Dash(color: Color(hex: 0x5A503C, alpha: 0.38), lineWidth: 2, dash: [5, 3], vertical: true).frame(width: 2)
                }
        }
        .foregroundStyle(Color(hex: 0x2B241C))
        .frame(width: 336, height: 283)
        .background(Color(hex: 0xF8F3E8))
        .overlay { H5Glitter() }
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(Color(hex: 0x5A503C, alpha: 0.16), lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .punched([Punch(x: 168, y: 0, r: 8), Punch(x: 168, y: 283, r: 8)])
    }

    private func pane(_ tag: String, slot: Int) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(tag).font(.h5Mono(rem(0.5))).trackingEm(0.2, size: rem(0.5)).foregroundStyle(Color(hex: 0x8A8172))
            H5Photo(slot: slot)
                .aspectRatio(1, contentMode: .fit)
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            Text(t.title).font(.h5Serif(rem(1.08))).fontWeight(.bold)
            Text(t.place).font(.h5Sans(rem(0.68))).foregroundStyle(Color(hex: 0x6F675A))
            HStack(spacing: 8) {
                Text(t.date)
                Spacer(minLength: 0)
                Text(t.seat)
            }
            .font(.h5Mono(rem(0.6)))
            .padding(.top, 6)
            .overlay(alignment: .top) { H5Dash(color: Color(hex: 0x5A503C, alpha: 0.34), dash: [1, 2]).frame(height: 1) }
        }
        .lineLimit(1)
        .padding(EdgeInsets(top: 14, leading: 13, bottom: 16, trailing: 13))
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }
}

// MARK: - 三联副券 cinema-threestub

struct TkCinemaThreestub: View {
    @Environment(\.ticket) private var t

    var body: some View {
        let muted = Color(hex: 0x6F675A)
        VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 9) {
                H5Photo()
                    .aspectRatio(16 / 9, contentMode: .fit)
                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                Text(t.title).font(.h5Serif(rem(1.32))).fontWeight(.bold)
                Text(t.place).font(.h5Sans(rem(0.72))).foregroundStyle(muted)
                HStack(spacing: 8) {
                    Text(t.date)
                    Spacer(minLength: 0)
                    Text(t.seat)
                }
                .font(.h5Mono(rem(0.6)))
                .padding(.top, 6)
                .overlay(alignment: .top) { H5Dash(color: Color(hex: 0x5A503C, alpha: 0.34), dash: [1, 2]).frame(height: 1) }
                Text(t.mood).font(.h5Sans(rem(0.72))).foregroundStyle(muted)
            }
            .lineLimit(1)
            .padding(EdgeInsets(top: 16, leading: 18, bottom: 15, trailing: 18))
            .frame(maxHeight: .infinity, alignment: .top)

            HStack(spacing: 0) {
                stub("STUB 01", t.seat)
                stub("STUB 02", t.date).overlay(alignment: .leading) { divider }
                stub("STUB 03", "NO.003").overlay(alignment: .leading) { divider }
            }
            .overlay(alignment: .top) { H5Dash(color: Color(hex: 0x5A503C, alpha: 0.42), lineWidth: 2, dash: [5, 3]).frame(height: 2) }
        }
        .foregroundStyle(Color(hex: 0x2B241C))
        .frame(width: 322, height: 378)
        .background(Color(hex: 0xF7F2E8))
        .overlay { H5Glitter() }
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(Color(hex: 0x5A503C, alpha: 0.16), lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .punched([Punch(x: 322 / 3, y: 378, r: 7), Punch(x: 322 * 2 / 3, y: 378, r: 7)])
    }

    private var divider: some View {
        H5Dash(color: Color(hex: 0x5A503C, alpha: 0.34), dash: [3, 3], vertical: true).frame(width: 1)
    }

    private func stub(_ key: String, _ value: String) -> some View {
        VStack(spacing: 4) {
            Text(key).font(.h5Mono(rem(0.46))).trackingEm(0.14, size: rem(0.46)).foregroundStyle(Color(hex: 0x8A8172))
            Text(value).font(.h5Mono(rem(0.6))).fontWeight(.semibold).lineLimit(1).minimumScaleFactor(0.8)
        }
        .padding(EdgeInsets(top: 11, leading: 8, bottom: 15, trailing: 8))
        .frame(maxWidth: .infinity)
    }
}

// MARK: - 拼版小票 cinema-sheet

struct TkCinemaSheet: View {
    @Environment(\.ticket) private var t

    var body: some View {
        VStack(spacing: 10) {
            HStack(spacing: 8) {
                Text("SHEET · 4 UP")
                Spacer(minLength: 0)
                Text(t.date)
            }
            .font(.h5Mono(rem(0.52)))
            .trackingEm(0.16, size: rem(0.52))
            .foregroundStyle(Color(hex: 0x8A8172))
            Grid(horizontalSpacing: 10, verticalSpacing: 10) {
                GridRow {
                    cell {
                        photo(0)
                        Text(t.title).font(.h5Serif(rem(0.96))).fontWeight(.bold)
                    }
                    cell {
                        note("CINEMA"); note(t.place); note(t.seat)
                    }
                }
                GridRow {
                    cell {
                        note("SHOWTIME"); note(t.date); note("ADMIT ONE")
                    }
                    cell {
                        photo(1)
                        Text(t.mood).font(.h5Sans(rem(0.64))).italic().foregroundStyle(Color(hex: 0x6F675A))
                    }
                }
            }
        }
        .lineLimit(1)
        .padding(14)
        .foregroundStyle(Color(hex: 0x2B241C))
        .frame(width: 334, height: 334, alignment: .top)
        .background(Color(hex: 0xEFE9DC))
        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(Color(hex: 0x5A503C, alpha: 0.16), lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private func photo(_ slot: Int) -> some View {
        H5Photo(slot: slot)
            .aspectRatio(4 / 3, contentMode: .fit)
            .clipShape(RoundedRectangle(cornerRadius: 4))
    }

    private func note(_ text: String) -> some View {
        Text(text).font(.h5Mono(rem(0.52))).trackingEm(0.1, size: rem(0.52)).foregroundStyle(Color(hex: 0x8A8172))
    }

    private func cell<V: View>(@ViewBuilder _ content: () -> V) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            content()
        }
        .padding(9)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(Color(hex: 0xFBF8F1), in: RoundedRectangle(cornerRadius: 6))
        .overlay(RoundedRectangle(cornerRadius: 6).strokeBorder(Color(hex: 0x5A503C, alpha: 0.42), style: StrokeStyle(lineWidth: 1, dash: [3, 3])))
    }
}

// MARK: - 宽幅影票 card-filmwide（.tk-widecard 共用）

struct TkWideCard: View {
    @Environment(\.ticket) private var t
    var ratio: CGFloat = 21 / 9
    var bg: UInt32 = 0xD9CDB4
    var ink: UInt32 = 0x3B3225
    var accent: UInt32 = 0x8A7A56
    var bodyTint: Color = Color(red: 1, green: 248 / 255, blue: 228 / 255).opacity(0.42)
    var cells: [(String, KeyPath<TicketContext, String>)] = [("FILM:", \.title), ("CINEMA:", \.place), ("SCREEN / DATE:", \.date), ("ROW / SEAT:", \.seat)]
    var icon = "clapperboard"
    var radius: CGFloat = 12
    var notches = false

    var body: some View {
        let size = t.template.size
        VStack(spacing: 0) {
            H5Photo()
                .aspectRatio(ratio, contentMode: .fit)
                .clipped()
                .overlay(alignment: .bottom) {
                    if notches {
                        HStack {
                            notch.offset(x: -9)
                            Spacer()
                            notch.offset(x: 9)
                        }
                        .offset(y: 9)
                    }
                }
                .zIndex(1)
            VStack(spacing: 10) {
                Grid(horizontalSpacing: 14, verticalSpacing: 9) {
                    GridRow {
                        kv(cells[0].0, t[keyPath: cells[0].1])
                        kv(cells[1].0, t[keyPath: cells[1].1])
                    }
                    GridRow {
                        kv(cells[2].0, t[keyPath: cells[2].1])
                        kv(cells[3].0, t[keyPath: cells[3].1])
                    }
                }
                HStack(spacing: 12) {
                    Text("ADMIT ONE")
                        .font(.h5Mono(rem(0.66)))
                        .fontWeight(.bold)
                        .trackingEm(0.16, size: rem(0.66))
                        .fixedSize()
                    Text(t.mood).font(.h5Sans(rem(0.68))).italic().opacity(0.78).lineLimit(1)
                    Spacer(minLength: 0)
                    LIcon(icon, size: 20).opacity(0.45)
                }
                .padding(.top, 10)
                .overlay(alignment: .top) { H5Dash(color: .black.opacity(0.22), dash: [3, 3]).frame(height: 1) }
            }
            .padding(EdgeInsets(top: 14, leading: 16, bottom: 16, trailing: 16))
            .frame(maxHeight: .infinity, alignment: .top)
            .background(bodyTint)
        }
        .foregroundStyle(Color(hex: ink))
        .frame(width: size.width, height: size.height, alignment: .top)
        .background(Color(hex: bg))
        .overlay { H5Glitter() }
        .overlay(RoundedRectangle(cornerRadius: radius, style: .continuous).strokeBorder(Color(hex: 0x786446, alpha: 0.2), lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: radius, style: .continuous))
    }

    private var notch: some View {
        Circle().fill(Color(hex: 0x141E28, alpha: 0.36)).frame(width: 18, height: 18)
    }

    private func kv(_ key: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(key).font(.h5Mono(rem(0.48))).trackingEm(0.14, size: rem(0.48)).foregroundStyle(Color(hex: accent))
            Text(value)
                .font(.h5Mono(rem(0.68)))
                .fontWeight(.semibold)
                .lineLimit(2)
                .padding(.bottom, 4)
                .frame(maxWidth: .infinity, alignment: .leading)
                .overlay(alignment: .bottom) { Rectangle().fill(.black.opacity(0.18)).frame(height: 1) }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - 古典花框 card-ornate

struct TkCardOrnate: View {
    @Environment(\.ticket) private var t

    var body: some View {
        let line = Color(hex: 0x98896A, alpha: 0.55)
        let accent = Color(hex: 0xB9A67C)
        HStack(spacing: 16) {
            VStack(alignment: .leading, spacing: 9) {
                H5Photo()
                    .aspectRatio(16 / 9, contentMode: .fit)
                    .clipShape(RoundedRectangle(cornerRadius: 4))
                    .padding(3)
                    .background(Color(hex: 0xF9F5EC), in: RoundedRectangle(cornerRadius: 6))
                    .overlay(RoundedRectangle(cornerRadius: 7).inset(by: -0.5).strokeBorder(Color(hex: 0x98896A, alpha: 0.5), lineWidth: 1))
                Text(t.mood).font(.h5Sans(rem(0.62))).italic().foregroundStyle(Color(hex: 0x6F6857)).lineLimit(1)
            }
            .frame(maxWidth: .infinity)
            .layoutPriority(1.1)
            VStack(alignment: .trailing, spacing: 9) {
                LIcon("landmark", size: 22).foregroundStyle(accent).padding(.bottom, -4)
                row("EVENT:", t.title)
                row("DATE:", t.date)
                row("VENUE:", t.place)
                row("TICKET NO:", t.seat)
            }
            .frame(maxWidth: .infinity)
            .layoutPriority(1)
        }
        .padding(.vertical, 32)
        .padding(.horizontal, 22)
        .foregroundStyle(Color(hex: 0x4C4638))
        .frame(width: 380, height: 200)
        .background(LinearGradient(colors: [Color(hex: 0xFCF8F0), Color(hex: 0xEEE6D5)], startPoint: UnitPoint(x: 0.4, y: 0), endPoint: UnitPoint(x: 0.6, y: 1)))
        .overlay {
            ZStack {
                RoundedRectangle(cornerRadius: 3).strokeBorder(line, lineWidth: 1)
                RoundedRectangle(cornerRadius: 2).strokeBorder(Color(hex: 0x98896A, alpha: 0.35), lineWidth: 1).padding(5)
            }
            .padding(13)
        }
        .overlay {
            ZStack {
                curl.frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                curl.scaleEffect(x: -1).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
                curl.scaleEffect(y: -1).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomLeading)
                curl.scaleEffect(x: -1, y: -1).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
            }
            .foregroundStyle(accent)
            .padding(8)
        }
        .clipShape(RoundedRectangle(cornerRadius: 6))
        .mask {
            ZStack {
                Rectangle().padding(.vertical, 10)
                Circle().frame(width: 34, height: 34).frame(maxHeight: .infinity, alignment: .top)
                Circle().frame(width: 34, height: 34).frame(maxHeight: .infinity, alignment: .bottom)
            }
        }
    }

    private var curl: some View {
        ZStack(alignment: .topLeading) {
            QuarterArc().stroke(lineWidth: 1.5).frame(width: 26, height: 26)
            QuarterArc().stroke(lineWidth: 1).frame(width: 16, height: 16).offset(x: 5, y: 5)
        }
        .frame(width: 26, height: 26, alignment: .topLeading)
    }

    private func row(_ key: String, _ value: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 7) {
            Text(key).fontWeight(.semibold).fixedSize()
            Text(value)
                .lineLimit(1)
                .padding(.bottom, 2)
                .frame(maxWidth: .infinity, alignment: .leading)
                .overlay(alignment: .bottom) { Rectangle().fill(Color(hex: 0x98896A, alpha: 0.6)).frame(height: 1) }
        }
        .font(.h5Mono(rem(0.6)))
        .trackingEm(0.07, size: rem(0.6))
    }
}

/// 左上四分之一圆弧（从左下到右上）
struct QuarterArc: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: rect.minX, y: rect.maxY))
        p.addArc(center: CGPoint(x: rect.maxX, y: rect.maxY), radius: rect.width, startAngle: .degrees(180), endAngle: .degrees(270), clockwise: false)
        return p
    }
}

/// 左右两缘一排小半圆缺口
struct SideScallops: Shape {
    var step: CGFloat = 11
    var radius: CGFloat = 3.5

    func path(in rect: CGRect) -> Path {
        var p = Path(rect)
        var y = rect.minY + step / 2
        while y < rect.maxY {
            for x in [rect.minX, rect.maxX] {
                p.addEllipse(in: CGRect(x: x - radius, y: y - radius, width: radius * 2, height: radius * 2))
            }
            y += step
        }
        return p
    }
}
