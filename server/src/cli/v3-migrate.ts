import { migrate, sql } from '../db.js';
import { migrateVeterans } from '../v3.js';

if (process.env.V3_BACKUP_DONE !== 'yes') {
  console.error('Сначала снимите бэкап Postgres. Потом: V3_BACKUP_DONE=yes npm run v3:migrate -w server');
  process.exit(1);
}

await migrate();
const n = await migrateVeterans(sql, process.argv[2]);
console.log(`мигрировано аккаунтов: ${n}`);
await sql.end();
