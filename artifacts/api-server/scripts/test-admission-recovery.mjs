import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const base = process.argv[2]?.replace(/\/$/, "");
if (!base) throw new Error("Supply the development API base URL.");
const hosts = [];
async function request(path, body, token) {
  const response = await fetch(`${base}${path}`, {
    method: body ? "POST" : "GET",
    headers: { ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30000),
  });
  return { status: response.status, data: await response.json() };
}
async function ticket() {
  const reply = await request("/rooms/admission-ticket", {});
  assert.equal(reply.status, 200);
  assert.match(reply.data.token, /^[a-f0-9]{64}$/);
  return reply.data.token;
}
try {
  for (const maxPlayers of [2, 3, 4]) {
    const hostToken = await ticket();
    const body = { name: "Recovery test host", maxPlayers, admissionToken: hostToken };
    const [first, retry] = await Promise.all([request("/rooms", body), request("/rooms", body)]);
    assert.equal(first.status, 201);
    assert.equal(retry.status, 201);
    assert.deepEqual(first.data.session, retry.data.session);
    const host = first.data.session;
    hosts.push(host);
    const path = `/rooms/${host.code}`;
    assert.equal(first.data.room.members.length, 1);
    for (let slot = 2; slot <= maxPlayers; slot++) {
      const admissionToken = await ticket();
      const input = { name: `Recovery guest ${slot}`, admissionToken };
      const initial = await request(`${path}/join`, input);
      assert.equal(initial.status, 200);
      assert.equal(initial.data.session.playerId, `player-${slot}`);
      if (slot === 2 || slot === maxPlayers) {
        const recovered = await request(`${path}/join`, input);
        assert.equal(recovered.status, 200);
        assert.deepEqual(recovered.data.session, initial.data.session);
        assert.equal(recovered.data.room.members.length, slot);
      }
      const snapshot = await request(path, undefined, initial.data.session.token);
      assert.equal(snapshot.status, 200);
      assert.equal(snapshot.data.yourPlayerId, `player-${slot}`);
      assert.ok(!JSON.stringify(snapshot.data).includes(admissionToken));
    }
    const snapshot = await request(path, undefined, host.token);
    assert.equal(snapshot.data.members.length, maxPlayers);
    assert.equal(snapshot.data.status, "playing");
    assert.equal((await request(`${path}/join`, {})).status, 409);
  }
  console.log("PASS: duplicate creates, recovered joins before/after room fills, original Player 1–4 seats, and private credentials for 2/3/4-player rooms.");
} finally {
  for (const host of hosts) {
    await request(`/rooms/${host.code}/actions`,
      { type: "leave", actionId: randomUUID(), expectedVersion: 0 }, host.token).catch(() => undefined);
  }
}