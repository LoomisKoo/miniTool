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
    let title: LocalizedStringKey
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
    @State private var query = ""
    @State private var showReview = false
    @State private var editingMetadata: SavedTicket?
    @State private var presetToOpen: SavedPreset?
    @State private var presetNameDraft = ""
    @State private var presetSource: SavedTicket?
    @State private var pendingDelete: SavedTicket?

    private var visibleItems: [SavedTicket] {
        let text = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !text.isEmpty else { return library.items }
        return library.items.filter {
            $0.title.lowercased().contains(text) ||
            ($0.note ?? "").lowercased().contains(text) ||
            ($0.tags ?? []).contains { $0.lowercased().contains(text) } ||
            ($0.template?.category.rawValue.lowercased().contains(text) ?? false)
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                if !pro.isPro {
                    Button { showPaywall = true } label: { proCard }
                        .buttonStyle(.plain)
                }

                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text("我的作品")
                        .font(.system(size: 17, weight: .bold))
                    Text("\(visibleItems.count)")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(FrameTheme.muted)
                    Spacer()
                    Button("年度合集") { showReview = true }
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(FrameTheme.accent)
                }

                if visibleItems.isEmpty {
                    ContentUnavailableView("还没有作品", systemImage: "bookmark", description: Text("在首页编辑完成后，点击右上角书签保存。"))
                        .padding(.top, 30)
                } else {
                    WorkGrid(items: visibleItems, onRename: { work in
                        nameDraft = work.title
                        renaming = work
                    }, onDelete: { work in
                        pendingDelete = work
                    }, onMetadata: { editingMetadata = $0 }, onPreset: {
                        if pro.isPro {
                            presetSource = $0
                            presetNameDraft = $0.title
                        } else {
                            showPaywall = true
                        }
                    })
                }

                if !library.presets.isEmpty {
                    Text("我的模板")
                        .font(.system(size: 17, weight: .bold))
                        .padding(.top, 6)
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 10) {
                            ForEach(library.presets) { preset in
                                Button {
                                    presetToOpen = preset
                                } label: {
                                    VStack(alignment: .leading, spacing: 6) {
                                        Image(systemName: "rectangle.3.group")
                                            .font(.system(size: 22))
                                            .foregroundStyle(FrameTheme.accent)
                                        Text(preset.name)
                                            .font(.system(size: 12, weight: .semibold))
                                            .lineLimit(1)
                                    }
                                    .frame(width: 112, height: 72, alignment: .leading)
                                    .padding(12)
                                    .background(FrameTheme.surface, in: RoundedRectangle(cornerRadius: 14))
                                }
                                .buttonStyle(.plain)
                                .contextMenu {
                                    Button(role: .destructive) {
                                        library.deletePreset(preset.id)
                                    } label: {
                                        Label("删除模板", systemImage: "trash")
                                    }
                                }
                            }
                        }
                    }
                }
            }
            .padding(.horizontal, 14)
            .padding(.top, 8)
            .padding(.bottom, 24)
        }
        .background(FrameTheme.bg)
        .foregroundStyle(FrameTheme.text)
        .searchable(text: $query, prompt: "搜索作品、标签或地点")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                NavigationLink(value: RootRoute.settings) {
                    Image(systemName: "gearshape")
                }
                .accessibilityLabel("设置")
            }
        }
        .sheet(isPresented: $showPaywall) { PaywallView() }
        .sheet(isPresented: $showReview) { AnnualReviewView() }
        .sheet(item: $editingMetadata) { work in
            WorkMetadataSheet(work: work)
        }
        .sheet(item: $presetToOpen) { preset in
            PresetEditorView(preset: preset)
        }
        .alert("保存为我的模板", isPresented: Binding(
            get: { presetSource != nil },
            set: { if !$0 { presetSource = nil } }
        )) {
            TextField("模板名称", text: $presetNameDraft)
            Button("取消", role: .cancel) {}
            Button("保存") {
                if let source = presetSource {
                    library.savePreset(from: source, name: presetNameDraft.trimmingCharacters(in: .whitespaces))
                }
                presetSource = nil
            }
        } message: {
            Text("模板会保留当前版式、照片、特效和配色")
        }
        .alert("删除作品？", isPresented: Binding(
            get: { pendingDelete != nil },
            set: { if !$0 { pendingDelete = nil } }
        )) {
            Button("取消", role: .cancel) {}
            Button("删除", role: .destructive) {
                if let work = pendingDelete {
                    withAnimation(.spring(duration: 0.4, bounce: 0.12)) {
                        library.delete(work.id)
                    }
                }
                pendingDelete = nil
            }
        } message: {
            Text(pendingDelete?.title ?? AppLocalization.text("这个作品"))
        }
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
                Text(AppLocalization.text(pro.isPro ? "帧藏 Pro 已解锁" : "升级帧藏 Pro"))
                    .font(.system(size: 17, weight: .bold, design: .serif))
                    .foregroundStyle(FrameTheme.accentStrong)
                Text(AppLocalization.text(pro.isPro ? "全部模板与特效均可使用" : "解锁全部高级模板、特效与高清导出"))
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
    let onMetadata: (SavedTicket) -> Void
    let onPreset: (SavedTicket) -> Void

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
                    Button { onMetadata(work) } label: { Label("编辑档案", systemImage: "tag") }
                    Button { onPreset(work) } label: { Label("保存为我的模板", systemImage: "square.and.arrow.down") }
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
                .overlay(alignment: .bottom) {
                    VStack(alignment: .leading, spacing: 3) {
                        LinearGradient(
                            colors: [.clear, .black.opacity(0.78)],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                        .frame(height: 68)
                        .overlay(alignment: .bottomLeading) {
                            VStack(alignment: .leading, spacing: 3) {
                                Text(work.title.isEmpty ? AppLocalization.text("未命名票根") : AppLocalization.text(work.title))
                                    .font(.system(size: 12, weight: .semibold))
                                    .lineLimit(1)
                                HStack(spacing: 4) {
                                    Text(work.template?.displayName ?? AppLocalization.text("模板"))
                                        .lineLimit(1)
                                    Spacer(minLength: 2)
                                    if work.isFavorite == true {
                                        Image(systemName: "heart.fill")
                                            .foregroundStyle(FrameTheme.accent)
                                    }
                                    Text(work.savedAt.formatted(.dateTime.month().day()))
                                }
                                .font(.system(size: 9, weight: .medium))
                                .foregroundStyle(.white.opacity(0.72))
                            }
                            .padding(.horizontal, 10)
                            .padding(.bottom, 9)
                        }
                    }
                }
                .clipped()
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
    @AppStorage("appLanguage") private var appLanguage = "system"

    var body: some View {
        List {
            Section("语言") {
                Picker("界面语言", selection: $appLanguage) {
                    Text("跟随系统").tag("system")
                    Text("中文").tag("zh-Hans")
                    Text("English").tag("en")
                }
                .pickerStyle(.menu)
            }
            .listRowBackground(FrameTheme.surface)
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

    private func row(_ title: LocalizedStringKey, systemImage: String) -> some View {
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

private struct WorkMetadataSheet: View {
    @Environment(WorkLibrary.self) private var library
    @Environment(\.dismiss) private var dismiss
    let work: SavedTicket
    @State private var tags = ""
    @State private var note = ""
    @State private var isFavorite = false

    var body: some View {
        NavigationStack {
            Form {
                Section("收藏") {
                    Toggle("加入收藏", isOn: $isFavorite)
                }
                Section("标签") {
                    TextField("电影、旅行、纪念日（用逗号分隔）", text: $tags)
                }
                Section("备注") {
                    TextEditor(text: $note)
                        .frame(minHeight: 120)
                }
            }
            .scrollContentBackground(.hidden)
            .background(FrameTheme.bg)
            .foregroundStyle(FrameTheme.text)
            .navigationTitle("作品档案")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("取消") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("保存") {
                        let values = tags.split(separator: ",").map {
                            $0.trimmingCharacters(in: .whitespacesAndNewlines)
                        }.filter { !$0.isEmpty }
                        library.updateMetadata(work.id, tags: values, note: note, isFavorite: isFavorite)
                        dismiss()
                    }
                    .fontWeight(.semibold)
                }
            }
        }
        .tint(FrameTheme.accent)
        .presentationDetents([.medium, .large])
        .onAppear {
            tags = (work.tags ?? []).joined(separator: ", ")
            note = work.note ?? ""
            isFavorite = work.isFavorite ?? false
        }
    }
}

private struct AnnualReviewView: View {
    @Environment(WorkLibrary.self) private var library
    @Environment(ProStore.self) private var pro
    @Environment(\.dismiss) private var dismiss
    @State private var year = Calendar.current.component(.year, from: .now)
    @State private var showPaywall = false
    @State private var notice = ""

    private var years: [Int] {
        Array(Set(library.items.map {
            Calendar.current.component(.year, from: $0.savedAt)
        }).union([year])).sorted(by: >)
    }

    private var works: [SavedTicket] {
        library.items.filter {
            Calendar.current.component(.year, from: $0.savedAt) == year
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    Picker("年份", selection: $year) {
                        ForEach(years, id: \.self) { Text(AppLocalization.year($0)).tag($0) }
                    }
                    .pickerStyle(.segmented)

                    VStack(alignment: .leading, spacing: 6) {
                        Text(AppLocalization.memoriesTitle(year))
                            .font(.system(size: 28, weight: .bold, design: .serif))
                        Text(AppLocalization.ticketsThisYear(works.count))
                            .foregroundStyle(FrameTheme.textSecondary)
                    }

                    Button {
                        if pro.isPro {
                            exportPoster()
                        } else {
                            showPaywall = true
                        }
                    } label: {
                        Label("导出年度合集海报 · Pro", systemImage: "square.and.arrow.up")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(FrameTheme.accent)

                    if !notice.isEmpty {
                        Text(notice)
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(FrameTheme.accent)
                    }

                    if works.isEmpty {
                        ContentUnavailableView("这一年还没有作品", systemImage: "calendar")
                            .frame(maxWidth: .infinity)
                            .padding(.top, 40)
                    } else {
                        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                            ForEach(works) { work in
                                WorkCard(work: work)
                            }
                        }
                    }
                }
                .padding(20)
            }
            .background(FrameTheme.bg)
            .foregroundStyle(FrameTheme.text)
            .navigationTitle("年度合集")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("完成") { dismiss() }
                }
            }
        }
        .tint(FrameTheme.accent)
        .presentationBackground(FrameTheme.panel)
        .sheet(isPresented: $showPaywall) {
            PaywallView()
        }
    }

    private func exportPoster() {
        guard !works.isEmpty else {
            notice = AppLocalization.text("这一年还没有可导出的作品")
            return
        }
        let renderer = ImageRenderer(content:
            ReviewPoster(year: year, works: Array(works.prefix(12)))
                .frame(width: 1200)
                .padding(56)
                .background(FrameTheme.bg)
        )
        renderer.scale = 2
        if let image = renderer.uiImage {
            UIImageWriteToSavedPhotosAlbum(image, nil, nil, nil)
            notice = AppLocalization.text("年度合集已保存到相册")
        } else {
            notice = AppLocalization.text("导出失败，请重试")
        }
    }
}

private struct ReviewPoster: View {
    let year: Int
    let works: [SavedTicket]

    var body: some View {
        VStack(alignment: .leading, spacing: 30) {
            Text("\(year)")
                .font(.system(size: 96, weight: .bold, design: .serif))
                .foregroundStyle(FrameTheme.accentStrong)
            Text("MY MEMORY TICKETS")
                .font(.system(size: 20, weight: .bold, design: .monospaced))
                .tracking(3)
                .foregroundStyle(FrameTheme.textSecondary)
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 24) {
                ForEach(works) { work in
                    VStack(alignment: .leading, spacing: 10) {
                        H5TicketView()
                            .environment(\.ticket, TicketContext(
                                template: work.template ?? TicketCatalog.templates[0],
                                fields: work.fields,
                                photos: [work.photoData.flatMap(UIImage.init(data:))],
                                photoScale: work.photoScale ?? 1,
                                photoOffset: work.photoOffset ?? .zero
                            ))
                            .frame(height: 250)
                            .clipped()
                        Text(work.title)
                            .font(.system(size: 18, weight: .semibold))
                            .lineLimit(1)
                    }
                }
            }
        }
        .foregroundStyle(FrameTheme.text)
    }
}

private struct PresetEditorView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var store: TicketStore
    let preset: SavedPreset

    init(preset: SavedPreset) {
        self.preset = preset
        _store = State(initialValue: TicketStore(preset: preset))
    }

    var body: some View {
        NavigationStack {
            EditorView()
                .environment(store)
                .toolbar {
                    ToolbarItem(placement: .topBarLeading) {
                        Button("关闭") { dismiss() }
                    }
                }
        }
    }
}
