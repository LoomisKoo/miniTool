import CoreMotion
import SwiftUI

struct TicketCardView: View {
    @Environment(TicketStore.self) private var store
    @GestureState private var dragOffset = CGSize.zero
    var interactive = true

    var body: some View {
        GeometryReader { proxy in
            let size = store.template.size
            let scale = min(proxy.size.width / size.width, proxy.size.height / size.height)
            let context = TicketContext(store: store)

            ZStack {
                H5TicketView()
                scopedEffects(.background)
                    .blendMode(.multiply)
                scopedEffects(.foreground)
            }
                .environment(\.ticket, context)
                .frame(width: size.width, height: size.height)
                .scaleEffect(scale)
                .frame(width: proxy.size.width, height: proxy.size.height)
                .shadow(color: .black.opacity(interactive ? 0.42 : 0.3), radius: interactive ? 22 : 8, y: interactive ? 14 : 4)
                .rotation3DEffect(.degrees(Double(dragOffset.width / 16)), axis: (x: 0, y: 1, z: 0))
                .rotation3DEffect(.degrees(Double(-dragOffset.height / 20)), axis: (x: 1, y: 0, z: 0))
                .gesture(
                    DragGesture(minimumDistance: 0)
                        .updating($dragOffset) { value, state, _ in
                            if interactive { state = value.translation }
                        }
                )
        }
    }

    @ViewBuilder
    private func scopedEffects(_ scope: EffectScope) -> some View {
        ZStack {
            ForEach(store.effects.filter { store.settings(for: $0).resolvedTarget == scope }) { effect in
                EffectVisualOverlay(effectID: effect.id, settings: store.settings(for: effect))
            }
        }
        .mask { H5TicketView() }
        .environment(\.ticket, TicketContext(store: store))
        .environment(\.glitterTilt, CGSize(width: dragOffset.width / 140, height: dragOffset.height / 140))
    }
}

struct EffectVisualOverlay: View {
    let effectID: String
    let settings: EffectSettings
    var isPreview = false

    var body: some View {
        GeometryReader { proxy in
            switch effectID {
            case "tex-paper":
                Canvas { context, size in
                    for x in stride(from: -size.height, through: size.width, by: 12) {
                        var path = Path()
                        path.move(to: CGPoint(x: x, y: 0))
                        path.addLine(to: CGPoint(x: x + size.height, y: size.height))
                        context.stroke(path, with: .color(.brown.opacity(0.12)), lineWidth: 1)
                    }
                }
                .blendMode(.multiply)
            case "tex-grain", "tex-noise":
                Canvas { context, size in
                    for index in 0..<180 {
                        let x = CGFloat((index * 47) % 100) / 100 * size.width
                        let y = CGFloat((index * 71) % 100) / 100 * size.height
                        let r = CGFloat(index % 3 + 1)
                        context.fill(Path(ellipseIn: CGRect(x: x, y: y, width: r, height: r)), with: .color(.white.opacity(0.17)))
                    }
                }
                .blendMode(.overlay)
            case "tex-halftone":
                Canvas { context, size in
                    for x in stride(from: 4, through: size.width, by: 10) {
                        for y in stride(from: 4, through: size.height, by: 10) {
                            context.fill(Path(ellipseIn: CGRect(x: x, y: y, width: 3, height: 3)), with: .color(.black.opacity(0.22)))
                        }
                    }
                }
                .blendMode(.multiply)
            case "tex-linen":
                Canvas { context, size in
                    for x in stride(from: 0, through: size.width, by: 5) {
                        var path = Path()
                        path.move(to: CGPoint(x: x, y: 0))
                        path.addLine(to: CGPoint(x: x, y: size.height))
                        context.stroke(path, with: .color(.white.opacity(0.08)), lineWidth: 1)
                    }
                    for y in stride(from: 0, through: size.height, by: 5) {
                        var path = Path()
                        path.move(to: CGPoint(x: 0, y: y))
                        path.addLine(to: CGPoint(x: size.width, y: y))
                        context.stroke(path, with: .color(.black.opacity(0.08)), lineWidth: 1)
                    }
                }
            case "tex-diag":
                Canvas { context, size in
                    for x in stride(from: -size.height, through: size.width, by: 18) {
                        var path = Path()
                        path.move(to: CGPoint(x: x, y: 0))
                        path.addLine(to: CGPoint(x: x + size.height, y: size.height))
                        context.stroke(path, with: .color(.black.opacity(0.16)), lineWidth: 4)
                    }
                }
                .blendMode(.multiply)
            case "pat-corners":
                RoundedRectangle(cornerRadius: 18)
                    .stroke(.yellow.opacity(0.7), style: StrokeStyle(lineWidth: 3, dash: [2, 18]))
                    .padding(12)
            case "pat-dash":
                RoundedRectangle(cornerRadius: 18)
                    .stroke(.white.opacity(0.72), style: StrokeStyle(lineWidth: 2, dash: [8, 5]))
                    .padding(9)
            case "pat-stars":
                Text("✦  ·  ✧    ✦     ·   ✧")
                    .font(.system(size: 28, weight: .light))
                    .foregroundStyle(.yellow.opacity(0.55))
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                    .padding(16)
            case "pat-grid":
                GridPattern(color: .cyan.opacity(0.25), step: 28)
            case "pat-waves":
                WavePattern()
            case "stp-postmark":
                StampMark(text: "POSTED", color: .red, rotation: -18, isPreview: isPreview)
            case "stp-approved":
                StampMark(text: "APPROVED", color: .red, rotation: -12, isPreview: isPreview)
            case "stp-checked":
                StampMark(text: AppLocalization.isEnglish ? "CHECKED" : "已验票", color: .red, rotation: -8, isPreview: isPreview)
            case "stp-paid":
                StampMark(text: "PAID", color: .blue, rotation: 12, isPreview: isPreview)
            case "stp-custom":
                StampMark(text: settings.customText ?? "MEMENTO", color: .white, rotation: -8, isPreview: isPreview)
            case "stp-wax":
                Circle()
                    .fill(.red.gradient)
                    .frame(width: 54, height: 54)
                    .overlay(Text("F").font(.system(size: 20, weight: .bold)).foregroundStyle(.white.opacity(0.8)))
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
                    .padding(24)
            case "txt-custom":
                Text(settings.customText ?? AppLocalization.text("记忆"))
                    .font(.system(size: isPreview ? 22 : 24, weight: .bold, design: .serif))
                    .foregroundStyle(.white.opacity(isPreview ? 0.95 : 0.8))
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: isPreview ? .center : .bottomLeading)
                    .padding(isPreview ? 0 : 20)
            case "txt-time":
                Text(Date.now, style: .date)
                    .font(.system(size: isPreview ? 22 : 10, design: .monospaced))
                    .foregroundStyle(.white.opacity(isPreview ? 0.95 : 0.8))
                    .lineLimit(1)
                    .minimumScaleFactor(0.65)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: isPreview ? .center : .topTrailing)
                    .padding(isPreview ? 0 : 18)
            case "txt-mark", "txt-diag":
                Text("ARCHIVE")
                    .font(.system(size: isPreview ? 22 : 18, weight: .black, design: .monospaced))
                    .tracking(isPreview ? 1.2 : 3)
                    .foregroundStyle(.white.opacity(isPreview ? 0.95 : 0.72))
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
                    .fixedSize(horizontal: true, vertical: false)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
                    .rotationEffect(.degrees(isPreview ? -12 : -24))
            case "lit-glitter", "lit-rose":
                GlitterField(color: settings.color.background, density: settings.density)
            case "lit-vignette":
                RadialGradient(colors: [.clear, .black.opacity(0.65)], center: .center, startRadius: 30, endRadius: max(proxy.size.width, proxy.size.height) * (0.42 + settings.density * 0.82))
                    .blendMode(.multiply)
            case "lit-leak":
                LinearGradient(colors: [.orange.opacity(0.65), .clear, .clear], startPoint: .topLeading, endPoint: .bottomTrailing)
                    .blur(radius: 14)
                    .blendMode(.screen)
            case "lit-neon":
                RadialGradient(colors: [.pink.opacity(0.65), .purple.opacity(0.18), .clear], center: .topTrailing, startRadius: 0, endRadius: 190)
                    .blur(radius: 10)
                    .blendMode(.screen)
            case "lit-beam":
                LinearGradient(colors: [.white.opacity(0.42), .clear], startPoint: .topLeading, endPoint: .bottomTrailing)
                    .blur(radius: 8)
                    .blendMode(.screen)
            default:
                EmptyView()
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .opacity(settings.opacity)
        .offset(
            x: (effectID.hasPrefix("stp-") || effectID.hasPrefix("txt-")) ? CGFloat(settings.positionX - 50) * 1.6 : 0,
            y: (effectID.hasPrefix("stp-") || effectID.hasPrefix("txt-")) ? CGFloat(settings.positionY - 50) * 1.2 : 0
        )
        .allowsHitTesting(false)
    }
}

private struct StampMark: View {
    let text: String
    let color: Color
    let rotation: Double
    var isPreview = false

    var body: some View {
        Text(text)
            .font(.system(size: isPreview ? 18 : 11, weight: .black, design: .monospaced))
            .foregroundStyle(color.opacity(0.8))
            .padding(isPreview ? 10 : 8)
            .overlay(Circle().stroke(color.opacity(0.8), lineWidth: 2))
            .rotationEffect(.degrees(rotation))
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: isPreview ? .center : .topTrailing)
            .padding(isPreview ? 0 : 22)
    }
}

private struct GlitterTiltKey: EnvironmentKey {
    static let defaultValue = CGSize.zero
}

extension EnvironmentValues {
    /// 手指拖动票根产生的倾斜（约 -1...1），叠加到设备姿态上决定闪粉反光
    var glitterTilt: CGSize {
        get { self[GlitterTiltKey.self] }
        set { self[GlitterTiltKey.self] = newValue }
    }
}

/// 设备姿态：按引用计数启停陀螺仪，没有闪粉时不耗电
enum DeviceTilt {
    private static let manager: CMMotionManager = {
        let manager = CMMotionManager()
        manager.deviceMotionUpdateInterval = 1 / 60
        return manager
    }()
    private static var users = 0

    static func start() {
        users += 1
        if users == 1, manager.isDeviceMotionAvailable { manager.startDeviceMotionUpdates() }
    }

    static func stop() {
        users = max(0, users - 1)
        if users == 0 { manager.stopDeviceMotionUpdates() }
    }

    /// 以竖持手机、前倾约 45° 为中性姿态
    static var current: CGSize {
        guard let gravity = manager.deviceMotion?.gravity else { return .zero }
        return CGSize(width: gravity.x, height: gravity.y + 0.7)
    }
}

private struct GlitterParticle {
    let x: CGFloat
    let y: CGFloat
    let radius: CGFloat
    /// 每粒粉的反光朝向：光照方向接近它时才会亮
    let facetX: CGFloat
    let facetY: CGFloat
    let tone: CGFloat
}

private enum GlitterParticles {
    private static var cache: [String: [GlitterParticle]] = [:]

    /// 抖动网格撒点，保证细密且均匀，不会扎堆
    static func make(size: CGSize, spacing: CGFloat) -> [GlitterParticle] {
        guard size.width > 1, size.height > 1 else { return [] }
        let key = "\(Int(size.width))x\(Int(size.height))@\(Int(spacing * 10))"
        if let hit = cache[key] { return hit }
        var rng = SplitMix64(seed: 0x5EED_6A11)
        var result: [GlitterParticle] = []
        var y = spacing / 2
        while y < size.height {
            var x = spacing / 2
            while x < size.width {
                result.append(GlitterParticle(
                    x: x + (rng.unit() - 0.5) * spacing,
                    y: y + (rng.unit() - 0.5) * spacing,
                    radius: 0.6 + rng.unit() * 0.12,
                    facetX: (rng.unit() * 2 - 1) * 1.3,
                    facetY: (rng.unit() * 2 - 1) * 1.3,
                    tone: rng.unit()
                ))
                x += spacing
            }
            y += spacing
        }
        if cache.count > 24 { cache.removeAll() }
        cache[key] = result
        return result
    }
}

private struct SplitMix64 {
    var state: UInt64
    init(seed: UInt64) { state = seed }

    mutating func unit() -> CGFloat {
        state &+= 0x9E37_79B9_7F4A_7C15
        var z = state
        z = (z ^ (z >> 30)) &* 0xBF58_476D_1CE4_E5B9
        z = (z ^ (z >> 27)) &* 0x94D0_49BB_1331_11EB
        z ^= z >> 31
        return CGFloat(z >> 11) / CGFloat(1 << 53)
    }
}

/// 反光粉：一层细密均匀的底粉 + 随倾斜角度变化的点状高光
private struct GlitterField: View {
    let color: Color
    let density: Double
    @Environment(\.glitterTilt) private var dragTilt

    var body: some View {
        GeometryReader { proxy in
            let particles = GlitterParticles.make(size: proxy.size, spacing: 8.5 - 4.5 * CGFloat(density))
            ZStack {
                Canvas { context, _ in
                    var dim = Path()
                    var bright = Path()
                    for particle in particles {
                        let r = particle.radius
                        let rect = CGRect(x: particle.x - r, y: particle.y - r, width: r * 2, height: r * 2)
                        if particle.tone < 0.6 { dim.addEllipse(in: rect) } else { bright.addEllipse(in: rect) }
                    }
                    context.fill(dim, with: .color(color.opacity(0.32)))
                    context.fill(bright, with: .color(color.opacity(0.6)))
                }

                // 只随倾斜角度变化，不随时间闪烁；TimelineView 仅用于读取陀螺仪
                TimelineView(.animation) { _ in
                    Canvas { context, _ in
                        let device = DeviceTilt.current
                        let lightX = device.width * 1.4 + dragTilt.width
                        let lightY = device.height * 1.4 + dragTilt.height
                        let reach: CGFloat = 0.26
                        let reach2 = reach * reach
                        var strong = Path()
                        var soft = Path()
                        for particle in particles {
                            let dx = particle.facetX - lightX
                            let dy = particle.facetY - lightY
                            let d2 = dx * dx + dy * dy
                            guard d2 < reach2 else { continue }
                            let r = particle.radius
                            let rect = CGRect(x: particle.x - r, y: particle.y - r, width: r * 2, height: r * 2)
                            if d2 < reach2 * 0.4 { strong.addEllipse(in: rect) } else { soft.addEllipse(in: rect) }
                        }
                        context.fill(soft, with: .color(.white.opacity(0.5)))
                        context.fill(strong, with: .color(.white.opacity(0.95)))
                    }
                }
                .blendMode(.plusLighter)
            }
        }
        .onAppear { DeviceTilt.start() }
        .onDisappear { DeviceTilt.stop() }
    }
}

private struct GridPattern: View {
    let color: Color
    let step: CGFloat

    var body: some View {
        Canvas { context, size in
            for x in stride(from: 0, through: size.width, by: step) {
                var path = Path()
                path.move(to: CGPoint(x: x, y: 0))
                path.addLine(to: CGPoint(x: x, y: size.height))
                context.stroke(path, with: .color(color), lineWidth: 1)
            }
            for y in stride(from: 0, through: size.height, by: step) {
                var path = Path()
                path.move(to: CGPoint(x: 0, y: y))
                path.addLine(to: CGPoint(x: size.width, y: y))
                context.stroke(path, with: .color(color), lineWidth: 1)
            }
        }
    }
}

private struct WavePattern: View {
    var body: some View {
        Canvas { context, size in
            for y in stride(from: 12, through: size.height, by: 26) {
                var path = Path()
                path.move(to: CGPoint(x: 0, y: y))
                path.addCurve(to: CGPoint(x: size.width, y: y), control1: CGPoint(x: size.width * 0.3, y: y - 10), control2: CGPoint(x: size.width * 0.7, y: y + 10))
                context.stroke(path, with: .color(.white.opacity(0.28)), lineWidth: 1.5)
            }
        }
    }
}

private func defaultArtworkName(for category: TicketCategory) -> String {
    switch category {
    case .cinema: "DefaultCinemaArtwork"
    case .travel: "DefaultTravelArtwork"
    case .concert: "DefaultConcertArtwork"
    case .wander: "DefaultCityArtwork"
    case .stamp: "DefaultStampArtwork"
    }
}
