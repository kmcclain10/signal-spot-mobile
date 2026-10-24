# Pulse Signals on iPhone

## Available now: home-screen web app

After publishing this update, open the published Pulse Signals address in Safari, tap Share, then Add to Home Screen. The app has its own icon and opens without the browser toolbar. Internet is required. Account security uses password confirmation; Face ID and background push are not connected.

## Separate native iOS delivery

This hosted TanStack Start application cannot be packaged as a static Capacitor build: authentication and broker calls rely on the hosted application. No iOS project, native plugin integration, signing credentials or App Store submission has been produced in stage 8.

For a separate native wrapper, a Mac, Xcode and an Apple Developer membership are required:

1. Keep the hosted app as the service for account and trading requests. Create a separate Capacitor wrapper project with a minimal bundled client and a reviewed, HTTPS-only connection to that service.
2. Set a unique Apple bundle identifier and app name. Add iOS with Capacitor and install its native project dependencies.
3. Implement a native device-authentication plugin. Face ID may unlock a device-held credential, but must not bypass server verification for LIVE, risk changes or kill-switch removal. Include the Face ID usage description in the iOS property list.
4. Add native push notifications, Apple Push Notification service credentials, permission handling and a server-side delivery path. Existing browser notifications do not become native push automatically.
5. Add properly sized native icons and launch assets. Configure safe areas, external Alpaca disclosure links and session storage; test cold launches, expiration, logout, interruptions and locked devices.
6. Open the generated native project in Xcode, choose your signing team and bundle identifier, and run on a physical iPhone. Test orders only in paper mode.
7. Complete privacy disclosures, financial-service/legal review and the App Store listing. Archive a Release build in Xcode and upload it to App Store Connect for TestFlight before requesting App Review.

Do not publish an unreviewed remote-webview wrapper or claim native Face ID, background push or App Store readiness until those integrations have been delivered and tested on a physical device.