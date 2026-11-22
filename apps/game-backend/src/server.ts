import {createServer, type IncomingMessage, type ServerResponse} from 'node:http';
import {createHash,timingSafeEqual} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import pg from 'pg';
import {WorldStore} from './world-store.ts';
import {PilotStore} from './pilot-store.ts';
import {WorldError,validateIdentifier} from '../../../packages/protocol/src/index.ts';

type Json = Record<string,unknown>|unknown[];

function reply(res:ServerResponse,status:number,body:Json):void {
  res.writeHead(status,{
    'content-type':'application/json; charset=utf-8','cache-control':'no-store',
    'x-content-type-options':'nosniff','content-security-policy':"default-src 'none'"
  });
  res.end(JSON.stringify(body));
}
function authorized(req:IncomingMessage,adminToken?:string):void {
  if(!adminToken||adminToken.length<32)throw new WorldError('operator_api_disabled',503);
  const provided=req.headers.authorization?.startsWith('Bearer ')
    ?req.headers.authorization.slice(7):'';
  const a=createHash('sha256').update(provided).digest();
  const b=createHash('sha256').update(adminToken).digest();
  if(!provided || !timingSafeEqual(a,b))throw new WorldError('unauthorized',401);
}
function bearerToken(req:IncomingMessage):string {
  const h=req.headers.authorization;
  return typeof h==='string'&&h.startsWith('Bearer ')?h.slice(7):'';
}
async function readJson(req:IncomingMessage):Promise<unknown> {
  if(!req.headers['content-type']?.startsWith('application/json'))
    throw new WorldError('content_type_must_be_json',415);
  const maxBytes=4096;
  const parts:Buffer[]=[];
  let size=0;
  for await (const chunk of req) {
    const bytes=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk as Uint8Array);
    size+=bytes.length;
    if(size>maxBytes)throw new WorldError('request_too_large',413);
    parts.push(bytes);
  }
  try {return JSON.parse(Buffer.concat(parts).toString('utf8')) as unknown;}
  catch {throw new WorldError('invalid_json',400);}
}

export function createWorldServer(pool:pg.Pool,operatorToken?:string) {
  const store=new WorldStore(pool);
  const pilots=new PilotStore(pool);
  const registrationCounts=new Map<string,{count:number;since:number}>();
  return createServer(async(req,res)=>{
    try {
      const method=req.method||'GET';
      const url=new URL(req.url||'/', 'http://localhost');
      if(method==='GET' && url.pathname==='/health') {
        return reply(res,200,{ok:await store.health(),service:'paintball-world',stage:'A1'});
      }
      // C1 isolated development signup: no real names or emails collected.
      // Never create accounts on the public internet with this endpoint.
      if(method==='POST' && url.pathname==='/api/v1/pilots/dev-register') {
        const ip=req.socket.remoteAddress||'';
        const loopback=['127.0.0.1','::1','::ffff:127.0.0.1'].includes(ip);
        if(process.env.NODE_ENV==='production'||!loopback)
          throw new WorldError('development_registration_disabled',403);
        const now=Date.now();
        const old=registrationCounts.get(ip);
        const entry=old&&now-old.since<60000?old:{count:0,since:now};
        if(entry.count>=4)throw new WorldError('registration_rate_limit',429);
        const payload=await readJson(req);
        if(!payload||typeof payload!=='object')throw new WorldError('invalid_request',400);
        const factionId=(payload as Record<string,unknown>).factionId;
        // Rate limit even invalid attempts.
        entry.count++;
        registrationCounts.set(ip,entry);
        const result=await pilots.register(factionId);
        return reply(res,201,result as unknown as Json);
      }
      if(url.pathname==='/api/v1/pilots/me' && method==='GET'){
        const pilot=await pilots.requirePilot(bearerToken(req));
        return reply(res,200,{profile:pilot});
      }
      if(url.pathname==='/api/v1/pilots/me/economy' && method==='GET'){
        const pilot=await pilots.requirePilot(bearerToken(req));
        return reply(res,200,{
          profile:pilot,
          balances:await store.balances(pilot.factionId)
        });
      }
      if(url.pathname==='/api/v1/pilots/logout' && method==='POST'){
        const revoked=await pilots.logout(bearerToken(req));
        if(!revoked)throw new WorldError('pilot_session_invalid',401);
        return reply(res,200,{revoked:true});
      }
      if(method==='GET' && url.pathname==='/api/v1/world') {
        return reply(res,200,await store.snapshot() as unknown as Json);
      }
      const balance=url.pathname.match(/^\/api\/v1\/factions\/([^/]+)\/balances$/);
      if(method==='GET' && balance) {
        authorized(req,operatorToken);
        const factionId=validateIdentifier(decodeURIComponent(balance[1]),'faction_id');
        return reply(res,200,{factionId,balances:await store.balances(factionId)});
      }
      if(method==='POST' && url.pathname==='/api/v1/operator/structures/upgrade') {
        authorized(req,operatorToken);
        return reply(res,200,await store.upgradeStructure(await readJson(req)) as unknown as Json);
      }
      if(method==='POST' && url.pathname==='/api/v1/operator/production/tick') {
        authorized(req,operatorToken);
        const body=await readJson(req);
        if(!body||typeof body!=='object')throw new WorldError('invalid_request',400);
        const sectorId=validateIdentifier((body as Record<string,unknown>).sectorId,'sector_id');
        return reply(res,200,await store.produce(sectorId) as unknown as Json);
      }
      return reply(res,404,{error:'not_found'});
    } catch(error) {
      const status=error instanceof WorldError?error.status:500;
      const code=error instanceof WorldError?error.code:'internal_error';
      if(status===500)console.error('World API failure',error);
      reply(res,status,{error:code});
    }
  });
}

if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL missing');
  const port=Number(process.env.PORT||8787);
  if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid PORT');
  const host=process.env.BIND_HOST||'127.0.0.1'; // No accidental public host.
  const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:10});
  pool.on('error',(err)=>console.error('Idle PostgreSQL connection error:',err));
  const server=createWorldServer(pool,process.env.WORLD_ADMIN_TOKEN);
  server.listen(port,host,()=>console.log('Paintball World C1 development API listening on '+host+':'+port));
  const stop=()=>server.close(()=>pool.end().then(()=>process.exit(0)));
  process.on('SIGINT',stop);process.on('SIGTERM',stop);
}
