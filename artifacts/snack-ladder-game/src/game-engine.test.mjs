import assert from "node:assert/strict";
import test from "node:test";
import {
  createGame,
  MAX_BULLETS,
  passFire,
  playTurn,
  repairLegacyGame,
  resolveTurn,
  shootSnake,
} from "./game-engine.ts";

function at(position, keys = 0) {
  const game = createGame();
  game.players[0] = { ...game.players[0], position, keys };
  return game;
}

test("keys are picked up while passing, without double-counting a landing", () => {
  assert.equal(playTurn(at(4), 4).players[0].keys, 1);
  assert.equal(playTurn(at(0), 6).players[0].keys, 1);
  assert.equal(playTurn(at(5), 1).players[0].keys, 1);
});

test("keys remain collectible but no longer affect gate movement", () => {
  const turn = resolveTurn(at(11), 6);
  assert.deepEqual(turn.path, [12, 13, 14, 15, 16, 17]);
  assert.equal(turn.state.players[0].position, 17);
  assert.deepEqual(turn.state.players[0].unlockedGates, []);
  assert.equal(turn.state.players[0].keys, 1);
  assert.equal(turn.state.players[0].bullets, 1);

  const noKey = resolveTurn(at(15), 3);
  assert.deepEqual(noKey.path, [16, 17, 18]);
  assert.equal(noKey.state.players[0].position, 18);

  const savedKeys = resolveTurn(at(16, 3), 1);
  assert.equal(savedKeys.state.players[0].position, 17);
  assert.equal(savedKeys.state.players[0].keys, 3);
  assert.deepEqual(savedKeys.state.players[0].unlockedGates, []);
});

for (const position of [16, 43, 66]) {
  test(`a legacy save immediately before gate ${position + 1} resumes for any roll`, () => {
    const legacy = at(position);
    delete legacy.players[0].unlockedGates;
    for (let roll = 1; roll <= 6; roll++) {
      const resumed = repairLegacyGame(legacy);
      assert.equal(resumed.players[0].keys, 1);
      const turn = resolveTurn(resumed, roll);
      assert.notEqual(turn.state.players[0].position, position);
      assert.equal(turn.path.length, roll);
    }
  });
}

test("migration preserves both players, positions, keys and round number", () => {
  const saved = at(16);
  delete saved.players[0].unlockedGates;
  saved.turnNumber = 20;
  saved.players[1].position = 35;
  saved.players[1].keys = 3;
  const repaired = repairLegacyGame(saved);
  assert.equal(repaired.turnNumber, 20);
  assert.equal(repaired.players[0].position, 16);
  assert.equal(repaired.players[0].keys, 1);
  assert.deepEqual(repaired.players[1], saved.players[1]);
  assert.equal(saved.players[0].keys, 0);
});

test("the movement path ends at the correct ladder and snake destinations", () => {
  const ladder = resolveTurn(at(12, 1), 1);
  assert.deepEqual(ladder.path, [13]);
  assert.equal(ladder.effect, "ladder");
  assert.equal(ladder.state.players[0].position, 28);
  assert.equal(ladder.state.players[0].keys, 2);
  assert.equal(ladder.state.players[0].bullets, 1);

  const snake = resolveTurn(at(35, 1), 1);
  assert.deepEqual(snake.path, [36]);
  assert.equal(snake.effect, "snake");
  assert.equal(snake.state.players[0].position, 25);
  assert.equal(snake.state.players[0].keys, 2);
  assert.equal(snake.state.players[0].bullets, 1);
});

test("ammo pickups include ladder routes and never exceed five bullets", () => {
  const ladder = resolveTurn(at(45), 1);
  assert.equal(ladder.effect, "ladder");
  assert.equal(ladder.state.players[0].position, 66);
  assert.equal(ladder.state.players[0].bullets, 2);
  assert.equal(ladder.state.players[0].keys, 1);

  const almostFull = at(5);
  almostFull.players[0].bullets = MAX_BULLETS - 1;
  const pickup = resolveTurn(almostFull, 1);
  assert.equal(pickup.state.players[0].bullets, MAX_BULLETS);

  const full = at(60);
  full.players[0].bullets = MAX_BULLETS;
  const capped = resolveTurn(full, 3);
  assert.equal(capped.state.players[0].bullets, MAX_BULLETS);
  assert.equal(capped.state.players[0].keys, 1);
  assert.match(capped.state.message, /capped at 5/);
});

test("legacy gate metadata is preserved but never required for movement", () => {
  const game = at(43);
  game.players[0].unlockedGates = [17, 44];
  game.players[0].keys = 2;
  const turn = resolveTurn(game, 1);
  assert.deepEqual(turn.path, [44]);
  assert.equal(turn.state.players[0].position, 44);
  assert.equal(turn.state.players[0].keys, 2);
  assert.deepEqual(turn.state.players[0].unlockedGates, [17, 44]);
});

test("a gun point pauses the turn until the player shoots or passes", () => {
  const armed = at(93);
  armed.players[0].bullets = 2;
  const turn = resolveTurn(armed, 1);
  assert.deepEqual(turn.path, [94]);
  assert.equal(turn.state.pendingFireForPlayerId, "player-1");
  assert.equal(turn.state.currentPlayerIndex, 0);
  assert.equal(turn.state.turnNumber, 2);
  assert.equal(resolveTurn(turn.state, 6).state, turn.state);

  const shot = shootSnake(turn.state, 99);
  assert.equal(shot.players[0].bullets, 1);
  assert.deepEqual(shot.players[0].snakeStuns, { 98: 0, 99: 3 });
  assert.deepEqual(shot.players[1].snakeStuns, { 98: 0, 99: 0 });
  assert.equal(shot.currentPlayerIndex, 1);
  assert.equal(shot.pendingFireForPlayerId, null);

  const passed = passFire(turn.state);
  assert.equal(passed.players[0].bullets, 2);
  assert.deepEqual(passed.players[0].snakeStuns, { 98: 0, 99: 0 });
  assert.equal(passed.currentPlayerIndex, 1);
  assert.equal(passed.turnNumber, 2);
});

test("a shot protects only its shooter for the next three of their dice rolls", () => {
  const game = at(93);
  game.players[0].bullets = 1;
  let state = shootSnake(resolveTurn(game, 1).state, 99);

  for (const remaining of [2, 1, 0]) {
    state = resolveTurn(state, 1).state; // Other player's roll does not consume the stun.
    assert.equal(state.players[0].snakeStuns[99], remaining + 1);
    state = resolveTurn(state, 1).state; // The shooter has rolled once.
    assert.equal(state.players[0].snakeStuns[99], remaining);
  }
});

test("a stunned target snake does not slide its shooter down", () => {
  const game = at(98);
  game.players[0].snakeStuns[99] = 3;
  const turn = resolveTurn(game, 1);
  assert.deepEqual(turn.path, [99]);
  assert.equal(turn.effect, null);
  assert.equal(turn.state.players[0].position, 99);
  assert.equal(turn.state.players[0].snakeStuns[99], 2);
  assert.match(turn.state.message, /stunned snake at 99/);
});

test("exact-roll win, overshoot, boom reset and next-player selection still work", () => {
  const overshoot = resolveTurn(at(98), 3);
  assert.deepEqual(overshoot.path, []);
  assert.equal(overshoot.state.players[0].position, 98);
  assert.equal(overshoot.state.currentPlayerIndex, 1);

  const win = resolveTurn(at(98), 2);
  assert.equal(win.state.winnerId, "player-1");
  assert.equal(win.state.players[0].position, 100);
  assert.equal(playTurn(win.state, 6), win.state);

  const boom = resolveTurn(at(96), 1);
  assert.equal(boom.effect, "boom");
  assert.equal(boom.state.players[0].position, 0);
});

test("1000 seeded rounds reach winners without a gate deadlock", () => {
  let seed = 812;
  const roll = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return 1 + Math.floor((seed / 4294967296) * 6);
  };
  for (let round = 0; round < 1000; round++) {
    let game = createGame();
    for (let turn = 0; turn < 2000 && !game.winnerId; turn++) {
      const value = roll();
      const resolved = resolveTurn(game, value);
      assert.notEqual(resolved.state, game);
      game = resolved.state.pendingFireForPlayerId
        ? passFire(resolved.state)
        : resolved.state;
    }
    assert.ok(game.winnerId, `Round ${round} did not finish`);
  }
});