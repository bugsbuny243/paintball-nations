/** Two real Colyseus SDK sessions against an in-process Maçka room.
 * Network test does not represent 30-player capacity validation.
 */
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {boot} from '@colyseus/testing';
import {setTimeout as sleep} from 'node:timers/promises';
import {onlineServer} from '../apps/game-backend/src/online-server.ts';
import {MackaSimulation,normalizeInput,type BattleSnapshot} from '../apps/game-backend/src/rooms/macka-simulation.ts';
import {readFileSync} from 'node:fs';
const geo=JSON.parse(readFileSync(new URL('../maps/istanbul-macka.json',import.meta.url),'utf8')) as {buildings:{p:number[][]}[]};

test('A2 two human sessions join one authoritative Colyseus Maçka room',async()=>{
  const testServer=await boot(onlineServer);
  try{
    const room=await testServer.createRoom('macka_frontline');
    const blue=await testServer.connectTo(room);
    const red=await testServer.connectTo(room);
    assert.equal(blue.roomId,red.roomId);
    assert.notEqual(blue.sessionId,red.sessionId);
    const before=room.game.snapshot() as BattleSnapshot;
    assert.equal(before.playerCounts.blue,1);
    assert.equal(before.playerCounts.red,1);
    assert.equal(before.bots,0);
    assert.equal(before.players.length,2);
    assert.ok(before.players.every(p=>p.isBot===false));
    assert.equal(room.maxClients,30);
    const start=before.players.find(p=>p.id===blue.sessionId);
    assert.ok(start);
    assert.equal(start.team,'blue');

    let latest:any;
    red.onMessage('snapshot',(msg:any)=>{latest=msg;});
    blue.send('input',{seq:1,mx:0,mz:1,yaw:0,pitch:0,fire:false});
    await sleep(220);
    const current=room.game.snapshot() as BattleSnapshot;
    assert.ok(current.players.find(p=>p.id===blue.sessionId)!.z<start.z);
    assert.ok(latest && latest.players.length===2);
    assert.equal(latest.mapId,'TR-MACKA');

    const movement=current.players.find(p=>p.id===blue.sessionId)!;
    blue.send('input',{seq:1,mx:0,mz:1,yaw:0,pitch:0,fire:false});
    await sleep(70);
    assert.equal(room.game.players.get(blue.sessionId)!.lastSeq,1);

    blue.send('input',{seq:2,mx:0,mz:0,yaw:0,pitch:0,fire:true,
       x:999999,z:999999,score:999999,team:'red'});
    await sleep(160);
    const hit=room.game.snapshot() as BattleSnapshot;
    const after=hit.players.find(p=>p.id===blue.sessionId)!;
    assert.ok(Math.abs(after.x)<96 && Math.abs(after.z)<124);
    assert.equal(after.team,'blue');
    assert.equal(hit.scores.red,0);
    assert.ok([0,100].includes(hit.scores.blue)); // World geometry can legitimately occlude a shot.
    assert.ok(hit.players.length===2);
    await blue.leave();
    await red.leave();
  }finally{
    await testServer.shutdown();
  }
});
test('A2 game simulation rejects client position, invalid values and untrusted score',()=>{
  assert.equal(normalizeInput({seq:1,mx:10000,mz:0,yaw:0,pitch:0,fire:false}),null);
  assert.equal(normalizeInput({seq:1,mx:NaN,mz:0,yaw:0,pitch:0,fire:false}),null);
  const game=new MackaSimulation(geo);
  const a=game.addPlayer('human-a'),b=game.addPlayer('human-b');
  assert.equal(a.team,'blue');
  assert.equal(b.team,'red');
  assert.equal(game.submitInput('human-a',{seq:1,mx:0,mz:1,yaw:0,pitch:0,
    fire:false,x:99999,score:99999}),true);
  for(let i=0;i<10;i++)game.step(.05);
  assert.equal(game.scores.blue,0);
  assert.equal(game.scores.red,0);
  assert.ok(game.snapshot().players[0].z < a.z);
  assert.equal(game.snapshot().players[0].team,'blue');
  assert.equal(game.submitInput('human-a',{seq:1,mx:1,mz:0,yaw:0,pitch:0,fire:false}),false);
  assert.equal(game.submitInput('human-a',{seq:2,mx:Infinity,mz:0,yaw:0,pitch:0,fire:false}),false);
  assert.equal(game.snapshot().bots,0);
  game.removePlayer('human-b');
  assert.equal(game.snapshot().playerCounts.red,0);
});

test('A2 30 simulated network sessions fill one 15v15 room and exchange inputs',{timeout:90000},async()=>{
  const testServer=await boot(onlineServer);
  const players:Awaited<ReturnType<typeof testServer.connectTo>>[]=[];
  try {
    const room=await testServer.createRoom('macka_frontline');
    for(let i=0;i<30;i++)players.push(await testServer.connectTo(room));
    const snap=room.game.snapshot() as BattleSnapshot;
    assert.equal(snap.players.length,30);
    assert.equal(snap.playerCounts.blue,15);
    assert.equal(snap.playerCounts.red,15);
    assert.equal(snap.bots,0);
    assert.equal(new Set(players.map(p=>p.sessionId)).size,30);
    for(let i=0;i<players.length;i++) {
      players[i].send('input',{
        seq:1,mx:i%2?1:0,mz:i%2?0:1,
        yaw:i%2?180:0,pitch:0,fire:false
      });
    }
    await sleep(300);
    const later=room.game.snapshot() as BattleSnapshot;
    assert.equal(later.players.length,30);
    assert.equal(later.playerCounts.blue,15);
    assert.equal(later.playerCounts.red,15);
    assert.ok(Array.from(room.game.players.values()).every(p=>p.lastSeq===1));
    assert.ok(later.serverTick>snap.serverTick);
  } finally {
    await Promise.allSettled(players.map(p=>p.leave()));
    await testServer.shutdown();
  }
});
