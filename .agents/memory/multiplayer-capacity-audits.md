---
name: Multiplayer capacity audits
description: Type checks alone do not catch old two-player runtime assumptions across both frontends.
---

When changing supported player counts, audit snapshot acceptance, turn eligibility, bomb eligibility and token stacking in both browser and Expo; server capacity changes alone are insufficient.

**Why:** During expansion to four players, static checks and server tests passed while the shared client still rejected anything other than two players, and native token stacking assumed there was exactly one rival. Array index arithmetic can remain type-correct while returning undefined at runtime.

**How to apply:** Include at least one actual three-or-four-person admission/render flow in verification. Use predicates over all opponents rather than two-seat index arithmetic. Keep local save validation separate from online room validation.

A timed-out admission POST may already have allocated a seat on the server. Repeating join is not equivalent to reconnecting, and can consume another seat.

**Why:** A cold Expo preview admission exceeded the short request deadline: the host saw the allocated guest offline, while a subsequent join admitted that same browser as the next player. This is a transport/admission safety concern, distinct from valid multi-player rendering.

**How to apply:** Keep original-device seat recovery separate from new admissions. Do not assume a failed client request means no server mutation occurred; duplicate-safe admission needs its own proof rather than reusing the ordinary room code.
