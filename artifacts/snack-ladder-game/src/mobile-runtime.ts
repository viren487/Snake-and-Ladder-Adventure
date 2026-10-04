import { setBaseUrl } from '@workspace/api-client-react';

declare global {
  interface Window {
    __SNACK_LADDER_MOBILE__?: { apiOrigin: string | null };
  }
}

// Ordinary browser play is unchanged. Only the bundled mobile host supplies this.
if (window.__SNACK_LADDER_MOBILE__) {
  setBaseUrl(window.__SNACK_LADDER_MOBILE__.apiOrigin || 'https://offline.invalid');
}

export const onlineAvailable = !window.__SNACK_LADDER_MOBILE__ ||
  !!window.__SNACK_LADDER_MOBILE__.apiOrigin;