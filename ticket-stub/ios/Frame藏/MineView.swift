import ImageIO
import SwiftUI
import UIKit
import WebKit

enum AppLinks {
    /// 与 App Store Connect 里填写的隐私政策 / 支持网址同源（FrameZang-pages 仓库）
    static let privacy = URL(string: "https://loomiskoo.github.io/FrameZang-pages/privacy.html")!
    static let support = URL(string: "https://loomiskoo.github.io/FrameZang-pages/support.html")!
}

private let gold = FrameTheme.accent

/// 纯内容网页：只展示 HTML，不带浏览器工具栏
private struct WebPageView: View {
    let title: String
    let url: URL
    @State private var isLoading = true

    var body: some View {
        WebContent(url: url, isLoading: $isLoading)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(FrameTheme.bg.ignoresSafeArea())
            .ignoresSafeArea(edges: .bottom)
            .overlay { if isLoading { ProgressView() } }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar(.hidden, for: .tabBar)
            .toolbarBackground(.ultraThinMaterial, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
    }
}

private struct WebContent: UIViewRepresentable {
    let url: URL
    @Binding var isLoading: Bool

    func makeCoordinator() -> Coordinator { Coordinator(isLoading: $isLoading) }

    /// 当作静态文档：禁止选择/长按菜单/缩放，隐藏与导航栏重复的首个标题
    private static let staticStyle = """
    var style = document.createElement('style');
    style.textContent = '* { -webkit-user-select: none; -webkit-touch-callout: none; } html, body { min-height: 100%; background: #0e0e10 !important; } .zh { color: #ededee !important; } body > h1:first-of-type { display: none; }';
    document.head.appendChild(style);
    var meta = document.createElement('meta');
    meta.name = 'viewport';
    meta.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no';
    document.head.appendChild(meta);
    """

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.userContentController.addUserScript(
            WKUserScript(source: Self.staticStyle, injectionTime: .atDocumentEnd, forMainFrameOnly: true)
        )
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.isOpaque = false
        webView.backgroundColor = UIColor(FrameTheme.bg)
        webView.scrollView.backgroundColor = UIColor(FrameTheme.bg)
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.allowsLinkPreview = false
        webView.scrollView.pinchGestureRecognizer?.isEnabled = false
        webView.scrollView.bouncesZoom = false
        webView.load(URLRequest(url: url))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate {
        @Binding var isLoading: Bool
        init(isLoading: Binding<Bool>) { _isLoading = isLoading }

        func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard action.navigationType == .linkActivated, let url = action.request.url else { return decisionHandler(.allow) }
            if url.scheme == "mailto" {
                UIApplication.shared.open(url)
                return decisionHandler(.cancel)
            }
            // 只允许在同一站点的文档之间跳转（支持页 ↔ 隐私政策）
            decisionHandler(url.host == webView.url?.host ? .allow : .cancel)
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { isLoading = false }
        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { isLoading = false }
        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { isLoading = false }
    }
}

struct MineView: View {
    @Environment(WorkLibrary.self) private var library
    @Environment(ProStore.self) private var pro
    @State private var showPaywall = false
    @State private var renaming: SavedTicket?
    @State private var nameDraft = ""

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Button { showPaywall = true } label: { proCard }
                    .buttonStyle(.plain)

                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text("我的作品")
                        .font(.system(size: 17, weight: .bold))
                    Text("\(library.items.count)")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(FrameTheme.muted)
                }

                if library.items.isEmpty {
                    ContentUnavailableView("还没有作品", systemImage: "bookmark", description: Text("在首页编辑完成后，点击右上角书签保存。"))
                        .padding(.top, 30)
                } else {
                    WorkGrid(items: library.items, onRename: { work in
                        nameDraft = work.title
                        renaming = work
                    }, onDelete: { work in
                        withAnimation(.spring(duration: 0.4, bounce: 0.12)) { library.delete(work.id) }
                    })
                }
            }
            .padding(.horizontal, 14)
            .padding(.top, 8)
            .padding(.bottom, 24)
        }
        .background(FrameTheme.bg)
        .foregroundStyle(FrameTheme.text)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                NavigationLink(value: RootRoute.settings) {
                    Image(systemName: "gearshape")
                }
                .accessibilityLabel("设置")
            }
        }
        .sheet(isPresented: $showPaywall) { PaywallView() }
        .alert("重命名", isPresented: Binding(get: { renaming != nil }, set: { if !$0 { renaming = nil } })) {
            TextField("作品名称", text: $nameDraft)
            Button("取消", role: .cancel) {}
            Button("保存") {
                let name = nameDraft.trimmingCharacters(in: .whitespaces)
                if let id = renaming?.id, !name.isEmpty { library.rename(id, to: name) }
            }
        }
    }

    private var proCard: some View {
        HStack(spacing: 14) {
            Image(systemName: pro.isPro ? "crown.fill" : "crown")
                .font(.system(size: 22, weight: .semibold))
                .foregroundStyle(FrameTheme.onAccent)
                .frame(width: 48, height: 48)
                .background(FrameTheme.accentGradient, in: Circle())
            VStack(alignment: .leading, spacing: 4) {
                Text(pro.isPro ? "帧藏 Pro 已解锁" : "升级帧藏 Pro")
                    .font(.system(size: 17, weight: .bold, design: .serif))
                    .foregroundStyle(FrameTheme.accentStrong)
                Text(pro.isPro ? "全部模板与特效均可使用" : "解锁全部高级模板、特效与高清导出")
                    .font(.system(size: 13))
                    .foregroundStyle(FrameTheme.textSecondary)
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.right")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(FrameTheme.muted)
        }
        .padding(16)
        .background(
            LinearGradient(colors: [FrameTheme.accentDim, FrameTheme.surface], startPoint: .topLeading, endPoint: .bottomTrailing),
            in: RoundedRectangle(cornerRadius: 20, style: .continuous)
        )
        .background(FrameTheme.surface, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(FrameTheme.accentLine.opacity(0.6), lineWidth: 1))
        .contentShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
    }
}

/// 两列瀑布流（参考小红书「我的笔记」）
private struct WorkGrid: View {
    let items: [SavedTicket]
    let onRename: (SavedTicket) -> Void
    let onDelete: (SavedTicket) -> Void

    private let spacing: CGFloat = 10

    var body: some View {
        MasonryLayout(columns: 2, spacing: spacing) {
            ForEach(items) { work in
                NavigationLink(value: RootRoute.work(work.id)) {
                    WorkCard(work: work)
                }
                .buttonStyle(.plain)
                .contextMenu {
                    Button { onRename(work) } label: { Label("重命名", systemImage: "pencil") }
                    Button(role: .destructive) { onDelete(work) } label: { Label("删除", systemImage: "trash") }
                }
                // 移除必须立即脱离视图树，长按菜单预览才会原地消失而不是飞回原位
                .transition(.asymmetric(insertion: .scale(scale: 0.6).combined(with: .opacity), removal: .identity))
            }
        }
    }
}

/// 单个 ForEach 的瀑布流布局：删除/新增时其余卡片平滑移位而不是跨列重建
private struct MasonryLayout: Layout {
    var columns: Int
    var spacing: CGFloat

    private func frames(width: CGFloat, subviews: Subviews) -> (frames: [CGRect], height: CGFloat) {
        let colWidth = (width - spacing * CGFloat(columns - 1)) / CGFloat(columns)
        var heights = Array(repeating: CGFloat(0), count: columns)
        var frames: [CGRect] = []
        for view in subviews {
            let col = heights.indices.min { heights[$0] < heights[$1] } ?? 0
            let size = view.sizeThatFits(ProposedViewSize(width: colWidth, height: nil))
            let y = heights[col] == 0 ? 0 : heights[col] + spacing
            frames.append(CGRect(x: CGFloat(col) * (colWidth + spacing), y: y, width: colWidth, height: size.height))
            heights[col] = y + size.height
        }
        return (frames, heights.max() ?? 0)
    }

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? 360
        return CGSize(width: width, height: frames(width: width, subviews: subviews).height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = frames(width: bounds.width, subviews: subviews)
        for (view, frame) in zip(subviews, result.frames) {
            view.place(
                at: CGPoint(x: bounds.minX + frame.minX, y: bounds.minY + frame.minY),
                proposal: ProposedViewSize(width: frame.width, height: frame.height)
            )
        }
    }
}

struct WorkCard: View {
    let work: SavedTicket
    @State private var loadedKey: String?
    @Environment(\.displayScale) private var displayScale

    /// 封面高宽比，限制在 3:4 ~ 4:3 之间，避免过长或过扁
    static func coverRatio(for work: SavedTicket) -> CGFloat {
        guard let size = work.template?.size else { return 1 }
        return min(max(size.height / size.width, 0.75), 1.34)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            FrameTheme.thumbBackdrop
                .aspectRatio(1 / Self.coverRatio(for: work), contentMode: .fit)
                .overlay { cover.padding(12) }
                .clipped()
            VStack(alignment: .leading, spacing: 5) {
                Text(work.title.isEmpty ? "未命名票根" : work.title)
                    .font(.system(size: 14, weight: .semibold))
                    .lineLimit(2)
                HStack(spacing: 4) {
                    Text(work.template?.name ?? "模板")
                        .lineLimit(1)
                    Spacer(minLength: 4)
                    Text(work.savedAt.formatted(.dateTime.month().day()))
                }
                .font(.system(size: 11))
                .foregroundStyle(FrameTheme.muted)
            }
            .padding(.horizontal, 10)
            .padding(.top, 8)
            .padding(.bottom, 10)
        }
        .foregroundStyle(FrameTheme.text)
        .background(FrameTheme.surface, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(FrameTheme.line, lineWidth: 1))
        .contentShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    @ViewBuilder
    private var cover: some View {
        let _ = loadedKey
        if let image = WorkThumbnails.cached(work) {
            Image(uiImage: image)
                .resizable()
                .scaledToFit()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .shadow(color: .black.opacity(0.35), radius: 8, y: 4)
                .transition(.opacity)
                .allowsHitTesting(false)
        } else {
            Color.clear
                .task(id: WorkThumbnails.key(for: work)) {
                    guard await WorkThumbnails.image(for: work, displayScale: displayScale) != nil else { return }
                    withAnimation(.easeOut(duration: 0.2)) { loadedKey = WorkThumbnails.key(for: work) }
                }
        }
    }
}

/// 作品封面缩略图：异步解码照片 + ImageRenderer 渲染一次后缓存，避免列表里实时渲染整张票根
@MainActor
enum WorkThumbnails {
    private static let cache = NSCache<NSString, UIImage>()
    private static let pointWidth: CGFloat = 200

    static func key(for work: SavedTicket) -> String {
        "\(work.id.uuidString)-\(work.savedAt.timeIntervalSinceReferenceDate)"
    }

    static func cached(_ work: SavedTicket) -> UIImage? {
        cache.object(forKey: key(for: work) as NSString)
    }

    static func image(for work: SavedTicket, displayScale: CGFloat) async -> UIImage? {
        let key = key(for: work) as NSString
        if let hit = cache.object(forKey: key) { return hit }
        guard let template = work.template else { return nil }

        let data = work.photoData
        let photo = await Task.detached(priority: .userInitiated) {
            data.flatMap { downsample($0, maxPixel: 900) }
        }.value
        await Task.yield()
        if let hit = cache.object(forKey: key) { return hit }

        let size = template.size
        let renderer = ImageRenderer(content:
            H5TicketView()
                .frame(width: size.width, height: size.height)
                .environment(\.ticket, TicketContext(
                    template: template,
                    fields: work.fields,
                    photos: [photo],
                    photoScale: work.photoScale ?? 1,
                    photoOffset: work.photoOffset ?? .zero
                ))
        )
        renderer.scale = displayScale * min(1, pointWidth / max(size.width, size.height))
        guard let image = renderer.uiImage else { return nil }
        cache.setObject(image, forKey: key)
        return image
    }

    nonisolated private static func downsample(_ data: Data, maxPixel: CGFloat) -> UIImage? {
        guard let source = CGImageSourceCreateWithData(data as CFData, [kCGImageSourceShouldCache: false] as CFDictionary) else { return nil }
        let options = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceShouldCacheImmediately: true,
            kCGImageSourceThumbnailMaxPixelSize: maxPixel,
        ] as CFDictionary
        guard let cgImage = CGImageSourceCreateThumbnailAtIndex(source, 0, options) else { return nil }
        return UIImage(cgImage: cgImage)
    }
}

struct SettingsView: View {
    @Environment(ProStore.self) private var pro
    var body: some View {
        List {
            Section("购买") {
                Button {
                    Task { await pro.restore() }
                } label: {
                    row("恢复购买", systemImage: "arrow.clockwise")
                }
            }
            .listRowBackground(FrameTheme.surface)
            Section("支持") {
                NavigationLink { WebPageView(title: "隐私政策", url: AppLinks.privacy) } label: {
                    row("隐私政策", systemImage: "hand.raised")
                }
                NavigationLink { WebPageView(title: "支持与反馈", url: AppLinks.support) } label: {
                    row("支持与反馈", systemImage: "questionmark.circle")
                }
            }
            .listRowBackground(FrameTheme.surface)
            Section {
                LabeledContent("版本", value: Self.version)
            } footer: {
                Text("所有作品仅保存在本机，不会上传到任何服务器。")
                    .foregroundStyle(FrameTheme.muted)
            }
            .listRowBackground(FrameTheme.surface)
        }
        .scrollContentBackground(.hidden)
        .background(FrameTheme.bg)
        .foregroundStyle(FrameTheme.text)
        .navigationTitle("设置")
        .navigationBarTitleDisplayMode(.inline)
        .alert("提示", isPresented: Binding(get: { pro.errorMessage != nil }, set: { if !$0 { pro.errorMessage = nil } })) {
            Button("好", role: .cancel) {}
        } message: {
            Text(pro.errorMessage ?? "")
        }
    }

    private func row(_ title: String, systemImage: String) -> some View {
        Label {
            Text(title).foregroundStyle(FrameTheme.text)
        } icon: {
            Image(systemName: systemImage).foregroundStyle(FrameTheme.accent)
        }
    }

    private static var version: String {
        let info = Bundle.main.infoDictionary
        let short = info?["CFBundleShortVersionString"] as? String ?? "1.0"
        let build = info?["CFBundleVersion"] as? String ?? "1"
        return "\(short) (\(build))"
    }
}
