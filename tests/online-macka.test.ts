/** Two real Colyseus SDK sessions against an in-process Maçka room.
 * Network test does not represent 30-player capacity validation.
 */
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {boot} from '@colyseus/testing';
import {setTimeout as sleep} from 'node:timers/promises';
import {onlineServer} from '../apps/game-backend/src/online-server.ts';
import {MackaFrontlineRoom} from '../apps/game-backend/src/rooms/macka-room.ts';
import {issueGuestTicket,verifyGuestTicket,GUEST_TICKET_TTL_SECONDS} from '../apps/game-backend/src/auth/guest-ticket.ts';
import {MackaSimulation,normalizeInput,type BattleSnapshot} from '../apps/game-backend/src/rooms/macka-simulation.ts';
import {readFileSync} from 'node:fs';
const geo=JSON.parse(readFileSync(new URL('../maps/istanbul-macka.json',import.meta.url),'utf8')) as {buildings:{p:number[][]}[]};

test('A3 two ticketed human sessions join one authoritative Colyseus Maçka room',{timeout:20000},async()=>{
  const testServer=await boot(onlineServer);
  try{
    const room=await testServer.createRoom('macka_frontline');
    const blue=await testServer.connectTo(room,{
      guestTicket:issueGuestTicket().ticket
    });
    const red=await testServer.connectTo(room,{
      guestTicket:issueGuestTicket().ticket
    });
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
test('A3 rejects unauthenticated matchmaking on the real SDK network and remains healthy',
  {timeout:20000},async()=>{
  const testServer=await boot(onlineServer);
  try{
    const room=await testServer.createRoom('macka_frontline');
    await assert.rejects(testServer.connectTo(room,{}),
      /auth|reject|invalid|match|525|401|forbidden/i);
    await assert.rejects(testServer.connectTo(room,{guestTicket:'forged-ticket'}),
      /auth|reject|invalid|match|525|401|forbidden/i);
    // Denied joins must not crash the matchmaker or occupy a room slot.
    const accepted=await testServer.connectTo(room,{guestTicket:issueGuestTicket().ticket});
    assert.equal(room.game.snapshot().players.length,1);
    assert.equal(room.game.snapshot().playerCounts.blue,1);
    await accepted.leave();
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


test('A2 30-player game simulation capacity and 15v15 teams',()=>{
  const sim=new MackaSimulation(geo);
  const players=Array.from({length:30},(_,i)=>sim.addPlayer('capacity-'+String(i).padStart(2,'0')));
  assert.equal(players.length,30);
  assert.equal(sim.snapshot().playerCounts.blue,15);
  assert.equal(sim.snapshot().playerCounts.red,15);
  assert.equal(sim.snapshot().bots,0);
  assert.throws(()=>sim.addPlayer('capacity-31'),/room_full/);
  for(let i=0;i<players.length;i++) {
    assert.equal(sim.submitInput(players[i].id,{
      seq:1,mx:i%2?1:0,mz:i%2?0:1,
      yaw:i%2?180:0,pitch:0,fire:false
    }),true);
  }
  for(let i=0;i<6;i++)sim.step(0.05);
  assert.ok(Array.from(sim.players.values()).every(p=>p.lastSeq===1));
  assert.equal(sim.snapshot().players.length,30);
});

test('A3 guest tickets reject missing, tampered and expired payloads',()=>{
  const issued=issueGuestTicket(1_800_000_000_000);
  const claims=verifyGuestTicket(issued.ticket,1_800_000_000_500);
  assert.ok(claims);
  assert.equal(claims.v,1);
  assert.equal(claims.aud,'pbn-macka-development');
  assert.equal(claims.exp-claims.iat,GUEST_TICKET_TTL_SECONDS);
  assert.equal(verifyGuestTicket(issued.ticket,1_800_000_000_000+
     (GUEST_TICKET_TTL_SECONDS+1)*1000),null);
  assert.equal(verifyGuestTicket('',1_800_000_000_000),null);
  const altered='x'+issued.ticket.slice(1); // mutate signed payload, not unused signature padding bits
  assert.equal(verifyGuestTicket(altered,1_800_000_000_000),null);
  assert.equal(verifyGuestTicket('not-a-ticket',1_800_000_000_000),null);
});

test('A3 room entry hook denies missing and forged guest passes',async()=>{
  // Colyseus 0.18.10 test harness has an ERR_HTTP_HEADERS_SENT failure on rejected
  // matchmaking requests. Exercise the real room guard directly until resolved.
  // This is NOT a successful negative-network-integration test.
  const room=new MackaFrontlineRoom();
  const none=await room.onAuth(null as never,{});
  assert.equal(none,false);
  const bad=await room.onAuth(null as never,{guestTicket:'forged-ticket'});
  assert.equal(bad,false);
  const valid=await room.onAuth(null as never,{guestTicket:issueGuestTicket().ticket});
  assert.ok(valid);
  assert.equal(valid.aud,'pbn-macka-development');
});


test('C2 explicit team selection cannot overfill a 15-person faction',()=>{
  const sim=new MackaSimulation(geo);
  for(let i=0;i<15;i++)assert.equal(sim.addPlayer('tr-'+i,'blue').team,'blue');
  assert.throws(()=>sim.addPlayer('tr-16','blue'),/team_full/);
  assert.equal(sim.addPlayer('de-01','red').team,'red');
  assert.equal(sim.snapshot().playerCounts.blue,15);
  assert.equal(sim.snapshot().playerCounts.red,1);
});
