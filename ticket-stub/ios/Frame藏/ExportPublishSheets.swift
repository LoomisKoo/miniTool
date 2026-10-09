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
    @Environment(\.dismiss) private var dismiss
    @Binding var notice: String
    @State private var isRendering = false
    @State private var showFileExporter = false
    @State private var fileDocument = TicketPNGDocument()

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 20) {
                Text("将当前票根保存为高清 PNG，可以存入相册或本地文件。")
                    .foregroundStyle(FrameTheme.textSecondary)

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
                        notice = "保存失败，请重试"
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
        .fileExporter(
            isPresented: $showFileExporter,
            document: fileDocument,
            contentType: .png,
            defaultFilename: "帧藏-\(store.fields.title)"
        ) { result in
            if case .success = result {
                notice = "已保存到本地文件"
                dismiss()
            }
        }
    }

    private func exportToPhotos() {
        isRendering = true
        guard let image = renderImage() else {
            isRendering = false
            notice = "导出失败，请重试"
            return
        }
        UIImageWriteToSavedPhotosAlbum(image, nil, nil, nil)
        isRendering = false
        notice = "已保存到相册"
        dismiss()
    }

    private func renderImage() -> UIImage? {
        let renderer = ImageRenderer(content:
            TicketCardView()
                .environment(store)
                .frame(width: 1200, height: 1500)
                .padding(40)
                .background(store.background.background)
        )
        renderer.scale = 2
        return renderer.uiImage
}
}
