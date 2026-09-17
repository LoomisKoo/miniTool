import SwiftUI

/// 手绘编辑页：从预览条上的「编辑」按钮**换到的独立页面**（在「拼豆」tab 内整体换页，
/// 不是弹一层 cover —— 底部 tab 要一直在，见 `BeadRootView`）。
///
/// 编辑状态仍然记在 `model.isEditing` 上：进来置 true（在 3D 下顺带切回 2D），
/// 退出置 false。模型是同一个（`BeadRootView` 持有），所以落笔改的就是主页面那张
/// 图纸，退回后预览立刻是新样子。
struct BeadEditView: View {
    @Bindable var model: BeadEditorModel
    /// 「完成」：由调用方把页面换回生成页。
    let onClose: () -> Void

    /// 复位请求：+1 让预览区重新适配。
    @State private var resetToken = 0
    @State private var showBrush = false

    var body: some View {
        VStack(spacing: 0) {
            header

            BeadPreviewPane(model: model, resetToken: resetToken)
                .overlay(alignment: .bottom) { BeadHintBanner(hint: model.hint) }
                .padding(.horizontal, 16)
                .frame(maxWidth: .infinity, maxHeight: .infinity)

            tools
                .padding(.horizontal, 16)
                .padding(.top, BeadSpace.sm)
                .padding(.bottom, BeadSpace.md)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background {
            BeadTheme.parchment.ignoresSafeArea()
        }
        // 进页面必须处于编辑态（3D 下顺带切回 2D）。调用方 `openEdit()` 已经切好了，
        // 这里只是兜底 —— 重复调用会把画笔工具复位、提示重播一遍。
        .onAppear { if !model.isEditing { model.setEditing(true) } }
        // 退出时收尾（`完成` 只负责换页，状态收口统一放这里，幂等）。
        .onDisappear { if model.isEditing { model.setEditing(false) } }
        .sheet(isPresented: $showBrush) {
            BeadBrushSheet(
                palette: model.palette,
                counts: model.usageCounts,
                selectedCode: model.brushCode
            ) { code in
                model.setBrush(code)
            }
        }
    }

    // MARK: - 顶栏

    /// 自绘顶栏而不是导航栏：本页在「拼豆」tab 内换页，套一层 `NavigationStack`
    /// 会连带改安全区、把预览区挤一下（生成页特意没有导航栏，见 `BeadRootView`）。
    private var header: some View {
        ZStack {
            Text("编辑".loc)
                .beadBodyStrong()
                .foregroundStyle(BeadTheme.ink)

            HStack(spacing: BeadSpace.xs) {
                Button {
                    resetToken += 1
                } label: {
                    Image(systemName: "arrow.counterclockwise")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(BeadTheme.inkMuted80)
                        .frame(width: 32, height: 32)
                        .contentShape(Rectangle())
                }
                .buttonStyle(BeadPressStyle(pressedScale: 0.94))
                .accessibilityLabel("复位".loc)

                Spacer(minLength: 0)

                Button("完成".loc) {
                    onClose()
                }
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(BeadTheme.primary)
                .frame(height: 32)
                .contentShape(Rectangle())
                .buttonStyle(BeadPressStyle(pressedScale: 0.94))
            }
        }
        .frame(height: 44)
        .padding(.horizontal, 16)
    }

    // MARK: - 工具条

    /// 与原来页内那条一样的两排芯片，只是独占一页、不再和生成参数抢位置。
    private var tools: some View {
        BeadGroup {
            VStack(spacing: BeadSpace.xs) {
                HStack(spacing: 6) {
                    ForEach(EditTool.allCases) { tool in
                        BeadChip(title: tool.label, selected: model.tool == tool) {
                            model.setTool(tool)
                        }
                    }
                    brushChip
                }

                HStack(spacing: 6) {
                    BeadChip(title: "撤销".loc) { model.undo() }
                        .opacity(model.canUndo ? 1 : 0.36)
                        .disabled(!model.canUndo)
                    BeadChip(title: "重做".loc) { model.redo() }
                        .opacity(model.canRedo ? 1 : 0.36)
                        .disabled(!model.canRedo)
                    BeadChip(title: "清空手绘".loc) { model.clearHandEdits() }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, BeadSpace.sm)
        }
    }

    /// 当前画笔豆色，点开选色面板。
    private var brushChip: some View {
        Button {
            showBrush = true
        } label: {
            HStack(spacing: 6) {
                BeadSwatch(color: model.brush?.rgb.swiftUIColor ?? .clear, size: 15)
                Text(model.brush?.code ?? "选色".loc)
                    .beadCaption()
                    .foregroundStyle(BeadTheme.inkMuted80)
                    .monospacedDigit()
                    .lineLimit(1)
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 14)
            .frame(height: 34)
            .frame(maxWidth: .infinity)
            .background(BeadTheme.pearl, in: Capsule())
            .overlay { Capsule().strokeBorder(BeadTheme.hairline, lineWidth: 1) }
        }
        .buttonStyle(BeadPressStyle(pressedScale: 0.96))
    }
}

#Preview {
    BeadEditView(model: BeadEditorModel(), onClose: {})
}
