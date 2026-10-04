---
name: Website-only game direction
description: The user wants game work to focus on the browser website and the separate mobile artifact removed.
---

The user has changed scope to the website only. Do not build or maintain the native/mobile version unless the user explicitly reverses this direction.

**Why:** The user explicitly said future work should be for the website, not mobile, and asked to delete the mobile version because the website still needs work.

**How to apply:** Make requested game changes in the browser artifact only. The registered mobile artifact is Library-managed: stop its Expo workflow, but do not claim it is deleted until it disappears from the artifact list after the user deletes it in the Replit Library.

## Sound scope

Use short action sound effects for dice, panda movement, ladder climbing, snake bites, bullet collection and key collection. Give bullet and key pickups distinct sounds. Do not add background music during active gameplay. Post-match winner dance music is now explicitly requested.

**Why:** The user explicitly requested these effects, later asked for separate bullet/key pickup sounds, and said not to add background music. They subsequently requested music for the winners’ post-match dance, so that is a scoped exception.

**How to apply:** Keep audio event-driven and non-looping; audio failure must never block a turn.

## Game-focused controls

Prefer compact symbols and counts for powers, with detailed actions and rules revealed on request rather than permanently occupying space.

**Why:** The user asked that the power stash take less space so the game feels easier, and that rules stay hidden until clicked.

**How to apply:** Keep the board and dice prominent. Preserve clear, accessible power names and required landing decisions, but avoid adding always-visible forms or help paragraphs.

## Playability constraint

Collectible and gate rules must not permanently trap a panda because a roll skipped a key or a snake returned it behind a gate.

**Why:** The user reported that pandas stopped moving regardless of subsequent dice values. Requiring exact key landings and repeatedly charging already opened gates caused unreachable progress.

**How to apply:** When changing movement rules, account for skipped squares, ladder shortcuts, snake backtracking and older saved rounds. Preserve a route to progress rather than resetting saved games.

## Browser keys and ammunition

Key and crown progression follows the crown quest described in crown-quest.md; do not revive movement-blocking gates. Bullets are collected only when the panda stops on a bullet room, including a snake's final destination—not when crossing a tile or taking a ladder past it. Keep the five-bullet cap. Fire is available only when the panda stops in a gun room. Aim choices are 98, 99, or both; each targeted snake costs one bullet, so both requires two. A hit makes that snake harmless only for the shooter’s next three dice rolls; the countdown advances on that player’s rolls, not the opponent’s.

**Why:** The user reiterated the exact-room requirement with room 6: stopping on 6 rewards a bullet; crossing 6 and continuing does not. Firing must remain at gun rooms, with single-target and both-target aiming restricted by available bullets.

**How to apply:** Apply gameplay changes to the browser game only. Preserve inventory, firing, per-player countdowns, quest progress and turn messages.

## Saved-round compatibility

Older browser rounds must retain players, positions, ammunition and turn progress. Preserve obsolete keys as history, not as crown keys. Do not grant retroactive ammunition from a saved position. If a save cannot be understood safely, preserve it and show an explicit warning rather than silently replacing it.

**Why:** Browser updates should not erase an existing round or invent pickups that never occurred.

**How to apply:** Default absent ammo, stun and quest fields when migrating; validate present fields before loading. Keep earlier browser save versions intact during upgrades.

## Required animation visibility

Do not rely on a timed smooth scroll to make short gameplay effects visible. Position the viewport synchronously before starting a shot, or explicitly wait for scrolling to finish.

**Why:** Browser checks found that smooth scrolling could leave the upper-board snake targets offscreen for the entire short firing animation, despite correctly resolving the shot. Direct instant document scrolling made the target area visible.

**How to apply:** When controls and action areas are separated on narrow screens, establish visibility before playing a short animation and restore the controls afterward.

## Snake and ladder movement

Snake slides and ladder climbs should be visibly slower and playful, with gentle panda wobble or bounce rather than near-instant jumps.

**Why:** The user said the snake-bite and ladder-climb effects were too fast and requested a slower, cute animation.

**How to apply:** Keep visual motion and turn-completion timing synchronized in the browser game, while respecting reduced-motion settings.