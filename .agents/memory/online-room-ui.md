---
name: Stable multiplayer room controls and aiming
description: Persistent room-control and aiming constraints shared by the browser and Expo games.
---

For browser-game online matches, keep the room code, status, and player count in a compact fixed-height trigger and put changing room details and actions inside a drawer. Ordinary turn updates should not move the page; only focus the board if a shot animation needs it visible. In both browser and Expo games, replace the dice with a touch-friendly Fire/Leave step, then circular 98/99/Both target choices and a Fire button below. Mark selected heads with clear red circles; do not require tapping tiny heads.

**Why:** The user reported that turn changes and an in-flow room panel made the viewport jump, and that aiming by touching small heads was difficult on mobile. They want Fire and Leave first, then visible round choices in the dice area.

**How to apply:** Keep online controls out of normal-flow expanding panels, preserve the current scroll position for routine updates, and verify one-target, two-target, and leave flows on both browser and native mobile.