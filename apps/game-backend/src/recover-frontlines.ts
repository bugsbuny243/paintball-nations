/** C5.1 operator-only recovery of expired server match leases.
 * It never accepts client input and never awards territory.
 * Run after migrations, with a trusted DATABASE_URL. Public HTTP is disabled.
 */
import pg from 'pg';
import {pathToFileURL} from 'node:url';
import {FrontlineStore} from './frontline-store.ts';

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(process.env.NODE_ENV==='production')
    throw new Error('C5 recovery requires audited production operations before rollout');
  if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL required');
  if(process.env.DEV_FRONTLINE_RECOVERY_APPROVED!=='1')
    throw new Error('Set DEV_FRONTLINE_RECOVERY_APPROVED=1 for explicit operator recovery');
  const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:3});
  try{
    const recovered=await new FrontlineStore(pool).recoverExpired(100);
    console.log(JSON.stringify({operation:'recover_expired_frontlines',
      recoveredCount:recovered.length,recovered}));
  }finally{
    await pool.end();
  }
}
