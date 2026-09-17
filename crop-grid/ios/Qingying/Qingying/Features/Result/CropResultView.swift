import SwiftUI

/// 结果页：预览生成的成品，一次性存相册。
struct CropResultView: View {
    let model: CropEditorModel
    let onBack: () -> Void

    @State private var isSaving = false

    var body: some View {
        VStack(spacing: 0) {
            header

            ScrollView {
                LazyVGrid(columns: columns, spacing: 8) {
                    ForEach(model.results) { output in
                        resultCell(output)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 12)

                Text(hint)
                    .font(.system(size: 13))
                    .foregroundStyle(QingyingTheme.muted)
                    .padding(.top, 12)
                    .padding(.bottom, 20)
            }

            actions
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(QingyingTheme.background)
        .overlay {
            if isSaving {
                ZStack {
                    Color.black.opacity(0.15).ignoresSafeArea()
                    VStack(spacing: 10) {
                        ProgressView()
                        Text("保存中…")
                            .font(.system(size: 14))
                            .foregroundStyle(QingyingTheme.muted)
                    }
                    .padding(22)
                    .background(QingyingTheme.surface, in: RoundedRectangle(cornerRadius: 14))
                }
            }
        }
    }

    private var header: some View {
        ZStack {
            Text("裁图结果")
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(QingyingTheme.ink)

            HStack {
                Button(action: onBack) {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(QingyingTheme.accent)
                        .frame(width: 44, height: 44, alignment: .leading)
                }
                .buttonStyle(.plain)
                Spacer()
            }
            .padding(.horizontal, 12)
        }
        .frame(height: 44)
        .background(QingyingTheme.background)
        .overlay(alignment: .bottom) {
            Rectangle().fill(QingyingTheme.separator).frame(height: 0.5)
        }
    }

    private var columns: [GridItem] {
        if model.results.count <= 1 {
            return [GridItem(.flexible())]
        }
        return Array(repeating: GridItem(.flexible(), spacing: 8), count: 3)
    }

    private var hint: String {
        if model.results.count <= 1 {
            return "已生成 1 张，点「存相册」保存。"
        }
        return "已切成 \(model.results.count) 张，按编号顺序发布即可。"
    }

    private func resultCell(_ output: CropRenderer.Output) -> some View {
        ZStack(alignment: .topLeading) {
            Image(uiImage: output.image)
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(maxWidth: .infinity)
                .background(QingyingTheme.viewport)
                .clipShape(RoundedRectangle(cornerRadius: 8))

            if let index = output.index {
                Text("\(index)")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Color.black.opacity(0.55), in: Capsule())
                    .padding(6)
            }
        }
    }

    private var actions: some View {
        HStack(spacing: 10) {
            QingOutlineButton(title: "继续调整", action: onBack)

            QingPrimaryButton(title: "存相册", enabled: !model.results.isEmpty && !isSaving) {
                save()
            }
        }
    }

    private func save() {
        guard !model.results.isEmpty, !isSaving else { return }
        isSaving = true
        let items = model.results.map(\.saveItem)
        Task { @MainActor in
            do {
                try await PhotoLibrary.save(items)
                model.flash("已存到相册")
            } catch {
                model.flash(error.localizedDescription)
            }
            isSaving = false
        }
    }
}
