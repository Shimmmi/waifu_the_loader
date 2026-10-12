import { RARITIES, validateProfile, type EconomyConfig, type Rarity } from '@wl/shared';
import { sql } from '../../server/src/db.js';
import { insertPoolRow } from '../../server/src/pool.js';
import { cryptoSeed } from '../../server/src/rng.js';
import type { Storage } from '../../server/src/storage.js';
import type { ImageProvider, TextProvider } from './providers.js';

export interface RefillReport {
  created: Record<Rarity, number>;
  rejected: number;
  ready: Record<string, number>;
}

/**
 * Процедурное пополнение пула. Для редкостей, которые делает ИИ, держим только запас (procedural_reserve)
 * на случай остановки ИИ; для остальных — полный буфер target (ТЗ 10.2). Не больше batch за прогон на редкость.
 */
export async function refillPool(opts: {
  text: TextProvider;
  image: ImageProvider;
  storage: Storage;
  cfg: EconomyConfig;
  target: number;
  batch: number;
  ai?: { rarities: Rarity[]; reserve: number };
  log?: (msg: string) => void;
}): Promise<RefillReport> {
  const log = opts.log ?? (() => {});
  const created = { N: 0, R: 0, SR: 0, SSR: 0, UR: 0 } as Record<Rarity, number>;
  let rejected = 0;
  const counts = await sql<{ rarity: string; n: number }[]>`
    SELECT rarity, count(*)::int AS n FROM waifu_pool WHERE status = 'ready' AND source <> 'ai' GROUP BY rarity`;
  const ready: Record<string, number> = Object.fromEntries(counts.map((c) => [c.rarity, c.n]));

  for (const rarity of RARITIES) {
    const target = opts.ai?.rarities.includes(rarity) ? opts.ai.reserve : opts.target;
    const need = Math.min(opts.batch, target - (ready[rarity] ?? 0));
    for (let i = 0; i < need; i++) {
      // Валидация с повтором до 3 попыток (ТЗ 10.1 п.2)
      for (let attempt = 0; attempt < 3; attempt++) {
        const seed = cryptoSeed();
        const t0 = Date.now();
        try {
          const profile = await opts.text.generateProfile({ rarity, seed });
          const errs = validateProfile(profile, opts.cfg);
          if (errs.length) {
            rejected++;
            log(`reject ${rarity}: ${errs.join('; ')}`);
            continue;
          }
          const img = await opts.image.generatePortrait({ profile, seed });
          const key = `gen/${rarity}/${seed}`;
          const portraitUrl = await opts.storage.put(`${key}.webp`, img.image, img.contentType);
          const thumbUrl = await opts.storage.put(`${key}_thumb.webp`, img.thumb, img.contentType);
          await insertPoolRow(sql, profile, { portraitUrl, thumbUrl, seed, source: 'procedural' });
          created[rarity]++;
          log(`+${rarity} ${profile.name} (${Date.now() - t0} ms)`);
          break;
        } catch (e) {
          rejected++;
          log(`error ${rarity}: ${(e as Error).message}`);
        }
      }
    }
    ready[rarity] = (ready[rarity] ?? 0) + created[rarity];
  }
  return { created, rejected, ready };
}
