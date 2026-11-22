/** Paintball Nations C1: pseudonymous, revocable development pilot identity.
 * No email, address, phone or real-world location collected.
 * NOT public production account authentication.
 */
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import pg from 'pg';
import {WorldError} from '../../../packages/protocol/src/index.ts';

const SESSION_DAYS=14;
export interface PilotProfile {
  id:string;
  displayName:string;
  factionId:string;
  factionName:string;
  createdAt:string;
}
export interface NewPilot {
  profile:PilotProfile;
  sessionToken:string;
  expiresAt:string;
}
type ProfileRow={
  id:string;displayName:string;factionId:string;factionName:string;createdAt:Date
};
export function hashSessionToken(token:string):string {
  return createHash('sha256').update(token,'utf8').digest('hex');
}
function validSession(token:unknown):token is string{
  return typeof token==='string'&&/^[A-Za-z0-9_-]{43}$/.test(token);
}
function publicProfile(row:ProfileRow):PilotProfile {
  return {
    id:row.id,displayName:row.displayName,
    factionId:row.factionId,factionName:row.factionName,
    createdAt:row.createdAt.toISOString()
  };
}
export class PilotStore {
  constructor(readonly pool:pg.Pool){}

  /** Faction is chosen for virtual sport only; never asserts real nationality. */
  async register(factionId:unknown):Promise<NewPilot> {
    if(factionId!=='TR'&&factionId!=='DE')throw new WorldError('unsupported_test_faction',400);
    const id=randomUUID();
    const name='Pilot-'+randomBytes(7).toString('hex');
    const token=randomBytes(32).toString('base64url');
    const hash=hashSessionToken(token);
    const sessionId=randomUUID();
    const expiresAt=new Date(Date.now()+SESSION_DAYS*86400000);
    const db=await this.pool.connect();
    try{
      await db.query('BEGIN');
      const inserted=await db.query<ProfileRow>(
        'INSERT INTO pilots(id,display_name,faction_id) VALUES($1,$2,$3) '+
        'RETURNING id,display_name AS "displayName",faction_id AS "factionId",'+
        '(SELECT name FROM factions WHERE id=$3) AS "factionName",'+
        'created_at AS "createdAt"',
        [id,name,factionId]
      );
      await db.query(
        'INSERT INTO pilot_sessions(id,pilot_id,token_hash,expires_at) VALUES($1,$2,$3,$4)',
        [sessionId,id,hash,expiresAt]
      );
      await db.query('COMMIT');
      return {profile:publicProfile(inserted.rows[0]),
        sessionToken:token,expiresAt:expiresAt.toISOString()};
    }catch(err){
      await db.query('ROLLBACK').catch(()=>{});
      throw err;
    }finally{db.release();}
  }

  /** Bearer token is stored only as SHA-256 in PostgreSQL. */
  async authenticate(token:unknown):Promise<PilotProfile|null> {
    if(!validSession(token))return null;
    const q=await this.pool.query<ProfileRow>(
      'SELECT p.id,p.display_name AS "displayName",'+
      'p.faction_id AS "factionId",f.name AS "factionName",'+
      'p.created_at AS "createdAt" '+
      'FROM pilot_sessions AS s JOIN pilots AS p ON p.id=s.pilot_id '+
      'JOIN factions AS f ON f.id=p.faction_id '+
      'WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at>NOW()',
      [hashSessionToken(token)]
    );
    return q.rowCount?publicProfile(q.rows[0]):null;
  }

  async requirePilot(token:unknown):Promise<PilotProfile> {
    const pilot=await this.authenticate(token);
    if(!pilot)throw new WorldError('pilot_session_invalid',401);
    return pilot;
  }

  async logout(token:unknown):Promise<boolean> {
    if(!validSession(token))return false;
    const q=await this.pool.query(
      'UPDATE pilot_sessions SET revoked_at=NOW() WHERE token_hash=$1 '+
      'AND revoked_at IS NULL AND expires_at>NOW() RETURNING id',
      [hashSessionToken(token)]
    );
    return (q.rowCount??0)>0;
  }
}
