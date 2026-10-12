import { migrate, registerConfigVersion, sql } from '../db.js';

const applied = await migrate();
const version = await registerConfigVersion();
console.log(applied.length ? `Применены миграции: ${applied.join(', ')}` : 'Миграции актуальны', `\nКонфиг: ${version}`);
await sql.end();
