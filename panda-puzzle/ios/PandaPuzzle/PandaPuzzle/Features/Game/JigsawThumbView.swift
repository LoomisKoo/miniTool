import SwiftUI

struct JigsawThumbView: View {
    let piece: PuzzlePieceModel
    var selected = false
    var lowCost = false

    var body: some View {
        // 轮廓用原始 tabs，朝向只靠 rotationEffect，避免「先跳形状再转」
        ZStack {
            if selected && !lowCost {
                // 用 CGPath 的等距扩张生成外轮廓，不能用 scaleEffect；
                // scale 会让凹陷、凸起和直边的间距不一致。
                JigsawSelectionGapShape(tabs: piece.tabs, gap: 2)
                    .fill(PandaTheme.accent)
                    .frame(
                        width: PandaTheme.thumbSize - 4,
                        height: PandaTheme.thumbSize - 4
                    )
            }
            Image(uiImage: piece.image)
                .resizable()
                .scaledToFill()
                .frame(width: PandaTheme.thumbSize - 4, height: PandaTheme.thumbSize - 4)
                .clipShape(JigsawPieceShape(tabs: piece.tabs))
                .overlay {
                    if !selected {
                        JigsawPieceShape(tabs: piece.tabs)
                            .stroke(Color.white.opacity(0.14), lineWidth: 1)
                    }
                }
        }
            .rotationEffect(.degrees(Double(piece.rotationSteps) * 90))
            .frame(width: PandaTheme.thumbSize, height: PandaTheme.thumbSize)
            .background {
                if selected && lowCost {
                    // background 放在 rotationEffect 之后，隔离底板保持水平。
                    RoundedRectangle(cornerRadius: 9, style: .continuous)
                        .fill(Color.black.opacity(0.32))
                        .shadow(color: .black.opacity(0.55), radius: 5, y: 2)
                }
            }
            .overlay {
                if selected && lowCost {
                    // 放在 rotationEffect 之后，选中框保持水平不旋转。
                    RoundedRectangle(cornerRadius: 7, style: .continuous)
                        .stroke(PandaTheme.accent, lineWidth: 1.25)
                        .padding(2)
                }
            }
            .scaleEffect(1)
            .shadow(
                color: lowCost
                    ? .black.opacity(selected ? 0.34 : 0.22)
                    : .black.opacity(selected ? 0.5 : 0.38),
                radius: lowCost ? (selected ? 4 : 2) : (selected ? 8 : 5),
                x: 0,
                y: lowCost ? 1 : (selected ? 4 : 3)
            )
            .shadow(color: lowCost ? .clear : .black.opacity(0.12), radius: lowCost ? 0 : 1.5, y: 1)
            .animation(.spring(response: 0.2, dampingFraction: 0.78), value: selected)
    }
}

/// 沿拼图轮廓生成等距外扩的空心边框。
/// 与 scaleEffect 不同，凹陷和凸起不会被整体放大，因此间距一致。
private struct JigsawSelectionGapShape: Shape {
    let tabs: PieceTabs
    let gap: CGFloat

    func path(in rect: CGRect) -> Path {
        let base = JigsawPieceShape(tabs: tabs).path(in: rect)
        let outer = base.cgPath.copy(
            strokingWithWidth: gap * 2,
            lineCap: .round,
            lineJoin: .round,
            miterLimit: 2,
            transform: .identity
        )
        // copy(strokingWithWidth:) 本身已经包含内外两条边界；
        // 不再把本体路径追加进去，否则偶数填充会把本体一起填色。
        return Path(outer)
    }
}

/// 与 H5 一致：所有拼块共用「四边都凸」的标尺缩放，主体大小一致。
struct JigsawPieceShape: Shape {
    let tabs: PieceTabs
    private static let sharedHalf: CGFloat = 0.5
    private static let sharedRadius: CGFloat = {
        let path = JigsawGeometry.piecePath(
            hw: sharedHalf,
            tabs: PieceTabs(top: 1, right: 1, bottom: 1, left: 1),
            knobSamples: 10
        )
        let b = path.bounds
        return max(abs(b.minX), abs(b.maxX), abs(b.minY), abs(b.maxY), sharedHalf)
    }()

    func path(in rect: CGRect) -> Path {
        let bezier = JigsawGeometry.piecePath(hw: Self.sharedHalf, tabs: tabs, knobSamples: 8)
        let box = bezier.bounds
        guard box.width > 0, box.height > 0 else { return Path() }
        let margin: CGFloat = 0.08
        let avail = min(rect.width, rect.height) * (1 - margin)
        let s = avail / (Self.sharedRadius * 2)
        var t = CGAffineTransform.identity
        t = t.translatedBy(x: rect.midX, y: rect.midY)
        t = t.scaledBy(x: s, y: s)
        t = t.translatedBy(x: -box.midX, y: -box.midY)
        return Path(bezier.cgPath).applying(t)
    }
}
