import SwiftUI

/// 手绘编辑页：由预览条上的「编辑」按钮以 `NavigationLink` **推出来的子页**
/// （各自 tab 内的 `NavigationStack`）。
///
/// 顶栏用**系统导航栏**：左上系统返回、中间标题、右上蓝色填充打钩完成。
///
/// 编辑状态仍然记在 `model.isEditing` 上：进出跟着栈的路径走（`BeadRootView` 的
/// `onChange(of: path)`），本页只做兜底；模型是同一个（`BeadRootView` 持有），
/// 所以落笔改的就是主页面那张图纸，退回后预览立刻是新样子。
///
/// **不**再藏底部 tab：进出编辑若藏/露 tab，底下生成页预览高度会变一截，退栈时跳一下。
struct BeadEditView: View {
    @Bindable var model: BeadEditorModel

    @Environment(\.dismiss) private var dismiss

    /// 复位请求：+1 让预览区重新适配。
    @State private var resetToken = 0
    @State private var showBrush = false

    var body: some View {
        VStack(spacing: 0) {
            BeadPreviewPane(model: model, resetToken: resetToken)
                .overlay(alignment: .bottom) { BeadHintBanner(hint: model.hint) }
                .padding(.horizontal, 16)
                .padding(.top, BeadSpace.sm)
                .frame(maxWidth: .infinity, maxHeight: .infinity)

            tools
                .padding(.horizontal, 16)
                .padding(.top, BeadSpace.sm)
                .padding(.bottom, BeadSpace.md)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background {
            BeadTheme.parchmentGradient.ignoresSafeArea()
        }
        .navigationTitle("编辑".loc)
        .navigationBarTitleDisplayMode(.inline)
        // 拼豆栈根收起了导航栏；本页要显式拉回来，系统返回键才出现。
        .toolbar(.visible, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .toolbarBackground(BeadTheme.parchment.opacity(0.8), for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    dismiss()
                } label: {
                    Image(systemName: "checkmark")
                        .font(.system(size: 14, weight: .bold))
                }
                // 系统填充按钮：蓝的是**按钮底**，不是给图标单独套圆。
                .buttonStyle(.borderedProminent)
                .tint(BeadTheme.primary)
                .accessibilityLabel("完成".loc)
            }
        }
        // 进页面必须处于编辑态（3D 下顺带切回 2D）。正常情况下 `BeadRootView` 的
        // `onChange(of: path)` 在 push 时就切好了，这里兜底；带判断所以重复调用不会把
        // 画笔工具复位、提示重播。
        .onAppear { if !model.isEditing { model.setEditing(true) } }
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
                    BeadChip(title: "复位".loc) { resetToken += 1 }
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
        .buttonStyle(.automatic)
    }
}

#Preview {
    NavigationStack {
        BeadEditView(model: BeadEditorModel())
    }
}
