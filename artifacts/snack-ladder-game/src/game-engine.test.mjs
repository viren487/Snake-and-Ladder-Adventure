import assert from "node:assert/strict";
import test from "node:test";
import { createGame, playTurn, repairLegacyGame, resolveTurn } from "./game-engine.ts";

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

test("a key collected during a roll opens a gate later in that same roll", () => {
  const turn = resolveTurn(at(11), 6);
  assert.deepEqual(turn.path, [12, 13, 14, 15, 16, 17]);
  assert.equal(turn.state.players[0].position, 17);
  assert.deepEqual(turn.state.players[0].unlockedGates, [17]);
  assert.equal(turn.state.players[0].keys, 0);
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

  const snake = resolveTurn(at(35, 1), 1);
  assert.deepEqual(snake.path, [36]);
  assert.equal(snake.effect, "snake");
  assert.equal(snake.state.players[0].position, 25);
  assert.equal(snake.state.players[0].keys, 2);
});

test("a blocked gate stops after the reachable steps and gives the next turn", () => {
  const turn = resolveTurn(at(15), 3);
  assert.deepEqual(turn.path, [16]);
  assert.equal(turn.state.players[0].position, 16);
  assert.match(turn.state.message, /gate 17/);
  assert.equal(turn.state.currentPlayerIndex, 1);
});

test("once opened, a gate stays open for that panda after a snake bite", () => {
  const game = at(43);
  game.players[0].unlockedGates = [17, 44];
  const turn = resolveTurn(game, 1);
  assert.deepEqual(turn.path, [44]);
  assert.equal(turn.state.players[0].position, 44);
  assert.equal(turn.state.players[0].keys, 0);
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
      assert.ok(!resolved.state.message.includes("stopped before gate"));
      assert.notEqual(resolved.state, game);
      game = resolved.state;
    }
    assert.ok(game.winnerId, `Round ${round} did not finish`);
  }
});