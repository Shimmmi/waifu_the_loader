/** Пробная ИИ-waifu из консоли: npm run ai-test -w workers -- [редкость] [архетип] */
import { sql } from '../../server/src/db.js';
import { makeAiTest } from './setup.js';

const [rarity, archetype] = process.argv.slice(2);
const r = await makeAiTest((m) => console.log(m))({ rarity, archetype });
console.log(JSON.stringify(r, null, 2));
await sql.end();
process.exit(r.ok ? 0 : 1);
