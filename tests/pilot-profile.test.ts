import assert from 'node:assert/strict';
import {once} from 'node:events';
import {test} from 'node:test';
import pg from 'pg';
import {migrate} from '../apps/game-backend/src/migrate.ts';
import {createWorldServer} from '../apps/game-backend/src/server.ts';
import {PilotStore,hashSessionToken,type NewPilot} from '../apps/game-backend/src/pilot-store.ts';

const dbUrl=process.env.DATABASE_URL;
if(!dbUrl||new URL(dbUrl).pathname!=='/paintball_ci')
  throw new Error('C1 tests require isolated paintball_ci PostgreSQL database');

test('C1 pilot profile end-to-end: persistent, restricted and revocable',{timeout:30000},async t=>{
  const pool=new pg.Pool({connectionString:dbUrl,max:8});
  const store=new PilotStore(pool);
  const operatorToken='testing-operator-credential-32characters-long';
  let server=createWorldServer(pool,operatorToken);
  try {
    await migrate(pool);
    await migrate(pool); // Existing world migration and new pilot migration must be re-runnable.
    await pool.query('DELETE FROM pilot_sessions');
    await pool.query('DELETE FROM pilots');

    const start=async()=>{
      server.listen(0,'127.0.0.1');
      await once(server,'listening');
      const address=server.address();
      if(!address||typeof address==='string')throw new Error('missing test address');
      return 'http://127.0.0.1:'+address.port;
    };
    const shutdown=async()=>new Promise<void>((resolve,reject)=>
      server.close(err=>err?reject(err):resolve()));
    let base=await start();
    const json=async(path:string,method='GET',body?:unknown,token?:string)=>{
      const response=await fetch(base+path,{
        method,
        headers:{
          ...(body===undefined?{}:{'content-type':'application/json'}),
          ...(token?{authorization:'Bearer '+token}:{})
        },
        ...(body===undefined?{}:{body:JSON.stringify(body)})
      });
      return {status:response.status,data:await response.json() as Record<string,any>};
    };

    let tr:NewPilot,de:NewPilot;

    await t.test('local development enrollment assigns random pilot ID and game faction',async()=>{
      const a=await json('/api/v1/pilots/dev-register','POST',{factionId:'TR'});
      const b=await json('/api/v1/pilots/dev-register','POST',{factionId:'DE'});
      assert.equal(a.status,201);assert.equal(b.status,201);
      tr=a.data as unknown as NewPilot;de=b.data as unknown as NewPilot;
      assert.match(tr.profile.id,/^[0-9a-f-]{36}$/);
      assert.match(tr.profile.displayName,/^Pilot-[a-f0-9]{14}$/);
      assert.equal(tr.profile.factionId,'TR');
      assert.equal(de.profile.factionId,'DE');
      assert.notEqual(tr.profile.id,de.profile.id);
      assert.notEqual(tr.sessionToken,de.sessionToken);
      assert.equal(tr.sessionToken.length,43);
      assert.ok(Date.parse(tr.expiresAt)>Date.now());
      const stored=await pool.query<{token_hash:string}>(
        'SELECT token_hash FROM pilot_sessions WHERE pilot_id=$1',[tr.profile.id]);
      assert.equal(stored.rowCount,1);
      assert.equal(stored.rows[0].token_hash.trim(),hashSessionToken(tr.sessionToken));
      assert.ok(!stored.rows[0].token_hash.includes(tr.sessionToken));
      const invalid=await json('/api/v1/pilots/dev-register','POST',{factionId:'UNKNOWN'});
      assert.equal(invalid.status,400);
    });

    await t.test('pilot profile and faction economy are scoped to authenticated identity',async()=>{
      const self=await json('/api/v1/pilots/me','GET',undefined,tr.sessionToken);
      assert.equal(self.status,200);assert.equal(self.data.profile.id,tr.profile.id);
      const ownEconomy=await json('/api/v1/pilots/me/economy','GET',undefined,tr.sessionToken);
      assert.equal(ownEconomy.status,200);
      assert.equal(ownEconomy.data.profile.factionId,'TR');
      assert.equal(ownEconomy.data.balances.length,2);
      const otherEconomy=await json('/api/v1/pilots/me/economy','GET',undefined,de.sessionToken);
      assert.equal(otherEconomy.status,200);
      assert.equal(otherEconomy.data.profile.factionId,'DE');
      assert.equal((await json('/api/v1/pilots/me')).status,401);
      assert.equal((await json('/api/v1/pilots/me','GET',undefined,'forged_token')).status,401);
      assert.equal((await json('/api/v1/factions/TR/balances','GET',undefined,tr.sessionToken)).status,401);
      assert.equal((await json('/api/v1/operator/structures/upgrade','POST',
        {operationId:'test-guest-upgrade-attempt',sectorId:'TR-MACKA',factionId:'TR',
          kind:'depot'},tr.sessionToken)).status,401);
      assert.equal((await json('/api/v1/pilots/me','POST',{factionId:'DE'},tr.sessionToken)).status,404);
    });

    await t.test('profile survives server restart without re-registering',async()=>{
      await shutdown();
      server=createWorldServer(pool,operatorToken);
      base=await start();
      const again=await json('/api/v1/pilots/me','GET',undefined,tr.sessionToken);
      assert.equal(again.status,200);
      assert.equal(again.data.profile.id,tr.profile.id);
      assert.equal(again.data.profile.factionId,'TR');
    });

    await t.test('logout revokes bearer token and cannot be undone by reuse',async()=>{
      const logout=await json('/api/v1/pilots/logout','POST',undefined,tr.sessionToken);
      assert.equal(logout.status,200);
      assert.equal(logout.data.revoked,true);
      assert.equal(await store.authenticate(tr.sessionToken),null);
      assert.equal((await json('/api/v1/pilots/me','GET',undefined,tr.sessionToken)).status,401);
      assert.equal((await json('/api/v1/pilots/logout','POST',undefined,tr.sessionToken)).status,401);
    });

    await t.test('expired credentials cannot access existing pilot',async()=>{
      await pool.query(
        "UPDATE pilot_sessions SET created_at=NOW()-interval '30 days',"+
        " expires_at=NOW()-interval '1 day' WHERE pilot_id=$1",
        [de.profile.id]);
      assert.equal(await store.authenticate(de.sessionToken),null);
      assert.equal((await json('/api/v1/pilots/me','GET',undefined,de.sessionToken)).status,401);
      const exists=await pool.query('SELECT id FROM pilots WHERE id=$1',[de.profile.id]);
      assert.equal(exists.rowCount,1);
    });

    await shutdown();
  } finally {
    if(server.listening)await new Promise<void>(resolve=>server.close(()=>resolve()));
    await pool.end();
  }
});
