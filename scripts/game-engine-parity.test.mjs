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

function expectSame(label, run) {
  const results = engines.map(({ rules }) => run(rules));
  assert.deepEqual(results[0], results[1], `${label}: web and mobile results differ`);
  return results[0];
}

test("both apps use the same board rules and start state", () => {
  for (const name of ["SNAKES", "LADDERS", "KEY_SQUARES", "BOOM_SQUARE", "LOCKED_SQUARES"]) {
    assert.deepEqual(web[name], mobile[name], `${name} differs`);
  }
  assert.deepEqual(web.createGame(), mobile.createGame());
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

test("keys open gates during the same roll, and a missing key stops at the gate", () => {
  const opened = expectSame("key then gate in one roll", (rules) =>
    rules.resolveTurn(gameAt(rules, 11), 6),
  );
  assert.deepEqual(opened.path, [12, 13, 14, 15, 16, 17]);
  assert.equal(opened.state.players[0].position, 17);
  assert.equal(opened.state.players[0].keys, 0);
  assert.deepEqual(opened.state.players[0].unlockedGates, [17]);

  const blocked = expectSame("blocked gate", (rules) =>
    rules.resolveTurn(gameAt(rules, 15), 3),
  );
  assert.deepEqual(blocked.path, [16]);
  assert.equal(blocked.state.players[0].position, 16);
  assert.match(blocked.state.message, /gate 17/);
});

test("each locked gate opens once when its player has a key", () => {
  for (const [index, gate] of web.LOCKED_SQUARES.entries()) {
    const alreadyOpened = web.LOCKED_SQUARES.slice(0, index);
    const turn = expectSame(`open gate ${gate}`, (rules) => {
      const game = gameAt(rules, gate - 1, 1);
      game.players[0].unlockedGates = [...alreadyOpened];
      return rules.resolveTurn(game, 1);
    });
    assert.deepEqual(turn.path, [gate]);
    assert.equal(turn.state.players[0].position, gate);
    assert.equal(turn.state.players[0].keys, 0);
    assert.deepEqual(turn.state.players[0].unlockedGates, [...alreadyOpened, gate]);
  }
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
      const result = expectSame(`legacy position ${position}, roll ${roll}`, (rules) => {
        const legacy = gameAt(rules, position);
        delete legacy.players[0].unlockedGates;
        const repaired = rules.repairLegacyGame(legacy);
        return {
          repaired,
          turn: rules.resolveTurn(repaired, roll),
        };
      });
      assert.equal(result.repaired.players[0].keys, 1);
      assert.deepEqual(result.repaired.players[0].unlockedGates, openedGates);
      assert.equal(result.turn.path.length, roll);
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

test("seeded full games remain identical through every turn", () => {
  let seed = 812;
  const roll = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return 1 + Math.floor((seed / 4294967296) * 6);
  };

  for (let round = 0; round < 100; round += 1) {
    let webState = web.createGame();
    let mobileState = mobile.createGame();
    for (let turn = 0; turn < 2000 && !webState.winnerId; turn += 1) {
      const value = roll();
      const webResolution = web.resolveTurn(webState, value);
      const mobileResolution = mobile.resolveTurn(mobileState, value);
      assert.deepEqual(
        webResolution,
        mobileResolution,
        `round ${round}, turn ${turn}, roll ${value}: engines drifted`,
      );
      webState = webResolution.state;
      mobileState = mobileResolution.state;
    }
    assert.ok(webState.winnerId, `Round ${round} did not finish`);
  }
});