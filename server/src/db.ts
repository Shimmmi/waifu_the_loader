import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postgres from 'postgres';
import { loadEconomy, loadGacha } from '@wl/shared';
import { env } from './env.js';

export const sql = postgres(env.databaseUrl, {
  max: 10,
  idle_timeout: 30,
  onnotice: () => {},
  transform: { undefined: null },
});

export type Sql = typeof sql;
export type Tx = postgres.TransactionSql;

export async function migrate(dir = resolve(process.cwd(), 'migrations')): Promise<string[]> {
  await sql`CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`;
  const done = new Set((await sql<{ name: string }[]>`SELECT name FROM schema_migrations`).map((r) => r.name));
  const applied: string[] = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
    if (done.has(f)) continue;
    const body = readFileSync(resolve(dir, f), 'utf8');
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`INSERT INTO schema_migrations (name) VALUES (${f})`;
    });
    applied.push(f);
  }
  return applied;
}

/** Фиксируем версию конфигов баланса (ТЗ 14: config_versions). */
export async function registerConfigVersion(): Promise<string> {
  const economy = loadEconomy();
  const gacha = loadGacha();
  const content = { economy, gacha };
  const json = JSON.stringify(content);
  const hash = createHash('sha256').update(json).digest('hex').slice(0, 16);
  const version = `${economy.version}+${gacha.version}+${hash}`;
  await sql`INSERT INTO config_versions (version, hash, content) VALUES (${version}, ${hash}, ${sql.json(content as never)}) ON CONFLICT DO NOTHING`;
  for (const b of gacha.banners) {
    await sql`
      INSERT INTO banners (id, type, config, starts_at, ends_at)
      VALUES (${b.id}, ${b.type}, ${sql.json(b as never)}, ${b.starts_at}, ${b.ends_at})
      ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, config = EXCLUDED.config, starts_at = EXCLUDED.starts_at, ends_at = EXCLUDED.ends_at`;
  }
  return version;
}
