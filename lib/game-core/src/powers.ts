import type { GameState, TurnResolution } from "./game-engine";

export const MYSTERY_BOX_SQUARES = [14, 35, 51, 76] as const;
export const MYSTERY_POWER_TYPES = ["bomb", "antiVenom", "defuser", "webShooter", "knife"] as const;
export const POWER_TYPES = [...MYSTERY_POWER_TYPES, "extraDice"] as const;
export type PowerType = (typeof POWER_TYPES)[number];
export type MysteryPowerType = (typeof MYSTERY_POWER_TYPES)[number];
export type PowerInventory = Record<PowerType, number>;
export type PlantedBomb = { id: string; square: number; ownerId: string; armed: boolean };
export type PowerChoice =
  | { kind: "mystery"; playerId: string; square: number }
  | { kind: "snake"; playerId: string; square: number; to: number }
  | { kind: "bomb"; playerId: string; square: number; bombId: string | null; afterMystery?: boolean };
export const emptyPowers = (): PowerInventory => ({
  bomb: 0, antiVenom: 0, defuser: 0, webShooter: 0, knife: 0, extraDice: 0,
});
const emptyStuns = () => ({ 98: 0, 99: 0 });

export function cloneGame(state: GameState): GameState {
  return {
    ...state,
    winnerIds: [...(state.winnerIds ?? (state.winnerId ? [state.winnerId] : []))],
    loserId: state.loserId ?? null,
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
  if (!next.winnerIds.includes(player.id) && next.bonusRollPending) {
    next.message += ` ${player.name} rolled a valid six and gets another chance!`;
  } else if (!next.winnerIds.includes(player.id) && player.extraRollCredits > 0) {
    player.extraRollCredits -= 1;
    next.message += ` ${player.name}'s Extra Dice grants another roll!`;
  } else {
    do { next.currentPlayerIndex = (next.currentPlayerIndex + 1) % next.players.length; }
    while (next.winnerIds.includes(next.players[next.currentPlayerIndex].id));
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

export function choosePower(state: GameState, power: MysteryPowerType): GameState {
  const choice = state.pendingChoice;
  const player = state.players[state.currentPlayerIndex];
  if (!choice || choice.kind !== "mystery" || choice.playerId !== player.id ||
    player.position !== choice.square || !(MYSTERY_POWER_TYPES as readonly string[]).includes(power)) {
    throw new Error("Choose one power while stopped at a mystery box.");
  }
  const next = cloneGame(state);
  const recipient = next.players[next.currentPlayerIndex];
  recipient.powers[power] += 1;
  next.pendingChoice = null;
  const names: Record<MysteryPowerType, string> = {
    bomb: "a Bomb",
    antiVenom: "Anti-Venom",
    defuser: "a Bomb Defuser Kit",
    webShooter: "a Web Shooter",
    knife: "a Knife",
  };
  next.message = `${recipient.name} chose ${names[power]} from room ${choice.square}.`;
  // A newly chosen kit can protect the player before their turn is handed over.
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

function requireWeaponTarget(state: GameState, targetPlayerId: string) {
  requireAction(state);
  const attacker = state.players[state.currentPlayerIndex];
  if (!attacker || (state.winnerIds ?? []).includes(attacker.id)) {
    throw new Error("Only an active player can use a weapon.");
  }
  const target = state.players.find((player) => player.id === targetPlayerId);
  if (!target || target.id === attacker.id || (state.winnerIds ?? []).includes(target.id)) {
    throw new Error("Choose an active rival.");
  }
  return { attacker, target };
}

/** Pull a rival who is one to three rooms ahead back by up to three rooms. */
export function useWebShooter(state: GameState, targetPlayerId: string): TurnResolution {
  const { attacker, target } = requireWeaponTarget(state, targetPlayerId);
  if ((attacker.powers.webShooter ?? 0) < 1) throw new Error("No Web Shooter power is available.");
  if (target.position < 1 || target.position <= attacker.position || target.position - attacker.position > 3) {
    throw new Error("The rival must be one to three rooms ahead.");
  }

  const next = cloneGame(state);
  const shooter = next.players[next.currentPlayerIndex];
  const victim = next.players.find((player) => player.id === targetPlayerId)!;
  const from = victim.position;
  const destination = Math.max(0, from - 3);
  const path = Array.from({ length: from - destination }, (_, index) => from - index - 1);
  shooter.powers.webShooter = (shooter.powers.webShooter ?? 0) - 1;
  victim.position = destination;
  next.message = `${shooter.name} fired a Web Shooter at ${victim.name}, pulling them back three rooms from ${from} to ${destination || "Home"}.`;
  return { state: next, path, effect: "web", sourcePosition: attacker.position };
}

/** Strike a rival in the same numbered room. A rival's Knife blocks the hit. */
export function useKnife(state: GameState, targetPlayerId: string): TurnResolution {
  const { attacker, target } = requireWeaponTarget(state, targetPlayerId);
  if ((attacker.powers.knife ?? 0) < 1) throw new Error("No Knife power is available.");
  if (attacker.position < 1 || target.position !== attacker.position) {
    throw new Error("Use a Knife only against a rival in the same numbered room.");
  }

  const next = cloneGame(state);
  const striker = next.players[next.currentPlayerIndex];
  const victim = next.players.find((player) => player.id === targetPlayerId)!;
  if ((victim.powers.knife ?? 0) > 0) {
    next.message = `${striker.name} and ${victim.name} clashed Knives. No effect; neither charge was spent.`;
    return { state: next, path: [], effect: null, sourcePosition: attacker.position };
  }

  striker.powers.knife = (striker.powers.knife ?? 0) - 1;
  victim.position = 0;
  next.message = `${striker.name} struck ${victim.name} with a Knife, sending them Home. Their torch, key and inventory remain.`;
  return { state: next, path: [0], effect: "knife", sourcePosition: attacker.position };
}

export function plantBomb(state: GameState, square: number): GameState {
  requireAction(state);
  if (!Number.isInteger(square) || square < 1 || square > 100) throw new RangeError("Choose a house from 1 to 100.");
  const next = cloneGame(state);
  const player = next.players[next.currentPlayerIndex];
  if (square !== player.position) throw new Error("Plant a bomb only in the room where your panda is standing.");
  if (player.powers.bomb < 1) throw new Error("No bomb power is available.");
  if (next.bombs.some((bomb) => bomb.square === square)) throw new Error("A bomb is already planted in that house.");
  player.powers.bomb -= 1;
  next.bombs.push({ id: `${player.id}-${next.turnNumber}-${square}`, square, ownerId: player.id, armed: false });
  next.message = `${player.name} planted a bomb in house ${square}. Wait for the rival to stop there, then use your bomb.`;
  return next;
}

export function detonateBomb(state: GameState, bombId: string, ownerId = state.players[state.currentPlayerIndex].id): GameState {
  requireAction(state);
  const next = cloneGame(state);
  const owner = next.players.find((player) => player.id === ownerId);
  if (!owner || next.winnerIds.includes(ownerId)) throw new Error("Only an active player who planted this bomb can use it.");
  const bomb = next.bombs.find((item) => item.id === bombId && item.ownerId === owner.id);
  const rivals = bomb ? next.players.filter((player) => player.id !== owner.id && player.position === bomb.square && !next.winnerIds.includes(player.id)) : [];
  const rival = rivals[0];
  if (!bomb || !rival || !bomb.armed || rival.position !== bomb.square) {
    throw new Error("The rival must stop in your bomb's house after planting before you can detonate it.");
  }
  rivals.forEach((player) => { player.position = 0; });
  next.bombs = next.bombs.filter((item) => item.id !== bomb.id);
  // A reset also disarms any other bomb whose victim is no longer on its house.
  next.bombs.forEach((item) => { if (item.ownerId === owner.id) item.armed = false; });
  next.message = `${owner.name} detonated the bomb in house ${bomb.square}! ${rivals.map((p) => p.name).join(", ")} returned Home, keeping their torch, key and inventory.`;
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

/** Legacy saves may omit fields; present, malformed power data must be rejected. */
export function isValidPowerState(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const state = value as GameState;
  if (!Array.isArray(state.players)) return false;
  const count = (item: unknown) => Number.isSafeInteger(item) && (item as number) >= 0;
  if (!state.players.every((player) =>
    (player.powers === undefined || (player.powers !== null && typeof player.powers === "object" &&
      POWER_TYPES.every((power) => player.powers[power] === undefined || count(player.powers[power])))) &&
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
  if (state.winnerIds !== undefined) {
    if (!Array.isArray(state.winnerIds) || state.winnerIds.length > state.players.length - 1 || new Set(state.winnerIds).size !== state.winnerIds.length || !state.winnerIds.every((id) => state.players.some((p) => p.id === id && p.position === 100 && p.hasTorch && [17,44,67].includes(p.crownKeyRoom ?? -1)))) return false;
    const finished = state.winnerIds.length === state.players.length - 1;
    if (finished ? state.winnerId !== state.winnerIds[0] || state.loserId !== state.players.find((p) => !state.winnerIds.includes(p.id))?.id : !!state.winnerId || !!state.loserId || state.winnerIds.includes(state.players[state.currentPlayerIndex]?.id)) return false;
  }
  const choice = state.pendingChoice;
  if (choice === undefined || choice === null) return true;
  if (!choice || typeof choice !== "object" || state.winnerId || state.pendingFireForPlayerId ||
    choice.playerId !== state.players[state.currentPlayerIndex]?.id ||
    choice.square !== state.players[state.currentPlayerIndex]?.position) return false;
  if (choice.kind === "mystery") return (MYSTERY_BOX_SQUARES as readonly number[]).includes(choice.square);
  if (choice.kind === "snake") return [
    [99, 61], [98, 77], [72, 52], [68, 11], [58, 43], [36, 25],
  ].some(([from, to]) => choice.square === from && choice.to === to);
  return choice.kind === "bomb" &&
    (choice.afterMystery === undefined || typeof choice.afterMystery === "boolean") &&
    (choice.bombId === null ? choice.square === 97 :
      (state.bombs ?? []).some((bomb) => bomb.id === choice.bombId && bomb.square === choice.square &&
        bomb.ownerId !== choice.playerId));
}