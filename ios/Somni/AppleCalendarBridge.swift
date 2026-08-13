import EventKit
import WebKit

final class AppleCalendarBridge: NSObject, WKScriptMessageHandler {
    static let messageName = "somniCalendarSync"

    weak var webView: WKWebView?

    private let eventStore = EKEventStore()
    private let defaults = UserDefaults.standard
    private let savedIdentifierKey = "somni.appleCalendar.sentIdentifiers"
    private var observer: NSObjectProtocol?
    private var syncInProgress = false

    override init() {
        super.init()
        observer = NotificationCenter.default.addObserver(
            forName: .EKEventStoreChanged,
            object: eventStore,
            queue: .main
        ) { [weak self] _ in
            self?.reconcileIfAuthorized(reason: "auto")
        }
    }

    deinit {
        stopObserving()
    }

    func stopObserving() {
        if let observer {
            NotificationCenter.default.removeObserver(observer)
            self.observer = nil
        }
    }

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        guard message.name == Self.messageName else { return }
        let reason = (message.body as? [String: Any])?["reason"] as? String ?? "manual"
        requestAccessAndSync(reason: reason)
    }

    func reconcileIfAuthorized(reason: String) {
        let status = EKEventStore.authorizationStatus(for: .event)
        if #available(iOS 17.0, *) {
            guard status == .fullAccess else { return }
        } else {
            guard status == .authorized else { return }
        }
        sync(reason: reason)
    }

    private func requestAccessAndSync(reason: String) {
        if #available(iOS 17.0, *) {
            eventStore.requestFullAccessToEvents { [weak self] granted, _ in
                DispatchQueue.main.async {
                    self?.handlePermission(granted: granted, reason: reason)
                }
            }
        } else {
            eventStore.requestAccess(to: .event) { [weak self] granted, _ in
                DispatchQueue.main.async {
                    self?.handlePermission(granted: granted, reason: reason)
                }
            }
        }
    }

    private func handlePermission(granted: Bool, reason: String) {
        if granted {
            sync(reason: reason)
        } else {
            webView?.evaluateJavaScript("window.somniAppleCalendarPermissionChanged?.(false)")
        }
    }

    private func sync(reason: String) {
        guard !syncInProgress, let webView else { return }
        syncInProgress = true

        let now = Date()
        let start = Calendar.current.date(byAdding: .day, value: -7, to: now) ?? now
        let end = Calendar.current.date(byAdding: .day, value: 180, to: now) ?? now
        let calendars = eventStore.calendars(for: .event)
        let predicate = eventStore.predicateForEvents(withStart: start, end: end, calendars: calendars)
        let events = eventStore.events(matching: predicate).filter { !$0.isAllDay }

        let payload: [[String: Any]] = events.map { event in
            [
                "externalId": stableIdentifier(for: event),
                "title": event.title ?? "제목 없는 일정",
                "startAt": ISO8601DateFormatter().string(from: event.startDate),
                "calendarTitle": event.calendar.title,
            ]
        }
        let currentIdentifiers = Set(payload.compactMap { $0["externalId"] as? String })
        let previousIdentifiers = Set(defaults.stringArray(forKey: savedIdentifierKey) ?? [])
        let deletedIdentifiers = Array(previousIdentifiers.subtracting(currentIdentifiers))

        webView.callAsyncJavaScript(
            "return await window.somniCalendarEventsChanged(events, deletedIds)",
            arguments: ["events": payload, "deletedIds": deletedIdentifiers],
            in: nil,
            contentWorld: .page
        ) { [weak self] result in
            DispatchQueue.main.async {
                guard let self else { return }
                self.syncInProgress = false
                if case .success = result {
                    self.defaults.set(Array(currentIdentifiers), forKey: self.savedIdentifierKey)
                }
            }
        }
    }

    private func stableIdentifier(for event: EKEvent) -> String {
        let occurrence = Int(event.startDate.timeIntervalSince1970)
        return "\(event.calendarItemIdentifier)#\(occurrence)"
    }
}
