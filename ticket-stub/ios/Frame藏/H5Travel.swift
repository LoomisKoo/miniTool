import SwiftUI

// MARK: - 登机牌 travel-board

struct TkTravelBoard: View {
    @Environment(\.ticket) private var t

    var body: some View {
        VStack(spacing: 0) {
            HStack(alignment: .top, spacing: 10) {
                VStack(alignment: .leading, spacing: 8) {
                    HStack(spacing: 6) {
                        LIcon("plane", size: 12)
                        Text("BOARDING PASS")
                    }
                    .font(.h5Sans(rem(0.68)))
                    .trackingEm(0.1, size: rem(0.68))
                    .opacity(0.85)
                    HStack(spacing: 8) {
                        Text(t.place).fontWeight(.bold)
                        LIcon("move-right", size: 18)
                        Text(t.title).fontWeight(.bold)
                    }
                    .font(.h5Sans(rem(1.15)))
                    .lineLimit(1)
                }
                Spacer(minLength: 0)
                Text("CHECKED")
                    .font(.h5Sans(rem(0.65)))
                    .trackingEm(0.1, size: rem(0.65))
                    .foregroundStyle(Color(hex: 0xFFD278))
                    .padding(.vertical, 5)
                    .padding(.horizontal, 8)
                    .overlay(Capsule().strokeBorder(Color(hex: 0xFFD278, alpha: 0.85), lineWidth: 2))
                    .rotationEffect(.degrees(8))
            }
            .foregroundStyle(Color(hex: 0xF4F8FC))
            .padding(EdgeInsets(top: 14, leading: 14, bottom: 10, trailing: 14))
            .background(LinearGradient(colors: [Color(hex: 0x1F3A5F), Color(hex: 0x2F5F8A)], startPoint: .leading, endPoint: .trailing))

            VStack(alignment: .leading, spacing: 12) {
                H5Photo()
                    .aspectRatio(4 / 3, contentMode: .fit)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                VStack(alignment: .leading, spacing: 10) {
                    info("DATE / FLIGHT", t.date)
                    info("SEAT / GATE", t.seat)
                }
                .padding(.bottom, 10)
                Text(t.mood).font(.h5Sans(rem(0.86))).lineLimit(2)
                FlightPath().padding(.top, 10)
            }
            .padding(12)
            .frame(maxHeight: .infinity, alignment: .top)
        }
        .foregroundStyle(Color.h5Ink)
        .frame(width: 320, height: 463)
        .background(Color.h5Paper)
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .punched([Punch(x: 160, y: 26, r: 10)])
    }

    private func info(_ key: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(key).font(.h5Sans(rem(0.65))).trackingEm(0.08, size: rem(0.65)).foregroundStyle(Color(hex: 0x7A7166))
            Text(value).font(.h5Sans(rem(0.92))).fontWeight(.semibold).lineLimit(1)
        }
    }
}

/// 虚线航线 + 末端圆点
struct FlightPath: View {
    var body: some View {
        H5Dash(color: Color(hex: 0x1F3A5F), lineWidth: 2, dash: [8, 6])
            .frame(height: 2)
            .overlay(alignment: .trailing) { Circle().fill(Color(hex: 0xC48A4A)).frame(width: 10, height: 10) }
    }
}

// MARK: - 风景明信片 travel-postcard

struct TkTravelPostcard: View {
    @Environment(\.ticket) private var t

    var body: some View {
        VStack(spacing: 0) {
            H5Photo().frame(height: 397 - 186)
            VStack(alignment: .leading, spacing: 0) {
                Text(t.title)
                    .font(.h5Serif(rem(1.45)))
                    .fontWeight(.bold)
                    .padding(.trailing, 56)
                    .padding(.vertical, 8)
                Text(t.place).font(.h5Sans(rem(0.84))).foregroundStyle(Color(hex: 0x6A6258)).padding(.bottom, 6)
                Text(t.date).font(.h5Sans(rem(0.84))).foregroundStyle(Color(hex: 0x6A6258)).padding(.bottom, 6)
                Text(t.mood).font(.h5Serif(rem(1.1), italic: true)).padding(.top, 14)
            }
            .lineLimit(1)
            .padding(EdgeInsets(top: 16, leading: 14, bottom: 18, trailing: 14))
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .background(LinearGradient(colors: [Color(hex: 0xF8F3EA), Color(hex: 0xEFE6D6)], startPoint: .top, endPoint: .bottom))
            .overlay(alignment: .top) { H5Dash(color: Color(hex: 0x504637, alpha: 0.28), dash: [3, 3]).frame(height: 1) }
            .overlay(alignment: .topTrailing) {
                VStack(spacing: 1) {
                    LIcon("mail", size: 16)
                    Text("POST").font(.h5Sans(rem(0.58))).trackingEm(0.08, size: rem(0.58))
                }
                .foregroundStyle(Color(hex: 0xB08950))
                .frame(width: 52, height: 52)
                .overlay(Circle().strokeBorder(Color(hex: 0xB08950), style: StrokeStyle(lineWidth: 2, dash: [4, 3])))
                .rotationEffect(.degrees(12))
                .opacity(0.85)
                .padding(12)
            }
        }
        .foregroundStyle(Color.h5Ink)
        .frame(width: 320, height: 397)
        .background { ZStack { Color.h5Paper; H5Chevron() } }
        .overlay(RoundedRectangle(cornerRadius: 4).strokeBorder(Color(hex: 0xD8CDBC), lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 4))
        .punched(LeftHoles.right)
    }
}

// MARK: - 行李牌 travel-tag

struct TkTravelTag: View {
    @Environment(\.ticket) private var t

    var body: some View {
        let muted = Color(hex: 0x7D6F57)
        VStack(spacing: 0) {
            VStack(spacing: 5) {
                Text(t.title).font(.h5Mono(rem(1.42))).fontWeight(.bold).trackingEm(0.12, size: rem(1.42))
                Text(t.place).font(.h5Sans(rem(0.72))).trackingEm(0.16, size: rem(0.72)).foregroundStyle(muted)
            }
            .lineLimit(1)
            .padding(EdgeInsets(top: 28, leading: 16, bottom: 12, trailing: 16))
            .frame(maxWidth: .infinity)
            .overlay(alignment: .bottom) { H5Dash(color: Color(hex: 0x6E5A3C, alpha: 0.34), dash: [3, 3]).frame(height: 1) }

            VStack(alignment: .leading, spacing: 12) {
                H5Photo()
                    .aspectRatio(5 / 4, contentMode: .fit)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                VStack(spacing: 8) {
                    row("DATE / FLIGHT", t.date)
                    row("SEAT / BAG", t.seat)
                }
                Text("「\(t.mood)」").font(.h5Sans(rem(0.83))).foregroundStyle(Color(hex: 0x5F5544)).lineLimit(2)
            }
            .padding(EdgeInsets(top: 12, leading: 14, bottom: 18, trailing: 14))
            .frame(maxHeight: .infinity, alignment: .top)
        }
        .foregroundStyle(Color.h5Ink)
        .frame(width: 320, height: 452)
        .background(LinearGradient(colors: [Color(hex: 0xECE0C8), Color(hex: 0xDCCDB0)], startPoint: UnitPoint(x: 0.3, y: 0), endPoint: UnitPoint(x: 0.7, y: 1)))
        .overlay(UnevenRoundedRectangle(topLeadingRadius: 16, bottomLeadingRadius: 22, bottomTrailingRadius: 22, topTrailingRadius: 16).strokeBorder(Color(hex: 0x786446, alpha: 0.18), lineWidth: 1))
        .clipShape(UnevenRoundedRectangle(topLeadingRadius: 16, bottomLeadingRadius: 22, bottomTrailingRadius: 22, topTrailingRadius: 16))
        .punched([Punch(x: 160, y: 15, r: 9)])
    }

    private func row(_ key: String, _ value: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Text(key).font(.h5Sans(rem(0.62))).trackingEm(0.08, size: rem(0.62)).foregroundStyle(Color(hex: 0x7D6F57))
            Spacer(minLength: 0)
            Text(value).font(.h5Mono(rem(0.8))).fontWeight(.bold).lineLimit(1)
        }
        .padding(.bottom, 7)
        .overlay(alignment: .bottom) { H5Dash(color: Color(hex: 0x6E5A3C, alpha: 0.32), dash: [1, 2]).frame(height: 1) }
    }
}

// MARK: - 火车票 travel-rail

struct TkTravelRail: View {
    @Environment(\.ticket) private var t

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 10) {
                HStack(spacing: 9) {
                    Text(t.place).fontWeight(.bold)
                    LIcon("move-right", size: 18).opacity(0.85)
                    Text(t.title).fontWeight(.bold)
                }
                .font(.h5Mono(rem(1.05)))
                .lineLimit(1)
                Spacer(minLength: 0)
                Text("TICKET")
                    .font(.h5Sans(rem(0.58)))
                    .trackingEm(0.14, size: rem(0.58))
                    .padding(.vertical, 3)
                    .padding(.horizontal, 7)
                    .overlay(RoundedRectangle(cornerRadius: 6).strokeBorder(Color(hex: 0xF0F7FB, alpha: 0.5), lineWidth: 1))
            }
            .foregroundStyle(Color(hex: 0xF0F7FB))
            .padding(.vertical, 12)
            .padding(.horizontal, 14)
            .background(LinearGradient(colors: [Color(hex: 0x1F4D6B), Color(hex: 0x2C6B8F)], startPoint: .leading, endPoint: .trailing))

            VStack(alignment: .leading, spacing: 12) {
                H5Photo()
                    .aspectRatio(16 / 9, contentMode: .fit)
                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                HStack(alignment: .top, spacing: 10) {
                    cell("TRAIN / TIME", t.date)
                    cell("SEAT / GATE", t.seat)
                }
                H5Bars(color: Color(hex: 0x23201C), pattern: [3, 2])
                    .background(Color(hex: 0x3D372F))
                    .frame(height: 22)
                    .clipShape(RoundedRectangle(cornerRadius: 3))
                    .opacity(0.78)
                HStack(alignment: .bottom, spacing: 14) {
                    Text(t.mood).font(.h5Sans(rem(0.82))).foregroundStyle(Color(hex: 0x5F574C)).lineLimit(2)
                    Spacer(minLength: 0)
                    QRGrid()
                }
            }
            .padding(EdgeInsets(top: 12, leading: 14, bottom: 16, trailing: 14))
            .frame(maxHeight: .infinity, alignment: .top)
        }
        .foregroundStyle(Color.h5Ink)
        .frame(width: 320, height: 409)
        .background(LinearGradient(colors: [Color(hex: 0xF5F1E8), Color(hex: 0xEAE4D6)], startPoint: .top, endPoint: .bottom))
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(Color(hex: 0xD3C8B4), lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private func cell(_ key: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(key).font(.h5Sans(rem(0.6))).trackingEm(0.1, size: rem(0.6)).foregroundStyle(Color(hex: 0x7A7166))
            Text(value).font(.h5Mono(rem(0.76))).fontWeight(.semibold).lineLimit(2)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - 护照内页 travel-passport

struct TkTravelPassport: View {
    @Environment(\.ticket) private var t

    var body: some View {
        let stampInk = Color(hex: 0x785C3C)
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 10) {
                Text("PASSPORT").font(.h5Sans(rem(0.6))).trackingEm(0.24, size: rem(0.6))
                Spacer(minLength: 0)
                Text("NO.20260924").font(.h5Mono(rem(0.58))).opacity(0.75)
            }
            .foregroundStyle(Color(hex: 0xEAF3EA))
            .padding(.vertical, 12)
            .padding(.horizontal, 14)
            .background(LinearGradient(colors: [Color(hex: 0x24402F), Color(hex: 0x37624A)], startPoint: .leading, endPoint: .trailing))

            VStack(spacing: 12) {
                H5Photo()
                    .aspectRatio(4 / 5, contentMode: .fit)
                    .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                    .overlay(alignment: .bottomTrailing) {
                        Text("APPROVED")
                            .font(.h5Sans(rem(0.52)))
                            .trackingEm(0.1, size: rem(0.52))
                            .foregroundStyle(stampInk.opacity(0.8))
                            .frame(width: 66, height: 66)
                            .background(Color(hex: 0xF5ECDA, alpha: 0.35), in: Circle())
                            .overlay(Circle().strokeBorder(stampInk.opacity(0.55), lineWidth: 2))
                            .rotationEffect(.degrees(-12))
                            .padding(10)
                    }
                VStack(spacing: 7) {
                    field("DESTINATION", t.title)
                    field("ISSUED AT", t.place)
                    field("DATE", t.date)
                    field("ENTRY", t.seat)
                }
            }
            .padding(14)
            Text("「\(t.mood)」")
                .font(.h5Sans(rem(0.83)))
                .italic()
                .foregroundStyle(Color(hex: 0x5F5544))
                .lineLimit(1)
                .padding(EdgeInsets(top: 0, leading: 14, bottom: 18, trailing: 14))
            Spacer(minLength: 0)
        }
        .foregroundStyle(Color.h5Ink)
        .frame(width: 320, height: 564)
        .background(LinearGradient(colors: [Color(hex: 0xF1E8D6), Color(hex: 0xE2D4B8)], startPoint: .top, endPoint: .bottom))
        .overlay(RoundedRectangle(cornerRadius: 8).strokeBorder(Color(hex: 0x786446, alpha: 0.2), lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .punched(LeftHoles.holes)
    }

    private func field(_ key: String, _ value: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Text(key).font(.h5Sans(rem(0.56))).trackingEm(0.12, size: rem(0.56)).foregroundStyle(Color(hex: 0x7D6F57))
            Spacer(minLength: 0)
            Text(value).font(.h5Sans(rem(0.78))).fontWeight(.bold).lineLimit(1)
        }
    }
}

// MARK: - 航拍明信片 travel-aerial

struct TkTravelAerial: View {
    @Environment(\.ticket) private var t

    var body: some View {
        VStack(spacing: 0) {
            H5Photo()
                .aspectRatio(16 / 9, contentMode: .fit)
                .clipShape(RoundedRectangle(cornerRadius: 2))
                .overlay(alignment: .topTrailing) {
                    Text("16:9")
                        .font(.h5Mono(rem(0.54)))
                        .trackingEm(0.1, size: rem(0.54))
                        .foregroundStyle(Color(hex: 0xF6F1E8))
                        .padding(.vertical, 3)
                        .padding(.horizontal, 8)
                        .background(Color(hex: 0x141210, alpha: 0.58), in: Capsule())
                        .padding(8)
                }
            VStack(spacing: 0) {
                Text(t.title).font(.h5Serif(rem(1.5))).fontWeight(.bold).padding(.bottom, 6)
                Text(t.place).font(.h5Sans(rem(0.7))).trackingEm(0.16, size: rem(0.7)).foregroundStyle(Color(hex: 0x8A8172))
                Text(t.date).font(.h5Mono(rem(0.64))).foregroundStyle(Color(hex: 0xA09684)).padding(.top, 9)
                Text(t.mood).font(.h5Serif(rem(1.04), italic: true)).foregroundStyle(Color(hex: 0x4F4A41)).padding(.top, 13)
            }
            .lineLimit(1)
            .multilineTextAlignment(.center)
            .padding(EdgeInsets(top: 15, leading: 4, bottom: 0, trailing: 4))
            Spacer(minLength: 0)
        }
        .padding(EdgeInsets(top: 14, leading: 14, bottom: 18, trailing: 14))
        .foregroundStyle(Color.h5Ink)
        .frame(width: 340, height: 329)
        .background {
            ZStack {
                LinearGradient(colors: [Color(hex: 0xFBF8F1), Color(hex: 0xF1EBDF)], startPoint: .top, endPoint: .bottom)
                H5Dots()
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 4))
        .punched(LeftHoles.holes)
    }
}

// MARK: - 行李条 travel-luggage

struct TkTravelLuggage: View {
    @Environment(\.ticket) private var t

    var body: some View {
        let rule = Color(hex: 0x3C3228, alpha: 0.14)
        VStack(alignment: .leading, spacing: 0) {
            H5Photo().aspectRatio(3, contentMode: .fit).clipped()
            VStack(alignment: .leading, spacing: 0) {
                Text(t.title).font(.h5Mono(rem(1.28))).fontWeight(.bold).trackingEm(0.12, size: rem(1.28)).padding(.bottom, 5)
                Text(t.place).font(.h5Sans(rem(0.75))).foregroundStyle(Color(hex: 0x6A6258))
                HStack(spacing: 10) {
                    Text(t.date)
                    Spacer(minLength: 0)
                    Text(t.seat)
                }
                .font(.h5Mono(rem(0.7)))
                .foregroundStyle(Color(hex: 0x3F3A33))
                .padding(.vertical, 9)
                .overlay(alignment: .top) { Rectangle().fill(rule).frame(height: 1) }
                .overlay(alignment: .bottom) { Rectangle().fill(rule).frame(height: 1) }
                .padding(.vertical, 11)
                Text(t.mood).font(.h5Sans(rem(0.79))).foregroundStyle(Color(hex: 0x5F574C))
                H5Bars(color: Color(hex: 0x23303F), pattern: [12, 12])
                    .background(Color(hex: 0xD8A24A))
                    .frame(height: 5)
                    .clipShape(RoundedRectangle(cornerRadius: 3))
                    .opacity(0.85)
                    .padding(.top, 14)
            }
            .lineLimit(1)
            .padding(EdgeInsets(top: 14, leading: 16, bottom: 16, trailing: 16))
            Spacer(minLength: 0)
        }
        .foregroundStyle(Color.h5Ink)
        .frame(width: 340, height: 281)
        .background(Color(hex: 0xF4F1E7))
        .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).strokeBorder(Color(hex: 0xDDD5C4), lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        .punched(LeftHoles.holes)
    }
}

// MARK: - 旅行券 travel-voucher

struct TkTravelVoucher: View {
    @Environment(\.ticket) private var t

    var body: some View {
        let line = Color(hex: 0x5A5037)
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .firstTextBaseline, spacing: 10) {
                Text("TRAVEL VOUCHER")
                Spacer(minLength: 0)
                Text("ONE WAY")
            }
            .font(.h5Sans(rem(0.56)))
            .trackingEm(0.24, size: rem(0.56))
            .foregroundStyle(Color(hex: 0x7D6F57))
            .padding(.bottom, 10)
            .overlay(alignment: .bottom) { Rectangle().fill(line.opacity(0.24)).frame(height: 1) }
            Text(t.title)
                .font(.h5Mono(rem(1.34)))
                .fontWeight(.bold)
                .trackingEm(0.1, size: rem(1.34))
                .padding(.top, 13)
                .padding(.bottom, 6)
            Text(t.place).font(.h5Sans(rem(0.76))).foregroundStyle(Color(hex: 0x6A6258))
            HStack(alignment: .top, spacing: 9) {
                cell("DATE / FLIGHT", t.date)
                cell("SEAT / CLASS", t.seat)
            }
            .padding(.top, 14)
            .padding(.bottom, 12)
            H5Photo()
                .aspectRatio(16 / 9, contentMode: .fit)
                .clipShape(RoundedRectangle(cornerRadius: 4))
                .overlay(RoundedRectangle(cornerRadius: 4).strokeBorder(Color(hex: 0x5A503C, alpha: 0.24), lineWidth: 1))
            Text(t.mood)
                .font(.h5Sans(rem(0.8)))
                .foregroundStyle(Color(hex: 0x57503F))
                .padding(.top, 11)
                .frame(maxWidth: .infinity, alignment: .leading)
                .overlay(alignment: .top) { H5Dash(color: line.opacity(0.3), dash: [3, 3]).frame(height: 1) }
                .padding(.top, 12)
        }
        .lineLimit(1)
        .padding(EdgeInsets(top: 14, leading: 14, bottom: 16, trailing: 14))
        .frame(maxHeight: .infinity, alignment: .top)
        .overlay(RoundedRectangle(cornerRadius: 4).strokeBorder(line.opacity(0.42), style: StrokeStyle(lineWidth: 2, dash: [6, 4])))
        .padding(EdgeInsets(top: 22, leading: 20, bottom: 20, trailing: 20))
        .foregroundStyle(Color(hex: 0x333024))
        .frame(width: 320, height: 393)
        .background {
            ZStack {
                LinearGradient(colors: [Color(hex: 0xF6F1E2), Color(hex: 0xEBE3CF)], startPoint: .top, endPoint: .bottom)
                H5Dots(color: Color(hex: 0x3C3728), spacing: 12, radius: 1.1, opacity: 0.14)
            }
        }
        .overlay { H5Grain() }
        .overlay(RoundedRectangle(cornerRadius: 8).strokeBorder(Color(hex: 0x5A5037, alpha: 0.18), lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .punched([
            Punch(x: 22, y: 22, r: 7), Punch(x: 298, y: 22, r: 7),
            Punch(x: 22, y: 371, r: 7), Punch(x: 298, y: 371, r: 7),
        ])
    }

    private func cell(_ key: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(key).font(.h5Sans(rem(0.56))).trackingEm(0.1, size: rem(0.56)).foregroundStyle(Color(hex: 0x7D6F57))
            Text(value).font(.h5Mono(rem(0.72))).fontWeight(.medium)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - 复古登机牌 travel-boardvintage

struct TkTravelBoardVintage: View {
    @Environment(\.ticket) private var t

    var body: some View {
        let navy = Color(hex: 0x2B3A4D)
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 10) {
                Text("BOARDING PASS").font(.h5Sans(rem(0.58))).trackingEm(0.22, size: rem(0.58)).foregroundStyle(navy)
                Spacer(minLength: 0)
                Text("ECONOMY")
                    .font(.h5Sans(rem(0.55)))
                    .trackingEm(0.12, size: rem(0.55))
                    .foregroundStyle(Color(hex: 0xF7F3E6))
                    .padding(.vertical, 3)
                    .padding(.horizontal, 9)
                    .background(navy, in: RoundedRectangle(cornerRadius: 3))
            }
            .padding(.bottom, 11)
            .overlay(alignment: .bottom) { Rectangle().fill(navy).frame(height: 2) }
            HStack(spacing: 10) {
                Text(t.place).fontWeight(.bold)
                LIcon("move-right", size: 18).foregroundStyle(Color(hex: 0x9A4030))
                Text(t.title).fontWeight(.bold)
            }
            .font(.h5Mono(rem(1.16)))
            .padding(.top, 14)
            .padding(.bottom, 12)
            H5Photo()
                .aspectRatio(16 / 9, contentMode: .fit)
                .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
            HStack(alignment: .top, spacing: 9) {
                cell("DATE / FLIGHT", t.date)
                cell("SEAT / GATE", t.seat)
            }
            .padding(.top, 13)
            Text(t.mood).font(.h5Sans(rem(0.8))).italic().foregroundStyle(Color(hex: 0x5C5647)).padding(.top, 12)
        }
        .lineLimit(1)
        .padding(EdgeInsets(top: 18, leading: 20, bottom: 20, trailing: 20))
        .foregroundStyle(Color(hex: 0x2C2A22))
        .frame(width: 320, height: 357, alignment: .top)
        .background {
            ZStack {
                LinearGradient(colors: [Color(hex: 0xF7F3E6), Color(hex: 0xE9E0CC)], startPoint: UnitPoint(x: 0.45, y: 0), endPoint: UnitPoint(x: 0.55, y: 1))
                RuledBands(color: Color(red: 40 / 255, green: 60 / 255, blue: 90 / 255).opacity(0.06), band: 8, period: 16)
            }
        }
        .overlay { H5Grain() }
        .clipShape(UnevenRoundedRectangle(topLeadingRadius: 14, bottomLeadingRadius: 14, bottomTrailingRadius: 14, topTrailingRadius: 0))
        .clipShape(H5Polygon(points: [CGPoint(x: 0, y: 0), CGPoint(x: (320 - 26) / 320.0, y: 0), CGPoint(x: 1, y: 26 / 357.0), CGPoint(x: 1, y: 1), CGPoint(x: 0, y: 1)]))
        .punched(LeftHoles.holes)
    }

    private func cell(_ key: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(key).font(.h5Sans(rem(0.56))).trackingEm(0.1, size: rem(0.56)).foregroundStyle(Color(hex: 0x7D7565))
            Text(value).font(.h5Mono(rem(0.72))).fontWeight(.medium)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - 徽章贴纸 travel-badge

struct TkTravelBadge: View {
    @Environment(\.ticket) private var t

    var body: some View {
        let muted = Color(hex: 0x5F6B60)
        VStack(spacing: 0) {
            ZStack {
                Circle().fill(RadialGradient(colors: [Color(hex: 0x3D7A5E), Color(hex: 0x17402F)], center: UnitPoint(x: 0.34, y: 0.28), startRadius: 0, endRadius: 118))
                Circle().strokeBorder(Color(hex: 0xE8F0DC, alpha: 0.5), style: StrokeStyle(lineWidth: 1, dash: [3, 3])).padding(7)
                Circle().strokeBorder(Color(hex: 0xE8F0DC, alpha: 0.28), lineWidth: 1).padding(15)
                H5Photo().frame(width: 112, height: 112).clipShape(Circle())
                Text("EST · \(t.date)")
                    .font(.h5Mono(rem(0.5)))
                    .trackingEm(0.2, size: rem(0.5))
                    .foregroundStyle(Color(hex: 0xF4F8EE))
                    .shadow(color: .black.opacity(0.6), radius: 1.5, y: 1)
                    .lineLimit(1)
            }
            .frame(width: 164, height: 164)
            .shadow(color: Color(hex: 0x14322A, alpha: 0.34), radius: 13, y: 10)
            .padding(.top, 6)
            .padding(.bottom, 16)

            Text("TRAVEL BADGE").font(.h5Sans(rem(0.54))).trackingEm(0.26, size: rem(0.54)).foregroundStyle(Color(hex: 0x4A7A60)).padding(.bottom, 7)
            Text(t.title).font(.h5Serif(rem(1.42))).fontWeight(.bold).padding(.bottom, 5)
            Text(t.place).font(.h5Sans(rem(0.74))).foregroundStyle(muted)
            HStack(spacing: 14) {
                Text(t.seat)
                Text(t.date)
            }
            .font(.h5Mono(rem(0.66)))
            .foregroundStyle(Color(hex: 0x3F4A42))
            .padding(.top, 12)
            .frame(maxWidth: .infinity)
            .overlay(alignment: .top) { H5Dash(color: Color(hex: 0x3C5041, alpha: 0.28), dash: [3, 3]).frame(height: 1) }
            .padding(.top, 13)
            Text(t.mood).font(.h5Sans(rem(0.78))).italic().foregroundStyle(muted).padding(.top, 11)
            Spacer(minLength: 0)
        }
        .lineLimit(1)
        .multilineTextAlignment(.center)
        .padding(18)
        .foregroundStyle(Color(hex: 0x2F3A34))
        .frame(width: 306, height: 356)
        .background {
            ZStack {
                LinearGradient(colors: [Color(hex: 0xF8F4E9), Color(hex: 0xEBE3D2)], startPoint: UnitPoint(x: 0.45, y: 0), endPoint: UnitPoint(x: 0.55, y: 1))
                H5Dots()
            }
        }
        .overlay { H5Glitter() }
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(Color(hex: 0x5A6455, alpha: 0.16), lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

// MARK: - 国旅票根 travel-country

struct TkTravelCountry: View {
    @Environment(\.ticket) private var t

    var body: some View {
        let wine = Color(hex: 0x8F2436)
        HStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 10) {
                H5Photo()
                    .aspectRatio(4 / 3, contentMode: .fit)
                    .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 9, style: .continuous).strokeBorder(.white.opacity(0.5), lineWidth: 1))
                    .shadow(color: Color(hex: 0x783241, alpha: 0.18), radius: 5, y: 3)
                Spacer(minLength: 0)
                VStack(alignment: .leading, spacing: 7) {
                    Text(t.title).font(.h5Mono(rem(1.02))).fontWeight(.bold).trackingEm(0.1, size: rem(1.02)).foregroundStyle(wine)
                    Rectangle().fill(wine.opacity(0.28)).frame(height: 1)
                    Rectangle().fill(wine.opacity(0.28)).frame(height: 1)
                    Text(t.mood).font(.h5Sans(rem(0.72))).italic().foregroundStyle(Color(hex: 0x8A5560))
                }
            }
            .lineLimit(1)
            .padding(11)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(LinearGradient(colors: [Color(hex: 0xFDEEF1), Color(hex: 0xFBDDE3)], startPoint: .top, endPoint: .bottom))

            VStack(alignment: .leading, spacing: 2) {
                kv("DESTINATION:", t.place)
                kv("DATE:", t.date)
                kv("TICKET NO:", t.seat)
                Spacer(minLength: 0)
                LIcon("sparkles", size: 15)
                    .frame(width: 30, height: 30)
                    .overlay(Circle().strokeBorder(Color(hex: 0xFFF6F8, alpha: 0.45), style: StrokeStyle(lineWidth: 1, dash: [3, 3])))
                    .frame(maxWidth: .infinity)
            }
            .foregroundStyle(Color(hex: 0xFFF6F8))
            .padding(.vertical, 15)
            .padding(.horizontal, 13)
            .frame(width: 110)
            .frame(maxHeight: .infinity)
            .background(LinearGradient(colors: [Color(hex: 0xA92B3D), Color(hex: 0x7D1A2A)], startPoint: UnitPoint(x: 0.45, y: 0), endPoint: UnitPoint(x: 0.55, y: 1)))
        }
        .foregroundStyle(Color(hex: 0x3A2027))
        .frame(width: 330, height: 242)
        .background(Color(hex: 0xFDF6F7))
        .overlay { H5Glitter() }
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(Color(hex: 0x783C46, alpha: 0.14), lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .punched([Punch(x: 220, y: 0, r: 9), Punch(x: 220, y: 242, r: 9)])
    }

    private func kv(_ key: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(key).font(.h5Mono(rem(0.5))).trackingEm(0.14, size: rem(0.5)).opacity(0.66)
            Text(value).font(.h5Mono(rem(0.68))).fontWeight(.semibold).lineLimit(2).padding(.bottom, 9)
        }
    }
}

// MARK: - 三段票 travel-triptych

struct TkTravelTriptych: View {
    @Environment(\.ticket) private var t

    var body: some View {
        HStack(spacing: 0) {
            H5Photo()
                .clipShape(RoundedRectangle(cornerRadius: 5, style: .continuous))
                .padding(5)
                .background(Color(hex: 0xFDFAF4), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                .shadow(color: Color(hex: 0x3C1E0F, alpha: 0.25), radius: 6, y: 4)
                .padding(10)
                .frame(width: 116)
                .frame(maxHeight: .infinity)
                .background(LinearGradient(colors: [Color(hex: 0xCF7F5E), Color(hex: 0xA3502F)], startPoint: UnitPoint(x: 0.45, y: 0), endPoint: UnitPoint(x: 0.55, y: 1)))

            VStack(alignment: .leading, spacing: 10) {
                kv("DESTINATION:", t.title)
                kv("FROM / DATE:", "\(t.place) · \(t.date)")
                kv("SEAT / NO:", t.seat)
                Text(t.mood).font(.h5Sans(rem(0.72))).italic().foregroundStyle(Color(hex: 0x7A7062)).lineLimit(1)
            }
            .padding(.vertical, 15)
            .padding(.horizontal, 14)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)

            VStack(spacing: 10) {
                LIcon("plane", size: 19)
                LIcon("map-pin", size: 19)
            }
            .foregroundStyle(.white.opacity(0.92))
            .frame(width: 54)
            .frame(maxHeight: .infinity)
            .background {
                ZStack {
                    LinearGradient(colors: [Color(hex: 0x2F4A3C), Color(hex: 0x1C2F26)], startPoint: .top, endPoint: .bottom)
                    H5Pattern.slash(tile: 14).view(color: .white, opacity: 0.16)
                }
            }
        }
        .foregroundStyle(Color(hex: 0x2F2A22))
        .frame(width: 352, height: 194)
        .background(Color(hex: 0xFBF7F0))
        .overlay { H5Glitter() }
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(Color(hex: 0x5A503C, alpha: 0.14), lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .punched([Punch(x: 116, y: 0, r: 8), Punch(x: 116, y: 194, r: 8), Punch(x: 298, y: 0, r: 8), Punch(x: 298, y: 194, r: 8)])
    }

    private func kv(_ key: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(key).font(.h5Mono(rem(0.51))).trackingEm(0.12, size: rem(0.51)).foregroundStyle(Color(hex: 0x8A8172))
            Text(value)
                .font(.h5Mono(rem(0.76)))
                .fontWeight(.semibold)
                .lineLimit(1)
                .padding(.bottom, 4)
                .frame(maxWidth: .infinity, alignment: .leading)
                .overlay(alignment: .bottom) { Rectangle().fill(Color(hex: 0x463A2C, alpha: 0.28)).frame(height: 1) }
        }
    }
}

// MARK: - 圆形纪念章 travel-medallion

struct TkTravelMedallion: View {
    @Environment(\.ticket) private var t

    var body: some View {
        let blue = Color(hex: 0x245A96)
        let soft = Color(hex: 0x4D6F92)
        VStack(spacing: 6) {
            H5Photo()
                .frame(width: 104, height: 104)
                .clipShape(Circle())
                .overlay(Circle().strokeBorder(.white.opacity(0.85), lineWidth: 3))
                .shadow(color: Color(hex: 0x1E4678, alpha: 0.3), radius: 9, y: 6)
            Text(t.title).font(.h5Serif(rem(1.36))).fontWeight(.bold).trackingEm(0.04, size: rem(1.36))
            Text(t.place).font(.h5Mono(rem(0.6))).trackingEm(0.18, size: rem(0.6)).foregroundStyle(soft)
            VStack(spacing: 4) {
                row("DATE", t.date)
                row("NO.", t.seat)
            }
            .font(.h5Mono(rem(0.56)))
            .padding(.top, 9)
            .frame(maxWidth: 168)
            .overlay(alignment: .top) { Rectangle().fill(blue.opacity(0.28)).frame(height: 1) }
            Text(t.mood).font(.h5Sans(rem(0.68))).italic().foregroundStyle(soft).frame(maxWidth: 190)
        }
        .lineLimit(1)
        .multilineTextAlignment(.center)
        .foregroundStyle(Color(hex: 0x1D3B5C))
        .frame(width: 302, height: 302)
        .background(RadialGradient(colors: [Color(hex: 0xF2F8FD), Color(hex: 0xCFE2F2)], center: UnitPoint(x: 0.5, y: 0.34), startRadius: 0, endRadius: 302 * 0.82 * 0.7))
        .overlay { ConicTicks(color: blue.opacity(0.55), on: 3, period: 9, inner: 0.88).opacity(0.45).padding(7) }
        .overlay {
            ZStack {
                Circle().strokeBorder(blue.opacity(0.42), lineWidth: 1.5)
                Circle().strokeBorder(blue.opacity(0.34), style: StrokeStyle(lineWidth: 1, dash: [3, 3])).padding(6)
            }
            .padding(20)
        }
        .overlay { ConicTicks(color: .black.opacity(0.16), on: 2, period: 8, inner: 0.92) }
        .overlay { H5Glitter() }
        .overlay(Circle().strokeBorder(blue.opacity(0.35), lineWidth: 2))
        .clipShape(Circle())
    }

    private func row(_ key: String, _ value: String) -> some View {
        HStack(spacing: 8) {
            Text(key).foregroundStyle(Color(hex: 0x6D8AA8))
            Spacer(minLength: 0)
            Text(value)
        }
    }
}

/// 圆环刻度（repeating-conic-gradient + 环形遮罩）
struct ConicTicks: View {
    var color: Color
    var on: Double = 2
    var period: Double = 8
    var inner: CGFloat = 0.9

    var body: some View {
        Canvas { ctx, size in
            let c = CGPoint(x: size.width / 2, y: size.height / 2)
            let r = min(size.width, size.height) / 2
            var path = Path()
            var a = 0.0
            while a < 360 {
                path.move(to: c)
                path.addArc(center: c, radius: r, startAngle: .degrees(a - 90), endAngle: .degrees(a + on - 90), clockwise: false)
                path.closeSubpath()
                a += period
            }
            ctx.fill(path, with: .color(color))
            ctx.blendMode = .clear
            ctx.fill(Path(ellipseIn: CGRect(x: c.x - r * inner, y: c.y - r * inner, width: r * inner * 2, height: r * inner * 2)), with: .color(.black))
        }
        .allowsHitTesting(false)
    }
}

// MARK: - 拱门票 travel-arch

struct TkTravelArch: View {
    @Environment(\.ticket) private var t

    var body: some View {
        let rose = Color(hex: 0x96465F)
        VStack(spacing: 0) {
            H5Photo()
                .aspectRatio(3 / 4, contentMode: .fit)
                .clipShape(UnevenRoundedRectangle(topLeadingRadius: 136, bottomLeadingRadius: 9, bottomTrailingRadius: 9, topTrailingRadius: 136))
                .overlay(UnevenRoundedRectangle(topLeadingRadius: 136, bottomLeadingRadius: 9, bottomTrailingRadius: 9, topTrailingRadius: 136).strokeBorder(.white.opacity(0.6), lineWidth: 1))
            VStack(spacing: 0) {
                LIcon("flower-2", size: 17).foregroundStyle(Color(hex: 0xC9768F)).frame(width: 26, height: 26).padding(.bottom, 9)
                Text(t.title).font(.h5Serif(rem(1.32))).fontWeight(.bold).padding(.bottom, 5)
                Text(t.place).font(.h5Mono(rem(0.58))).trackingEm(0.16, size: rem(0.58)).foregroundStyle(Color(hex: 0x95626F))
                VStack(spacing: 9) {
                    row("DATE", t.date)
                    row("NO.", t.seat)
                }
                .padding(.top, 14)
            }
            .padding(EdgeInsets(top: 14, leading: 8, bottom: 6, trailing: 8))
            Text(t.mood)
                .font(.h5Sans(rem(0.72)))
                .italic()
                .foregroundStyle(Color(hex: 0x8A5A68))
                .padding(.top, 12)
                .padding(.top, 12)
                .frame(maxWidth: .infinity)
                .overlay(alignment: .top) {
                    H5Dash(color: rose.opacity(0.42), lineWidth: 2, dash: [5, 3])
                        .frame(height: 2)
                        .overlay(alignment: .leading) { tearDot.offset(x: -19) }
                        .overlay(alignment: .trailing) { tearDot.offset(x: 19) }
                }
                .padding(.top, 13)
            Spacer(minLength: 0)
        }
        .lineLimit(1)
        .multilineTextAlignment(.center)
        .padding(13)
        .foregroundStyle(Color(hex: 0x4A2733))
        .frame(width: 296, height: 596)
        .background(LinearGradient(colors: [Color(hex: 0xFDEEF2), Color(hex: 0xF7E2E8)], startPoint: .top, endPoint: .bottom))
        .overlay { H5Glitter(opacity: 0.42, tint: Color(red: 1, green: 0.85, blue: 0.72)) }
        .overlay(UnevenRoundedRectangle(topLeadingRadius: 148, bottomLeadingRadius: 14, bottomTrailingRadius: 14, topTrailingRadius: 148).strokeBorder(rose.opacity(0.18), lineWidth: 1))
        .clipShape(UnevenRoundedRectangle(topLeadingRadius: 148, bottomLeadingRadius: 14, bottomTrailingRadius: 14, topTrailingRadius: 148))
    }

    private var tearDot: some View {
        Circle().fill(Color(hex: 0x782841, alpha: 0.3)).frame(width: 11, height: 11)
    }

    private func row(_ key: String, _ value: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text(key).font(.h5Mono(rem(0.5))).trackingEm(0.1, size: rem(0.5)).foregroundStyle(Color(hex: 0xA8737F)).frame(width: 54, alignment: .leading)
            Text(value)
                .font(.h5Mono(rem(0.68)))
                .fontWeight(.medium)
                .padding(.bottom, 3)
                .frame(maxWidth: .infinity, alignment: .leading)
                .overlay(alignment: .bottom) { Rectangle().fill(Color(hex: 0x96465F, alpha: 0.3)).frame(height: 1) }
        }
    }
}

// MARK: - 雪山票 travel-mountain

struct TkTravelMountain: View {
    @Environment(\.ticket) private var t

    var body: some View {
        let soft = Color(hex: 0x50708C)
        VStack(spacing: 0) {
            ZStack(alignment: .top) {
                LinearGradient(colors: [Color(hex: 0x7FB0D8), Color(hex: 0xCDE4F4)], startPoint: .top, endPoint: .bottom)
                MountainPeaks().frame(maxHeight: .infinity, alignment: .bottom)
                Text(t.title)
                    .font(.h5Mono(rem(1.24)))
                    .fontWeight(.bold)
                    .trackingEm(0.2, size: rem(1.24))
                    .foregroundStyle(Color(hex: 0x1B3D5C))
                    .shadow(color: .white.opacity(0.7), radius: 0, y: 1)
                    .lineLimit(1)
                    .padding(.top, 22)
                LIcon("snowflake", size: 18)
                    .foregroundStyle(.white.opacity(0.85))
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
                    .padding(EdgeInsets(top: 0, leading: 0, bottom: 10, trailing: 12))
            }
            .frame(height: 132)
            H5Photo()
                .aspectRatio(4 / 3, contentMode: .fit)
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).strokeBorder(Color(hex: 0x3C6EA0, alpha: 0.24), lineWidth: 1))
                .padding(EdgeInsets(top: 12, leading: 15, bottom: 0, trailing: 15))
            VStack(alignment: .leading, spacing: 9) {
                Text(t.place).font(.h5Sans(rem(0.72))).foregroundStyle(soft)
                row("DATE", t.date)
                row("FLIGHT", t.seat)
                Text(t.mood).font(.h5Sans(rem(0.73))).italic().foregroundStyle(soft)
            }
            .lineLimit(1)
            .padding(15)
            Spacer(minLength: 0)
        }
        .foregroundStyle(Color(hex: 0x16344F))
        .frame(width: 252, height: 439)
        .background(LinearGradient(colors: [Color(hex: 0xE7F2FA), Color(hex: 0xFBFDFF)], startPoint: .top, endPoint: .bottom))
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(Color(hex: 0x3C6EA0, alpha: 0.2), lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private func row(_ key: String, _ value: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Text(key).font(.h5Mono(rem(0.52))).trackingEm(0.14, size: rem(0.52)).foregroundStyle(Color(hex: 0x6D90AE))
            Spacer(minLength: 0)
            Text(value).font(.h5Mono(rem(0.67)))
        }
        .padding(.bottom, 5)
        .overlay(alignment: .bottom) { H5Dash(color: Color(hex: 0x3C6EA0, alpha: 0.34), dash: [3, 3]).frame(height: 1) }
    }
}

/// 雪山剪影（H5 内联 SVG，viewBox 300×132，宽度铺满）
private struct MountainPeaks: View {
    var body: some View {
        Canvas { ctx, size in
            let s = size.width / 300
            let oy = size.height - 132 * s
            func pt(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: x * s, y: oy + y * s) }
            func poly(_ pts: [CGPoint], _ hex: UInt32) {
                var p = Path()
                p.addLines(pts)
                p.closeSubpath()
                ctx.fill(p, with: .color(Color(hex: hex)))
            }
            poly([pt(0, 132), pt(58, 44), pt(96, 96), pt(142, 22), pt(206, 132)], 0xFFFFFF)
            poly([pt(0, 132), pt(58, 44), pt(80, 74), pt(58, 68)], 0xDBE9F6)
            poly([pt(142, 22), pt(206, 0), pt(300, 90), pt(300, 132)], 0xEEF6FC)
        }
    }
}

// MARK: - 布贴徽章 travel-patch

struct TkTravelPatch: View {
    @Environment(\.ticket) private var t

    var body: some View {
        let khaki = Color(hex: 0x8A7A4E)
        VStack(spacing: 0) {
            H5Photo()
                .aspectRatio(16 / 10, contentMode: .fit)
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).strokeBorder(.white.opacity(0.5), lineWidth: 2))
                .shadow(color: Color(hex: 0x50411E, alpha: 0.24), radius: 7, y: 5)
            VStack(spacing: 0) {
                Text("TRAVEL PATCH").font(.h5Sans(rem(0.52))).trackingEm(0.26, size: rem(0.52)).foregroundStyle(khaki).padding(.bottom, 6)
                Text(t.title).font(.h5Serif(rem(1.38))).fontWeight(.bold).padding(.bottom, 5)
                Text(t.place).font(.h5Mono(rem(0.62))).trackingEm(0.1, size: rem(0.62)).foregroundStyle(Color(hex: 0x7D6F4A))
                VStack(spacing: 6) {
                    row("DATE", t.date)
                    row("NO.", t.seat)
                }
                .font(.h5Mono(rem(0.64)))
                .padding(.top, 11)
                .overlay(alignment: .top) { H5Dash(color: Color(hex: 0x786437, alpha: 0.34), dash: [3, 3]).frame(height: 1) }
                .padding(.top, 13)
                Text(t.mood).font(.h5Sans(rem(0.73))).italic().foregroundStyle(Color(hex: 0x6F6544)).padding(.top, 11)
            }
            .lineLimit(1)
            .multilineTextAlignment(.center)
            .padding(EdgeInsets(top: 14, leading: 6, bottom: 4, trailing: 6))
            Spacer(minLength: 0)
        }
        .padding(17)
        .foregroundStyle(Color(hex: 0x33301F))
        .frame(width: 300, height: 363)
        .background(LinearGradient(colors: [Color(hex: 0xF6EFDB), Color(hex: 0xE6DCC0)], startPoint: UnitPoint(x: 0.4, y: 0), endPoint: UnitPoint(x: 0.6, y: 1)))
        .overlay { H5Grain() }
        .overlay {
            RoundedRectangle(cornerRadius: 13, style: .continuous)
                .strokeBorder(Color(hex: 0x786437, alpha: 0.44), style: StrokeStyle(lineWidth: 2, dash: [6, 4]))
                .padding(8)
        }
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(Color(hex: 0x786941, alpha: 0.24), lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }

    private func row(_ key: String, _ value: String) -> some View {
        HStack(spacing: 10) {
            Text(key).foregroundStyle(Color(hex: 0x8A7A4E))
            Spacer(minLength: 0)
            Text(value)
        }
    }
}

// MARK: - 房卡 travel-keycard

struct TkTravelKeycard: View {
    @Environment(\.ticket) private var t

    var body: some View {
        let gold = Color(hex: 0xC8AF78)
        VStack(spacing: 0) {
            LinearGradient(colors: [Color(hex: 0x3A342C), Color(hex: 0x0D0B09)], startPoint: .top, endPoint: .bottom)
                .frame(height: 36)
                .overlay(alignment: .bottom) { Rectangle().fill(gold.opacity(0.2)).frame(height: 1) }
            VStack(alignment: .leading, spacing: 13) {
                HStack(alignment: .top, spacing: 14) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("HOTEL KEY CARD").font(.h5Mono(rem(0.52))).trackingEm(0.24, size: rem(0.52)).foregroundStyle(gold)
                        Text(t.seat)
                            .font(.h5Mono(rem(2.1)))
                            .fontWeight(.bold)
                            .trackingEm(0.04, size: rem(2.1))
                            .foregroundStyle(Color(hex: 0xF7F2E6))
                            .minimumScaleFactor(0.5)
                    }
                    Spacer(minLength: 0)
                    H5Photo()
                        .saturation(0.9)
                        .frame(width: 84, height: 84)
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).strokeBorder(gold.opacity(0.4), lineWidth: 1))
                }
                Text(t.title).font(.h5Mono(rem(0.98))).fontWeight(.bold).trackingEm(0.06, size: rem(0.98))
                HStack(alignment: .top, spacing: 14) {
                    cell("CHECK-IN", t.date)
                    cell("GUEST", t.place)
                }
                .padding(.top, 12)
                .overlay(alignment: .top) { H5Dash(color: gold.opacity(0.28), dash: [3, 3]).frame(height: 1) }
                Text(t.mood).font(.h5Sans(rem(0.74))).italic().foregroundStyle(Color(hex: 0xF2ECE0, alpha: 0.6))
            }
            .lineLimit(1)
            .padding(17)
            Spacer(minLength: 0)
        }
        .foregroundStyle(Color(hex: 0xF2ECE0))
        .frame(width: 320, height: 268)
        .background(LinearGradient(colors: [Color(hex: 0x2B2723), Color(hex: 0x16130F)], startPoint: UnitPoint(x: 0.3, y: 0), endPoint: UnitPoint(x: 0.7, y: 1)))
        .overlay(alignment: .bottomTrailing) {
            RoundedRectangle(cornerRadius: 5)
                .fill(LinearGradient(stops: [.init(color: Color(hex: 0xD8BE86), location: 0), .init(color: Color(hex: 0xA88C4E), location: 0.55), .init(color: Color(hex: 0xE0C892), location: 1)], startPoint: .topLeading, endPoint: .bottomTrailing))
                .overlay(RoundedRectangle(cornerRadius: 5).strokeBorder(.white.opacity(0.35), lineWidth: 1))
                .frame(width: 34, height: 26)
                .padding(17)
        }
        .overlay { H5Glitter() }
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(gold.opacity(0.22), lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private func cell(_ key: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(key).font(.h5Mono(rem(0.48))).trackingEm(0.16, size: rem(0.48)).foregroundStyle(Color(hex: 0xC8AF78, alpha: 0.75))
            Text(value).font(.h5Mono(rem(0.7))).fontWeight(.medium)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - 折叠册 travel-bifold

struct TkTravelBifold: View {
    @Environment(\.ticket) private var t

    var body: some View {
        let muted = Color(hex: 0x948870)
        let coverW: CGFloat = 344 * 1.04 / 2.04
        HStack(spacing: 0) {
            ZStack(alignment: .bottomLeading) {
                H5Photo()
                VStack(alignment: .leading, spacing: 5) {
                    Text(t.title).font(.h5Serif(rem(1.32))).fontWeight(.bold).lineLimit(2)
                    Text(t.place).font(.h5Mono(rem(0.58))).trackingEm(0.14, size: rem(0.58)).foregroundStyle(.white.opacity(0.78)).lineLimit(1)
                }
                .foregroundStyle(.white)
                .padding(EdgeInsets(top: 46, leading: 15, bottom: 16, trailing: 15))
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(LinearGradient(colors: [.clear, .black.opacity(0.74)], startPoint: .top, endPoint: .bottom))
            }
            .frame(width: coverW)
            .clipped()

            VStack(alignment: .leading, spacing: 9) {
                Text("TRAVEL FOLDER").font(.h5Mono(rem(0.5))).trackingEm(0.24, size: rem(0.5)).foregroundStyle(muted)
                Spacer(minLength: 0)
                row("DATE", t.date, muted)
                Spacer(minLength: 0)
                row("PARTY", t.seat, muted)
                Spacer(minLength: 0)
                Text(t.mood).font(.h5Sans(rem(0.72))).italic().foregroundStyle(Color(hex: 0x6F675A)).lineLimit(2).padding(.top, 3)
            }
            .padding(.vertical, 18)
            .padding(.horizontal, 15)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .background {
                ZStack {
                    Color(hex: 0xF8F4EA)
                    LinearGradient(stops: [.init(color: Color(hex: 0x46371E, alpha: 0.1), location: 0), .init(color: .clear, location: 0.26)], startPoint: .leading, endPoint: .trailing)
                }
            }
            .overlay(alignment: .leading) {
                H5Dash(color: Color(hex: 0x5A503C, alpha: 0.44), dash: [3, 3], vertical: true).frame(width: 1).padding(.vertical, 9)
            }
        }
        .foregroundStyle(Color(hex: 0x332C20))
        .frame(width: 344, height: 210)
        .background(Color(hex: 0xF6F1E6))
        .overlay { H5Glitter() }
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(Color(hex: 0x5A503C, alpha: 0.18), lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .punched([Punch(x: 344 * 0.51, y: 0, r: 8), Punch(x: 344 * 0.51, y: 210, r: 8)])
    }

    private func row(_ key: String, _ value: String, _ muted: Color) -> some View {
        HStack(spacing: 10) {
            Text(key).foregroundStyle(muted)
            Spacer(minLength: 0)
            Text(value).lineLimit(1)
        }
        .font(.h5Mono(rem(0.65)))
        .padding(.bottom, 5)
        .overlay(alignment: .bottom) { H5Dash(color: Color(hex: 0x5A503C, alpha: 0.38), dash: [1, 2]).frame(height: 1) }
    }
}

// MARK: - 护封票夹 travel-sleeve

struct TkTravelSleeve: View {
    @Environment(\.ticket) private var t

    var body: some View {
        let pale = Color(hex: 0xC8DCBE)
        ZStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 9) {
                Text("TICKET HOLDER").font(.h5Mono(rem(0.52))).trackingEm(0.26, size: rem(0.52)).foregroundStyle(pale.opacity(0.72))
                Text(t.title).font(.h5Serif(rem(1.28))).fontWeight(.bold).padding(.top, 2)
                Rectangle().fill(pale.opacity(0.26)).frame(height: 1)
                Text(t.mood).font(.h5Sans(rem(0.72))).italic().foregroundStyle(Color(hex: 0xEEF4EA, alpha: 0.66))
            }
            .lineLimit(1)
            .foregroundStyle(Color(hex: 0xEEF4EA))
            .padding(.vertical, 17)
            .padding(.horizontal, 18)
            .frame(maxWidth: .infinity, alignment: .topLeading)
            .frame(height: 150, alignment: .top)
            .background(LinearGradient(colors: [Color(hex: 0x2F4038), Color(hex: 0x16211C)], startPoint: UnitPoint(x: 0.4, y: 0), endPoint: UnitPoint(x: 0.6, y: 1)), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(pale.opacity(0.18), lineWidth: 1))

            VStack(alignment: .leading, spacing: 8) {
                Text(t.title).font(.h5Serif(rem(1.22))).fontWeight(.bold)
                Text(t.place).font(.h5Sans(rem(0.7))).foregroundStyle(Color(hex: 0x6F675A)).padding(.top, -4)
                row("DATE", t.date)
                row("NO.", t.seat)
                H5Photo()
                    .aspectRatio(16 / 9, contentMode: .fit)
                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            }
            .lineLimit(1)
            .foregroundStyle(Color(hex: 0x2B241C))
            .padding(14)
            .background(Color(hex: 0xFBF8F1), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(Color(hex: 0x5A503C, alpha: 0.16), lineWidth: 1))
            .shadow(color: .black.opacity(0.3), radius: 10, y: -8)
            .padding(.horizontal, 16)
            .frame(maxHeight: .infinity, alignment: .bottom)
        }
        .overlay { H5Glitter() }
        .frame(width: 320, height: 310)
    }

    private func row(_ key: String, _ value: String) -> some View {
        HStack(spacing: 10) {
            Text(key).foregroundStyle(Color(hex: 0x8A8172))
            Spacer(minLength: 0)
            Text(value)
        }
        .font(.h5Mono(rem(0.63)))
    }
}

// MARK: - 磁卡 travel-magcard

struct TkTravelMagcard: View {
    @Environment(\.ticket) private var t

    var body: some View {
        VStack(spacing: 0) {
            LinearGradient(colors: [Color(hex: 0x3B3229), Color(hex: 0x0C0A08)], startPoint: .top, endPoint: .bottom)
                .frame(height: 50)
                .overlay(alignment: .bottom) { Rectangle().fill(Color(hex: 0xC8AF78, alpha: 0.2)).frame(height: 1) }
            HStack(alignment: .top, spacing: 14) {
                VStack(alignment: .leading, spacing: 0) {
                    key("HOTEL")
                    Text(t.title).font(.h5Mono(rem(0.98))).fontWeight(.bold).trackingEm(0.04, size: rem(0.98)).padding(.bottom, 4)
                    key("GUEST"); value(t.place)
                    key("VALID"); value(t.date)
                    key("ROOM"); value(t.seat)
                }
                .lineLimit(1)
                .frame(maxWidth: .infinity, alignment: .leading)
                VStack(alignment: .leading, spacing: 11) {
                    H5Photo()
                        .saturation(0.9)
                        .frame(width: 84, height: 84)
                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                    RoundedRectangle(cornerRadius: 5)
                        .fill(LinearGradient(stops: [.init(color: Color(hex: 0xDCC487), location: 0), .init(color: Color(hex: 0xA8863C), location: 0.58), .init(color: Color(hex: 0xE8D6A2), location: 1)], startPoint: .topLeading, endPoint: .bottomTrailing))
                        .overlay(RoundedRectangle(cornerRadius: 5).strokeBorder(.white.opacity(0.4), lineWidth: 1))
                        .frame(width: 38, height: 28)
                }
                .frame(width: 84)
            }
            .padding(EdgeInsets(top: 16, leading: 17, bottom: 14, trailing: 17))
            Spacer(minLength: 0)
            H5Stripes(color: Color(hex: 0xF2ECE0), angle: 90, line: 1.5, period: 4, opacity: 0.72)
                .frame(height: 20)
                .clipShape(RoundedRectangle(cornerRadius: 2))
                .padding(EdgeInsets(top: 0, leading: 17, bottom: 15, trailing: 17))
        }
        .foregroundStyle(Color(hex: 0xF2ECE0))
        .frame(width: 332, height: 250)
        .background(LinearGradient(colors: [Color(hex: 0x25313F), Color(hex: 0x101823)], startPoint: UnitPoint(x: 0.3, y: 0), endPoint: UnitPoint(x: 0.7, y: 1)))
        .overlay { H5Glitter() }
        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(Color(hex: 0xA0BEDC, alpha: 0.22), lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private func key(_ text: String) -> some View {
        Text(text).font(.h5Mono(rem(0.47))).trackingEm(0.16, size: rem(0.47)).foregroundStyle(Color(hex: 0xA0BEDC, alpha: 0.72)).padding(.bottom, 2)
    }

    private func value(_ text: String) -> some View {
        Text(text).font(.h5Mono(rem(0.72))).fontWeight(.semibold).padding(.bottom, 8)
    }
}

// MARK: - 便签卡 / 胶片卡 / 记录卡（.tk-card 共用）

struct TkCard: View {
    @Environment(\.ticket) private var t
    var ratio: CGFloat = 3 / 4
    var bg: UInt32
    var ink: UInt32
    var accent: UInt32
    var line: Color
    var radius: CGFloat = 18
    var labels = ["NAME", "LOCATION", "DATE", "NO."]
    var icon: String
    var rose = false

    var body: some View {
        let size = t.template.size
        let accentColor = Color(hex: accent)
        VStack(alignment: .leading, spacing: 0) {
            H5Photo()
                .aspectRatio(ratio, contentMode: .fit)
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).strokeBorder(.black.opacity(0.08), lineWidth: 1))
            VStack(alignment: .leading, spacing: 9) {
                kv(labels[0], t.title, accentColor)
                kv(labels[1], t.place, accentColor)
                kv(labels[2], t.date, accentColor)
                kv(labels[3], t.seat, accentColor)
                Text(t.mood).font(.h5Sans(rem(0.68))).italic().opacity(0.8).lineLimit(2)
            }
            .padding(.trailing, 28)
            .overlay(alignment: .bottomTrailing) {
                LIcon(icon, size: 20).foregroundStyle(accentColor).opacity(0.42).padding(.bottom, 2)
            }
            .padding(.top, 14)
            Spacer(minLength: 0)
        }
        .padding(EdgeInsets(top: 13, leading: 14, bottom: 15, trailing: 14))
        .foregroundStyle(Color(hex: ink))
        .frame(width: size.width, height: size.height)
        .background(Color(hex: bg))
        .overlay {
            if rose { H5Glitter(opacity: 0.42, tint: Color(red: 1, green: 0.85, blue: 0.72)) }
        }
        .overlay(RoundedRectangle(cornerRadius: radius, style: .continuous).strokeBorder(Color(hex: 0x785064, alpha: 0.16), lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: radius, style: .continuous))
    }

    private func kv(_ key: String, _ value: String, _ accent: Color) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(key).font(.h5Mono(rem(0.48))).trackingEm(0.14, size: rem(0.48)).foregroundStyle(accent)
            Text(value)
                .font(.h5Mono(rem(0.66)))
                .fontWeight(.semibold)
                .lineLimit(2)
                .padding(.bottom, 4)
                .frame(maxWidth: .infinity, alignment: .leading)
                .overlay(alignment: .bottom) { Rectangle().fill(line).frame(height: 1) }
        }
    }
}

// MARK: - 游猎门票 card-scallop

struct TkCardScallop: View {
    @Environment(\.ticket) private var t

    var body: some View {
        let band = Color(hex: 0x8B5620)
        HStack(spacing: 14) {
            VStack(alignment: .leading, spacing: 8) {
                H5Photo()
                    .aspectRatio(2.35, contentMode: .fit)
                    .clipShape(RoundedRectangle(cornerRadius: 3))
                    .overlay(RoundedRectangle(cornerRadius: 3).strokeBorder(Color(hex: 0x465C70, alpha: 0.55), lineWidth: 2))
                Text(t.mood).font(.h5Sans(rem(0.62))).italic().foregroundStyle(Color(hex: 0x6D5122)).lineLimit(1)
            }
            .frame(maxWidth: .infinity)
            .layoutPriority(1.3)
            VStack(alignment: .trailing, spacing: 6) {
                LIcon("trees", size: 18).foregroundStyle(band).opacity(0.92).padding(.bottom, -4)
                row("PARK:", t.title)
                row("DATE:", t.date)
                row("GUIDE:", t.place)
                row("SPOTTED:", t.seat)
            }
            .frame(maxWidth: .infinity)
            .layoutPriority(1)
        }
        .padding(15)
        .background(Color(hex: 0xF8F3E7), in: RoundedRectangle(cornerRadius: 5))
        .overlay(RoundedRectangle(cornerRadius: 5).strokeBorder(band.opacity(0.45), lineWidth: 2))
        .padding(EdgeInsets(top: 34, leading: 20, bottom: 34, trailing: 24))
        .foregroundStyle(Color(hex: 0x4C3413))
        .frame(width: 400, height: 200)
        .background(LinearGradient(colors: [Color(hex: 0xCB9C42), Color(hex: 0xB6852C)], startPoint: .top, endPoint: .bottom))
        .overlay(alignment: .top) { WaveBand(color: band, top: true) }
        .overlay(alignment: .bottom) { WaveBand(color: band, top: false) }
        .mask(SideScallops(step: 22, radius: 7).fill(style: FillStyle(eoFill: true)))
    }

    private func row(_ key: String, _ value: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 7) {
            Text(key).fixedSize()
            Text(value)
                .lineLimit(1)
                .padding(.bottom, 2)
                .frame(maxWidth: .infinity, alignment: .leading)
                .overlay(alignment: .bottom) { Rectangle().fill(Color(hex: 0x4C3413, alpha: 0.45)).frame(height: 1) }
        }
        .font(.h5Mono(rem(0.6)))
        .fontWeight(.semibold)
        .trackingEm(0.06, size: rem(0.6))
    }
}

/// 20 高色带 + 14 个半露的圆，形成波浪边
private struct WaveBand: View {
    var color: Color
    var top: Bool

    var body: some View {
        Canvas { ctx, size in
            ctx.fill(Path(CGRect(x: 0, y: top ? 0 : size.height - 20, width: size.width, height: 20)), with: .color(color))
            let count = 14
            let usable = size.width - 8 - 22
            for i in 0..<count {
                let x = 4 + usable * CGFloat(i) / CGFloat(count - 1)
                let y = top ? 20 - 11 : size.height - 20 - 11
                ctx.fill(Path(ellipseIn: CGRect(x: x, y: y, width: 22, height: 22)), with: .color(color))
            }
        }
        .frame(height: 31)
        .allowsHitTesting(false)
    }
}

/// 水平色带：每 period 一条 band 高的色条
struct RuledBands: View {
    var color: Color
    var band: CGFloat = 8
    var period: CGFloat = 16

    var body: some View {
        Canvas { ctx, size in
            var path = Path()
            var y: CGFloat = 0
            while y < size.height {
                path.addRect(CGRect(x: 0, y: y, width: size.width, height: band))
                y += period
            }
            ctx.fill(path, with: .color(color))
        }
        .allowsHitTesting(false)
    }
}

/// 假二维码：白边 + 8px 网格
struct QRGrid: View {
    var size: CGFloat = 52

    var body: some View {
        H5Grid(color: Color(hex: 0x1A1612), step: 8, lineWidth: 2, opacity: 1)
            .frame(width: size - 6, height: size - 6)
            .background(.white)
            .padding(3)
            .background(.white)
            .overlay(Rectangle().inset(by: -1).strokeBorder(Color(hex: 0xCBBFA8), lineWidth: 1))
    }
}
