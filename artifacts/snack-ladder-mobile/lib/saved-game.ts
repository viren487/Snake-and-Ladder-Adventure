import { KEY_SQUARES, LOCKED_SQUARES, MAX_BULLETS, SHOOTABLE_SNAKE_SQUARES, SNAKE_STUN_ROLLS, type GameState } from "./game-engine.ts";

/** Optional new fields accept old rounds; malformed fields never reach the engine. */
export function isSavedGame(value: unknown): value is GameState {
  if (!value || typeof value !== "object") return false;
  const game = value as Partial<GameState>;
  return (
    Array.isArray(game.players) &&
    game.players.length === 2 &&
    game.players.every((player, index) =>
      player &&
      player.id === `player-${index + 1}` &&
      typeof player.name === "string" &&
      player.color === (index === 0 ? "blue" : "coral") &&
      Number.isInteger(player.position) && player.position >= 0 && player.position <= 100 &&
      Number.isInteger(player.keys) && player.keys >= 0 &&
      (player.hasTorch === undefined || typeof player.hasTorch === "boolean") &&
      (player.crownKeyRoom === undefined || player.crownKeyRoom === null ||
        (KEY_SQUARES as readonly number[]).includes(player.crownKeyRoom)) &&
      (player.legacyKeys === undefined || (Number.isInteger(player.legacyKeys) && player.legacyKeys >= 0)) &&
      (player.unlockedGates === undefined ||
        (Array.isArray(player.unlockedGates) &&
          player.unlockedGates.every((gate) => (LOCKED_SQUARES as readonly number[]).includes(gate)))) &&
      (player.bullets === undefined ||
        (Number.isInteger(player.bullets) && player.bullets >= 0 && player.bullets <= MAX_BULLETS)) &&
      (player.snakeStuns === undefined ||
        (player.snakeStuns !== null && typeof player.snakeStuns === "object" &&
          !Array.isArray(player.snakeStuns) &&
          SHOOTABLE_SNAKE_SQUARES.every((square) =>
            player.snakeStuns[square] === undefined ||
            (Number.isInteger(player.snakeStuns[square]) &&
              player.snakeStuns[square] >= 0 && player.snakeStuns[square] <= SNAKE_STUN_ROLLS))))
    ) &&
    (game.currentPlayerIndex === 0 || game.currentPlayerIndex === 1) &&
    Number.isInteger(game.turnNumber) && game.turnNumber! >= 1 &&
    (game.lastRoll === null ||
      (Number.isInteger(game.lastRoll) && game.lastRoll! >= 1 && game.lastRoll! <= 6)) &&
    (game.winnerId === null ||
      game.players.some((player) => player.id === game.winnerId && player.position === 100)) &&
    (game.pendingFireForPlayerId === undefined || game.pendingFireForPlayerId === null ||
      (game.winnerId === null &&
        game.players[game.currentPlayerIndex!]?.id === game.pendingFireForPlayerId)) &&
    typeof game.message === "string"
  );
}