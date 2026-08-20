import SwiftUI
import WebKit

final class BamgaiWebViewModel: ObservableObject {
    weak var calendarBridge: AppleCalendarBridge?
}

struct BamgaiWebView: UIViewRepresentable {
    @ObservedObject var model: BamgaiWebViewModel

    func makeCoordinator() -> Coordinator {
        Coordinator(model: model)
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.userContentController.add(context.coordinator.calendarBridge, name: AppleCalendarBridge.messageName)

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        context.coordinator.calendarBridge.webView = webView
        model.calendarBridge = context.coordinator.calendarBridge

        let configuredURL = Bundle.main.object(forInfoDictionaryKey: "SOMNI_BASE_URL") as? String
        guard let url = URL(string: configuredURL ?? "http://localhost:4173") else {
            preconditionFailure("SOMNI_BASE_URL must be a valid URL")
        }
        webView.load(URLRequest(url: url))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    static func dismantleUIView(_ webView: WKWebView, coordinator: Coordinator) {
        webView.configuration.userContentController.removeScriptMessageHandler(forName: AppleCalendarBridge.messageName)
        coordinator.calendarBridge.stopObserving()
    }

    final class Coordinator: NSObject, WKNavigationDelegate {
        let calendarBridge = AppleCalendarBridge()

        init(model: BamgaiWebViewModel) {
            super.init()
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            calendarBridge.reconcileIfAuthorized(reason: "auto")
        }
    }
}
