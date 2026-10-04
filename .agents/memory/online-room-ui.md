---
name: Stable multiplayer room controls and aiming
description: Persistent UI constraints for online matches in the browser game.
---

For browser-game online matches, keep the room code, status, and player count in a compact fixed-height trigger and put changing room details and actions inside a drawer. Ordinary turn updates should not move the page; only focus the board if a shot animation needs it visible. Players should select targets directly on snake heads on the board, without duplicate lower aim selectors. Fire must use only the selected heads.

**Why:** The user reported that turn changes and an in-flow room panel made the viewport jump, and that target choices below the board obscured which snake was being aimed at.

**How to apply:** Keep online controls out of normal-flow expanding panels, preserve the current scroll position for routine updates, and verify one- and two-target firing during multiplayer changes.