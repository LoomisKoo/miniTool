import SwiftUI
import UIKit

struct ConfettiOverlay: UIViewRepresentable {
    let trigger: Int

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> ConfettiView {
        let view = ConfettiView()
        view.backgroundColor = .clear
        view.isOpaque = false
        view.isUserInteractionEnabled = false
        context.coordinator.view = view
        context.coordinator.lastTrigger = trigger
        return view
    }

    func updateUIView(_ uiView: ConfettiView, context: Context) {
        guard context.coordinator.lastTrigger != trigger else { return }
        context.coordinator.lastTrigger = trigger
        uiView.celebrate()
    }

    final class Coordinator {
        weak var view: ConfettiView?
        var lastTrigger = 0
    }
}

final class ConfettiView: UIView {
    private struct Particle {
        var kind: Int // 0: paper, 1: ribbon, 2: glitter
        var x: CGFloat
        var y: CGFloat
        var vx: CGFloat
        var vy: CGFloat
        var width: CGFloat
        var height: CGFloat
        var rotation: CGFloat
        var rotationSpeed: CGFloat
        var flip: CGFloat
        var flipSpeed: CGFloat
        var sway: CGFloat
        var swaySpeed: CGFloat
        var swayAmplitude: CGFloat
        var drag: CGFloat
        var color: UIColor
        var age: CGFloat
        var life: CGFloat
    }

    private let colors = [
        UIColor(red: 1, green: 0.36, blue: 0.48, alpha: 1),
        UIColor(red: 1, green: 0.72, blue: 0.24, alpha: 1),
        UIColor(red: 0.35, green: 0.82, blue: 0.70, alpha: 1),
        UIColor(red: 0.50, green: 0.60, blue: 0.96, alpha: 1),
        UIColor(red: 0.82, green: 0.48, blue: 0.88, alpha: 1)
    ]
    private var particles: [Particle] = []
    private var displayLink: CADisplayLink?
    private var lastTime: CFTimeInterval = 0
    private var startTime: CFTimeInterval = 0

    deinit {
        displayLink?.invalidate()
    }

    func celebrate() {
        displayLink?.invalidate()
        particles.removeAll(keepingCapacity: true)
        let scale = max(0.8, min(1.3, min(bounds.width, bounds.height) / 400))
        let y = bounds.height * 0.66
        addCannon(left: true, count: 56, y: y, scale: scale)
        addCannon(left: false, count: 56, y: y, scale: scale)
        startTime = CACurrentMediaTime()
        lastTime = startTime
        displayLink = CADisplayLink(target: self, selector: #selector(tick(_:)))
        displayLink?.add(to: .main, forMode: .common)
    }

    private func addCannon(left: Bool, count: Int, y: CGFloat, scale: CGFloat) {
        let x = left ? -8 : bounds.width + 8
        let base = left ? -CGFloat.pi / 3 : -CGFloat.pi * 2 / 3
        for _ in 0..<count {
            let angle = base + random(-0.32, 0.32)
            let speed = random(1900, 3300) * scale
            let ribbon = Int.random(in: 0..<100) < 22
            particles.append(Particle(
                kind: ribbon ? 1 : 0, x: x, y: y,
                vx: cos(angle) * speed, vy: sin(angle) * speed,
                width: random(ribbon ? 3 : 7, ribbon ? 4.5 : 11) * scale,
                height: random(ribbon ? 14 : 4.5, ribbon ? 22 : 7) * scale,
                rotation: random(0, .pi * 2), rotationSpeed: random(-7, 7),
                flip: random(0, .pi * 2), flipSpeed: random(6, 14),
                sway: random(0, .pi * 2), swaySpeed: random(2, 4.5),
                swayAmplitude: random(18, 42) * scale,
                drag: random(0.0042, 0.0068) / scale,
                color: colors.randomElement()!, age: 0, life: random(2.1, 2.8)
            ))
        }
        for _ in 0..<Int(Double(count) * 0.35) {
            let angle = base + random(-0.3, 0.3)
            let speed = random(1800, 3000) * scale
            particles.append(Particle(
                kind: 2, x: x, y: y,
                vx: cos(angle) * speed, vy: sin(angle) * speed,
                width: random(1.2, 2.4) * scale, height: 0,
                rotation: 0, rotationSpeed: 0, flip: random(0, .pi * 2),
                flipSpeed: random(10, 18), sway: 0, swaySpeed: 0,
                swayAmplitude: 0, drag: random(0.005, 0.008) / scale,
                color: [UIColor.white, UIColor(red: 1, green: 0.88, blue: 0.54, alpha: 1)].randomElement()!,
                age: 0, life: random(1.5, 2.2)
            ))
        }
    }

    @objc private func tick(_ link: CADisplayLink) {
        let dt = min(CGFloat(0.033), CGFloat(link.timestamp - lastTime))
        lastTime = link.timestamp
        let gravity: CGFloat = 330 * max(0.8, min(1.3, min(bounds.width, bounds.height) / 400))
        for index in particles.indices {
            particles[index].age += dt
            let speed = hypot(particles[index].vx, particles[index].vy)
            let factor = exp(-(0.5 + particles[index].drag * speed) * dt)
            particles[index].vx *= factor
            particles[index].vy = particles[index].vy * factor + gravity * dt * (particles[index].kind == 2 ? 1.3 : 1)
            particles[index].x += particles[index].vx * dt
            particles[index].y += particles[index].vy * dt
            particles[index].rotation += particles[index].rotationSpeed * dt
            particles[index].flip += particles[index].flipSpeed * dt
            particles[index].sway += particles[index].swaySpeed * dt
        }
        particles.removeAll { $0.age > $0.life || $0.y > bounds.height + 40 }
        setNeedsDisplay()
        if CACurrentMediaTime() - startTime > 0.52 && particles.isEmpty {
            displayLink?.invalidate()
            displayLink = nil
        }
    }

    override func draw(_ rect: CGRect) {
        guard let context = UIGraphicsGetCurrentContext() else { return }
        context.clear(rect)
        for particle in particles {
            let fade = min(1, (particle.life - particle.age) / 0.6)
            if particle.kind == 2 {
                particle.color.withAlphaComponent(fade).setFill()
                context.fillEllipse(in: CGRect(
                    x: particle.x - particle.width,
                    y: particle.y - particle.width,
                    width: particle.width * 2,
                    height: particle.width * 2
                ))
                continue
            }
            let falling = particle.vy > 0 ? min(1, particle.vy / 120) : 0
            let offset = sin(particle.sway) * particle.swayAmplitude * falling
            context.saveGState()
            context.translateBy(x: particle.x + offset, y: particle.y)
            context.rotate(by: particle.rotation + sin(particle.sway) * 0.4 * falling)
            context.scaleBy(x: 1, y: max(0.08, abs(cos(particle.flip))))
            particle.color.withAlphaComponent(fade).setFill()
            if particle.kind == 1 {
                let hw = particle.width / 2
                let hh = particle.height / 2
                let path = UIBezierPath()
                path.move(to: CGPoint(x: -hw, y: -hh))
                path.addCurve(to: CGPoint(x: -hw, y: hh), controlPoint1: CGPoint(x: hw * 3, y: -hh / 3), controlPoint2: CGPoint(x: -hw * 3, y: hh / 3))
                path.addLine(to: CGPoint(x: hw, y: hh))
                path.addCurve(to: CGPoint(x: hw, y: -hh), controlPoint1: CGPoint(x: -hw, y: hh / 3), controlPoint2: CGPoint(x: hw * 5, y: -hh / 3))
                path.close()
                path.fill()
            } else {
                context.fill(CGRect(x: -particle.width / 2, y: -particle.height / 2, width: particle.width, height: particle.height))
            }
            context.restoreGState()
        }
    }

    private func random(_ min: CGFloat, _ max: CGFloat) -> CGFloat {
        min + CGFloat.random(in: 0...1) * (max - min)
    }
}
