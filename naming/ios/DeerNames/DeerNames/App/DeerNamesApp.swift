import SwiftUI

@main
struct DeerNamesApp: App {
    @AppStorage(L10n.storageKey) private var appLanguage = ""

    /// 模型放在 App 层：切语言时下面整棵树会按 id 重建，模型不能跟着重置。
    @State private var model = NamingAppModel()

    var body: some Scene {
        WindowGroup {
            NamingRootView(model: model)
                /* 文案统一走 `L10n`（读 UserDefaults 里的语言），SwiftUI 不知道它变了。
                 * 换语言的重建在 `NamingRootView` 里做（只重建页面栈，不动弹层，
                 * 否则设置页这类 sheet 会停在旧语言）；这里只同步一下 locale。 */
                .environment(\.locale, appLanguage.isEmpty
                             ? Locale.autoupdatingCurrent
                             : Locale(identifier: appLanguage))
        }
    }
}
