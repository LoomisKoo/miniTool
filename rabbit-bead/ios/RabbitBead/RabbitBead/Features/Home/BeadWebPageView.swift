import Foundation
import SwiftUI
import WebKit

/// 内嵌网页的目标：标题 + 地址。
///
/// `Hashable` 是为了能进 `BeadRoute`（关于页的隐私政策 / 支持两条都走一条 push 路由）。
struct BeadWebPage: Hashable {
    let title: String
    let url: URL
}

/// 内嵌网页页（隐私政策 / 支持与反馈）。
///
/// **不再用 `Link` 甩到 Safari**：这两页是 App Store 审核要看的材料，点开却跳出 App
/// 再切回来，体验断一截（Safari 里还没有返回 App 的按钮）。这里用 `WKWebView` 内嵌，
/// 顶栏就是本页标题 + 一个「在浏览器打开」的兜底出口。
///
/// 页面本身是自家静态站，`color-scheme: light dark` 跟着系统走，所以深色下不会白屏。
struct BeadWebPageView: View {
    let page: BeadWebPage

    @Environment(\.openURL) private var openURL
    @State private var status: LoadStatus = .loading
    /// 「重试」靠推进这个 token 触发 —— `WKWebView` 在 `UIViewRepresentable` 里只是
    /// 一个 UIView，命令式的 `reload()` 没法直接喊，推进 token 让 `updateUIView` 去发。
    @State private var reloadToken = 0

    private enum LoadStatus: Equatable {
        case loading
        case loaded
        case failed
    }

    var body: some View {
        ZStack {
            BeadWebViewRepresentable(
                url: page.url,
                reloadToken: reloadToken,
                onLoading: { status = .loading },
                onLoaded: { status = .loaded },
                onFailed: { status = .failed }
            )
            // 网页没加载出来之前不要露白底，深色下会闪一下。
            .opacity(status == .loaded ? 1 : 0)
            .background(BeadTheme.parchment.ignoresSafeArea())

            if status != .loaded {
                stateOverlay
            }
        }
        .navigationTitle(page.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(.visible, for: .navigationBar)
        .toolbarBackground(BeadTheme.parchment.opacity(0.8), for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                // 兜底出口：网页里要点开外部站点、或者内嵌就是打不开（公司网络、
                // 拦截类 App）时，还能用系统浏览器看。
                Button {
                    openURL(page.url)
                } label: {
                    Image(systemName: "safari")
                        .font(.system(size: 16, weight: .regular))
                }
                .accessibilityLabel("在浏览器打开".loc)
            }
        }
    }

    /// 加载中转圈 / 失败给出口。网页加载完成后整块收掉（`WKWebView` 是白的，
    /// 留一层浮在上面会挡住页面自己的滚动内容）。
    @ViewBuilder
    private var stateOverlay: some View {
        if status == .loading {
            ProgressView()
                .tint(BeadTheme.primary)
        } else {
            VStack(spacing: BeadSpace.sm) {
                Image(systemName: "wifi.exclamationmark")
                    .font(.system(size: 30, weight: .light))
                    .foregroundStyle(BeadTheme.inkMuted48)
                Text("无法打开页面".loc)
                    .beadBodyStrong()
                    .foregroundStyle(BeadTheme.ink)
                Text("检查网络后重试".loc)
                    .beadFinePrint()
                    .foregroundStyle(BeadTheme.inkMuted48)
                    .multilineTextAlignment(.center)

                HStack(spacing: BeadSpace.sm) {
                    BeadButton(title: "重试".loc, kind: .primary, systemImage: "arrow.clockwise") {
                        status = .loading
                        reloadToken += 1
                    }
                    BeadButton(title: "在浏览器打开".loc, kind: .pearl, systemImage: "safari") {
                        openURL(page.url)
                    }
                }
                .padding(.top, BeadSpace.xxs)
            }
            .padding(.horizontal, BeadSpace.lg)
        }
    }
}

// MARK: - WKWebView 包装

/// `WKWebView` 的 `UIViewRepresentable` 薄包装：只做加载 + 三态回调。
///
/// 回调**不放进 `Coordinator` 持有的那个 struct**（`UIViewRepresentable` 每次刷新都会
/// 重建它，`Coordinator` 里那份就成了旧的），而是每次 `updateUIView` 重新灌一遍。
private struct BeadWebViewRepresentable: UIViewRepresentable {
    let url: URL
    let reloadToken: Int
    let onLoading: () -> Void
    let onLoaded: () -> Void
    let onFailed: () -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(
            reloadToken: reloadToken,
            onLoading: onLoading,
            onLoaded: onLoaded,
            onFailed: onFailed
        )
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.allowsInlineMediaPlayback = true

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        // 网页里跳到别的站（比如从隐私政策点进 GitHub）后，能左右滑回到上一页。
        webView.allowsBackForwardNavigationGestures = true
        webView.load(URLRequest(url: url))
        context.coordinator.loadedToken = reloadToken
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        context.coordinator.onLoading = onLoading
        context.coordinator.onLoaded = onLoaded
        context.coordinator.onFailed = onFailed

        // 只有「重试」会推进 token；平时每次刷新都 `load` 会让页面反复重载。
        guard context.coordinator.loadedToken != reloadToken else { return }
        context.coordinator.loadedToken = reloadToken
        webView.load(URLRequest(url: url))
    }

    final class Coordinator: NSObject, WKNavigationDelegate {
        /// 已经发起过加载的 token，`updateUIView` 靠它区分「状态刷新」和「点了重试」。
        var loadedToken: Int
        var onLoading: () -> Void
        var onLoaded: () -> Void
        var onFailed: () -> Void

        init(
            reloadToken: Int,
            onLoading: @escaping () -> Void,
            onLoaded: @escaping () -> Void,
            onFailed: @escaping () -> Void
        ) {
            self.loadedToken = reloadToken
            self.onLoading = onLoading
            self.onLoaded = onLoaded
            self.onFailed = onFailed
        }

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            onLoading()
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            onLoaded()
        }

        // 失败有两条路：连不上（provisional，DNS/超时/被拦）和连上后中断。
        func webView(
            _ webView: WKWebView,
            didFailProvisionalNavigation navigation: WKNavigation!,
            withError error: Error
        ) {
            onFailed()
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            onFailed()
        }
    }
}
