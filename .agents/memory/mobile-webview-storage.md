---
name: Opaque-origin mobile preview storage
description: Secure parent messaging for the embedded game in Expo's browser preview.
---

In the Expo browser preview, an `iframe` loaded with `srcDoc` can have an opaque document origin (`"null"`). A `postMessage` target origin of `"null"` is invalid, and checking only for the parent's normal origin will reject legitimate messages from that frame.

**Why:** The game showed a save warning even though storage was available: its controlled iframe had an opaque origin, so writes raised on `postMessage` and the parent ignored the message.

**How to apply:** For opaque-origin messages, use `"*"` as the target only when necessary; accept them only when `event.source` is the exact game iframe, then validate the message type and allowlisted storage key. Native WebViews should continue using `ReactNativeWebView.postMessage`.
