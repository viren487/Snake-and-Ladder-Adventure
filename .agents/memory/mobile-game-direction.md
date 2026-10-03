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

Key and crown progression follows the crown quest described in crown-quest.md; do not revive movement-blocking gates. Bullets are collected only when the panda stops on a bullet room, including a snake's final destination—not when crossing a tile or taking a ladder past it. Keep the five-bullet cap. Fire is available only when the panda stops in a gun room. Aim choices are 98, 99, or both; each targeted snake costs one bullet, so both requires two. A hit makes that snake harmless only for the shooter’s next three dice rolls; the countdown advances on that player’s rolls, not the opponent’s.

**Why:** The user reiterated the exact-room requirement with room 6: stopping on 6 rewards a bullet; crossing 6 and continuing does not. Firing must remain at gun rooms, with single-target and both-target aiming restricted by available bullets. The shooter-scoped stun is the interpretation of “next 3 dice” used for the current implementation.

**How to apply:** Keep the browser version as the reference and apply gameplay changes to both versions. Do not weaken cross-platform parity by ignoring inventory, firing, per-player countdowns, quest progress or turn messages.

## Saved-round compatibility

Older native rounds must retain players, positions, ammunition and turn progress. Preserve obsolete keys as history, not as crown keys. Do not grant retroactive ammunition from a saved position. If a save cannot be understood safely, preserve it and show an explicit warning rather than silently replacing it.

**Why:** Aligning the two games should not erase an existing round or invent pickups that never occurred.

**How to apply:** Default absent ammo, stun and quest fields when migrating; validate present fields before loading. Keep earlier save versions intact during upgrades.

## Required animation visibility

Do not rely on a timed smooth scroll to make short gameplay effects visible. Position the viewport synchronously before starting a shot, or explicitly wait for scrolling to finish.

**Why:** Browser checks found that smooth scrolling could leave the upper-board snake targets offscreen for the entire short firing animation, despite correctly resolving the shot. Direct instant document scrolling made the target area visible.

**How to apply:** When controls and action areas are separated on narrow screens, establish visibility before playing a short animation and restore the controls afterward.

## Snake and ladder movement

Snake slides and ladder climbs should be visibly slower and playful, with gentle panda wobble or bounce rather than near-instant jumps.

**Why:** The user said the snake-bite and ladder-climb effects were too fast and requested a slower, cute animation.

**How to apply:** Keep visual motion and turn-completion timing synchronized in both versions, while respecting reduced-motion settings.