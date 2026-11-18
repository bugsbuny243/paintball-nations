import pg from 'pg';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

export async function migrate(pool:pg.Pool):Promise<void> {
  const sql=await readFile(new URL('../sql/001_world.sql',import.meta.url),'utf8');
  const db=await pool.connect();
  try {
    await db.query('BEGIN');
    await db.query(sql);
    await db.query('COMMIT');
  } catch(error) {
    await db.query('ROLLBACK').catch(()=>{});
    throw error;
  } finally {db.release();}
}

if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL missing');
  const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:3});
  try {
    await migrate(pool);
    console.log('Paintball Nations A1 world database migration complete.');
  } finally {await pool.end();}
}
