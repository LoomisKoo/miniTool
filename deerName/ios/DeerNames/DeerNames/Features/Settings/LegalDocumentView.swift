import SwiftUI
import WebKit

enum LegalDocument: String, Identifiable {
    case privacy
    case support

    var id: String { rawValue }

    var title: String {
        switch self {
        case .privacy: return L10n.t("隐私政策")
        case .support: return L10n.t("支持文档")
        }
    }

    /// 与 App Store Connect、`deerName/ios/APPSTORE.md`、GitHub Pages 仓库根目录 HTML 同源。
    var url: URL {
        switch self {
        case .privacy:
            return URL(string: "https://loomiskoo.github.io/DeerNames-pages/privacy.html")!
        case .support:
            return URL(string: "https://loomiskoo.github.io/DeerNames-pages/support.html")!
        }
    }
}

struct LegalDocumentView: View {
    let document: LegalDocument

    var body: some View {
        LegalWebView(url: document.url)
            .navigationTitle(document.title)
            .navigationBarTitleDisplayMode(.inline)
    }
}

struct LegalWebView: UIViewRepresentable {
    let url: URL

    func makeUIView(context: Context) -> WKWebView {
        let view = WKWebView(frame: .zero)
        view.allowsBackForwardNavigationGestures = true
        context.coordinator.load(url, in: view)
        return view
    }

    func updateUIView(_ view: WKWebView, context: Context) {
        guard context.coordinator.loadedURL != url else { return }
        context.coordinator.load(url, in: view)
    }

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    final class Coordinator {
        var loadedURL: URL?

        func load(_ url: URL, in view: WKWebView) {
            loadedURL = url
            view.load(URLRequest(url: url))
        }
    }
}
