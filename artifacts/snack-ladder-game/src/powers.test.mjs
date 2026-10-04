import assert from "node:assert/strict";
import test from "node:test";
import * as web from "./game-engine.ts";

for (const [name, engine] of [["web", web]]) {
  const at = (position) => {
    const game = engine.createGame();
    game.players[0].position = position;
    return game;
  };
  const hostileBomb = (game, square) => {
    game.bombs.push({ id: "rival-bomb", square, ownerId: "player-2", armed: false });
    return game;
  };
  test(`${name}: valid six repeats, overshoot does not, including torch collection`, () => {
    assert.equal(engine.playTurn(at(0), 6).currentPlayerIndex, 0);
    const invalid = engine.resolveTurn(at(95), 6);
    assert.deepEqual(invalid.path, []);
    assert.equal(invalid.state.currentPlayerIndex, 1);
    assert.equal(invalid.state.players[0].position, 95);
    const torch = engine.playTurn(at(94), 6);
    assert.equal(torch.currentPlayerIndex, 0);
    assert.equal(torch.players[0].position, 0);
    assert.equal(torch.players[0].hasTorch, true);
    assert.equal(torch.winnerId, null);
  });
  test(`${name}: all mystery rooms offer five powers, without Extra Dice`, () => {
    assert.deepEqual(engine.MYSTERY_POWER_TYPES, ["bomb", "antiVenom", "defuser", "webShooter", "knife"]);
    for (const square of [14, 35, 51, 76]) {
      for (const power of engine.MYSTERY_POWER_TYPES) {
        let game = engine.playTurn(at(square - 1), 1);
        assert.equal(game.pendingChoice.kind, "mystery");
        assert.equal(game.currentPlayerIndex, 0);
        assert.equal(engine.playTurn(game, 2), game);
        game = engine.choosePower(game, power);
        assert.equal(game.players[0].powers[power], 1);
        assert.equal(game.currentPlayerIndex, 1);
        assert.equal(game.pendingChoice, null);
        assert.throws(() => engine.choosePower(game, power));
        assert.deepEqual(engine.repairLegacyGame(JSON.parse(JSON.stringify(game))), game);
      }
    }
    assert.throws(() => engine.choosePower(engine.playTurn(at(13), 1), "extraDice"));
    assert.equal(engine.playTurn(at(12), 3).pendingChoice, null); // Cross box 14.
    let six = engine.playTurn(at(8), 6);
    six = engine.choosePower(six, "bomb");
    assert.equal(six.currentPlayerIndex, 0);
    assert.match(six.message, /valid six/);
    const second = at(34);
    second.currentPlayerIndex = 1;
    second.players[1].position = 34;
    const picked = engine.choosePower(engine.playTurn(second, 1), "antiVenom");
    assert.equal(picked.players[1].powers.antiVenom, 1);
    assert.equal(picked.players[0].powers.antiVenom, 0);
  });
  test(`${name}: Web Shooter pulls only a rival one to three rooms ahead and clamps Home`, () => {
    const game = at(20);
    game.players[0].powers.webShooter = 1;
    game.players[1].position = 23;
    const before = structuredClone(game);
    const hit = engine.useWebShooter(game, "player-2");
    assert.deepEqual(hit.path, [22, 21, 20]);
    assert.equal(hit.effect, "web");
    assert.equal(hit.sourcePosition, 20);
    assert.equal(hit.state.players[1].position, 20);
    assert.equal(hit.state.players[0].powers.webShooter, 0);
    assert.deepEqual(game, before);

    const nearHome = at(0);
    nearHome.players[0].powers.webShooter = 1;
    nearHome.players[1].position = 2;
    const homeHit = engine.useWebShooter(nearHome, "player-2");
    assert.deepEqual(homeHit.path, [1, 0]);
    assert.equal(homeHit.state.players[1].position, 0);

    const tooFar = at(20);
    tooFar.players[0].powers.webShooter = 1;
    tooFar.players[1].position = 24;
    assert.throws(() => engine.useWebShooter(tooFar, "player-2"), /one to three rooms ahead/);
    const noCharge = at(20);
    noCharge.players[1].position = 21;
    assert.throws(() => engine.useWebShooter(noCharge, "player-2"), /No Web Shooter/);
  });
  test(`${name}: Knife sends an unprotected rival Home and preserves their progress`, () => {
    const game = at(44);
    game.players[0].powers.knife = 1;
    game.players[1].position = 44;
    game.players[1].hasTorch = true;
    game.players[1].crownKeyRoom = 17;
    game.players[1].keys = 1;
    game.players[1].bullets = 2;
    game.players[1].powers.bomb = 1;
    const hit = engine.useKnife(game, "player-2");
    assert.equal(hit.effect, "knife");
    assert.equal(hit.state.players[1].position, 0);
    assert.equal(hit.state.players[1].hasTorch, true);
    assert.equal(hit.state.players[1].crownKeyRoom, 17);
    assert.equal(hit.state.players[1].keys, 1);
    assert.equal(hit.state.players[1].bullets, 2);
    assert.equal(hit.state.players[1].powers.bomb, 1);
    assert.equal(hit.state.players[0].powers.knife, 0);
    assert.equal(game.players[1].position, 44);

    const clash = at(44);
    clash.players[0].powers.knife = 2;
    clash.players[1].position = 44;
    clash.players[1].powers.knife = 1;
    const blocked = engine.useKnife(clash, "player-2");
    assert.equal(blocked.effect, null);
    assert.equal(blocked.state.players[0].powers.knife, 2);
    assert.equal(blocked.state.players[1].powers.knife, 1);
    assert.equal(blocked.state.players[1].position, 44);
    assert.match(blocked.state.message, /neither charge was spent/);

    const home = at(0);
    home.players[0].powers.knife = 1;
    home.players[1].position = 0;
    assert.throws(() => engine.useKnife(home, "player-2"), /same numbered room/);
  });
  test(`${name}: six and Extra Dice survive shooting or passing`, () => {
    const armed = at(88);
    armed.players[0].bullets = 2;
    const waiting = engine.playTurn(armed, 6);
    assert.equal(waiting.pendingFireForPlayerId, "player-1");
    assert.equal(engine.shootSnakes(waiting, [98, 99]).currentPlayerIndex, 0);
    assert.equal(engine.passFire(waiting).currentPlayerIndex, 0);
    const power = at(93);
    power.players[0].powers.extraDice = 1;
    power.players[0].bullets = 1;
    const pending = engine.playTurn(engine.useExtraDice(power), 1);
    const completed = engine.passFire(pending);
    assert.equal(completed.currentPlayerIndex, 0);
    assert.equal(completed.players[0].extraRollCredits, 0);
  });
  test(`${name}: Extra Dice is consumable, explicitly armed and separate from a six`, () => {
    let game = at(18);
    game.players[0].powers.extraDice = 1;
    const before = structuredClone(game);
    game = engine.useExtraDice(game);
    assert.equal(game.players[0].powers.extraDice, 0);
    assert.equal(game.players[0].extraRollCredits, 1);
    assert.equal(before.players[0].powers.extraDice, 1);
    game = engine.playTurn(game, 6);
    assert.equal(game.currentPlayerIndex, 0);
    assert.equal(game.players[0].extraRollCredits, 1);
    game = engine.playTurn(game, 1);
    assert.equal(game.currentPlayerIndex, 0);
    assert.equal(game.players[0].extraRollCredits, 0);
    game = engine.playTurn(game, 1);
    assert.equal(game.currentPlayerIndex, 1);
    assert.throws(() => engine.useExtraDice(game));
    const invalid = at(95);
    invalid.players[0].powers.extraDice = 1;
    const powered = engine.playTurn(engine.useExtraDice(invalid), 6);
    assert.equal(powered.currentPlayerIndex, 0); // Explicit power, not a six bonus.
    assert.match(powered.message, /Extra Dice/);
    assert.doesNotMatch(powered.message, /valid six/);
  });
  test(`${name}: Anti-Venom is chosen before a bite; decline keeps the power and animates the slide`, () => {
    const game = at(92);
    game.players[0].powers.antiVenom = 1;
    const waiting = engine.resolveTurn(game, 6);
    assert.equal(waiting.state.players[0].position, 98);
    assert.equal(waiting.effect, null);
    assert.equal(waiting.state.pendingChoice.kind, "snake");
    assert.equal(engine.isValidPowerState(waiting.state), true);
    const safe = engine.resolveDefense(waiting.state, true);
    assert.equal(safe.state.players[0].position, 98);
    assert.equal(safe.state.players[0].powers.antiVenom, 0);
    assert.equal(safe.state.currentPlayerIndex, 0);
    const slide = engine.resolveDefense(waiting.state, false);
    assert.equal(slide.effect, "snake");
    assert.equal(slide.state.players[0].position, 77);
    assert.equal(slide.state.players[0].bullets, 1);
    assert.equal(slide.state.players[0].powers.antiVenom, 1);
    assert.equal(slide.state.currentPlayerIndex, 0);
    const stunned = at(97);
    stunned.players[0].powers.antiVenom = 1;
    stunned.players[0].snakeStuns[98] = 1;
    const passed = engine.playTurn(stunned, 1);
    assert.equal(passed.pendingChoice, null);
    assert.equal(passed.players[0].powers.antiVenom, 1);
  });
  test(`${name}: bombs require a later landing and owner-only manual detonation`, () => {
    let game = at(20);
    game.players[0].powers.bomb = 1;
    game.players[1].position = 20;
    game.players[1].hasTorch = true;
    game.players[1].crownKeyRoom = 44;
    game.players[1].keys = 1;
    game.players[1].bullets = 3;
    game.players[1].powers.extraDice = 2;
    game = engine.plantBomb(game, 20);
    const id = game.bombs[0].id;
    assert.throws(() => engine.detonateBomb(game, id)); // Planting under a rival is not a landing.
    game = engine.playTurn(game, 1);
    assert.throws(() => engine.detonateBomb(game, id)); // Rival cannot detonate owner's bomb.
    game.players[1].position = 19;
    game = engine.playTurn(game, 1);
    assert.equal(game.players[1].position, 20); // No automatic blast.
    assert.equal(game.bombs[0].armed, true);
    assert.equal(game.currentPlayerIndex, 0);
    const rivalBefore = structuredClone(game.players[1]);
    const blasted = engine.detonateBomb(game, id);
    assert.deepEqual(blasted.players[1], { ...rivalBefore, position: 0 });
    assert.equal(blasted.bombs.length, 0);
    assert.equal(blasted.currentPlayerIndex, 0);
    assert.equal(game.players[1].position, 20); // Immutable input.
  });
  test(`${name}: only the current room accepts planting; crossed rooms and snake heads do not arm bombs`, () => {
    for (let square = 1; square <= 100; square++) {
      const game = at(square);
      game.players[0].powers.bomb = 2;
      const planted = engine.plantBomb(game, square);
      assert.equal(planted.bombs[0].square, square);
      assert.throws(() => engine.plantBomb(planted, square));
    }
    const invalid = at(18);
    invalid.players[0].powers.bomb = 1;
    for (const square of [0, 101, 1.5, NaN]) assert.throws(() => engine.plantBomb(invalid, square));
    assert.equal(engine.playTurn(hostileBomb(at(18), 20), 3).bombs[0].armed, false);
    assert.equal(engine.playTurn(hostileBomb(at(97), 98), 1).bombs[0].armed, false);
  });
  test(`${name}: remote planting is rejected without spending a bomb`, () => {
    const game = at(18); game.players[0].powers.bomb = 1;
    assert.throws(() => engine.plantBomb(game, 19), /standing/);
    assert.equal(game.players[0].powers.bomb, 1);
    assert.equal(game.bombs.length, 0);
    const home = at(0); home.players[0].powers.bomb = 1;
    assert.throws(() => engine.plantBomb(home, 1));
  });
  test(`${name}: only owner may use an armed bomb during a rival bonus turn`, () => {
    let game = at(20); game.players[0].powers.bomb = 1;
    game = engine.plantBomb(game, 20);
    const id = game.bombs[0].id; const ownerId = game.players[0].id;
    game = engine.playTurn(game, 1);
    game.players[1].position = 14;
    game = engine.playTurn(game, 6);
    assert.equal(game.currentPlayerIndex, 1); assert.equal(game.bombs[0].armed, true);
    assert.throws(() => engine.detonateBomb(game, id, game.players[1].id));
    assert.throws(() => engine.detonateBomb(game, id, "unknown"));
    const blasted = engine.detonateBomb(game, id, ownerId);
    assert.equal(blasted.players[1].position, 0);
    assert.equal(blasted.currentPlayerIndex, 1);
    assert.equal(blasted.bombs.length, 0);
    assert.equal(game.players[1].position, 20);
  });
  test(`${name}: Defuser choice precedes boom and landing rewards, preserving six`, () => {
    const boom = at(91);
    boom.players[0].powers.defuser = 1;
    const waiting = engine.playTurn(boom, 6);
    assert.equal(waiting.players[0].position, 97);
    const safe = engine.resolveDefense(waiting, true);
    assert.equal(safe.state.players[0].position, 97);
    assert.equal(safe.state.players[0].powers.defuser, 0);
    assert.equal(safe.state.currentPlayerIndex, 0);
    const decline = engine.resolveDefense(waiting, false);
    assert.equal(decline.state.players[0].position, 0);
    assert.equal(decline.state.players[0].powers.defuser, 1);
    assert.equal(decline.effect, "boom");
    const ammo = hostileBomb(at(5), 6);
    ammo.players[0].powers.defuser = 1;
    const pending = engine.playTurn(ammo, 1);
    assert.equal(pending.players[0].bullets, 0);
    const disarmed = engine.resolveDefense(pending, true).state;
    assert.equal(disarmed.players[0].bullets, 1);
    assert.equal(disarmed.bombs.length, 0);
    const exposed = engine.resolveDefense(pending, false).state;
    assert.equal(exposed.players[0].position, 6);
    assert.equal(exposed.bombs[0].armed, true);
    assert.equal(engine.detonateBomb(exposed, "rival-bomb").players[0].position, 0);
  });
  test(`${name}: defensive choices chain safely; a newly selected kit protects a mystery room`, () => {
    const snake = hostileBomb(at(97), 98);
    snake.players[0].powers.antiVenom = 1;
    snake.players[0].powers.defuser = 1;
    let game = engine.playTurn(snake, 1);
    game = engine.resolveDefense(game, true).state;
    assert.equal(game.pendingChoice.kind, "bomb");
    game = engine.resolveDefense(game, true).state;
    assert.equal(game.players[0].position, 98);
    assert.equal(game.players[0].powers.antiVenom, 0);
    assert.equal(game.players[0].powers.defuser, 0);
    const box = engine.playTurn(hostileBomb(at(13), 14), 1);
    const picked = engine.choosePower(box, "defuser");
    assert.equal(picked.pendingChoice.kind, "bomb");
    const safe = engine.resolveDefense(picked, true).state;
    assert.equal(safe.pendingChoice, null);
    assert.equal(safe.players[0].powers.defuser, 0);
    assert.equal(safe.bombs.length, 0);
    const both = hostileBomb(at(96), 97);
    both.players[0].powers.defuser = 1;
    const defused = engine.resolveDefense(engine.playTurn(both, 1), true).state;
    assert.equal(defused.players[0].position, 97);
    assert.equal(defused.bombs.length, 0);
  });
  test(`${name}: save migration preserves all powers, choices, bonuses and bombs, including a choice at 100`, () => {
    const game = hostileBomb(at(94), 100);
    game.players[0].powers.defuser = 1;
    const waiting = engine.playTurn(game, 6);
    assert.equal(engine.isValidPowerState(waiting), true);
    const repaired = engine.repairLegacyGame(JSON.parse(JSON.stringify(waiting)));
    assert.deepEqual(repaired, waiting);
    const torch = engine.resolveDefense(repaired, true);
    assert.equal(torch.effect, "torch");
    assert.equal(torch.state.players[0].hasTorch, true);
    assert.equal(torch.state.players[0].position, 0);
    assert.equal(torch.state.currentPlayerIndex, 0);
    const legacy = at(35);
    legacy.turnNumber = 21;
    for (const player of legacy.players) { delete player.powers; delete player.extraRollCredits; }
    delete legacy.bombs; delete legacy.pendingChoice; delete legacy.bonusRollPending;
    const migrated = engine.repairLegacyGame(legacy);
    assert.equal(migrated.turnNumber, 21);
    assert.equal(migrated.players[0].position, 35);
    assert.equal(migrated.pendingChoice, null); // No retroactive box award.
    assert.deepEqual(migrated.players[0].powers, { bomb: 0, antiVenom: 0, defuser: 0, webShooter: 0, knife: 0, extraDice: 0 });
    for (const bad of [-1, 1.2, "1", null]) {
      const invalid = at(14);
      invalid.players[0].powers.bomb = bad;
      assert.equal(engine.isValidPowerState(invalid), false);
      assert.equal(engine.isValidPowerState(invalid), false);
    }
    const olderInventory = at(35);
    olderInventory.players[0].powers = { bomb: 0, antiVenom: 0, defuser: 0, extraDice: 1 };
    assert.equal(engine.isValidPowerState(olderInventory), true);
    assert.equal(engine.repairLegacyGame(olderInventory).players[0].powers.extraDice, 1);
  });
}

test("browser engine keeps 100 complete, powered seeded rounds valid", () => {
  let seed = 573;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (let round = 0; round < 100; round++) {
    let game = web.createGame();
    for (let turn = 0; turn < 2500 && !game.winnerId; turn++) {
      const current = game.players[game.currentPlayerIndex];
      const free = Array.from({ length: 100 }, (_, i) => i + 1).filter((n) => !game.bombs.some((b) => b.square === n));
      const ready = game.bombs.find((b) => b.ownerId === current.id && b.armed);
      const square = free.includes(current.position) ? current.position : null;
      const roll = Math.floor(random() * 6) + 1;
      const pick = web.MYSTERY_POWER_TYPES[Math.floor(random() * web.MYSTERY_POWER_TYPES.length)];
      const use = random() > 0.35;
      if (ready) game = web.detonateBomb(game, ready.id);
      if (current.powers.bomb > 0 && square) game = web.plantBomb(game, square);
      if (current.powers.extraDice > 0) game = web.useExtraDice(game);
      game = web.playTurn(game, roll);
      while (game.pendingChoice) {
        game = game.pendingChoice.kind === "mystery" ? web.choosePower(game, pick) : web.resolveDefense(game, use).state;
      }
      if (game.pendingFireForPlayerId) game = web.passFire(game);
      assert.equal(web.isValidPowerState(game), true);
      game = web.repairLegacyGame(JSON.parse(JSON.stringify(game)));
    }
    assert.ok(game.winnerId, `Powered round ${round} should finish.`);
  }
});