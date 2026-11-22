/** C5.1: durable lease expiry and concurrent orphan recovery.
 * Run only against isolated paintball_ci PostgreSQL.
 */
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {test} from 'node:test';
import pg from 'pg';
import {migrate} from '../apps/game-backend/src/migrate.ts';
import {FrontlineStore} from '../apps/game-backend/src/frontline-store.ts';
import {WorldStore} from '../apps/game-backend/src/world-store.ts';
import {WorldError} from '../packages/protocol/src/index.ts';

const url=process.env.DATABASE_URL;
if(!url||new URL(url).pathname!=='/paintball_ci')
  throw new Error('C5 tests require isolated paintball_ci PostgreSQL');
const pool=new pg.Pool({connectionString:url,max:10});
const fail=(code:string)=>(e:unknown)=>e instanceof WorldError&&e.code===code;

test('C5 stale match recovery never transfers ownership or double-cancels',
  {timeout:45000},async()=>{
    try{
      await migrate(pool);
      await migrate(pool); // additive migration is idempotent
      await pool.query('DELETE FROM sector_ownership_history');
      await pool.query('DELETE FROM frontline_battles');
      await pool.query('DELETE FROM world_events');
      await pool.query('DELETE FROM world_operations');
      await pool.query('DELETE FROM resource_ledger');
      await pool.query('DELETE FROM base_structures');
      await pool.query('UPDATE world_meta SET version=0 WHERE id=TRUE');
      await pool.query("UPDATE sectors SET state='OWNED',owner_faction_id='TR',version=0,last_production_at=NOW()");

      const front=new FrontlineStore(pool),secondWorker=new FrontlineStore(pool);
      const world=new WorldStore(pool);
      const battleId=randomUUID(),room='c5-recovery-room-01';
      const start=await front.begin({
        battleId,sourceRoomId:room,sectorId:'TR-MACKA',attackerFactionId:'DE'
      });
      assert.equal(start.status,'OPEN');
      assert.equal((await world.snapshot()).sectors[0].state,'CONTESTED');
      assert.deepEqual(await front.recoverExpired(),[],'fresh live contest must never be recovered');
      assert.equal(await front.renewLease(battleId,'wrong-room'),false);
      assert.equal(await front.renewLease(battleId,room),true);
      await migrate(pool);
      assert.deepEqual(await secondWorker.recoverExpired(),[],'re-running migration must not expire lease');

      // Simulate a process death by aging its database lease, not by waiting 30s.
      await pool.query(
        "UPDATE frontline_battles SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE battle_id=$1",
        [battleId]
      );
      assert.equal(await front.renewLease(battleId,room),false,'stale rooms cannot resurrect a lease');
      await assert.rejects(front.settle({
        battleId,sourceRoomId:room,winnerFactionId:'DE',attackerScore:100,defenderScore:0
      }),fail('battle_lease_expired'));

      // Two independent recovery workers compete; the row may be cancelled only once.
      const results=await Promise.all([front.recoverExpired(),secondWorker.recoverExpired()]);
      assert.equal(results[0].length+results[1].length,1);
      const one=(results[0][0]??results[1][0]);
      assert.equal(one.battleId,battleId);
      assert.equal(one.worldVersion,2);
      assert.deepEqual(await front.recoverExpired(),[],'recovery replay is idempotent');

      const restored=await world.snapshot();
      assert.equal(restored.worldVersion,2);
      assert.equal(restored.sectors[0].state,'OWNED');
      assert.equal(restored.sectors[0].ownerFactionId,'TR','stale battle never captures');
      assert.equal((await pool.query('SELECT * FROM sector_ownership_history')).rowCount,0);
      const journal=await pool.query<{event_type:string;payload:{reason?:string}}>(
        'SELECT event_type,payload FROM world_events ORDER BY version'
      );
      assert.deepEqual(journal.rows.map(row=>row.event_type),
        ['frontline.opened','frontline.cancelled']);
      assert.equal(journal.rows[1].payload.reason,'lease_expired');
      await assert.rejects(front.settle({
        battleId,sourceRoomId:room,winnerFactionId:'DE',attackerScore:100,defenderScore:0
      }),fail('battle_not_open'));

      // A new room is allowed to start only after the orphan is released.
      const nextId=randomUUID(),nextRoom='c5-recovery-room-02';
      await front.begin({battleId:nextId,sourceRoomId:nextRoom,
        sectorId:'TR-MACKA',attackerFactionId:'DE'});
      assert.equal(await front.renewLease(nextId,nextRoom),true);
      const settled=await front.settle({
        battleId:nextId,sourceRoomId:nextRoom,winnerFactionId:'DE',
        attackerScore:200,defenderScore:100
      });
      assert.equal(settled.captured,true);
      assert.equal(settled.worldVersion,4);
      assert.equal((await world.snapshot()).sectors[0].ownerFactionId,'DE');
      assert.equal((await pool.query('SELECT * FROM sector_ownership_history')).rowCount,1);
      assert.deepEqual(await front.recoverExpired(),[]);
    }finally{
      await pool.end();
    }
});
