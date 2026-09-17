import SwiftUI
import UIKit

/// 从「我的」推出去的全屏子页。
enum BeadRoute: Hashable {
    case inventory(paletteId: String)
    case project(BeadProject)
    case about
}

/// 主页：两个 tab。
///
/// - 「拼豆」＝生成图纸（无导航栏，避免切 tab 时 safe area 变化把预览挤缩小）
/// - 「我的」＝豆子库存 + 作品列表；自带 NavigationStack，push 不波及拼豆页布局
struct BeadRootView: View {
    private enum Tab: Hashable {
        case pattern
        case mine
    }

    @State private var model = BeadEditorModel()
    @State private var tab: Tab = .pattern
    @State private var path = NavigationPath()

    var body: some View {
        TabView(selection: $tab) {
            BeadEditorView(model: model) {
                tab = .mine
            }
            .tabItem { Label("拼豆", systemImage: "square.grid.3x3.fill") }
            .tag(Tab.pattern)

            NavigationStack(path: $path) {
                BeadMineView(model: model, path: $path)
                    .navigationTitle("我的")
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbarBackground(.visible, for: .navigationBar)
                    .toolbarBackground(BeadTheme.parchment.opacity(0.8), for: .navigationBar)
                    // 子页系统返回只显示 chevron，不带「我的」。
                    .background(BeadMinimalBackButtonTitle())
                    .navigationDestination(for: BeadRoute.self) { route in
                        switch route {
                        case .inventory(let paletteId):
                            BeadInventoryView(paletteId: paletteId)
                        case .project(let project):
                            BeadProjectEditorView(project: project)
                        case .about:
                            BeadAboutView()
                        }
                    }
            }
            .tabItem { Label("我的", systemImage: "person.crop.circle") }
            .tag(Tab.mine)
        }
        .task {
            ProjectStore.shared.loadIfNeeded()
            InventoryStore.shared.loadIfNeeded()
        }
    }
}

/// 挂在导航栈父页上：push 出去的系统返回键只显示 chevron，不带上一页标题。
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
