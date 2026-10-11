import Photos
import SwiftUI
import UniformTypeIdentifiers
import UIKit

struct TicketPNGDocument: FileDocument {
    static var readableContentTypes: [UTType] { [.png] }
    var data: Data

    init(data: Data = Data()) {
        self.data = data
    }

    init(configuration: ReadConfiguration) throws {
        data = configuration.file.regularFileContents ?? Data()
    }

    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper {
        FileWrapper(regularFileWithContents: data)
    }
}

struct ExportSheet: View {
    @Environment(TicketStore.self) private var store
    @Environment(ProStore.self) private var pro
    @Environment(\.dismiss) private var dismiss
    @Binding var notice: String
    @State private var isRendering = false
    @State private var showFileExporter = false
    @State private var showPaywall = false
    @State private var transparentBackground = false
    @State private var fileDocument = TicketPNGDocument()

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 20) {
                Text("将当前票根保存为高清 PNG，可以存入相册或本地文件。")
                    .foregroundStyle(FrameTheme.textSecondary)

                VStack(alignment: .leading, spacing: 12) {
                    exportOption(
                        title: "超高清导出",
                        detail: "Pro · 2× 分辨率，适合打印与大图发布",
                        isOn: pro.isPro,
                        action: {
                            guard pro.isPro else {
                                showPaywall = true
                                return
                            }
                        }
                    )
                    exportOption(
                        title: "透明背景",
                        detail: "Pro · 导出时移除画板底色",
                        isOn: transparentBackground,
                        action: {
                            guard pro.isPro else {
                                showPaywall = true
                                return
                            }
                            transparentBackground.toggle()
                        }
                    )
                }
                .padding(16)
                .background(FrameTheme.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(FrameTheme.line, lineWidth: 1))

                Button {
                    exportToPhotos()
                } label: {
                    Label("保存到相册", systemImage: "photo.badge.arrow.down")
                        .frame(maxWidth: .infinity)
                        .foregroundStyle(FrameTheme.onAccent)
                }
                .buttonStyle(.borderedProminent)
                .disabled(isRendering)

                Button {
                    guard let image = renderImage(), let data = image.pngData() else {
                        notice = AppLocalization.text("保存失败，请重试")
                        return
                    }
                    fileDocument = TicketPNGDocument(data: data)
                    showFileExporter = true
                } label: {
                    Label("保存到本地文件", systemImage: "folder")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .disabled(isRendering)

                if isRendering {
                    ProgressView("正在生成高清票根…")
                        .frame(maxWidth: .infinity)
                }

                Spacer()
            }
            .padding(20)
            .navigationTitle("保存")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) { Button("完成") { dismiss() } }
            }
        }
        .presentationDetents([.medium])
        .presentationBackground(FrameTheme.panel)
        .tint(FrameTheme.accent)
        .sheet(isPresented: $showPaywall) {
            PaywallView()
        }
        .fileExporter(
            isPresented: $showFileExporter,
            document: fileDocument,
            contentType: .png,
            defaultFilename: "帧藏-\(store.fields.title)"
        ) { result in
            switch result {
            case .success:
                notice = AppLocalization.text("已保存到本地文件")
                dismiss()
            case .failure:
                notice = AppLocalization.text("文件保存失败，请重试")
            }
        }
    }

    private func exportToPhotos() {
        isRendering = true
        guard let image = renderImage() else {
            isRendering = false
            notice = AppLocalization.text("导出失败，请重试")
            return
        }
        Task {
            let status = await PHPhotoLibrary.requestAuthorization(for: .addOnly)
            await MainActor.run {
                guard status == .authorized || status == .limited else {
                    isRendering = false
                    notice = AppLocalization.text("没有相册写入权限，请在系统设置中允许访问")
                    return
                }
                UIImageWriteToSavedPhotosAlbum(image, nil, nil, nil)
                isRendering = false
                notice = AppLocalization.text("已保存到相册")
                dismiss()
            }
        }
    }

    /// 与编辑页画板同构：票根四周各留长边 10%，再按目标像素放大。
    private func renderImage() -> UIImage? {
        let ticket = store.template.size
        let pad = max(ticket.width, ticket.height) * 0.1
        let board = CGSize(width: ticket.width + pad * 2, height: ticket.height + pad * 2)
        let longSide: CGFloat = pro.isPro ? 3000 : 1500

        let renderer = ImageRenderer(content:
            ZStack {
                exportBackground
                    .frame(width: board.width, height: board.height)
                TicketCardView()
                    .environment(store)
                    .frame(width: ticket.width, height: ticket.height)
            }
            .frame(width: board.width, height: board.height)
        )
        renderer.scale = longSide / max(board.width, board.height)
        return renderer.uiImage
    }

    @ViewBuilder
    private var exportBackground: some View {
        if transparentBackground {
            Color.clear
        } else {
            store.background.background
                .overlay {
                    if let data = store.stageBackgroundData, let image = UIImage(data: data) {
                        Image(uiImage: image)
                            .resizable()
                            .scaledToFill()
                            .opacity(store.stageOpacity)
                    }
                }
                .clipped()
        }
    }

    private func exportOption(
        title: String,
        detail: String,
        isOn: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: isOn ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(isOn ? FrameTheme.accent : FrameTheme.muted)
                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 6) {
                        Text(LocalizedStringKey(title))
                            .font(.system(size: 15, weight: .semibold))
                        Text("PRO")
                            .font(.system(size: 9, weight: .bold, design: .rounded))
                            .foregroundStyle(FrameTheme.onAccent)
                            .padding(.horizontal, 5)
                            .padding(.vertical, 3)
                            .background(FrameTheme.accent, in: Capsule())
                    }
                    Text(LocalizedStringKey(detail))
                        .font(.system(size: 12))
                        .foregroundStyle(FrameTheme.textSecondary)
                }
                Spacer()
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .foregroundStyle(FrameTheme.text)
    }
}
