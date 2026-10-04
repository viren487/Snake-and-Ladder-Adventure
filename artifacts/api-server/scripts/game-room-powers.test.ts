import assert from "node:assert/strict";
import test from "node:test";
import { createGame, plantBomb } from "@workspace/game-core";
import { applyRoomAction } from "../src/lib/game-rooms";

function fixture() {
  const game = createGame(); game.players[0].position = 20; game.players[0].powers.bomb = 1;
  const members = game.players.map((p) => ({id:p.id,name:p.name,tokenHash:"test-only",lastSeen:Date.now()}));
  const room: Parameters<typeof applyRoomAction>[0] = {code:"TEST22",status:"playing",version:1,game,members,receipts:[],transition:null,rematch_votes:[],ready_at:new Date(0)};
  return room;
}
test("server rejects planting outside the authenticated player current room", () => {
  const room=fixture();
  assert.throws(() => applyRoomAction(room,room.members[0],{type:"plant",square:21,expectedVersion:1,actionId:"remote"}), /standing/);
  assert.equal(room.game.players[0].powers.bomb,1); assert.equal(room.game.bombs.length,0); assert.equal(room.version,1);
  applyRoomAction(room,room.members[0],{type:"plant",square:20,expectedVersion:1,actionId:"here"});
  assert.equal(room.game.bombs[0].square,20); assert.equal(room.game.bombs[0].ownerId,room.members[0].id);
});
test("server accepts owner interrupt, rejects rival use and preserves idempotency", () => {
  const room=fixture(); room.game=plantBomb(room.game,20); room.game.players[1].position=20;
  room.game.currentPlayerIndex=1; room.game.bombs[0].armed=true;
  const id=room.game.bombs[0].id;
  assert.throws(() => applyRoomAction(room,room.members[1],{type:"detonate",bombId:id,expectedVersion:1,actionId:"wrong-owner"}));
  assert.equal(room.game.players[1].position,20); assert.equal(room.version,1);
  const command={type:"detonate" as const,bombId:id,expectedVersion:1,actionId:"owner-blast"};
  applyRoomAction(room,room.members[0],command);
  assert.equal(room.game.players[1].position,0); assert.equal(room.game.currentPlayerIndex,1); assert.equal(room.game.bombs.length,0);
  assert.equal(room.transition?.playerId,room.members[1].id); assert.equal(room.transition?.effect,"boom"); assert.equal(room.version,2);
  applyRoomAction(room,room.members[0],command); assert.equal(room.version,2);
});
test("a landing defense must resolve before an owner can blast", () => {
  const room=fixture(); room.game=plantBomb(room.game,20); room.game.players[1].position=20;
  room.game.currentPlayerIndex=1; room.game.players[1].powers.defuser=1; room.game.bombs[0].armed=true;
  const id=room.game.bombs[0].id; room.game.pendingChoice={kind:"bomb",playerId:room.members[1].id,square:20,bombId:id};
  assert.throws(() => applyRoomAction(room,room.members[0],{type:"detonate",bombId:id,expectedVersion:1,actionId:"too-early"}), /landing choice/);
  assert.equal(room.game.bombs.length,1); assert.equal(room.game.players[1].position,20);
});
