import SwiftUI

/* 根视图 —— 对应 H5 的 tabbar + 页面栈。
 *
 * NavigationStack 罩在 TabView **外面**：压栈的页面是「盖在 tabbar 上面的一层」，
 * 所以子页看不到底部 tab，符合 H5 的表现。浮层（选姓 / 备选名 / 不喜欢的名字）
 * 和分享卡片走原生 sheet。 */

struct NamingRootView: View {
    let model: NamingAppModel

    /* 语言：`L10n` 直接读 UserDefaults，SwiftUI 不知道它变了，得靠重建。
     *
     * 重建的**位置**很关键：`id` 只加在 NavigationStack 上，不加在整个视图上。
     * 因为 sheet / overlay 这些弹层是 UIKit 另外持有的宿主树 —— 如果连挂着
     * `.sheet` 的那层都被 id 掉，弹层就成了一份没人管的旧快照，设置页会一直停在
     * 旧语言（这正是之前的 bug）。id 放在里面：页面栈重建，而 `.sheet` 本身没动，
     * 弹层内容跟着这次 body 重算刷新。 */
    @AppStorage(L10n.storageKey) private var appLanguage = ""

    var body: some View {
        stack
            .tint(NamingTheme.primaryDeep)
            .environment(model)
            .sheet(isPresented: Binding(get: { model.showSettings }, set: { model.showSettings = $0 })) {
                NavigationStack {
                    SettingsView()
                }
                .environment(model)
            }
            .sheet(item: Binding(get: { model.sheet }, set: { model.sheet = $0 })) { kind in
                NameSheetHost(kind: kind)
                    .environment(model)
            }
            .sheet(isPresented: Binding(get: { model.cardImage != nil }, set: { if !$0 { model.cardImage = nil } })) {
                if let image = model.cardImage {
                    CardPreviewSheet(image: image)
                        .environment(model)
                }
            }
            .overlay(alignment: .bottom) {
                if let text = model.toastText {
                    NamingToastView(text: text)
                        .transition(.opacity.combined(with: .move(edge: .bottom)))
                }
            }
            .animation(.easeInOut(duration: 0.18), value: model.toastText)
    }

    /// 页面栈本体 —— 换语言时整块重建（`path` 绑在 model 上，所以还停在原来那一页）。
    private var stack: some View {
        NavigationStack(path: Binding(get: { model.path }, set: { model.path = $0 })) {
            TabView(selection: Binding(get: { model.tab }, set: { model.tab = $0 })) {
                HomeView()
                    .tag(NamingTab.home)
                    .tabItem { Label(L10n.t("首页"), systemImage: "house") }

                MineView()
                    .tag(NamingTab.mine)
                    .tabItem { Label(L10n.t("我的"), systemImage: "person") }
            }
            .navigationTitle(rootTitle)
            .navigationBarTitleDisplayMode(.inline)
            // 齿轮挂在 TabView 这一层（和 navigationTitle 同级）。放在 tab 子视图
            // 里的话，反向嵌套（NavigationStack 罩 TabView）时子视图的 toolbar
            // 不会被导航栏采用，按钮就显示不出来。
            .toolbar {
                if model.tab == .mine && model.path.isEmpty {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button {
                            model.showSettings = true
                        } label: {
                            Image(systemName: "gearshape")
                        }
                        .accessibilityLabel(L10n.t("设置"))
                    }
                }
            }
            .navigationDestination(for: NamingScreen.self) { ScreenHost(screen: $0) }
        }
        .id(appLanguage)
    }

    /// 一级页的标题跟着 tab 走（子页由各自视图的 navigationTitle 覆盖）。
    private var rootTitle: String {
        model.tab == .mine ? L10n.t("我的") : L10n.t("仙鹿起名")
    }
}

struct ScreenHost: View {
    let screen: NamingScreen

    var body: some View {
        Group {
            switch screen {
            case .zh: ZhNameView()
            case .quiz: QuizView()
            case .bazi: BaziView()
            case .result: ResultView()
            case .resultAll: AllRecsView()
            case .detail: DetailView()
            case .translit: TranslitView()
            case .studio: StudioView()
            case .studioSur: StudioSurnameView()
            case .studioChar: StudioCharView()
            case .en: EnView()
            case .enRec: EnRecView()
            case .enSound: EnSoundView()
            case .enStudio: EnStudioView()
            case .enDetail: EnDetailView()
            case .enSur: EnSurnameView()
            case .enGiven: EnGivenView()
            case .home, .mine: EmptyView()
            }
        }
    }
}

struct NameSheetHost: View {
    let kind: NamingSheetKind

    var body: some View {
        NavigationStack {
            Group {
                switch kind {
                case .surname: SurnameSheet()
                case .pool: PoolSheet()
                case .banNames: BanNamesSheet()
                }
            }
            .navigationTitle(kind.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    SheetCloseButton()
                }
            }
        }
    }
}

struct SheetCloseButton: View {
    @Environment(NamingAppModel.self) private var model
    var body: some View {
        Button(L10n.t("关闭")) { model.sheet = nil }
    }
}

struct CardPreviewSheet: View {
    let image: UIImage
    @Environment(NamingAppModel.self) private var model

    var body: some View {
        NavigationStack {
            ScrollView {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFit()
                    .clipShape(RoundedRectangle(cornerRadius: NamingRadius.large, style: .continuous))
                    .shadow(color: .black.opacity(0.15), radius: 12, y: 6)
                    .padding(20)
            }
            .background(NamingTheme.background.ignoresSafeArea())
            .navigationTitle(L10n.t("分享卡片"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(L10n.t("关闭")) { model.cardImage = nil }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(L10n.t("存到相册")) { save() }
                }
            }
        }
    }

    private func save() {
        UIImageWriteToSavedPhotosAlbum(image, nil, nil, nil)
        model.cardImage = nil
        model.toast(L10n.t("已保存到相册"))
    }
}
