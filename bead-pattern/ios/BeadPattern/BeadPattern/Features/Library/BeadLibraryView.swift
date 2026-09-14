import SwiftUI

/// 作品库。列出所有已保存的作品，并可保存 / 打开 / 重命名 / 删除。
///
/// 直接读 `ProjectStore.shared`：它是 `@Observable`，列表会随保存与删除自动刷新。
struct BeadLibraryView: View {
    /// 当前编辑中作品的 id，用于标「编辑中」。
    let currentId: UUID?
    /// 当前有没有可保存的图纸。
    let canSaveCurrent: Bool
    let currentName: String
    let onSaveCurrent: (_ name: String) -> Void
    let onOpen: (BeadProject) -> Void

    @Environment(\.dismiss) private var dismiss

    private var store: ProjectStore { ProjectStore.shared }

    @State private var nameDraft = ""
    @State private var renameTarget: BeadProject?
    @State private var renameDraft = ""

    var body: some View {
        NavigationStack {
            List {
                if canSaveCurrent {
                    saveSection
                }
                projectsSection
            }
            .listStyle(.insetGrouped)
            .navigationTitle("作品库")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("完成") { dismiss() }
                }
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
        }
        .alert("提示", isPresented: storeMessageBinding) {
            Button("好") { store.message = nil }
        } message: {
            Text(store.message ?? "")
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .onAppear {
            nameDraft = currentName
            store.loadIfNeeded()
        }
    }

    // MARK: - 当前作品

    @ViewBuilder
    private var saveSection: some View {
        Section {
            TextField("作品名", text: $nameDraft)
                .font(.system(size: 15))

            Button {
                onSaveCurrent(nameDraft)
            } label: {
                HStack {
                    Text(currentId == nil ? "保存到作品库" : "更新当前作品")
                        .font(.system(size: 15, weight: .semibold))
                    Spacer()
                    if !store.canCreate, currentId == nil {
                        Text("已达上限")
                            .font(.system(size: 13))
                            .foregroundStyle(BeadTheme.muted)
                    }
                }
            }
            .disabled(!store.canCreate && currentId == nil)
            .opacity(!store.canCreate && currentId == nil ? 0.45 : 1)
        } header: {
            Text("当前")
        } footer: {
            footerText
        }
    }

    @ViewBuilder
    private var footerText: some View {
        if store.count >= ProjectStore.freeLimit {
            Text("免费版最多保存 \(ProjectStore.freeLimit) 个作品。升级 Pro 可无限保存，还能解锁全部色卡与高清导出。")
        } else {
            Text("已保存 \(store.count)/\(ProjectStore.freeLimit) 个；手绘改动会一起保存。")
        }
    }

    // MARK: - 作品列表

    @ViewBuilder
    private var projectsSection: some View {
        Section {
            if store.projects.isEmpty {
                Text("还没有保存过作品。生成图纸后点「保存到作品库」，随时可以回来接着改。")
                    .font(.system(size: 13))
                    .foregroundStyle(BeadTheme.muted)
            } else {
                ForEach(store.projects) { project in
                    Button {
                        onOpen(project)
                    } label: {
                        row(project)
                    }
                    .buttonStyle(.plain)
                    .swipeActions(edge: .trailing) {
                        Button(role: .destructive) {
                            store.delete(project)
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
            Text("全部作品")
        }
    }

    private func row(_ project: BeadProject) -> some View {
        HStack(spacing: 12) {
            thumbnail(project)

            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text(project.name)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(BeadTheme.ink)
                        .lineLimit(1)
                    if project.id == currentId {
                        Text("编辑中")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(BeadTheme.accent)
                            .padding(.horizontal, 5)
                            .padding(.vertical, 1)
                            .background(BeadTheme.accentSoft, in: RoundedRectangle(cornerRadius: 4))
                    }
                }
                Text(project.summary)
                    .font(.system(size: 12))
                    .foregroundStyle(BeadTheme.muted)
                    .lineLimit(1)
                Text(project.updatedAt.formatted(date: .numeric, time: .shortened))
                    .font(.system(size: 11))
                    .foregroundStyle(BeadTheme.muted)
            }

            Spacer(minLength: 0)

            Image(systemName: "chevron.right")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(BeadTheme.muted.opacity(0.6))
        }
        .padding(.vertical, 2)
    }

    @ViewBuilder
    private func thumbnail(_ project: BeadProject) -> some View {
        if let image = store.thumbnail(for: project) {
            Image(uiImage: image)
                .resizable()
                .scaledToFill()
                .frame(width: 52, height: 52)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay {
                    RoundedRectangle(cornerRadius: 8)
                        .strokeBorder(.black.opacity(0.08), lineWidth: 1)
                }
        } else {
            RoundedRectangle(cornerRadius: 8)
                .fill(BeadTheme.fill)
                .frame(width: 52, height: 52)
                .overlay {
                    Image(systemName: "photo")
                        .font(.system(size: 16))
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

    private var storeMessageBinding: Binding<Bool> {
        Binding(
            get: { store.message != nil },
            set: { if !$0 { store.message = nil } }
        )
    }
}
