import SwiftUI

private let muted = Color(hex: 0x6A6258)
private let body2 = Color(hex: 0x4F4A41)

// MARK: - 城市小报 city-press

struct TkCityPress: View {
    @Environment(\.ticket) private var t

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 8) {
                Text("THE DAILY STROLL")
                Spacer(minLength: 0)
                Text(t.date)
            }
            .font(.h5Mono(rem(0.62)))
            .trackingEm(0.08, size: rem(0.62))
            .foregroundStyle(muted)
            .padding(.bottom, 8)
            .overlay(alignment: .bottom) { Rectangle().fill(Color.h5Ink).frame(height: 2) }
            .padding(.bottom, 12)
            H5Photo().aspectRatio(4 / 3, contentMode: .fit)
            VStack(alignment: .leading, spacing: 0) {
                Text("FEATURE").font(.h5Sans(rem(0.65))).trackingEm(0.14, size: rem(0.65)).foregroundStyle(Color(hex: 0x9A4030)).padding(.bottom, 6)
                Text(t.title).font(.h5Serif(rem(1.45))).fontWeight(.bold).padding(.bottom, 8)
                HStack(spacing: 4) {
                    LIcon("map-pinned", size: 14)
                    Text(t.place)
                }
                .font(.h5Sans(rem(0.86)))
                .padding(.bottom, 12)
                Text(t.mood)
                    .font(.h5Sans(rem(0.9)))
                    .padding(.top, 10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .overlay(alignment: .top) { Rectangle().fill(.black.opacity(0.12)).frame(height: 1) }
            }
            .padding(.top, 12)
            Spacer(minLength: 0)
        }
        .lineLimit(1)
        .padding(EdgeInsets(top: 12, leading: 14, bottom: 14, trailing: 14))
        .foregroundStyle(Color.h5Ink)
        .frame(width: 320, height: 411)
        .background { H5Grid() }
        .background(Color.h5Paper)
        .overlay(RoundedRectangle(cornerRadius: 4).strokeBorder(Color(hex: 0xD5CCBE), lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 4))
    }
}

// MARK: - 城市胶囊 city-capsule

struct TkCityCapsule: View {
    @Environment(\.ticket) private var t

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            H5Photo().aspectRatio(16 / 10, contentMode: .fit)
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 6) {
                    LIcon("coffee", size: 14)
                    Text("CITY CAPSULE")
                }
                .font(.h5Sans(rem(0.7)))
                .trackingEm(0.1, size: rem(0.7))
                .foregroundStyle(Color(hex: 0x8A6A45))
                Text(t.title).font(.h5Serif(rem(1.3))).fontWeight(.bold)
                Text(t.place).font(.h5Sans(rem(0.86)))
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 4) { LIcon("clock-3", size: 13); Text(t.date) }
                    HStack(spacing: 4) { LIcon("hash", size: 13); Text(t.seat) }
                }
                .font(.h5Sans(rem(0.8)))
                .foregroundStyle(muted)
                Text(t.mood).font(.h5Sans(rem(0.86))).opacity(0.78)
            }
            .lineLimit(1)
            .padding(EdgeInsets(top: 16, leading: 16, bottom: 18, trailing: 16))
            Spacer(minLength: 0)
        }
        .foregroundStyle(Color.h5Ink)
        .frame(width: 320, height: 427)
        .background { H5Rings() }
        .background(Color.h5Paper)
        .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
    }
}

// MARK: - 城市地图 city-map

struct TkCityMap: View {
    @Environment(\.ticket) private var t

    var body: some View {
        let ink = Color(hex: 0x1D2B23)
        VStack(spacing: 0) {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(t.title).font(.h5Serif(rem(1.32))).fontWeight(.bold)
                    Text(t.place).font(.h5Sans(rem(0.72))).trackingEm(0.06, size: rem(0.72)).foregroundStyle(Color(hex: 0xEEF4EE, alpha: 0.6))
                }
                Spacer(minLength: 0)
                Text(t.date)
                    .font(.h5Mono(rem(0.6)))
                    .multilineTextAlignment(.trailing)
                    .foregroundStyle(Color(hex: 0x9FD3B4))
                    .frame(maxWidth: 130, alignment: .trailing)
            }
            .lineLimit(1)
            .padding(14)
            .foregroundStyle(Color(hex: 0xEEF4EE))
            .background(ink)
            H5Photo().aspectRatio(4 / 3, contentMode: .fit)
            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .top, spacing: 7) {
                    LIcon("map-pin", size: 15).foregroundStyle(Color(hex: 0xC0563C)).padding(.top, 1)
                    Text(t.seat).font(.h5Sans(rem(0.79))).foregroundStyle(Color(hex: 0x38463C))
                }
                .padding(.bottom, 11)
                Text(t.mood)
                    .font(.h5Sans(rem(0.83)))
                    .foregroundStyle(Color(hex: 0x4A564C))
                    .padding(.top, 10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .overlay(alignment: .top) { H5Dash(color: ink.opacity(0.22), dash: [3, 3]).frame(height: 1) }
                H5Bars(color: Color(hex: 0x38463C), pattern: [12, 8]).frame(height: 8).opacity(0.5).padding(.top, 12)
            }
            .lineLimit(1)
            .padding(14)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .background { H5Grid(color: ink, step: 22, opacity: 0.07) }
        }
        .frame(width: 320, height: 418)
        .background(Color(hex: 0xF4F1E7))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Color(hex: 0xDDD5C4), lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}

// MARK: - 城市书签 city-bookmark

struct TkCityBookmark: View {
    @Environment(\.ticket) private var t

    var body: some View {
        let rust = Color(hex: 0xB4552F)
        VStack(spacing: 0) {
            VStack(spacing: 0) {
                Text(t.seat).font(.h5Sans(rem(0.56))).trackingEm(0.24, size: rem(0.56)).foregroundStyle(rust).padding(.bottom, 9)
                Text(t.title).font(.h5Serif(rem(1.48))).fontWeight(.bold).padding(.bottom, 7)
                Text(t.place).font(.h5Sans(rem(0.76))).foregroundStyle(muted)
            }
            .multilineTextAlignment(.center)
            .padding(.top, 20)
            H5Dash(color: Color(hex: 0x3C3228, alpha: 0.28), dash: [3, 3]).frame(height: 1).padding(.vertical, 15)
            H5Photo()
                .aspectRatio(3 / 4, contentMode: .fit)
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            Text("「\(t.mood)」")
                .font(.h5Sans(rem(0.83)))
                .foregroundStyle(body2)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.top, 15)
            Text(t.date)
                .font(.h5Mono(rem(0.66)))
                .trackingEm(0.1, size: rem(0.66))
                .foregroundStyle(Color(hex: 0x8A8172))
                .padding(.top, 10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .overlay(alignment: .top) { Rectangle().fill(Color(hex: 0x3C3228, alpha: 0.14)).frame(height: 1) }
                .padding(.top, 10)
            Spacer(minLength: 0)
        }
        .lineLimit(1)
        .padding(EdgeInsets(top: 20, leading: 18, bottom: 18, trailing: 18))
        .foregroundStyle(Color.h5Ink)
        .frame(width: 248, height: 516)
        .background(LinearGradient(colors: [Color(hex: 0xF8F3E8), Color(hex: 0xEBE2D0)], startPoint: .top, endPoint: .bottom))
        .overlay(alignment: .leading) { Rectangle().fill(rust).frame(width: 4) }
        .clipShape(UnevenRoundedRectangle(topLeadingRadius: 14, bottomLeadingRadius: 12, bottomTrailingRadius: 12, topTrailingRadius: 14, style: .continuous))
        .punched([Punch(center: { CGPoint(x: $0.width / 2, y: 16) }, radius: 9)])
    }
}

// MARK: - 方形速写 city-square

struct TkCitySquare: View {
    @Environment(\.ticket) private var t

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            H5Photo()
                .aspectRatio(1, contentMode: .fit)
                .clipShape(RoundedRectangle(cornerRadius: 4))
            VStack(alignment: .leading, spacing: 0) {
                Text("SKETCH").font(.h5Sans(rem(0.56))).trackingEm(0.22, size: rem(0.56)).foregroundStyle(Color(hex: 0xB4552F)).padding(.bottom, 8)
                Text(t.title).font(.h5Serif(rem(1.42))).fontWeight(.bold).padding(.bottom, 7)
                Text(t.place).font(.h5Sans(rem(0.79))).foregroundStyle(muted)
                Text(t.mood).font(.h5Sans(rem(0.85))).foregroundStyle(body2).padding(.top, 12)
                Text(t.date)
                    .font(.h5Mono(rem(0.62)))
                    .foregroundStyle(Color(hex: 0x9A9284))
                    .padding(.top, 10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .overlay(alignment: .top) { Rectangle().fill(Color(hex: 0x141210, alpha: 0.1)).frame(height: 1) }
                    .padding(.top, 14)
            }
            .lineLimit(1)
            .padding(EdgeInsets(top: 16, leading: 8, bottom: 0, trailing: 8))
            Spacer(minLength: 0)
        }
        .padding(EdgeInsets(top: 12, leading: 12, bottom: 18, trailing: 12))
        .foregroundStyle(Color.h5Ink)
        .frame(width: 300, height: 464)
        .background(Color(hex: 0xF7F4EE))
        .overlay(RoundedRectangle(cornerRadius: 8).strokeBorder(Color(hex: 0x141210, alpha: 0.06), lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .punched(LeftHoles.holes)
    }
}

// MARK: - 街区漫步 city-street

struct TkCityStreet: View {
    @Environment(\.ticket) private var t

    var body: some View {
        let ink = Color(hex: 0x1D2B23)
        VStack(alignment: .leading, spacing: 0) {
            H5Photo().aspectRatio(21 / 9, contentMode: .fit)
            VStack(alignment: .leading, spacing: 0) {
                Text("STREET WALK").font(.h5Sans(rem(0.54))).trackingEm(0.26, size: rem(0.54)).foregroundStyle(ink).padding(.bottom, 9)
                HStack(alignment: .top, spacing: 12) {
                    VStack(alignment: .leading, spacing: 5) {
                        Text(t.title).font(.h5Serif(rem(1.42))).fontWeight(.bold)
                        Text(t.place).font(.h5Sans(rem(0.75))).foregroundStyle(muted)
                    }
                    Spacer(minLength: 0)
                    Text(t.date).font(.h5Mono(rem(0.6))).foregroundStyle(Color(hex: 0x8A8172)).padding(.top, 4)
                }
                HStack(alignment: .top, spacing: 6) {
                    LIcon("map-pin", size: 14).padding(.top, 1)
                    Text(t.seat)
                }
                .font(.h5Sans(rem(0.75)))
                .foregroundStyle(Color(hex: 0x4A564C))
                .padding(.top, 11)
                Text(t.mood)
                    .font(.h5Sans(rem(0.83)))
                    .foregroundStyle(Color(hex: 0x4A564C))
                    .padding(.top, 11)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .overlay(alignment: .top) { H5Dash(color: ink.opacity(0.2), dash: [3, 3]).frame(height: 1) }
                    .padding(.top, 12)
                H5Bars(color: ink.opacity(0.45), pattern: [14, 10])
                    .frame(height: 5)
                    .clipShape(RoundedRectangle(cornerRadius: 3))
                    .padding(.top, 12)
            }
            .lineLimit(1)
            .padding(EdgeInsets(top: 14, leading: 16, bottom: 16, trailing: 16))
            Spacer(minLength: 0)
        }
        .foregroundStyle(Color.h5Ink)
        .frame(width: 320, height: 327)
        .background(Color(hex: 0xF2EFE6))
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(Color(hex: 0xDED7C6), lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .punched(LeftHoles.holes)
    }
}

// MARK: - 城市杂志 city-zine

struct TkCityZine: View {
    @Environment(\.ticket) private var t

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 10) {
                Text("THE STROLLER").foregroundStyle(Color.h5Ink)
                Spacer(minLength: 0)
                Text(t.seat)
            }
            .lineLimit(1)
            .font(.h5Mono(rem(0.56)))
            .trackingEm(0.18, size: rem(0.56))
            .foregroundStyle(Color(hex: 0x7A7166))
            .padding(.vertical, 12)
            .padding(.horizontal, 14)
            .overlay(alignment: .bottom) { Rectangle().fill(Color.h5Ink).frame(height: 2) }
            H5Photo().aspectRatio(4 / 5, contentMode: .fit)
            VStack(alignment: .leading, spacing: 0) {
                Text(t.title).font(.h5Serif(rem(1.55))).fontWeight(.bold).padding(.bottom, 8)
                HStack(spacing: 4) {
                    LIcon("map-pinned", size: 14)
                    Text(t.place)
                }
                .font(.h5Sans(rem(0.77)))
                .foregroundStyle(muted)
                Text(t.mood).font(.h5Sans(rem(0.85))).foregroundStyle(body2).padding(.top, 13)
                HStack {
                    Text(t.date)
                    Spacer(minLength: 10)
                    Text("PAGE 07")
                }
                .font(.h5Mono(rem(0.6)))
                .foregroundStyle(Color(hex: 0x8A8172))
                .padding(.top, 11)
                .overlay(alignment: .top) { Rectangle().fill(Color(hex: 0x141210, alpha: 0.1)).frame(height: 1) }
                .padding(.top, 14)
            }
            .lineLimit(1)
            .padding(EdgeInsets(top: 16, leading: 16, bottom: 18, trailing: 16))
            Spacer(minLength: 0)
        }
        .foregroundStyle(Color.h5Ink)
        .frame(width: 310, height: 589)
        .background { H5Grid() }
        .background(LinearGradient(colors: [Color(hex: 0xFBF8F1), Color(hex: 0xF2ECE0)], startPoint: .top, endPoint: .bottom))
        .overlay(RoundedRectangle(cornerRadius: 6).strokeBorder(Color(hex: 0x141210, alpha: 0.06), lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 6))
        .punched(LeftHoles.holes)
    }
}

// MARK: - 城际车票 city-transit

struct TkCityTransit: View {
    @Environment(\.ticket) private var t

    var body: some View {
        let label = Color(hex: 0x6D7A6A)
        HStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 7) {
                Text("INTERCITY · TICKET").font(.h5Sans(rem(0.55))).trackingEm(0.2, size: rem(0.55)).foregroundStyle(label)
                HStack(spacing: 9) {
                    Text(t.place).fontWeight(.bold)
                    LIcon("move-right", size: 17).foregroundStyle(Color(hex: 0x3F7A5A))
                    Text(t.title).fontWeight(.bold)
                }
                .font(.h5Mono(rem(1.12)))
                VStack(alignment: .leading, spacing: 7) {
                    cell("TRAIN / TIME", t.date, label)
                    cell("CAR / SEAT", t.seat, label)
                }
                .padding(.top, 4)
                Spacer(minLength: 0)
                Text(t.mood).font(.h5Sans(rem(0.78))).foregroundStyle(Color(hex: 0x4C564C))
            }
            .lineLimit(1)
            .padding(EdgeInsets(top: 20, leading: 18, bottom: 20, trailing: 16))
            .frame(width: 204, alignment: .leading)
            .frame(maxHeight: .infinity, alignment: .top)
            VStack(spacing: 10) {
                H5Photo()
                    .aspectRatio(1, contentMode: .fit)
                    .clipShape(RoundedRectangle(cornerRadius: 6))
                Spacer(minLength: 0)
                H5Bars(color: Color(hex: 0x2A2E28), pattern: [2, 3, 1, 3]).frame(height: 26).opacity(0.8)
            }
            .padding(.vertical, 16)
            .padding(.horizontal, 10)
            .frame(width: 116)
            .frame(maxHeight: .infinity)
            .background(Color(hex: 0x283C32, alpha: 0.05))
        }
        .overlay(alignment: .topLeading) {
            H5Dash(color: Color(hex: 0x283C32, alpha: 0.3), lineWidth: 2, dash: [5, 3], vertical: true)
                .frame(width: 2)
                .padding(.vertical, 26)
                .offset(x: 192)
        }
        .foregroundStyle(Color(hex: 0x2A2E28))
        .frame(width: 320, height: 245)
        .background { H5Grid(color: Color(hex: 0x283C32), step: 20, opacity: 0.06) }
        .background(LinearGradient(colors: [Color(hex: 0xF4F5EF), Color(hex: 0xE6E9DF)], startPoint: .top, endPoint: .bottom))
        .overlay { H5Grain().blendMode(.multiply) }
        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(Color(hex: 0x28372D, alpha: 0.14), lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .punched([Punch(x: 192, y: 26, r: 8), Punch(center: { CGPoint(x: 192, y: $0.height - 26) }, radius: 8)])
    }

    private func cell(_ key: String, _ value: String, _ label: Color) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(key).font(.h5Sans(rem(0.54))).trackingEm(0.1, size: rem(0.54)).foregroundStyle(label)
            Text(value).font(.h5Mono(rem(0.7))).fontWeight(.medium)
        }
    }
}

// MARK: - 展览门票 city-exhibit

struct TkCityExhibit: View {
    @Environment(\.ticket) private var t

    var body: some View {
        let grey = Color(hex: 0x8A8878)
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .firstTextBaseline, spacing: 10) {
                Text("ADMISSION").font(.h5Sans(rem(0.56))).trackingEm(0.26, size: rem(0.56)).foregroundStyle(Color(hex: 0x3C5A7A))
                Spacer(minLength: 0)
                Text("NO.EX2210").font(.h5Mono(rem(0.58))).foregroundStyle(grey)
            }
            Text(t.title)
                .font(.h5Serif(rem(1.6)))
                .fontWeight(.bold)
                .lineLimit(2)
                .frame(maxWidth: 280 * 0.82, alignment: .leading)
                .padding(.top, 14)
                .padding(.bottom, 8)
            Text(t.place).font(.h5Sans(rem(0.77))).foregroundStyle(Color(hex: 0x6A6A5E))
            H5Photo()
                .aspectRatio(16 / 10, contentMode: .fit)
                .clipShape(RoundedRectangle(cornerRadius: 4))
                .padding(.vertical, 14)
            HStack(alignment: .top, spacing: 9) {
                cell("DATE", t.date, grey)
                cell("TICKET", t.seat, grey)
            }
            Text("「\(t.mood)」")
                .font(.h5Sans(rem(0.8)))
                .italic()
                .foregroundStyle(Color(hex: 0x55584E))
                .padding(.top, 14)
                .frame(maxWidth: .infinity, alignment: .leading)
                .overlay(alignment: .top) { H5Dash(color: Color(hex: 0x28323C, alpha: 0.28), lineWidth: 2, dash: [5, 3]).frame(height: 2) }
                .padding(.top, 16)
            Spacer(minLength: 0)
        }
        .lineLimit(1)
        .padding(EdgeInsets(top: 24, leading: 20, bottom: 20, trailing: 20))
        .foregroundStyle(Color(hex: 0x23282E))
        .frame(width: 320, height: 455)
        .background(alignment: .bottomLeading) {
            Text("EXHIBITION")
                .font(.h5Mono(rem(3.1)))
                .trackingEm(0.05, size: rem(3.1))
                .foregroundStyle(Color(hex: 0x28374B, alpha: 0.07))
                .fixedSize()
                .offset(x: -14, y: -66)
        }
        .background {
            ZStack {
                LinearGradient(colors: [Color(hex: 0xF8F7F2), Color(hex: 0xE9E7DD)], startPoint: .top, endPoint: .bottom)
                EllipticalGradient(colors: [Color(hex: 0x3C5A82, alpha: 0.1), .clear], center: UnitPoint(x: 0.8, y: 0), endRadiusFraction: 0.6)
                    .scaleEffect(x: 1.2, y: 0.9, anchor: UnitPoint(x: 0.8, y: 0))
            }
        }
        .overlay { EllipticalGradient(stops: [.init(color: .clear, location: 0.5), .init(color: .black.opacity(0.2), location: 1)], center: UnitPoint(x: 0.5, y: 0.44)).scaleEffect(x: 1.25, y: 0.92) }
        .overlay(RoundedRectangle(cornerRadius: 6).strokeBorder(Color(hex: 0x28323C, alpha: 0.12), lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 6))
        .punched([Punch(center: { CGPoint(x: $0.width / 2, y: 24) }, radius: 8), Punch(center: { CGPoint(x: $0.width / 2, y: $0.height - 24) }, radius: 8)])
    }

    private func cell(_ key: String, _ value: String, _ grey: Color) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(key).font(.h5Sans(rem(0.55))).trackingEm(0.1, size: rem(0.55)).foregroundStyle(grey)
            Text(value).font(.h5Sans(rem(0.76))).fontWeight(.semibold)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - 告示 city-notice

struct TkCityNotice: View {
    @Environment(\.ticket) private var t

    var body: some View {
        let ink = Color(hex: 0x2F2A22)
        VStack(spacing: 0) {
            Text("NOTICE").font(.h5Sans(rem(0.54))).trackingEm(0.3, size: rem(0.54)).foregroundStyle(Color(hex: 0x9A8A6A))
            Text(t.title)
                .font(.h5Serif(rem(1.72)))
                .fontWeight(.bold)
                .multilineTextAlignment(.center)
                .padding(.top, 11)
                .padding(.bottom, 10)
            VStack(spacing: 3) {
                Rectangle().fill(ink).frame(height: 3)
                Rectangle().fill(ink.opacity(0.5)).frame(height: 1)
            }
            .padding(.bottom, 14)
            H5Photo()
                .aspectRatio(4 / 3, contentMode: .fit)
                .saturation(0.88)
                .contrast(1.04)
                .clipShape(RoundedRectangle(cornerRadius: 2))
            VStack(alignment: .leading, spacing: 0) {
                Text(t.place).font(.h5Sans(rem(0.76))).foregroundStyle(Color(hex: 0x5F5747))
                Text(t.mood).font(.h5Sans(rem(0.84))).foregroundStyle(Color(hex: 0x4A4437)).padding(.top, 11)
            }
            .padding(.top, 13)
            .frame(maxWidth: .infinity, alignment: .leading)
            .overlay(alignment: .top) { H5Dash(color: ink.opacity(0.28), dash: [3, 3]).frame(height: 1) }
            .padding(.top, 15)
            HStack {
                Text(t.date)
                Spacer(minLength: 10)
                Text(t.seat)
            }
            .font(.h5Mono(rem(0.62)))
            .foregroundStyle(Color(hex: 0x7D7460))
            .padding(.top, 11)
            .overlay(alignment: .top) { Rectangle().fill(ink.opacity(0.16)).frame(height: 1) }
            .padding(.top, 15)
            Spacer(minLength: 0)
        }
        .lineLimit(1)
        .padding(EdgeInsets(top: 34, leading: 20, bottom: 20, trailing: 20))
        .foregroundStyle(ink)
        .frame(width: 320, height: 470)
        .background { H5Stripes() }
        .background {
            ZStack {
                LinearGradient(colors: [Color(hex: 0xFBF7EA), Color(hex: 0xEFE8D4)], startPoint: .top, endPoint: .bottom)
                EllipticalGradient(stops: [.init(color: Color(hex: 0xB49664, alpha: 0.14), location: 0), .init(color: .clear, location: 0.62)], center: .top)
                    .scaleEffect(x: 0.9, y: 0.6, anchor: .top)
            }
        }
        .overlay(alignment: .top) {
            Circle()
                .fill(RadialGradient(colors: [Color(hex: 0xFF8B7A), Color(hex: 0xB8352A)], center: UnitPoint(x: 0.34, y: 0.3), startRadius: 0, endRadius: 14))
                .frame(width: 20, height: 20)
                .shadow(color: Color(hex: 0x5A1E19, alpha: 0.45), radius: 5, y: 4)
                .padding(.top, 10)
        }
        .overlay(Rectangle().strokeBorder(Color(hex: 0x786446, alpha: 0.2), lineWidth: 1))
        .punched([Punch(x: 16, y: 18, r: 6), Punch(center: { CGPoint(x: $0.width - 16, y: 18) }, radius: 6)])
    }
}

// MARK: - 拼贴 city-collage

struct TkCityCollage: View {
    @Environment(\.ticket) private var t

    var body: some View {
        ZStack(alignment: .topLeading) {
            scrapC
                .frame(width: 190)
                .rotationEffect(.degrees(-1.6))
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomLeading)
                .offset(x: 74)
            scrapA
                .frame(width: 208)
                .rotationEffect(.degrees(-4))
                .offset(y: 16)
            scrapB
                .frame(width: 168)
                .rotationEffect(.degrees(3.6))
                .frame(maxWidth: .infinity, alignment: .topTrailing)
        }
        .frame(width: 336, height: 306)
        .overlay { H5Glitter().allowsHitTesting(false) }
    }

    private func scrap<C: View, B: ShapeStyle>(_ fill: B, ink: UInt32, @ViewBuilder _ content: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 8) { content() }
            .lineLimit(1)
            .padding(12)
            .foregroundStyle(Color(hex: ink))
            .background(fill, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
            .shadow(color: .black.opacity(0.5), radius: 15, y: 16)
    }

    private var scrapA: some View {
        scrap(Color(hex: 0xFBF6EC), ink: 0x2F2A22) {
            H5Photo(slot: 0).aspectRatio(16 / 10, contentMode: .fit).clipShape(RoundedRectangle(cornerRadius: 6))
            Text(t.title).font(.h5Serif(rem(1.04))).fontWeight(.bold)
            Text(t.place).font(.h5Sans(rem(0.64))).opacity(0.78)
        }
    }

    private var scrapB: some View {
        scrap(LinearGradient(colors: [Color(hex: 0x2F4257), Color(hex: 0x1B2836)], startPoint: UnitPoint(x: 0.4, y: 0), endPoint: UnitPoint(x: 0.6, y: 1)), ink: 0xEEF4FA) {
            H5Photo(slot: 1).aspectRatio(1, contentMode: .fit).clipShape(RoundedRectangle(cornerRadius: 6))
            VStack(alignment: .leading, spacing: 9) {
                Text(t.date)
                Text(t.seat)
            }
            .font(.h5Sans(rem(0.86)))
        }
    }

    private var scrapC: some View {
        scrap(Color(hex: 0xF9E6EE), ink: 0x4A2233) {
            VStack(alignment: .leading, spacing: 9) {
                HStack { Text("DATE"); Spacer(minLength: 8); Text(t.date) }
                HStack { Text("NO."); Spacer(minLength: 8); Text(t.seat) }
            }
            .font(.h5Sans(rem(0.86)))
            Text(t.mood).font(.h5Sans(rem(0.66))).italic().opacity(0.82)
        }
    }
}

// MARK: - 门禁卡 city-gatecard

struct TkCityGatecard: View {
    @Environment(\.ticket) private var t

    var body: some View {
        let ice = Color(hex: 0x8CBEF0)
        VStack(alignment: .leading, spacing: 11) {
            Capsule()
                .strokeBorder(Color(hex: 0xA0C8F0, alpha: 0.34), lineWidth: 1)
                .frame(width: 76, height: 11)
                .frame(maxWidth: .infinity)
            HStack(spacing: 13) {
                H5Photo()
                    .frame(width: 68, height: 68)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).strokeBorder(ice.opacity(0.42), lineWidth: 1))
                VStack(alignment: .leading, spacing: 5) {
                    Text(t.title).font(.h5Mono(rem(1.02))).fontWeight(.bold).trackingEm(0.04, size: rem(1.02))
                    Text(t.place).font(.h5Sans(rem(0.68))).foregroundStyle(Color(hex: 0xEAF4FF, alpha: 0.62))
                }
            }
            HStack(alignment: .top, spacing: 9) {
                cell("ISSUED", t.date, ice)
                cell("CARD NO.", t.seat, ice)
            }
            .padding(.top, 10)
            .overlay(alignment: .top) { H5Dash(color: ice.opacity(0.32), dash: [3, 3]).frame(height: 1) }
            Text(t.mood).font(.h5Sans(rem(0.68))).italic().foregroundStyle(Color(hex: 0xEAF4FF, alpha: 0.6))
            H5Stripes(color: Color(hex: 0xEAF4FF), angle: 90, line: 2, period: 5, opacity: 0.72)
                .frame(height: 22)
                .clipShape(RoundedRectangle(cornerRadius: 2))
        }
        .lineLimit(1)
        .padding(16)
        .foregroundStyle(Color(hex: 0xEAF4FF))
        .frame(width: 268, height: 234, alignment: .top)
        .background {
            EllipticalGradient(stops: [.init(color: Color(hex: 0x24405F), location: 0), .init(color: Color(hex: 0x0E1C2C), location: 0.74)], center: .top)
                .scaleEffect(x: 1.2, y: 0.8, anchor: .top)
                .background(Color(hex: 0x0E1C2C))
        }
        .overlay { H5Glitter() }
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(ice.opacity(0.26), lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .modifier(SlotHole(width: 76, height: 11, top: 16))
    }

    private func cell(_ key: String, _ value: String, _ ice: Color) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(key).font(.h5Mono(rem(0.45))).trackingEm(0.14, size: rem(0.45)).foregroundStyle(ice.opacity(0.8))
            Text(value).font(.h5Mono(rem(0.66))).fontWeight(.semibold)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - 博物馆卡 card-museum

struct TkCardMuseum: View {
    @Environment(\.ticket) private var t

    var body: some View {
        let accent = Color(hex: 0x8A7A58)
        VStack(spacing: 0) {
            VStack(spacing: 12) {
                Capsule()
                    .strokeBorder(Color(hex: 0xB4C8F0, alpha: 0.4), lineWidth: 1)
                    .frame(width: 76, height: 11)
                H5Photo()
                    .aspectRatio(3 / 4, contentMode: .fit)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    .shadow(color: .black.opacity(0.34), radius: 9, y: 8)
            }
            .padding(EdgeInsets(top: 16, leading: 14, bottom: 12, trailing: 14))
            .background(LinearGradient(colors: [Color(hex: 0x22304E), Color(hex: 0x171F38)], startPoint: .top, endPoint: .bottom))
            VStack(alignment: .leading, spacing: 8) {
                kv("EXHIBIT:", t.title, accent)
                kv("DATE:", t.date, accent)
                kv("TIME / NO.:", t.seat, accent)
                kv("PLACE:", t.place, accent)
                Text(t.mood).font(.h5Sans(rem(0.86))).opacity(0.78).lineLimit(1)
            }
            .padding(EdgeInsets(top: 14, leading: 14, bottom: 15, trailing: 40))
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .overlay(alignment: .bottomTrailing) {
                LIcon("landmark", size: 20).foregroundStyle(accent).opacity(0.45).padding(.trailing, 13).padding(.bottom, 14)
            }
        }
        .foregroundStyle(Color(hex: 0x3F3728))
        .frame(width: 234, height: 537)
        .background(Color(hex: 0xF6F1E4))
        .overlay { H5Glitter() }
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .modifier(SlotHole(width: 76, height: 11, top: 16))
    }

    private func kv(_ key: String, _ value: String, _ accent: Color) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(key).font(.h5Mono(rem(0.48))).trackingEm(0.14, size: rem(0.48)).foregroundStyle(accent)
            Text(value)
                .font(.h5Mono(rem(0.68)))
                .fontWeight(.semibold)
                .lineLimit(2)
                .padding(.bottom, 4)
                .frame(maxWidth: .infinity, alignment: .leading)
                .overlay(alignment: .bottom) { Rectangle().fill(.black.opacity(0.18)).frame(height: 1) }
        }
    }
}

// MARK: - 鎏金卡 card-gilt

struct TkCardGilt: View {
    @Environment(\.ticket) private var t

    private let lo = Color(hex: 0x9C7228)
    private let mid = Color(hex: 0xD7B260)
    private let hi = Color(hex: 0xF6E7B8)

    var body: some View {
        VStack(spacing: 9) {
            H5Photo()
                .aspectRatio(4 / 5, contentMode: .fit)
                .clipShape(RoundedRectangle(cornerRadius: 3))
                .overlay(RoundedRectangle(cornerRadius: 3).strokeBorder(Color(hex: 0x766C58, alpha: 0.45), lineWidth: 1))
            Text(t.title.uppercased())
                .font(.h5Serif(rem(1.06)))
                .fontWeight(.bold)
                .trackingEm(0.1, size: rem(1.06))
                .padding(.top, 3)
            LinearGradient(colors: [.clear, Color(hex: 0x1F1A13, alpha: 0.6), .clear], startPoint: .leading, endPoint: .trailing)
                .frame(height: 1)
                .padding(.horizontal, 20)
                .padding(.top, -3)
            VStack(spacing: 3) {
                Text(t.place)
                Text(t.date)
                Text(t.seat)
            }
            .font(.h5Mono(rem(0.6)))
            .fontWeight(.bold)
            .trackingEm(0.09, size: rem(0.6))
            Text(t.mood).font(.h5Sans(rem(0.6))).italic().foregroundStyle(Color(hex: 0x6B5A3A)).padding(.top, 1)
        }
        .lineLimit(1)
        .multilineTextAlignment(.center)
        .padding(EdgeInsets(top: 13, leading: 14, bottom: 15, trailing: 14))
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(LinearGradient(colors: [Color(hex: 0xF7F0DD), Color(hex: 0xEEE3C9)], startPoint: .top, endPoint: .bottom), in: RoundedRectangle(cornerRadius: 5))
        .overlay(RoundedRectangle(cornerRadius: 5).strokeBorder(Color(hex: 0xD6B260, alpha: 0.42), lineWidth: 3))
        .overlay(RoundedRectangle(cornerRadius: 5).strokeBorder(Color(hex: 0x70521C, alpha: 0.55), lineWidth: 1))
        .padding(10)
        .background {
            RoundedRectangle(cornerRadius: 9)
                .fill(LinearGradient(stops: [
                    .init(color: hi, location: 0), .init(color: mid, location: 0.26), .init(color: lo, location: 0.48),
                    .init(color: mid, location: 0.66), .init(color: hi, location: 1),
                ], startPoint: UnitPoint(x: 0.1, y: 0.1), endPoint: UnitPoint(x: 0.9, y: 0.9)))
                .overlay(RoundedRectangle(cornerRadius: 9).strokeBorder(Color(hex: 0xFFF8D6, alpha: 0.34), lineWidth: 4))
                .overlay(RoundedRectangle(cornerRadius: 9).strokeBorder(Color(hex: 0x261A08, alpha: 0.6), lineWidth: 1))
                .shadow(color: .black.opacity(0.5), radius: 2.5, y: 2)
        }
        .overlay {
            ZStack {
                curl.frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                curl.scaleEffect(x: -1).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
                curl.scaleEffect(y: -1).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomLeading)
                curl.scaleEffect(x: -1, y: -1).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
            }
            .padding(3)
        }
        .padding(15)
        .foregroundStyle(Color(hex: 0x1F1A13))
        .frame(width: 300, height: 473)
        .background(Color(hex: 0x241C13))
        .clipShape(RoundedRectangle(cornerRadius: 15, style: .continuous))
        .mask {
            Canvas { ctx, size in
                var p = Path(CGRect(origin: .zero, size: size))
                var x: CGFloat = 13
                while x < size.width {
                    p.addEllipse(in: CGRect(x: x - 6, y: -6, width: 12, height: 12))
                    p.addEllipse(in: CGRect(x: x - 6, y: size.height - 6, width: 12, height: 12))
                    x += 26
                }
                ctx.fill(p, with: .color(.black), style: FillStyle(eoFill: true))
            }
        }
    }

    private var curl: some View {
        ZStack {
            QuarterArc().stroke(lo, lineWidth: 2)
            QuarterArc().stroke(lo, lineWidth: 1).padding(5)
        }
        .frame(width: 24, height: 24)
        .opacity(0.85)
    }
}

// MARK: - 圆形卡 card-round

struct TkCardRound: View {
    @Environment(\.ticket) private var t

    var body: some View {
        let soft = Color(hex: 0x4D6F92)
        VStack(spacing: 8) {
            H5Photo()
                .frame(width: 96, height: 96)
                .clipShape(Circle())
                .overlay(Circle().strokeBorder(.white.opacity(0.9), lineWidth: 3))
                .shadow(color: Color(hex: 0x1E4678, alpha: 0.3), radius: 8, y: 6)
            Text(t.title).font(.h5Serif(rem(1.22))).fontWeight(.bold)
            Text(t.place).font(.h5Mono(rem(0.52))).trackingEm(0.16, size: rem(0.52)).foregroundStyle(soft)
            VStack(spacing: 4) {
                row("DATE", t.date)
                row("NO.", t.seat)
            }
            .frame(maxWidth: 150)
            .padding(.top, 8)
            .overlay(alignment: .top) { Rectangle().fill(Color(hex: 0x32649B, alpha: 0.3)).frame(height: 1) }
            Text(t.mood).font(.h5Sans(rem(0.62))).italic().foregroundStyle(soft)
        }
        .lineLimit(1)
        .multilineTextAlignment(.center)
        .padding(30)
        .foregroundStyle(Color(hex: 0x1C3F5C))
        .frame(width: 272, height: 272)
        .background {
            ZStack {
                RadialGradient(stops: [.init(color: Color(hex: 0xF6FAFE), location: 0), .init(color: Color(hex: 0xD3E2F1), location: 0.84)], center: UnitPoint(x: 0.5, y: 0.36), startRadius: 0, endRadius: 200)
                ConicTicks(color: Color(hex: 0x32649B, alpha: 0.5), on: 4, period: 10, inner: 0.875).opacity(0.5).padding(7)
                Circle()
                    .strokeBorder(Color(hex: 0x32649B, alpha: 0.4), lineWidth: 1.5)
                    .overlay(Circle().inset(by: 1.5).strokeBorder(.white.opacity(0.6), lineWidth: 5))
                    .padding(19)
            }
        }
        .overlay { H5Glitter() }
        .clipShape(Circle())
    }

    private func row(_ key: String, _ value: String) -> some View {
        HStack(spacing: 8) {
            Text(key).foregroundStyle(Color(hex: 0x6D8AA8))
            Spacer(minLength: 0)
            Text(value)
        }
        .font(.h5Mono(rem(0.54)))
    }
}

// MARK: - 彩虹六边 card-hexcolor

struct TkCardHexcolor: View {
    @Environment(\.ticket) private var t

    private static let hex: [CGPoint] = [
        (7.82, 6.71), (8.61, 4.29), (10.04, 2.42), (12.08, 1.07), (14.76, 0.27), (18.06, 0), (81.94, 0), (85.24, 0.27),
        (87.92, 1.07), (89.96, 2.42), (91.39, 4.29), (92.18, 6.71), (98.79, 43.29), (99.18, 45.97), (99.37, 48.66),
        (99.37, 51.34), (99.18, 54.03), (98.79, 56.71), (92.18, 93.29), (91.39, 95.71), (89.96, 97.58), (87.92, 98.93),
        (85.24, 99.73), (81.94, 100), (18.06, 100), (14.76, 99.73), (12.08, 98.93), (10.04, 97.58), (8.61, 95.71),
        (7.82, 93.29), (1.21, 56.71), (0.82, 54.03), (0.63, 51.34), (0.63, 48.66), (0.82, 45.97), (1.21, 43.29),
    ].map { CGPoint(x: $0.0 / 100, y: $0.1 / 100) }

    var body: some View {
        VStack(spacing: 7) {
            H5Photo()
                .aspectRatio(16 / 10, contentMode: .fit)
                .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
            Text(t.title).font(.h5Serif(rem(1.06))).fontWeight(.bold)
            Text(t.place).font(.h5Mono(rem(0.5))).trackingEm(0.14, size: rem(0.5)).foregroundStyle(Color(hex: 0x7A6AA8))
            Text("\(t.date) · \(t.seat)").font(.h5Mono(rem(0.58))).foregroundStyle(Color(hex: 0x4A4266))
            Text(t.mood).font(.h5Sans(rem(0.86))).opacity(0.78)
        }
        .lineLimit(1)
        .multilineTextAlignment(.center)
        .padding(.vertical, 16)
        .padding(.horizontal, 12)
        .background(.white.opacity(0.94), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .shadow(color: Color(hex: 0x281446, alpha: 0.28), radius: 10, y: 8)
        .padding(20)
        .foregroundStyle(Color(hex: 0x2C2440))
        .frame(width: 268, height: 310)
        .background {
            AngularGradient(stops: [
                .init(color: Color(hex: 0x6A3FBF), location: 0), .init(color: Color(hex: 0x6A3FBF), location: 62 / 360.0),
                .init(color: Color(hex: 0xD94F8A), location: 62 / 360.0), .init(color: Color(hex: 0xD94F8A), location: 122 / 360.0),
                .init(color: Color(hex: 0xF0A02C), location: 122 / 360.0), .init(color: Color(hex: 0xF0A02C), location: 182 / 360.0),
                .init(color: Color(hex: 0xF2D94E), location: 182 / 360.0), .init(color: Color(hex: 0xF2D94E), location: 244 / 360.0),
                .init(color: Color(hex: 0x3FAE7A), location: 244 / 360.0), .init(color: Color(hex: 0x3FAE7A), location: 304 / 360.0),
                .init(color: Color(hex: 0x3F7FD9), location: 304 / 360.0), .init(color: Color(hex: 0x3F7FD9), location: 1),
            ], center: .center, angle: .degrees(20 - 90))
        }
        .clipShape(H5Polygon(points: Self.hex))
    }
}
