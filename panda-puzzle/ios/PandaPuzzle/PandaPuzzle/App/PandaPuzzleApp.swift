import SwiftUI

@main
struct PandaPuzzleApp: App {
    @State private var pro = ProStore()
    @State private var saves = PuzzleSaveStore()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(pro)
                .environment(saves)
                .task { await pro.start() }
        }
    }
}
