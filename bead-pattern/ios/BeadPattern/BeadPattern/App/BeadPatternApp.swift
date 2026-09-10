import SwiftUI

@main
struct BeadPatternApp: App {
    var body: some Scene {
        WindowGroup {
            BeadEditorView()
                // 整套配色是照 H5 的固定浅色设计做的：
                // 锁定浅色外观，避免深色模式下文字变白、与浅底撞在一起。
                .preferredColorScheme(.light)
                .tint(BeadTheme.accent)
        }
    }
}
