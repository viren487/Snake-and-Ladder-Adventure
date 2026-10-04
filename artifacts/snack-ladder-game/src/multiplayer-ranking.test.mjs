import assert from 'node:assert/strict';
import test from 'node:test';
import * as game from './game-engine.ts';
for(const count of [2,3,4]) {
  test(`${count} players: first N-1 win, only last loses; finishers leave rotation`,()=>{
    let state=game.createGame(count);
    state.players.forEach(p=>{p.position=99;p.hasTorch=true;p.crownKeyRoom=17;p.keys=1;});
    for(let i=0;i<count-1;i++){
      assert.equal(state.currentPlayerIndex,i); state=game.playTurn(state,1);
      assert.deepEqual(state.winnerIds,state.players.slice(0,i+1).map(p=>p.id));
      if(i<count-2){assert.equal(state.winnerId,null);assert.equal(state.loserId,null);assert.equal(state.currentPlayerIndex,i+1);}
    }
    assert.equal(state.winnerId,state.players[0].id);assert.equal(state.loserId,state.players[count-1].id);
    assert.deepEqual(game.playTurn(state,1),state);
  });
}
test('a crowned player does not retain a six bonus or banked Extra Dice',()=>{
  let state=game.createGame(4);const p=state.players[0];p.position=94;p.hasTorch=true;p.crownKeyRoom=17;p.keys=1;p.extraRollCredits=2;
  state=game.playTurn(state,6);assert.equal(state.currentPlayerIndex,1);assert.equal(state.bonusRollPending,false);
  state.players[1].position=10;state=game.playTurn(state,1);state=game.playTurn(state,1);state=game.playTurn(state,1);assert.equal(state.currentPlayerIndex,1);
});
test('shot snake stays inactive for shooter three dice, other players still get bitten, fourth bites again',()=>{
  let state=game.createGame(4);state.players[0].position=94;state.players[0].bullets=1;state.pendingFireForPlayerId=state.players[0].id;
  state=game.shootSnakes(state,[98]);
  for(let i=0;i<3;i++){
    for(let j=0;j<3;j++){const current=state.players[state.currentPlayerIndex];if(i===0&&j===0)current.position=97;state=game.playTurn(state,1);if(i===0&&j===0)assert.equal(state.players[1].position,77);}
    assert.equal(state.currentPlayerIndex,0);state.players[0].position=97;state=game.playTurn(state,1);
    assert.equal(state.players[0].position,98);assert.equal(state.players[0].snakeStuns[98],2-i);
  }
  for(let j=0;j<3;j++)state=game.playTurn(state,1);state.players[0].position=97;state=game.playTurn(state,1);assert.equal(state.players[0].position,77);
});
test('only 2, 3 or 4 player rooms are accepted',()=>{for(const n of [0,1,5,2.5])assert.throws(()=>game.createGame(n));});
