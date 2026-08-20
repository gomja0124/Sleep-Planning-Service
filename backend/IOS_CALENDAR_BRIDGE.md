# iOS Apple Calendar bridge

밤가이 web UI and Django API receive EventKit changes. The native implementation lives in `ios/Bamgai/AppleCalendarBridge.swift`; a web page alone cannot read Apple Calendar.

## Build the iOS shell

The `ios/project.yml` file is an XcodeGen project definition:

```bash
brew install xcodegen
cd ios
xcodegen generate
open Bamgai.xcodeproj
```

For the simulator, `SOMNI_BASE_URL` defaults to `http://localhost:4173`. A physical iPhone cannot use the Mac's `localhost`; change it to the Mac's LAN URL or a deployed HTTPS frontend. Select a Development Team and run the `Bamgai` target.

The generated Info.plist contains both `NSCalendarsFullAccessUsageDescription` for iOS 17+ and `NSCalendarsUsageDescription` for iOS 16.

## Native to web contract

Register a `WKScriptMessageHandler` named `somniCalendarSync`. The page sends:

```json
{ "reason": "connect | manual | auto" }
```

When received, the iOS shell should request EventKit access if needed, read the selected calendars, and call this page function with changed events and deleted identifiers:

```javascript
window.somniCalendarEventsChanged(
  [{ externalId: "event-id", title: "Morning class", startAt: "2026-08-14T09:00:00+09:00" }],
  ["deleted-event-id"]
)
```

Observe `EKEventStoreChanged` while the app is active and run the same transfer. Persist the last sent identifier set on-device so deleted identifiers can be calculated. On app activation, perform a reconciliation even when no notification was received while suspended.

The included bridge implements this contract. It imports timed events from the previous 7 days through the next 180 days, excludes all-day events, detects removed or rescheduled occurrences, and saves its identifier checkpoint only after the web API call succeeds.

The page forwards the payload to `PUT /api/v1/calendars/apple/events/`. Django upserts or deletes schedules, and the next plan request immediately uses the changed schedule data.

Background delivery while the app is terminated requires an additional iOS background-refresh or push strategy; EventKit does not provide a server webhook.
