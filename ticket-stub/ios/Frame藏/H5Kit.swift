import CoreText
import SwiftUI
import UIKit

enum H5Fonts {
    static func register() {
        let names = ["DMSans", "DMSans-Italic", "InstrumentSerif", "InstrumentSerif-Italic", "JetBrainsMono", "Lora", "PinyonScript"]
        for name in names {
            guard let url = Bundle.main.url(forResource: name, withExtension: "ttf") else { continue }
            CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
        }
    }
}

/// CSS px 与 pt 1:1；1rem = 16px
func rem(_ value: CGFloat) -> CGFloat { value * 16 }

extension Font {
    static func h5Sans(_ size: CGFloat, _ weight: Font.Weight = .regular) -> Font {
        .custom("DMSans-9ptRegular", fixedSize: size).weight(weight)
    }

    static func h5Serif(_ size: CGFloat, italic: Bool = false) -> Font {
        .custom(italic ? "InstrumentSerif-Italic" : "InstrumentSerif-Regular", fixedSize: size)
    }

    static func h5Mono(_ size: CGFloat, _ weight: Font.Weight = .regular) -> Font {
        .custom("JetBrainsMono-Regular", fixedSize: size).weight(weight)
    }

    static func h5Lora(_ size: CGFloat, _ weight: Font.Weight = .semibold) -> Font {
        .custom("Lora-Regular", fixedSize: size).weight(weight)
    }

    static func h5Script(_ size: CGFloat) -> Font {
        .custom("PinyonScript-Regular", fixedSize: size)
    }
}

extension Color {
    init(hex: UInt32, alpha: Double = 1) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: alpha
        )
    }

    static let h5Ink = Color(hex: 0x16140F)
    static let h5Paper = LinearGradient(colors: [Color(hex: 0xF7F2E9), Color(hex: 0xEFE7DA)], startPoint: .top, endPoint: .bottom)
}

// MARK: - 票面数据环境

struct TicketContext {
    var template: TicketTemplate
    var fields: TicketFields
    var photos: [UIImage?] = []
    var photoScale: CGFloat = 1
    var photoOffset: CGSize = .zero
    var photoEffects: [TicketEffect] = []
    var photoEffectSettings: [String: EffectSettings] = [:]

    var title: String { AppLocalization.text(fields.title) }
    var place: String { AppLocalization.text(fields.place) }
    var date: String { AppLocalization.text(fields.date) }
    var seat: String { AppLocalization.text(fields.seat) }
    var mood: String { AppLocalization.text(fields.mood) }
}

private struct TicketContextKey: EnvironmentKey {
    static let defaultValue = TicketContext(template: TicketCatalog.templates[0], fields: TicketCatalog.templates[0].localizedDefaults)
}

extension EnvironmentValues {
    var ticket: TicketContext {
        get { self[TicketContextKey.self] }
        set { self[TicketContextKey.self] = newValue }
    }
}

/// 照片位：铺满容器（object-fit: cover），用户照片支持缩放/平移
struct H5Photo: View {
    @Environment(\.ticket) private var t
    var slot = 0

    var body: some View {
        Color(hex: 0xD8D0C4)
            .overlay {
                if let image = t.photos.indices.contains(slot) ? t.photos[slot] : nil {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFill()
                        .scaleEffect(t.photoScale)
                        .offset(t.photoOffset)
                } else {
                    Image(t.template.category.artworkName)
                        .resizable()
                        .scaledToFill()
                }
            }
            .overlay {
                ForEach(t.photoEffects) { effect in
                    EffectVisualOverlay(
                        effectID: effect.id,
                        settings: t.photoEffectSettings[effect.id] ?? EffectSettings(color: effect.tint)
                    )
                }
            }
            .clipped()
    }
}

// MARK: - Lucide → SF Symbols

struct LIcon: View {
    let name: String
    var size: CGFloat = 14
    var weight: Font.Weight = .regular

    init(_ name: String, size: CGFloat = 14, weight: Font.Weight = .regular) {
        self.name = name
        self.size = size
        self.weight = weight
    }

    var body: some View {
        Image(systemName: LIcon.symbol(for: name))
            .font(.system(size: size * 0.86, weight: weight))
            .frame(width: size, height: size)
    }

    static func symbol(for name: String) -> String {
        switch name {
        case "anchor": "sailboat"
        case "audio-lines": "waveform"
        case "award": "rosette"
        case "book-open": "book"
        case "camera": "camera"
        case "clapperboard": "film"
        case "clock-3": "clock"
        case "coffee": "cup.and.saucer"
        case "compass": "safari"
        case "crown": "crown"
        case "door-open": "door.left.hand.open"
        case "drama": "theatermasks"
        case "drum": "music.quarternote.3"
        case "film": "film"
        case "flag": "flag"
        case "flame": "flame"
        case "flower-2": "camera.macro"
        case "gem": "diamond"
        case "globe": "globe"
        case "guitar": "guitars"
        case "hash": "number"
        case "landmark": "building.columns"
        case "leaf": "leaf"
        case "mail": "envelope"
        case "mailbox": "mail.stack"
        case "map": "map"
        case "map-pin": "mappin.and.ellipse"
        case "map-pinned": "mappin.circle"
        case "mic-2": "music.mic"
        case "moon": "moon"
        case "mountain": "mountain.2"
        case "move-right": "arrow.right"
        case "music", "music-2": "music.note"
        case "palette": "paintpalette"
        case "plane": "airplane"
        case "popcorn": "popcorn"
        case "ruler": "ruler"
        case "sailboat": "sailboat"
        case "ship": "ferry"
        case "snowflake": "snowflake"
        case "sparkles": "sparkles"
        case "speaker": "hifispeaker"
        case "stamp": "seal"
        case "star": "star"
        case "sun": "sun.max"
        case "sunset": "sunset"
        case "tent": "tent"
        case "torii-gate": "building.columns"
        case "train-front": "tram"
        case "trees": "tree"
        case "user-round": "person.crop.circle"
        case "waves": "water.waves"
        case "zap": "bolt"
        case "plane-takeoff": "airplane.departure"
        case "ticket": "ticket"
        default: "circle"
        }
    }
}

// MARK: - 背景图案（对应 .bg-*）

struct H5Dots: View {
    var color: Color = .h5Ink
    var spacing: CGFloat = 11
    var radius: CGFloat = 1.1
    var opacity: Double = 0.11

    var body: some View {
        Canvas { ctx, size in
            var y = spacing / 2
            while y < size.height {
                var x = spacing / 2
                while x < size.width {
                    ctx.fill(Path(ellipseIn: CGRect(x: x - radius, y: y - radius, width: radius * 2, height: radius * 2)), with: .color(color))
                    x += spacing
                }
                y += spacing
            }
        }
        .opacity(opacity)
        .allowsHitTesting(false)
    }
}

struct H5Grid: View {
    var color: Color = .h5Ink
    var step: CGFloat = 20
    var lineWidth: CGFloat = 1
    var opacity: Double = 0.09

    var body: some View {
        Canvas { ctx, size in
            var path = Path()
            var x: CGFloat = 0
            while x <= size.width { path.addRect(CGRect(x: x, y: 0, width: lineWidth, height: size.height)); x += step }
            var y: CGFloat = 0
            while y <= size.height { path.addRect(CGRect(x: 0, y: y, width: size.width, height: lineWidth)); y += step }
            ctx.fill(path, with: .color(color))
        }
        .opacity(opacity)
        .allowsHitTesting(false)
    }
}

struct H5Stripes: View {
    var color: Color = .h5Ink
    var angle: Double = 90
    var line: CGFloat = 1
    var period: CGFloat = 8
    var opacity: Double = 0.07

    var body: some View {
        Canvas { ctx, size in
            let diag = hypot(size.width, size.height)
            ctx.translateBy(x: size.width / 2, y: size.height / 2)
            ctx.rotate(by: .degrees(angle - 90))
            var path = Path()
            var x = -diag
            while x < diag { path.addRect(CGRect(x: x, y: -diag, width: line, height: diag * 2)); x += period }
            ctx.fill(path, with: .color(color))
        }
        .opacity(opacity)
        .allowsHitTesting(false)
    }
}

struct H5Chevron: View {
    var color: Color = .h5Ink
    var step: CGFloat = 15
    var opacity: Double = 0.1

    var body: some View {
        Canvas { ctx, size in
            var path = Path()
            var y: CGFloat = 0
            while y < size.height + step {
                var x: CGFloat = 0
                while x < size.width + step {
                    path.move(to: CGPoint(x: x, y: y + step * 0.5))
                    path.addLine(to: CGPoint(x: x + step * 0.5, y: y))
                    path.addLine(to: CGPoint(x: x + step, y: y + step * 0.5))
                    x += step
                }
                y += step
            }
            ctx.stroke(path, with: .color(color), lineWidth: step * 0.08 * 1.4)
        }
        .opacity(opacity)
        .allowsHitTesting(false)
    }
}

struct H5Rings: View {
    var color: Color = .h5Ink
    var center = UnitPoint(x: 0.5, y: 0.42)
    var period: CGFloat = 18
    var opacity: Double = 0.09

    var body: some View {
        Canvas { ctx, size in
            let c = CGPoint(x: size.width * center.x, y: size.height * center.y)
            let maxR = hypot(max(c.x, size.width - c.x), max(c.y, size.height - c.y))
            var r = period - 0.5
            while r < maxR {
                ctx.stroke(Path(ellipseIn: CGRect(x: c.x - r, y: c.y - r, width: r * 2, height: r * 2)), with: .color(color), lineWidth: 1)
                r += period
            }
        }
        .opacity(opacity)
        .allowsHitTesting(false)
    }
}

/// 细碎反光粉（.fx-glitter 近似）
struct H5Glitter: View {
    var opacity: Double = 0.55
    var tint = Color(hex: 0xFFF0CC)
    var count = 220

    var body: some View {
        Canvas { ctx, size in
            var seed: UInt64 = 0x9E3779B97F4A7C15
            func rand() -> CGFloat {
                seed = seed &* 6364136223846793005 &+ 1442695040888963407
                return CGFloat((seed >> 33) % 10_000) / 10_000
            }
            let n = Int(CGFloat(count) * size.width * size.height / (320 * 400))
            for _ in 0..<max(n, 20) {
                let x = rand() * size.width
                let y = rand() * size.height
                let r = 0.4 + rand() * 0.9
                ctx.fill(Path(ellipseIn: CGRect(x: x, y: y, width: r, height: r)), with: .color(tint.opacity(0.5 + Double(rand()) * 0.5)))
            }
        }
        .blendMode(.screen)
        .opacity(opacity)
        .allowsHitTesting(false)
    }
}

/// 纸面颗粒（.fx-grain 近似）
struct H5Grain: View {
    var opacity: Double = 0.4

    var body: some View {
        Canvas { ctx, size in
            var seed: UInt64 = 0x2545F4914F6CDD1D
            func rand() -> CGFloat {
                seed = seed &* 6364136223846793005 &+ 1442695040888963407
                return CGFloat((seed >> 33) % 10_000) / 10_000
            }
            let n = Int(size.width * size.height / 14)
            for _ in 0..<n {
                let x = rand() * size.width
                let y = rand() * size.height
                ctx.fill(Path(CGRect(x: x, y: y, width: 0.8, height: 0.8)), with: .color(.black.opacity(Double(rand()) * 0.35)))
            }
        }
        .blendMode(.multiply)
        .opacity(opacity)
        .allowsHitTesting(false)
    }
}

/// 条码：repeating-linear-gradient(90deg, color 0 bar, transparent bar period)
struct H5Barcode: View {
    var color: Color = Color(hex: 0x1A1612)
    var bar: CGFloat = 2
    var period: CGFloat = 5

    var body: some View {
        Canvas { ctx, size in
            var path = Path()
            var x: CGFloat = 0
            while x < size.width { path.addRect(CGRect(x: x, y: 0, width: bar, height: size.height)); x += period }
            ctx.fill(path, with: .color(color))
        }
    }
}

/// 不规则条码（粗细交替）
struct H5Bars: View {
    var color: Color = Color(hex: 0x1A1612)
    var pattern: [CGFloat] = [2, 1, 1, 2, 3, 1, 1, 1, 2, 2, 1, 3]

    var body: some View {
        Canvas { ctx, size in
            var path = Path()
            var x: CGFloat = 0
            var i = 0
            while x < size.width {
                let w = pattern[i % pattern.count]
                if i.isMultiple(of: 2) {
                    path.addRect(CGRect(x: x, y: 0, width: min(w, size.width - x), height: size.height))
                }
                x += w
                i += 1
            }
            ctx.fill(path, with: .color(color))
        }
    }
}

/// 虚线（CSS dashed border 近似）
struct H5Dash: View {
    var color: Color
    var lineWidth: CGFloat = 1
    var dash: [CGFloat] = [4, 4]
    var vertical = false

    var body: some View {
        GeometryReader { proxy in
            Path { p in
                if vertical {
                    p.move(to: CGPoint(x: proxy.size.width / 2, y: 0))
                    p.addLine(to: CGPoint(x: proxy.size.width / 2, y: proxy.size.height))
                } else {
                    p.move(to: CGPoint(x: 0, y: proxy.size.height / 2))
                    p.addLine(to: CGPoint(x: proxy.size.width, y: proxy.size.height / 2))
                }
            }
            .stroke(color, style: StrokeStyle(lineWidth: lineWidth, dash: dash))
        }
        .frame(width: vertical ? lineWidth : nil, height: vertical ? nil : lineWidth)
    }
}

// MARK: - 打孔遮罩（mask radial-gradient 透明孔）

struct Punch {
    var center: (CGSize) -> CGPoint
    var radius: CGFloat
}

extension Punch {
    init(x: CGFloat, y: CGFloat, r: CGFloat) {
        self.init(center: { _ in CGPoint(x: x, y: y) }, radius: r)
    }
}

extension View {
    /// 在给定位置打出真正透明的圆孔
    func punched(_ holes: [Punch]) -> some View {
        mask {
            Canvas { ctx, size in
                ctx.fill(Path(CGRect(origin: .zero, size: size)), with: .color(.black))
                ctx.blendMode = .clear
                for hole in holes {
                    let c = hole.center(size)
                    ctx.fill(Path(ellipseIn: CGRect(x: c.x - hole.radius, y: c.y - hole.radius, width: hole.radius * 2, height: hole.radius * 2)), with: .color(.black))
                }
            }
        }
    }

    /// 文字间距用 em 表示（CSS letter-spacing）
    func trackingEm(_ em: CGFloat, size: CGFloat) -> some View {
        tracking(em * size)
    }
}

/// 邮票齿孔：四边半圆孔
struct PerfShape: Shape {
    var step: CGFloat = 16
    var radius: CGFloat = 7

    func path(in rect: CGRect) -> Path {
        var p = Path(rect)
        func holes(along length: CGFloat, make: (CGFloat) -> CGPoint) {
            let count = Int((length - step / 2) / step)
            let start = (length - CGFloat(count - 1) * step) / 2
            for i in 0..<max(count, 0) {
                let c = make(start + CGFloat(i) * step)
                p.addEllipse(in: CGRect(x: c.x - radius, y: c.y - radius, width: radius * 2, height: radius * 2))
            }
        }
        holes(along: rect.width) { CGPoint(x: rect.minX + $0, y: rect.minY) }
        holes(along: rect.width) { CGPoint(x: rect.minX + $0, y: rect.maxY) }
        holes(along: rect.height) { CGPoint(x: rect.minX, y: rect.minY + $0) }
        holes(along: rect.height) { CGPoint(x: rect.maxX, y: rect.minY + $0) }
        return p
    }
}

extension View {
    func perforated(step: CGFloat = 16, radius: CGFloat = 7) -> some View {
        clipShape(PerfShape(step: step, radius: radius), style: FillStyle(eoFill: true))
    }

    /// 只在上下两边打齿孔
    func perforatedTopBottom(step: CGFloat = 16, radius: CGFloat = 7) -> some View {
        clipShape(PerfTopBottom(step: step, radius: radius), style: FillStyle(eoFill: true))
    }
}

struct PerfTopBottom: Shape {
    var step: CGFloat = 16
    var radius: CGFloat = 7

    func path(in rect: CGRect) -> Path {
        var p = Path(rect)
        let count = Int((rect.width - step / 2) / step)
        let start = (rect.width - CGFloat(count - 1) * step) / 2
        for i in 0..<max(count, 0) {
            let x = rect.minX + start + CGFloat(i) * step
            for y in [rect.minY, rect.maxY] {
                p.addEllipse(in: CGRect(x: x - radius, y: y - radius, width: radius * 2, height: radius * 2))
            }
        }
        return p
    }
}

/// 两侧小锯齿（锯齿影票 / 卷筒）
struct ZigzagEdges: Shape {
    var tooth: CGFloat = 6
    var depth: CGFloat = 4
    var horizontal = true

    func path(in rect: CGRect) -> Path {
        var p = Path()
        if horizontal {
            p.move(to: CGPoint(x: rect.minX, y: rect.minY))
            var x = rect.minX
            while x < rect.maxX { p.addLine(to: CGPoint(x: min(x + tooth / 2, rect.maxX), y: rect.minY + depth)); x += tooth; p.addLine(to: CGPoint(x: min(x, rect.maxX), y: rect.minY)) }
            p.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
            x = rect.maxX
            while x > rect.minX { p.addLine(to: CGPoint(x: max(x - tooth / 2, rect.minX), y: rect.maxY - depth)); x -= tooth; p.addLine(to: CGPoint(x: max(x, rect.minX), y: rect.maxY)) }
        } else {
            p.move(to: CGPoint(x: rect.minX, y: rect.minY))
            p.addLine(to: CGPoint(x: rect.maxX, y: rect.minY))
            var y = rect.minY
            while y < rect.maxY { p.addLine(to: CGPoint(x: rect.maxX - depth, y: min(y + tooth / 2, rect.maxY))); y += tooth; p.addLine(to: CGPoint(x: rect.maxX, y: min(y, rect.maxY))) }
            p.addLine(to: CGPoint(x: rect.minX, y: rect.maxY))
            y = rect.maxY
            while y > rect.minY { p.addLine(to: CGPoint(x: rect.minX + depth, y: max(y - tooth / 2, rect.minY))); y -= tooth; p.addLine(to: CGPoint(x: rect.minX, y: max(y, rect.minY))) }
        }
        p.closeSubpath()
        return p
    }
}
