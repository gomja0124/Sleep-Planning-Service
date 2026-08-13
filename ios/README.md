# Somni iOS shell

This SwiftUI app embeds the Somni frontend in `WKWebView` and provides the native EventKit bridge required for Apple Calendar.

## Generate and run

1. Install full Xcode and XcodeGen.
2. Run `xcodegen generate` in this directory.
3. Open `Somni.xcodeproj`, select a Development Team, and run the `Somni` scheme.
4. For a physical iPhone, replace `SOMNI_BASE_URL` in `project.yml` with a reachable LAN or HTTPS frontend URL, regenerate, and ensure the Django API is also reachable from the device.

When the user taps Apple Calendar 연결, iOS requests full calendar access. Timed events are sent through the existing authenticated web session to Django. The bridge observes `EKEventStoreChanged` and reconciles again whenever the app becomes active.

Apple does not expose an Apple Calendar OAuth API comparable to Google Calendar. Sign in with Apple authenticates identity only; EventKit permission is the supported on-device calendar access path.
