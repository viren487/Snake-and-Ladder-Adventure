---
name: Direct browser room voice
description: User-selected transport and privacy expectations for voice chat in browser online rooms.
---

Voice in browser online rooms should use direct browser-to-browser WebRTC audio. The existing room server may carry authenticated signaling and in-game text, but do not route audio through a hosted voice service or silently replace the selected transport. Ask before adding an optional relay service.

**Why:** The user chose direct browser-to-browser voice rather than a hosted voice provider and accepted that restrictive networks may block the connection.

**How to apply:** Request microphone access only after an explicit join action, keep self-mute and per-listener mute local, and disclose that peers may see network connection details.