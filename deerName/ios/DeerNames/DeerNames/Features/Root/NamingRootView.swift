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
     * 旧语言（这正是之前的 bug）。id 放在里面：页面栈重建，而浮层那层（`RootSheets`）
     * 没被 id，`.sheet` 本身没动，弹层内容跟着这次 body 重算刷新。 */
    @AppStorage(L10n.storageKey) private var appLanguage = ""

    var body: some View {
        stack
            .tint(NamingTheme.primaryDeep)
            .environment(model)
            /* 所有根级浮层（设置 / 选姓·备选名·不喜欢的名字 / 分享卡片 / 小名释义 /
             * 选名·选姓详情 / 付费墙）都交给下面这个子视图去挂，**不挂在根 body 上**：
             * `.sheet` 的绑定要在 body 里求值，谁求值谁就会被这些状态反复重算，而根 body
             * 一重算，整棵页面栈（含正推着的选名页、那一千多行的列表）就跟着重建一遍 ——
             * 「点一行、列表抖一下」就是这么来的。状态挪进子视图后，开关浮层只重算它自己。
             * 详见 `RootSheets`。 */
            .background(RootSheets(model: model))
            .overlay(alignment: .bottom) {
                if let text = model.toastText {
                    NamingToastView(text: text)
                        .transition(.asymmetric(
                            insertion: .opacity.combined(with: .move(edge: .bottom)),
                            removal: .opacity
                        ))
                }
            }
            .animation(NamingMotion.appear, value: model.toastText)
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

/* 页面栈之后的一层空白视图，专门用来挂根级浮层：设置 / 选姓·备选名·不喜欢的名字 /
 * 分享卡片 / 小名释义 / 选名·选姓详情 / 付费墙。
 *
 * 为什么不让根视图自己挂：`.sheet` 的绑定要在 body 里求值，读一次就订阅一次 ——
 * 根 body 一旦因为「打开某张浮层」重算，`stack` 里那棵 `NavigationStack` 会连
 * 当前推着的页面一起重建，选名页那种一千多行的列表就会肉眼可见地抖一下。
 * 把这几份状态挪到这个小视图：开 / 关浮层只重算它自己，页面栈一动不动。
 *
 * 挂在这一层（`.background`）的浮层**只能是系统 sheet**：这一层画在页面栈背后，
 * 页面又都有不透明的 `namingPageBackground()` —— 页内 overlay 会被压在下面看不见。
 * sheet 是 UIKit 另开的弹层，挂哪儿都在最上面，所以「点一行看详情」也走 sheet。*/
private struct RootSheets: View {
    let model: NamingAppModel
    @Environment(ProStore.self) private var pro

    var body: some View {
        Color.clear
            .allowsHitTesting(false)
            .sheet(isPresented: Binding(get: { model.showSettings }, set: { model.showSettings = $0 })) {
                NavigationStack {
                    SettingsView()
                }
                .environment(model)
                .environment(pro)
            }
            .sheet(item: Binding(get: { model.sheet }, set: { model.sheet = $0 })) { kind in
                NameSheetHost(kind: kind)
                    .environment(model)
                    .environment(pro)
            }
            .sheet(isPresented: Binding(get: { model.cardImage != nil }, set: { if !$0 { model.cardImage = nil } })) {
                if let image = model.cardImage {
                    CardPreviewSheet(image: image)
                        .environment(model)
                        .environment(pro)
                }
            }
            .sheet(item: Binding(get: { model.nickDetail }, set: { model.nickDetail = $0 })) { item in
                NickExplanationSheet(item: item)
                    .environment(model)
                    .environment(pro)
            }
            /* 选名 / 选姓页「点一行看详情」的浮层：系统 sheet（见文件末尾 `NamePeekSheet`）。 */
            .sheet(item: Binding(get: { model.peek }, set: { model.peek = $0 })) { peek in
                NamePeekSheet(peek: peek)
                    .environment(model)
            }
            .sheet(isPresented: Binding(
                get: { pro.showPaywall },
                set: { pro.showPaywall = $0 }
            )) {
                ProSheet()
                    .environment(pro)
            }
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
            case .compare: NameCompareView()
            case .report: NameReportView()
            case .nick: NickView()
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

/* 「点一行看详情」浮层：**系统 sheet**，挂在根上（见 `RootSheets`）。
 *
 * 为什么不是页内 overlay：这层要盖在页面栈之上，而 `RootSheets` 整个在 `.background`
 * 里，overlay 会被不透明的页面背景压在下面（表现就是「点一行没反应」）。
 * 放在页内也会带着页面 body 一起重算。系统 sheet 是 UIKit 另开的弹层，两件事都躲开。
 * 代价是弹出时背后那层会按系统手势缩一下，但这是系统 sheet 的既定表现，可接受。
 *
 * 只有这一个视图读 `model.peek`：点一行时重算的也只有它，背后那张一千多行的列表
 * 连 body 都不会跑。标题 / 内容 / 「选这个」都按 `peek` 分派。 */
private struct NamePeekSheet: View {
    let peek: NamePeek

    @Environment(NamingAppModel.self) private var model

    var body: some View {
        NavigationStack {
            ScrollView {
                content.padding(20)
            }
            .safeAreaInset(edge: .bottom) {
                /* 「选这个」钉在底部，不跟内容滚：短内容在 medium 档也一眼能看到它。 */
                DockPrimaryButton(title: L10n.t("选这个"), action: pick)
                    .padding(.horizontal, 20)
                    .padding(.vertical, 10)
            }
            .namingPageBackground()
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(L10n.t("关闭")) { model.peek = nil }
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    /// 标题：英文名用完整写法（名 + 姓），姓氏就是姓氏本身。
    private var title: String {
        switch peek {
        case .enName(let it): return model.enFullName(it.n)
        case .enSurname(let s): return s.n
        case .zhSurname(let s): return s.c
        }
    }

    @ViewBuilder
    private var content: some View {
        switch peek {
        case .enName(let it): EnGivenPeekContent(it: it)
        case .enSurname(let s): EnSurnamePeekContent(s: s)
        case .zhSurname(let s): StudioSurnamePeekContent(s: s)
        }
    }

    /// 「选这个」＝选中 + 返回上一页（和行右端圆钮做的是同一件事）。
    private func pick() {
        switch peek {
        case .enName(let it):
            model.peek = nil
            model.pickEnGivenName(it)
        case .enSurname(let s):
            model.peek = nil
            model.pickEnSurname(s.n)
        case .zhSurname(let s):
            model.peek = nil
            model.pickStudioSurname(s)
        }
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
