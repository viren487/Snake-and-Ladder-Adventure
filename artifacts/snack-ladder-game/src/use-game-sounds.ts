import { useCallback, useEffect, useRef, useState } from "react";

export type GameSound = "dice" | "step" | "ladder" | "snake" | "bullet" | "key";
type PickupState = { bullets: number; crownKeyRoom: number | null };

const SOUND_FILES: Record<GameSound, string> = {
  dice: new URL("./sounds/dice.wav", import.meta.url).href,
  step: new URL("./sounds/step.wav", import.meta.url).href,
  ladder: new URL("./sounds/ladder.wav", import.meta.url).href,
  snake: new URL("./sounds/snake.wav", import.meta.url).href,
  bullet: new URL("./sounds/bullet.wav", import.meta.url).href,
  key: new URL("./sounds/key.wav", import.meta.url).href,
};

/** Short one-shot effects only: no background music or looping playback. */
export function useGameSounds() {
  const players = useRef<Partial<Record<GameSound, HTMLAudioElement>>>({});
  const mutedRef = useRef(false);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const levels: Record<GameSound, number> = {
      dice: 0.55,
      step: 0.38,
      ladder: 0.5,
      snake: 0.45,
      bullet: 0.55,
      key: 0.55,
    };
    const created = {} as Record<GameSound, HTMLAudioElement>;
    for (const sound of Object.keys(SOUND_FILES) as GameSound[]) {
      const audio = new Audio(SOUND_FILES[sound]);
      audio.preload = "auto";
      audio.loop = false;
      audio.volume = levels[sound];
      created[sound] = audio;
    }
    players.current = created;

    const pauseEffects = () => {
      Object.values(created).forEach((audio) => audio.pause());
    };
    const pauseOnHide = () => {
      if (document.visibilityState !== "visible") pauseEffects();
    };
    document.addEventListener("visibilitychange", pauseOnHide);
    return () => {
      document.removeEventListener("visibilitychange", pauseOnHide);
      pauseEffects();
      players.current = {};
    };
  }, []);

  const play = useCallback((sound: GameSound) => {
    if (mutedRef.current) return;
    const audio = players.current[sound];
    if (!audio) return;
    audio.pause();
    if (Number.isFinite(audio.duration) && audio.currentTime > 0) {
      try {
        audio.currentTime = 0;
      } catch {
        // Playback should continue even if the browser is still loading metadata.
      }
    }
    try {
      void audio.play().catch((reason: unknown) => setError(String(reason)));
    } catch (reason) {
      setError(String(reason));
    }
  }, []);

  const playPickups = useCallback((before: PickupState, after: PickupState) => {
    if (after.bullets > before.bullets) play("bullet");
    if (before.crownKeyRoom === null && after.crownKeyRoom !== null) play("key");
  }, [play]);

  const toggleMuted = useCallback(() => {
    mutedRef.current = !mutedRef.current;
    setMuted(mutedRef.current);
    if (mutedRef.current) {
      Object.values(players.current).forEach((audio) => audio?.pause());
    }
  }, []);

  return { play, playPickups, muted, toggleMuted, error };
}