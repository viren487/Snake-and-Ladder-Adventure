export type Player = {
  id: string;
  name: string;
  color: "blue" | "coral";
  position: number;
  keys: number;
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
export const LOCKED_SQUARES = [17, 44, 67] as const;

export function createGame(): GameState {
  return {
    players: [
      { id: "player-1", name: "Player 1", color: "blue", position: 0, keys: 0 },
      { id: "player-2", name: "Player 2", color: "coral", position: 0, keys: 0 },
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

export function playTurn(state: GameState, roll: number): GameState {
  if (!Number.isInteger(roll) || roll < 1 || roll > 6) {
    throw new RangeError("A dice roll must be an integer from 1 to 6.");
  }
  if (state.winnerId) return state;

  const player = state.players[state.currentPlayerIndex];
  const nextPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
  const nextPlayer = state.players[nextPlayerIndex];
  const nextPlayers: [Player, Player] = state.players.map((item) => ({
    ...item,
  })) as [Player, Player];
  const movingPlayer = nextPlayers[state.currentPlayerIndex];
  const target = player.position + roll;
  const crossedGate = (LOCKED_SQUARES as readonly number[]).find(
    (square) => square > player.position && square <= target,
  );
  let message: string;
  let winnerId: string | null = null;

  if (target > 100) {
    message = `${player.name} needs an exact roll to reach 100.`;
  } else if (crossedGate !== undefined && movingPlayer.keys === 0) {
    message = `${player.name} needs a torch key to pass square ${crossedGate}.`;
  } else {
    movingPlayer.position = target;

    if (crossedGate !== undefined) {
      movingPlayer.keys -= 1;
      message = `${player.name} used a torch key to pass square ${crossedGate}.`;
    } else {
      message = `${player.name} moved to square ${target}.`;
    }

    const snake = SNAKES.find((item) => item.from === target);
    const ladder = LADDERS.find((item) => item.from === target);

    if (snake) {
      movingPlayer.position = snake.to;
      message = `${player.name} slid down from ${snake.from} to ${snake.to}.`;
    } else if (ladder) {
      movingPlayer.position = ladder.to;
      message = `${player.name} climbed from ${ladder.from} to ${ladder.to}.`;
    }

    if ((KEY_SQUARES as readonly number[]).includes(movingPlayer.position)) {
      movingPlayer.keys += 1;
      message = `${player.name} found a torch key on square ${movingPlayer.position}.`;
    }

    if (movingPlayer.position === 100) {
      winnerId = movingPlayer.id;
      message = `${movingPlayer.name} reached 100 and won!`;
    }
  }

  return {
    players: nextPlayers,
    currentPlayerIndex: nextPlayerIndex,
    lastRoll: roll,
    turnNumber: state.turnNumber + 1,
    winnerId,
    message: winnerId
      ? message
      : `${message} ${nextPlayer.name} is up next.`,
  };
}