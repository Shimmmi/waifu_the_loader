import { migrate, sql } from '../db.js';
import { env } from '../env.js';
import { registerGuest } from '../auth.js';
import { tick } from '../actions.js';
import * as meta from '../meta.js';
import { LocalDiskStorage } from '../storage.js';

const ok = (c: unknown, m: string) => {
  console.log(`${c ? '✅' : '❌'} ${m}`);
  if (!c) process.exitCode = 1;
};
console.log('migrations', await migrate());
const storage = new LocalDiskStorage(env.portraitsDir, env.portraitsPublicUrl);
const code = `M5-${Date.now()}`;
await sql`INSERT INTO invite_codes (code, max_uses, note) VALUES (${code}, 1, 'smoke m5')`;
await registerGuest({ inviteCode: code, nickname: `m5${Date.now() % 100000}`, ageConfirmed: true }, storage);
const [{ id: uid } = { id: '' }] = await sql<{ id: string }[]>`SELECT id FROM users WHERE invite_code = ${code}`;
const pools = await sql<{ id: string }[]>`SELECT pool_id AS id FROM waifu_instances WHERE user_id = ${uid}`;

try {
  await sql`UPDATE player_state SET cargo_total = '5000', tokens = 30 WHERE user_id = ${uid}`;
  await tick(uid);
  const [a] = await sql<{ tokens: number }[]>`SELECT tokens FROM player_state WHERE user_id = ${uid}`;
  const [n] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM user_achievements WHERE user_id = ${uid} AND achievement_id = 'hernia'`;
  ok(n?.n === 1 && (a?.tokens ?? 0) >= 35, `грыжа один раз, жетоны ${a?.tokens}`);
  await tick(uid);
  const [b] = await sql<{ tokens: number }[]>`SELECT tokens FROM player_state WHERE user_id = ${uid}`;
  ok(b?.tokens === a?.tokens, 'повторный тик не дублирует награду');

  await meta.buyCosmetic(uid, 'fx_confetti');
  const after = (await sql<{ tokens: number }[]>`SELECT tokens FROM player_state WHERE user_id = ${uid}`)[0]?.tokens;
  let dup = false;
  try {
    await meta.buyCosmetic(uid, 'fx_confetti');
  } catch {
    dup = true;
  }
  const after2 = (await sql<{ tokens: number }[]>`SELECT tokens FROM player_state WHERE user_id = ${uid}`)[0]?.tokens;
  ok(dup && after2 === after, 'повторная покупка не списывает жетоны');

  await sql`INSERT INTO daily_progress (user_id, day, trainings) VALUES (${uid}, (now() AT TIME ZONE 'Europe/Moscow')::date, 1) ON CONFLICT (user_id, day) DO UPDATE SET trainings = 1`;
  await meta.claimQuest(uid, 'train');
  let twice = false;
  try {
    await meta.claimQuest(uid, 'train');
  } catch {
    twice = true;
  }
  ok(twice, 'ежедневка не забирается дважды');
} finally {
  await sql`DELETE FROM waifu_instances WHERE user_id = ${uid}`;
  for (const p of pools) await sql`UPDATE waifu_pool SET status = 'ready', owner_id = NULL, taken_at = NULL WHERE id = ${p.id}`;
  await sql`DELETE FROM users WHERE id = ${uid}`;
  await sql`DELETE FROM invite_codes WHERE code = ${code}`;
  console.log('cleanup');
  await sql.end();
}
