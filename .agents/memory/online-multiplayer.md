---
name: Online multiplayer scope
description: User-defined internet multiplayer and offline-save compatibility requirements.
---

Online play must let two people use their own phones or computers, including browser/native combinations, from different internet connections. It must not require the same Wi-Fi or LAN. Keep Pass & Play available.

**Why:** The user clarified: “Apne apne mobile se ya apne system se join karke khel sake same network pe hi join ho aisa jaruri nahi rahega… Kahi se bhi kisi bhi network se room me join kar sakta ho.”

**How to apply:** Keep the browser and native app on the same public backend and rules. Do not substitute a LAN-only transport or remove local play.

Online rounds must not replace existing local saves. Restoring an online seat means reconnecting from the device/browser that holds that seat, not claiming a third seat by entering the room code.

**Why:** Multiplayer was approved as an addition to the existing game, with reconnect support and saved local rounds retained. Room codes are invitations, not ownership credentials.

**How to apply:** Keep online session storage separate from local game saves; explain original-device restoration in UI. Never put seat credentials in invite codes or links.

Restore the local round before clearing the online-session flag on exit; do not await storage between those steps.

**Why:** Native storage writes can yield to rendering. Clearing the flag first temporarily enables offline autosaves while the displayed state is still the online round.

**How to apply:** Treat restoring local state and reenabling local persistence as one synchronous transition, then remove the saved online seat asynchronously.