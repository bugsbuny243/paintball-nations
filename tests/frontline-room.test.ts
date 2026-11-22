/** C4: two real Colyseus pilot sockets drive the same persistent world.
 * Test-only server score adjustment below simulates a verified paintball hit;
 * there is deliberately no client message for changing scores or owners.
 */
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setTimeout as sleep} from 'node:timers/promises';
import {boot} from '@colyseus/testing';
import {onlineServer} from '../apps/game-backend/src/online-server.ts';
import {developmentPilotStore,closeDevelopmentPilotStore} from
  '../apps/game-backend/src/auth/dev-pilot-db.ts';
import {issuePilotMatchTicket} from '../apps/game-backend/src/auth/pilot-match-ticket.ts';
import {migrate} from '../apps/game-backend/src/migrate.ts';
import {WorldStore} from '../apps/game-backend/src/world-store.ts';
import type {FrontlineWorldState} from '../apps/game-backend/src/rooms/frontline-lifecycle.ts';

const url=process.env.DATABASE_URL;
if(!url||new URL(url).pathname!=='/paintball_ci')
  throw new Error('C4 tests require an isolated paintball_ci PostgreSQL');
process.env.DEV_ENABLE_FRONTLINES='1';
process.env.DEV_REQUIRE_PILOT='1';
process.env.DEV_FRONTLINE_DURATION_MS='2000';

async function eventually<T>(fn:()=>Promise<T>,predicate:(value:T)=>boolean,what:string):Promise<T>{
  for(let i=0;i<65;i++){
    const result=await fn();
    if(predicate(result))return result;
    await sleep(100);
  }
  throw new Error('Timed out waiting for '+what);
}
test('C4 real pilot match automatically captures/defends Maçka and broadcasts world states',
  {timeout:45000},async()=>{
  const db=developmentPilotStore();
  assert.ok(db);
  const pool=db.pool;
  await migrate(pool);
  await pool.query('DELETE FROM sector_ownership_history');
  await pool.query('DELETE FROM frontline_battles');
  await pool.query('DELETE FROM world_events');
  await pool.query('DELETE FROM world_operations');
  await pool.query('DELETE FROM resource_ledger');
  await pool.query('DELETE FROM base_structures');
  await pool.query('UPDATE world_meta SET version=0 WHERE id=TRUE');
  await pool.query("UPDATE sectors SET state='OWNED',owner_faction_id='TR',version=0,last_production_at=NOW()");
  const world=new WorldStore(pool);
  const tr=await db.register('TR'),de=await db.register('DE');
  const trIdentity=await db.matchIdentity(tr.sessionToken);
  const deIdentity=await db.matchIdentity(de.sessionToken);
  assert.ok(trIdentity);assert.ok(deIdentity);
  const trPass=issuePilotMatchTicket(trIdentity).ticket;
  const dePass=issuePilotMatchTicket(deIdentity).ticket;
  const server=await boot(onlineServer);
  let firstClients: {leave:()=>Promise<unknown>}[]=[];
  let secondClients: {leave:()=>Promise<unknown>}[]=[];
  try{
    const room=await server.createRoom('macka_frontline');
    const blue=await server.connectTo(room,{pilotPass:trPass});
    const red=await server.connectTo(room,{pilotPass:dePass});
    firstClients=[blue,red];
    const updates:FrontlineWorldState[]=[];
    red.onMessage('world_state',(state:FrontlineWorldState)=>updates.push(state));

    const contested=await eventually(
      ()=>world.snapshot(),
      s=>s.sectors[0]?.state==='CONTESTED',
      'opened C4 battle');
    assert.equal(contested.sectors[0].ownerFactionId,'TR');
    assert.equal(contested.worldVersion,1);

    // Client can submit only control input. Forged authority fields are ignored.
    red.send('input',{seq:1,mx:0,mz:0,yaw:180,pitch:0,fire:false,
      winnerFactionId:'TR',attackerScore:999999,ownerFactionId:'DE',score:999999});
    blue.send('input',{seq:1,mx:0,mz:0,yaw:0,pitch:0,fire:false,
      worldVersion:999999,ownerFactionId:'DE',score:999999});
    await sleep(150);
    assert.equal((await world.snapshot()).sectors[0].state,'CONTESTED');
    assert.equal(room.game.scores.red,0);
    // Simulate a legitimate server-calculated paintball hit, not a browser action.
    room.game.scores.red=100;
    await eventually(()=>world.snapshot(),
      s=>s.sectors[0]?.state==='OWNED'&&s.sectors[0]?.ownerFactionId==='DE',
      'DE capture after room timer');
    assert.equal((await world.snapshot()).worldVersion,2);
    // The round is over: late input must not restart movement or alter the result.
    red.send('input',{seq:2,mx:0,mz:0,yaw:180,pitch:0,fire:true});
    await sleep(100);
    assert.equal(room.game.players.get(red.sessionId)?.lastSeq,1);
    assert.equal(room.game.scores.red,100);
    const transferred=await pool.query(
      'SELECT previous_faction_id,new_faction_id FROM sector_ownership_history');
    assert.equal(transferred.rowCount,1);
    assert.equal(transferred.rows[0].previous_faction_id,'TR');
    assert.equal(transferred.rows[0].new_faction_id,'DE');
    await eventually(async()=>updates,
      s=>s.some(v=>v.outcome==='CAPTURED'&&v.ownerFactionId==='DE'),
      'browser-visible captured territory update');
    assert.ok(updates.some(v=>v.worldVersion===2&&v.state==='OWNED'));
    assert.equal((await pool.query(
      "SELECT count(*)::integer AS n FROM frontline_battles WHERE status='SETTLED'"
    )).rows[0].n,1);
    await blue.leave();await red.leave();
    firstClients=[];

    // A fresh room contests the now DE-owned sector. A tie does not transfer it.
    const next=await server.createRoom('macka_frontline');
    const blue2=await server.connectTo(next,{pilotPass:trPass});
    const red2=await server.connectTo(next,{pilotPass:dePass});
    secondClients=[blue2,red2];
    await eventually(()=>world.snapshot(),s=>s.worldVersion===3&&s.sectors[0].state==='CONTESTED',
      'second frontline');
    await eventually(()=>world.snapshot(),s=>s.worldVersion===4&&s.sectors[0].state==='OWNED',
      'draw cancellation');
    assert.equal((await world.snapshot()).sectors[0].ownerFactionId,'DE');
    assert.equal((await pool.query('SELECT * FROM sector_ownership_history')).rowCount,1);
    assert.equal((await pool.query(
      "SELECT count(*)::integer AS n FROM frontline_battles WHERE status='CANCELLED'"
    )).rows[0].n,1);
    await blue2.leave();await red2.leave();
    secondClients=[];
  }finally{
    await Promise.allSettled([...firstClients,...secondClients].map(c=>c.leave()));
    await server.shutdown();
    await closeDevelopmentPilotStore();
  }
});
