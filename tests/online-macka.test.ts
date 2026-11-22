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
import {developmentPilotStore,closeDevelopmentPilotStore} from '../apps/game-backend/src/auth/dev-pilot-db.ts';
import {issuePilotMatchTicket,verifyPilotMatchTicket,MATCH_TICKET_TTL_SECONDS} from '../apps/game-backend/src/auth/pilot-match-ticket.ts';
import {migrate} from '../apps/game-backend/src/migrate.ts';
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


test('C2 two PostgreSQL-backed pilots join with faction-derived teams and expiring passes',
  {timeout:30000},async()=>{
  const store=developmentPilotStore();
  assert.ok(store,'C2 CI requires DATABASE_URL pointing to the isolated test database');
  assert.equal(new URL(process.env.DATABASE_URL!).pathname,'/paintball_ci');
  await migrate(store.pool);
  const tr=await store.register('TR');
  const de=await store.register('DE');
  const trIdentity=await store.matchIdentity(tr.sessionToken);
  const deIdentity=await store.matchIdentity(de.sessionToken);
  assert.ok(trIdentity);assert.ok(deIdentity);
  const blueTicket=issuePilotMatchTicket(trIdentity);
  const redTicket=issuePilotMatchTicket(deIdentity);
  assert.equal(await store.isMatchSessionActive({
    pilotId:trIdentity.pilotId,sessionId:trIdentity.sessionId,factionId:trIdentity.factionId
  }),true,'TR session should be active in PostgreSQL');
  assert.equal(await store.isMatchSessionActive({
    pilotId:deIdentity.pilotId,sessionId:deIdentity.sessionId,factionId:deIdentity.factionId
  }),true,'DE session should be active in PostgreSQL');
  assert.equal(verifyPilotMatchTicket(blueTicket.ticket)?.factionId,'TR');
  assert.equal(verifyPilotMatchTicket(redTicket.ticket)?.factionId,'DE');
  assert.equal(verifyPilotMatchTicket(blueTicket.ticket,
    Date.now()+(MATCH_TICKET_TTL_SECONDS+1)*1000),null);
  const forged=blueTicket.ticket.slice(0,-2)+'XX';
  assert.equal(verifyPilotMatchTicket(forged),null);
  const server=await boot(onlineServer);
  try{
    const room=await server.createRoom('macka_frontline');
    const preflightTR=await room.onAuth(null as never,{pilotPass:blueTicket.ticket});
    const preflightDE=await room.onAuth(null as never,{pilotPass:redTicket.ticket});
    assert.ok(preflightTR,'C2 TR match ticket failed room validation');
    assert.ok(preflightDE,'C2 DE match ticket failed room validation');
    assert.equal(preflightTR.factionId,'TR');
    assert.equal(preflightDE.factionId,'DE');
    console.log('C2 TRACE: signed pilots validated by PostgreSQL room hook');
    const blue=await server.connectTo(room,{pilotPass:blueTicket.ticket});
    const red=await server.connectTo(room,{pilotPass:redTicket.ticket});
    assert.equal(blue.roomId,red.roomId);
    const snap=room.game.snapshot() as BattleSnapshot;
    assert.equal(snap.playerCounts.blue,1);
    assert.equal(snap.playerCounts.red,1);
    assert.equal(snap.bots,0);
    assert.equal(room.game.players.get(blue.sessionId)!.team,'blue');
    assert.equal(room.game.players.get(red.sessionId)!.team,'red');
    assert.equal(room.guestIds.get(blue.sessionId),tr.profile.id);
    assert.equal(room.guestIds.get(red.sessionId),de.profile.id);
    assert.equal((await room.onAuth(null as never,{pilotPass:blueTicket.ticket}))?.sub,tr.profile.id);
    assert.equal(await room.onAuth(null as never,{pilotPass:redTicket.ticket+'x'}),false);
    assert.equal(await store.logout(tr.sessionToken),true);
    // A revoked database session must be rejected for new admission.
    assert.equal(await room.onAuth(null as never,{pilotPass:blueTicket.ticket}),false);
    assert.notEqual(await room.onAuth(null as never,{pilotPass:redTicket.ticket}),false);
    await blue.leave();
    await red.leave();
  }finally{
    await server.shutdown();
    await closeDevelopmentPilotStore();
  }
});

test('C2 explicit team selection cannot overfill a 15-person faction',()=>{
  const sim=new MackaSimulation(geo);
  for(let i=0;i<15;i++)assert.equal(sim.addPlayer('tr-'+i,'blue').team,'blue');
  assert.throws(()=>sim.addPlayer('tr-16','blue'),/team_full/);
  assert.equal(sim.addPlayer('de-01','red').team,'red');
  assert.equal(sim.snapshot().playerCounts.blue,15);
  assert.equal(sim.snapshot().playerCounts.red,1);
});
