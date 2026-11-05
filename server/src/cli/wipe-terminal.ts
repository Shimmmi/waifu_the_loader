/**
 * Одноразовый вайп в день включения терминала.
 * Не вызывается при старте сервера. Повторный запуск ничего не стирает.
 *
 * Сначала бэкап Postgres. Потом:
 *   TERMINAL_WIPE=yes TERMINAL_BACKUP_DONE=yes npm run wipe:terminal
 */
import { addStats, jobFromStats, loadEconomy, STARTER_SECTORS, type Stats } from '@wl/shared';
import { migrate, sql } from '../db.js';
import { env } from '../env.js';
import { grantWaifu, pickFromPool } from '../pool.js';
import { LocalDiskStorage } from '../storage.js';

if (process.env.TERMINAL_WIPE !== 'yes' || process.env.TERMINAL_BACKUP_DONE !== 'yes') {
  console.error('Отказ. Это вайп прогресса склада в день релиза, не команда для обычного запуска.');
  console.error('Сначала снимите бэкап контейнера postgres (pg_dump). Коллекция и портреты скриптом не удаляются.');
  console.error('Запуск после бэкапа: TERMINAL_WIPE=yes TERMINAL_BACKUP_DONE=yes npm run wipe:terminal');
  process.exit(1);
}

await migrate();

const [flag] = await sql<{ value: { live?: boolean } }[]>`SELECT value FROM app_flags WHERE key = 'terminal'`;
if (flag?.value?.live) {
  console.log('Терминал уже включён. Повторный вайп не выполняется.');
  await sql.end();
  process.exit(0);
}

const cfg = loadEconomy();
const storage = new LocalDiskStorage(env.portraitsDir, env.portraitsPublicUrl);
const archetype = cfg.start.starter_reserve_id.replace(/^reserve_/, '');

const [beforeRow] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM waifu_instances`;
const before = beforeRow?.n ?? 0;

await sql.begin(async (tx) => {
  await tx`DELETE FROM training_jobs`;
  await tx`DELETE FROM contracts`;
  await tx`DELETE FROM warehouse_state`;
  const users = await tx<{ id: string }[]>`SELECT id FROM users`;
  for (const user of users) {
    await tx`
      UPDATE player_state SET cargo = '0', cargo_total = '0', coins = ${String(cfg.start.coins)}, protein = '0',
        tickets = ${cfg.start.tickets}, seals = '0', cargo_milestone = 0, last_tick_at = now()
      WHERE user_id = ${user.id}`;
    for (const b of cfg.buildings) {
      await tx`UPDATE buildings_state SET level = ${b.start_level} WHERE user_id = ${user.id} AND building_id = ${b.id}`;
    }
    await tx`
      UPDATE prestige_state SET prestiges = 0, seals_earned = 0, upgrades = '{}'::jsonb, auto = '{}'::jsonb
      WHERE user_id = ${user.id}`;
    const owned = await tx<{ id: string; stats: Record<string, number>; stat_bonus: Record<string, number> }[]>`
      SELECT i.id, p.stats, i.stat_bonus FROM waifu_instances i JOIN waifu_pool p ON p.id = i.pool_id WHERE i.user_id = ${user.id}`;
    for (const row of owned) {
      const job = jobFromStats(addStats(row.stats as Stats, row.stat_bonus ?? {}));
      await tx`UPDATE waifu_instances SET zone = NULL, station = NULL, current_class = ${job} WHERE id = ${row.id}`;
    }
    if (owned.length === 0) {
      const pool = await pickFromPool(tx, 'N', archetype, storage);
      const inst = await grantWaifu(tx, user.id, pool, 'warehouse');
      await tx`UPDATE waifu_instances SET station = 'unload', current_class = 'loader' WHERE id = ${inst.instance_id}`;
    }
    await tx`DELETE FROM terminal_sectors WHERE user_id = ${user.id}`;
    await tx`DELETE FROM terminal_state WHERE user_id = ${user.id}`;
    for (const sector of STARTER_SECTORS) {
      await tx`INSERT INTO terminal_sectors (user_id, sector) VALUES (${user.id}, ${sector})`;
    }
    await tx`INSERT INTO terminal_state (user_id, seen_intro) VALUES (${user.id}, false)`;
  }
  await tx`
    INSERT INTO app_flags (key, value) VALUES ('terminal', ${tx.json({ live: true })})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
});

const [afterRow] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM waifu_instances`;
console.log(`Терминал включён. Карточек было ${before}, стало ${afterRow?.n ?? before}. Портреты не трогались. Старый расчёт груза больше не кормит монеты.`);
await sql.end();
