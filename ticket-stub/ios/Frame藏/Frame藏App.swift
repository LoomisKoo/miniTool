import SwiftUI

@main
struct Frame藏App: App {
    @State private var store = TicketStore()
    @State private var pro = ProStore()
    @State private var library = WorkLibrary()
    @State private var templates = TemplateLibrary()
    @State private var thumbs = TemplateThumbCache()
    @State private var router = RootRouter()
    @AppStorage("appLanguage") private var appLanguage = "system"

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
                .environment(templates)
                .environment(thumbs)
                .environment(router)
                .environment(\.locale, resolvedLocale)
                .preferredColorScheme(.dark)
                .task {
                    if let draft = library.draft, store.editingID == nil {
                        store.load(draft)
                        store.editingID = nil
                    }
                    await pro.start()
                }
        }
    }

    private var resolvedLocale: Locale {
        switch appLanguage {
        case "zh-Hans":
            Locale(identifier: "zh-Hans")
        case "en":
            Locale(identifier: "en")
        default:
            Locale.current
        }
    }
}
