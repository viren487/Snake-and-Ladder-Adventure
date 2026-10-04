import assert from "node:assert/strict";
import test from "node:test";
import * as web from "../artifacts/snack-ladder-game/src/game-engine.ts";

// The website game intentionally has its own rules and release scope.
const engines = [{ name: "web", rules: web }];

function gameAt(rules, position, keys = 0) {
  const game = rules.createGame();
  game.players[0] = { ...game.players[0], position, keys: keys ? 1 : 0,
    hasTorch: keys > 0, crownKeyRoom: keys ? 17 : null };
  return game;
}

function expectSame(label, run) {
  void label;
  return run(web);
}

test("browser game exposes the new long snake and valid starting inventory", () => {
  assert.ok(web.SNAKES.some(({ from, to }) => from === 68 && to === 11));
  assert.equal(web.createGame().players.length, 2);
  assert.equal(web.createGame().players[0].powers.webShooter, 0);
  assert.equal(web.createGame().players[0].powers.knife, 0);
});

test("only exact black-room landings after torch collection grant a crown key", () => {
  for (const room of web.KEY_SQUARES) {
    for (const hasTorch of [false, true]) {
      const landed = expectSame(`black room ${room}, torch=${hasTorch}`, (rules) => {
        const game = gameAt(rules, room - 1);
        game.players[0].hasTorch = hasTorch;
        return rules.resolveTurn(game, 1);
      });
      assert.equal(landed.state.players[0].keys, hasTorch ? 1 : 0);
      assert.equal(landed.state.players[0].crownKeyRoom, hasTorch ? room : null);
      const crossed = expectSame("crossing never collects crown key", (rules) => {
        const game = gameAt(rules, room - 1);
        game.players[0].hasTorch = hasTorch;
        return rules.resolveTurn(game, 2);
      });
      assert.equal(crossed.state.players[0].keys, 0);
    }
  }
  const snake = expectSame("snake lands on ammo room 25, not a key", (rules) =>
    rules.resolveTurn(gameAt(rules, 35), 1),
  );
  assert.equal(snake.effect, "snake");
  assert.equal(snake.state.players[0].position, 25);
  assert.equal(snake.state.players[0].keys, 0);

  const ladder = expectSame("ladder passes key 63", (rules) => {
    const game = gameAt(rules, 45);
    game.players[0].unlockedGates = [17, 44];
    return rules.resolveTurn(game, 1);
  });
  assert.equal(ladder.effect, "ladder");
  assert.equal(ladder.state.players[0].position, 66);
  assert.equal(ladder.state.players[0].keys, 0);
});

test("browser game allows movement through dark rooms without consuming keys", () => {
  const keyAndGate = expectSame("cross key and paused gate", (rules) => rules.resolveTurn(gameAt(rules, 11), 6));
  assert.deepEqual(keyAndGate.path, [12, 13, 14, 15, 16, 17]);
  assert.equal(keyAndGate.state.players[0].position, 17);
  assert.equal(keyAndGate.state.players[0].keys, 0);
  assert.deepEqual(keyAndGate.state.players[0].unlockedGates, []);

  const noKey = expectSame("cross gate without a key", (rules) => rules.resolveTurn(gameAt(rules, 15), 3));
  assert.deepEqual(noKey.path, [16, 17, 18]);
  assert.equal(noKey.state.players[0].position, 18);

  const savedKey = expectSame("paused gate preserves keys", (rules) => rules.resolveTurn(gameAt(rules, 16, 3), 1));
  assert.equal(savedKey.state.players[0].keys, 1);
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

test("legacy saves preserve gate metadata without awarding obsolete crown keys", () => {
  for (const [position, openedGates] of [
    [16, []],
    [43, [17]],
    [66, [17, 44]],
  ]) {
    for (let roll = 1; roll <= 6; roll += 1) {
      const repaired = expectSame(`legacy repair at ${position}`, (rules) => {
        const legacy = gameAt(rules, position);
        legacy.players[0].unlockedGates = [...openedGates];
        delete legacy.players[0].hasTorch;
        delete legacy.players[0].crownKeyRoom;
        return rules.repairLegacyGame(legacy);
      });
      assert.equal(repaired.players[0].keys, 0);
      assert.deepEqual(repaired.players[0].unlockedGates, openedGates);
      const turn = expectSame("resume old round", (rules) => rules.resolveTurn(repaired, roll));
      assert.equal(turn.path.length, roll);
    }
  }

  const preserved = expectSame("legacy repair preserves unrelated save data", (rules) => {
    const legacy = gameAt(rules, 16);
    delete legacy.players[0].unlockedGates;
    legacy.turnNumber = 20;
    legacy.players[1] = { ...legacy.players[1], position: 35, keys: 3 };
    delete legacy.players[1].hasTorch;
    delete legacy.players[1].crownKeyRoom;
    return rules.repairLegacyGame(legacy);
  });
  assert.equal(preserved.turnNumber, 20);
  assert.equal(preserved.players[0].position, 16);
  assert.deepEqual(preserved.players[1], {
    ...web.createGame().players[1],
    position: 35,
    keys: 0,
    legacyKeys: 3,
  });
});

test("every board square and roll resolves valid state, path, message and effect", () => {
  for (let position = 0; position <= 100; position++) {
    for (let roll = 1; roll <= 6; roll++) {
      for (const bullets of [0, 1, 2, 5]) {
        for (const stuns of [{ 98: 0, 99: 0 }, { 98: 1, 99: 3 }, { 98: 3, 99: 1 }]) {
          for (const stage of [0, 1, 2]) {
          expectSame(`${position}+${roll}, ammo=${bullets}, stuns=${JSON.stringify(stuns)}`, (rules) => {
            const game = gameAt(rules, position, stage === 2 ? 1 : 0);
            game.players[0].hasTorch = stage > 0;
            game.players[0].bullets = bullets;
            game.players[0].snakeStuns = { ...stuns };
            const before = structuredClone(game);
            const result = rules.resolveTurn(game, roll);
            assert.deepEqual(game, before, "turn mutated its input");
            return result;
          });
          }
        }
      }
    }
  }
});

test("only final bullet-room landings earn ammo, including snake destinations, capped at five", () => {
  for (const square of web.BULLET_PICKUP_SQUARES) {
    const landed = expectSame(`pickup ${square}`, (rules) => rules.resolveTurn(gameAt(rules, square - 1), 1));
    assert.equal(landed.state.players[0].bullets, 1);
    const crossing = expectSame(`cross ${square}`, (rules) => rules.resolveTurn(gameAt(rules, square - 1), 2));
    assert.equal(crossing.state.players[0].bullets, 0);
  }
  for (const [from, to] of [[36, 25], [98, 77], [99, 61]]) {
    const snake = expectSame(`snake pickup ${from}`, (rules) => rules.resolveTurn(gameAt(rules, from - 1), 1));
    assert.equal(snake.state.players[0].position, to);
    assert.equal(snake.state.players[0].bullets, 1);
  }
  const ladder = expectSame("ladder bypasses ammo", (rules) => rules.resolveTurn(gameAt(rules, 45), 1));
  assert.equal(ladder.state.players[0].bullets, 0);
  assert.equal(ladder.state.players[0].keys, 0);
  const capped = expectSame("max ammo", (rules) => {
    const game = gameAt(rules, 5);
    game.players[0].bullets = 5;
    return rules.resolveTurn(game, 1);
  });
  assert.equal(capped.state.players[0].bullets, 5);
});

function pendingAt(rules, square = 94, bullets = 2, index = 0) {
  const game = rules.createGame();
  game.currentPlayerIndex = index;
  game.players[index].position = square - 1;
  game.players[index].bullets = bullets;
  return rules.resolveTurn(game, 1).state;
}

test("gun rooms pause for 98, 99 or both; one bullet per target; pass keeps ammo", () => {
  for (const index of [0, 1]) {
    for (const square of web.GUN_SQUARES) {
      for (const bullets of [0, 1, 2, 5]) {
        const pending = expectSame(`gun ${square}, ammo ${bullets}, player ${index}`, (rules) => pendingAt(rules, square, bullets, index));
        assert.equal(pending.pendingFireForPlayerId, bullets ? pending.players[index].id : null);
        assert.equal(pending.currentPlayerIndex, bullets ? index : 1 - index);
        if (!bullets) continue;
        const unchanged = expectSame("cannot roll before firing", (rules) => rules.resolveTurn(pending, 6));
        assert.deepEqual(unchanged.state, pending);
        for (const targets of [[98], [99], [98, 99]]) {
          if (targets.length > bullets) {
            for (const { rules } of engines) assert.throws(() => rules.shootSnakes(pending, targets), /one bullet per target/);
            continue;
          }
          const shot = expectSame(`shoot ${targets}`, (rules) => rules.shootSnakes(pending, targets));
          assert.equal(shot.players[index].bullets, bullets - targets.length);
          assert.equal(shot.currentPlayerIndex, 1 - index);
          assert.equal(shot.pendingFireForPlayerId, null);
          for (const target of targets) assert.equal(shot.players[index].snakeStuns[target], 3);
          assert.deepEqual(shot.players[1 - index].snakeStuns, { 98: 0, 99: 0 });
        }
        const passed = expectSame("pass keeps bullets", (rules) => rules.passFire(pending));
        assert.equal(passed.players[index].bullets, bullets);
        assert.equal(passed.currentPlayerIndex, 1 - index);
      }
    }
  }
  const crossing = expectSame("crossing guns is not firing", (rules) => {
    const game = gameAt(rules, 93);
    game.players[0].bullets = 2;
    return rules.resolveTurn(game, 6);
  });
  assert.equal(crossing.state.pendingFireForPlayerId, null);
});

test("illegal shots and already stunned targets fail without mutating the game", () => {
  for (const { rules } of engines) {
    assert.throws(() => rules.shootSnake(rules.createGame(), 98), /waiting to fire/);
    const pending = pendingAt(rules);
    const before = structuredClone(pending);
    for (const targets of [[], [98, 98], [97], [98, 99, 98]]) {
      assert.throws(() => rules.shootSnakes(pending, targets), /once each/);
    }
    assert.deepEqual(pending, before);
    pending.players[0].snakeStuns[98] = 2;
    assert.throws(() => rules.shootSnake(pending, 98), /already stunned/);
    pending.players[0].position = 61;
    assert.throws(() => rules.shootSnake(pending, 99), /gun room/);
  }
});

test("stuns protect only the shooter for exactly three own rolls, including overshoots", () => {
  for (const index of [0, 1]) {
    for (const target of [98, 99]) {
      let state = expectSame("initial shot", (rules) => rules.shootSnake(pendingAt(rules, 94, 1, index), target));
      for (const remaining of [2, 1, 0]) {
        state.players[1 - index].position = target - 1;
        const opponent = expectSame("opponent still bitten", (rules) => rules.resolveTurn(state, 1));
        assert.equal(opponent.effect, "snake");
        assert.equal(opponent.state.players[index].snakeStuns[target], remaining + 1);
        state = opponent.state;
        state.players[index].position = target - 1;
        const own = expectSame("shooter safe, including third roll", (rules) => rules.resolveTurn(state, 1));
        assert.equal(own.effect, null);
        assert.equal(own.state.players[index].position, target);
        assert.equal(own.state.players[index].snakeStuns[target], remaining);
        state = own.state;
      }
      state.currentPlayerIndex = index;
      state.players[index].position = target - 1;
      assert.equal(expectSame("fourth own roll is unprotected", (rules) => rules.resolveTurn(state, 1)).effect, "snake");
    }
  }
  const overshoot = expectSame("overshoot consumes own protection", (rules) => {
    const game = gameAt(rules, 99);
    game.players[0].snakeStuns[98] = 3;
    return rules.resolveTurn(game, 6);
  });
  assert.equal(overshoot.state.players[0].snakeStuns[98], 2);
});

test("old saves default ammo and stuns without retroactive pickups, and resume pending fire safely", () => {
  const repaired = expectSame("pre-ammo migration", (rules) => {
    const game = gameAt(rules, 77, 4);
    for (const player of game.players) {
      delete player.bullets;
      delete player.snakeStuns;
      delete player.hasTorch;
      delete player.crownKeyRoom;
    }
    game.players[0].keys = 4;
    delete game.pendingFireForPlayerId;
    return rules.repairLegacyGame(game);
  });
  assert.equal(repaired.players[0].position, 77);
  assert.equal(repaired.players[0].keys, 0);
  assert.equal(repaired.players[0].legacyKeys, 4);
  assert.equal(repaired.players[0].bullets, 0);
  assert.deepEqual(repaired.players[0].snakeStuns, { 98: 0, 99: 0 });
  assert.equal(repaired.pendingFireForPlayerId, null);
  const valid = expectSame("pending fire round trip", (rules) =>
    rules.repairLegacyGame(JSON.parse(JSON.stringify(pendingAt(rules)))));
  assert.equal(valid.pendingFireForPlayerId, "player-1");
  const invalid = expectSame("off-gun legacy pending choice", (rules) => {
    const game = pendingAt(rules);
    game.players[0].position = 61;
    return rules.repairLegacyGame(game);
  });
  assert.equal(invalid.currentPlayerIndex, 1);
  assert.equal(invalid.pendingFireForPlayerId, null);
});

test("1000 seeded complete browser games maintain valid state across roll, shoot, pass and reload", () => {
  let seed = 812;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let round = 0; round < 1000; round++) {
    let game = expectSame("new round", (rules) => rules.createGame());
    for (let turn = 0; turn < 2000 && !game.winnerId; turn++) {
      const roll = 1 + Math.floor(random() * 6);
      const resolved = expectSame(`round ${round} turn ${turn}`, (rules) => rules.resolveTurn(game, roll));
      game = resolved.state;
      while (game.pendingChoice) {
        game = game.pendingChoice.kind === "mystery"
          ? web.choosePower(game, web.MYSTERY_POWER_TYPES[turn % web.MYSTERY_POWER_TYPES.length])
          : web.resolveDefense(game, false).state;
      }
      if (game.pendingFireForPlayerId) {
        const player = game.players[game.currentPlayerIndex];
        const available = web.SHOOTABLE_SNAKE_SQUARES.filter((square) => !player.snakeStuns[square]);
        const choice = random();
        const targets = choice < 0.3 ? [] : choice < 0.6 && player.bullets >= 2 ? available : available.slice(0, 1);
        game = expectSame("resolve firing", (rules) => targets.length ? rules.shootSnakes(game, targets) : rules.passFire(game));
      }
      if (turn % 20 === 0) game = expectSame("saved round reload", (rules) => rules.repairLegacyGame(JSON.parse(JSON.stringify(game))));
    }
    assert.ok(game.winnerId, `round ${round} did not finish`);
  }
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
    rules.resolveTurn(gameAt(rules, 98, 1), 2),
  );
  assert.equal(win.state.winnerId, "player-1");
  assert.equal(win.state.players[0].position, 100);
  expectSame("turn after a win", (rules) => rules.playTurn(win.state, 6));
});

test("torch, keyless return, earned key and final crown progression work for each player", () => {
  for (const index of [0, 1]) {
    let state = expectSame("first arrival grants torch", (rules) => {
      const game = rules.createGame();
      game.currentPlayerIndex = index;
      game.players[index].position = 99;
      game.players[index].bullets = 3;
      return rules.resolveTurn(game, 1).state;
    });
    assert.equal(state.players[index].position, 0);
    assert.equal(state.players[index].hasTorch, true);
    assert.equal(state.players[1 - index].hasTorch, false);
    assert.equal(state.winnerId, null);
    state.currentPlayerIndex = index;
    state.players[index].position = 99;
    const noKey = expectSame("keyless retry", (rules) => rules.resolveTurn(state, 1));
    assert.equal(noKey.effect, "return");
    assert.equal(noKey.state.players[index].position, 0);
    state = noKey.state;
    state.currentPlayerIndex = index;
    state.players[index].position = 43;
    state = expectSame("earn crown key", (rules) => rules.resolveTurn(state, 1).state);
    assert.equal(state.players[index].crownKeyRoom, 44);
    assert.equal(state.players[index].keys, 1);
    state.currentPlayerIndex = index;
    state.players[index].position = 96;
    state = expectSame("boom preserves quest progress", (rules) => rules.resolveTurn(state, 1).state);
    assert.equal(state.players[index].crownKeyRoom, 44);
    state = expectSame("quest reload preserves progress", (rules) => rules.repairLegacyGame(JSON.parse(JSON.stringify(state))));
    state.currentPlayerIndex = index;
    state.players[index].position = 99;
    state = expectSame("final crown", (rules) => rules.resolveTurn(state, 1).state);
    assert.equal(state.winnerId, state.players[index].id);
    assert.equal(state.players[index].position, 100);
  }
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