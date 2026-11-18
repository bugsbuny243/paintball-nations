/** Paintball Nations — A2 authoritative paintball simulation.
 * Virtual sporting paintball only. Server accepts control input, never direct positions/scores.
 * Pure game rules so they can be tested independently of Colyseus and PostgreSQL.
 */
export type Team = 'blue'|'red';
export interface ControlInput {seq:number;mx:number;mz:number;yaw:number;pitch:number;fire:boolean}
export interface Avatar {
  id:string;team:Team;x:number;z:number;yaw:number;pitch:number;active:boolean;
  score:number;isBot:false;
}
interface InternalAvatar extends Avatar {
  input:ControlInput;lastSeq:number;shotCooldown:number;respawnIn:number;
}
export interface BattleSnapshot {
  protocolVersion:1;
  mapId:'TR-MACKA';
  serverTick:number;
  players:Avatar[];
  scores:{blue:number;red:number};
  playerCounts:{blue:number;red:number};
  bots:0;
}
export interface PaintEvent {
  shooterId:string;targetId:string;team:Team;
  x:number;z:number;serverTick:number;
}
export interface CollisionMap {buildings:{p:number[][]}[]}
const MAX_SPEED=5.4, DT_LIMIT=0.1, MAX_RANGE=115, COOLDOWN=.35, RESPAWN_SECONDS=4;
export const MAX_PLAYERS_PER_TEAM=15;

const near=(p:number[],q:number[])=>Math.hypot(p[0]-q[0],p[1]-q[1]);
function distanceToSegment(x:number,z:number,a:number[],b:number[]):number {
  const dx=b[0]-a[0],dz=b[1]-a[1];
  const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));
  return Math.hypot(x-(a[0]+dx*t),z-(a[1]+dz*t));
}
function insidePolygon(x:number,z:number,poly:number[][]):boolean {
  let inside=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++) {
    const a=poly[i],b=poly[j];
    if((a[1]>z)!==(b[1]>z) && x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
}
function hitDistance(ox:number,oz:number,dx:number,dz:number,x:number,z:number,radius:number):number {
  const a=ox-x,b=oz-z,c=a*dx+b*dz,disc=c*c-(a*a+b*b-radius*radius);
  if(disc<0)return Infinity;
  const dist=-c-Math.sqrt(disc);
  return dist>=0?dist:Infinity;
}
export function normalizeInput(v:unknown):ControlInput|null {
  if(v===null||typeof v!=='object')return null;
  const r=v as Record<string,unknown>;
  for(const k of ['seq','mx','mz','yaw','pitch']) {
    if(typeof r[k]!=='number'||!Number.isFinite(r[k]))return null;
  }
  const seq=r.seq as number,mx=r.mx as number,mz=r.mz as number,
    yaw=r.yaw as number,pitch=r.pitch as number;
  if(!Number.isSafeInteger(seq)||seq<0||seq>2147483647||
    Math.abs(mx)>1||Math.abs(mz)>1||yaw < -360||yaw > 360||
    pitch< -60||pitch>60||typeof r.fire!=='boolean')return null;
  return {seq,mx,mz,yaw,pitch,fire:r.fire};
}

export class MackaSimulation {
  readonly players=new Map<string,InternalAvatar>();
  readonly scores={blue:0,red:0};
  private now=0;
  private tick=0;
  private readonly buildings:number[][][];
  constructor(geo:CollisionMap){
    this.buildings=geo.buildings.map(b=>b.p);
  }
  private blocked(x:number,z:number,radius=.75):boolean{
    if(x<-96||x>96||z<-124||z>124)return true;
    for(const polygon of this.buildings){
      if(insidePolygon(x,z,polygon))return true;
      for(let i=0;i<polygon.length;i++){
        if(distanceToSegment(x,z,polygon[i],polygon[(i+1)%polygon.length])<radius)return true;
      }
    }
    return false;
  }
  count(team:Team):number{
    return Array.from(this.players.values()).filter(p=>p.team===team).length;
  }
  addPlayer(id:string):Avatar{
    if(!id||this.players.has(id))throw new Error('duplicate_or_missing_session');
    const blue=this.count('blue'),red=this.count('red');
    if(blue+red>=30)throw new Error('room_full');
    const team:Team=blue<=red?'blue':'red', slot=this.count(team);
    if(slot>=MAX_PLAYERS_PER_TEAM)throw new Error('team_full');
    let x=((slot%5)-2)*3,z=team==='blue'?44:-44;
    // Deterministic spawn lookup avoids real OSM building footprints.
    for(let i=0;i<20 && this.blocked(x,z,1);i++){
      x=((i%7)-3)*4;z=(team==='blue'?44:-44)+(team==='blue'?1:-1)*Math.floor(i/7)*7;
    }
    if(this.blocked(x,z,1))throw new Error('no_free_spawn');
    const p:InternalAvatar={
      id,team,x,z,yaw:team==='blue'?0:180,pitch:0,active:true,
      score:0,isBot:false,shotCooldown:0,respawnIn:0,lastSeq:-1,
      input:{seq:0,mx:0,mz:0,yaw:team==='blue'?0:180,pitch:0,fire:false}
    };
    this.players.set(id,p);
    return this.publicPlayer(p);
  }
  removePlayer(id:string):void{this.players.delete(id);}
  submitInput(id:string,raw:unknown):boolean{
    const p=this.players.get(id),input=normalizeInput(raw);
    if(!p||!input||input.seq<=p.lastSeq)return false;
    p.lastSeq=input.seq;
    p.input=input;
    return true;
  }
  private publicPlayer(p:InternalAvatar):Avatar{
    return {id:p.id,team:p.team,x:+p.x.toFixed(3),z:+p.z.toFixed(3),
      yaw:p.yaw,pitch:p.pitch,active:p.active,score:p.score,isBot:false};
  }
  snapshot():BattleSnapshot{
    return {protocolVersion:1,mapId:'TR-MACKA',serverTick:this.tick,
      players:Array.from(this.players.values(),p=>this.publicPlayer(p)),
      scores:{...this.scores},
      playerCounts:{blue:this.count('blue'),red:this.count('red')},bots:0};
  }
  private visibleRayDistance(ox:number,oz:number,dx:number,dz:number,max:number):number{
    // Approximate building obstruction in top-down, for paintballs at human height.
    // Limit segment checks to a ray; polygon geometry remains server-side.
    let limit=max;
    for(const polygon of this.buildings) {
      for(let i=0;i<polygon.length;i++){
        const a=polygon[i],b=polygon[(i+1)%polygon.length];
        const sx=b[0]-a[0],sz=b[1]-a[1],
          den=dx*sz-dz*sx;
        if(Math.abs(den)<1e-8)continue;
        const qx=a[0]-ox,qz=a[1]-oz;
        const t=(qx*sz-qz*sx)/den;
        const u=(qx*dz-qz*dx)/den;
        if(t>=0&&t<=limit&&u>=0&&u<=1)limit=t;
      }
    }
    return limit;
  }
  private fire(shooter:InternalAvatar):PaintEvent|null{
    const yaw=shooter.yaw*Math.PI/180,
      pitch=shooter.pitch*Math.PI/180,
      horizontal=Math.cos(pitch),
      dx=-Math.sin(yaw)*horizontal,dz=-Math.cos(yaw)*horizontal;
    if(horizontal<0.65)return null;
    // Raycast the 2D collider footprints. Not a fully detailed 3D ballistic model.
    let nearest=this.visibleRayDistance(shooter.x,shooter.z,dx,dz,MAX_RANGE),target:InternalAvatar|null=null;
    for(const p of this.players.values()){
      if(p.id===shooter.id||!p.active)continue;
      const dist=hitDistance(shooter.x,shooter.z,dx,dz,p.x,p.z,.8);
      if(dist<nearest){nearest=dist;target=p;}
    }
    if(!target||target.team===shooter.team)return null;
    target.active=false;target.respawnIn=RESPAWN_SECONDS;
    shooter.score+=100;this.scores[shooter.team]+=100;
    return {shooterId:shooter.id,targetId:target.id,team:shooter.team,
      x:target.x,z:target.z,serverTick:this.tick};
  }
  step(dt:number):PaintEvent[]{
    dt=Math.max(0,Math.min(DT_LIMIT,dt));
    this.now+=dt;this.tick++;
    const events:PaintEvent[]=[];
    for(const p of this.players.values()){
      if(!p.active){
        p.respawnIn-=dt;
        if(p.respawnIn<=0){p.active=true;p.respawnIn=0;}
        continue;
      }
      const input=p.input;
      p.yaw=input.yaw;p.pitch=input.pitch;
      p.shotCooldown=Math.max(0,p.shotCooldown-dt);
      const length=Math.hypot(input.mx,input.mz);
      const strafe=length>1?input.mx/length:input.mx;
      const forward=length>1?input.mz/length:input.mz;
      const angle=p.yaw*Math.PI/180, distance=MAX_SPEED*dt;
      const nx=p.x+(-Math.sin(angle)*forward+Math.cos(angle)*strafe)*distance;
      const nz=p.z+(-Math.cos(angle)*forward-Math.sin(angle)*strafe)*distance;
      if(!this.blocked(nx,p.z))p.x=nx;
      if(!this.blocked(p.x,nz))p.z=nz;
      if(input.fire&&p.shotCooldown<=0){
        p.shotCooldown=COOLDOWN;
        const event=this.fire(p);
        if(event)events.push(event);
      }
    }
    return events;
  }
}