/** Isolated process: one Colyseus server boot, real PostgreSQL profiles and tickets. */
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {boot} from '@colyseus/testing';
import {onlineServer} from '../apps/game-backend/src/online-server.ts';
import {developmentPilotStore,closeDevelopmentPilotStore} from '../apps/game-backend/src/auth/dev-pilot-db.ts';
import {issuePilotMatchTicket,verifyPilotMatchTicket,MATCH_TICKET_TTL_SECONDS} from '../apps/game-backend/src/auth/pilot-match-ticket.ts';
import {migrate} from '../apps/game-backend/src/migrate.ts';
import type {BattleSnapshot} from '../apps/game-backend/src/rooms/macka-simulation.ts';

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
    await assert.rejects(server.connectTo(room,{pilotPass:blueTicket.ticket}),
      /auth|reject|invalid|525|401|forbidden/i,
      'revoked PostgreSQL session must be denied by the actual network');
    // The other pilot remains in the live room after the rejected connection.
    assert.equal(room.game.snapshot().players.filter(p=>p.team==='red').length,1);
    await red.leave();
  }finally{
    await server.shutdown();
    await closeDevelopmentPilotStore();
  }
});
