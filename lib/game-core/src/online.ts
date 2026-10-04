import type { GameState, TurnResolution } from "./game-engine.ts";

export type RoomSession = { code: string; token: string; playerId: string };
export type RoomChatMessage = {
  id: string;
  playerId: string;
  playerName: string;
  text: string;
  sentAt: string;
};
export type RoomVoiceSignal = {
  id: string;
  fromPlayerId: string;
  toPlayerId: string;
  callId: string;
  type: "offer" | "answer" | "hangup";
  sdp?: string;
  sentAt: string;
};
export type RoomCommunicationInput =
  | { type: "chat"; text: string }
  | { type: "offer" | "answer"; targetPlayerId: string; callId: string; sdp: string }
  | { type: "hangup"; targetPlayerId: string; callId: string };
export type RoomEvent = {
  kind: "roll" | "choose" | "defense" | "plant" | "detonate" | "extraDice" | "shoot" | "web" | "knife" | "pass" | "rematch" | "join" | "leave";
  playerId: string;
  from: number;
  roll: number | null;
  path: number[];
  effect: TurnResolution["effect"];
  targets: number[];
  sourcePlayerId?: string;
  sourcePosition?: number;
};
export type RoomSnapshot = {
  code: string;
  status: "waiting" | "playing" | "finished" | "closed";
  version: number;
  game: GameState;
  maxPlayers: number;
  members: { id: string; name: string; online: boolean }[];
  yourPlayerId: string;
  rematchVotes: string[];
  event: RoomEvent | null;
  busyForMs: number;
  chatMessages: RoomChatMessage[];
  voiceSignals: RoomVoiceSignal[];
};