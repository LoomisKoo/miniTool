import PhotosUI
import SwiftUI

/// 裁图编辑页。布局与交互对齐 H5：标题栏 → 预览框 → 参数面板 → 底部操作栏。
struct CropEditorView: View {
    let model: CropEditorModel
    let onDone: () -> Void
    let onBack: () -> Void

    @State private var photoItem: PhotosPickerItem?
    @State private var showPicker = false

    var body: some View {
        VStack(spacing: 0) {
            header

            CropCanvasView(model: model)
                .padding(.horizontal, 16)
                .padding(.top, 8)

            panel
                .padding(.horizontal, 16)
                .padding(.top, 12)

            actions
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(QingyingTheme.background)
        .photosPicker(isPresented: $showPicker, selection: $photoItem, matching: .images)
        .onChange(of: photoItem) { _, newValue in
            guard let newValue else { return }
            Task { await reload(newValue) }
        }
        .overlay {
            if model.isWorking {
                loadingMask
            }
        }
    }

    // MARK: - 标题栏

    private var header: some View {
        ZStack {
            Text("裁图")
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

    // MARK: - 参数面板

    private var panel: some View {
        QingGroup {
            ratioRow
            QingRowDivider()
            shapeRow
            QingRowDivider()
            gridRow
            QingRowDivider()
            zoomRow
        }
    }

    private var ratioRow: some View {
        HStack(spacing: 8) {
            ForEach(CropRatio.all) { item in
                QingChip(title: item.label, selected: item.id == model.ratioId) {
                    model.selectRatio(item.id)
                }
            }
        }
        .padding(.horizontal, 12)
        .frame(minHeight: 48)
    }

    private var shapeRow: some View {
        HStack(spacing: 8) {
            ForEach(CropShape.allCases) { item in
                QingChip(title: item.label, selected: item.id == model.shapeId) {
                    model.selectShape(item.id)
                }
            }

            if model.shape == .round {
                Slider(
                    value: Binding(
                        get: { Double(model.radiusPercent) },
                        set: { model.radiusPercent = CGFloat($0) }
                    ),
                    in: 0...50
                )
                .frame(maxWidth: 96)
                Text("\(Int(model.radiusPercent))%")
                    .font(.system(size: 13))
                    .foregroundStyle(QingyingTheme.muted)
                    .monospacedDigit()
                    .frame(width: 38, alignment: .trailing)
            }
        }
        .padding(.horizontal, 12)
        .frame(minHeight: 48)
    }

    private var gridRow: some View {
        HStack(spacing: 8) {
            ForEach(CropGrid.all) { item in
                Button {
                    model.selectGrid(item.id)
                } label: {
                    Group {
                        if item.isSingle {
                            Text(item.label)
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(model.gridId == item.id ? .white : QingyingTheme.ink)
                        } else {
                            QingGridIcon(
                                grid: item,
                                color: model.gridId == item.id ? .white : QingyingTheme.ink
                            )
                        }
                    }
                    .frame(height: 32)
                    .frame(maxWidth: .infinity)
                    .background(
                        model.gridId == item.id ? QingyingTheme.accent : QingyingTheme.fill,
                        in: RoundedRectangle(cornerRadius: 10)
                    )
                }
                .buttonStyle(.plain)
            }

            Menu {
                ForEach(GridLineColor.all) { item in
                    Button {
                        model.lineColorId = item.id
                    } label: {
                        if item.id == model.lineColorId {
                            Label(item.label, systemImage: "checkmark")
                        } else {
                            Text(item.label)
                        }
                    }
                }
            } label: {
                QingColorDot(color: model.lineColor.swatch)
                    .frame(width: 32, height: 32)
                    .background(QingyingTheme.fill, in: RoundedRectangle(cornerRadius: 10))
            }
        }
        .padding(.horizontal, 12)
        .frame(minHeight: 48)
    }

    private var zoomRow: some View {
        HStack(spacing: 12) {
            Image(systemName: "minus.magnifyingglass")
                .font(.system(size: 13))
                .foregroundStyle(QingyingTheme.muted)

            Slider(
                value: Binding(
                    get: { Double(model.zoom) },
                    set: { model.setZoom(CGFloat($0)) }
                ),
                in: Double(CropEditorModel.minZoom)...Double(CropEditorModel.maxZoom)
            )

            Image(systemName: "plus.magnifyingglass")
                .font(.system(size: 13))
                .foregroundStyle(QingyingTheme.muted)

            QingIconButton(systemName: "rotate.right") { model.rotateClockwise() }
            QingIconButton(systemName: "arrow.left.and.right.righttriangle.left.righttriangle.right") {
                model.toggleFlip()
            }
        }
        .padding(.horizontal, 12)
        .frame(minHeight: 52)
    }

    // MARK: - 底部操作

    private var actions: some View {
        HStack(spacing: 10) {
            QingOutlineButton(title: "重选") {
                photoItem = nil
                showPicker = true
            }
            .frame(width: 92)

            QingPrimaryButton(title: "开始裁图", enabled: model.hasImage) {
                startProcess()
            }
        }
    }

    private var loadingMask: some View {
        ZStack {
            Color.black.opacity(0.15).ignoresSafeArea()
            VStack(spacing: 10) {
                ProgressView()
                Text("处理中…")
                    .font(.system(size: 14))
                    .foregroundStyle(QingyingTheme.muted)
            }
            .padding(22)
            .background(QingyingTheme.surface, in: RoundedRectangle(cornerRadius: 14))
        }
    }

    // MARK: - 动作

    private func startProcess() {
        guard model.hasImage else { return }
        model.isWorking = true
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 30_000_000)
            _ = model.makeOutputs()
            model.isWorking = false
            if model.results.isEmpty {
                model.flash("没有可导出的内容")
            } else {
                onDone()
            }
        }
    }

    private func reload(_ item: PhotosPickerItem) async {
        guard let data = try? await item.loadTransferable(type: Data.self) else {
            model.flash("这张图片读不出来，换一张试试")
            return
        }
        do {
            try model.load(data: data)
        } catch {
            model.flash(error.localizedDescription)
        }
    }
}
