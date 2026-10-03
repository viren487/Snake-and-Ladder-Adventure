import assert from "node:assert/strict";
import test from "node:test";
import * as web from "../artifacts/snack-ladder-game/src/game-engine.ts";
import * as mobile from "../artifacts/snack-ladder-mobile/lib/game-engine.ts";

const engines = [
  { name: "web", rules: web },
  { name: "mobile", rules: mobile },
];

function gameAt(rules, position, keys = 0) {
  const game = rules.createGame();
  game.players[0] = { ...game.players[0], position, keys };
  return game;
}

function sharedRulesProjection(value) {
  if (Array.isArray(value)) return value.map(sharedRulesProjection);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !["bullets", "snakeStuns", "pendingFireForPlayerId", "message"].includes(key))
      .map(([key, nested]) => [key, sharedRulesProjection(nested)]),
  );
}

function expectSame(label, run) {
  const results = engines.map(({ rules }) => run(rules));
  assert.deepEqual(
    sharedRulesProjection(results[0]),
    sharedRulesProjection(results[1]),
    `${label}: shared web and mobile rules differ`,
  );
  return results[0];
}

test("both apps use the same board rules and start state", () => {
  for (const name of ["SNAKES", "LADDERS", "KEY_SQUARES", "BOOM_SQUARE", "LOCKED_SQUARES"]) {
    assert.deepEqual(web[name], mobile[name], `${name} differs`);
  }
  assert.deepEqual(sharedRulesProjection(web.createGame()), sharedRulesProjection(mobile.createGame()));
});

test("keys are collected when crossed, including keys reached by a snake or ladder", () => {
  for (const [position, roll, expectedPosition] of [[4, 4, 8], [0, 6, 6], [5, 1, 6]]) {
    const result = expectSame(`key at ${position}+${roll}`, (rules) =>
      rules.resolveTurn(gameAt(rules, position), roll),
    );
    assert.equal(result.state.players[0].position, expectedPosition);
    assert.equal(result.state.players[0].keys, 1);
  }

  const snake = expectSame("snake lands on key 25", (rules) =>
    rules.resolveTurn(gameAt(rules, 35), 1),
  );
  assert.equal(snake.effect, "snake");
  assert.equal(snake.state.players[0].position, 25);
  assert.equal(snake.state.players[0].keys, 1);

  const ladder = expectSame("ladder passes key 63", (rules) => {
    const game = gameAt(rules, 45);
    game.players[0].unlockedGates = [17, 44];
    return rules.resolveTurn(game, 1);
  });
  assert.equal(ladder.effect, "ladder");
  assert.equal(ladder.state.players[0].position, 66);
  assert.equal(ladder.state.players[0].keys, 1);
});

test("the browser keeps collecting keys while its gate mechanic is suspended", () => {
  const keyAndGate = web.resolveTurn(gameAt(web, 11), 6);
  assert.deepEqual(keyAndGate.path, [12, 13, 14, 15, 16, 17]);
  assert.equal(keyAndGate.state.players[0].position, 17);
  assert.equal(keyAndGate.state.players[0].keys, 1);
  assert.deepEqual(keyAndGate.state.players[0].unlockedGates, []);

  const noKey = web.resolveTurn(gameAt(web, 15), 3);
  assert.deepEqual(noKey.path, [16, 17, 18]);
  assert.equal(noKey.state.players[0].position, 18);

  const savedKey = web.resolveTurn(gameAt(web, 16, 3), 1);
  assert.equal(savedKey.state.players[0].keys, 3);
  assert.deepEqual(savedKey.state.players[0].unlockedGates, []);
});

test("every snake and ladder has the same destination and effect", () => {
  for (const { from, to } of web.SNAKES) {
    const turn = expectSame(`snake ${from} to ${to}`, (rules) => {
      const game = gameAt(rules, from - 1, 3);
      game.players[0].unlockedGates = [...rules.LOCKED_SQUARES];
      return rules.resolveTurn(game, 1);
    });
    assert.equal(turn.effect, "snake");
    assert.equal(turn.state.players[0].position, to);
  }

  for (const { from, to } of web.LADDERS) {
    const turn = expectSame(`ladder ${from} to ${to}`, (rules) => {
      const game = gameAt(rules, from - 1, 3);
      game.players[0].unlockedGates = [...rules.LOCKED_SQUARES];
      return rules.resolveTurn(game, 1);
    });
    assert.equal(turn.effect, "ladder");
    assert.equal(turn.state.players[0].position, to);
  }
});

test("legacy saves recover keys and gate history the same way", () => {
  for (const [position, openedGates] of [
    [16, []],
    [43, [17]],
    [66, [17, 44]],
  ]) {
    for (let roll = 1; roll <= 6; roll += 1) {
      const repaired = expectSame(`legacy repair at ${position}`, (rules) => {
        const legacy = gameAt(rules, position);
        delete legacy.players[0].unlockedGates;
        return rules.repairLegacyGame(legacy);
      });
      assert.equal(repaired.players[0].keys, 1);
      assert.deepEqual(repaired.players[0].unlockedGates, openedGates);
      // Gate handling is temporarily web-only while the user finishes the browser version.
      const turn = web.resolveTurn(repaired, roll);
      assert.equal(turn.path.length, roll);
    }
  }

  const preserved = expectSame("legacy repair preserves unrelated save data", (rules) => {
    const legacy = gameAt(rules, 16);
    delete legacy.players[0].unlockedGates;
    legacy.turnNumber = 20;
    legacy.players[1] = { ...legacy.players[1], position: 35, keys: 3 };
    return rules.repairLegacyGame(legacy);
  });
  assert.equal(preserved.turnNumber, 20);
  assert.equal(preserved.players[0].position, 16);
  assert.deepEqual(preserved.players[1], {
    ...web.createGame().players[1],
    position: 35,
    keys: 3,
  });
});

test("opened gates remain open after a snake sends a player behind them", () => {
  const turns = expectSame("revisit previously opened gate", (rules) => {
    const game = gameAt(rules, 57);
    game.players[0].unlockedGates = [17, 44];
    const snake = rules.resolveTurn(game, 1);
    snake.state.currentPlayerIndex = 0;
    const revisit = rules.resolveTurn(snake.state, 1);
    return { snake, revisit };
  });
  assert.equal(turns.snake.state.players[0].position, 43);
  assert.equal(turns.revisit.state.players[0].position, 44);
  assert.equal(turns.revisit.state.players[0].keys, 0);
});

test("overshoots, boom resets, and exact-roll wins match", () => {
  const overshoot = expectSame("overshoot", (rules) =>
    rules.resolveTurn(gameAt(rules, 98), 3),
  );
  assert.deepEqual(overshoot.path, []);
  assert.equal(overshoot.state.players[0].position, 98);

  const boom = expectSame("boom square", (rules) =>
    rules.resolveTurn(gameAt(rules, 96), 1),
  );
  assert.equal(boom.effect, "boom");
  assert.equal(boom.state.players[0].position, 0);

  const win = expectSame("exact-roll win", (rules) =>
    rules.resolveTurn(gameAt(rules, 98), 2),
  );
  assert.equal(win.state.winnerId, "player-1");
  assert.equal(win.state.players[0].position, 100);
  expectSame("turn after a win", (rules) => rules.playTurn(win.state, 6));
});

test("legacy open-gate history remains harmless when a snake sends a player backward", () => {
  const turn = expectSame("legacy unlocked gate metadata", (rules) => {
    const game = gameAt(rules, 57);
    game.players[0].unlockedGates = [17, 44];
    const snake = rules.resolveTurn(game, 1);
    snake.state.currentPlayerIndex = 0;
    return rules.resolveTurn(snake.state, 1);
  });
  assert.equal(turn.state.players[0].position, 44);
  assert.equal(turn.state.players[0].keys, 0);
});