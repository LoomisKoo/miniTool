import SwiftUI

struct SavesListView: View {
    @Environment(ProStore.self) private var pro
    @Environment(PuzzleSaveStore.self) private var saves
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Text("免费 \(PuzzleLimits.freeMaxSaves) 条 · Pro \(PuzzleLimits.proMaxSaves) 条进行中存档")
                        .font(.system(size: 13))
                        .foregroundStyle(PandaTheme.muted)
                }
                if saves.items.isEmpty {
                    ContentUnavailableView("暂无存档", systemImage: "tray", description: Text("在拼图内自动保存后，会显示在这里。"))
                } else {
                    ForEach(saves.items) { item in
                        Button {
                            saves.requestedSaveID = item.id
                        } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(item.title)
                                    .font(.system(size: 16, weight: .semibold))
                                Text("\(item.progress) · \(item.updatedAt.formatted(date: .abbreviated, time: .shortened))")
                                    .font(.system(size: 13))
                                    .foregroundStyle(PandaTheme.muted)
                            }
                        }
                        .buttonStyle(.plain)
                    }
                    .onDelete { indexSet in
                        for i in indexSet {
                            saves.delete(id: saves.items[i].id)
                        }
                    }
                }
                if !saves.canCreateNew(isPro: pro.isPro) {
                    Button {
                        _ = pro.require(.moreSaves)
                    } label: {
                        Label("升级 Pro 以保留更多进度", systemImage: "lock.fill")
                    }
                }
            }
            .navigationTitle("拼图存档")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("完成") { dismiss() }
                }
            }
            .onAppear { saves.reload() }
        }
    }
}
