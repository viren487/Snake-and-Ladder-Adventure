---
name: Expo preview verification
description: Avoid false blank-page failures when testing this workspace’s separate Expo preview.
---

Verify mobile web on the separate Expo development host, not the browser game host with a mobile path appended. Wait for the app and fonts to finish loading before judging a cold screenshot.

**Why:** Testing the mobile path on the browser host returned Vite HTML for a JavaScript request and a blank page despite a healthy Expo service. A first capture on the correct Expo host was also briefly white while the font-loading gate was active; the same host subsequently passed all changed mobile flows.

**How to apply:** Resolve the native host through the mobile appPreview screenshot or Expo preview configuration. In browser tests, wait for a real app element before seeding or interacting. Diagnose routing/loading before editing app code or restarting a healthy server.
