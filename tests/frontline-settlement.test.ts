/** C3 frontline results: *internal* authoritative world settlement, not client API.
 * Tests are run against the isolated paintball_ci PostgreSQL database.
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
  throw new Error('C3 tests require isolated paintball_ci PostgreSQL');
const pool=new pg.Pool({connectionString:url,max:8});
const front=new FrontlineStore(pool),world=new WorldStore(pool);
const fail=(code:string)=>(e:unknown)=>e instanceof WorldError&&e.code===code;

test('C3 server-side frontline result controls persistent sector ownership',{timeout:50000},async t=>{
  try{
    await migrate(pool);
    await migrate(pool);
    await pool.query('DELETE FROM sector_ownership_history');
    await pool.query('DELETE FROM frontline_battles');
    await pool.query('DELETE FROM world_events');
    await pool.query('DELETE FROM world_operations');
    await pool.query('DELETE FROM resource_ledger');
    await pool.query('DELETE FROM base_structures');
    await pool.query('UPDATE world_meta SET version=0 WHERE id=TRUE');
    await pool.query("UPDATE sectors SET owner_faction_id='TR',state='OWNED',"+
      "version=0,last_production_at=clock_timestamp()");
    await pool.query('UPDATE resource_balances SET quantity=100');

    const firstId=randomUUID(),first={
      battleId:firstId,sectorId:'TR-MACKA',sourceRoomId:'room-frontline-001',
      attackerFactionId:'DE' as const
    };
    await t.test('opening battle contests exactly one sector; replay is stable',async()=>{
      const opened=await front.begin(first);
      assert.equal(opened.defenderFactionId,'TR');
      assert.equal(opened.status,'OPEN');
      assert.equal(opened.worldVersion,1);
      const snap=await world.snapshot();
      assert.equal(snap.worldVersion,1);
      assert.equal(snap.sectors.find(s=>s.id==='TR-MACKA')?.state,'CONTESTED');
      assert.deepEqual(await front.begin(first),opened);
      await assert.rejects(
        front.begin({...first,battleId:randomUUID()}),fail('sector_already_contested'));
      await assert.rejects(
        front.begin({...first,sourceRoomId:'wrong-room-001'}),
        fail('battle_id_already_used'));
      await assert.rejects(world.upgradeStructure({
        operationId:'contested-upgrade-001',factionId:'TR',
        sectorId:'TR-MACKA',kind:'depot'
      }),fail('sector_contested_upgrades_locked'));
    });

    const report={
      battleId:firstId,sourceRoomId:'room-frontline-001',
      winnerFactionId:'DE' as const,attackerScore:400,defenderScore:200
    };
    await t.test('unauthorized room or impossible result leaves sector untouched',async()=>{
      await assert.rejects(front.settle({...report,sourceRoomId:'wrong-room'}),
        fail('wrong_battle_room'));
      await assert.rejects(front.settle({...report,winnerFactionId:'TR'}),
        fail('winner_score_mismatch'));
      await assert.rejects(front.settle({...report,attackerScore:0,defenderScore:0}),
        fail('invalid_battle_scores'));
      const snap=await world.snapshot();
      assert.equal(snap.worldVersion,1);
      assert.equal(snap.sectors[0].ownerFactionId,'TR');
    });

    await t.test('two simultaneous copies settle once and durably capture the sector',async()=>{
      const [a,b]=await Promise.all([front.settle(report),front.settle(report)]);
      assert.deepEqual(a,b);
      assert.equal(a.status,'SETTLED');
      assert.equal(a.worldVersion,2);
      assert.equal(a.captured,true);
      assert.equal(a.previousOwner,'TR');
      assert.equal(a.newOwner,'DE');
      const snap=await world.snapshot();
      assert.equal(snap.worldVersion,2);
      assert.equal(snap.sectors[0].state,'OWNED');
      assert.equal(snap.sectors[0].ownerFactionId,'DE');
      const history=await pool.query(
        'SELECT previous_faction_id,new_faction_id,world_version FROM sector_ownership_history');
      assert.equal(history.rowCount,1);
      assert.equal(history.rows[0].previous_faction_id,'TR');
      assert.equal(history.rows[0].new_faction_id,'DE');
      const events=await pool.query('SELECT version,event_type FROM world_events ORDER BY version');
      assert.deepEqual(events.rows.map(x=>x.event_type),
        ['frontline.opened','frontline.settled']);
    });

    await t.test('changed replay is rejected and cannot re-award capture',async()=>{
      await assert.rejects(front.settle({...report,attackerScore:401}),
        fail('battle_result_conflict'));
      await assert.rejects(front.cancel(firstId,'room-frontline-001'),
        fail('battle_not_open'));
      const snap=await world.snapshot();
      assert.equal(snap.worldVersion,2);
      assert.equal((await pool.query('SELECT * FROM sector_ownership_history')).rowCount,1);
    });

    await t.test('captured sector produces for its new owner, not old owner',async()=>{
      await pool.query("UPDATE sectors SET last_production_at=clock_timestamp()-interval '2 minutes 5 seconds' WHERE id='TR-MACKA'");
      const outcome=await world.produce('TR-MACKA');
      assert.equal(outcome.elapsedMinutes,2);
      assert.equal(outcome.pigmentAdded,4);
      assert.equal(outcome.materialAdded,2);
      assert.equal((await world.balances('DE')).find(x=>x.resource==='pigment')?.quantity,104);
      assert.equal((await world.balances('TR')).find(x=>x.resource==='pigment')?.quantity,100);
    });

    const second={
      battleId:randomUUID(),sectorId:'TR-MACKA',
      sourceRoomId:'room-frontline-002',attackerFactionId:'TR' as const
    };
    await t.test('defender victory closes contest without ownership transfer',async()=>{
      const opened=await front.begin(second);
      assert.equal(opened.defenderFactionId,'DE');
      const result=await front.settle({
        battleId:second.battleId,sourceRoomId:second.sourceRoomId,
        winnerFactionId:'DE',attackerScore:50,defenderScore:90
      });
      assert.equal(result.captured,false);
      assert.equal(result.previousOwner,'DE');
      assert.equal(result.newOwner,'DE');
      assert.equal((await world.snapshot()).sectors[0].ownerFactionId,'DE');
      assert.equal((await pool.query('SELECT * FROM sector_ownership_history')).rowCount,1);
    });

    await t.test('cancelled battle restores OWNED and allows a new attempt',async()=>{
      const abandoned={
        battleId:randomUUID(),sectorId:'TR-MACKA',
        sourceRoomId:'room-frontline-abort',attackerFactionId:'TR' as const
      };
      const start=await front.begin(abandoned);
      assert.equal(start.status,'OPEN');
      await assert.rejects(front.cancel(abandoned.battleId,'other-room'),
        fail('wrong_battle_room'));
      const v=await front.cancel(abandoned.battleId,abandoned.sourceRoomId);
      assert.equal((await world.snapshot()).worldVersion,v);
      assert.equal((await world.snapshot()).sectors[0].state,'OWNED');
      await assert.rejects(front.settle({
        battleId:abandoned.battleId,sourceRoomId:abandoned.sourceRoomId,
        winnerFactionId:'TR',attackerScore:20,defenderScore:10
      }),fail('battle_not_open'));
      const newAttempt=await front.begin({
        ...abandoned,battleId:randomUUID(),sourceRoomId:'room-after-abort'
      });
      assert.equal(newAttempt.status,'OPEN');
      await front.cancel(newAttempt.battleId,newAttempt.sourceRoomId);
    });

    await t.test('durability: new store instance sees same world and history',async()=>{
      const fresh=new WorldStore(pool);
      assert.equal((await fresh.snapshot()).sectors[0].ownerFactionId,'DE');
      const ledger=await pool.query(
        "SELECT event_type FROM world_events WHERE event_type='frontline.settled'");
      assert.equal(ledger.rowCount,2);
    });
  }finally{
    await pool.end();
  }
});
