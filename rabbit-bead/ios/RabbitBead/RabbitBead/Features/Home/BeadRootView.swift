import SwiftUI
import UIKit

/// 从主页推出去的子页。
///
/// 两个 tab 各有一条栈（见 `BeadRootView`），但共用这一个枚举；`handEdit` 从「拼豆」进，
/// 其余从「我的」进。
enum BeadRoute: Hashable {
    case inventory(paletteId: String)
    case project(BeadProject)
    case about
    /// 手绘编辑页（`BeadEditView`）。
    case handEdit
    /// 裁切图片页（从「拼豆」页 push）。
    case crop
    /// 内嵌网页（关于页的隐私政策 / 支持与反馈）。
    case web(BeadWebPage)
}

/// 主页：**每个 tab 各有一条自己的导航栈**。
///
/// 为什么不共用一条（`TabView` 外面包一条）：
/// 系统栏是挂在栈上的，栈只有一条 → 栏也只有一条，两个 tab 只能条件显隐；而栏的占位
/// 算在 `TabView` 的 frame 上，切 tab 时栏一出现/消失，`TabView` 高度就变，另一个 tab
/// 已经建好的视图跟着重排（「拼豆」的图案区缩一下）。
///
/// 分开之后各归各的：
/// - 「我的」栈根不收起栏 → 拿到**真系统栏**，标题、返回键、右上角关于入口都由系统渲染
///   （和 `BeadWebPageView` 右上角那个 safari 按钮同一套外观，iOS 26 上是液态玻璃）；
/// - 「拼豆」栈根显式 `toolbar(.hidden)` → 预览吃满整屏高度，不受另一条栈影响。
///
/// push 仍在各自 tab 内。手绘编辑页**不再**藏 tab：进出若藏/露 tab，生成页预览
/// 高度会跟着变，退栈时会跳一下。
struct BeadRootView: View {
    private enum Tab: Hashable {
        case pattern
        case mine
    }

    @State private var model = BeadEditorModel()
    @State private var tab: Tab = .pattern
    /// 统一导航路径：详情页 push 后覆盖整个 TabView。
    @State private var navigationPath: [BeadRoute] = []

    var body: some View {
        NavigationStack(path: $navigationPath) {
            TabView(selection: $tab) {
                patternTab
                    .tabItem { Label("拼豆", systemImage: "square.grid.3x3.fill") }
                    .tag(Tab.pattern)

                mineTab
                    .tabItem { Label("我的", systemImage: "person.crop.circle") }
                    .tag(Tab.mine)
            }
            .onChange(of: navigationPath) { _, path in
                model.setEditing(path.last == .handEdit)
            }
            .sheet(isPresented: paywallBinding) {
                BeadPaywallView()
            }
        }
        .beadDestinations(model: model)
        .task {
            ProjectStore.shared.loadIfNeeded()
            ProjectStore.shared.preloadThumbnails()
            InventoryStore.shared.loadIfNeeded()
            model.restoreDraftIfNeeded()
        }
    }

    private var entitlements: EntitlementStore { EntitlementStore.shared }

    private var paywallBinding: Binding<Bool> {
        Binding(
            get: { entitlements.showPaywall },
            set: { entitlements.showPaywall = $0 }
        )
    }

    /// 「拼豆」：根页收起导航栏（预览要满高）。
    private var patternTab: some View {
        BeadEditorView(model: model) {
            tab = .mine
        }
        .toolbar(.hidden, for: .navigationBar)
        .background(BeadMinimalBackButtonTitle())
    }

    /// 「我的」：栏交给系统（标题 + 右上角关于入口）。
    private var mineTab: some View {
        BeadMineView(model: model)
            .navigationTitle("我的".loc)
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarBackground(BeadTheme.parchment.opacity(0.8), for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    NavigationLink {
                        BeadAboutView()
                    } label: {
                        Image(systemName: "info")
                            .font(.system(size: 12, weight: .regular))
                    }
                    .accessibilityLabel("关于".loc)
                }
            }
            .background(BeadMinimalBackButtonTitle())
    }
}

extension View {
    /// 给一条栈注册全部目的地。
    ///
    /// `BeadRoute` 的用例分属不同 tab（手绘编辑从「拼豆」进，库存 / 作品 / 关于 / 内嵌
    /// 网页从「我的」进），但这里是编译期的 `switch`、不产生开销，两条栈挂同一份就行 ——
    /// 省掉「哪条栈漏注册、真机点了没反应」这类只有跑起来才会撞见的坑。
    func beadDestinations(model: BeadEditorModel) -> some View {
        navigationDestination(for: BeadRoute.self) { route in
            switch route {
            case .inventory(let paletteId):
                BeadInventoryView(paletteId: paletteId)
            case .project(let project):
                BeadProjectEditorView(project: project)
            case .about:
                BeadAboutView()
            case .handEdit:
                BeadEditView(model: model)
            case .crop:
                if let original = model.originalSourceImage {
                    BeadCropView(
                        sourceImage: UIImage(cgImage: original),
                        existingCrop: model.cropRect
                    ) { output in
                        model.applyCrop(output)
                    }
                }
            case .web(let page):
                BeadWebPageView(page: page)
            }
        }
    }
}

/// 挂在导航栈的根上：push 出去的系统返回键只显示 chevron，不带上一页标题。
private struct BeadMinimalBackButtonTitle: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> UIViewController {
        Controller()
    }

    func updateUIViewController(_ uiViewController: UIViewController, context: Context) {
        (uiViewController as? Controller)?.apply()
    }

    private final class Controller: UIViewController {
        override func viewDidLoad() {
            super.viewDidLoad()
            view.isUserInteractionEnabled = false
            view.backgroundColor = .clear
        }

        override func viewWillAppear(_ animated: Bool) {
            super.viewWillAppear(animated)
            apply()
        }

        func apply() {
            var current: UIViewController? = self
            while let vc = current {
                if vc.navigationController != nil {
                    vc.navigationItem.backButtonDisplayMode = .minimal
                }
                current = vc.parent
            }
        }
    }
}

#Preview {
    BeadRootView()
        .preferredColorScheme(.light)
}
