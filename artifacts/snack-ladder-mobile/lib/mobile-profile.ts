export const MOBILE_PROFILE_STORAGE_KEY = 'snack-ladder-mobile-profile-v1';
export const MOBILE_LOCAL_MODE_STORAGE_KEY = 'snack-ladder-local-mode-v1';
export const MAX_MOBILE_PLAYER_NAME_LENGTH = 24;

export type MobilePlayMode = 'bot' | 'pass' | 'online';

export interface MobileProfile {
  name: string;
  playMode: MobilePlayMode;
}

export function normalizeMobilePlayerName(value: string) {
  return value.trim().slice(0, MAX_MOBILE_PLAYER_NAME_LENGTH);
}

export function parseMobileProfile(value: string | null): MobileProfile | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object') return null;
    const profile = parsed as Partial<MobileProfile>;
    const name = typeof profile.name === 'string'
      ? normalizeMobilePlayerName(profile.name)
      : '';
    if (!name || (profile.playMode !== 'bot' && profile.playMode !== 'pass' && profile.playMode !== 'online')) {
      return null;
    }
    return { name, playMode: profile.playMode };
  } catch {
    return null;
  }
}
