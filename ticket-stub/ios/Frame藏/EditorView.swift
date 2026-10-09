import PhotosUI
import SwiftUI
import UIKit

struct EditorView: View {
    @Environment(TicketStore.self) private var store
    @Environment(WorkLibrary.self) private var library
    var isDetail = false
    @State private var showNamePrompt = false
    @State private var showSaveOptions = false
    @State private var nameDraft = ""
    @State private var sheet: EditorSheet?
    @State private var photoItem: PhotosPickerItem?
    @State private var showPhotoPicker = false
    @State private var showPhotoAdjust = false
    @State private var notice = ""

    var body: some View {
        @Bindable var store = store

        ZStack {
            FrameTheme.bg
                .ignoresSafeArea()
            Circle()
                .fill(store.background.background.opacity(0.20))
                .frame(width: 360, height: 360)
                .blur(radius: 90)
                .offset(x: 140, y: -260)
            Circle()
                .fill(FrameTheme.accent.opacity(0.06))
                .frame(width: 260, height: 260)
                .blur(radius: 80)
                .offset(x: -150, y: 260)
            VStack(spacing: 0) {
                header

                stageArtboard
                    .padding(.horizontal, 16)
                    .padding(.vertical, 14)
                    .overlay(alignment: .bottom) {
                        if !notice.isEmpty {
                            Text(notice)
                                .font(.system(size: 12, weight: .medium))
                                .foregroundStyle(FrameTheme.text)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 6)
                                .background(FrameTheme.scrim, in: Capsule())
                                .transition(.opacity)
                        }
                    }

                bottomDock
            }
        }
        .sheet(item: $sheet) { sheet in
            switch sheet {
            case .styles: TemplateSheet()
            case .fields: FieldsSheet()
            case .effects: EffectsSheet()
            case .stage: StageSheet()
            case .export: ExportSheet(notice: $notice)
            }
        }
        .alert("保存为新作品", isPresented: $showNamePrompt) {
            TextField("作品名称", text: $nameDraft)
            Button("取消", role: .cancel) {}
            Button("保存") { saveAsNew(named: nameDraft.trimmingCharacters(in: .whitespaces)) }
        } message: {
            Text("作品仅保存在本机，可在「我的」中查看")
        }
        .confirmationDialog(savedWork?.title ?? "", isPresented: $showSaveOptions, titleVisibility: .visible) {
            Button("保存修改") { saveChanges() }
            Button("另存为新作品") {
                nameDraft = "\(savedWork?.title ?? store.fields.title) 副本"
                showNamePrompt = true
            }
            if !isDetail {
                Button("新建空白票根") { store.startNew() }
            }
            Button("取消", role: .cancel) {}
        }
        .photosPicker(isPresented: $showPhotoPicker, selection: $photoItem, matching: .images)
        .sheet(isPresented: $showPhotoAdjust) {
            PhotoAdjustSheet()
        }
        .onChange(of: photoItem) { _, item in
            guard let item else { return }
            Task {
                if let data = try? await item.loadTransferable(type: Data.self) {
                    await MainActor.run {
                        store.selectedPhotoData = data
                        photoItem = nil
                        showPhotoAdjust = true
                    }
                }
            }
        }
    }

    private var savedWork: SavedTicket? {
        library.item(store.editingID)
    }

    private func saveAsNew(named name: String) {
        let id = UUID()
        library.upsert(store.snapshot(id: id, name: name.isEmpty ? store.fields.title : name))
        store.editingID = id
        flash("已保存到我的作品")
    }

    private func saveChanges() {
        guard let work = savedWork else { return }
        library.upsert(store.snapshot(id: work.id, name: work.title))
        flash("已保存修改")
    }

    private func flash(_ text: String) {
        withAnimation { notice = text }
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            withAnimation { notice = "" }
        }
    }

    private var header: some View {
        HStack(spacing: 12) {
            Button {
                sheet = .styles
            } label: {
                HStack(spacing: 10) {
                    TicketCardView(interactive: false)
                        .padding(2)
                        .frame(width: 30, height: 30)
                        .background(FrameTheme.thumbBackdrop, in: RoundedRectangle(cornerRadius: 8))
                        .allowsHitTesting(false)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(store.category.rawValue)
                            .font(.system(size: 10, weight: .medium))
                            .foregroundStyle(FrameTheme.muted)
                        Text(store.template.name)
                            .font(.system(size: 14, weight: .semibold))
                    }
                    Image(systemName: "chevron.right")
                        .font(.caption)
                        .foregroundStyle(FrameTheme.muted)
                }
            }
            .buttonStyle(.plain)
            .padding(5)
            .frameGlass(cornerRadius: 14)

            Button {
                showPhotoPicker = true
            } label: {
                Image(systemName: store.selectedPhotoData == nil ? "photo.badge.plus" : "photo")
                    .font(.system(size: 14, weight: .medium))
                    .frame(width: 34, height: 34)
                    .frameGlass(cornerRadius: 17)
            }
            .accessibilityLabel("选择照片")

            if store.selectedPhotoData != nil {
                Button {
                    showPhotoAdjust = true
                } label: {
                    Image(systemName: "crop")
                        .font(.system(size: 13, weight: .medium))
                        .frame(width: 34, height: 34)
                        .frameGlass(cornerRadius: 17)
                }
                .accessibilityLabel("调整照片构图")
            }

            Spacer()

            Button {
                if savedWork == nil {
                    nameDraft = store.fields.title
                    showNamePrompt = true
                } else {
                    showSaveOptions = true
                }
            } label: {
                Image(systemName: savedWork == nil ? "bookmark" : "bookmark.fill")
                    .font(.system(size: 14, weight: .medium))
                    .frame(width: 34, height: 34)
            }
            .frameGlass(cornerRadius: 17)
            .accessibilityLabel("保存作品")
        }
        .foregroundStyle(FrameTheme.text)
        .padding(.horizontal, 20)
        .padding(.top, 10)
    }

    private var stageArtboard: some View {
        GeometryReader { proxy in
            let ticket = store.template.size
            let pad = max(ticket.width, ticket.height) * 0.1
            let board = CGSize(width: ticket.width + pad * 2, height: ticket.height + pad * 2)
            let scale = min(proxy.size.width / board.width, proxy.size.height / board.height)

            ZStack {
                ZStack {
                    store.background.background
                    if let data = store.stageBackgroundData, let image = UIImage(data: data) {
                        Image(uiImage: image)
                            .resizable()
                            .scaledToFill()
                            .opacity(store.stageOpacity)
                    }
                }
                .frame(width: board.width, height: board.height)
                .clipShape(RoundedRectangle(cornerRadius: 22 / max(scale, 0.01), style: .continuous))

                TicketCardView()
                    .frame(width: ticket.width, height: ticket.height)
            }
            .frame(width: board.width, height: board.height)
            .scaleEffect(scale)
            .frame(width: proxy.size.width, height: proxy.size.height)
        }
    }

    private var bottomDock: some View {
        HStack(spacing: 6) {
            dockButton("textformat", "信息", .fields)
            dockButton("sparkles", "特效", .effects)
            dockButton("rectangle.3.group", "画板", .stage)
            Spacer(minLength: 2)
            Button {
                sheet = .export
            } label: {
                    Text("导出")
                    .font(.system(size: 13, weight: .bold))
                    .padding(.horizontal, 14)
                    .padding(.vertical, 12)
                    .foregroundStyle(FrameTheme.onAccent)
                    .background(FrameTheme.accentGradient, in: Capsule())
            }
        }
        .foregroundStyle(FrameTheme.text)
        .padding(.horizontal, 16)
        .padding(.top, 12)
        .padding(.bottom, 10)
        .background(FrameTheme.panel.opacity(0.86), in: RoundedRectangle(cornerRadius: 24, style: .continuous))
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .stroke(FrameTheme.line, lineWidth: 1)
        }
        .padding(.horizontal, 10)
        .padding(.bottom, 8)
    }

    private func dockButton(_ icon: String, _ title: String, _ target: EditorSheet) -> some View {
        Button { sheet = target } label: {
            VStack(spacing: 4) {
                Image(systemName: icon).font(.system(size: 15, weight: .medium))
                Text(title).font(.system(size: 10, weight: .medium))
            }
            .frame(width: 48, height: 42)
        }
    }
}

extension View {
    @ViewBuilder
    func frameGlass(cornerRadius: CGFloat) -> some View {
        if #available(iOS 26.0, *) {
            self
                .glassEffect(.regular, in: RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
        } else {
            self
                .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                        .stroke(FrameTheme.lineStrong, lineWidth: 1)
                }
        }
    }
}

enum EditorSheet: String, Identifiable {
    case styles, fields, effects, stage, export
    var id: String { rawValue }
}
