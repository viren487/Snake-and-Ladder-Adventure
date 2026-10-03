import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from "expo-audio";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

export type GameSound = "dice" | "step" | "ladder" | "snake" | "bullet" | "key";
type PickupState = { bullets: number; crownKeyRoom: number | null };

/** Short one-shot effects only: no music, loops, recording or background playback. */
export function useGameSounds() {
  const dice = useAudioPlayer(require("../assets/sounds/dice.wav"));
  const step = useAudioPlayer(require("../assets/sounds/step.wav"));
  const ladder = useAudioPlayer(require("../assets/sounds/ladder.wav"));
  const snake = useAudioPlayer(require("../assets/sounds/snake.wav"));
  const bullet = useAudioPlayer(require("../assets/sounds/bullet.wav"));
  const key = useAudioPlayer(require("../assets/sounds/key.wav"));
  const diceStatus = useAudioPlayerStatus(dice);
  const stepStatus = useAudioPlayerStatus(step);
  const ladderStatus = useAudioPlayerStatus(ladder);
  const snakeStatus = useAudioPlayerStatus(snake);
  const bulletStatus = useAudioPlayerStatus(bullet);
  const keyStatus = useAudioPlayerStatus(key);
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  useEffect(() => {
    void setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      allowsRecording: false,
      interruptionMode: "mixWithOthers",
    }).catch((error: unknown) => setPlaybackError(String(error)));
    dice.volume = 0.55;
    step.volume = 0.38;
    ladder.volume = 0.5;
    snake.volume = 0.45;
    bullet.volume = 0.55;
    key.volume = 0.55;
    dice.loop = step.loop = ladder.loop = snake.loop = bullet.loop = key.loop = false;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        dice.pause();
        step.pause();
        ladder.pause();
        snake.pause();
        bullet.pause();
        key.pause();
      }
    });
    return () => subscription.remove();
  }, [dice, step, ladder, snake, bullet, key]);

  const play = useCallback((sound: GameSound) => {
    if (mutedRef.current || AppState.currentState === "background") return;
    const player = { dice, step, ladder, snake, bullet, key }[sound];
    // Audio errors never interrupt a dice turn or hold the movement lock.
    try {
      void player.seekTo(0).catch((error: unknown) => setPlaybackError(String(error)));
      player.play();
    } catch (error) {
      setPlaybackError(String(error));
    }
  }, [dice, step, ladder, snake, bullet, key]);

  const playPickups = useCallback((before: PickupState, after: PickupState) => {
    if (after.bullets > before.bullets) play("bullet");
    if (before.crownKeyRoom === null && after.crownKeyRoom !== null) play("key");
  }, [play]);

  const toggleMuted = useCallback(() => {
    mutedRef.current = !mutedRef.current;
    setMuted(mutedRef.current);
    if (mutedRef.current) {
      dice.pause();
      step.pause();
      ladder.pause();
      snake.pause();
      bullet.pause();
      key.pause();
    }
  }, [dice, step, ladder, snake, bullet, key]);

  return {
    play,
    playPickups,
    muted,
    toggleMuted,
    error: playbackError || diceStatus.error || stepStatus.error || ladderStatus.error || snakeStatus.error || bulletStatus.error || keyStatus.error,
  };
}