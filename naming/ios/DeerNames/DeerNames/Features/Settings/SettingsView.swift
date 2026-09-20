import SwiftUI

struct SettingsView: View {
    /* 读一次语言只是为了**订阅**它：设置这几页在 sheet 里，换语言时要跟着重画
     * （`L10n.t` 是普通函数，SwiftUI 不知道它依赖语言）。不能在这儿 `.id(appLanguage)`：
     * 这一页是 sheet 内 NavigationStack 的根，把自己 id 掉会把子页弹回去。 */
    @AppStorage(L10n.storageKey) private var appLanguage = ""

    @Environment(NamingAppModel.self) private var model

    var body: some View {
        List {
            Section {
                NavigationLink {
                    LanguageSettingsView()
                } label: {
                    Label(L10n.t("语言"), systemImage: "globe")
                }
                NavigationLink {
                    AboutView()
                } label: {
                    Label(L10n.t("关于仙鹿起名"), systemImage: "info.circle")
                }
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(NamingTheme.background.ignoresSafeArea())
        .navigationTitle(L10n.t("设置"))
        .navigationBarTitleDisplayMode(.inline)
        /* 关闭按钮放在这里而不是根视图的 sheet 闭包里：那个闭包不会跟着语言重建，
         * 按钮上就会一直留着旧语言的「关闭」。 */
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button(L10n.t("关闭")) { model.showSettings = false }
            }
        }
    }
}
