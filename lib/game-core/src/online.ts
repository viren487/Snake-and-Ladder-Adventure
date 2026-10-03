import type { GameState, TurnResolution } from "./game-engine.ts";

export type RoomSession = { code: string; token: string; playerId: string };
export type RoomEvent = {
  kind: "roll" | "choose" | "defense" | "plant" | "detonate" | "extraDice" | "shoot" | "pass" | "rematch" | "join" | "leave";
  playerId: string;
  from: number;
  roll: number | null;
  path: number[];
  effect: TurnResolution["effect"];
  targets: number[];
};
export type RoomSnapshot = {
  code: string;
  status: "waiting" | "playing" | "finished" | "closed";
  version: number;
  game: GameState;
  members: { id: string; name: string; online: boolean }[];
  yourPlayerId: string;
  rematchVotes: string[];
  event: RoomEvent | null;
  busyForMs: number;
};