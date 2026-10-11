import SwiftUI

struct SettingsView: View {
    @Environment(ProStore.self) private var pro
    @Environment(\.dismiss) private var dismiss
    @State private var showPro = false

    var body: some View {
        NavigationStack {
            List {
                Section {
                    if pro.isPro {
                        Label("已开通 Pro", systemImage: "checkmark.seal.fill")
                            .foregroundStyle(PandaTheme.accentDeep)
                    } else {
                        Button("开通 Pro") { showPro = true }
                    }
                    Button("恢复购买") {
                        Task { await pro.restore() }
                    }
                }
                Section("关于") {
                    LabeledContent("版本", value: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0")
                    LabeledContent("应用", value: "熊猫拼图 · Panda Puzzle")
                }
            }
            .navigationTitle("设置")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("完成") { dismiss() }
                }
            }
            .sheet(isPresented: $showPro) { ProSheet() }
            .sheet(isPresented: Binding(
                get: { pro.showPaywall },
                set: { pro.showPaywall = $0 }
            )) {
                ProSheet()
            }
        }
    }
}
