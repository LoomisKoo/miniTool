import SwiftUI

enum RootTab: Hashable {
    case templates, create, mine
}

@Observable
@MainActor
final class RootRouter {
    var tab: RootTab = .templates
}

enum RootRoute: Hashable {
    case settings
    case work(UUID)
}

struct RootView: View {
    @Environment(WorkLibrary.self) private var library
    @Environment(RootRouter.self) private var router

    var body: some View {
        @Bindable var router = router
        TabView(selection: $router.tab) {
            NavigationStack {
                TemplateShelfView()
            }
            .tabItem { Label("模板", systemImage: "rectangle.stack") }
            .tag(RootTab.templates)

            NavigationStack {
                EditorView()
                    .toolbar(.hidden, for: .navigationBar)
            }
            .tabItem { Label("制作", systemImage: "plus.circle.fill") }
            .tag(RootTab.create)

            NavigationStack {
                MineView()
                    .navigationDestination(for: RootRoute.self) { route in
                        switch route {
                        case .settings:
                            SettingsView()
                        case .work(let id):
                            if let work = library.item(id) {
                                WorkDetailView(work: work)
                            }
                        }
                    }
            }
            .tabItem { Label("我的", systemImage: "person") }
            .tag(RootTab.mine)
        }
        .tint(FrameTheme.accent)
    }
}

/// 作品详情：复用首页编辑器，使用独立的编辑状态，不影响首页草稿
struct WorkDetailView: View {
    @Environment(WorkLibrary.self) private var library
    @State private var store: TicketStore
    private let fallbackTitle: String

    init(work: SavedTicket) {
        _store = State(initialValue: TicketStore(work: work))
        fallbackTitle = work.title
    }

    var body: some View {
        EditorView(isDetail: true)
            .environment(store)
            .navigationTitle(library.item(store.editingID)?.title ?? fallbackTitle)
            .navigationBarTitleDisplayMode(.inline)
    }
}
