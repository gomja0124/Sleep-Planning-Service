# iOS Apple Calendar bridge

Somni's web UI and Django API are ready to receive EventKit changes. The native iOS shell owns calendar permission and change observation because a web page cannot read Apple Calendar directly.

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

The page forwards the payload to `PUT /api/v1/calendars/apple/events/`. Django upserts or deletes schedules, and the next plan request immediately uses the changed schedule data.

Background delivery while the app is terminated requires an additional iOS background-refresh or push strategy; EventKit does not provide a server webhook.
