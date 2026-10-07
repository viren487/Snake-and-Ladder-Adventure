---
name: Extra rolls and mystery powers
description: User-defined six-roll bonus, mystery-room choices and manual power-use requirements.
---

A roll of six grants the same player another chance if the move is valid. A roll that would exceed 100 is invalid and must not grant another chance.

**Why:** The user explicitly corrected turn handling and defined invalid movement by the calculation needed to reach 100.

**How to apply:** Check movement validity rather than merely whether the panda changed position; preserve the bonus through any required landing choices.

Mystery boxes in rooms 14, 35, 51 and 76 supply powers that players choose and can subsequently use. A bomb may be planted only in the room where its owner is currently standing, never in a remotely selected room. Only its owner may detonate it: immediately while still on the planted room (sending themself Home), or later when an armed rival lands there, including during a rival bonus turn. Landing alone must not automatically detonate it. Anti-venom can be used at a snake-bite room to avoid that snake's downward slide. A bomb-defuser kit protects its user in a bomb room.

**Why:** The user described selectable, manually used powers, restricted planting to the current room, and later asked for an immediate owner-triggered blast option after planting, including self-detonation.

**How to apply:** Put the five mystery choices in the board's bottom-right, within the lower three rows, on both clients. Use a three-column, two-row picker with full names and a short effect description; selection previews a power, then Get awards it. Enforce bomb location, ownership, and self-detonation rules in both clients and the authoritative online server; preserve defensive choices before a rival-triggered blast.

The fourth power is Extra Dice. A planted bomb's blast sends the rival Home, preserving torch/key progress and other inventory.

**Why:** The user explicitly confirmed “Extra dice” as the fourth choice and “home” as the blast result.

**How to apply:** Keep these four choices in both games. Do not replace Extra Dice with a passive mystery bonus or make a blast erase quest progress.

Extra Dice is a consumable, explicitly activated on the holder's turn to bank one additional roll after their next roll. It is independent of a valid-six bonus; earning a six does not spend that banked roll.

**Why:** The user named the power without specifying activation timing. This interpretation makes the power useful, player-controlled and distinct from the automatic valid-six rule.

**How to apply:** Show saved charges separately from activated extra-roll credits. An overshooting six earns no automatic bonus; any explicitly activated Extra Dice credit still grants its promised roll.

Mystery-room choices should reuse each power's inventory colors and recognizable
art in full-name buttons. Keep the bomb and Web Shooter artwork, show Anti-Venom
as a red syringe, Defuser as a tool over a bomb, and Knife as a real knife.

**Why:** The user asked for mystery-box powers to be easier to recognize and their
names to remain readable in the enlarged board tray.

**How to apply:** Reuse the inventory icon components and color classes rather
than introducing a separate mystery-only icon or palette. Preserve the bottom
three-row placement and select-then-Get flow in both clients.