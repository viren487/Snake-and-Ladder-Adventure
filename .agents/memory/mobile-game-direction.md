---
name: Mobile game direction
description: Product scope for the Snake & Ladder game across browser and native mobile versions.
---

The intended product is a native Android/iOS Snake & Ladder game. Keep the existing browser game as a separate version unless the user asks to replace it.

**Why:** The user clarified that the goal was a mobile game and selected a native app while asking to retain the browser version.

**How to apply:** Make future mobile-specific gameplay and presentation changes in the Expo artifact, preserving the existing game rules and browser artifact.

## Sound scope

Use short action sound effects for dice, panda movement, ladder climbing and snake bites. Do not add background music.

**Why:** The user explicitly requested these effects and said not to add background music.

**How to apply:** Keep audio event-driven and non-looping; audio failure must never block a turn.

## Playability constraint

Collectible and gate rules must not permanently trap a panda because a roll skipped a key or a snake returned it behind a gate.

**Why:** The user reported that pandas stopped moving regardless of subsequent dice values. Requiring exact key landings and repeatedly charging already opened gates caused unreachable progress.

**How to apply:** When changing movement rules, account for skipped squares, ladder shortcuts, snake backtracking and older saved rounds. Preserve a route to progress rather than resetting saved games.