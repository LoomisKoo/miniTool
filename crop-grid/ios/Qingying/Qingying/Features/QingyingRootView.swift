import PhotosUI
import SwiftUI

/// 根视图：负责导航与「选图 → 编辑 → 结果」的串联。
struct QingyingRootView: View {
    enum Route: Hashable {
        case editor
        case result
    }

    @State private var model = CropEditorModel()
    @State private var path: [Route] = []
    @State private var photoItem: PhotosPickerItem?
    @State private var showPicker = false

    var body: some View {
        NavigationStack(path: $path) {
            QingyingHomeView(
                onCrop: {
                    photoItem = nil
                    showPicker = true
                },
                onStitch: {
                    model.flash("拼图正在开发中")
                }
            )
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: Route.self) { route in
                switch route {
                case .editor:
                    CropEditorView(
                        model: model,
                        onDone: { path.append(.result) },
                        onBack: pop
                    )
                    .toolbar(.hidden, for: .navigationBar)

                case .result:
                    CropResultView(model: model, onBack: pop)
                        .toolbar(.hidden, for: .navigationBar)
                }
            }
        }
        .photosPicker(isPresented: $showPicker, selection: $photoItem, matching: .images)
        .onChange(of: photoItem) { _, newValue in
            guard let newValue else { return }
            Task { await load(newValue) }
        }
        .overlay(alignment: .bottom) { toastView }
    }

    private func pop() {
        guard !path.isEmpty else { return }
        path.removeLast()
    }

    @MainActor
    private func load(_ item: PhotosPickerItem) async {
        guard let data = try? await item.loadTransferable(type: Data.self) else {
            model.flash("这张图片读不出来，换一张试试")
            return
        }
        do {
            try model.load(data: data)
            path = [.editor]
        } catch {
            model.flash(error.localizedDescription)
        }
    }

    @ViewBuilder
    private var toastView: some View {
        if let message = model.toast {
            Text(message)
                .font(.system(size: 14))
                .foregroundStyle(.white)
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .background(Color.black.opacity(0.78), in: Capsule())
                .padding(.bottom, 64)
                .transition(.opacity.combined(with: .move(edge: .bottom)))
        }
    }
}
