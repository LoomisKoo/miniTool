import PhotosUI
import SwiftUI

struct PuzzleGameView: View {
    private static let stackVisibleLimit = 72

    @Environment(ProStore.self) private var pro
    @Environment(PuzzleSaveStore.self) private var saves
    @State private var model = PuzzleGameViewModel()
    @State private var scene = PuzzleSceneController()
    @State private var toastVisible = false
    @State private var trayWidth: CGFloat = 320
    @State private var boardShakeX: CGFloat = 0

    var body: some View {
        ZStack {
            PandaTheme.canvas.ignoresSafeArea()

            VStack(spacing: 8) {
                stage
                trayBar
            }
            .padding(.horizontal, 10)
            .padding(.bottom, 8)

            if toastVisible, !model.hint.isEmpty {
                Text(model.hint)
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 20)
                    .padding(.vertical, 12)
                    .background(Color.black.opacity(0.72), in: Capsule())
                    .shadow(color: .black.opacity(0.25), radius: 12, y: 4)
                    .transition(.scale.combined(with: .opacity))
            }

            // 页面级最上层庆祝效果，不受 SceneKit 场景裁剪。
            ConfettiOverlay(trigger: model.celebrationToken)
                .ignoresSafeArea()
                .allowsHitTesting(false)
                .zIndex(100)
        }
        .task {
            model.bind(pro: pro)
            model.bootIfNeeded()
            flashToast()
        }
        .onChange(of: pro.isPro) { _, _ in model.bind(pro: pro) }
        .onChange(of: model.pickerItem) { _, _ in Task { await model.loadPickedPhoto() } }
        .onChange(of: model.hint) { _, _ in flashToast() }
        .onChange(of: model.board.shakeTick) { _, _ in playBoardShake() }
        .alert("确定要重来吗？", isPresented: $model.showRestartConfirm) {
            Button("再想想", role: .cancel) {}
            Button("重来", role: .destructive) { model.restartConfirmed() }
        } message: {
            Text("已拼好的拼块会全部收回。")
        }
        .alert("保存拼图", isPresented: $model.showSaveName) {
            TextField("请输入拼图名称", text: $model.saveName)
            Button("取消", role: .cancel) {}
            Button("保存") { model.saveNamed(saves: saves) }
                .disabled(model.saveName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        } message: {
            Text("为这个拼图进度输入一个名称")
        }
        .sheet(isPresented: $model.showCropSheet) {
            if let img = model.cropDraftImage {
                CropSheetView(
                    image: img,
                    initialCrop: model.cropInitialCrop,
                    initialCols: model.cropInitialCols,
                    initialRows: model.cropInitialRows,
                    maxPieces: model.maxPieces,
                    applyTitle: model.cropApplyTitle,
                    onApply: { image, cols, rows, crop in
                        model.applyCrop(image: image, cols: cols, rows: rows, crop: crop)
                    },
                    onPickAnother: {
                        // 关闭后立刻再开相册：用 PhotosPicker 的隐藏触发
                        model.showCropSheet = false
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
                            model.pendingPickPhoto = true
                        }
                    }
                )
            }
        }
        .photosPicker(
            isPresented: $model.pendingPickPhoto,
            selection: $model.pickerItem,
            matching: .images
        )
    }

    private var stage: some View {
        PuzzleSceneView(controller: scene, board: model.board, sourceImage: model.sourceImage) { slot, _ in
            if let slot { model.tapSlot(slot) }
        }
        .offset(x: boardShakeX)
        .frame(minHeight: 220)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var trayBar: some View {
        let unplaced = model.board.pieces.filter { !$0.isPlaced }.sorted { $0.trayOrder < $1.trayOrder }

        return VStack(spacing: 0) {
                HStack(spacing: 6) {
                    Text("拼块")
                        .font(.system(size: 13, weight: .heavy))
                        .foregroundStyle(PandaTheme.ink)
                    Text("\(unplaced.count)")
                        .font(.system(size: 12, weight: .heavy))
                        .foregroundStyle(PandaTheme.accent)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(PandaTheme.accent.opacity(0.16), in: Capsule())

                    Spacer(minLength: 0)

                toolButton(
                    title: "提示",
                    systemImage: model.hintOn ? "lightbulb.fill" : "lightbulb",
                    action: model.toggleHint,
                    on: model.hintOn
                )
                toolButton(title: "揭晓", systemImage: "wand.and.stars", action: model.solveAll)
                    .disabled(model.board.pieces.isEmpty || model.isPreparingPuzzle)
                toolButton(title: "复位", systemImage: "viewfinder") {
                    scene.resetCamera()
                }
                toolButton(title: "选图", systemImage: "photo.on.rectangle") {
                    model.openCropEditor()
                }
                toolButton(title: "保存", systemImage: "square.and.arrow.down.fill") {
                    model.requestSave(saves: saves)
                }
                .disabled(model.board.pieces.isEmpty || model.isPreparingPuzzle)
                }
                .padding(.horizontal, 10)
            .frame(height: 47)

            ZStack(alignment: .topTrailing) {
                Group {
                    if model.board.trayMode == .list {
                        listTray(unplaced)
                    } else {
                        stackTray(unplaced)
                    }
                }
                .frame(
                    height: PandaTheme.thumbSize * CGFloat(PandaTheme.trayRows) + 18,
                    alignment: .top
                )
                .frame(maxWidth: .infinity)
                .padding(.horizontal, 2)
                .background(
                    GeometryReader { geo in
                        Color.clear.preference(key: TrayWidthKey.self, value: geo.size.width)
                    }
                )
                .onPreferenceChange(TrayWidthKey.self) { trayWidth = max(120, $0) }
                .animation(nil, value: model.board.trayMode)

                dockBar
                    .padding(.trailing, 4)
                    .zIndex(10)
            }
        }
        .padding(.top, 8)
        .padding(.bottom, 6)
        .background(glassCard)
    }

    private func listTray(_ unplaced: [PuzzlePieceModel]) -> some View {
        let cols = max(1, Int(ceil(Double(unplaced.count) / Double(PandaTheme.trayRows))))
        return ScrollView(.horizontal, showsIndicators: false) {
            LazyHGrid(
                rows: Array(repeating: GridItem(.fixed(PandaTheme.thumbSize), spacing: 4), count: PandaTheme.trayRows),
                spacing: 4
            ) {
                ForEach(unplaced) { piece in
                    Button { model.selectPiece(piece.id) } label: {
                        JigsawThumbView(
                            piece: piece,
                            selected: model.board.selectedId == piece.id,
                            lowCost: true
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 6)
            .padding(.trailing, 58)
            .frame(width: CGFloat(cols) * (PandaTheme.thumbSize + 4) + 58)
        }
    }

    private func stackTray(_ unplaced: [PuzzlePieceModel]) -> some View {
        let W = trayWidth
        let H = PandaTheme.thumbSize * CGFloat(PandaTheme.trayRows) + 18
        let pad: CGFloat = 12
        // 右侧工具栏是叠在托盘上的，不应再从可用宽度里重复扣除。
        let spanX = max(0, W - PandaTheme.thumbSize - pad * 2 + 42)
        let spanY = max(0, H - PandaTheme.thumbSize - pad * 2)
        let seed = boardSeed(model.board.traySeed)
        // 只维护前面一小段可见队列。放置拼块后，后面的拼块自然补位，
        // 避免大量 ZStack 子视图同时参与布局、阴影和点击命中。
        let visible = Array(unplaced.prefix(Self.stackVisibleLimit))

        return ZStack(alignment: .topLeading) {
            ForEach(Array(visible.enumerated()), id: \.element.id) { _, piece in
                let slot = piece.trayOrder
                let left = pad + hash01(slot, 1, seed) * spanX
                let top = pad + hash01(slot, 2, seed) * spanY
                // 选中后取消叠放倾角，否则拼块自身的 90° 旋转会被随机角度干扰。
                let rot = piece.id == model.board.selectedId
                    ? 0
                    : (hash01(slot, 3, seed) - 0.5) * 40
                let scale = 0.82 + hash01(slot, 5, seed) * 0.26
                let z = piece.id == model.board.selectedId
                    ? 100_000
                    : Int(hash01(slot, 11, seed) * 1000)

                Button { model.selectPiece(piece.id) } label: {
                    JigsawThumbView(
                        piece: piece,
                        selected: model.board.selectedId == piece.id,
                        lowCost: true
                    )
                        .scaleEffect(scale)
                        .rotationEffect(.degrees(rot))
                }
                .buttonStyle(.plain)
                .offset(x: left, y: top)
                .zIndex(Double(z))
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private var dockBar: some View {
        VStack(spacing: 2) {
            toolButton(title: "旋转", systemImage: "rotate.right", action: model.rotateSelected)
            toolButton(
                title: "模式",
                systemImage: model.board.trayMode == .stack ? "square.stack.3d.up.fill" : "square.grid.2x2",
                action: model.toggleTrayMode,
                on: model.board.trayMode == .stack
            )
            toolButton(title: "打乱", systemImage: "shuffle", action: model.scatter)
            toolButton(title: "重来", systemImage: "arrow.counterclockwise", action: model.requestRestart)
        }
        .padding(4)
    }

    private var glassCard: some View {
        RoundedRectangle(cornerRadius: PandaTheme.cardRadius, style: .continuous)
            .fill(PandaTheme.surface)
            .overlay(
                RoundedRectangle(cornerRadius: PandaTheme.cardRadius, style: .continuous)
                    .stroke(PandaTheme.line, lineWidth: 1)
            )
    }

    private func toolButton(
        title: String,
        systemImage: String,
        action: @escaping () -> Void,
        on: Bool = false
    ) -> some View {
        Button(action: action) {
            VStack(spacing: 1) {
                Image(systemName: systemImage)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(on ? PandaTheme.accent : PandaTheme.ink)
                Text(title)
                    .font(.system(size: 9, weight: .heavy))
                    .foregroundStyle(PandaTheme.ink)
            }
            .frame(width: 42, height: 43)
            .background {
                toolButtonGlass
            }
            .overlay {
                if on {
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(PandaTheme.accent.opacity(0.72), lineWidth: 1)
                }
            }
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private var toolButtonGlass: some View {
        let shape = RoundedRectangle(cornerRadius: 12, style: .continuous)
        if #available(iOS 26.0, *) {
            shape.glassEffect(.regular, in: shape)
        } else {
            shape
                .fill(.ultraThinMaterial)
                .overlay {
                    shape.stroke(Color.white.opacity(0.22), lineWidth: 0.8)
                }
        }
    }

    private func flashToast() {
        withAnimation(.easeOut(duration: 0.18)) { toastVisible = true }
        Task {
            try? await Task.sleep(for: .seconds(2.4))
            await MainActor.run {
                withAnimation { toastVisible = false }
            }
        }
    }

    private func playBoardShake() {
        let sequence: [CGFloat] = [0, -10, 10, -7, 7, -3, 0]
        Task { @MainActor in
            for x in sequence {
                withAnimation(.easeInOut(duration: 0.045)) { boardShakeX = x }
                try? await Task.sleep(for: .milliseconds(45))
            }
            boardShakeX = 0
        }
    }

    private func boardSeed(_ seed: Int) -> Double { Double(seed) }

    private func hash01(_ i: Int, _ salt: Int, _ seed: Double) -> CGFloat {
        let x = sin(Double(i + 1) * 12.9898 + (Double(salt) + seed) * 78.233) * 43758.5453
        return CGFloat(x - floor(x))
    }
}

private struct TrayWidthKey: PreferenceKey {
    static var defaultValue: CGFloat = 320
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) { value = nextValue() }
}
