export type Player = {
  id: string;
  name: string;
  color: "blue" | "coral";
  position: number;
  keys: number;
  unlockedGates: number[];
};

export type GameState = {
  players: [Player, Player];
  currentPlayerIndex: number;
  lastRoll: number | null;
  turnNumber: number;
  winnerId: string | null;
  message: string;
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
export const BOOM_SQUARE = 97 as const;
export const LOCKED_SQUARES = [17, 44, 67] as const;

export function createGame(): GameState {
  return {
    players: [
      { id: "player-1", name: "Player 1", color: "blue", position: 0, keys: 0, unlockedGates: [] },
      { id: "player-2", name: "Player 2", color: "coral", position: 0, keys: 0, unlockedGates: [] },
    ],
    currentPlayerIndex: 0,
    lastRoll: null,
    turnNumber: 1,
    winnerId: null,
    message: "Player 1 is ready. Roll the dice to begin.",
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
  return {
    ...state,
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
      };
    }) as [Player, Player],
  };
}

/** Return the actual squares walked so the UI animates exactly what the rules resolve. */
export function resolveTurn(state: GameState, roll: number): TurnResolution {
  if (!Number.isInteger(roll) || roll < 1 || roll > 6) {
    throw new RangeError("A dice roll must be an integer from 1 to 6.");
  }
  if (state.winnerId) return { state, path: [], effect: null };

  const player = state.players[state.currentPlayerIndex];
  const nextPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
  const nextPlayer = state.players[nextPlayerIndex];
  const nextPlayers: [Player, Player] = state.players.map((item) => ({
    ...item,
    unlockedGates: [...(item.unlockedGates ?? [])],
  })) as [Player, Player];
  const movingPlayer = nextPlayers[state.currentPlayerIndex];
  const target = player.position + roll;
  const path: number[] = [];
  let effect: TurnResolution["effect"] = null;
  let blockedGate: number | null = null;
  let keysFound = 0;
  let gatesOpened = 0;
  let message: string;
  let winnerId: string | null = null;

  if (target > 100) {
    message = `${player.name} needs an exact roll to reach 100.`;
  } else {
    for (let square = player.position + 1; square <= target; square += 1) {
      if (
        (LOCKED_SQUARES as readonly number[]).includes(square) &&
        !movingPlayer.unlockedGates.includes(square)
      ) {
        if (movingPlayer.keys === 0) {
          blockedGate = square;
          break;
        }
        movingPlayer.keys -= 1;
        movingPlayer.unlockedGates.push(square);
        gatesOpened += 1;
      }
      path.push(square);
      movingPlayer.position = square;
      if ((KEY_SQUARES as readonly number[]).includes(square)) {
        movingPlayer.keys += 1;
        keysFound += 1;
      }
    }

    message = blockedGate !== null
      ? `${player.name} stopped before gate ${blockedGate}; a torch key is needed.`
      : `${player.name} moved to square ${movingPlayer.position}.`;
    const landing = movingPlayer.position;
    const snake = blockedGate === null ? SNAKES.find((item) => item.from === landing) : undefined;
    const ladder = blockedGate === null ? LADDERS.find((item) => item.from === landing) : undefined;

    if (snake) {
      effect = "snake";
      movingPlayer.position = snake.to;
      message = `${player.name} slid down from ${snake.from} to ${snake.to}.`;
    } else if (ladder) {
      effect = "ladder";
      movingPlayer.position = ladder.to;
      for (const keySquare of KEY_SQUARES) {
        if (keySquare > ladder.from && keySquare <= ladder.to) {
          movingPlayer.keys += 1;
          keysFound += 1;
        }
      }
      message = `${player.name} climbed from ${ladder.from} to ${ladder.to}.`;
    }

    if (movingPlayer.position === BOOM_SQUARE) {
      effect = "boom";
      movingPlayer.position = 0;
      message = `${player.name} hit the boom on square ${BOOM_SQUARE} and returned home.`;
    }

    if (effect === "snake" && (KEY_SQUARES as readonly number[]).includes(movingPlayer.position)) {
      movingPlayer.keys += 1;
      keysFound += 1;
    }
    if (keysFound) message += ` Collected ${keysFound} torch key${keysFound === 1 ? "" : "s"}.`;
    if (gatesOpened) message += ` Opened ${gatesOpened} gate${gatesOpened === 1 ? "" : "s"}.`;

    if (movingPlayer.position === 100) {
      winnerId = movingPlayer.id;
      message = `${movingPlayer.name} reached 100 and won!`;
    }
  }

  const nextState: GameState = {
    players: nextPlayers,
    currentPlayerIndex: nextPlayerIndex,
    lastRoll: roll,
    turnNumber: state.turnNumber + 1,
    winnerId,
    message: winnerId
      ? message
      : `${message} ${nextPlayer.name} is up next.`,
  };
  return { state: nextState, path, effect };
}

export function playTurn(state: GameState, roll: number): GameState {
  return resolveTurn(state, roll).state;
}