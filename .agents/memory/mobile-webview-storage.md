---
name: Opaque-origin mobile preview storage
description: Secure parent messaging for the embedded game in Expo's browser preview.
---

In the Expo browser preview, an `iframe` loaded with `srcDoc` can have an opaque document origin (`"null"`). A `postMessage` target origin of `"null"` is invalid, and checking only for the parent's normal origin will reject legitimate messages from that frame.

**Why:** The game showed a save warning even though storage was available: its controlled iframe had an opaque origin, so writes raised on `postMessage` and the parent ignored the message.

**How to apply:** For opaque-origin messages, use `"*"` as the target only when necessary; accept them only when `event.source` is the exact game iframe, then validate the message type and allowlisted storage key. Native WebViews should continue using `ReactNativeWebView.postMessage`.

For hands-on Android testing, open the fresh **Preview on your phone** QR in Expo Go instead of pasting an old `expo.sisko.repl.co` tunnel into Chrome; that temporary web address can show Replit's placeholder page.

**Why:** A user repeatedly reached an insecure/fallback browser page from the old temporary tunnel even though the current Expo preview was running.

**How to apply:** Restart the managed Expo workflow if the QR is stale, confirm Metro is running, and direct the user to Replit's phone preview/QR rather than presenting the tunnel as a permanent browser URL.
