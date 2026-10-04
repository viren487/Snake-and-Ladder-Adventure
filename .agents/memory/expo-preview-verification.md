---
name: Expo preview verification
description: Avoid false blank-page failures when testing this workspace’s separate Expo preview.
---

Verify mobile web on the separate Expo development host, not the browser game host with a mobile path appended. Wait for the app and fonts to finish loading before judging a cold screenshot. A successful agent-side capture does not prove the user's phone opened the same hostname; compare its actual address and TLS status.

**Why:** Testing the mobile path on the browser host returned Vite HTML for a JavaScript request and a blank page despite a healthy Expo service. A first capture on the correct Expo host was also briefly white while the font-loading gate was active. Separately, a phone opened a legacy `.repl.co` hostname with a certificate mismatch and waiting page; the user confirmed that copying the active `.replit.dev` Expo URL opened the game on the phone.

**How to apply:** Resolve the native host through the mobile appPreview screenshot or Expo preview configuration. In browser tests, wait for a real app element before seeding or interacting. If phone access still fails, verify the exact full address and offer the verified HTTPS URL as copyable text. Never advise bypassing a certificate warning. Diagnose routing/loading before editing app code or restarting a healthy server.
