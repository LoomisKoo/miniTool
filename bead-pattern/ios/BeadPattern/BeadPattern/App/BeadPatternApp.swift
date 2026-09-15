import SwiftUI

@main
struct BeadPatternApp: App {
    init() {
        // 3D 的 Metal 管线是**运行时编译着色器**，首次求值要几十~几百毫秒。
        // 在这里先到后台线程触发一次：别让这份开销落在第一次切 3D（或进编辑页）
        // 的那一帧上。`static let` 本身线程安全，后台先建好，前面用的时候直接拿。
        Task.detached(priority: .utility) {
            _ = Bead3DMetalSupport.shared
        }
    }

    var body: some Scene {
        WindowGroup {
            BeadRootView()
                // 整套配色是照 H5 的固定浅色设计做的：
                // 锁定浅色外观，避免深色模式下文字变白、与浅底撞在一起。
                .preferredColorScheme(.light)
                .tint(BeadTheme.accent)
        }
    }
}
