import SwiftUI

@main
struct Frame藏App: App {
    @State private var store = TicketStore()
    @State private var pro = ProStore()
    @State private var library = WorkLibrary()

    init() {
        H5Fonts.register()
        FrameTheme.applyAppearance()
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(store)
                .environment(pro)
                .environment(library)
                .preferredColorScheme(.dark)
                .task { await pro.start() }
        }
    }
}
