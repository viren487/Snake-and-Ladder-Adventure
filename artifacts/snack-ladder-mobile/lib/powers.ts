import type { GameState, TurnResolution } from "./game-engine";

export const MYSTERY_BOX_SQUARES = [14, 35, 51, 76] as const;
export const POWER_TYPES = ["bomb", "antiVenom", "defuser", "extraDice"] as const;
export type PowerType = (typeof POWER_TYPES)[number];
export type PowerInventory = Record<PowerType, number>;
export type PlantedBomb = { id: string; square: number; ownerId: string; armed: boolean };
export type PowerChoice =
  | { kind: "mystery"; playerId: string; square: number }
  | { kind: "snake"; playerId: string; square: number; to: number }
  | { kind: "bomb"; playerId: string; square: number; bombId: string | null; afterMystery?: boolean };
export const emptyPowers = (): PowerInventory => ({ bomb: 0, antiVenom: 0, defuser: 0, extraDice: 0 });
const emptyStuns = () => ({ 98: 0, 99: 0 });

export function cloneGame(state: GameState): GameState {
  return {
    ...state,
    bonusRollPending: state.bonusRollPending ?? false,
    pendingChoice: state.pendingChoice ? { ...state.pendingChoice } : null,
    bombs: (state.bombs ?? []).map((bomb) => ({ ...bomb })),
    players: state.players.map((player) => ({
      ...player,
      powers: { ...emptyPowers(), ...player.powers },
      extraRollCredits: player.extraRollCredits ?? 0,
      unlockedGates: [...(player.unlockedGates ?? [])],
      snakeStuns: { ...emptyStuns(), ...player.snakeStuns },
    })) as GameState["players"],
  };
}

/** Complete one roll only after every landing choice has been resolved. */
export function finishTurn(state: GameState): GameState {
  if (state.winnerId || state.pendingChoice || state.pendingFireForPlayerId) return state;
  const next = cloneGame(state);
  const player = next.players[next.currentPlayerIndex];
  if (next.bonusRollPending) {
    next.message += ` ${player.name} rolled a valid six and gets another chance!`;
  } else if (player.extraRollCredits > 0) {
    player.extraRollCredits -= 1;
    next.message += ` ${player.name}'s Extra Dice grants another roll!`;
  } else {
    next.currentPlayerIndex = (next.currentPlayerIndex + 1) % next.players.length;
    next.message += ` ${next.players[next.currentPlayerIndex].name} is up next.`;
  }
  next.bonusRollPending = false;
  return next;
}

function requireAction(state: GameState) {
  if (state.winnerId || state.pendingChoice || state.pendingFireForPlayerId) {
    throw new Error("Finish the current landing choice before using a power.");
  }
}

export function choosePower(state: GameState, power: PowerType): GameState {
  const choice = state.pendingChoice;
  const player = state.players[state.currentPlayerIndex];
  if (!choice || choice.kind !== "mystery" || choice.playerId !== player.id ||
    player.position !== choice.square || !(POWER_TYPES as readonly string[]).includes(power)) {
    throw new Error("Choose one power while stopped at a mystery box.");
  }
  const next = cloneGame(state);
  const recipient = next.players[next.currentPlayerIndex];
  recipient.powers[power] += 1;
  next.pendingChoice = null;
  next.message = `${recipient.name} chose ${power === "antiVenom" ? "Anti-Venom" : power === "extraDice" ? "Extra Dice" : power === "defuser" ? "a Bomb Defuser Kit" : "a Bomb"} from room ${choice.square}.`;
  const bomb = next.bombs.find((item) => item.ownerId !== recipient.id && item.square === recipient.position);
  if (power === "defuser" && bomb) {
    next.pendingChoice = { kind: "bomb", playerId: recipient.id, square: recipient.position, bombId: bomb.id, afterMystery: true };
    return next;
  }
  return finishTurn(next);
}

export function useExtraDice(state: GameState): GameState {
  requireAction(state);
  const next = cloneGame(state);
  const player = next.players[next.currentPlayerIndex];
  if (player.powers.extraDice < 1) throw new Error("No Extra Dice power is available.");
  player.powers.extraDice -= 1;
  player.extraRollCredits += 1;
  next.message = `${player.name} used Extra Dice. One additional roll is saved after the next roll; it is separate from the valid-six bonus.`;
  return next;
}

export function plantBomb(state: GameState, square: number): GameState {
  requireAction(state);
  if (!Number.isInteger(square) || square < 1 || square > 100) throw new RangeError("Choose a house from 1 to 100.");
  const next = cloneGame(state);
  const player = next.players[next.currentPlayerIndex];
  if (player.powers.bomb < 1) throw new Error("No bomb power is available.");
  if (next.bombs.some((bomb) => bomb.square === square)) throw new Error("A bomb is already planted in that house.");
  player.powers.bomb -= 1;
  next.bombs.push({ id: `${player.id}-${next.turnNumber}-${square}`, square, ownerId: player.id, armed: false });
  next.message = `${player.name} planted a bomb in house ${square}. Wait for the rival to stop there, then detonate it on your turn.`;
  return next;
}

export function detonateBomb(state: GameState, bombId: string): GameState {
  requireAction(state);
  const next = cloneGame(state);
  const owner = next.players[next.currentPlayerIndex];
  const bomb = next.bombs.find((item) => item.id === bombId && item.ownerId === owner.id);
  const rival = next.players.find((player) => player.id !== owner.id);
  if (!bomb || !rival || !bomb.armed || rival.position !== bomb.square) {
    throw new Error("The rival must stop in your bomb's house after planting before you can detonate it.");
  }
  rival.position = 0;
  next.bombs = next.bombs.filter((item) => item.id !== bomb.id);
  next.bombs.forEach((item) => { if (item.ownerId === owner.id) item.armed = false; });
  next.message = `${owner.name} detonated the bomb in house ${bomb.square}! ${rival.name} returned Home, keeping their torch, key and inventory.`;
  return next;
}

export function resolveDefenseWith(
  state: GameState,
  use: boolean,
  completeLanding: (state: GameState, skipBomb: boolean) => TurnResolution,
): TurnResolution {
  const choice = state.pendingChoice;
  const player = state.players[state.currentPlayerIndex];
  if (!choice || choice.kind === "mystery" || choice.playerId !== player.id || choice.square !== player.position) {
    throw new Error("No defensive power choice is waiting.");
  }
  const next = cloneGame(state);
  const defender = next.players[next.currentPlayerIndex];
  next.pendingChoice = null;
  let effect: TurnResolution["effect"] = null;
  if (choice.kind === "snake") {
    if (use) {
      if (defender.powers.antiVenom < 1) throw new Error("No Anti-Venom is available.");
      defender.powers.antiVenom -= 1;
      next.message = `${defender.name} used Anti-Venom and avoided this bite at ${choice.square}.`;
    } else {
      defender.position = choice.to;
      effect = "snake";
      next.message = `${defender.name} kept their Anti-Venom and slid from ${choice.square} to ${choice.to}.`;
    }
  } else {
    if (use) {
      if (defender.powers.defuser < 1) throw new Error("No Bomb Defuser Kit is available.");
      defender.powers.defuser -= 1;
      next.bombs = next.bombs.filter((bomb) => bomb.id !== choice.bombId &&
        !(choice.bombId === null && bomb.square === 97 && bomb.ownerId !== defender.id));
      next.message = `${defender.name} used a Bomb Defuser Kit and stayed safely in house ${choice.square}.`;
    } else if (choice.bombId === null) {
      defender.position = 0;
      effect = "boom";
      next.message = `${defender.name} kept the kit; the boom at 97 sent them Home.`;
    } else {
      next.message = `${defender.name} kept the kit. The planted bomb remains armed in house ${choice.square}.`;
    }
    if (choice.afterMystery) return { state: finishTurn(next), path: [], effect };
  }
  const resolved = completeLanding(next, choice.kind === "bomb");
  return { ...resolved, effect: resolved.effect ?? effect };
}

export function isValidPowerState(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const state = value as GameState;
  if (!Array.isArray(state.players)) return false;
  const count = (item: unknown) => Number.isSafeInteger(item) && (item as number) >= 0;
  if (!state.players.every((player) =>
    (player.powers === undefined || (player.powers !== null && typeof player.powers === "object" &&
      POWER_TYPES.every((power) => count(player.powers[power])))) &&
    (player.extraRollCredits === undefined || count(player.extraRollCredits)))) return false;
  if (state.bonusRollPending !== undefined && typeof state.bonusRollPending !== "boolean") return false;
  if (state.bombs !== undefined) {
    if (!Array.isArray(state.bombs) || state.bombs.length > 100 ||
      !state.bombs.every((bomb) => bomb && typeof bomb.id === "string" &&
        state.players.some((player) => player.id === bomb.ownerId) &&
        Number.isInteger(bomb.square) && bomb.square >= 1 && bomb.square <= 100 &&
        typeof bomb.armed === "boolean") ||
      new Set(state.bombs.map((bomb) => bomb.id)).size !== state.bombs.length ||
      new Set(state.bombs.map((bomb) => bomb.square)).size !== state.bombs.length) return false;
  }
  const choice = state.pendingChoice;
  if (choice === undefined || choice === null) return true;
  if (!choice || typeof choice !== "object" || state.winnerId || state.pendingFireForPlayerId ||
    choice.playerId !== state.players[state.currentPlayerIndex]?.id ||
    choice.square !== state.players[state.currentPlayerIndex]?.position) return false;
  if (choice.kind === "mystery") return (MYSTERY_BOX_SQUARES as readonly number[]).includes(choice.square);
  if (choice.kind === "snake") return [
    [99, 61], [98, 77], [72, 52], [58, 43], [36, 25],
  ].some(([from, to]) => choice.square === from && choice.to === to);
  return choice.kind === "bomb" &&
    (choice.afterMystery === undefined || typeof choice.afterMystery === "boolean") &&
    (choice.bombId === null ? choice.square === 97 :
      (state.bombs ?? []).some((bomb) => bomb.id === choice.bombId && bomb.square === choice.square &&
        bomb.ownerId !== choice.playerId));
}