/** Shared lazy PostgreSQL connection used by local Colyseus pilot admission.
 * No database connection is opened for the existing guest-only browser preview.
 */
import pg from 'pg';
import {PilotStore} from '../pilot-store.ts';

let pool:pg.Pool|null=null;
let store:PilotStore|null=null;

export function developmentPilotStore():PilotStore|null{
  if(!process.env.DATABASE_URL)return null;
  if(!store){
    pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:6});
    store=new PilotStore(pool);
  }
  return store;
}
export async function closeDevelopmentPilotStore():Promise<void>{
  const previous=pool;
  pool=null;store=null;
  if(previous)await previous.end();
}
