import sharp from 'sharp';
import { pickLook, type Archetype, type Content, type Look, type ModerationVerdict, type Rarity, type WaifuProfile } from '@wl/shared';
import { attachLogsToPool, BudgetExceededError } from '../../server/src/ai-store.js';
import { sql } from '../../server/src/db.js';
import { cryptoSeed } from '../../server/src/rng.js';
import type { Storage } from '../../server/src/storage.js';
import { ProfileValidationError, type GenContext, type RouterAiProvider } from './routerai.js';

export interface AiWaifuResult {
  ok: boolean;
  stage: 'profile' | 'image' | 'moderation' | 'done';
  error?: string;
  profile?: WaifuProfile;
  imagePrompt?: string;
  portraitUrl?: string;
  thumbUrl?: string;
  verdict?: ModerationVerdict;
  reasons?: string[];
  moderation?: unknown;
  poolId?: string;
  costRub: number;
  durationMs: number;
  models: { text?: string; image?: string; moderation?: string };
  attempts?: number;
  validationErrors?: string[];
  budgetExceeded?: boolean;
  look?: Look;
  seed?: number;
}

/** Постобработка (ТЗ 10.1 п.5): обрезка до 3:4, WebP 768×1024 и миниатюра 240×320. */
export async function postprocess(raw: Buffer): Promise<{ image: Buffer; thumb: Buffer }> {
  const image = await sharp(raw).resize(768, 1024, { fit: 'cover', position: 'attention' }).webp({ quality: 82 }).toBuffer();
  const thumb = await sharp(image).resize(240, 320, { fit: 'cover' }).webp({ quality: 72 }).toBuffer();
  return { image, thumb };
}

export async function takenAiNames(): Promise<Set<string>> {
  const rows = await sql<{ name: string }[]>`SELECT lower(name) AS name FROM waifu_pool WHERE source = 'ai' AND status <> 'rejected'`;
  return new Set(rows.map((r) => r.name));
}

/** Сколько раз каждая тема образа уже есть среди ИИ-waifu этой редкости. */
export async function themeUsage(rarity: Rarity): Promise<Record<string, number>> {
  const rows = await sql<{ theme: string; n: number }[]>`
    SELECT gen_meta->'look'->>'theme' AS theme, count(*)::int AS n FROM waifu_pool
    WHERE source = 'ai' AND rarity = ${rarity} AND status <> 'rejected' AND gen_meta->'look' IS NOT NULL GROUP BY 1`;
  return Object.fromEntries(rows.map((r) => [r.theme, r.n]));
}

/** Архетип, которого среди готовых ИИ-waifu этой редкости меньше всего, — для разнообразия пула. */
export async function leastUsedArchetype(content: Content, rarity: Rarity): Promise<Archetype> {
  const rows = await sql<{ archetype: string; n: number }[]>`
    SELECT archetype, count(*)::int AS n FROM waifu_pool WHERE source = 'ai' AND rarity = ${rarity} AND status IN ('ready', 'review') GROUP BY archetype`;
  const counts = new Map(rows.map((r) => [r.archetype, r.n]));
  const min = Math.min(...content.archetypes.map((a) => counts.get(a.id) ?? 0));
  const candidates = content.archetypes.filter((a) => (counts.get(a.id) ?? 0) === min);
  return candidates[Math.floor(Math.random() * candidates.length)]!;
}

export async function generateAiWaifu(opts: {
  provider: RouterAiProvider;
  storage: Storage;
  content: Content;
  rarity: Rarity;
  archetype?: Archetype;
  purpose: 'pool' | 'test';
  takenNames: Set<string>;
  log?: (m: string) => void;
}): Promise<AiWaifuResult> {
  const t0 = Date.now();
  const seed = cryptoSeed();
  const ctx: GenContext = { purpose: opts.purpose, rarity: opts.rarity, logIds: [], log: opts.log };
  const res: AiWaifuResult = { ok: false, stage: 'profile', costRub: 0, durationMs: 0, models: {}, seed };
  const archetype = opts.archetype ?? (await leastUsedArchetype(opts.content, opts.rarity));
  const s = opts.provider.settings.image;
  const look = pickLook({ themes: s.themes, poses: s.poses, shots: s.shots }, opts.rarity, seed, await themeUsage(opts.rarity));
  res.look = look;
  const done = (r: Partial<AiWaifuResult>): AiWaifuResult => Object.assign(res, r, { durationMs: Date.now() - t0 });

  try {
    const p = await opts.provider.generateProfile({ rarity: opts.rarity, archetype, seed, takenNames: opts.takenNames, look }, ctx);
    Object.assign(res, { profile: p.profile, imagePrompt: p.imagePrompt, attempts: p.attempts, validationErrors: p.errors, costRub: p.costRub, models: { text: p.model } });

    res.stage = 'image';
    const img = await opts.provider.generatePortrait({ rarity: opts.rarity, imagePrompt: p.imagePrompt, seed, look }, ctx);
    res.costRub += img.costRub;
    res.models.image = img.model;
    const { image, thumb } = await postprocess(img.value);

    res.stage = 'moderation';
    const mod = await opts.provider.moderate(p.profile, image, ctx);
    res.costRub += mod.costRub;
    res.models.moderation = mod.model;
    Object.assign(res, { verdict: mod.verdict, reasons: mod.reasons, moderation: mod.result });

    // Брак храним отдельно: для разбора, но не раздаём
    const dir = opts.purpose === 'test' ? 'test' : mod.verdict === 'rejected' ? 'rejected' : `ai/${opts.rarity}`;
    const key = `${dir}/${seed}`;
    res.portraitUrl = await opts.storage.put(`${key}.webp`, image, 'image/webp');
    res.thumbUrl = await opts.storage.put(`${key}_thumb.webp`, thumb, 'image/webp');

    if (opts.purpose === 'pool') {
      const meta = { look, models: res.models, attempts: p.attempts, validation_errors: p.errors, repaired_stats: p.repairedStats, image_prompt_full: img.prompt, duration_ms: Date.now() - t0 };
      const pr = p.profile;
      const [row] = await sql<{ id: string }[]>`
        INSERT INTO waifu_pool (rarity, archetype, name, age, bio, quote, appearance, stats, talents, portrait_url, thumb_url, seed, source, status,
                                image_prompt, moderation, gen_cost_rub, gen_meta)
        VALUES (${pr.rarity}, ${pr.archetype}, ${pr.name}, ${pr.age}, ${pr.bio}, ${pr.quote}, ${pr.appearance},
                ${sql.json(pr.stats as never)}, ${sql.json(pr.talents as never)}, ${res.portraitUrl}, ${res.thumbUrl}, ${seed}, 'ai', ${mod.verdict},
                ${p.imagePrompt}, ${sql.json({ ...(mod.result ?? {}), verdict: mod.verdict, reasons: mod.reasons } as never)}, ${res.costRub}, ${sql.json(meta as never)})
        RETURNING id`;
      res.poolId = row!.id;
      await attachLogsToPool(ctx.logIds, res.poolId);
      opts.takenNames.add(pr.name.toLowerCase());
    }
    return done({ ok: true, stage: 'done' });
  } catch (e) {
    if (e instanceof ProfileValidationError) return done({ error: e.message, validationErrors: e.errors, costRub: res.costRub + e.costRub });
    return done({ error: (e as Error).message, budgetExceeded: e instanceof BudgetExceededError });
  }
}
