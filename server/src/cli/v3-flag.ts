import { sql } from '../db.js';

const on = process.argv[2] !== 'off';
await sql`
  INSERT INTO app_flags (key, value) VALUES ('v3', ${sql.json({ live: on })})
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
console.log(on ? 'v3 включён' : 'v3 выключен');
await sql.end();
