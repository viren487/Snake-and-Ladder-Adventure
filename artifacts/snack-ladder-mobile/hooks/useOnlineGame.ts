import * as React from "react";
import { useEffect, useRef, type Dispatch, type SetStateAction, type RefObject } from "react";
import { AppState, AccessibilityInfo } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useOnlineRoom, isRoomSession, isPendingAdmission, type RoomStorage } from "@workspace/api-client-react";
import type { GameState, ShootableSnakeSquare } from "@/lib/game-engine";
import type { RoomSnapshot } from "@workspace/game-core/online";
import type { useGameSounds } from "./useGameSounds";

type Walking = { playerId: string; position: number; isSpecialMove: boolean; effect?: "ladder" | "snake" | "boom" | "torch" | "return" | "bamboo" };
type Shot = { from: number; targets: ShootableSnakeSquare[] };
type Setter<T> = Dispatch<SetStateAction<T>>;
type Bindings = {
  ready: boolean; focus: (section: "board" | "controls") => void;
  gameRef: RefObject<GameState>; setGame: Setter<GameState>; setDiceFace: Setter<number | null>;
  setWalking: Setter<Walking | null>; setShot: Setter<Shot | null>; setRolling: Setter<boolean>;
  setFiring: Setter<boolean>; setSelectedTargets: Setter<ShootableSnakeSquare[]>;
  sounds: ReturnType<typeof useGameSounds>;
};
const storage: RoomStorage = {
  async load() {
    const raw = await AsyncStorage.getItem("snake-ladder-online-seat-v1");
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!isRoomSession(value) && !isPendingAdmission(value)) throw new Error("Invalid room seat");
    return value;
  },
  async save(session) {
    if (session) await AsyncStorage.setItem("snake-ladder-online-seat-v1", JSON.stringify(session));
    else await AsyncStorage.removeItem("snake-ladder-online-seat-v1");
  },
};
export function useOnlineGame(bindings: Bindings) {
  const bound = useRef(bindings); bound.current = bindings;
  const localRound = useRef<GameState | null>(null), epoch = useRef(0);
  useEffect(() => () => { epoch.current++; }, []);
  const onExit = () => {
    epoch.current++;
    const b = bound.current;
    if (localRound.current) { b.gameRef.current = localRound.current; b.setGame(localRound.current); b.setDiceFace(localRound.current.lastRoll); }
    localRound.current = null;
    b.setWalking(null); b.setShot(null); b.setRolling(false); b.setFiring(false); b.setSelectedTargets([]);
  };
  const onUpdate = async (snapshot: RoomSnapshot, animate: boolean) => {
    const b = bound.current, before = b.gameRef.current;
    if (!localRound.current) localRound.current = before;
    const generation = ++epoch.current, event = snapshot.event;
    const visual = animate && AppState.currentState === "active" && event &&
      (event.kind === "roll" || event.effect || event.kind === "shoot");
    const reduced = await AccessibilityInfo.isReduceMotionEnabled();
    const wait = async (ms: number) => { await new Promise((resolve) => setTimeout(resolve, ms)); return generation === epoch.current; };
    b.setSelectedTargets([]);
    try {
      if (visual && event) {
        b.setRolling(true); b.focus("board");
        if (event.kind === "roll") {
          b.sounds.play("dice");
          for (let frame = 0; frame < (reduced ? 1 : 7); frame++) {
            b.setDiceFace(1 + Math.floor(Math.random() * 6));
            if (!await wait(reduced ? 40 : 85)) return;
          }
          b.setDiceFace(event.roll);
          for (const square of event.path) {
            b.setWalking({ playerId: event.playerId, position: square, isSpecialMove: false });
            b.sounds.play("step");
            if (!await wait(reduced ? 35 : 270)) return;
          }
        }
        if (event.kind === "shoot") {
          b.setFiring(true); b.setShot({ from: event.from, targets: event.targets as ShootableSnakeSquare[] });
          if (!await wait(reduced ? 150 : 1100)) return;
        }
        const moved = snapshot.game.players.find((player) => player.id === event.playerId)!;
        if (event.effect === "torch" || event.effect === "return") {
          b.setWalking({ playerId: moved.id, position: 100, isSpecialMove: false, effect: event.effect });
          if (!await wait(reduced ? 150 : 1100)) return;
          b.setWalking({ playerId: moved.id, position: 100, isSpecialMove: true, effect: "bamboo" });
          if (!await wait(reduced ? 45 : 200)) return;
          if (event.effect === "torch") b.sounds.play("happy");
          b.setWalking({ playerId: moved.id, position: 0, isSpecialMove: true, effect: "bamboo" });
          if (!await wait(reduced ? 45 : 2680)) return;
          b.setWalking({ playerId: moved.id, position: 0, isSpecialMove: true });
          if (!await wait(reduced ? 45 : 600)) return;
        } else if (event.effect) {
          if (event.effect === "snake" || event.effect === "ladder") b.sounds.play(event.effect);
          b.setWalking({ playerId: moved.id, position: moved.position, isSpecialMove: true, effect: event.effect });
          if (!await wait(reduced ? 45 : event.effect === "ladder" ? 2280 : event.effect === "snake" ? 2080 : 780)) return;
        }
      }
      if (generation !== epoch.current) return;
      if (animate && event) {
        const oldPlayer = before.players.find((player) => player.id === event.playerId);
        const newPlayer = snapshot.game.players.find((player) => player.id === event.playerId);
        if (oldPlayer && newPlayer) b.sounds.playPickups(oldPlayer, newPlayer);
      }
      b.gameRef.current = snapshot.game; b.setGame(snapshot.game); b.setDiceFace(snapshot.game.lastRoll);
      if (visual) b.focus(snapshot.game.pendingChoice?.kind === "mystery" ? "board" : "controls");
    } finally {
      if (generation === epoch.current) { b.setWalking(null); b.setShot(null); b.setRolling(false); b.setFiring(false); }
    }
  };
  return useOnlineRoom({ storage, enabled: bindings.ready, onUpdate, onExit }, React);
}