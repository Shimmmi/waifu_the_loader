/**
 * Инвайт-коды для своих.
 *   npm run invite -- create [uses=1] [note]   — создать код
 *   npm run invite -- list                      — список
 *   npm run invite -- admin <nickname>          — выдать права админа
 */
import { randomBytes } from 'node:crypto';
import { migrate, sql } from '../db.js';

const [cmd = 'list', ...args] = process.argv.slice(2);
await migrate();

if (cmd === 'create') {
  const uses = Number(args[0] ?? 1);
  const note = args.slice(1).join(' ');
  const code = 'GRUZ-' + randomBytes(4).toString('hex').toUpperCase();
  await sql`INSERT INTO invite_codes (code, max_uses, note) VALUES (${code}, ${uses}, ${note})`;
  console.log(`Инвайт: ${code} (использований: ${uses})`);
} else if (cmd === 'list') {
  const rows = await sql`SELECT code, uses, max_uses, note, created_at FROM invite_codes ORDER BY created_at DESC`;
  console.table(rows);
} else if (cmd === 'admin') {
  const r = await sql`UPDATE users SET is_admin = true WHERE nickname = ${args.join(' ')} RETURNING id`;
  console.log(r.length ? 'Готово' : 'Игрок не найден');
} else {
  console.log('Команды: create [uses] [note] | list | admin <nickname>');
}
await sql.end();
