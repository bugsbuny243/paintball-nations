/** Single Maçka frontline room: player-to-player synchronization, no bots.
 * All score, movement and virtual paint hit changes originate server-side.
 * This is the A2 network loop, not 15v15 load proof and not a deployed service.
 */
import {Room, ServerError, type Client} from 'colyseus';
import {verifyGuestTicket, type GuestClaims} from '../auth/guest-ticket.ts';
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
  static async onAuth(token:unknown):Promise<GuestClaims> {
    const claims=verifyGuestTicket(token);
    if(!claims)throw new ServerError(401,'guest_ticket_invalid_or_expired');
    return claims;
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
    const guest=client.auth as GuestClaims | undefined;
    if(!guest?.sub)throw new ServerError(401,'guest_ticket_required');
    if(Array.from(this.guestIds.values()).includes(guest.sub))
      throw new ServerError(409,'guest_already_in_room');
    const player=this.game.addPlayer(client.sessionId);
    this.guestIds.set(client.sessionId,guest.sub);
    client.send('welcome',{sessionId:client.sessionId,team:player.team,
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