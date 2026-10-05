import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import WebGameShell from '@/components/WebGameShell';
import MobileLaunchFlow, { type MobileLaunchSelection } from '@/components/MobileLaunchFlow';
import {
  MOBILE_LOCAL_MODE_STORAGE_KEY,
  MOBILE_PROFILE_STORAGE_KEY,
  normalizeMobilePlayerName,
  parseMobileProfile,
  type MobilePlayMode,
} from '@/lib/mobile-profile';

export default function GameScreen() {
  const [screen, setScreen] = useState<'onboarding' | 'game'>('onboarding');
  const [initialName, setInitialName] = useState('');
  const [initialMode, setInitialMode] = useState<MobilePlayMode | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    const startedAt = Date.now();
    setIsLoading(true);
    setLoadError(null);

    const loadProfile = async () => {
      try {
        const savedProfile = parseMobileProfile(
          await AsyncStorage.getItem(MOBILE_PROFILE_STORAGE_KEY),
        );
        const minimumSplashDelay = Math.max(0, 550 - (Date.now() - startedAt));
        if (minimumSplashDelay) {
          await new Promise((resolve) => setTimeout(resolve, minimumSplashDelay));
        }
        if (!active) return;
        setInitialName(savedProfile?.name ?? '');
        setInitialMode(savedProfile?.playMode ?? null);
      } catch {
        if (!active) return;
        const minimumSplashDelay = Math.max(0, 550 - (Date.now() - startedAt));
        if (minimumSplashDelay) {
          await new Promise((resolve) => setTimeout(resolve, minimumSplashDelay));
        }
        if (!active) return;
        setLoadError('Your profile could not be loaded from this device.');
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void loadProfile();
    return () => { active = false; };
  }, [loadAttempt]);

  const handleRetry = useCallback(() => {
    setLoadError(null);
    setLoadAttempt((attempt) => attempt + 1);
  }, []);

  const handleStart = useCallback(async (selection: MobileLaunchSelection) => {
    const name = normalizeMobilePlayerName(selection.name);
    if (!name) {
      setStartError('Enter a player name to continue.');
      return;
    }

    setIsStarting(true);
    setStartError(null);
    try {
      const profile = JSON.stringify({ name, playMode: selection.playMode });
      const localMode = selection.playMode === 'bot' ? 'bot' : 'pass';
      await AsyncStorage.multiSet([
        [MOBILE_PROFILE_STORAGE_KEY, profile],
        [MOBILE_LOCAL_MODE_STORAGE_KEY, localMode],
      ]);
      setScreen('game');
    } catch {
      setStartError('Your choices could not be saved. Please try again.');
    } finally {
      setIsStarting(false);
    }
  }, []);

  if (screen === 'game') return <WebGameShell />;

  return (
    <MobileLaunchFlow
      initialName={initialName}
      initialMode={initialMode}
      isLoading={isLoading}
      loadError={loadError}
      onRetry={handleRetry}
      onlineAvailable={Boolean(process.env.EXPO_PUBLIC_DOMAIN)}
      isStarting={isStarting}
      startError={startError}
      onStart={handleStart}
    />
  );
}