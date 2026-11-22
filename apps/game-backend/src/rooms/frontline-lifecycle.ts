/** C4: internal opt-in Colyseus -> PostgreSQL frontline lifecycle.
 * Enabled only for pilot-only development rooms. No client can begin, settle or
 * cancel territory via messages. Production startup remains disabled.
 */
import {randomUUID} from 'node:crypto';
import {FrontlineStore,type FrontlineOpened,type FrontlineSettlement} from '../frontline-store.ts';
import {WorldStore} from '../world-store.ts';
import {developmentPilotStore} from '../auth/dev-pilot-db.ts';
import type {FactionId} from '../auth/pilot-match-ticket.ts';

export type FrontlineWorldState={
  sectorId:'TR-MACKA';
  ownerFactionId:FactionId;
  state:'OWNED'|'CONTESTED';
  worldVersion:number;
  battleId:string|null;
  endsAt:number|null;
  outcome:'OPEN'|'CAPTURED'|'DEFENDED'|'DRAW'|'CANCELLED'|'UNAVAILABLE';
};
type Scores={blue:number;red:number};
type Participants=()=>Set<FactionId>;
type Publish=(state:FrontlineWorldState)=>void;

const SECTOR='TR-MACKA' as const;
const MIN_DURATION_MS=1000;
const MAX_DURATION_MS=600000;
const DEFAULT_DURATION_MS=150000;
function durationMs():number{
  const input=Number(process.env.DEV_FRONTLINE_DURATION_MS||DEFAULT_DURATION_MS);
  return Number.isInteger(input)&&input>=MIN_DURATION_MS&&input<=MAX_DURATION_MS
    ?input:DEFAULT_DURATION_MS;
}
function ownerFromWorld(world:WorldStore):Promise<{
  ownerFactionId:FactionId;state:'OWNED'|'CONTESTED';version:number
}>{
  return world.snapshot().then(s=>{
    const sector=s.sectors.find(x=>x.id===SECTOR);
    if(!sector||!['TR','DE'].includes(sector.ownerFactionId))throw new Error('unsupported_sector');
    if(sector.state!=='OWNED'&&sector.state!=='CONTESTED')throw new Error('invalid_sector_state');
    return {ownerFactionId:sector.ownerFactionId as FactionId,
      state:sector.state,version:s.worldVersion};
  });
}

export class FrontlineLifecycle {
  private opened:FrontlineOpened|null=null;
  private endsAt:number|null=null;
  private closed=false;
  private pending:Promise<void>|null=null;
  private finishing:Promise<FrontlineSettlement|null>|null=null;
  private latest:FrontlineWorldState|null=null;
  private readonly store:FrontlineStore;
  private readonly world:WorldStore;
  constructor(
    private readonly sourceRoomId:string,
    private readonly participants:Participants,
    private readonly publish:Publish
  ){
    const db=developmentPilotStore();
    if(!db)throw new Error('C4 requires DATABASE_URL for authoritative world');
    this.store=new FrontlineStore(db.pool);
    this.world=new WorldStore(db.pool);
  }
  state():FrontlineWorldState|null{return this.latest;}
  async tryStart():Promise<void>{
    if(this.closed||this.opened||this.pending)return this.pending??Promise.resolve();
    const teams=this.participants();
    if(!teams.has('TR')||!teams.has('DE'))return;
    const op=(async()=>{
      const before=await ownerFromWorld(this.world);
      if(before.state!=='OWNED')return; // Another room is already contesting this sector.
      const attackerFactionId:FactionId=before.ownerFactionId==='TR'?'DE':'TR';
      const opened=await this.store.begin({
        battleId:randomUUID(),sectorId:SECTOR,sourceRoomId:this.sourceRoomId,attackerFactionId
      });
      this.opened=opened;
      this.endsAt=Date.now()+durationMs();
      if(this.closed||!this.hasTwoTeams()){
        await this.store.cancel(opened.battleId,this.sourceRoomId);
        this.opened=null;this.endsAt=null;
        return;
      }
      this.broadcast({sectorId:SECTOR,ownerFactionId:opened.defenderFactionId,
        state:'CONTESTED',worldVersion:opened.worldVersion,
        battleId:opened.battleId,endsAt:this.endsAt,outcome:'OPEN'});
    })();
    this.pending=op;
    try{await op;}
    finally{if(this.pending===op)this.pending=null;}
  }
  private hasTwoTeams():boolean{
    const teams=this.participants();
    return teams.has('TR')&&teams.has('DE');
  }
  private broadcast(value:FrontlineWorldState):void{
    this.latest=value;
    this.publish(value);
  }
  async finish(scores:Scores):Promise<FrontlineSettlement|null>{
    if(this.pending)await this.pending;
    if(this.finishing)return this.finishing;
    if(!this.opened||this.closed)return null;
    const opened=this.opened;
    const task=(async():Promise<FrontlineSettlement|null>=>{
      const valid=(v:number)=>Number.isSafeInteger(v)&&v>=0&&v<=1000000;
      const attackerScore=opened.attackerFactionId==='TR'?scores.blue:scores.red;
      const defenderScore=opened.defenderFactionId==='TR'?scores.blue:scores.red;
      if(!valid(attackerScore)||!valid(defenderScore)||
         attackerScore===defenderScore||!this.hasTwoTeams()){
        const outcome=attackerScore===defenderScore?'DRAW':'CANCELLED';
        const version=await this.store.cancel(opened.battleId,this.sourceRoomId);
        this.opened=null;this.endsAt=null;
        this.broadcast({sectorId:SECTOR,ownerFactionId:opened.defenderFactionId,
          state:'OWNED',worldVersion:version,battleId:opened.battleId,
          endsAt:null,outcome});
        return null;
      }
      const winnerFactionId=attackerScore>defenderScore
        ?opened.attackerFactionId:opened.defenderFactionId;
      const result=await this.store.settle({
        battleId:opened.battleId,sourceRoomId:this.sourceRoomId,
        winnerFactionId,attackerScore,defenderScore
      });
      this.opened=null;this.endsAt=null;
      this.broadcast({sectorId:SECTOR,ownerFactionId:result.newOwner,
        state:'OWNED',worldVersion:result.worldVersion,battleId:opened.battleId,
        endsAt:null,outcome:result.captured?'CAPTURED':'DEFENDED'});
      return result;
    })();
    this.finishing=task;
    try{return await task;}
    finally{if(this.finishing===task)this.finishing=null;}
  }
  async tick(scores:Scores):Promise<void>{
    if(this.closed||!this.opened||this.endsAt===null||Date.now()<this.endsAt)return;
    await this.finish(scores);
  }
  async dispose():Promise<void>{
    if(this.pending)await this.pending.catch(()=>{});
    if(this.finishing)await this.finishing.catch(()=>{});
    if(this.closed)return;
    this.closed=true;
    if(!this.opened)return;
    const battle=this.opened;
    this.opened=null;this.endsAt=null;
    try{
      await this.store.cancel(battle.battleId,this.sourceRoomId);
      // No broadcast while room disposes; clients have already disconnected.
    }catch(error){
      // Durable cleanup requires recovery if database is unavailable on shutdown.
      console.error('C4 unfinished frontline recovery required:',battle.battleId,error);
    }
  }
}
