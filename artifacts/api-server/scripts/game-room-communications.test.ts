import assert from "node:assert/strict";
import test from "node:test";
import { createGame } from "@workspace/game-core";
import { applyRoomCommunication, roomSnapshot } from "../src/lib/game-rooms";

function fixture() {
  const game = createGame(3);
  const members = game.players.map((player) => ({
    id: player.id, name: player.name, tokenHash: "test-only", lastSeen: Date.now(),
  }));
  const room: Parameters<typeof applyRoomCommunication>[0] = {
    code: "CHAT42", status: "playing", version: 1, game, members, receipts: [],
    chat_messages: [], voice_signals: [], transition: null, rematch_votes: [], ready_at: new Date(0),
  };
  return { room, members };
}

test("room chat is attributed by the server, trimmed, and capped at 60 messages", () => {
  const { room, members } = fixture();
  for (let index = 0; index < 65; index++) {
    applyRoomCommunication(room, members[0], { type: "chat", text: `  message ${index}  ` });
  }
  assert.equal(room.chat_messages?.length, 60);
  assert.equal(room.chat_messages?.[0].text, "message 5");
  assert.equal(room.chat_messages?.at(-1)?.playerId, members[0].id);
  assert.equal(room.chat_messages?.at(-1)?.playerName, members[0].name);
  assert.throws(() => applyRoomCommunication(room, members[0], { type: "chat", text: "  " }), /1–400 characters/);
  assert.throws(() => applyRoomCommunication(room, members[0], { type: "chat", text: "x".repeat(401) }), /1–400 characters/);
});

test("voice signals are addressed only to another online room member", () => {
  const { room, members } = fixture();
  const { id } = applyRoomCommunication(room, members[0], {
    type: "offer", targetPlayerId: members[1].id, callId: "call-session-1234567890", sdp: "v=0\r\n",
  });
  assert.equal(room.voice_signals?.length, 1);
  assert.equal(roomSnapshot(room, members[1]).voiceSignals[0].id, id);
  assert.equal(roomSnapshot(room, members[0]).voiceSignals.length, 0);
  assert.throws(() => applyRoomCommunication(room, members[0], {
    type: "offer", targetPlayerId: members[0].id, callId: "call-session-1234567890", sdp: "v=0\r\n",
  }), /another player/);
  assert.throws(() => applyRoomCommunication(room, members[0], {
    type: "offer", targetPlayerId: "not-a-seat", callId: "call-session-1234567890", sdp: "v=0\r\n",
  }), /another player/);
  members[1].lastSeen = Date.now() - 26_000;
  assert.throws(() => applyRoomCommunication(room, members[0], {
    type: "answer", targetPlayerId: members[1].id, callId: "call-session-1234567890", sdp: "v=0\r\n",
  }), /offline/);
});

test("hangup signals do not require SDP and closed rooms reject new communications", () => {
  const { room, members } = fixture();
  applyRoomCommunication(room, members[0], {
    type: "hangup", targetPlayerId: members[1].id, callId: "call-session-1234567890",
  });
  assert.equal(room.voice_signals?.[0].type, "hangup");
  assert.equal(room.voice_signals?.[0].sdp, undefined);
  room.status = "closed";
  assert.throws(() => applyRoomCommunication(room, members[0], { type: "chat", text: "Hi" }), /room has ended/);
});