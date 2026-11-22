/** C2 development-only signed pass binding one pilot's active DB session to a match.
 * This is NOT production authentication; the real account-recovery/moderation stack is pending.
 * Signing secret is generated per process unless an explicit >=32 byte dev key is supplied.
 */
import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto';

export const MATCH_TICKET_TTL_SECONDS=90;
const AUD='pbn-pilot-match-development';
const supplied=process.env.DEV_MATCH_TICKET_SECRET;
if(supplied&&Buffer.byteLength(supplied,'utf8')<32)
  throw new Error('DEV_MATCH_TICKET_SECRET must be at least 32 bytes');
const secret=supplied?Buffer.from(supplied,'utf8'):randomBytes(32);
export type FactionId='TR'|'DE';
export interface PilotMatchClaims {
  v:1;aud:typeof AUD;sub:string;sid:string;factionId:FactionId;
  iat:number;exp:number;
}
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function signature(data:string):Buffer{
  return createHmac('sha256',secret).update(data,'utf8').digest();
}
export function issuePilotMatchTicket(identity:{pilotId:string;sessionId:string;factionId:string},
  nowMs=Date.now()):{ticket:string;expiresAt:string}{
  if(!UUID.test(identity.pilotId)||!UUID.test(identity.sessionId)||
     (identity.factionId!=='TR'&&identity.factionId!=='DE'))
    throw new Error('invalid_pilot_identity');
  const iat=Math.floor(nowMs/1000);
  const claims:PilotMatchClaims={
    v:1,aud:AUD,sub:identity.pilotId,sid:identity.sessionId,
    factionId:identity.factionId,iat,exp:iat+MATCH_TICKET_TTL_SECONDS
  };
  const body=Buffer.from(JSON.stringify(claims)).toString('base64url');
  return {
    ticket:body+'.'+signature(body).toString('base64url'),
    expiresAt:new Date(claims.exp*1000).toISOString()
  };
}
export function verifyPilotMatchTicket(raw:unknown,nowMs=Date.now()):PilotMatchClaims|null{
  if(typeof raw!=='string'||raw.length<80||raw.length>1600)return null;
  const match=/^([a-zA-Z0-9_-]+)\.([a-zA-Z0-9_-]+)$/.exec(raw);
  if(!match)return null;
  const sig=Buffer.from(match[2],'base64url');
  const expected=signature(match[1]);
  if(sig.length!==expected.length||!timingSafeEqual(sig,expected))return null;
  let value:unknown;
  try{value=JSON.parse(Buffer.from(match[1],'base64url').toString('utf8'));}
  catch{return null;}
  if(!value||typeof value!=='object')return null;
  const c=value as Record<string,unknown>,now=Math.floor(nowMs/1000);
  if(c.v!==1||c.aud!==AUD||typeof c.sub!=='string'||!UUID.test(c.sub)||
    typeof c.sid!=='string'||!UUID.test(c.sid)||
    (c.factionId!=='TR'&&c.factionId!=='DE')||
    typeof c.iat!=='number'||!Number.isSafeInteger(c.iat)||
    typeof c.exp!=='number'||!Number.isSafeInteger(c.exp)||
    c.iat>now+30||c.exp<=now||c.exp-c.iat!==MATCH_TICKET_TTL_SECONDS)return null;
  return value as PilotMatchClaims;
}
