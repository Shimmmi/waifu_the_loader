import { sql } from '../../server/src/db.js';
import { makeRefill } from './setup.js';

const r = await makeRefill((m) => console.log(m))();
console.log(JSON.stringify(r, null, 2));
await sql.end();
