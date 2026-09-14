import SwiftUI

/// 裁切页面。
struct BeadCropView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var model = BeadCropModel()
    /// 打开时只按真实画布尺寸初始化一次。
    @State private var didOpen = false
    /// 捏合起点缩放。
    @State private var pinchStartScale: CGFloat = 0
    
    let sourceImage: UIImage
    let existingCrop: CropRect?
    let onApply: (CropOutput?) -> Void
    
    var body: some View {
        ZStack {
            Color(uiColor: .systemGroupedBackground)
                .ignoresSafeArea()
            
            VStack(spacing: 0) {
                // 导航栏
                navBar
                
                // 画布
                cropCanvas
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                
                // 控制面板
                controlPanel
                
                // 底部按钮
                actionButtons
            }
        }
    }
    
    // MARK: - 子视图
    
    private var navBar: some View {
        HStack {
            Text("裁切图片")
                .font(.headline)
            
            Spacer()
        }
        .padding()
        .background(Color(uiColor: .systemBackground))
    }
    
    private var cropCanvas: some View {
        GeometryReader { geometry in
            ZStack {
                // 背景
                Color(uiColor: .systemGray6)
                
                // 裁切画布
                CropCanvasView(model: model)
                    .frame(width: geometry.size.width, height: geometry.size.height)
                    .gesture(
                        DragGesture(minimumDistance: 0)
                            .onChanged { value in
                                if !model.isDragging {
                                    model.startDrag(at: value.location)
                                }
                                model.updateDrag(to: value.location)
                            }
                            .onEnded { _ in
                                model.endDrag()
                            }
                    )
                    .simultaneousGesture(
                        MagnificationGesture()
                            .onChanged { value in
                                if pinchStartScale <= 0 {
                                    pinchStartScale = model.transform.scale
                                }
                                model.setPinchScale(pinchStartScale * value)
                            }
                            .onEnded { _ in
                                pinchStartScale = 0
                            }
                    )
            }
            .onAppear {
                guard !didOpen else { return }
                didOpen = true
                model.open(
                    sourceImage: sourceImage,
                    existingCrop: existingCrop,
                    viewportSize: geometry.size
                )
            }
        }
    }
    
    private var controlPanel: some View {
        VStack(spacing: 16) {
            // 比例选择
            ratioChips
            
            // 缩放与工具
            HStack(spacing: 20) {
                Text("缩放")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                
                Slider(value: $model.zoomPercent, in: 0...500)
                    .tint(.accentColor)
                
                HStack(spacing: 12) {
                    Button {
                        model.rotate()
                    } label: {
                        Image(systemName: "rotate.right")
                            .font(.title3)
                            .frame(width: 44, height: 44)
                            .background(Color(uiColor: .secondarySystemGroupedBackground))
                            .clipShape(Circle())
                    }
                    
                    Button {
                        model.flip()
                    } label: {
                        Image(systemName: "arrow.left.and.right")
                            .font(.title3)
                            .frame(width: 44, height: 44)
                            .background(Color(uiColor: .secondarySystemGroupedBackground))
                            .clipShape(Circle())
                    }
                }
            }
            .padding(.horizontal)
        }
        .padding(.vertical, 16)
        .background(Color(uiColor: .systemBackground))
    }
    
    private var ratioChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 12) {
                ForEach(CropRatio.presets) { ratio in
                    Button {
                        model.selectRatio(ratio)
                    } label: {
                        Text(ratio.label)
                            .font(.subheadline)
                            .fontWeight(.medium)
                            .padding(.horizontal, 16)
                            .padding(.vertical, 8)
                            .background(
                                model.selectedRatio.id == ratio.id
                                    ? Color.accentColor
                                    : Color(uiColor: .secondarySystemGroupedBackground)
                            )
                            .foregroundStyle(
                                model.selectedRatio.id == ratio.id
                                    ? .white
                                    : .primary
                            )
                            .clipShape(Capsule())
                    }
                }
            }
            .padding(.horizontal)
        }
    }
    
    private var actionButtons: some View {
        HStack(spacing: 12) {
            Button {
                dismiss()
            } label: {
                Text("取消")
                    .font(.body)
                    .fontWeight(.medium)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(Color(uiColor: .secondarySystemGroupedBackground))
                    .foregroundStyle(.primary)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
            }
            
            Button {
                model.reset()
            } label: {
                Text("重置")
                    .font(.body)
                    .fontWeight(.medium)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(Color(uiColor: .secondarySystemGroupedBackground))
                    .foregroundStyle(.primary)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
            }
            
            Button {
                let result = model.applyCrop()
                onApply(result)
                dismiss()
            } label: {
                Text("应用裁切")
                    .font(.body)
                    .fontWeight(.semibold)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(Color.accentColor)
                    .foregroundStyle(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
            }
        }
        .padding()
        .background(Color(uiColor: .systemBackground))
    }
}

// MARK: - 裁切画布

private struct CropCanvasView: View {
    @Bindable var model: BeadCropModel
    
    var body: some View {
        Canvas { context, size in
            // 背景
            context.fill(
                Path(CGRect(origin: .zero, size: size)),
                with: .color(.init(uiColor: .systemGray6))
            )
            
            // 绘制图片
            if let image = model.sourceImage {
                drawImage(context: context, image: image, size: size)
            }
            
            // 选区外压暗
            context.fill(
                Path(CGRect(origin: .zero, size: size)),
                with: .color(.black.opacity(0.5))
            )
            
            // 选区内重绘图片（等效"打洞"）
            context.drawLayer { layerContext in
                layerContext.clip(to: Path(model.cropFrame))
                if let image = model.sourceImage {
                    drawImage(context: layerContext, image: image, size: size)
                }
            }
            
            // 裁切框边框
            var cropPath = Path()
            cropPath.addRect(model.cropFrame)
            context.stroke(
                cropPath,
                with: .color(.white.opacity(0.9)),
                lineWidth: 2
            )
            
            // 三分参考线
            drawGridLines(context: context, frame: model.cropFrame)
            
            // 自由比例：四角把手
            if model.selectedRatio.id == "free" {
                drawHandles(context: context, frame: model.cropFrame)
            }
        }
    }
    
    private func drawImage(context: GraphicsContext, image: UIImage, size: CGSize) {
        guard image.cgImage != nil else { return }
        
        let imageSize = CGSize(width: image.size.width, height: image.size.height)
        let displaySize = CGSize(
            width: imageSize.width * model.transform.scale,
            height: imageSize.height * model.transform.scale
        )
        
        var imageContext = context
        
        // 平移到视口中心
        imageContext.translateBy(
            x: size.width / 2 + model.transform.offset.width,
            y: size.height / 2 + model.transform.offset.height
        )
        
        // 旋转
        imageContext.rotate(by: Angle(radians: model.transform.rotation))
        
        // 翻转
        if model.transform.isFlipped {
            imageContext.scaleBy(x: -1, y: 1)
        }
        
        // 绘制图片
        let rect = CGRect(
            x: -displaySize.width / 2,
            y: -displaySize.height / 2,
            width: displaySize.width,
            height: displaySize.height
        )
        
        if let resolved = context.resolveSymbol(id: "image") {
            imageContext.draw(resolved, in: rect)
        } else {
            imageContext.draw(Image(uiImage: image), in: rect)
        }
    }
    
    private func drawGridLines(context: GraphicsContext, frame: CGRect) {
        var path = Path()
        
        // 垂直线
        let w1 = frame.minX + frame.width / 3
        let w2 = frame.minX + frame.width * 2 / 3
        path.move(to: CGPoint(x: w1, y: frame.minY))
        path.addLine(to: CGPoint(x: w1, y: frame.maxY))
        path.move(to: CGPoint(x: w2, y: frame.minY))
        path.addLine(to: CGPoint(x: w2, y: frame.maxY))
        
        // 水平线
        let h1 = frame.minY + frame.height / 3
        let h2 = frame.minY + frame.height * 2 / 3
        path.move(to: CGPoint(x: frame.minX, y: h1))
        path.addLine(to: CGPoint(x: frame.maxX, y: h1))
        path.move(to: CGPoint(x: frame.minX, y: h2))
        path.addLine(to: CGPoint(x: frame.maxX, y: h2))
        
        context.stroke(
            path,
            with: .color(.white.opacity(0.4)),
            lineWidth: 1
        )
    }
    
    private func drawHandles(context: GraphicsContext, frame: CGRect) {
        let handleSize: CGFloat = 14
        let corners = [
            CGPoint(x: frame.minX, y: frame.minY),
            CGPoint(x: frame.maxX, y: frame.minY),
            CGPoint(x: frame.minX, y: frame.maxY),
            CGPoint(x: frame.maxX, y: frame.maxY)
        ]
        
        for corner in corners {
            var path = Path()
            path.addEllipse(in: CGRect(
                x: corner.x - handleSize / 2,
                y: corner.y - handleSize / 2,
                width: handleSize,
                height: handleSize
            ))
            
            context.fill(path, with: .color(.white))
            context.stroke(path, with: .color(.blue.opacity(0.9)), lineWidth: 2)
        }
    }
}
