import assert from "node:assert/strict";
import test from "node:test";
import { createGame } from "./game-engine.ts";
import { getMrBotAction } from "./mr-bot.ts";

const BOT_ID = "player-2";
const HUMAN_ID = "player-1";

function botTurn() {
  const game = createGame();
  game.players[1].name = "Mr.Bot";
  game.currentPlayerIndex = 1;
  return game;
}

test("Mr.Bot waits on the human turn and rolls on its own turn", () => {
  const game = createGame();
  assert.equal(getMrBotAction(game, BOT_ID), null);
  game.currentPlayerIndex = 1;
  assert.deepEqual(getMrBotAction(game, BOT_ID), { type: "roll" });
});

test("Mr.Bot resolves mystery choices with an immediately useful power", () => {
  const game = botTurn();
  game.players[1].position = 20;
  game.players[0].position = 23;
  game.pendingChoice = { kind: "mystery", playerId: BOT_ID, square: 20 };
  assert.deepEqual(getMrBotAction(game, BOT_ID), { type: "choose", power: "webShooter" });

  game.players[0].position = 20;
  assert.deepEqual(getMrBotAction(game, BOT_ID), { type: "choose", power: "knife" });

  game.players[0].powers.knife = 1;
  assert.deepEqual(getMrBotAction(game, BOT_ID), { type: "choose", power: "bomb" });
});

test("Mr.Bot uses available defenses and declines when it has none", () => {
  const game = botTurn();
  game.pendingChoice = { kind: "snake", playerId: BOT_ID, square: 58, to: 43 };
  assert.deepEqual(getMrBotAction(game, BOT_ID), { type: "defend", use: false });
  game.players[1].powers.antiVenom = 1;
  assert.deepEqual(getMrBotAction(game, BOT_ID), { type: "defend", use: true });

  game.pendingChoice = { kind: "bomb", playerId: BOT_ID, square: 97, bombId: null };
  game.players[1].powers.defuser = 1;
  assert.deepEqual(getMrBotAction(game, BOT_ID), { type: "defend", use: true });
});

test("Mr.Bot shoots both available snakes with two bullets and passes when it cannot shoot", () => {
  const game = botTurn();
  game.pendingFireForPlayerId = BOT_ID;
  game.players[1].bullets = 2;
  assert.deepEqual(getMrBotAction(game, BOT_ID), { type: "shoot", targets: [98, 99] });

  game.players[1].snakeStuns[99] = 2;
  assert.deepEqual(getMrBotAction(game, BOT_ID), { type: "shoot", targets: [98] });

  game.players[1].bullets = 0;
  assert.deepEqual(getMrBotAction(game, BOT_ID), { type: "pass-shot" });
});

test("Mr.Bot detonates its armed bomb against the human only after their landing choice", () => {
  const game = createGame();
  game.players[0].position = 50;
  game.bombs.push({ id: "bot-bomb", square: 50, ownerId: BOT_ID, armed: true });
  assert.deepEqual(getMrBotAction(game, BOT_ID), {
    type: "detonate", bombId: "bot-bomb", targetPlayerId: HUMAN_ID,
  });

  game.pendingChoice = { kind: "bomb", playerId: HUMAN_ID, square: 50, bombId: "bot-bomb" };
  assert.equal(getMrBotAction(game, BOT_ID), null);
});

test("Mr.Bot spends useful powers before rolling, without repeating armed Extra Dice", () => {
  const game = botTurn();
  game.players[1].powers.extraDice = 1;
  assert.deepEqual(getMrBotAction(game, BOT_ID), { type: "extra-dice" });

  game.players[1].extraRollCredits = 1;
  game.players[1].powers.webShooter = 1;
  game.players[1].position = 20;
  game.players[0].position = 21;
  assert.deepEqual(getMrBotAction(game, BOT_ID), { type: "web", targetPlayerId: HUMAN_ID });

  game.players[1].powers.webShooter = 0;
  game.players[1].powers.knife = 1;
  game.players[0].position = 20;
  assert.deepEqual(getMrBotAction(game, BOT_ID), { type: "knife", targetPlayerId: HUMAN_ID });

  game.players[1].powers.knife = 0;
  game.players[1].powers.bomb = 1;
  assert.deepEqual(getMrBotAction(game, BOT_ID), { type: "plant", square: 20 });

  game.bombs.push({ id: "already-here", square: 20, ownerId: BOT_ID, armed: false });
  assert.deepEqual(getMrBotAction(game, BOT_ID), { type: "roll" });
});