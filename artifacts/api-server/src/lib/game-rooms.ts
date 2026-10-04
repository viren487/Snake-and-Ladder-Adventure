import { createHash, randomBytes, randomInt } from "node:crypto";
import { pool } from "@workspace/db";
import { createGame, resolveTurn, resolveDefense, choosePower, plantBomb, detonateBomb,
  useExtraDice, shootSnakes, passFire, isValidPowerState, type GameState } from "@workspace/game-core";
import type { RoomEvent, RoomSnapshot, RoomSession } from "@workspace/game-core/online";
import type { RoomAction } from "@workspace/api-zod";

export class RoomError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
type Member = { id: string; name: string; tokenHash: string; lastSeen: number };
type StoredRoom = {
  code: string; status: RoomSnapshot["status"]; version: number; game: GameState;
  members: Member[]; receipts: { id: string; playerId: string }[];
  transition: RoomEvent | null; rematch_votes: string[]; ready_at: Date;
};
const digest = (token: string) => createHash("sha256").update(token).digest("hex");
const nameFor = (name: string | undefined, fallback: string) => (name?.trim() || fallback).slice(0, 24);
const newToken = () => randomBytes(32).toString("hex");
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newCode = () => Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join("");

export function roomSnapshot(room: StoredRoom, member: Member): RoomSnapshot {
  return {
    code: room.code, status: room.status, version: room.version, game: room.game,
    members: room.members.map(({ id, name, lastSeen }) => ({ id, name, online: Date.now() - lastSeen < 25_000 })),
    yourPlayerId: member.id, rematchVotes: room.rematch_votes, event: room.transition,
    busyForMs: Math.max(0, room.ready_at.getTime() - Date.now()),
  };
}
function authenticate(room: StoredRoom, token: string) {
  const member = room.members.find((item) => item.tokenHash === digest(token));
  if (!member) throw new RoomError(403, "This device does not own a seat in this room. Return to local play or use the original device.");
  member.lastSeen = Date.now();
  return member;
}
async function locked<T>(code: string, callback: (room: StoredRoom) => T): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<StoredRoom>("SELECT * FROM game_rooms WHERE code = $1 FOR UPDATE", [code]);
    const room = result.rows[0];
    if (!room) throw new RoomError(404, "Room not found. Check the six-character code.");
    if (!room.game?.players || !isValidPowerState(room.game)) throw new RoomError(500, "This saved online round could not be read safely.");
    const answer = callback(room);
    await client.query(`UPDATE game_rooms SET status=$2, version=$3, game=$4::jsonb,
      members=$5::jsonb, receipts=$6::jsonb, transition=$7::jsonb,
      rematch_votes=$8::jsonb, ready_at=$9, updated_at=now() WHERE code=$1`,
    [code, room.status, room.version, JSON.stringify(room.game), JSON.stringify(room.members),
      JSON.stringify(room.receipts), JSON.stringify(room.transition), JSON.stringify(room.rematch_votes), room.ready_at]);
    await client.query("COMMIT");
    return answer;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

export async function createRoom(name?: string): Promise<{ session: RoomSession; room: RoomSnapshot }> {
  const token = newToken();
  const member: Member = { id: "player-1", name: nameFor(name, "Player 1"), tokenHash: digest(token), lastSeen: Date.now() };
  const game = createGame();
  game.players[0].name = member.name;
  const stored: StoredRoom = { code: "", status: "waiting", version: 0, game, members: [member],
    receipts: [], transition: null, rematch_votes: [], ready_at: new Date() };
  for (let attempt = 0; attempt < 8; attempt++) {
    stored.code = newCode();
    const result = await pool.query(`INSERT INTO game_rooms (code,status,version,game,members,receipts,
      transition,rematch_votes,ready_at) VALUES ($1,$2,0,$3::jsonb,$4::jsonb,'[]'::jsonb,null,'[]'::jsonb,now())
      ON CONFLICT (code) DO NOTHING RETURNING code`,
    [stored.code, stored.status, JSON.stringify(game), JSON.stringify(stored.members)]);
    if (result.rowCount) return { session: { code: stored.code, token, playerId: member.id }, room: roomSnapshot(stored, member) };
  }
  throw new RoomError(503, "Could not allocate a room code. Please try again.");
}
export async function joinRoom(code: string, name?: string) {
  const token = newToken();
  return locked(code, (room) => {
    if (room.status === "closed") throw new RoomError(410, "This room has ended. Create a new room.");
    if (room.members.length >= 2) throw new RoomError(409, "This room already has two players.");
    const member: Member = { id: "player-2", name: nameFor(name, "Player 2"), tokenHash: digest(token), lastSeen: Date.now() };
    room.members.push(member);
    room.game.players[1].name = member.name;
    room.game.message = `${room.game.players[0].name} and ${member.name} are connected. ${room.game.players[0].name} rolls first.`;
    room.status = "playing"; room.version++;
    room.transition = { kind: "join", playerId: member.id, from: 0, roll: null, path: [], effect: null, targets: [] };
    return { session: { code, token, playerId: member.id }, room: roomSnapshot(room, member) };
  });
}
export async function readRoom(code: string, token: string) {
  return locked(code, (room) => roomSnapshot(room, authenticate(room, token)));
}

export function applyRoomAction(room: StoredRoom, member: Member, action: RoomAction, rollDice = () => randomInt(1, 7)): void {
  if (room.receipts.some((receipt) => receipt.id === action.actionId && receipt.playerId === member.id)) return;
  if (room.status === "closed") {
    if (action.type === "leave") return;
    throw new RoomError(410, "This room has ended.");
  }
  if (action.type !== "leave" && action.expectedVersion !== room.version) throw new RoomError(409, "The round changed. Syncing the latest move; try again.");
  const player = room.game.players.find((item) => item.id === member.id)!;
  const event: RoomEvent = { kind: action.type, playerId: member.id, from: player.position,
    roll: null, path: [], effect: null, targets: [] };
  if (action.type === "leave") {
    room.status = "closed";
    room.game = { ...room.game, message: `${member.name} left. This online room has ended.` };
  } else if (action.type === "rematch") {
    if (room.status !== "finished") throw new RoomError(400, "Finish this round before requesting a rematch.");
    if (!room.rematch_votes.includes(member.id)) room.rematch_votes.push(member.id);
    if (room.rematch_votes.length === 2) {
      room.game = createGame();
      room.members.forEach((item, index) => { room.game.players[index].name = item.name; });
      room.game.message = `New round! ${room.game.players[0].name} rolls first.`;
      room.status = "playing"; room.rematch_votes = []; room.ready_at = new Date();
    }
  } else {
    if (room.status !== "playing" || room.members.length !== 2) throw new RoomError(409, "Wait for your friend to join before playing.");
    if (room.members.some((item) => Date.now() - item.lastSeen >= 25_000)) throw new RoomError(409, "Your friend is reconnecting. The round is saved; wait for them.");
    if (action.type !== "detonate" && room.game.players[room.game.currentPlayerIndex].id !== member.id) throw new RoomError(403, "It is your friend's turn.");
    if (room.ready_at.getTime() > Date.now()) throw new RoomError(409, "Wait for the current animation to finish.");
    switch (action.type) {
      case "roll": {
        if (room.game.pendingChoice || room.game.pendingFireForPlayerId) throw new RoomError(409, "Finish the landing choice before rolling.");
        const roll = rollDice();
        const result = resolveTurn(room.game, roll);
        room.game = result.state; event.roll = roll; event.path = result.path; event.effect = result.effect;
        break;
      }
      case "choose":
        if (!action.power) throw new RoomError(400, "Select one mystery power.");
        room.game = choosePower(room.game, action.power); break;
      case "defense": {
        if (typeof action.use !== "boolean") throw new RoomError(400, "Choose whether to use the defense.");
        const result = resolveDefense(room.game, action.use);
        room.game = result.state; event.effect = result.effect; break;
      }
      case "plant": room.game = plantBomb(room.game, action.square!); break;
      case "detonate": {
        const rival = room.game.players.find((item) => item.id !== member.id)!;
        event.playerId = rival.id; event.from = rival.position; event.effect = "boom";
        room.game = detonateBomb(room.game, action.bombId!, member.id); break;
      }
      case "extraDice": room.game = useExtraDice(room.game); break;
      case "shoot":
        event.targets = action.targets ?? [];
        room.game = shootSnakes(room.game, event.targets as (98 | 99)[]); break;
      case "pass": room.game = passFire(room.game); break;
    }
    if (room.game.winnerId) room.status = "finished";
    const specialMs = event.effect === "ladder" ? 2700 : event.effect === "snake" ? 2400 :
      event.effect === "torch" || event.effect === "return" ? 2200 : event.effect === "boom" ? 1100 : 0;
    room.ready_at = new Date(Date.now() + (event.kind === "roll" ? 950 + event.path.length * 240 + specialMs :
      event.kind === "shoot" ? 1500 : specialMs));
  }
  room.version++; room.transition = event;
  room.receipts.push({ id: action.actionId, playerId: member.id });
  room.receipts = room.receipts.slice(-64);
}
export async function actInRoom(code: string, token: string, action: RoomAction) {
  return locked(code, (room) => {
    const member = authenticate(room, token);
    try { applyRoomAction(room, member, action); }
    catch (error) { if (error instanceof RoomError) throw error; throw new RoomError(400, error instanceof Error ? error.message : "This action is not allowed."); }
    return roomSnapshot(room, member);
  });
}