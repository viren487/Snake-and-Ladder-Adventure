import assert from "node:assert/strict";
import test from "node:test";
import { createGame, playTurn, repairLegacyGame, resolveTurn } from "../lib/game-engine.ts";

function at(position, keys = 0) {
  const game = createGame();
  game.players[0] = { ...game.players[0], position, keys };
  return game;
}

test("passing key squares awards keys, exact landings never award twice", () => {
  assert.equal(playTurn(at(4), 4).players[0].keys, 1);
  assert.equal(playTurn(at(0), 6).players[0].keys, 1);
  assert.equal(playTurn(at(5), 1).players[0].keys, 1);
});

test("keys collected in a roll open a later gate in the same roll", () => {
  const turn = resolveTurn(at(11), 6);
  assert.deepEqual(turn.path, [12, 13, 14, 15, 16, 17]);
  assert.equal(turn.state.players[0].position, 17);
  assert.equal(turn.state.players[0].keys, 0);
});

for (const position of [16, 43, 66]) {
  test(`legacy save before gate at ${position} resumes for every dice value`, () => {
    for (let roll = 1; roll <= 6; roll++) {
      const legacy = at(position);
      delete legacy.players[0].unlockedGates;
      const repaired = repairLegacyGame(legacy);
      assert.equal(repaired.players[0].keys, 1);
      const turn = resolveTurn(repaired, roll);
      assert.equal(turn.path.length, roll);
      assert.notEqual(turn.state.players[0].position, position);
    }
  });
}

test("legacy repair retains round, both players, message and unneeded keys", () => {
  const game = at(16);
  delete game.players[0].unlockedGates;
  game.turnNumber = 20;
  game.players[1].position = 35;
  game.players[1].keys = 3;
  const repaired = repairLegacyGame(game);
  assert.equal(repaired.turnNumber, 20);
  assert.deepEqual(repaired.players[1], game.players[1]);
  assert.equal(repaired.players[0].position, 16);
  assert.equal(game.players[0].keys, 0);
});

test("ladder and snake effects exactly match the animation destination", () => {
  const ladder = resolveTurn(at(12, 1), 1);
  assert.deepEqual(ladder.path, [13]);
  assert.equal(ladder.effect, "ladder");
  assert.equal(ladder.state.players[0].position, 28);
  const snake = resolveTurn(at(35), 1);
  assert.deepEqual(snake.path, [36]);
  assert.equal(snake.effect, "snake");
  assert.equal(snake.state.players[0].position, 25);
  assert.equal(snake.state.players[0].keys, 1);
});

test("an unavailable gate stops only after the traversable steps", () => {
  const turn = resolveTurn(at(15), 3);
  assert.deepEqual(turn.path, [16]);
  assert.equal(turn.state.players[0].position, 16);
  assert.match(turn.state.message, /gate 17/);
  assert.equal(turn.state.currentPlayerIndex, 1);
});

test("opened gates never consume another key after a snake sends the panda back", () => {
  const game = at(43, 0);
  game.players[0].unlockedGates = [17, 44];
  const turn = resolveTurn(game, 1);
  assert.deepEqual(turn.path, [44]);
  assert.equal(turn.state.players[0].position, 44);
  assert.equal(turn.state.players[0].keys, 0);
});

test("ladder jumps collect bypassed keys before the next gate", () => {
  const game = at(45, 0);
  game.players[0].unlockedGates = [17, 44];
  const climbed = resolveTurn(game, 1);
  assert.equal(climbed.state.players[0].position, 66);
  assert.equal(climbed.state.players[0].keys, 1);
  climbed.state.currentPlayerIndex = 0;
  const next = resolveTurn(climbed.state, 1);
  assert.equal(next.state.players[0].position, 67);
  assert.equal(next.state.players[0].keys, 0);
});

test("exact-roll finishing, boom reset and turn switching are preserved", () => {
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

test("1000 complete seeded games never deadlock at a gate", () => {
  let seed = 812;
  const roll = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return 1 + Math.floor((seed / 4294967296) * 6);
  };
  for (let round = 0; round < 1000; round++) {
    let game = createGame();
    for (let turns = 0; turns < 2000 && !game.winnerId; turns++) {
      const value = roll();
      const before = game.players[game.currentPlayerIndex].position;
      const resolved = resolveTurn(game, value);
      assert.ok(!resolved.state.message.includes("stopped before gate"),
        `Deadlock: position ${before}, roll ${value}, ${resolved.state.message}`);
      for (const player of resolved.state.players) {
        assert.ok(player.position >= 0 && player.position <= 100);
        assert.ok(player.keys >= 0);
      }
      assert.notEqual(resolved.state, game);
      game = resolved.state;
    }
    assert.ok(game.winnerId, `Round ${round} never finished`);
  }
});