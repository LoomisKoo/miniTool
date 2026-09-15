import SwiftUI

/// 「我的」tab：豆子库存 + 作品列表（同一列表一起滑）。
///
/// 点开作品会 push 独立编辑页，不碰「拼豆」tab 正在编辑的内容。
struct BeadMineView: View {
    /// 仅用来读当前色卡 id（库存入口）；不在这里 load 作品。
    let model: BeadEditorModel

    @State private var renameTarget: BeadProject?
    @State private var renameDraft = ""
    @State private var deleteTarget: BeadProject?

    private var store: ProjectStore { ProjectStore.shared }
    private var inventory: InventoryStore { InventoryStore.shared }
    private var paletteId: String { model.settings.paletteId }

    var body: some View {
        NavigationStack {
            List {
                inventorySection
                projectsSection
            }
            .listStyle(.insetGrouped)
            .listSectionSpacing(14)
            .navigationTitle("我的")
            .navigationBarTitleDisplayMode(.inline)
            .onAppear {
                store.loadIfNeeded()
                inventory.loadIfNeeded()
            }
            .alert("重命名", isPresented: renameBinding) {
                TextField("作品名", text: $renameDraft)
                Button("取消", role: .cancel) { renameTarget = nil }
                Button("保存") {
                    if let target = renameTarget {
                        store.rename(target, to: renameDraft)
                    }
                    renameTarget = nil
                }
            }
            .alert("删除作品？", isPresented: deleteBinding) {
                Button("取消", role: .cancel) { deleteTarget = nil }
                Button("删除", role: .destructive) {
                    if let target = deleteTarget { store.delete(target) }
                    deleteTarget = nil
                }
            } message: {
                Text(deleteTarget?.name ?? "")
            }
            .alert("提示", isPresented: storeMessageBinding) {
                Button("好") { store.message = nil }
            } message: {
                Text(store.message ?? "")
            }
            .alert("提示", isPresented: inventoryMessageBinding) {
                Button("好") { inventory.message = nil }
            } message: {
                Text(inventory.message ?? "")
            }
        }
    }

    // MARK: - 豆子库存

    private var inventorySection: some View {
        Section {
            NavigationLink {
                BeadInventoryView(paletteId: paletteId)
            } label: {
                VStack(alignment: .leading, spacing: 8) {
                    inventoryTitleRow
                    inventoryDotsRow
                }
                .padding(.vertical, 2)
            }
        } header: {
            Text("豆子库存")
        }
    }

    private var inventoryTitleRow: some View {
        let ownedCount = inventory.ownedCount(palette: paletteId)
        let total = inventory.total(palette: paletteId)
        return HStack(alignment: .firstTextBaseline, spacing: 6) {
            if ownedCount == 0 {
                Text("还没有登记豆子")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(BeadTheme.ink)
            } else {
                Text("已有 \(ownedCount) 个色号")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(BeadTheme.ink)
                Text("共 \(total) 颗")
                    .font(.system(size: 13))
                    .foregroundStyle(BeadTheme.muted)
                    .monospacedDigit()
            }
            Spacer(minLength: 0)
        }
        .lineLimit(1)
    }

    @ViewBuilder
    private var inventoryDotsRow: some View {
        let owned = inventory.owned(palette: paletteId)
        if owned.isEmpty {
            Text(model.palette.name)
                .font(.system(size: 12))
                .foregroundStyle(BeadTheme.muted)
        } else {
            InventoryColorDots(colors: owned.map(\.color))
        }
    }

    // MARK: - 作品列表

    private var projectsSection: some View {
        Section {
            if store.projects.isEmpty {
                Text("还没有保存的作品。在拼豆页点「保存」后会出现在这里。")
                    .font(.system(size: 13))
                    .foregroundStyle(BeadTheme.muted)
                    .listRowBackground(Color.clear)
            } else {
                ForEach(store.projects) { project in
                    NavigationLink {
                        BeadProjectEditorView(project: project)
                    } label: {
                        projectRow(project)
                    }
                    .swipeActions(edge: .trailing) {
                        Button(role: .destructive) {
                            deleteTarget = project
                        } label: {
                            Label("删除", systemImage: "trash")
                        }
                        Button {
                            store.duplicate(project)
                        } label: {
                            Label("复制", systemImage: "doc.on.doc")
                        }
                        .tint(BeadTheme.accent)
                        Button {
                            renameTarget = project
                            renameDraft = project.name
                        } label: {
                            Label("重命名", systemImage: "pencil")
                        }
                        .tint(.gray)
                    }
                }
            }
        } header: {
            Text("作品（\(store.count)）")
        }
    }

    /// 双行：封面 + 名称 / 尺寸·豆宽·限色。
    private func projectRow(_ project: BeadProject) -> some View {
        HStack(spacing: 12) {
            thumbnail(project)

            VStack(alignment: .leading, spacing: 4) {
                Text(project.name)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(BeadTheme.ink)
                    .lineLimit(1)
                Text(project.summary)
                    .font(.system(size: 12))
                    .foregroundStyle(BeadTheme.muted)
                    .lineLimit(1)
            }

            Spacer(minLength: 0)
        }
        .padding(.vertical, 2)
    }

    @ViewBuilder
    private func thumbnail(_ project: BeadProject) -> some View {
        if let image = store.thumbnail(for: project) {
            Image(uiImage: image)
                .resizable()
                .scaledToFill()
                .frame(width: 48, height: 48)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay {
                    RoundedRectangle(cornerRadius: 8)
                        .strokeBorder(.black.opacity(0.08), lineWidth: 1)
                }
        } else {
            RoundedRectangle(cornerRadius: 8)
                .fill(BeadTheme.fill)
                .frame(width: 48, height: 48)
                .overlay {
                    Image(systemName: "photo")
                        .font(.system(size: 15))
                        .foregroundStyle(BeadTheme.muted)
                }
        }
    }

    // MARK: - 绑定

    private var renameBinding: Binding<Bool> {
        Binding(
            get: { renameTarget != nil },
            set: { if !$0 { renameTarget = nil } }
        )
    }

    private var deleteBinding: Binding<Bool> {
        Binding(
            get: { deleteTarget != nil },
            set: { if !$0 { deleteTarget = nil } }
        )
    }

    private var storeMessageBinding: Binding<Bool> {
        Binding(
            get: { store.message != nil },
            set: { if !$0 { store.message = nil } }
        )
    }

    private var inventoryMessageBinding: Binding<Bool> {
        Binding(
            get: { inventory.message != nil },
            set: { if !$0 { inventory.message = nil } }
        )
    }
}

/// 从作品库打开的独立编辑页：自有一份模型，不覆盖拼豆 tab。
struct BeadProjectEditorView: View {
    let project: BeadProject

    @State private var model: BeadEditorModel
    @Environment(\.dismiss) private var dismiss

    init(project: BeadProject) {
        self.project = project
        // 进页前就开始 load，避免先闪「选择图片」。
        let editor = BeadEditorModel()
        editor.load(project: project)
        _model = State(initialValue: editor)
    }

    var body: some View {
        BeadEditorView(model: model, onOpenMine: { dismiss() }, embedded: true)
            .navigationTitle(model.projectName)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar(.hidden, for: .tabBar)
            .onDisappear { model.flushPendingSave() }
    }
}

/// 库存入口第二行：按可用宽度铺开小色点，互不重叠，铺到箭头前为止。
private struct InventoryColorDots: View {
    let colors: [PaletteColor]

    private let side: CGFloat = 12
    private let spacing: CGFloat = 4

    var body: some View {
        GeometryReader { geo in
            let capacity = max(0, Int((geo.size.width + spacing) / (side + spacing)))
            let shown = Array(colors.prefix(capacity))
            HStack(spacing: spacing) {
                ForEach(shown) { color in
                    RoundedRectangle(cornerRadius: 3)
                        .fill(color.rgb.swiftUIColor)
                        .frame(width: side, height: side)
                        .overlay {
                            RoundedRectangle(cornerRadius: 3)
                                .strokeBorder(.black.opacity(0.08), lineWidth: 0.5)
                        }
                }
                Spacer(minLength: 0)
            }
        }
        .frame(height: side)
    }
}
