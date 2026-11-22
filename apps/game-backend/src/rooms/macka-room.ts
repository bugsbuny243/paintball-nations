/** Single Maçka frontline room: player-to-player synchronization, no bots.
 * All score, movement and virtual paint hit changes originate server-side.
 * This is the A2 network loop, not 15v15 load proof and not a deployed service.
 */
import {Room, ServerError, type Client} from 'colyseus';
import {verifyGuestTicket, type GuestClaims} from '../auth/guest-ticket.ts';
import {verifyPilotMatchTicket, type PilotMatchClaims} from '../auth/pilot-match-ticket.ts';
import {developmentPilotStore} from '../auth/dev-pilot-db.ts';
import {readFileSync} from 'node:fs';
import {MackaSimulation,type CollisionMap} from './macka-simulation.ts';

const geo=JSON.parse(readFileSync(new URL('../../../../maps/istanbul-macka.json',import.meta.url),'utf8')) as CollisionMap;
export class MackaFrontlineRoom extends Room {
  maxClients=30;
  maxMessagesPerSecond=40;
  autoDispose=true;
  readonly mapId='TR-MACKA';
  readonly game=new MackaSimulation(geo);
  readonly guestIds=new Map<string,string>();
  async onAuth(_client:Client,options:unknown):Promise<GuestClaims|PilotMatchClaims|false> {
    const opts=options&&typeof options==='object'
      ?options as Record<string,unknown>:{};
    if(opts.pilotPass!==undefined){
      const identity=verifyPilotMatchTicket(opts.pilotPass);
      const db=developmentPilotStore();
      if(!identity||!db){
        if(process.env.NODE_ENV==='test')console.log('C2 room admission denied: invalid signature or DB unavailable');
        return false;
      }
      try {
        const active=await db.isMatchSessionActive({
          pilotId:identity.sub,sessionId:identity.sid,factionId:identity.factionId
        });
        if(process.env.NODE_ENV==='test')console.log('C2 room admission DB active:',active,'faction:',identity.factionId);
        return active?identity:false;
      }catch(error){
        if(process.env.NODE_ENV==='test')console.error('C2 room admission DB error:',error);
        // Database outage must not silently admit an unverified pilot.
        return false;
      }
    }
    if(process.env.DEV_REQUIRE_PILOT==='1')return false;
    return verifyGuestTicket(opts.guestTicket)||false;
  }
  onCreate():void{
    this.onMessage('input',(client:Client,input:unknown)=>{
      this.game.submitInput(client.sessionId,input);
    });
    // Deliberately reject arbitrary score/position messages: only input is accepted.
    this.clock.setInterval(()=>{
      const events=this.game.step(.05);
      for(const event of events)this.broadcast('paint_hit',event);
    },50);
    this.clock.setInterval(()=>{
      this.broadcast('snapshot',this.game.snapshot());
    },100);
  }
  onJoin(client:Client):void{
    const identity=client.auth as GuestClaims|PilotMatchClaims|undefined;
    if(!identity?.sub)throw new ServerError(401,'match_ticket_required');
    if(Array.from(this.guestIds.values()).includes(identity.sub))
      throw new ServerError(409,'identity_already_in_room');
    const pilot='factionId' in identity?identity as PilotMatchClaims:null;
    if(process.env.NODE_ENV==='test')console.log('C2 onJoin identity:',pilot?'pilot':'guest',pilot?.factionId??'auto');
    const player=this.game.addPlayer(client.sessionId,
      pilot?(pilot.factionId==='TR'?'blue':'red'):undefined);
    this.guestIds.set(client.sessionId,identity.sub);
    client.send('welcome',{sessionId:client.sessionId,team:player.team,
      pilotId:pilot?.sub??null,factionId:pilot?.factionId??null,
      roomId:this.roomId,mapId:this.mapId,protocolVersion:1,maxClients:30});
    client.send('snapshot',this.game.snapshot());
    this.broadcast('joined',{sessionId:client.sessionId,team:player.team});
  }
  async onDrop(client:Client):Promise<void>{
    const player=this.game.players.get(client.sessionId);
    if(player) this.game.submitInput(player.id,{
      seq:player.lastSeq+1,mx:0,mz:0,yaw:player.yaw,pitch:player.pitch,fire:false
    });
    try {await this.allowReconnection(client,12);}
    catch { /* onLeave executes after the reconnection window expires */ }
  }
  onReconnect(client:Client):void{
    const player=this.game.players.get(client.sessionId);
    if(player)client.send('welcome',{sessionId:client.sessionId,team:player.team,
      roomId:this.roomId,mapId:this.mapId,protocolVersion:1,maxClients:30});
    client.send('snapshot',this.game.snapshot());
  }
  onLeave(client:Client):void{
    this.guestIds.delete(client.sessionId);
    this.game.removePlayer(client.sessionId);
    this.broadcast('left',{sessionId:client.sessionId});
  }
}