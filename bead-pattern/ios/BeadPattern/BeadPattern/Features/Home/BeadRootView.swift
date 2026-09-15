import SwiftUI

/// 主页：两个 tab。
///
/// - 「拼豆」＝生成图纸（`BeadEditorView`，共用一份编辑模型）
/// - 「我的」＝豆子库存 + 作品列表；点开作品走独立编辑页，不覆盖拼豆 tab
struct BeadRootView: View {
    private enum Tab: Hashable {
        case pattern
        case mine
    }

    @State private var model = BeadEditorModel()
    @State private var tab: Tab = .pattern

    var body: some View {
        TabView(selection: $tab) {
            BeadEditorView(model: model) {
                tab = .mine
            }
            .tabItem { Label("拼豆", systemImage: "square.grid.3x3.fill") }
            .tag(Tab.pattern)

            BeadMineView(model: model)
                .tabItem { Label("我的", systemImage: "person.crop.circle") }
                .tag(Tab.mine)
        }
        .task {
            ProjectStore.shared.loadIfNeeded()
            InventoryStore.shared.loadIfNeeded()
        }
    }
}

#Preview {
    BeadRootView()
        .preferredColorScheme(.light)
}
