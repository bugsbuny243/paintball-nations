/** Paintball Nations C3 — internal, authoritative persistent frontline settlement.
 *
 * NEVER expose begin/settle as player-controlled HTTP endpoints.
 * Only a verified server battle lifecycle can supply a result.
 * This module alone does not prove that the Colyseus room lifecycle is wired.
 */
import {createHash} from 'node:crypto';
import pg, {type PoolClient} from 'pg';
import {WorldError,validateIdentifier} from '../../../packages/protocol/src/index.ts';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type FactionId='TR'|'DE';
type BattleStatus='OPEN'|'SETTLED'|'CANCELLED';

export interface StartFrontline {
  battleId:string;
  sectorId:string;
  sourceRoomId:string;
  attackerFactionId:FactionId;
}
export interface FrontlineOpened extends StartFrontline {
  defenderFactionId:FactionId;
  worldVersion:number;
  sectorVersion:number;
  status:'OPEN';
}
export interface SettleFrontline {
  battleId:string;
  sourceRoomId:string;
  winnerFactionId:FactionId;
  attackerScore:number;
  defenderScore:number;
}
export interface FrontlineSettlement extends SettleFrontline {
  sectorId:string;
  previousOwner:FactionId;
  newOwner:FactionId;
  captured:boolean;
  worldVersion:number;
  status:'SETTLED';
}
type BattleRow={
  battle_id:string;sector_id:string;source_room_id:string;
  attacker_faction_id:FactionId;defender_faction_id:FactionId;
  expected_sector_version:string;opened_world_version:string|null;status:BattleStatus;
  result:FrontlineSettlement|null;result_hash:string|null;
};
type SectorRow={owner_faction_id:FactionId;state:string;version:string};
function vUUID(raw:unknown,name:string):string{
  if(typeof raw!=='string'||!UUID.test(raw))throw new WorldError('invalid_'+name,400);
  return raw.toLowerCase();
}
function vFaction(raw:unknown,name:string):FactionId {
  if(raw!=='TR'&&raw!=='DE')throw new WorldError('invalid_'+name,400);
  return raw;
}
function normalStart(raw:unknown):StartFrontline {
  if(!raw||typeof raw!=='object')throw new WorldError('invalid_frontline',400);
  const x=raw as Record<string,unknown>;
  return {
    battleId:vUUID(x.battleId,'battle_id'),
    sectorId:validateIdentifier(x.sectorId,'sector_id'),
    sourceRoomId:validateIdentifier(x.sourceRoomId,'source_room_id'),
    attackerFactionId:vFaction(x.attackerFactionId,'attacker_faction')
  };
}
function normalSettle(raw:unknown):SettleFrontline {
  if(!raw||typeof raw!=='object')throw new WorldError('invalid_battle_result',400);
  const x=raw as Record<string,unknown>;
  const attackerScore=x.attackerScore,defenderScore=x.defenderScore;
  if(!Number.isSafeInteger(attackerScore)||!Number.isSafeInteger(defenderScore)||
     (attackerScore as number)<0||(defenderScore as number)<0||
     (attackerScore as number)>1000000||(defenderScore as number)>1000000||
     attackerScore===defenderScore)throw new WorldError('invalid_battle_scores',400);
  return {
    battleId:vUUID(x.battleId,'battle_id'),
    sourceRoomId:validateIdentifier(x.sourceRoomId,'source_room_id'),
    winnerFactionId:vFaction(x.winnerFactionId,'winner_faction'),
    attackerScore:attackerScore as number,
    defenderScore:defenderScore as number
  };
}
function hash(value:unknown):string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export class FrontlineStore {
  constructor(readonly pool:pg.Pool){}

  private async transaction<T>(fn:(db:PoolClient)=>Promise<T>):Promise<T>{
    const db=await this.pool.connect();
    try{
      await db.query('BEGIN');
      const value=await fn(db);
      await db.query('COMMIT');
      return value;
    }catch(error){
      try{await db.query('ROLLBACK');}catch{ /* primary error preserved */ }
      throw error;
    }finally{db.release();}
  }

  /** A server-side match coordinator opens a single contested sector. */
  async begin(raw:unknown):Promise<FrontlineOpened>{
    const x=normalStart(raw);
    return this.transaction(async db=>{
      // Serialize same battle ID without risking a duplicate INSERT race.
      await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[x.battleId]);
      const found=await db.query<BattleRow>(
        'SELECT * FROM frontline_battles WHERE battle_id=$1',[x.battleId]);
      if(found.rowCount){
        const b=found.rows[0];
        if(b.status==='OPEN'&&b.sector_id===x.sectorId&&
           b.source_room_id===x.sourceRoomId&&b.attacker_faction_id===x.attackerFactionId){
          return {...x,defenderFactionId:b.defender_faction_id,
            sectorVersion:Number(b.expected_sector_version),
            worldVersion:Number(b.opened_world_version),status:'OPEN'};
        }
        throw new WorldError('battle_id_already_used',409);
      }
      const sec=await db.query<SectorRow>(
        'SELECT owner_faction_id,state,version FROM sectors WHERE id=$1 FOR UPDATE',[x.sectorId]);
      if(!sec.rowCount)throw new WorldError('sector_not_found',404);
      const sector=sec.rows[0];
      if(sector.state!=='OWNED')throw new WorldError('sector_already_contested',409);
      if(sector.owner_faction_id===x.attackerFactionId)
        throw new WorldError('cannot_attack_own_sector',409);
      if(sector.owner_faction_id!=='TR'&&sector.owner_faction_id!=='DE')
        throw new WorldError('unsupported_defender_faction',409);
      await db.query(
        'INSERT INTO frontline_battles('+
        'battle_id,sector_id,source_room_id,attacker_faction_id,'+
        'defender_faction_id,expected_sector_version,status) '+
        "VALUES($1,$2,$3,$4,$5,$6,'OPEN')",
        [x.battleId,x.sectorId,x.sourceRoomId,x.attackerFactionId,
         sector.owner_faction_id,sector.version]
      );
      await db.query(
        "UPDATE sectors SET state='CONTESTED',version=version+1 WHERE id=$1",
        [x.sectorId]
      );
      const v=await db.query<{version:string}>(
        'UPDATE world_meta SET version=version+1 WHERE id=TRUE RETURNING version');
      // A world_version represents a globally visible sector-state transition.
      const version=Number(v.rows[0].version);
      await db.query('UPDATE frontline_battles SET opened_world_version=$2 WHERE battle_id=$1',
        [x.battleId,version]);
      await db.query(
        'INSERT INTO world_events(version,event_type,payload) VALUES($1,$2,$3::jsonb)',
        [version,'frontline.opened',JSON.stringify({
          battleId:x.battleId,sectorId:x.sectorId,
          attackerFactionId:x.attackerFactionId,defenderFactionId:sector.owner_faction_id
        })]
      );
      return {...x,defenderFactionId:sector.owner_faction_id,
        sectorVersion:Number(sector.version),worldVersion:version,status:'OPEN'};
    });
  }

  /** Only server-computed scores may reach this internal call. */
  async settle(raw:unknown):Promise<FrontlineSettlement>{
    const x=normalSettle(raw),incomingHash=hash(x);
    return this.transaction(async db=>{
      const row=await db.query<BattleRow>(
        'SELECT * FROM frontline_battles WHERE battle_id=$1 FOR UPDATE',[x.battleId]);
      if(!row.rowCount)throw new WorldError('battle_not_found',404);
      const b=row.rows[0];
      if(b.source_room_id!==x.sourceRoomId)throw new WorldError('wrong_battle_room',403);
      if(b.status==='SETTLED'){
        if(b.result_hash!==incomingHash||!b.result)
          throw new WorldError('battle_result_conflict',409);
        return b.result;
      }
      if(b.status!=='OPEN')throw new WorldError('battle_not_open',409);
      const validWinner=x.winnerFactionId===b.attacker_faction_id||
        x.winnerFactionId===b.defender_faction_id;
      const scoreWinner=x.attackerScore>x.defenderScore?
        b.attacker_faction_id:b.defender_faction_id;
      if(!validWinner||x.winnerFactionId!==scoreWinner)
        throw new WorldError('winner_score_mismatch',400);
      const sec=await db.query<SectorRow>(
        'SELECT owner_faction_id,state,version FROM sectors WHERE id=$1 FOR UPDATE',
        [b.sector_id]
      );
      if(!sec.rowCount||sec.rows[0].owner_faction_id!==b.defender_faction_id||
         sec.rows[0].state!=='CONTESTED')
        throw new WorldError('battle_sector_state_changed',409);
      const captured=x.winnerFactionId===b.attacker_faction_id;
      const newOwner=captured?b.attacker_faction_id:b.defender_faction_id;
      // Reset production clock on capture: no old-owner time credited to new owner.
      await db.query(
        "UPDATE sectors SET owner_faction_id=$2,state='OWNED',version=version+1,"+
        'last_production_at=CASE WHEN $3 THEN clock_timestamp() ELSE last_production_at END '+
        'WHERE id=$1',[b.sector_id,newOwner,captured]
      );
      const v=await db.query<{version:string}>(
        'UPDATE world_meta SET version=version+1 WHERE id=TRUE RETURNING version'
      );
      const result:FrontlineSettlement={
        ...x,sectorId:b.sector_id,previousOwner:b.defender_faction_id,newOwner,
        captured,worldVersion:Number(v.rows[0].version),status:'SETTLED'
      };
      await db.query(
        "UPDATE frontline_battles SET status='SETTLED',result=$2::jsonb,"+
        'result_hash=$3,settled_at=NOW() WHERE battle_id=$1',
        [x.battleId,JSON.stringify(result),incomingHash]
      );
      if(captured){
        await db.query(
          'INSERT INTO sector_ownership_history('+
          'battle_id,sector_id,previous_faction_id,new_faction_id,world_version) '+
          'VALUES($1,$2,$3,$4,$5)',
          [x.battleId,b.sector_id,b.defender_faction_id,newOwner,result.worldVersion]
        );
      }
      await db.query(
        'INSERT INTO world_events(version,event_type,payload) VALUES($1,$2,$3::jsonb)',
        [result.worldVersion,'frontline.settled',JSON.stringify(result)]
      );
      return result;
    });
  }

  /** Administrative recovery of an unfinished server-side match, never player API. */
  async cancel(battleId:unknown,sourceRoomId:unknown):Promise<number>{
    const id=vUUID(battleId,'battle_id');
    const room=validateIdentifier(sourceRoomId,'source_room_id');
    return this.transaction(async db=>{
      const found=await db.query<BattleRow>(
        'SELECT * FROM frontline_battles WHERE battle_id=$1 FOR UPDATE',[id]);
      if(!found.rowCount)throw new WorldError('battle_not_found',404);
      const b=found.rows[0];
      if(b.source_room_id!==room)throw new WorldError('wrong_battle_room',403);
      if(b.status!=='OPEN')throw new WorldError('battle_not_open',409);
      const sec=await db.query<SectorRow>(
        'SELECT owner_faction_id,state,version FROM sectors WHERE id=$1 FOR UPDATE',
        [b.sector_id]
      );
      if(!sec.rowCount||sec.rows[0].state!=='CONTESTED'||
        sec.rows[0].owner_faction_id!==b.defender_faction_id)
        throw new WorldError('battle_sector_state_changed',409);
      await db.query(
        "UPDATE sectors SET state='OWNED',version=version+1 WHERE id=$1",
        [b.sector_id]
      );
      await db.query(
        "UPDATE frontline_battles SET status='CANCELLED',settled_at=NOW() WHERE battle_id=$1",
        [id]
      );
      const v=await db.query<{version:string}>(
        'UPDATE world_meta SET version=version+1 WHERE id=TRUE RETURNING version'
      );
      const version=Number(v.rows[0].version);
      await db.query(
        'INSERT INTO world_events(version,event_type,payload) VALUES($1,$2,$3::jsonb)',
        [version,'frontline.cancelled',JSON.stringify({battleId:id,sectorId:b.sector_id})]
      );
      return version;
    });
  }
}
