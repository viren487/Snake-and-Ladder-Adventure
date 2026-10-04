import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const base = process.argv[2]?.replace(/\/$/, "");
if (!base) throw new Error("Usage: node scripts/test-multiplayer.mjs https://your-development-domain/api");
const hosts = [];
async function request(path, { method = "GET", body, token } = {}) {
  const response = await fetch(`${base}${path}`, {
    method, headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10000),
  });
  return { status: response.status, data: await response.json() };
}
const action = (type, expectedVersion, extra = {}) => ({ type, expectedVersion, actionId: randomUUID(), ...extra });
try {
  const created = await request("/rooms", { method: "POST", body: { name: "API check host" } });
  assert.equal(created.status, 201);
  const host = created.data.session;
  hosts.push(host);
  const path = `/rooms/${host.code}`;
  assert.match(host.code, /^[A-Z2-9]{6}$/);
  assert.equal(created.data.room.status, "waiting");
  assert.equal((await request(path)).status, 401);
  assert.equal((await request(path, { token: "a".repeat(64) })).status, 403);
  assert.equal((await request("/rooms", { method: "POST", body: { name: "x".repeat(25) } })).status, 400);

  const joined = await request(`${path}/join`, { method: "POST", body: { name: "API check guest" } });
  assert.equal(joined.status, 200);
  const guest = joined.data.session;
  const version = joined.data.room.version;
  assert.equal(joined.data.room.status, "playing");
  assert.deepEqual(joined.data.room.members.map((member) => member.name), ["API check host", "API check guest"]);
  assert.equal((await request(`${path}/join`, { method: "POST", body: {} })).status, 409);
  assert.equal((await request(`${path}/actions`, { method: "POST", token: guest.token, body: action("roll", version) })).status, 403);
  assert.equal((await request(`${path}/actions`, { method: "POST", token: host.token, body: action("roll", version - 1) })).status, 409);

  const roll = action("roll", version, { roll: 999, game: { winnerId: host.playerId } });
  const [first, duplicate] = await Promise.all([
    request(`${path}/actions`, { method: "POST", token: host.token, body: roll }),
    request(`${path}/actions`, { method: "POST", token: host.token, body: roll }),
  ]);
  assert.equal(first.status, 200); assert.equal(duplicate.status, 200);
  assert.equal(first.data.version, version + 1);
  assert.deepEqual(first.data.game, duplicate.data.game);
  assert.equal(first.data.game.winnerId, null);
  assert.ok(first.data.event.roll >= 1 && first.data.event.roll <= 6);
  const restored = await request(path, { token: host.token });
  const peer = await request(path, { token: guest.token });
  assert.deepEqual(restored.data.game, first.data.game);
  assert.deepEqual(peer.data.game, first.data.game);
  assert.equal(restored.data.yourPlayerId, host.playerId);
  assert.ok(!JSON.stringify(restored.data).includes("tokenHash"));
  assert.ok(!JSON.stringify(restored.data).includes(guest.token));
  assert.equal((await request(`${path}/actions`, { method: "POST", token: host.token,
    body: action("leave", first.data.version) })).data.status, "closed");
  assert.equal((await request(path, { token: guest.token })).data.status, "closed");

  const raceRoom = await request("/rooms", { method: "POST", body: {} });
  hosts.push(raceRoom.data.session);
  const racePath = `/rooms/${raceRoom.data.session.code}`;
  const seats = await Promise.all(["Guest A", "Guest B"].map((name) =>
    request(`${racePath}/join`, { method: "POST", body: { name } })));
  assert.deepEqual(seats.map((result) => result.status).sort(), [200, 409]);
  assert.equal((await request(racePath, { token: raceRoom.data.session.token })).data.members.length, 2);
  console.log("Multiplayer API checks passed: authentication, room capacity/races, turn/version guards, server dice, duplicate-safe actions, reconnect state, private seat tokens, and room closure.");
  for (const count of [3,4]) {
    const made = await request("/rooms", {method:"POST",body:{name:"Capacity host",maxPlayers:count}});
    assert.equal(made.status,201);hosts.push(made.data.session);
    assert.equal(made.data.room.maxPlayers,count);assert.equal(made.data.room.game.players.length,count);
    const route = "/rooms/"+made.data.session.code;
    for(let i=1;i<count;i++){
      const joined=await request(route+"/join",{method:"POST",body:{name:"Capacity guest "+i}});
      assert.equal(joined.status,200);assert.equal(joined.data.room.members.length,i+1);
      assert.equal(joined.data.room.status,i+1===count?"playing":"waiting");
      assert.equal(joined.data.session.playerId,"player-"+(i+1));
    }
    assert.equal((await request(route+"/join",{method:"POST",body:{name:"Overflow"}})).status,409);
    const synced=await request(route,{token:made.data.session.token});
    assert.equal(synced.data.maxPlayers,count);assert.equal(new Set(synced.data.members.map(m=>m.id)).size,count);
  }
  assert.equal((await request("/rooms",{method:"POST",body:{maxPlayers:5}})).status,400);
  console.log("PASS: 3/4-player capacity, lobby readiness, distinct private seats and overflow rejection.");
} finally {
  for (const host of hosts) {
    await request(`/rooms/${host.code}/actions`, { method: "POST", token: host.token, body: action("leave", 0) }).catch(() => undefined);
  }
}