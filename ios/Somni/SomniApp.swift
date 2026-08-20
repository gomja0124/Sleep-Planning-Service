import SwiftUI

@main
struct SomniApp: App {
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var model = SomniWebViewModel()

    var body: some Scene {
        WindowGroup {
            SomniWebView(model: model)
                .ignoresSafeArea()
        }
        .onChange(of: scenePhase) { phase in
            if phase == .active {
                model.calendarBridge?.reconcileIfAuthorized(reason: "auto")
            }
        }
    }
}
