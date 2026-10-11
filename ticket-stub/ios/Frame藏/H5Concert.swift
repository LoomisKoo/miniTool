import SwiftUI

// MARK: - 霓虹暗色 concert-neon

struct TkConcertNeon: View {
    @Environment(\.ticket) private var t

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            H5Photo().aspectRatio(3 / 4, contentMode: .fit)
            VStack(alignment: .leading, spacing: 0) {
                HStack(spacing: 6) {
                    LIcon("sparkles", size: 12)
                    Text("LIVE SHOW")
                }
                .font(.h5Sans(rem(0.7)))
                .trackingEm(0.12, size: rem(0.7))
                .foregroundStyle(Color(hex: 0xFF8AD8))
                Text(t.title)
                    .font(.h5Sans(rem(1.55)))
                    .fontWeight(.bold)
                    .shadow(color: Color(red: 1, green: 100 / 255, blue: 200 / 255).opacity(0.45), radius: 9)
                    .padding(.vertical, 8)
                HStack(spacing: 4) {
                    LIcon("map-pin", size: 14)
                    Text(t.place)
                }
                .font(.h5Sans(rem(0.88)))
                .foregroundStyle(Color(hex: 0xF4F1FF, alpha: 0.75))
                VStack(alignment: .leading, spacing: 4) {
                    Text(t.date)
                    Text(t.seat)
                }
                .font(.h5Mono(rem(0.75)))
                .foregroundStyle(Color(hex: 0x9ECBFF))
                .padding(.vertical, 12)
                Text(t.mood).font(.h5Sans(rem(0.86)))
            }
            .lineLimit(1)
            .padding(EdgeInsets(top: 14, leading: 16, bottom: 16, trailing: 16))
            Spacer(minLength: 0)
        }
        .foregroundStyle(Color(hex: 0xF4F1FF))
        .frame(width: 320, height: 625)
        .background {
            ZStack {
                Color(hex: 0x0D0F16)
                RadialGradient(colors: [Color(red: 1, green: 70 / 255, blue: 180 / 255).opacity(0.35), .clear], center: UnitPoint(x: 0.16, y: 0.16), startRadius: 0, endRadius: 200)
                RadialGradient(colors: [Color(red: 80 / 255, green: 140 / 255, blue: 1).opacity(0.35), .clear], center: UnitPoint(x: 0.84, y: 0.74), startRadius: 0, endRadius: 210)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .punched([Punch(x: 160, y: 26, r: 10)])
    }
}

// MARK: - 音乐节票 concert-fest

struct TkConcertFest: View {
    @Environment(\.ticket) private var t

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                LIcon("music-2", size: 16)
                Spacer()
                Text("FESTIVAL PASS").font(.h5Sans(rem(0.68))).trackingEm(0.12, size: rem(0.68))
                Spacer()
                LIcon("audio-lines", size: 16)
            }
            .foregroundStyle(Color(hex: 0x6A4A8A))
            .padding(.vertical, 10)
            .padding(.horizontal, 14)
            .background(LinearGradient(colors: [Color(hex: 0xEFE6FF), Color(hex: 0xFFE8F4), Color(hex: 0xE8F7FF)], startPoint: .leading, endPoint: .trailing))
            H5Photo().aspectRatio(4 / 3, contentMode: .fit)
            VStack(alignment: .leading, spacing: 0) {
                Text(t.title).font(.h5Sans(rem(1.35))).fontWeight(.bold).padding(.bottom, 6)
                Text(t.place).font(.h5Sans(rem(0.86)))
                HStack(spacing: 8) {
                    chip(t.date)
                    chip(t.seat)
                }
                .padding(.top, 10)
                .padding(.bottom, 8)
                Text(t.mood).font(.h5Sans(rem(0.86)))
            }
            .lineLimit(1)
            .padding(EdgeInsets(top: 12, leading: 14, bottom: 16, trailing: 14))
            Spacer(minLength: 0)
        }
        .foregroundStyle(Color.h5Ink)
        .frame(width: 320, height: 422)
        .background(Color.h5Paper)
        .overlay {
            LinearGradient(stops: [
                .init(color: .clear, location: 0.2),
                .init(color: Color(red: 1, green: 120 / 255, blue: 200 / 255).opacity(0.18), location: 0.35),
                .init(color: Color(red: 120 / 255, green: 220 / 255, blue: 1).opacity(0.2), location: 0.5),
                .init(color: Color(red: 1, green: 230 / 255, blue: 120 / 255).opacity(0.18), location: 0.65),
                .init(color: .clear, location: 0.8),
            ], startPoint: UnitPoint(x: 0.2, y: 0), endPoint: UnitPoint(x: 0.8, y: 1))
            .blendMode(.colorDodge)
            .opacity(0.7)
            .allowsHitTesting(false)
        }
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        .punched([Punch(x: 160, y: 28, r: 10)])
    }

    private func chip(_ text: String) -> some View {
        Text(text)
            .font(.h5Sans(rem(0.72)))
            .foregroundStyle(Color(hex: 0x5A3D7A))
            .padding(.vertical, 5)
            .padding(.horizontal, 10)
            .background(Color(hex: 0x7850B4, alpha: 0.1), in: Capsule())
    }
}

// MARK: - 挂绳胸牌 concert-lanyard

struct TkConcertLanyard: View {
    @Environment(\.ticket) private var t

    var body: some View {
        let lilac = Color(hex: 0x8F9BFF)
        VStack(spacing: 0) {
            Capsule()
                .strokeBorder(Color(hex: 0xBEC8FF, alpha: 0.2), lineWidth: 1)
                .frame(width: 58, height: 9)
                .padding(.top, 18)
            Capsule()
                .fill(LinearGradient(colors: [Color(hex: 0x5F6BFF), Color(hex: 0xB46BFF)], startPoint: .leading, endPoint: .trailing))
                .frame(height: 3)
                .opacity(0.75)
                .padding(.horizontal, 18)
                .padding(.top, 14)
            VStack(spacing: 0) {
                Text("ALL ACCESS").font(.h5Sans(rem(0.58))).trackingEm(0.24, size: rem(0.58)).foregroundStyle(lilac)
                Text(t.title).font(.h5Sans(rem(1.4))).fontWeight(.bold).padding(.top, 8).padding(.bottom, 5)
                Text(t.place).font(.h5Sans(rem(0.76))).foregroundStyle(Color(hex: 0xEEF0FF, alpha: 0.6))
            }
            .padding(EdgeInsets(top: 16, leading: 18, bottom: 4, trailing: 18))
            H5Photo()
                .aspectRatio(4 / 3, contentMode: .fit)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                .padding(EdgeInsets(top: 14, leading: 18, bottom: 0, trailing: 18))
            VStack(alignment: .leading, spacing: 0) {
                VStack(spacing: 8) {
                    row("DATE", t.date, lilac)
                    row("ZONE", t.seat, lilac)
                }
                .padding(.bottom, 12)
                Text(t.mood).font(.h5Sans(rem(0.81))).foregroundStyle(Color(hex: 0xEEF0FF, alpha: 0.68)).padding(.bottom, 14)
                H5Stripes(color: Color(hex: 0xEEF0FF), angle: 90, line: 2, period: 5, opacity: 0.75).frame(height: 30)
            }
            .padding(EdgeInsets(top: 14, leading: 18, bottom: 16, trailing: 18))
            Spacer(minLength: 0)
        }
        .lineLimit(1)
        .foregroundStyle(Color(hex: 0xEEF0FF))
        .frame(width: 320, height: 514)
        .background(LinearGradient(colors: [Color(hex: 0x181C30), Color(hex: 0x0B0D19)], startPoint: .top, endPoint: .bottom))
        .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).strokeBorder(Color(hex: 0x8C96FF, alpha: 0.2), lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .modifier(SlotHole(width: 58, height: 9, top: 18))
    }

    private func row(_ key: String, _ value: String, _ lilac: Color) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Text(key).font(.h5Sans(rem(0.62))).trackingEm(0.14, size: rem(0.62)).foregroundStyle(lilac)
            Spacer(minLength: 0)
            Text(value).font(.h5Mono(rem(0.78))).fontWeight(.bold)
        }
    }
}

/// 顶部居中的挂绳长孔（真正镂空）
struct SlotHole: ViewModifier {
    var width: CGFloat
    var height: CGFloat
    var top: CGFloat

    func body(content: Content) -> some View {
        content.mask {
            Canvas { ctx, size in
                ctx.fill(Path(CGRect(origin: .zero, size: size)), with: .color(.black))
                ctx.blendMode = .clear
                let r = CGRect(x: (size.width - width) / 2, y: top, width: width, height: height)
                ctx.fill(Path(roundedRect: r, cornerRadius: height / 2), with: .color(.black))
            }
        }
    }
}

// MARK: - 热敏纸票 concert-paper

struct TkConcertPaper: View {
    @Environment(\.ticket) private var t

    var body: some View {
        let dash = H5Dash(color: Color(hex: 0x3C3228, alpha: 0.3), dash: [3, 3]).frame(height: 1).padding(.vertical, 13)
        VStack(spacing: 0) {
            Text("LIVE NATION · E-TICKET").font(.h5Mono(rem(0.58))).trackingEm(0.18, size: rem(0.58)).foregroundStyle(Color(hex: 0x8A8172)).padding(.bottom, 12)
            Text(t.title).font(.h5Mono(rem(1.08))).fontWeight(.bold).trackingEm(0.04, size: rem(1.08)).padding(.bottom, 6)
            Text(t.place).font(.h5Sans(rem(0.78))).foregroundStyle(Color(hex: 0x6A6258))
            dash
            H5Photo()
                .aspectRatio(3 / 2, contentMode: .fit)
                .grayscale(1)
                .contrast(1.06)
                .clipShape(RoundedRectangle(cornerRadius: 2))
            dash
            VStack(spacing: 8) {
                row("TIME", t.date)
                row("TICKET", t.seat)
            }
            .padding(.bottom, 12)
            Text(t.mood).font(.h5Sans(rem(0.78))).foregroundStyle(Color(hex: 0x5F574C)).padding(.bottom, 14)
            H5Bars(color: Color(hex: 0x1A1612), pattern: [1, 2, 1, 3]).frame(height: 34)
            Spacer(minLength: 0)
        }
        .lineLimit(1)
        .multilineTextAlignment(.center)
        .padding(.vertical, 18)
        .padding(.horizontal, 16)
        .foregroundStyle(Color.h5Ink)
        .frame(width: 320, height: 464)
        .background {
            ZStack {
                LinearGradient(colors: [Color(hex: 0xFFFDF8), Color(hex: 0xF5F1E7)], startPoint: .top, endPoint: .bottom)
                H5Dots(spacing: 6, radius: 0.9, opacity: 0.08)
            }
        }
        .overlay(RoundedRectangle(cornerRadius: 4).strokeBorder(Color(hex: 0xE3DCCD), lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 4))
        .perforatedTopBottom(step: 12, radius: 4)
    }

    private func row(_ key: String, _ value: String) -> some View {
        HStack(spacing: 10) {
            Text(key).trackingEm(0.1, size: rem(0.72)).foregroundStyle(Color(hex: 0x8A8172))
            Spacer(minLength: 0)
            Text(value)
        }
        .font(.h5Mono(rem(0.72)))
    }
}

// MARK: - 满幅现场 concert-stage

struct TkConcertStage: View {
    @Environment(\.ticket) private var t

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("LIVE")
                .font(.h5Sans(rem(0.56)))
                .trackingEm(0.2, size: rem(0.56))
                .foregroundStyle(Color(hex: 0xFFD9F2))
                .padding(.vertical, 4)
                .padding(.horizontal, 10)
                .background(Color(red: 1, green: 70 / 255, blue: 180 / 255).opacity(0.22), in: Capsule())
                .overlay(Capsule().strokeBorder(Color(red: 1, green: 120 / 255, blue: 200 / 255).opacity(0.4), lineWidth: 1))
                .padding(.bottom, 9)
            Text(t.title)
                .font(.h5Serif(rem(1.86)))
                .fontWeight(.bold)
                .shadow(color: .black.opacity(0.5), radius: 9, y: 2)
                .padding(.bottom, 7)
            Text(t.place).font(.h5Sans(rem(0.8))).foregroundStyle(Color(hex: 0xF6F4FF, alpha: 0.72))
            HStack(spacing: 10) {
                Text(t.date)
                Spacer(minLength: 0)
                Text(t.seat)
            }
            .font(.h5Mono(rem(0.7)))
            .foregroundStyle(Color(hex: 0x9ECBFF))
            .padding(.top, 12)
            .padding(.bottom, 8)
            Text(t.mood).font(.h5Sans(rem(0.8))).foregroundStyle(Color(hex: 0xF6F4FF, alpha: 0.62))
        }
        .lineLimit(1)
        .padding(EdgeInsets(top: 18, leading: 18, bottom: 20, trailing: 18))
        .frame(width: 320, height: 320, alignment: .bottomLeading)
        .background {
            LinearGradient(stops: [
                .init(color: Color(hex: 0x0A0A12, alpha: 0), location: 0.3),
                .init(color: Color(hex: 0x0A0A12, alpha: 0.72), location: 0.62),
                .init(color: Color(hex: 0x0A0A12, alpha: 0.95), location: 1),
            ], startPoint: .top, endPoint: .bottom)
        }
        .background { H5Photo() }
        .foregroundStyle(Color(hex: 0xF6F4FF))
        .background(Color(hex: 0x0A0A12))
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .punched(LeftHoles.right)
    }
}

// MARK: - 黑胶唱片 concert-vinyl

struct TkConcertVinyl: View {
    @Environment(\.ticket) private var t

    var body: some View {
        let gold = Color(hex: 0xC9A86A)
        VStack(spacing: 0) {
            ZStack {
                Circle().fill(Color(hex: 0x0A0910))
                H5Rings(color: .white, center: .center, period: 5, opacity: 0.05)
                H5Photo().clipShape(Circle()).opacity(0.92)
                Circle()
                    .fill(Color(hex: 0xF0E2C2))
                    .overlay(Circle().strokeBorder(Color(hex: 0x0A0910, alpha: 0.85), lineWidth: 7))
                    .overlay(Circle().inset(by: -1).strokeBorder(.white.opacity(0.12), lineWidth: 1))
                    .frame(width: 34, height: 34)
            }
            .frame(width: 208, height: 208)
            .clipShape(Circle())
            .overlay(Circle().inset(by: -1).strokeBorder(.white.opacity(0.07), lineWidth: 1))
            .shadow(color: .black.opacity(0.55), radius: 20, y: 18)
            .padding(.top, 22)
            VStack(spacing: 0) {
                Text("SIDE A").font(.h5Sans(rem(0.56))).trackingEm(0.26, size: rem(0.56)).foregroundStyle(gold)
                Text(t.title).font(.h5Serif(rem(1.5))).fontWeight(.bold).padding(.top, 8).padding(.bottom, 5)
                Text(t.place).font(.h5Sans(rem(0.76))).foregroundStyle(Color(hex: 0xF2EEF8, alpha: 0.6))
                VStack(spacing: 7) {
                    row("DATE", t.date, gold)
                    row("TRACK", t.seat, gold)
                }
                .padding(.vertical, 14)
                Text(t.mood).font(.h5Sans(rem(0.8))).foregroundStyle(Color(hex: 0xF2EEF8, alpha: 0.58))
            }
            .lineLimit(1)
            .multilineTextAlignment(.center)
            .padding(EdgeInsets(top: 18, leading: 18, bottom: 20, trailing: 18))
            Spacer(minLength: 0)
        }
        .foregroundStyle(Color(hex: 0xF2EEF8))
        .frame(width: 320, height: 441)
        .background(LinearGradient(colors: [Color(hex: 0x1B1A22), Color(hex: 0x0E0D13)], startPoint: .top, endPoint: .bottom))
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .punched(LeftHoles.right)
    }

    private func row(_ key: String, _ value: String, _ gold: Color) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Text(key).font(.h5Sans(rem(0.56))).trackingEm(0.14, size: rem(0.56)).foregroundStyle(gold)
            Spacer(minLength: 0)
            Text(value).font(.h5Mono(rem(0.7))).fontWeight(.medium)
        }
        .padding(.bottom, 6)
        .overlay(alignment: .bottom) { H5Dash(color: .white.opacity(0.14), dash: [1, 2]).frame(height: 1) }
    }
}

// MARK: - 抽奖联 / 演出存根（深色存根票共用）

struct TkDarkStub: View {
    @Environment(\.ticket) private var t
    var tag: String
    var tagColor: UInt32
    var rowColor: UInt32
    var colors: [UInt32]
    var stripe: (line: CGFloat, period: CGFloat, opacity: Double)
    var border: UInt32
    var perfX: CGFloat
    var stubWidth: CGFloat
    var titleSize: CGFloat
    var stubNo: String?

    var body: some View {
        let size = t.template.size
        HStack(spacing: 0) {
            VStack(alignment: .leading, spacing: stubNo == nil ? 7 : 8) {
                Text(tag).font(.h5Sans(rem(0.56))).trackingEm(0.25, size: rem(0.56)).foregroundStyle(Color(hex: tagColor))
                Text(t.title).font(.h5Sans(rem(titleSize))).fontWeight(.bold).lineLimit(2)
                HStack(spacing: 4) {
                    LIcon("map-pin", size: 14)
                    Text(t.place)
                }
                .font(.h5Sans(rem(0.78)))
                .opacity(0.62)
                HStack(spacing: 14) {
                    Text(t.date)
                    Text(t.seat)
                }
                .font(.h5Mono(rem(0.7)))
                .foregroundStyle(Color(hex: rowColor))
                .padding(.top, 3)
                Spacer(minLength: 0)
                Text(t.mood).font(.h5Sans(rem(0.79))).opacity(0.6)
            }
            .lineLimit(1)
            .padding(EdgeInsets(top: 22, leading: 20, bottom: 22, trailing: 18))
            .frame(width: size.width - stubWidth, alignment: .leading)
            .frame(maxHeight: .infinity, alignment: .top)

            VStack(spacing: 12) {
                if stubNo != nil { Spacer(minLength: 0) }
                H5Photo()
                    .aspectRatio(3 / 4, contentMode: .fit)
                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                if let stubNo {
                    Text(stubNo).font(.h5Mono(rem(0.62))).trackingEm(0.14, size: rem(0.62)).foregroundStyle(Color(hex: 0xD9C2FF))
                    Spacer(minLength: 0)
                } else {
                    Spacer(minLength: 0)
                    H5Stripes(color: Color(hex: 0xF2F0FF), angle: 90, line: 2, period: 5, opacity: 0.7).frame(height: 26)
                }
            }
            .padding(.vertical, 18)
            .padding(.horizontal, 10)
            .frame(width: stubWidth)
            .frame(maxHeight: .infinity)
            .background(.black.opacity(stubNo == nil ? 0.3 : 0.28))
        }
        .overlay(alignment: .topLeading) {
            H5Dash(color: .white.opacity(0.3), lineWidth: 2, dash: [5, 3], vertical: true)
                .frame(width: 2)
                .padding(.vertical, 26)
                .offset(x: perfX)
        }
        .foregroundStyle(Color(hex: 0xF4F1FF))
        .frame(width: size.width, height: size.height)
        .background {
            ZStack {
                LinearGradient(colors: colors.map { Color(hex: $0) }, startPoint: UnitPoint(x: 0.3, y: 0), endPoint: UnitPoint(x: 0.7, y: 1))
                H5Stripes(color: .white, angle: 135, line: stripe.line, period: stripe.period, opacity: stripe.opacity)
            }
        }
        .overlay {
            if stubNo != nil {
                ConicRays(center: UnitPoint(x: 0.5, y: 1.16), on: 2, period: 7, color: .white.opacity(0.22)).opacity(0.16).blendMode(.screen)
            }
        }
        .overlay { H5Glitter() }
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Color(hex: border, alpha: 0.22), lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .punched([Punch(x: perfX, y: 26, r: 8), Punch(center: { [perfX] in CGPoint(x: perfX, y: $0.height - 26) }, radius: 8)])
    }
}

/// 从某点放射的光线（repeating-conic-gradient）
struct ConicRays: View {
    var center: UnitPoint
    var on: Double = 2
    var period: Double = 7
    var color: Color

    var body: some View {
        Canvas { ctx, size in
            let c = CGPoint(x: size.width * center.x, y: size.height * center.y)
            let r = hypot(size.width, size.height) * 2
            var path = Path()
            var a = 0.0
            while a < 360 {
                path.move(to: c)
                path.addArc(center: c, radius: r, startAngle: .degrees(a - 90), endAngle: .degrees(a + on - 90), clockwise: false)
                path.closeSubpath()
                a += period
            }
            ctx.fill(path, with: .color(color))
        }
        .allowsHitTesting(false)
    }
}

// MARK: - 手环票 concert-wristband

struct TkConcertWristband: View {
    @Environment(\.ticket) private var t

    var body: some View {
        let pale = Color(hex: 0xFFEEF8)
        VStack(spacing: 0) {
            Text("WRISTBAND").font(.h5Sans(rem(0.54))).trackingEm(0.3, size: rem(0.54)).foregroundStyle(pale.opacity(0.78))
            H5Photo()
                .frame(width: 64, height: 64)
                .clipShape(Circle())
                .overlay(Circle().inset(by: -3).strokeBorder(.white.opacity(0.28), lineWidth: 3))
                .shadow(color: Color(hex: 0x280028, alpha: 0.35), radius: 8, y: 6)
                .padding(.top, 7)
                .padding(.bottom, 4)
            Circle()
                .fill(.white.opacity(0.18))
                .overlay(Circle().strokeBorder(.white.opacity(0.4), lineWidth: 1))
                .frame(width: 24, height: 24)
                .padding(.vertical, 6)
            Text(t.title).font(.h5Sans(rem(1.2))).fontWeight(.bold).padding(.bottom, 4)
            Text(t.place).font(.h5Sans(rem(0.75))).foregroundStyle(pale.opacity(0.72))
            HStack(spacing: 16) {
                Text(t.date)
                Text(t.seat)
            }
            .font(.h5Mono(rem(0.66)))
            .padding(.top, 9)
            .frame(maxWidth: .infinity)
            .overlay(alignment: .top) { H5Dash(color: pale.opacity(0.42), dash: [3, 3]).frame(height: 1) }
            .padding(.top, 9)
            Text(t.mood).font(.h5Sans(rem(0.74))).foregroundStyle(pale.opacity(0.7)).padding(.top, 8)
        }
        .lineLimit(1)
        .multilineTextAlignment(.center)
        .padding(.vertical, 16)
        .padding(.horizontal, 26)
        .foregroundStyle(pale)
        .frame(width: 320, height: 252)
        .background {
            ZStack {
                LinearGradient(colors: [Color(hex: 0xD4327F), Color(hex: 0x7A2BD6)], startPoint: UnitPoint(x: 0, y: 0.4), endPoint: UnitPoint(x: 1, y: 0.6))
                H5Stripes(color: .white, angle: 115, line: 8, period: 18, opacity: 0.08)
            }
        }
        .overlay {
            HStack {
                slot
                Spacer()
                slot
            }
            .padding(.horizontal, 12)
        }
        .overlay { H5Glitter(opacity: 0.42, tint: Color(red: 1, green: 0.85, blue: 0.72)) }
        .overlay(Capsule().strokeBorder(.white.opacity(0.26), lineWidth: 1))
        .clipShape(Capsule())
    }

    private var slot: some View {
        Circle()
            .fill(Color(hex: 0x160614, alpha: 0.46))
            .frame(width: 13, height: 13)
            .overlay(Circle().stroke(.black.opacity(0.4), lineWidth: 1).blur(radius: 1).offset(y: 1).clipShape(Circle()))
    }
}

// MARK: - 花边票 concert-scallop

struct TkConcertScallop: View {
    @Environment(\.ticket) private var t

    var body: some View {
        let soft = Color(hex: 0xB06A7C)
        VStack(spacing: 0) {
            Text(t.title).font(.h5Serif(rem(1.42))).fontWeight(.bold).foregroundStyle(Color(hex: 0x8C2438)).padding(.bottom, 4)
            Text("ADMIT ONE · EVENT TICKET").font(.h5Sans(rem(0.6))).trackingEm(0.22, size: rem(0.6)).foregroundStyle(soft).padding(.bottom, 12)
            H5Photo()
                .aspectRatio(16 / 10, contentMode: .fit)
                .clipShape(RoundedRectangle(cornerRadius: 5))
                .overlay(RoundedRectangle(cornerRadius: 5).strokeBorder(Color(hex: 0x8C2438, alpha: 0.24), lineWidth: 1))
            VStack(spacing: 7) {
                row("PLACE", t.place, soft)
                row("DATE", t.date, soft)
                row("SEAT", t.seat, soft)
            }
            .padding(.top, 14)
            Text(t.mood).font(.h5Sans(rem(0.74))).italic().foregroundStyle(Color(hex: 0x96556A)).padding(.top, 13)
            LIcon("star", size: 17).foregroundStyle(Color(hex: 0xC9768F)).frame(width: 24, height: 24).padding(.top, 11)
            Spacer(minLength: 0)
        }
        .lineLimit(1)
        .multilineTextAlignment(.center)
        .padding(EdgeInsets(top: 19, leading: 20, bottom: 20, trailing: 20))
        .foregroundStyle(Color(hex: 0x6B1F2E))
        .frame(width: 318, height: 444)
        .background(LinearGradient(colors: [Color(hex: 0xFDEFF2), Color(hex: 0xFADFE5)], startPoint: .top, endPoint: .bottom))
        .overlay(Rectangle().strokeBorder(Color(hex: 0xD98B9B), lineWidth: 2))
        .overlay { H5Glitter(opacity: 0.42, tint: Color(red: 1, green: 0.85, blue: 0.72)) }
        .perforatedTopBottom(step: 11, radius: 5)
    }

    private func row(_ key: String, _ value: String, _ soft: Color) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 9) {
            Text(key).font(.h5Mono(rem(0.5))).trackingEm(0.12, size: rem(0.5)).foregroundStyle(soft).frame(width: 58, alignment: .leading)
            Text(value)
                .font(.h5Mono(rem(0.69)))
                .fontWeight(.medium)
                .padding(.bottom, 3)
                .frame(maxWidth: .infinity, alignment: .leading)
                .overlay(alignment: .bottom) { Rectangle().fill(Color(hex: 0x8C2438, alpha: 0.28)).frame(height: 1) }
        }
    }
}

// MARK: - 挂绳工牌 concert-badge

struct TkConcertBadge: View {
    @Environment(\.ticket) private var t

    var body: some View {
        let muted = Color(hex: 0x6A6280)
        VStack(spacing: 10) {
            Capsule()
                .strokeBorder(Color(hex: 0x6E5A96, alpha: 0.3), lineWidth: 1)
                .frame(width: 92, height: 13)
                .padding(.top, 12)
            H5Photo()
                .aspectRatio(1, contentMode: .fit)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                .shadow(color: Color(hex: 0x3C2864, alpha: 0.24), radius: 10, y: 8)
                .padding(.horizontal, 16)
            VStack(spacing: 7) {
                Text(t.title).font(.h5Sans(rem(1.34))).fontWeight(.bold).trackingEm(0.01, size: rem(1.34))
                Text(t.place).font(.h5Sans(rem(0.72))).foregroundStyle(muted)
                HStack(alignment: .top, spacing: 9) {
                    cell("DATE", t.date)
                    cell("SEAT", t.seat)
                }
                .padding(.top, 10)
                .overlay(alignment: .top) { H5Dash(color: Color(hex: 0x6E5A96, alpha: 0.34), dash: [3, 3]).frame(height: 1) }
                Text(t.mood).font(.h5Sans(rem(0.68))).italic().foregroundStyle(muted)
            }
            .lineLimit(1)
            .multilineTextAlignment(.center)
            .padding(.horizontal, 16)
            H5Stripes(color: Color(hex: 0x231D2E), angle: 90, line: 2, period: 5, opacity: 0.75)
                .frame(height: 24)
                .clipShape(RoundedRectangle(cornerRadius: 2))
                .padding(.horizontal, 16)
                .padding(.top, 4)
            Spacer(minLength: 0)
        }
        .padding(.bottom, 16)
        .foregroundStyle(Color(hex: 0x231D2E))
        .frame(width: 268, height: 454)
        .background(LinearGradient(colors: [Color(hex: 0xFCF9FF), Color(hex: 0xEBE4F6)], startPoint: .top, endPoint: .bottom))
        .overlay { H5Glitter() }
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(Color(hex: 0x6E5A96, alpha: 0.22), lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .modifier(SlotHole(width: 92, height: 13, top: 12))
    }

    private func cell(_ key: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(key).font(.h5Mono(rem(0.45))).trackingEm(0.14, size: rem(0.45)).foregroundStyle(Color(hex: 0x8A82A0))
            Text(value).font(.h5Mono(rem(0.64))).fontWeight(.semibold)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - 手写便签 concert-note

struct TkConcertNote: View {
    @Environment(\.ticket) private var t

    var body: some View {
        let olive = Color(hex: 0x97803F)
        VStack(alignment: .leading, spacing: 0) {
            H5Photo()
                .aspectRatio(4 / 3, contentMode: .fit)
                .clipShape(RoundedRectangle(cornerRadius: 1))
                .padding(5)
                .background(.white, in: RoundedRectangle(cornerRadius: 2))
                .shadow(color: Color(hex: 0x503C14, alpha: 0.24), radius: 8, y: 6)
                .rotationEffect(.degrees(1.1))
            Text(t.title).font(.h5Serif(rem(1.4), italic: true)).fontWeight(.bold).padding(.top, 13).padding(.bottom, 5)
            Text(t.place).font(.h5Sans(rem(0.72))).foregroundStyle(Color(hex: 0x7A6534))
            VStack(spacing: 7) {
                row("DATE", t.date, olive)
                row("SEAT", t.seat, olive)
            }
            .padding(.top, 12)
            Text(t.mood).font(.h5Serif(rem(0.9), italic: true)).foregroundStyle(Color(hex: 0x5F4C22)).padding(.top, 12)
            Spacer(minLength: 0)
        }
        .lineLimit(1)
        .padding(EdgeInsets(top: 24, leading: 20, bottom: 20, trailing: 20))
        .foregroundStyle(Color(hex: 0x4A3A18))
        .frame(width: 300, height: 387)
        .background {
            ZStack {
                LinearGradient(colors: [Color(hex: 0xFDF3C8), Color(hex: 0xF8E6A2)], startPoint: .top, endPoint: .bottom)
                RuledLines(color: Color(hex: 0x786432, alpha: 0.16), step: 27)
            }
        }
        .overlay(RoundedRectangle(cornerRadius: 4).strokeBorder(Color(hex: 0x786432, alpha: 0.2), lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 4))
        .overlay(alignment: .top) {
            Rectangle()
                .fill(.white.opacity(0.52))
                .frame(width: 114, height: 26)
                .shadow(color: .black.opacity(0.16), radius: 3.5, y: 2)
                .rotationEffect(.degrees(-3.4))
                .offset(y: -11)
        }
        .rotationEffect(.degrees(-1.4))
    }

    private func row(_ key: String, _ value: String, _ olive: Color) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text(key).font(.h5Mono(rem(0.5))).trackingEm(0.12, size: rem(0.5)).foregroundStyle(olive)
            Text(value)
                .font(.h5Serif(rem(0.82), italic: true))
                .frame(maxWidth: .infinity, alignment: .leading)
                .overlay(alignment: .bottom) { Rectangle().fill(Color(hex: 0x786432, alpha: 0.34)).frame(height: 1) }
        }
    }
}

// MARK: - 往返双联 concert-roundtrip

struct TkConcertRoundtrip: View {
    @Environment(\.ticket) private var t

    var body: some View {
        VStack(spacing: 0) {
            half(AppLocalization.isEnglish ? "OUTBOUND" : "OUTBOUND · 去", slot: 0)
            half(AppLocalization.isEnglish ? "RETURN" : "RETURN · 返", slot: 1)
                .background(Color(hex: 0x5A4BA0, alpha: 0.05))
                .overlay(alignment: .top) { H5Dash(color: Color(hex: 0x6E5FAA, alpha: 0.46), lineWidth: 2, dash: [5, 3]).frame(height: 2) }
        }
        .foregroundStyle(Color(hex: 0x241F38))
        .frame(width: 320, height: 226)
        .background(Color(hex: 0xF5F2FC))
        .overlay { H5Glitter() }
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(Color(hex: 0x6E5FAA, alpha: 0.2), lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .punched([Punch(x: 0, y: 113, r: 8), Punch(x: 320, y: 113, r: 8)])
    }

    private func half(_ tag: String, slot: Int) -> some View {
        HStack(alignment: .top, spacing: 12) {
            H5Photo(slot: slot)
                .frame(width: 86, height: 86)
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            VStack(alignment: .leading, spacing: 0) {
                Text(tag).font(.h5Mono(rem(0.48))).trackingEm(0.2, size: rem(0.48)).foregroundStyle(Color(hex: 0x7A6AC2)).padding(.bottom, 4)
                Text(t.title).font(.h5Serif(rem(1.06))).fontWeight(.bold)
                Text(t.place).font(.h5Sans(rem(0.66))).foregroundStyle(Color(hex: 0x6A6280))
                HStack(spacing: 12) {
                    Text(t.date)
                    Text(t.seat)
                }
                .font(.h5Mono(rem(0.61)))
                .foregroundStyle(Color(hex: 0x4A4266))
                .padding(.top, 6)
            }
            .lineLimit(1)
            Spacer(minLength: 0)
        }
        .padding(.vertical, 13)
        .padding(.horizontal, 14)
        .frame(maxHeight: .infinity)
    }
}

// MARK: - 标签卡 card-blacklabel / card-redlabel

struct TkLabelCard: View {
    @Environment(\.ticket) private var t
    var band: UInt32
    var ink: UInt32
    var icon: String
    var rose = false

    var body: some View {
        VStack(spacing: 0) {
            H5Photo().aspectRatio(3 / 4, contentMode: .fit)
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 10) {
                    VStack(alignment: .leading, spacing: 3) {
                        kv("STAGE:", t.title)
                        kv("LOCATION:", t.place)
                        kv("DATE:", t.date)
                        kv("NO.:", t.seat)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    LIcon(icon, size: 22).opacity(0.7)
                }
                Text(t.mood).font(.h5Sans(rem(0.66))).italic().opacity(0.72).lineLimit(1).padding(.top, 6)
            }
            .foregroundStyle(Color(hex: ink))
            .padding(EdgeInsets(top: 12, leading: 14, bottom: 14, trailing: 14))
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .background(Color(hex: band))
        }
        .frame(width: 238, height: 487)
        .background(Color(hex: 0xFBF9F5))
        .overlay {
            if rose { H5Glitter(opacity: 0.42, tint: Color(red: 1, green: 0.85, blue: 0.72)) } else { H5Glitter() }
        }
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private func kv(_ key: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(key).font(.h5Mono(rem(0.46))).trackingEm(0.14, size: rem(0.46)).opacity(0.68)
            Text(value).font(.h5Mono(rem(0.66))).fontWeight(.semibold).lineLimit(2)
        }
    }
}

// MARK: - 后台通行证 concert-backstage

struct TkConcertBackstage: View {
    @Environment(\.ticket) private var t

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 10) {
                Text("BACKSTAGE")
                Spacer(minLength: 0)
                Text("CREW")
            }
            .font(.h5Sans(rem(0.6)))
            .trackingEm(0.26, size: rem(0.6))
            .foregroundStyle(Color(hex: 0x6CFFB0))
            .padding(.vertical, 11)
            .padding(.horizontal, 14)
            .background(H5Stripes(color: Color(hex: 0x6CFFB0), angle: 135, line: 8, period: 16, opacity: 0.14))
            H5Photo().aspectRatio(3 / 4, contentMode: .fit).saturation(1.05).contrast(1.05)
            VStack(alignment: .leading, spacing: 0) {
                Text(t.title).font(.h5Mono(rem(1.34))).fontWeight(.bold).trackingEm(0.04, size: rem(1.34)).padding(.bottom, 6)
                Text(t.place).font(.h5Sans(rem(0.78))).foregroundStyle(Color(hex: 0xEAFFF0, alpha: 0.6))
                HStack(spacing: 10) {
                    Text(t.date)
                    Spacer(minLength: 0)
                    Text(t.seat)
                }
                .font(.h5Mono(rem(0.7)))
                .foregroundStyle(Color(hex: 0x9DFFCA))
                .padding(.vertical, 12)
                Text(t.mood).font(.h5Sans(rem(0.8))).foregroundStyle(Color(hex: 0xEAFFF0, alpha: 0.55))
            }
            .lineLimit(1)
            .padding(EdgeInsets(top: 14, leading: 16, bottom: 16, trailing: 16))
            Spacer(minLength: 0)
        }
        .foregroundStyle(Color(hex: 0xEAFFF0))
        .frame(width: 320, height: 595)
        .background(LinearGradient(colors: [Color(hex: 0x101A14), Color(hex: 0x060A08)], startPoint: UnitPoint(x: 0.45, y: 0), endPoint: UnitPoint(x: 0.55, y: 1)))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(Color(hex: 0x5AFFA0, alpha: 0.18), lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .punched(LeftHoles.holes)
    }
}
