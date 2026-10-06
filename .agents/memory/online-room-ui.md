---
name: Stable multiplayer room controls and aiming
description: Persistent room-control and aiming constraints shared by the browser and Expo games.
---

For browser-game online matches, keep the room code, status, and player count in a compact fixed-height trigger and put changing room details and actions inside a drawer. Ordinary turn updates should not move the page; only focus the board if a shot animation needs it visible. In both browser and Expo games, select targets directly on snake heads without duplicate lower aim selectors. While aiming, replace the dice control in its usual spot with Fire and mark each selected head with a clear red circle. Fire must use only the selected heads.

**Why:** The user reported that turn changes and an in-flow room panel made the viewport jump, target choices below the board obscured the aim, and reaching for a separate Fire button was awkward.

**How to apply:** Keep online controls out of normal-flow expanding panels, preserve the current scroll position for routine updates, and verify one- and two-target firing on both browser and native mobile.