import SwiftUI
import UIKit

/// 选图后的切分预览：取景（拖移/缩放）+ 行列，对齐 H5 settingsSheet。
struct CropSheetView: View {
    let image: UIImage
    let initialCrop: CropView
    let initialCols: Int
    let initialRows: Int
    let maxPieces: Int
    var applyTitle: String = "开始拼图"
    var onApply: (_ image: UIImage, _ cols: Int, _ rows: Int, _ crop: CropView) -> Void
    var onPickAnother: (() -> Void)?

    @Environment(\.dismiss) private var dismiss
    @State private var cols: Int
    @State private var rows: Int
    @State private var crop: CropView
    @State private var dragStart: CropView?

    init(
        image: UIImage,
        initialCrop: CropView,
        initialCols: Int,
        initialRows: Int,
        maxPieces: Int,
        applyTitle: String = "开始拼图",
        onApply: @escaping (_ image: UIImage, _ cols: Int, _ rows: Int, _ crop: CropView) -> Void,
        onPickAnother: (() -> Void)? = nil
    ) {
        self.image = image
        self.initialCrop = initialCrop
        self.initialCols = initialCols
        self.initialRows = initialRows
        self.maxPieces = maxPieces
        self.applyTitle = applyTitle
        self.onApply = onApply
        self.onPickAnother = onPickAnother
        _cols = State(initialValue: initialCols)
        _rows = State(initialValue: initialRows)
        _crop = State(initialValue: initialCrop)
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 10) {
                cropPreview
                    .frame(maxWidth: .infinity)
                    .frame(height: 380)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    .overlay {
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .strokeBorder(PandaTheme.line, lineWidth: 1)
                    }

                Text("拖动移动 · 捏合缩放")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(PandaTheme.muted)

                HStack(spacing: 10) {
                    stepper(title: "列", value: $cols)
                    Text("×")
                        .font(.system(size: 18, weight: .bold))
                        .foregroundStyle(PandaTheme.muted)
                    stepper(title: "行", value: $rows)
                    Spacer(minLength: 0)
                    if onPickAnother != nil {
                        Button {
                            onPickAnother?()
                        } label: {
                            Image(systemName: "photo.on.rectangle")
                                .font(.system(size: 18, weight: .semibold))
                                .foregroundStyle(PandaTheme.accent)
                                .frame(width: 40, height: 40)
                                .background(PandaTheme.surface2, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("换图")
                    }
                }

                Button {
                    onApply(image, cols, rows, crop)
                    dismiss()
                } label: {
                    Text(applyTitle)
                        .font(.system(size: 17, weight: .bold))
                        .foregroundStyle(PandaTheme.bg0)
                        .frame(maxWidth: .infinity)
                        .frame(height: 48)
                        .background(PandaTheme.accentGradient, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)
            .padding(.bottom, 16)
            .background(PandaTheme.canvas.ignoresSafeArea())
            .navigationTitle("拼图设置")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { dismiss() } label: {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 22, weight: .semibold))
                            .foregroundStyle(PandaTheme.accent)
                    }
                    .accessibilityLabel("完成")
                }
            }
            .onChange(of: cols) { _, _ in clampGrid() }
            .onChange(of: rows) { _, _ in clampGrid() }
        }
        .presentationDetents([.height(620)])
        .presentationDragIndicator(.visible)
    }

    private var cropPreview: some View {
        GeometryReader { geo in
            let win = cropWindow(in: geo.size)
            ZStack {
                Color.black.opacity(0.35)
                Image(uiImage: image)
                    .resizable()
                    .interpolation(.high)
                    .scaledToFill()
                    .frame(width: imageFrameSize(in: win).width, height: imageFrameSize(in: win).height)
                    .offset(imageOffset(in: win))
                    .frame(width: geo.size.width, height: geo.size.height)
                    .clipped()

                // 取景窗外暗角
                CropDimOverlay(window: win)
                    .allowsHitTesting(false)

                // 行列网格
                CropGridOverlay(cols: cols, rows: rows, window: win)
                    .allowsHitTesting(false)
            }
            .contentShape(Rectangle())
            .gesture(
                DragGesture()
                    .onChanged { value in
                        if dragStart == nil { dragStart = crop }
                        let base = dragStart ?? crop
                        let iw = max(1, image.size.width)
                        let ih = max(1, image.size.height)
                        let rect = JigsawGeometry.cropRect(iw: Int(iw), ih: Int(ih), cols: cols, rows: rows, view: base)
                        let dx = value.translation.width / max(win.width, 1) * rect.width / iw
                        let dy = value.translation.height / max(win.height, 1) * rect.height / ih
                        var next = base
                        next.cx = base.cx - dx
                        next.cy = base.cy - dy
                        crop = clampCrop(next)
                    }
                    .onEnded { _ in dragStart = nil }
            )
            .simultaneousGesture(
                MagnificationGesture()
                    .onChanged { scale in
                        if dragStart == nil { dragStart = crop }
                        let base = dragStart ?? crop
                        var next = base
                        next.zoom = min(8, max(1, base.zoom * scale))
                        crop = clampCrop(next)
                    }
                    .onEnded { _ in dragStart = nil }
            )
            .onTapGesture(count: 2) {
                var next = crop
                next.zoom = next.zoom < 2.2 ? 2.6 : 1
                withAnimation(.easeOut(duration: 0.22)) {
                    crop = clampCrop(next)
                }
            }
        }
    }

    private func stepper(title: String, value: Binding<Int>) -> some View {
        HStack(spacing: 0) {
            Button {
                value.wrappedValue = max(2, value.wrappedValue - 1)
            } label: {
                Image(systemName: "minus")
                    .font(.system(size: 13, weight: .bold))
                    .frame(width: 34, height: 40)
            }
            .buttonStyle(.plain)

            // 与 H5 一致：数字和「列/行」同一行基线对齐
            HStack(alignment: .firstTextBaseline, spacing: 3) {
                Text("\(value.wrappedValue)")
                    .font(.system(size: 18, weight: .heavy))
                    .foregroundStyle(PandaTheme.ink)
                    .monospacedDigit()
                Text(title)
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(PandaTheme.muted)
            }
            .frame(minWidth: 44)

            Button {
                value.wrappedValue = min(PuzzleCutEngine.maxDim, value.wrappedValue + 1)
            } label: {
                Image(systemName: "plus")
                    .font(.system(size: 13, weight: .bold))
                    .frame(width: 34, height: 40)
            }
            .buttonStyle(.plain)
        }
        .foregroundStyle(PandaTheme.ink)
        .padding(.horizontal, 4)
        .background(PandaTheme.surface2, in: Capsule())
    }

    private func clampGrid() {
        var c = min(PuzzleCutEngine.maxDim, max(2, cols))
        var r = min(PuzzleCutEngine.maxDim, max(2, rows))
        while c * r > maxPieces, c > 2 || r > 2 {
            if c >= r { c -= 1 } else { r -= 1 }
        }
        cols = c
        rows = r
        crop = clampCrop(crop)
    }

    private func clampCrop(_ view: CropView) -> CropView {
        var v = view
        v.zoom = min(8, max(1, v.zoom))
        let iw = max(1, Int(image.size.width))
        let ih = max(1, Int(image.size.height))
        let rect = JigsawGeometry.cropRect(iw: iw, ih: ih, cols: cols, rows: rows, view: v)
        v.cx = rect.midX / CGFloat(iw)
        v.cy = rect.midY / CGFloat(ih)
        return v
    }

    private func cropWindow(in size: CGSize) -> CGRect {
        let a = CGFloat(cols) / CGFloat(rows)
        var cw = size.width * 0.92
        var ch = cw / a
        if ch > size.height * 0.92 {
            ch = size.height * 0.92
            cw = ch * a
        }
        return CGRect(
            x: (size.width - cw) / 2,
            y: (size.height - ch) / 2,
            width: cw,
            height: ch
        )
    }

    private func imageFrameSize(in win: CGRect) -> CGSize {
        let iw = max(1, image.size.width)
        let ih = max(1, image.size.height)
        let rect = JigsawGeometry.cropRect(iw: Int(iw), ih: Int(ih), cols: cols, rows: rows, view: crop)
        let scale = win.width / max(1, rect.width)
        return CGSize(width: iw * scale, height: ih * scale)
    }

    private func imageOffset(in win: CGRect) -> CGSize {
        let iw = max(1, image.size.width)
        let ih = max(1, image.size.height)
        let rect = JigsawGeometry.cropRect(iw: Int(iw), ih: Int(ih), cols: cols, rows: rows, view: crop)
        let scale = win.width / max(1, rect.width)
        // 图片中心应对齐到：win 中心 + (图片中心 - crop中心) * scale
        let dx = (iw / 2 - rect.midX) * scale
        let dy = (ih / 2 - rect.midY) * scale
        return CGSize(width: dx, height: dy)
    }
}

private struct CropDimOverlay: View {
    let window: CGRect

    var body: some View {
        GeometryReader { geo in
            Path { p in
                p.addRect(CGRect(origin: .zero, size: geo.size))
                p.addRect(window)
            }
            .fill(Color.black.opacity(0.45), style: FillStyle(eoFill: true))
        }
    }
}

private struct CropGridOverlay: View {
    let cols: Int
    let rows: Int
    let window: CGRect

    var body: some View {
        Canvas { ctx, _ in
            var path = Path()
            let cw = window.width / CGFloat(cols)
            let ch = window.height / CGFloat(rows)
            for c in 1..<cols {
                let x = window.minX + CGFloat(c) * cw
                path.move(to: CGPoint(x: x, y: window.minY))
                path.addLine(to: CGPoint(x: x, y: window.maxY))
            }
            for r in 1..<rows {
                let y = window.minY + CGFloat(r) * ch
                path.move(to: CGPoint(x: window.minX, y: y))
                path.addLine(to: CGPoint(x: window.maxX, y: y))
            }
            ctx.stroke(path, with: .color(.white.opacity(0.55)), lineWidth: 1)
            ctx.stroke(
                Path(roundedRect: window, cornerRadius: 2),
                with: .color(Color(red: 1, green: 0.71, blue: 0.28)),
                lineWidth: 2
            )
        }
    }
}
