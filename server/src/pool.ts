import {
  addStats,
  fatigueNow,
  generateProceduralProfile,
  levelCap,
  xpNeed,
  loadContent,
  loadEconomy,
  validateProfile,
  waifuPower,
  type BuildingLevels,
  type Rarity,
  type StatBonus,
  type Stats,
  type Talent,
  type WaifuDTO,
  type WaifuZone,
  type WaifuProfile,
} from '@wl/shared';
import { sql, type Sql, type Tx } from './db.js';
import { cryptoSeed } from './rng.js';
import type { Storage } from './storage.js';

export interface PoolRow {
  id: string;
  rarity: Rarity;
  archetype: string;
  name: string;
  age: number;
  bio: string;
  quote: string;
  appearance: string;
  stats: Stats;
  talents: Talent[];
  portrait_url: string;
  thumb_url: string;
}

export interface InstanceRow extends PoolRow {
  instance_id: string;
  custom_name: string | null;
  level: number;
  stars: number;
  zone: WaifuZone;
  obtained_at: Date;
  xp: number;
  stat_bonus: StatBonus;
  fatigue: number;
  fatigue_at: Date;
}

export const basePortraitKey = (archetype: string) => `base/${archetype}.webp`;
export const baseThumbKey = (archetype: string) => `base/${archetype}_thumb.webp`;

export function toWaifuDTO(r: InstanceRow, ctx?: { buildings: BuildingLevels; nowMs: number }): WaifuDTO {
  const cfg = loadEconomy();
  const stats = addStats(r.stats, r.stat_bonus);
  const fatigue = ctx ? fatigueNow(r.fatigue, r.fatigue_at.getTime(), ctx.nowMs, ctx.buildings, cfg) : r.fatigue;
  return {
    id: r.instance_id,
    name: r.name,
    customName: r.custom_name,
    age: r.age,
    rarity: r.rarity,
    archetype: r.archetype,
    bio: r.bio,
    quote: r.quote,
    appearance: r.appearance,
    stats,
    baseStats: r.stats,
    statBonus: r.stat_bonus ?? {},
    xp: r.xp,
    xpNeed: r.level >= levelCap(r.stars, cfg) ? 0 : xpNeed(r.level, cfg),
    fatigue: Math.round(fatigue),
    talents: r.talents,
    portraitUrl: r.portrait_url,
    thumbUrl: r.thumb_url,
    level: r.level,
    stars: r.stars,
    zone: r.zone,
    obtainedAt: r.obtained_at.toISOString(),
    power: waifuPower({ ...r, stats }, cfg),
  };
}

/** DTO для waifu из пула, которую игрок не получил (дубликат → осколки). */
export function poolToPreviewDTO(r: PoolRow): WaifuDTO {
  return toWaifuDTO({ ...r, instance_id: r.id, custom_name: null, level: 1, stars: 0, zone: null, obtained_at: new Date(), xp: 0, stat_bonus: {}, fatigue: 0, fatigue_at: new Date() });
}

export async function insertPoolRow(
  db: Sql | Tx,
  p: WaifuProfile,
  opts: { portraitUrl: string; thumbUrl: string; seed: number; source: string; reserveId?: string },
): Promise<PoolRow> {
  const [row] = await db<PoolRow[]>`
    INSERT INTO waifu_pool (rarity, archetype, name, age, bio, quote, appearance, stats, talents, portrait_url, thumb_url, seed, source, status, reserve_id)
    VALUES (${p.rarity}, ${p.archetype}, ${p.name}, ${p.age}, ${p.bio}, ${p.quote}, ${p.appearance},
            ${db.json(p.stats as never)}, ${db.json(p.talents as never)}, ${opts.portraitUrl}, ${opts.thumbUrl},
            ${opts.seed}, ${opts.source}, 'ready', ${opts.reserveId ?? null})
    ON CONFLICT (reserve_id) DO NOTHING
    RETURNING id, rarity, archetype, name, age, bio, quote, appearance, stats, talents, portrait_url, thumb_url`;
  if (!row) throw new Error('pool insert conflict');
  return row;
}

/** Кладёт 10 заготовленных вручную waifu в пул (один раз) и копирует базовые портреты в Storage. */
export async function seedReserve(storage: Storage, assetsDir: string): Promise<number> {
  const { readFile } = await import('node:fs/promises');
  const { resolve } = await import('node:path');
  const content = loadContent();
  const cfg = loadEconomy();
  for (const a of content.archetypes) {
    for (const [key, file] of [
      [basePortraitKey(a.id), `${a.id}.webp`],
      [baseThumbKey(a.id), `${a.id}_thumb.webp`],
    ] as const) {
      if (await storage.exists(key)) continue;
      try {
        await storage.put(key, await readFile(resolve(assetsDir, file)), 'image/webp');
      } catch {
        // портрета нет — клиент покажет заглушку архетипа
      }
    }
  }
  let added = 0;
  for (const w of content.reserve) {
    const errs = validateProfile(w, cfg);
    if (errs.length) throw new Error(`reserve ${w.id} invalid: ${errs.join('; ')}`);
    const exists = await sql`SELECT 1 FROM waifu_pool WHERE reserve_id = ${w.id}`;
    if (exists.length) continue;
    await insertPoolRow(sql, w, {
      portraitUrl: storage.publicUrl(basePortraitKey(w.archetype)),
      thumbUrl: storage.publicUrl(baseThumbKey(w.archetype)),
      seed: 0,
      source: 'reserve',
      reserveId: w.id,
    });
    added++;
  }
  return added;
}

/**
 * Берёт готовую waifu из пула. При пустом пуле — fallback: процедурный профиль
 * с базовым портретом архетипа (ТЗ 10.2), чтобы призыв никогда не падал.
 */
export async function pickFromPool(tx: Tx, rarity: Rarity, archetype: string | null, storage: Storage): Promise<PoolRow> {
  const rows = archetype
    ? await tx<PoolRow[]>`
        SELECT id, rarity, archetype, name, age, bio, quote, appearance, stats, talents, portrait_url, thumb_url
        FROM waifu_pool WHERE status = 'ready' AND rarity = ${rarity} AND archetype = ${archetype}
        ORDER BY (source = 'ai') DESC, random() LIMIT 1 FOR UPDATE SKIP LOCKED`
    : await tx<PoolRow[]>`
        SELECT id, rarity, archetype, name, age, bio, quote, appearance, stats, talents, portrait_url, thumb_url
        FROM waifu_pool WHERE status = 'ready' AND rarity = ${rarity}
        ORDER BY (source = 'ai') DESC, random() LIMIT 1 FOR UPDATE SKIP LOCKED`;
  if (rows[0]) return rows[0];

  const cfg = loadEconomy();
  const content = loadContent();
  for (let attempt = 0; attempt < 3; attempt++) {
    const seed = cryptoSeed();
    const p = generateProceduralProfile({ rarity, archetype: archetype ?? undefined, seed }, content, cfg);
    if (validateProfile(p, cfg).length) continue;
    return insertPoolRow(tx, p, {
      portraitUrl: storage.publicUrl(basePortraitKey(p.archetype)),
      thumbUrl: storage.publicUrl(baseThumbKey(p.archetype)),
      seed,
      source: 'fallback',
    });
  }
  throw new Error('fallback generation failed');
}

export async function takePoolRow(tx: Tx, poolId: string, userId: string): Promise<void> {
  await tx`UPDATE waifu_pool SET status = 'taken', owner_id = ${userId}, taken_at = now() WHERE id = ${poolId}`;
}

export const INSTANCE_SELECT = `
  i.id AS instance_id, i.custom_name, i.level, i.stars, i.zone, i.obtained_at, i.xp, i.stat_bonus, i.fatigue, i.fatigue_at,
  p.id, p.rarity, p.archetype, p.name, p.age, p.bio, p.quote, p.appearance, p.stats, p.talents, p.portrait_url, p.thumb_url`;

export async function grantWaifu(tx: Tx, userId: string, pool: PoolRow, zone: 'warehouse' | null = null): Promise<InstanceRow> {
  await takePoolRow(tx, pool.id, userId);
  const [inst] = await tx<{ id: string; obtained_at: Date }[]>`
    INSERT INTO waifu_instances (user_id, pool_id, rarity, archetype, zone)
    VALUES (${userId}, ${pool.id}, ${pool.rarity}, ${pool.archetype}, ${zone})
    RETURNING id, obtained_at`;
  if (!inst) throw new Error('instance insert failed');
  return { ...pool, instance_id: inst.id, custom_name: null, level: 1, stars: 0, zone, obtained_at: inst.obtained_at, xp: 0, stat_bonus: {}, fatigue: 0, fatigue_at: inst.obtained_at };
}

export async function poolStats(): Promise<Record<string, number>> {
  const rows = await sql<{ rarity: string; n: number }[]>`
    SELECT rarity, count(*)::int AS n FROM waifu_pool WHERE status = 'ready' GROUP BY rarity`;
  return Object.fromEntries(rows.map((r) => [r.rarity, r.n]));
}
