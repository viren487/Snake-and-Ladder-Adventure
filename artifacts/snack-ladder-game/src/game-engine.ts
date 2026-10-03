export type Player = {
  id: string;
  name: string;
  color: "blue" | "coral";
  position: number;
  keys: number;
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

export const KEY_SQUARES = [6, 12, 25, 38, 63, 89] as const;
export const EXTRA_BULLET_SQUARES = [61, 77] as const;
export const BULLET_PICKUP_SQUARES = [...KEY_SQUARES, ...EXTRA_BULLET_SQUARES] as const;
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
      { id: "player-1", name: "Player 1", color: "blue", position: 0, keys: 0, unlockedGates: [], bullets: 0, snakeStuns: emptySnakeStuns() },
      { id: "player-2", name: "Player 2", color: "coral", position: 0, keys: 0, unlockedGates: [], bullets: 0, snakeStuns: emptySnakeStuns() },
    ],
    currentPlayerIndex: 0,
    lastRoll: null,
    turnNumber: 1,
    winnerId: null,
    message: "Player 1 is ready. Roll the dice to begin.",
    pendingFireForPlayerId: null,
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
  effect: "snake" | "ladder" | "boom" | null;
};

/** Upgrade older rounds that had no record of opened gates or missed key tiles. */
export function repairLegacyGame(state: GameState): GameState {
  const pendingShooter = state.players.find((player) => player.id === state.pendingFireForPlayerId);
  const validPendingShot = pendingShooter &&
    (GUN_SQUARES as readonly number[]).includes(pendingShooter.position);
  const nextPlayerIndex = state.pendingFireForPlayerId && !validPendingShot
    ? (state.currentPlayerIndex + 1) % state.players.length
    : state.currentPlayerIndex;
  return {
    ...state,
    currentPlayerIndex: nextPlayerIndex,
    message: state.pendingFireForPlayerId && !validPendingShot
      ? `${state.players[nextPlayerIndex].name} is up next. Fire is available only from a gun room.`
      : state.message,
    players: state.players.map((player) => {
      const legacy = player.unlockedGates === undefined;
      const unlockedGates = legacy
        ? LOCKED_SQUARES.filter((square) => square <= player.position)
        : [...player.unlockedGates];
      const nextGate = LOCKED_SQUARES.find(
        (square) => square > player.position && !unlockedGates.includes(square),
      );
      const precedingKey = nextGate === undefined
        ? undefined
        : [...KEY_SQUARES].reverse().find((square) => square < nextGate);
      const missedKey =
        legacy &&
        player.keys === 0 &&
        precedingKey !== undefined &&
        player.position >= precedingKey;
      return {
        ...player,
        keys: missedKey ? 1 : player.keys,
        unlockedGates,
        bullets: Math.min(MAX_BULLETS, Math.max(0, player.bullets ?? 0)),
        snakeStuns: {
          ...emptySnakeStuns(),
          ...(player.snakeStuns ?? {}),
        },
      };
    }) as [Player, Player],
    pendingFireForPlayerId: validPendingShot ? state.pendingFireForPlayerId : null,
  };
}

/** Return the actual squares walked so the UI animates exactly what the rules resolve. */
export function resolveTurn(state: GameState, roll: number): TurnResolution {
  if (!Number.isInteger(roll) || roll < 1 || roll > 6) {
    throw new RangeError("A dice roll must be an integer from 1 to 6.");
  }
  if (state.winnerId || state.pendingFireForPlayerId) return { state, path: [], effect: null };

  const player = state.players[state.currentPlayerIndex];
  const nextPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
  const nextPlayer = state.players[nextPlayerIndex];
  const nextPlayers: [Player, Player] = state.players.map((item) => ({
    ...item,
    unlockedGates: [...(item.unlockedGates ?? [])],
    snakeStuns: { ...emptySnakeStuns(), ...(item.snakeStuns ?? {}) },
  })) as [Player, Player];
  const movingPlayer = nextPlayers[state.currentPlayerIndex];
  const target = player.position + roll;
  const path: number[] = [];
  let effect: TurnResolution["effect"] = null;
  let keysFound = 0;
  let bulletsFound = 0;
  let ammoWasFull = false;
  let message: string;
  let winnerId: string | null = null;
  const originalSnakeStuns = { ...movingPlayer.snakeStuns };
  const collectKey = (square: number) => {
    if ((KEY_SQUARES as readonly number[]).includes(square)) {
      movingPlayer.keys += 1;
      keysFound += 1;
    }
  };
  const collectBullet = (square: number) => {
    if ((BULLET_PICKUP_SQUARES as readonly number[]).includes(square)) {
      if (movingPlayer.bullets < MAX_BULLETS) {
        movingPlayer.bullets += 1;
        bulletsFound += 1;
      } else {
        ammoWasFull = true;
      }
    }
  };

  if (target > 100) {
    message = `${player.name} needs an exact roll to reach 100.`;
  } else {
    for (let square = player.position + 1; square <= target; square += 1) {
      path.push(square);
      movingPlayer.position = square;
      collectKey(square);
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
    } else if (snake) {
      effect = "snake";
      movingPlayer.position = snake.to;
      message = `${player.name} slid down from ${snake.from} to ${snake.to}.`;
    } else if (ladder) {
      effect = "ladder";
      movingPlayer.position = ladder.to;
      for (const pickupSquare of KEY_SQUARES) {
        if (pickupSquare > ladder.from && pickupSquare <= ladder.to) {
          collectKey(pickupSquare);
        }
      }
      message = `${player.name} climbed from ${ladder.from} to ${ladder.to}.`;
    }

    if (movingPlayer.position === BOOM_SQUARE) {
      effect = "boom";
      movingPlayer.position = 0;
      message = `${player.name} hit the boom on square ${BOOM_SQUARE} and returned home.`;
    }

    if (effect === "snake") collectKey(movingPlayer.position);
    // Ammo is earned only where the panda finally stops, not along its route.
    collectBullet(movingPlayer.position);
    if (keysFound) message += ` Collected ${keysFound} torch key${keysFound === 1 ? "" : "s"}.`;
    if (bulletsFound) message += ` Picked up ${bulletsFound} bullet${bulletsFound === 1 ? "" : "s"}.`;
    if (ammoWasFull) message += ` Ammo is capped at ${MAX_BULLETS}.`;

    if (movingPlayer.position === 100) {
      winnerId = movingPlayer.id;
      message = `${movingPlayer.name} reached 100 and won!`;
    }
  }

  for (const snakeSquare of SHOOTABLE_SNAKE_SQUARES) {
    movingPlayer.snakeStuns[snakeSquare] = Math.max(0, originalSnakeStuns[snakeSquare] - 1);
  }
  const reachedGun = target <= 100 && (GUN_SQUARES as readonly number[]).includes(movingPlayer.position);
  const canShootAnySnake = SHOOTABLE_SNAKE_SQUARES.some(
    (snakeSquare) => movingPlayer.snakeStuns[snakeSquare] === 0,
  );
  const pendingFireForPlayerId =
    winnerId === null && reachedGun && movingPlayer.bullets > 0 && canShootAnySnake
      ? movingPlayer.id
      : null;
  if (pendingFireForPlayerId) {
    message = `${player.name} stopped in a gun room. Aim at snake 98, 99, or both with two bullets, or pass.`;
  }

  const nextState: GameState = {
    players: nextPlayers,
    currentPlayerIndex: pendingFireForPlayerId ? state.currentPlayerIndex : nextPlayerIndex,
    lastRoll: roll,
    turnNumber: state.turnNumber + 1,
    winnerId,
    pendingFireForPlayerId,
    message: winnerId
      ? message
      : pendingFireForPlayerId
        ? message
        : `${message} ${nextPlayer.name} is up next.`,
  };
  return { state: nextState, path, effect };
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
  const nextPlayerIndex = (playerIndex + 1) % players.length;
  return {
    ...state,
    players,
    currentPlayerIndex: nextPlayerIndex,
    pendingFireForPlayerId: null,
    message: `${firingPlayer.name} stunned ${snakeSquares.length === 2 ? "both snakes at 98 and 99" : `the snake at ${snakeSquares[0]}`} for their next ${SNAKE_STUN_ROLLS} rolls, using ${snakeSquares.length} bullet${snakeSquares.length === 1 ? "" : "s"}. ${players[nextPlayerIndex].name} is up next.`,
  };
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
  const nextPlayerIndex = (playerIndex + 1) % players.length;
  return {
    ...state,
    players,
    currentPlayerIndex: nextPlayerIndex,
    pendingFireForPlayerId: null,
    message: `${shooter.name} passed the shot. ${players[nextPlayerIndex].name} is up next.`,
  };
}