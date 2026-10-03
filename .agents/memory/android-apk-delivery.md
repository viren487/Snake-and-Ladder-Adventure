---
name: Android APK delivery
description: Scope and compatibility constraints for standalone Android game distribution.
---

Android delivery is currently a downloadable personal/test APK, not a Play Store
release. Do not treat the Replit mobile preview or a web export as an APK.

**Why:** The user specifically requested an APK to install the mobile game.

**How to apply:** Keep personal-install and production-signing claims distinct.
Only call an APK ready after native compilation and signature verification succeed.

Local/Pass & Play must remain usable without a configured or running backend.
Missing backend configuration should explicitly explain that the build is offline,
not silently embed a guessed development server.

**Why:** An installed app can outlive the development workspace; local gameplay
must not become dependent on that workspace staying awake.

**How to apply:** Configure public backend addresses at build time and require a
rebuild to change them. Publish/setup the online API separately.

Do not suggest uninstalling to fix an APK update, or promise automatic transfer
of saved rounds from Expo Go into the standalone app.

**Why:** Uninstalling erases Android app data; Expo Go and the standalone app have
separate storage. Package/signature mismatches must not cause avoidable save loss.

**How to apply:** Preserve application identity/signing compatibility across updates
and diagnose installation failures before recommending any data-destructive step.