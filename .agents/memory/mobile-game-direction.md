---
name: Mobile game direction
description: Product scope for the Snake & Ladder game across browser and native mobile versions.
---

Finish the browser game first and use it as the reference version before moving the game into the native mobile app. Keep both artifacts available.

**Why:** The user currently wants to play and finish the game in Chrome, then convert it for mobile.

**How to apply:** Complete requested gameplay and browser controls in the web artifact first; align the Expo game after the web version is finalized.

## Sound scope

Use short action sound effects for dice, panda movement, ladder climbing and snake bites. Do not add background music.

**Why:** The user explicitly requested these effects and said not to add background music.

**How to apply:** Keep audio event-driven and non-looping; audio failure must never block a turn.

## Playability constraint

Collectible and gate rules must not permanently trap a panda because a roll skipped a key or a snake returned it behind a gate.

**Why:** The user reported that pandas stopped moving regardless of subsequent dice values. Requiring exact key landings and repeatedly charging already opened gates caused unreachable progress.

**How to apply:** When changing movement rules, account for skipped squares, ladder shortcuts, snake backtracking and older saved rounds. Preserve a route to progress rather than resetting saved games.

## Browser-first keys and ammunition

Keep keys collectible and visible, but suspend their gate effect for now. Bullet pickups are collected while moving (including ladder routes), with a five-bullet cap. Reaching a gun square pauses the shooter’s turn so they can aim at snake 98 or 99, or pass. A shot spends one bullet and makes that snake harmless only for the shooter’s next three dice rolls; the countdown advances on that player’s rolls, not the opponent’s.

**Why:** The user asked to finish these mechanics in the browser game before aligning the native version. The shooter-scoped stun is the interpretation of “next 3 dice” used for the current implementation.

**How to apply:** Keep the browser version as the reference. During the later mobile port, copy the same inventory, firing, and per-player countdown rules before restoring full cross-platform parity.