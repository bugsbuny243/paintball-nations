import assert from 'node:assert/strict';
import {once} from 'node:events';
import {test} from 'node:test';
import pg from 'pg';
import {WorldStore} from '../apps/game-backend/src/world-store.ts';
import {createWorldServer} from '../apps/game-backend/src/server.ts';
import {migrate} from '../apps/game-backend/src/migrate.ts';
import {WorldError,PROTOCOL_VERSION} from '../packages/protocol/src/index.ts';

const dbUrl=process.env.DATABASE_URL;
if(!dbUrl||new URL(dbUrl).pathname!=='/paintball_ci') {
  throw new Error('Tests need an isolated DATABASE_URL with database name paintball_ci.');
}
const pool=new pg.Pool({connectionString:dbUrl,max:8});
const store=new WorldStore(pool);

test('A1 persistent world: durable transactions, idempotency and HTTP gateway',async t=>{
  try {
    await migrate(pool);
    await migrate(pool); // Initial seed is re-runnable.
    await pool.query('DELETE FROM world_events');
    await pool.query('DELETE FROM world_operations');
    await pool.query('DELETE FROM resource_ledger');
    await pool.query('DELETE FROM base_structures');
    await pool.query('UPDATE world_meta SET version=0 WHERE id=TRUE');
    await pool.query("UPDATE sectors SET owner_faction_id='TR',version=0,state='OWNED',last_production_at=clock_timestamp()");
    await pool.query('UPDATE resource_balances SET quantity=100');

    await t.test('snapshot is seeded and versioned',async()=>{
      assert.equal(await store.health(),true);
      const world=await store.snapshot();
      assert.equal(world.protocolVersion,PROTOCOL_VERSION);
      assert.equal(world.worldVersion,0);
      assert.equal(world.worldId,'paintball-nations');
      assert.equal(world.sectors.find(s=>s.id==='TR-MACKA')?.ownerFactionId,'TR');
    });

    await t.test('three concurrent identical upgrades charge resources once',async()=>{
      const intent={operationId:'a1-upgrade-00001',sectorId:'TR-MACKA',factionId:'TR',kind:'depot'};
      const results=await Promise.all(Array.from({length:3},()=>store.upgradeStructure(intent)));
      assert.deepEqual(results[0],results[1]);
      assert.deepEqual(results[0],results[2]);
      assert.equal(results[0].worldVersion,1);
      assert.equal(results[0].level,1);
      assert.deepEqual(results[0].cost,{pigment:10,material:25});
      const balances=await store.balances('TR');
      assert.equal(balances.find(x=>x.resource==='pigment')?.quantity,90);
      assert.equal(balances.find(x=>x.resource==='material')?.quantity,75);
      const events=await pool.query('SELECT version FROM world_events');
      assert.equal(events.rowCount,1);
      const ledger=await pool.query("SELECT delta FROM resource_ledger WHERE operation_id='a1-upgrade-00001'");
      assert.deepEqual(ledger.rows.map(x=>x.delta).sort((a,b)=>a-b),[-25,-10]);
    });

    await t.test('reusing the same operationId with different payload is rejected',async()=>{
      await assert.rejects(store.upgradeStructure({
        operationId:'a1-upgrade-00001',sectorId:'TR-MACKA',factionId:'TR',kind:'defense_tower'
      }),e=>e instanceof WorldError&&e.code==='operation_id_reused_with_different_payload');
      assert.equal((await store.snapshot()).worldVersion,1);
    });

    await t.test('non-owner upgrade cannot change territory resources',async()=>{
      await assert.rejects(store.upgradeStructure({
        operationId:'a1-wrong-owner',sectorId:'TR-MACKA',factionId:'DE',kind:'depot'
      }),e=>e instanceof WorldError&&e.code==='not_sector_owner');
      assert.equal((await store.balances('DE')).find(x=>x.resource==='material')?.quantity,100);
      assert.equal((await store.snapshot()).worldVersion,1);
    });

    await t.test('insufficient material rolls back pigment and ledger',async()=>{
      await pool.query("UPDATE resource_balances SET quantity=1 WHERE faction_id='TR' AND resource='material'");
      await assert.rejects(store.upgradeStructure({
        operationId:'a1-insufficient-stock',sectorId:'TR-MACKA',factionId:'TR',kind:'paint_factory'
      }),e=>e instanceof WorldError&&e.code==='insufficient_material');
      assert.equal((await store.balances('TR')).find(x=>x.resource==='pigment')?.quantity,90);
      const ledger=await pool.query("SELECT id FROM resource_ledger WHERE operation_id='a1-insufficient-stock'");
      assert.equal(ledger.rowCount,0);
      assert.equal((await store.snapshot()).worldVersion,1);
      await pool.query("UPDATE resource_balances SET quantity=75 WHERE faction_id='TR' AND resource='material'");
    });

    await t.test('offline production catches up 3 min without double counting',async()=>{
      await pool.query("UPDATE sectors SET last_production_at=clock_timestamp()-interval '3 minutes 5 seconds' WHERE id='TR-MACKA'");
      const result=await store.produce('TR-MACKA');
      assert.equal(result.elapsedMinutes,3);
      assert.equal(result.pigmentAdded,6);
      assert.equal(result.materialAdded,3);
      assert.equal(result.worldVersion,2);
      const second=await store.produce('TR-MACKA');
      assert.equal(second.elapsedMinutes,0);
      assert.equal(second.worldVersion,2);
      const balances=await store.balances('TR');
      assert.equal(balances.find(x=>x.resource==='pigment')?.quantity,96);
      assert.equal(balances.find(x=>x.resource==='material')?.quantity,78);
    });

    await t.test('two simultaneous production ticks do not double-grant',async()=>{
      await pool.query("UPDATE sectors SET last_production_at=clock_timestamp()-interval '5 minutes 5 seconds' WHERE id='TR-MACKA'");
      const [a,b]=await Promise.all([store.produce('TR-MACKA'),store.produce('TR-MACKA')]);
      assert.equal(a.elapsedMinutes+b.elapsedMinutes,5);
      assert.equal(a.pigmentAdded+b.pigmentAdded,10);
      assert.equal(a.materialAdded+b.materialAdded,5);
      const balances=await store.balances('TR');
      assert.equal(balances.find(x=>x.resource==='pigment')?.quantity,106);
      assert.equal(balances.find(x=>x.resource==='material')?.quantity,83);
      assert.equal((await store.snapshot()).worldVersion,3);
    });

    await t.test('world HTTP API is read-only publicly and operator writes require secret',async()=>{
      const token='local-test-operator-token-32-bytes-long-00001';
      const server=createWorldServer(pool,token);
      server.listen(0,'127.0.0.1');
      await once(server,'listening');
      const address=server.address();
      if(!address||typeof address==='string')throw new Error('No test server address');
      const base='http://127.0.0.1:'+address.port;
      try {
        const world=await fetch(base+'/api/v1/world');
        assert.equal(world.status,200);
        assert.equal(((await world.json()) as {worldVersion:number}).worldVersion,3);
        const privateBalance=await fetch(base+'/api/v1/factions/TR/balances');
        assert.equal(privateBalance.status,401);
        const intent={operationId:'a1-api-upgrade-00001',sectorId:'TR-MACKA',
                      factionId:'TR',kind:'paint_factory'};
        const reject=await fetch(base+'/api/v1/operator/structures/upgrade',{
          method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(intent)
        });
        assert.equal(reject.status,401);
        const accepted=await fetch(base+'/api/v1/operator/structures/upgrade',{
          method:'POST',headers:{'content-type':'application/json',
            authorization:'Bearer '+token},body:JSON.stringify(intent)
        });
        assert.equal(accepted.status,200);
        assert.equal(((await accepted.json()) as {level:number}).level,1);
        assert.equal(((await (await fetch(base+'/api/v1/world')).json()) as {worldVersion:number}).worldVersion,4);
      } finally {await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
    });
  } finally {await pool.end();}
});
