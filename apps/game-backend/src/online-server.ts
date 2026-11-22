/** A3 experimental Colyseus room with signed temporary guest passes.
 * No player accounts, bans or persistent identity yet.
 * NEVER publicly deploy as a production game; the process blocks NODE_ENV=production.
 */
import {defineRoom,defineServer} from 'colyseus';
import {pathToFileURL} from 'node:url';
import {MackaFrontlineRoom} from './rooms/macka-room.ts';
import {issueGuestTicket} from './auth/guest-ticket.ts';
import {developmentPilotStore} from './auth/dev-pilot-db.ts';
import {issuePilotMatchTicket} from './auth/pilot-match-ticket.ts';
import {FrontlineStore} from './frontline-store.ts';

type GuestRequest={
  headers:{origin?:string;authorization?:string};
  socket:{remoteAddress?:string};
  query?:{faction?:unknown};
};
type GuestResponse={
  setHeader(name:string,value:string):void;
  status(code:number):GuestResponse;
  json(data:unknown):GuestResponse;
  end():void;
};

const permittedOrigins=new Set([
  'http://127.0.0.1:8765',
  'http://localhost:8765'
]);
if(process.env.DEV_GAME_ORIGIN) {
  const origin=new URL(process.env.DEV_GAME_ORIGIN);
  if(origin.origin!==process.env.DEV_GAME_ORIGIN || !['http:','https:'].includes(origin.protocol))
    throw new Error('DEV_GAME_ORIGIN must be an origin without path or trailing slash.');
  permittedOrigins.add(origin.origin);
}
// Ephemeral in-memory guard for development; not a production abuse protection system.
const issueCounts=new Map<string,{count:number;windowStart:number}>();


export const onlineServer=defineServer({
  beforeListen:async()=>{
    // Reclaim expired leases on cold start. A fresh lease is NEVER recovered,
    // even if its old room is absent after a sudden process exit.
    if(process.env.DEV_ENABLE_FRONTLINES!=='1')return;
    if(process.env.DEV_REQUIRE_PILOT!=='1')
      throw new Error('C5 recovery requires pilot-only mode');
    const db=developmentPilotStore();
    if(!db)throw new Error('C5 recovery requires DATABASE_URL');
    const recovered=await new FrontlineStore(db.pool).recoverExpired(100);
    if(recovered.length)
      console.info('C5 expired battles recovered on startup:',recovered.length);
  },
  rooms:{
    macka_frontline:defineRoom(MackaFrontlineRoom)
  },
  express:(app)=>{
    app.options('/api/v1/guest-ticket',(req:GuestRequest,res:GuestResponse)=>{
      const origin=req.headers.origin;
      if(origin && !permittedOrigins.has(origin)){res.status(403).end();return;}
      if(origin)res.setHeader('Access-Control-Allow-Origin',origin);
      res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers','Content-Type');
      res.setHeader('Vary','Origin');
      res.status(204).end();
    });
    app.post('/api/v1/guest-ticket',(req:GuestRequest,res:GuestResponse)=>{
      res.setHeader('Cache-Control','no-store');
      const origin=req.headers.origin;
      if(origin && !permittedOrigins.has(origin)){
        res.status(403).json({error:'origin_not_allowed'});
        return;
      }
      if(origin){
        res.setHeader('Access-Control-Allow-Origin',origin);
        res.setHeader('Vary','Origin');
      }
      const ip=req.socket.remoteAddress||'unknown';
      const now=Date.now();
      const prev=issueCounts.get(ip);
      const count=prev&&now-prev.windowStart<60000?prev:{count:0,windowStart:now};
      if(count.count>=12){
        res.status(429).json({error:'too_many_guest_tickets'});
        return;
      }
      count.count++;
      issueCounts.set(ip,count);
      if(issueCounts.size>1000){
        for(const [key,item] of issueCounts){
          if(now-item.windowStart>60000)issueCounts.delete(key);
        }
      }
      res.status(200).json({protocolVersion:1,guest:true,...issueGuestTicket()});
    });
    // C2 endpoints are development only; no public account signup is exposed.
    app.options('/api/v1/pilot-match-ticket',(req:GuestRequest,res:GuestResponse)=>{
      const origin=req.headers.origin;
      if(origin&&!permittedOrigins.has(origin)){res.status(403).end();return;}
      if(origin)res.setHeader('Access-Control-Allow-Origin',origin);
      res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers','Authorization');
      res.setHeader('Vary','Origin');
      res.status(204).end();
    });
    app.post('/api/v1/dev-pilot/register',async(req:GuestRequest,res:GuestResponse)=>{
      res.setHeader('Cache-Control','no-store');
      const origin=req.headers.origin,ip=req.socket.remoteAddress||'';
      if(origin&&!permittedOrigins.has(origin)){
        res.status(403).json({error:'origin_not_allowed'});return;
      }
      if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
      const loopback=['127.0.0.1','::1','::ffff:127.0.0.1'].includes(ip);
      const store=developmentPilotStore();
      if(process.env.NODE_ENV==='production'||!loopback||!store){
        res.status(403).json({error:'dev_registration_disabled'});return;
      }
      const now=Date.now(),key='pilot-register:'+ip;
      const prior=issueCounts.get(key);
      const counter=prior&&now-prior.windowStart<60000?prior:{count:0,windowStart:now};
      if(counter.count>=4){res.status(429).json({error:'registration_rate_limit'});return;}
      counter.count++;issueCounts.set(key,counter);
      try{
        const registered=await store.register(req.query?.faction);
        res.status(201).json(registered);
      }catch(error){
        const code=error instanceof Error?error.message:'registration_failed';
        res.status(code==='unsupported_test_faction'?400:503).json({
          error:code==='unsupported_test_faction'?code:'registration_unavailable'
        });
      }
    });
    app.post('/api/v1/pilot-match-ticket',async(req:GuestRequest,res:GuestResponse)=>{
      res.setHeader('Cache-Control','no-store');
      const origin=req.headers.origin;
      if(origin&&!permittedOrigins.has(origin)){
        res.status(403).json({error:'origin_not_allowed'});return;
      }
      if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
      const store=developmentPilotStore();
      if(process.env.NODE_ENV==='production'||!store){
        res.status(503).json({error:'pilot_login_unavailable'});return;
      }
      const auth=req.headers.authorization;
      const token=auth?.startsWith('Bearer ')?auth.slice(7):null;
      try{
        const pilot=await store.matchIdentity(token);
        if(!pilot){res.status(401).json({error:'pilot_session_invalid'});return;}
        const ticket=issuePilotMatchTicket(pilot);
        res.status(200).json({
          protocolVersion:1,guest:false,profile:{
            id:pilot.pilotId,displayName:pilot.displayName,factionId:pilot.factionId
          },...ticket
        });
      }catch{
        res.status(503).json({error:'pilot_login_unavailable'});
      }
    });
    app.get('/api/v1/online-health',(_req:GuestRequest,res:GuestResponse)=>{
      res.setHeader('Cache-Control','no-store');
      res.status(200).json({ok:true,service:'pbn-macka-guest-demo',productionReady:false});
    });
  },
  gracefullyShutdown:true
});
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(process.env.NODE_ENV==='production'){
    throw new Error('A3 guest tickets are not durable accounts: production disabled until real identity, moderation and operations are implemented.');
  }
  const port=Number(process.env.PORT||2567);
  if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Invalid PORT');
  onlineServer.listen(port);
  console.log('Paintball Nations experimental Maçka multiplayer on port '+port);
}
