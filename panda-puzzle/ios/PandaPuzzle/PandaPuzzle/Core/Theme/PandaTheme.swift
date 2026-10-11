import SwiftUI

enum PandaTheme {
    static let bg0 = Color(red: 0.08, green: 0.09, blue: 0.18)
    static let ink = Color(red: 0.95, green: 0.94, blue: 1.0)
    static let muted = Color(red: 0.62, green: 0.58, blue: 0.78)
    static let canvas = Color(red: 0.11, green: 0.12, blue: 0.24)
    static let accent = Color(red: 1.0, green: 0.71, blue: 0.28)
    static let accentDeep = Color(red: 0.92, green: 0.55, blue: 0.12)
    static let accentSoft = Color(red: 1.0, green: 0.82, blue: 0.48)
    static let surface = Color.white.opacity(0.06)
    static let surface2 = Color.white.opacity(0.1)
    static let line = Color.white.opacity(0.08)
    static let ok = Color(red: 0.31, green: 0.82, blue: 0.65)

    static let phoneGradient = LinearGradient(
        stops: [
            .init(color: Color(red: 0.11, green: 0.12, blue: 0.24), location: 0),
            .init(color: Color(red: 0.08, green: 0.09, blue: 0.18), location: 1),
        ],
        startPoint: .top,
        endPoint: .bottom
    )

    static var accentGradient: LinearGradient {
        LinearGradient(colors: [accentSoft, accentDeep], startPoint: .topLeading, endPoint: .bottomTrailing)
    }

    static let thumbSize: CGFloat = 58
    static let trayRows: Int = 3
    static let cardRadius: CGFloat = 26
}
