/** A3 development-only guest room pass.
 * Signed short-lived tickets are NOT durable player accounts or anti-abuse identities.
 * Never use this endpoint as production authentication.
 */
import {createHmac, randomBytes, randomUUID, timingSafeEqual} from 'node:crypto';

export const GUEST_TICKET_TTL_SECONDS = 600;
const AUDIENCE = 'pbn-macka-development';
const supplied = process.env.DEV_GUEST_TICKET_SECRET;
if(supplied && Buffer.byteLength(supplied,'utf8')<32) {
  throw new Error('DEV_GUEST_TICKET_SECRET must contain at least 32 UTF-8 bytes.');
}
const secret = supplied ? Buffer.from(supplied,'utf8') : randomBytes(32);

export interface GuestClaims {
  v:1;
  sub:string;
  aud:typeof AUDIENCE;
  iat:number;
  exp:number;
}

function sign(data:string):Buffer {
  return createHmac('sha256',secret).update(data,'utf8').digest();
}

export function issueGuestTicket(nowMs=Date.now()):{ticket:string;expiresAt:string} {
  const issued=Math.floor(nowMs/1000);
  const payload:GuestClaims={
    v:1,sub:randomUUID(),aud:AUDIENCE,
    iat:issued,exp:issued+GUEST_TICKET_TTL_SECONDS
  };
  const body=Buffer.from(JSON.stringify(payload),'utf8').toString('base64url');
  return {ticket:body+'.'+sign(body).toString('base64url'),
    expiresAt:new Date(payload.exp*1000).toISOString()};
}

export function verifyGuestTicket(token:unknown,nowMs=Date.now()):GuestClaims|null {
  if(typeof token!=='string'||token.length>1024||token.length<50)return null;
  const match=/^([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(token);
  if(!match)return null;
  const signature=Buffer.from(match[2],'base64url');
  const expected=sign(match[1]);
  if(signature.length!==expected.length||!timingSafeEqual(signature,expected))return null;
  let payload:unknown;
  try{payload=JSON.parse(Buffer.from(match[1],'base64url').toString('utf8'));}
  catch{return null;}
  if(!payload||typeof payload!=='object')return null;
  const c=payload as Record<string,unknown>;
  const now=Math.floor(nowMs/1000);
  if(c.v!==1||c.aud!==AUDIENCE||typeof c.sub!=='string'||
     !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(c.sub)||
     !Number.isInteger(c.iat)||!Number.isInteger(c.exp))return null;
  if((c.iat as number)>now+30||(c.exp as number)<=now||
     (c.exp as number)-(c.iat as number)!==GUEST_TICKET_TTL_SECONDS)return null;
  return payload as GuestClaims;
}
