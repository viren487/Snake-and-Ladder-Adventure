import assert from "node:assert/strict";
import test from "node:test";
import { createGame, passFire, playTurn, repairLegacyGame, resolveTurn } from "../lib/game-engine.ts";
import { isSavedGame } from "../lib/saved-game.ts";

function at(position, keys = 0) {
  const game = createGame();
  game.players[0] = { ...game.players[0], position, keys: keys ? 1 : 0,
    hasTorch: keys > 0, crownKeyRoom: keys ? 17 : null };
  return game;
}

test("only black-room exact landings with a torch award a crown key", () => {
  for (const room of [17, 44, 67]) {
    assert.equal(playTurn(at(room - 1), 1).players[0].keys, 0);
    const lit = at(room - 1);
    lit.players[0].hasTorch = true;
    assert.equal(playTurn(lit, 1).players[0].keys, 1);
    assert.equal(playTurn(lit, 2).players[0].keys, 0);
  }
});

test("keys collected in a roll remain in inventory while gates are paused", () => {
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
      assert.equal(repaired.players[0].keys, 0);
      const turn = resolveTurn(repaired, roll);
      assert.equal(turn.path.length, roll);
      assert.notEqual(turn.state.players[0].position, position);
    }
  });
}

test("legacy repair retains round and positions while archiving obsolete keys", () => {
  const game = at(16);
  delete game.players[0].unlockedGates;
  game.turnNumber = 20;
  game.players[1].position = 35;
  game.players[1].keys = 3;
  delete game.players[1].hasTorch;
  delete game.players[1].crownKeyRoom;
  const repaired = repairLegacyGame(game);
  assert.equal(repaired.turnNumber, 20);
  assert.equal(repaired.players[1].position, 35);
  assert.equal(repaired.players[1].legacyKeys, 3);
  assert.equal(repaired.players[1].keys, 0);
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
  assert.equal(snake.state.players[0].keys, 0);
});

test("gates never stop a panda even without a key", () => {
  const turn = resolveTurn(at(15), 3);
  assert.deepEqual(turn.path, [16, 17, 18]);
  assert.equal(turn.state.players[0].position, 18);
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

test("ladder jumps never grant crown keys; subsequent exact black-room landing does", () => {
  const game = at(45, 0);
  game.players[0].unlockedGates = [17, 44];
  game.players[0].hasTorch = true;
  const climbed = resolveTurn(game, 1);
  assert.equal(climbed.state.players[0].position, 66);
  assert.equal(climbed.state.players[0].keys, 0);
  climbed.state.currentPlayerIndex = 0;
  const next = resolveTurn(climbed.state, 1);
  assert.equal(next.state.players[0].position, 67);
  assert.equal(next.state.players[0].keys, 1);
});

test("exact-roll finishing, boom reset and turn switching are preserved", () => {
  const overshoot = resolveTurn(at(98), 3);
  assert.deepEqual(overshoot.path, []);
  assert.equal(overshoot.state.players[0].position, 98);
  assert.equal(overshoot.state.currentPlayerIndex, 1);
  const win = resolveTurn(at(98, 1), 2);
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
      game = resolved.state.pendingFireForPlayerId ? passFire(resolved.state) : resolved.state;
    }
    assert.ok(game.winnerId, `Round ${round} never finished`);
  }
});

test("save validation accepts pre-ammo rounds and defaults new fields without losing progress", () => {
  const legacy = at(77, 4);
  legacy.turnNumber = 30;
  delete legacy.pendingFireForPlayerId;
  for (const player of legacy.players) {
    delete player.bullets;
    delete player.snakeStuns;
    delete player.hasTorch;
    delete player.crownKeyRoom;
  }
  legacy.players[0].keys = 4;
  assert.ok(isSavedGame(legacy));
  const repaired = repairLegacyGame(legacy);
  assert.ok(isSavedGame(repaired));
  assert.equal(repaired.players[0].position, 77);
  assert.equal(repaired.players[0].keys, 0);
  assert.equal(repaired.players[0].legacyKeys, 4);
  assert.equal(repaired.players[0].bullets, 0);
  assert.deepEqual(repaired.players[0].snakeStuns, { 98: 0, 99: 0 });
  assert.equal(repaired.turnNumber, 30);
  assert.equal(repaired.pendingFireForPlayerId, null);
});

test("torch and key quest save fields are validated; old wins migrate to the torch stage", () => {
  for (const fields of [
    { hasTorch: "yes" }, { crownKeyRoom: 6 }, { crownKeyRoom: "17" }, { legacyKeys: -1 },
  ]) {
    const game = at(94);
    Object.assign(game.players[0], fields);
    assert.equal(isSavedGame(game), false);
  }
  const oldWin = at(100);
  delete oldWin.players[0].hasTorch;
  delete oldWin.players[0].crownKeyRoom;
  oldWin.winnerId = "player-1";
  assert.ok(isSavedGame(oldWin));
  const migrated = repairLegacyGame(oldWin);
  assert.equal(migrated.winnerId, null);
  assert.equal(migrated.players[0].hasTorch, true);
  assert.equal(migrated.players[0].position, 0);
  assert.ok(isSavedGame(migrated));
  assert.deepEqual(repairLegacyGame(migrated), migrated);
});

test("invalid ammunition, stun counts and firing identities are rejected before migration", () => {
  for (const bullets of [null, "2", -1, 6, 1.5]) {
    const game = at(94);
    game.players[0].bullets = bullets;
    assert.equal(isSavedGame(game), false, `invalid bullets ${bullets}`);
  }
  for (const stuns of [null, [], "3", { 98: -1 }, { 99: 4 }, { 98: 1.5 }, { 99: "2" }]) {
    const game = at(94);
    game.players[0].snakeStuns = stuns;
    assert.equal(isSavedGame(game), false, `invalid stuns ${JSON.stringify(stuns)}`);
  }
  const wrongPlayer = at(94);
  wrongPlayer.pendingFireForPlayerId = "player-2";
  assert.equal(isSavedGame(wrongPlayer), false);
  const partial = at(94);
  partial.players[0].snakeStuns = { 98: 2 };
  assert.ok(isSavedGame(partial));
  assert.deepEqual(repairLegacyGame(partial).players[0].snakeStuns, { 98: 2, 99: 0 });
});