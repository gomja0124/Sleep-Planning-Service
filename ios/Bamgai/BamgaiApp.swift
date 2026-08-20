import SwiftUI

@main
struct BamgaiApp: App {
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var model = BamgaiWebViewModel()

    var body: some Scene {
        WindowGroup {
            BamgaiWebView(model: model)
                .ignoresSafeArea()
        }
        .onChange(of: scenePhase) { phase in
            if phase == .active {
                model.calendarBridge?.reconcileIfAuthorized(reason: "auto")
            }
        }
    }
}
