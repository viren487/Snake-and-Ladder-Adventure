import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';

export type GameSound = 'dice' | 'step' | 'ladder' | 'snake' | 'bullet' | 'key' | 'happy';
type PickupState = { bullets: number; crownKeyRoom: number | null };

export function useGameSounds() {
  const dice = useAudioPlayer(require('../assets/audio/dice.wav'));
  const step = useAudioPlayer(require('../assets/audio/step.wav'));
  const ladder = useAudioPlayer(require('../assets/audio/ladder.wav'));
  const snake = useAudioPlayer(require('../assets/audio/snake.wav'));
  const bullet = useAudioPlayer(require('../assets/audio/bullet.wav'));
  const key = useAudioPlayer(require('../assets/audio/key.wav'));
  const happy = useAudioPlayer(require('../assets/audio/happy.wav'));
  const players = { dice, step, ladder, snake, bullet, key, happy };
  const playersRef = useRef(players);
  playersRef.current = players;
  const mutedRef = useRef(false);
  const celebratingRef = useRef(false);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void setAudioModeAsync({ playsInSilentMode: true }).catch((reason) => setError(String(reason)));
  }, []);

  const play = useCallback((sound: GameSound) => {
    if (mutedRef.current) return;
    const player = playersRef.current[sound];
    try {
      player.pause();
      void player.seekTo(0).catch(() => undefined).then(() => {
        try {
          player.play();
        } catch (reason) {
          setError(String(reason));
        }
      });
    } catch (reason) {
      setError(String(reason));
    }
    if (sound === 'dice' || sound === 'step') {
      void Haptics.impactAsync(sound === 'dice' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    } else if (sound === 'ladder' || sound === 'key' || sound === 'happy') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    } else if (sound === 'snake') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
    }
  }, []);

  const setCelebrating = useCallback((active: boolean) => {
    celebratingRef.current = active;
    const player = playersRef.current.happy;
    player.loop = active;
    if (active && !mutedRef.current) {
      try {
        player.play();
      } catch (reason) {
        setError(String(reason));
      }
    } else {
      player.pause();
    }
  }, []);

  const playPickups = useCallback((before: PickupState, after: PickupState) => {
    if (after.bullets > before.bullets) play('bullet');
    if (before.crownKeyRoom === null && after.crownKeyRoom !== null) play('key');
  }, [play]);

  const toggleMuted = useCallback(() => {
    mutedRef.current = !mutedRef.current;
    setMuted(mutedRef.current);
    if (mutedRef.current) {
      Object.values(playersRef.current).forEach((player) => player.pause());
    } else if (celebratingRef.current) {
      playersRef.current.happy.loop = true;
      playersRef.current.happy.play();
    }
  }, []);

  return useMemo(
    () => ({ play, playPickups, setCelebrating, muted, toggleMuted, error }),
    [play, playPickups, setCelebrating, muted, toggleMuted, error],
  );
}
