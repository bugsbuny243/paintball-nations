import {createHash, randomUUID} from 'node:crypto';
import pg, {type PoolClient} from 'pg';
import {
  PROTOCOL_VERSION, type WorldSnapshot, type WorldCommandResult, type ProductionResult,
  WorldError, validateUpgradeIntent, validateIdentifier
} from '../../../packages/protocol/src/index.ts';

type SectorRow = {
  id:string;name:string;ownerFactionId:string;state:'OWNED'|'CONTESTED'|'RESOLVING';
  version:string;lastProductionAt:Date;
};
type BalanceRow = {resource:'pigment'|'material';quantity:number;capacity:number};
type SavedOperation = {input_hash:string;result:WorldCommandResult};

export class WorldStore {
  constructor(readonly pool:pg.Pool) {}

  private async transaction<T>(work:(db:PoolClient)=>Promise<T>):Promise<T> {
    const db=await this.pool.connect();
    let released=false;
    try {
      await db.query('BEGIN');
      const result=await work(db);
      await db.query('COMMIT');
      return result;
    } catch(err) {
      try {await db.query('ROLLBACK');}
      catch(rollbackError) {db.release(rollbackError as Error);released=true;}
      throw err;
    } finally {
      if(!released)db.release();
    }
  }

  async health():Promise<boolean> {
    const res=await this.pool.query<{ok:number}>('SELECT 1 AS ok');
    return res.rows[0]?.ok===1;
  }

  async snapshot():Promise<WorldSnapshot> {
    const db=await this.pool.connect();
    try {
      await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const version=await db.query<{version:string}>('SELECT version FROM world_meta WHERE id=TRUE');
      const sectors=await db.query<SectorRow>(
        'SELECT id,name,owner_faction_id AS "ownerFactionId",state,version,'+
        'last_production_at AS "lastProductionAt" FROM sectors ORDER BY id'
      );
      const factions=await db.query<{id:string;name:string}>('SELECT id,name FROM factions ORDER BY id');
      const structures=await db.query<{
        sectorId:string;kind:'depot'|'paint_factory'|'defense_tower';level:number
      }>('SELECT sector_id AS "sectorId",kind,level FROM base_structures ORDER BY sector_id,kind');
      await db.query('COMMIT');
      return {
        protocolVersion:PROTOCOL_VERSION,worldId:'paintball-nations',
        worldVersion:Number(version.rows[0]?.version ?? 0),
        sectors:sectors.rows.map(s=>({
          id:s.id,name:s.name,ownerFactionId:s.ownerFactionId,state:s.state,
          version:Number(s.version),lastProductionAt:s.lastProductionAt.toISOString()
        })),
        factions:factions.rows,structures:structures.rows
      };
    } catch(error) {
      await db.query('ROLLBACK').catch(()=>{});
      throw error;
    } finally {db.release();}
  }

  async balances(factionId:string):Promise<BalanceRow[]> {
    validateIdentifier(factionId,'faction_id');
    const result=await this.pool.query<BalanceRow>(
      'SELECT resource,quantity,capacity FROM resource_balances WHERE faction_id=$1 ORDER BY resource',
      [factionId]
    );
    if(result.rows.length===0)throw new WorldError('faction_not_found',404);
    return result.rows;
  }

  async upgradeStructure(raw:unknown):Promise<WorldCommandResult> {
    const intent=validateUpgradeIntent(raw);
    const hash=createHash('sha256').update(JSON.stringify(intent)).digest('hex');
    return this.transaction(async db=>{
      // Serialize identical operationIds before checking committed results.
      await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[intent.operationId]);
      const existing=await db.query<SavedOperation>(
        'SELECT input_hash,result FROM world_operations WHERE operation_id=$1',[intent.operationId]
      );
      if(existing.rowCount) {
        if(existing.rows[0].input_hash!==hash)
          throw new WorldError('operation_id_reused_with_different_payload',409);
        return existing.rows[0].result;
      }
      const sector=await db.query<{owner:string;state:string}>(
        'SELECT owner_faction_id AS owner,state FROM sectors WHERE id=$1 FOR UPDATE',[intent.sectorId]
      );
      if(!sector.rowCount)throw new WorldError('sector_not_found',404);
      if(sector.rows[0].owner!==intent.factionId)throw new WorldError('not_sector_owner',403);
      if(sector.rows[0].state!=='OWNED')throw new WorldError('sector_contested_upgrades_locked',409);
      const old=await db.query<{level:number}>(
        'SELECT level FROM base_structures WHERE sector_id=$1 AND kind=$2 FOR UPDATE',
        [intent.sectorId,intent.kind]
      );
      const currentLevel=old.rows[0]?.level ?? 0;
      if(currentLevel>=5)throw new WorldError('structure_max_level',409);
      const nextLevel=currentLevel+1;
      const cost={pigment:10*nextLevel,material:25*nextLevel};
      for(const resource of ['pigment','material'] as const) {
        const paid=await db.query<{quantity:number}>(
          'UPDATE resource_balances SET quantity=quantity-$3 '+
          'WHERE faction_id=$1 AND resource=$2 AND quantity >= $3 RETURNING quantity',
          [intent.factionId,resource,cost[resource]]
        );
        if(!paid.rowCount)throw new WorldError('insufficient_'+resource,409);
        await db.query(
          'INSERT INTO resource_ledger(operation_id,faction_id,resource,delta,balance_after) '+
          'VALUES($1,$2,$3,$4,$5)',
          [intent.operationId,intent.factionId,resource,-cost[resource],paid.rows[0].quantity]
        );
      }
      await db.query(
        'INSERT INTO base_structures(sector_id,kind,level) VALUES($1,$2,$3) '+
        'ON CONFLICT(sector_id,kind) DO UPDATE SET level=EXCLUDED.level',
        [intent.sectorId,intent.kind,nextLevel]
      );
      await db.query('UPDATE sectors SET version=version+1 WHERE id=$1',[intent.sectorId]);
      const version=await db.query<{version:string}>(
        'UPDATE world_meta SET version=version+1 WHERE id=TRUE RETURNING version'
      );
      const result:WorldCommandResult={
        operationId:intent.operationId,worldVersion:Number(version.rows[0].version),
        sectorId:intent.sectorId,kind:intent.kind,level:nextLevel,cost
      };
      await db.query(
        'INSERT INTO world_operations(operation_id,input_hash,result) VALUES($1,$2,$3::jsonb)',
        [intent.operationId,hash,JSON.stringify(result)]
      );
      await db.query(
        'INSERT INTO world_events(version,event_type,payload) VALUES($1,$2,$3::jsonb)',
        [result.worldVersion,'structure.upgraded',JSON.stringify(result)]
      );
      return result;
    });
  }

  async produce(sectorId:string):Promise<ProductionResult> {
    validateIdentifier(sectorId,'sector_id');
    return this.transaction(async db=>{
      const sector=await db.query<{owner:string;minutes:number}>(
        'SELECT owner_faction_id AS owner,GREATEST(0,LEAST(60,'+
        'FLOOR(EXTRACT(EPOCH FROM (clock_timestamp()-last_production_at))/60)))::integer '+
        'AS minutes FROM sectors WHERE id=$1 FOR UPDATE',[sectorId]
      );
      if(!sector.rowCount)throw new WorldError('sector_not_found',404);
      const owner=sector.rows[0].owner;
      const minutes=sector.rows[0].minutes;
      if(minutes<=0) {
        const v=await db.query<{version:string}>('SELECT version FROM world_meta WHERE id=TRUE');
        return {sectorId,elapsedMinutes:0,pigmentAdded:0,materialAdded:0,
          worldVersion:Number(v.rows[0].version)};
      }
      const added:{pigment:number;material:number}={pigment:0,material:0};
      const current=await db.query<BalanceRow>(
        'SELECT resource,quantity,capacity FROM resource_balances WHERE faction_id=$1 FOR UPDATE',
        [owner]
      );
      const opId='production:'+sectorId+':'+randomUUID();
      for(const resource of ['pigment','material'] as const) {
        const account=current.rows.find(r=>r.resource===resource);
        if(!account)throw new WorldError('incomplete_faction_balances',500);
        const newValue=Math.min(account.capacity,account.quantity+minutes*(resource==='pigment'?2:1));
        const delta=newValue-account.quantity;
        added[resource]=delta;
        await db.query('UPDATE resource_balances SET quantity=$3 WHERE faction_id=$1 AND resource=$2',
          [owner,resource,newValue]);
        if(delta>0) await db.query(
          'INSERT INTO resource_ledger(operation_id,faction_id,resource,delta,balance_after) '+
          'VALUES($1,$2,$3,$4,$5)',
          [opId,owner,resource,delta,newValue]
        );
      }
      await db.query(
        'UPDATE sectors SET last_production_at=last_production_at+make_interval(mins=>$2),'+
        'version=version+1 WHERE id=$1',[sectorId,minutes]
      );
      const v=await db.query<{version:string}>(
        'UPDATE world_meta SET version=version+1 WHERE id=TRUE RETURNING version'
      );
      const result:ProductionResult={
        sectorId,elapsedMinutes:minutes,pigmentAdded:added.pigment,
        materialAdded:added.material,worldVersion:Number(v.rows[0].version)
      };
      await db.query('INSERT INTO world_events(version,event_type,payload) VALUES($1,$2,$3::jsonb)',
        [result.worldVersion,'sector.production',JSON.stringify(result)]);
      return result;
    });
  }
}
