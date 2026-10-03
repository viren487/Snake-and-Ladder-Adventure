import { cloneGame, emptyPowers, finishTurn, MYSTERY_BOX_SQUARES, resolveDefenseWith,
  type PowerInventory, type PlantedBomb, type PowerChoice } from "./powers.ts";
export { choosePower, plantBomb, detonateBomb, useExtraDice, isValidPowerState, MYSTERY_BOX_SQUARES, POWER_TYPES } from "./powers.ts";
export type { PowerType } from "./powers.ts";

export type Player = {
  id: string;
  name: string;
  color: "blue" | "coral";
  position: number;
  keys: number;
  hasTorch: boolean;
  crownKeyRoom: number | null;
  legacyKeys?: number;
  powers: PowerInventory;
  extraRollCredits: number;
  unlockedGates: number[];
  bullets: number;
  snakeStuns: Record<ShootableSnakeSquare, number>;
};

export type GameState = {
  players: [Player, Player];
  currentPlayerIndex: number;
  lastRoll: number | null;
  turnNumber: number;
  winnerId: string | null;
  message: string;
  pendingFireForPlayerId: string | null;
  pendingChoice: PowerChoice | null;
  bombs: PlantedBomb[];
  bonusRollPending: boolean;
};

export const SNAKES = [
  { from: 99, to: 61, color: "violet" },
  { from: 98, to: 77, color: "green" },
  { from: 72, to: 52, color: "red" },
  { from: 58, to: 43, color: "blue" },
  { from: 36, to: 25, color: "orange" },
] as const;

export const LADDERS = [
  { from: 13, to: 28 },
  { from: 22, to: 40 },
  { from: 31, to: 50 },
  { from: 46, to: 66 },
  { from: 59, to: 62 },
  { from: 74, to: 87 },
] as const;

export const KEY_SQUARES = [17, 44, 67] as const;
export const EXTRA_BULLET_SQUARES = [61, 77] as const;
export const BULLET_PICKUP_SQUARES = [6, 12, 25, 38, 63, 89, ...EXTRA_BULLET_SQUARES] as const;
export const BOOM_SQUARE = 97 as const;
export const LOCKED_SQUARES = [17, 44, 67] as const;
export const GUN_SQUARES = [94, 95, 96] as const;
export const SHOOTABLE_SNAKE_SQUARES = [98, 99] as const;
export type ShootableSnakeSquare = (typeof SHOOTABLE_SNAKE_SQUARES)[number];
export const MAX_BULLETS = 5;
export const SNAKE_STUN_ROLLS = 3;

const emptySnakeStuns = (): Record<ShootableSnakeSquare, number> => ({ 98: 0, 99: 0 });

export function createGame(): GameState {
  return {
    players: [
      { id: "player-1", name: "Player 1", color: "blue", position: 0, keys: 0, hasTorch: false, crownKeyRoom: null, unlockedGates: [], bullets: 0, snakeStuns: emptySnakeStuns(), powers: emptyPowers(), extraRollCredits: 0 },
      { id: "player-2", name: "Player 2", color: "coral", position: 0, keys: 0, hasTorch: false, crownKeyRoom: null, unlockedGates: [], bullets: 0, snakeStuns: emptySnakeStuns(), powers: emptyPowers(), extraRollCredits: 0 },
    ],
    currentPlayerIndex: 0,
    lastRoll: null,
    turnNumber: 1,
    winnerId: null,
    message: "Player 1 is ready. First reach 100 for a torch; the crown stays locked until you collect a black-room key and return to 100.",
    pendingFireForPlayerId: null,
    pendingChoice: null,
    bombs: [],
    bonusRollPending: false,
  };
}

/** Convert a visual grid position (top row first) into the board's 1–100 number. */
export function squareAt(rowFromTop: number, column: number): number {
  if (
    !Number.isInteger(rowFromTop) ||
    !Number.isInteger(column) ||
    rowFromTop < 0 ||
    rowFromTop > 9 ||
    column < 0 ||
    column > 9
  ) {
    throw new RangeError("Board row and column must be integers from 0 to 9.");
  }

  const rowFromBottom = 9 - rowFromTop;
  const base = rowFromBottom * 10 + 1;
  return rowFromBottom % 2 === 0 ? base + column : base + (9 - column);
}

export type TurnResolution = {
  state: GameState;
  path: number[];
  effect: "snake" | "ladder" | "boom" | "torch" | "return" | null;
};

/** Preserve old progress without treating former ammo-room keys as crown keys. */
export function repairLegacyGame(state: GameState): GameState {
  const legacyQuest = state.players.some((player) => player.hasTorch === undefined);
  const players = state.players.map((player) => {
    const legacy = player.hasTorch === undefined;
    const hasTorch = legacy ? player.position === 100 : player.hasTorch;
    const crownKeyRoom = !legacy && hasTorch &&
      (KEY_SQUARES as readonly number[]).includes(player.crownKeyRoom ?? -1)
      ? player.crownKeyRoom : null;
    return {
      ...player,
      powers: { ...emptyPowers(), ...player.powers },
      extraRollCredits: player.extraRollCredits ?? 0,
      hasTorch,
      crownKeyRoom,
      keys: crownKeyRoom === null ? 0 : 1,
      ...(legacy ? { legacyKeys: player.keys } : {}),
      position: player.position === 100 && (!hasTorch || crownKeyRoom === null) &&
        !(state.pendingChoice?.kind === "bomb" && state.pendingChoice.playerId === player.id && state.pendingChoice.square === 100)
        ? 0 : player.position,
      unlockedGates: [...(player.unlockedGates ?? [])],
      bullets: Math.min(MAX_BULLETS, Math.max(0, player.bullets ?? 0)),
      snakeStuns: { ...emptySnakeStuns(), ...(player.snakeStuns ?? {}) },
    };
  }) as [Player, Player];
  const pendingShooter = players.find((player) => player.id === state.pendingFireForPlayerId);
  const validPendingShot = pendingShooter &&
    (GUN_SQUARES as readonly number[]).includes(pendingShooter.position);
  const nextPlayerIndex = state.pendingFireForPlayerId && !validPendingShot
    ? (state.currentPlayerIndex + 1) % state.players.length
    : state.currentPlayerIndex;
  return {
    ...state,
    bombs: (state.bombs ?? []).map((bomb) => ({ ...bomb })),
    pendingChoice: state.pendingChoice ?? null,
    bonusRollPending: state.bonusRollPending ?? false,
    players,
    winnerId: players.some((player) => player.id === state.winnerId &&
      player.position === 100 && player.hasTorch && player.crownKeyRoom !== null)
      ? state.winnerId : null,
    currentPlayerIndex: nextPlayerIndex,
    message: state.pendingFireForPlayerId && !validPendingShot
      ? `${state.players[nextPlayerIndex].name} is up next. Fire is available only from a gun room.`
      : legacyQuest
        ? "Torch quest: first reach 100 for a torch, then land in black room 17, 44 or 67 for one key, and return to 100 for the crown. Previous ammo-room keys are not crown keys."
        : state.message,
    pendingFireForPlayerId: validPendingShot ? state.pendingFireForPlayerId : null,
  };
}

/** Return the actual squares walked so the UI animates exactly what the rules resolve. */
export function resolveTurn(state: GameState, roll: number): TurnResolution {
  if (!Number.isInteger(roll) || roll < 1 || roll > 6) {
    throw new RangeError("A dice roll must be an integer from 1 to 6.");
  }
  if (state.winnerId || state.pendingFireForPlayerId || state.pendingChoice) return { state, path: [], effect: null };

  const player = state.players[state.currentPlayerIndex];
  const next = cloneGame(state);
  const movingPlayer = next.players[state.currentPlayerIndex];
  const target = player.position + roll;
  next.lastRoll = roll;
  next.turnNumber += 1;
  next.bonusRollPending = roll === 6 && target <= 100;
  const path: number[] = [];
  let effect: TurnResolution["effect"] = null;
  let message: string;
  const originalSnakeStuns = { ...movingPlayer.snakeStuns };
  for (const snakeSquare of SHOOTABLE_SNAKE_SQUARES) {
    movingPlayer.snakeStuns[snakeSquare] = Math.max(0, originalSnakeStuns[snakeSquare] - 1);
  }

  if (target > 100) {
    message = `${player.name} needs an exact roll to reach 100.`;
  } else {
    for (let square = player.position + 1; square <= target; square += 1) {
      path.push(square);
      movingPlayer.position = square;
    }

    message = `${player.name} moved to square ${movingPlayer.position}.`;
    const landing = movingPlayer.position;
    const snake = SNAKES.find((item) => item.from === landing);
    const snakeTarget = snake && (SHOOTABLE_SNAKE_SQUARES as readonly number[]).includes(snake.from)
      ? snake.from as ShootableSnakeSquare
      : null;
    const snakeIsStunned = snakeTarget !== null && originalSnakeStuns[snakeTarget] > 0;
    const ladder = SNAKES.some((item) => item.from === landing)
      ? undefined
      : LADDERS.find((item) => item.from === landing);

    if (snake && snakeIsStunned) {
      message = `${player.name} passed the stunned snake at ${snake.from}.`;
    } else if (snake && movingPlayer.powers.antiVenom > 0) {
      next.pendingChoice = { kind: "snake", playerId: player.id, square: snake.from, to: snake.to };
      next.message = `${player.name} reached snake ${snake.from}. Use Anti-Venom for this bite, or slide down.`;
      return { state: next, path, effect: null };
    } else if (snake) {
      effect = "snake";
      movingPlayer.position = snake.to;
      message = `${player.name} slid down from ${snake.from} to ${snake.to}.`;
    } else if (ladder) {
      effect = "ladder";
      movingPlayer.position = ladder.to;
      message = `${player.name} climbed from ${ladder.from} to ${ladder.to}.`;
    }

    next.message = message;
    const resolved = completeLanding(next);
    return { ...resolved, path, effect: resolved.effect ?? effect };
  }
  next.message = message;
  return { state: finishTurn(next), path, effect };
}

/** Landing rewards and choices run once, after a snake/defuser decision. */
function completeLanding(next: GameState, skipBomb = false): TurnResolution {
  const movingPlayer = next.players[next.currentPlayerIndex];
  let message = next.message;
  let effect: TurnResolution["effect"] = null;
  next.bombs.forEach((bomb) => {
    if (bomb.ownerId !== movingPlayer.id) bomb.armed = bomb.square === movingPlayer.position;
  });
  const plantedBomb = next.bombs.find((bomb) => bomb.ownerId !== movingPlayer.id && bomb.square === movingPlayer.position);
  if (!skipBomb && movingPlayer.powers.defuser > 0 && (movingPlayer.position === BOOM_SQUARE || plantedBomb)) {
    next.pendingChoice = { kind: "bomb", playerId: movingPlayer.id, square: movingPlayer.position,
      bombId: movingPlayer.position === BOOM_SQUARE ? null : plantedBomb!.id };
    next.message = `${movingPlayer.name} stopped in a bomb room. Use a Defuser Kit or keep it.`;
    return { state: next, path: [], effect: null };
  }
    if (movingPlayer.position === BOOM_SQUARE && !skipBomb) {
      effect = "boom";
      movingPlayer.position = 0;
      message = `${movingPlayer.name} hit the boom on square ${BOOM_SQUARE} and returned home.`;
    }

    if ((KEY_SQUARES as readonly number[]).includes(movingPlayer.position)) {
      if (!movingPlayer.hasTorch) {
        message += " This black room is dark. First collect the torch at 100.";
      } else if (movingPlayer.crownKeyRoom === null) {
        movingPlayer.crownKeyRoom = movingPlayer.position;
        movingPlayer.keys = 1;
        message += ` Your torch revealed a key in black room ${movingPlayer.position}! Return to 100 for the crown.`;
      }
    }
    // Ammo is earned only where the panda finally stops, not along its route.
    if ((BULLET_PICKUP_SQUARES as readonly number[]).includes(movingPlayer.position)) {
      if (movingPlayer.bullets < MAX_BULLETS) {
        movingPlayer.bullets += 1;
        message += " Picked up 1 bullet.";
      } else message += ` Ammo is capped at ${MAX_BULLETS}.`;
    }

    if (movingPlayer.position === 100) {
      if (!movingPlayer.hasTorch) {
        movingPlayer.hasTorch = true;
        movingPlayer.position = 0;
        effect = "torch";
        message = `${movingPlayer.name} collected the torch at 100 and returned Home! The crown is still locked. Land in black room 17, 44 or 67 for one key.`;
      } else if (movingPlayer.crownKeyRoom === null) {
        movingPlayer.position = 0;
        effect = "return";
        message = `${movingPlayer.name} reached 100 without a black-room key. The crown remains locked; return Home and try for a key in 17, 44 or 67.`;
      } else {
        next.winnerId = movingPlayer.id;
        message = `${movingPlayer.name} returned to 100 with the torch and a key from room ${movingPlayer.crownKeyRoom}, unlocked the crown and won!`;
      }
    }
  next.bombs.forEach((bomb) => { if (bomb.ownerId !== movingPlayer.id) bomb.armed = bomb.square === movingPlayer.position; });
  next.message = message;
  if (!next.winnerId && (MYSTERY_BOX_SQUARES as readonly number[]).includes(movingPlayer.position)) {
    next.pendingChoice = { kind: "mystery", playerId: movingPlayer.id, square: movingPlayer.position };
    next.message += " Choose one mystery power.";
  }
  const reachedGun = (GUN_SQUARES as readonly number[]).includes(movingPlayer.position);
  const canShootAnySnake = SHOOTABLE_SNAKE_SQUARES.some(
    (snakeSquare) => movingPlayer.snakeStuns[snakeSquare] === 0,
  );
  next.pendingFireForPlayerId =
    next.winnerId === null && reachedGun && movingPlayer.bullets > 0 && canShootAnySnake
      ? movingPlayer.id
      : null;
  if (next.pendingFireForPlayerId) {
    next.message = `${movingPlayer.name} stopped in a gun room. Aim at snake 98, 99, or both with two bullets, or pass.`;
  }
  return { state: finishTurn(next), path: [], effect };
}

export function resolveDefense(state: GameState, use: boolean): TurnResolution {
  return resolveDefenseWith(state, use, completeLanding);
}

export function playTurn(state: GameState, roll: number): GameState {
  return resolveTurn(state, roll).state;
}

function requirePendingShooter(state: GameState): [number, Player] {
  const playerIndex = state.players.findIndex(
    (player, index) => index === state.currentPlayerIndex && player.id === state.pendingFireForPlayerId,
  );
  if (playerIndex < 0) throw new Error("No player is waiting to fire.");
  if (!(GUN_SQUARES as readonly number[]).includes(state.players[playerIndex].position)) {
    throw new Error("You can fire only from a gun room.");
  }
  return [playerIndex, state.players[playerIndex]];
}

/** Spend one bullet per target and protect the shooter for their next three rolls. */
export function shootSnakes(state: GameState, snakeSquares: readonly ShootableSnakeSquare[]): GameState {
  if (snakeSquares.length < 1 || snakeSquares.length > 2 ||
    new Set(snakeSquares).size !== snakeSquares.length ||
    snakeSquares.some((square) => !(SHOOTABLE_SNAKE_SQUARES as readonly number[]).includes(square))) {
    throw new RangeError("Aim at snake 98, snake 99, or both once each.");
  }
  const [playerIndex, shooter] = requirePendingShooter(state);
  if (shooter.bullets < snakeSquares.length) throw new Error("You need one bullet per target.");
  if (snakeSquares.some((square) => shooter.snakeStuns[square] > 0)) {
    throw new Error("That snake is already stunned.");
  }

  const players = state.players.map((player) => ({
    ...player,
    snakeStuns: { ...emptySnakeStuns(), ...player.snakeStuns },
  })) as [Player, Player];
  const firingPlayer = players[playerIndex];
  firingPlayer.bullets -= snakeSquares.length;
  for (const square of snakeSquares) firingPlayer.snakeStuns[square] = SNAKE_STUN_ROLLS;
  return finishTurn({
    ...state,
    players,
    currentPlayerIndex: playerIndex,
    pendingFireForPlayerId: null,
    message: `${firingPlayer.name} stunned ${snakeSquares.length === 2 ? "both snakes at 98 and 99" : `the snake at ${snakeSquares[0]}`} for their next ${SNAKE_STUN_ROLLS} rolls, using ${snakeSquares.length} bullet${snakeSquares.length === 1 ? "" : "s"}.`,
  });
}

export function shootSnake(state: GameState, snakeSquare: ShootableSnakeSquare): GameState {
  return shootSnakes(state, [snakeSquare]);
}

/** End the shooter's turn without spending a bullet. */
export function passFire(state: GameState): GameState {
  const [playerIndex, shooter] = requirePendingShooter(state);
  const players = state.players.map((player) => ({
    ...player,
    snakeStuns: { ...emptySnakeStuns(), ...player.snakeStuns },
  })) as [Player, Player];
  return finishTurn({
    ...state,
    players,
    currentPlayerIndex: playerIndex,
    pendingFireForPlayerId: null,
    message: `${shooter.name} passed the shot.`,
  });
}