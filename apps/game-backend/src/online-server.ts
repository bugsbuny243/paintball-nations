/** A3 experimental Colyseus room with signed temporary guest passes.
 * No player accounts, bans or persistent identity yet.
 * NEVER publicly deploy as a production game; the process blocks NODE_ENV=production.
 */
import {defineRoom,defineServer} from 'colyseus';
import {pathToFileURL} from 'node:url';
import {MackaFrontlineRoom} from './rooms/macka-room.ts';
import {issueGuestTicket} from './auth/guest-ticket.ts';

type GuestRequest={
  headers:{origin?:string};
  socket:{remoteAddress?:string};
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
