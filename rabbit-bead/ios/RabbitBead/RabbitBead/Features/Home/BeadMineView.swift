import Foundation
import SwiftUI

/// 「我的」tab：豆子库存 + 作品列表（同一列表一起滑）。
///
/// 子页全用 `NavigationLink(value:)` 推出去（不用 `path.append`），目的地注册在
/// `BeadRootView` 的 `navigationDestination(for: BeadRoute.self)`。
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
        List {
            proSection
            inventorySection
            projectsSection
        }
        .listStyle(.insetGrouped)
        .listSectionSpacing(14)
        .scrollContentBackground(.hidden)
        .background {
            BeadTheme.parchmentGradient.ignoresSafeArea()
        }
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

    // MARK: - Pro

    private var entitlements: EntitlementStore { EntitlementStore.shared }

    private var proSection: some View {
        Section {
            if entitlements.isPro {
                Label("已解锁 Pro", systemImage: "checkmark.seal.fill")
                    .beadBody()
                    .foregroundStyle(BeadTheme.primary)
            } else {
                Button {
                    entitlements.requestPaywall()
                } label: {
                    proCard
                }
                .buttonStyle(BeadPressStyle(pressedScale: 0.98))
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)
                // insetGrouped section 会裁切贴边内容；留出空隙，描边/阴影才不被切掉
                .listRowInsets(EdgeInsets(top: 4, leading: 4, bottom: 4, trailing: 4))
            }
        } header: {
            BeadSectionLabel(text: "会员".loc)
        }
    }

    /// Pro 入口：整卡可点，不再叠一颗 CTA 按钮。
    private var proCard: some View {
        BeadProTile {
            HStack(alignment: .center, spacing: BeadSpace.sm) {
                VStack(alignment: .leading, spacing: BeadSpace.xxs) {
                    Text("解锁 Pro")
                        .beadDisplayMd()
                        .foregroundStyle(BeadTheme.ink)
                    Text("豆库限色 · 高清导出 · 去背景 · 无限作品")
                        .beadCaption()
                        .foregroundStyle(BeadTheme.inkMuted80)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: BeadSpace.sm)
                // 有价才显示；国际区价格由 ASC 给，不写死。
                if let price = entitlements.product?.displayPrice {
                    Text(price)
                        .beadBodyStrong()
                        .foregroundStyle(BeadTheme.primaryDeep)
                }
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(BeadTheme.primary.opacity(0.45))
            }
        }
    }

    // MARK: - 豆子库存

    private var inventorySection: some View {
        Section {
            // 不用 Button + `path.append`：`NavigationLink(value:)` 才带系统行样式
            // （点按高亮、disclosure 箭头、无障碍），也不需要自己补 chevron。
            NavigationLink(value: BeadRoute.inventory(paletteId: paletteId)) {
                VStack(alignment: .leading, spacing: 8) {
                    inventoryTitleRow
                    inventoryDotsRow
                }
                .padding(.vertical, 2)
            }
        } header: {
            BeadSectionLabel(text: "豆子库存".loc)
        }
    }

    private var inventoryTitleRow: some View {
        let ownedCount = inventory.ownedCount(palette: paletteId)
        let total = inventory.total(palette: paletteId)
        return HStack(alignment: .firstTextBaseline, spacing: 6) {
            if ownedCount == 0 {
                Text("还没有登记豆子")
                    .beadRowTitle()
                    .foregroundStyle(BeadTheme.ink)
            } else {
                Text("已有 %ld 个色号".loc(ownedCount))
                    .beadRowTitle()
                    .foregroundStyle(BeadTheme.ink)
                Text("共 %ld 颗".loc(total))
                    .beadDigits(13, weight: .regular)
                    .foregroundStyle(BeadTheme.inkMuted48)
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
                .beadFinePrint()
                .foregroundStyle(BeadTheme.inkMuted48)
        } else {
            InventoryColorDots(colors: owned.map(\.color))
        }
    }

    // MARK: - 作品列表

    private var projectsSection: some View {
        Section {
            if store.projects.isEmpty {
                Text("还没有保存的作品。在拼豆页点「保存」后会出现在这里。")
                    .beadFinePrint()
                    .foregroundStyle(BeadTheme.inkMuted48)
                    .listRowBackground(Color.clear)
            } else {
                ForEach(store.projects) { project in
                    NavigationLink(value: BeadRoute.project(project)) {
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
                        .tint(BeadTheme.primary)
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
            BeadSectionLabel(
                text: "作品（%@）".loc("\(store.count)\(EntitlementStore.shared.isPro ? "" : "/\(ProjectStore.freeLimit)")")
            )
        }
    }

    /// 双行：封面 + 名称 / 尺寸·豆宽·限色。
    private func projectRow(_ project: BeadProject) -> some View {
        HStack(spacing: BeadSpace.sm) {
            thumbnail(project)

            VStack(alignment: .leading, spacing: BeadSpace.xxs) {
                Text(project.name)
                    .beadRowTitle()
                    .foregroundStyle(BeadTheme.ink)
                    .lineLimit(1)
                Text(project.summary)
                    .beadFinePrint()
                    .foregroundStyle(BeadTheme.inkMuted48)
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
                .clipShape(RoundedRectangle(cornerRadius: BeadRadius.sm, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: BeadRadius.sm, style: .continuous)
                        .strokeBorder(BeadTheme.hairline, lineWidth: 1)
                }
        } else {
            RoundedRectangle(cornerRadius: BeadRadius.sm, style: .continuous)
                .fill(BeadTheme.subtleFill)
                .frame(width: 48, height: 48)
                .overlay {
                    Image(systemName: "photo")
                        .font(.system(size: 15))
                        .foregroundStyle(BeadTheme.inkMuted48)
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

    @State private var model = BeadEditorModel()
    @State private var didLoad = false

    var body: some View {
        BeadEditorView(model: model, embedded: true)
            .navigationTitle(model.projectName)
            .navigationBarTitleDisplayMode(.inline)
            .task {
                guard !didLoad else { return }
                didLoad = true
                model.load(project: project)
            }
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
                                .strokeBorder(BeadTheme.swatchStrokeSoft, lineWidth: 0.5)
                        }
                }
                Spacer(minLength: 0)
            }
        }
        .frame(height: side)
    }
}
