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

test("server applies Web Shooter authoritatively and broadcasts the target and source positions", () => {
  const room = fixture();
  room.game.players[0].powers.webShooter = 1;
  room.game.players[1].position = 23;
  applyRoomAction(room, room.members[0], {
    type: "web", targetPlayerId: room.members[1].id, expectedVersion: 1, actionId: "web-pull",
  });
  assert.equal(room.game.players[1].position, 20);
  assert.equal(room.game.players[0].powers.webShooter, 0);
  assert.equal(room.transition?.effect, "web");
  assert.equal(room.transition?.playerId, room.members[1].id);
  assert.equal(room.transition?.from, 23);
  assert.equal(room.transition?.sourcePlayerId, room.members[0].id);
  assert.equal(room.transition?.sourcePosition, 20);
  assert.deepEqual(room.transition?.path, [22, 21, 20]);
});

test("server applies Knife and preserves both charges when the rival blocks it", () => {
  const room = fixture();
  room.game.players[0].position = 44;
  room.game.players[0].powers.knife = 1;
  room.game.players[1].position = 44;
  applyRoomAction(room, room.members[0], {
    type: "knife", targetPlayerId: room.members[1].id, expectedVersion: 1, actionId: "knife-hit",
  });
  assert.equal(room.game.players[1].position, 0);
  assert.equal(room.game.players[0].powers.knife, 0);
  assert.equal(room.transition?.effect, "knife");
  assert.equal(room.transition?.playerId, room.members[1].id);
  assert.equal(room.transition?.sourcePlayerId, room.members[0].id);
  assert.equal(room.transition?.sourcePosition, 44);

  const blocked = fixture();
  blocked.game.players[0].position = 44;
  blocked.game.players[0].powers.knife = 1;
  blocked.game.players[1].position = 44;
  blocked.game.players[1].powers.knife = 1;
  applyRoomAction(blocked, blocked.members[0], {
    type: "knife", targetPlayerId: blocked.members[1].id, expectedVersion: 1, actionId: "knife-blocked",
  });
  assert.equal(blocked.game.players[0].powers.knife, 1);
  assert.equal(blocked.game.players[1].powers.knife, 1);
  assert.equal(blocked.game.players[1].position, 44);
  assert.equal(blocked.transition?.effect, null);
});

for (const count of [3,4]) test(`server ${count}-player rankings, finished spectators and unanimous rematch`, () => {
  const room=fixture();room.game=createGame(count);room.members=room.game.players.map(p=>({id:p.id,name:p.name,tokenHash:"test-only",lastSeen:Date.now()}));
  room.game.players.forEach(p=>{p.position=99;p.hasTorch=true;p.crownKeyRoom=17;p.keys=1;});
  for(let i=0;i<count-1;i++){
    room.ready_at=new Date(0);applyRoomAction(room,room.members[i],{type:"roll",expectedVersion:room.version,actionId:"finish-"+i},()=>1);
    if(i<count-2){assert.equal(room.status,"playing");assert.equal(room.game.currentPlayerIndex,i+1);room.members[i].lastSeen=0;assert.throws(()=>applyRoomAction(room,room.members[i],{type:"plant",square:100,expectedVersion:room.version,actionId:"retired-"+i}),/finished/);}
  }
  assert.equal(room.status,"finished");assert.equal(room.game.winnerIds.length,count-1);assert.equal(room.game.loserId,room.members[count-1].id);
  for(let i=0;i<count;i++){applyRoomAction(room,room.members[i],{type:"rematch",expectedVersion:room.version,actionId:"vote-"+i});if(i<count-1)assert.equal(room.status,"finished");}
  assert.equal(room.status,"playing");assert.equal(room.game.players.length,count);assert.deepEqual(room.game.winnerIds,[]);assert.equal(room.game.loserId,null);
});
