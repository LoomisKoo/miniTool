import SwiftUI

struct RootView: View {
    @Environment(ProStore.self) private var pro
    @Environment(PuzzleSaveStore.self) private var saves
    @State private var tab = 0

    var body: some View {
        TabView(selection: $tab) {
            PuzzleGameView()
                .tabItem { Label("拼图", systemImage: "puzzlepiece.extension") }
                .tag(0)

            MineView()
                .tabItem { Label("我的", systemImage: "person.crop.circle") }
                .tag(1)
        }
        .tint(PandaTheme.accent)
        .preferredColorScheme(.dark)
        .sheet(isPresented: Binding(
            get: { pro.showPaywall },
            set: { pro.showPaywall = $0 }
        )) {
            ProSheet()
        }
        .fullScreenCover(
            isPresented: Binding(
                get: { saves.requestedSaveID != nil },
                set: { if !$0 { saves.requestedSaveID = nil } }
            )
        ) {
            if let id = saves.requestedSaveID {
                NavigationStack {
                    PuzzleGameView(savedID: id)
                        .toolbar {
                            ToolbarItem(placement: .topBarLeading) {
                                Button("完成") {
                                    saves.requestedSaveID = nil
                                }
                            }
                        }
                }
            }
        }
    }
}
