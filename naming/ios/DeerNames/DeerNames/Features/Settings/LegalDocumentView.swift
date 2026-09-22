import SwiftUI
import WebKit

enum LegalDocument: String, Identifiable {
    case privacy
    case terms

    var id: String { rawValue }

    var title: String {
        switch self {
        case .privacy: return L10n.t("隐私政策")
        case .terms: return L10n.t("服务条款")
        }
    }

    var url: URL {
        let path: String
        switch self {
        case .privacy: path = "privacy-policy.md"
        case .terms: path = "terms-of-service.md"
        }
        return URL(string: "https://github.com/LoomisKoo/miniTool/blob/main/naming/docs/\(path)")!
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
        view.load(URLRequest(url: url))
        return view
    }

    func updateUIView(_ view: WKWebView, context: Context) {
        guard view.url != url else { return }
        view.load(URLRequest(url: url))
    }
}
