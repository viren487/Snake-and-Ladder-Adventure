---
name: Shared React runtime across browser and Expo
description: Avoid mismatched React runtime instances and nominal cross-version hook types in shared libraries.
---

Shared gameplay/network hooks should use the calling app's React hooks, rather than resolving a separate React runtime inside a shared package.

**Why:** Browser and Expo templates can legitimately use different React versions. A shared package's direct React import may resolve no runtime or the wrong runtime. React type packages also contain branded effect-cleanup types, so importing one version's complete React hook signatures can reject another version's otherwise compatible hooks.

**How to apply:** Share framework-independent logic or inject host hooks through a small structural interface. Do not force global React version overrides solely to make a shared gameplay hook compile; that can break Expo compatibility.