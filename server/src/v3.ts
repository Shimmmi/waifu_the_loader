import { randomInt, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { v3, type Game, type Template } from '@wl/shared';
import type { Sql, Tx } from './db.js';
import { getAiSettings } from './ai-store.js';
import { env } from './env.js';
import { GameError } from './player.js';

const rng = () => randomInt(0, 1_000_000_000) / 1_000_000_000;
const ids = () => randomUUID();

function moscowDay(now: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow' }).format(now);
}

function manifestPath(): string | null {
  for (const p of [
    resolve(process.cwd(), 'client/public/assets/templates/manifest.json'),
    resolve(process.cwd(), '../client/public/assets/templates/manifest.json'),
    resolve(process.cwd(), '../client/dist/assets/templates/manifest.json'),
  ]) {
    if (existsSync(p)) return p;
  }
  return null;
}

export async function seedV3Templates(db: Sql): Promise<number> {
  const path = manifestPath();
  if (!path) return 0;
  const rows = JSON.parse(readFileSync(path, 'utf8')) as {
    template_id: string;
    race: string;
    class: string;
    first_name: string;
    last_name: string;
    look_tags: string[];
    portrait: string;
    thumb: string;
    status: string;
    pack_version: number;
    phash: string;
  }[];
  let n = 0;
  for (const r of rows) {
    await db`
      INSERT INTO character_templates (template_id, race, class, first_name, last_name, look_tags, portrait, thumb, status, pack_version, phash)
      VALUES (${r.template_id}, ${r.race}, ${r.class}, ${r.first_name}, ${r.last_name}, ${db.json(r.look_tags)}, ${r.portrait}, ${r.thumb}, ${r.status}, ${r.pack_version}, ${r.phash})
      ON CONFLICT (template_id) DO NOTHING`;
    n += 1;
  }
  return n;
}

async function templatesOf(db: Tx | Sql): Promise<Template[]> {
  const rows = await db<{ template_id: string; race: string; class: string; first_name: string; last_name: string; portrait: string; thumb: string }[]>`
    SELECT template_id, race, class, first_name, last_name, portrait, thumb
    FROM character_templates WHERE status = 'approved'`;
  return rows.map((r) => ({
    templateId: r.template_id,
    race: r.race,
    job: r.class,
    firstName: r.first_name,
    lastName: r.last_name,
    portrait: r.portrait,
    thumb: r.thumb,
  }));
}

function catalog(list: Template[]) {
  return v3.withTemplates(v3.loadV3(), list);
}

async function readGame(db: Tx, userId: string): Promise<Game | null> {
  const [meta] = await db<{
    legacy: number; stars: number; rebirths: number; meta: Record<string, number>; flags: Record<string, number>;
    tons_total: number; last_daily: string;
  }[]>`SELECT legacy, stars, rebirths, meta, flags, tons_total, last_daily FROM meta_state WHERE user_id = ${userId}`;
  if (!meta) return null;
  const [run] = await db<{
    credits: number; tons_run: number; pity: Game['pity']; expansions: number; card_dry: number;
    free_rerolls_used: number; offer_rerolls: number; base_rerolls: number; last_tick: Date; spent: number;
    last_expand_cost: number; counters: Record<string, number>; pending_free: number; company: string;
    motion: boolean; offline: Game['offline']; offers: Game['offers']; active: Game['active'];
  }[]>`SELECT * FROM run_state WHERE user_id = ${userId}`;
  const [story] = await db<{ seen: string[]; queue: Game['queue']; journal: Game['journal'] }[]>`
    SELECT seen, queue, journal FROM story_state WHERE user_id = ${userId}`;
  const [cards] = await db<{ cards: Game['runCards']; pending: unknown; pending_bases: string[] | null }[]>`
    SELECT cards, pending, pending_bases FROM run_cards WHERE user_id = ${userId}`;
  const [base] = await db<{ base_template_id: string; layout_type: 'shaft' | 'panorama'; plots: Game['base']['floors']; plot_cap: number | null }[]>`
    SELECT base_template_id, layout_type, plots, plot_cap FROM player_base WHERE user_id = ${userId}`;
  const chars = await db<{
    id: string; template_id: string | null; legacy_portrait: boolean; race: string; class: string; rarity: Game['characters'][number]['rarity'];
    first_name: string; last_name: string; nickname: string; bio: string; quote: string; traits: string[];
    level: number; xp: number; star_rank: number; portrait: string; thumb: string; in_reserve: boolean;
  }[]>`SELECT * FROM characters WHERE user_id = ${userId} ORDER BY first_name`;
  if (!run || !story || !cards || !base) return null;
  return {
    credits: Number(run.credits),
    stars: meta.stars,
    legacy: meta.legacy,
    tonsTotal: Number(meta.tons_total),
    tonsRun: Number(run.tons_run),
    pity: run.pity,
    rebirths: meta.rebirths,
    expansions: run.expansions,
    cardDry: run.card_dry,
    freeRerollsUsed: run.free_rerolls_used,
    offerRerolls: run.offer_rerolls,
    baseRerolls: run.base_rerolls,
    lastTick: new Date(run.last_tick).getTime(),
    flags: meta.flags ?? {},
    counters: run.counters ?? {},
    seen: story.seen ?? [],
    queue: story.queue ?? [],
    journal: story.journal ?? [],
    pendingCards: Array.isArray(cards.pending) ? (cards.pending as string[]) : ((cards.pending as { ids?: string[] | null } | null)?.ids ?? null),
    pendingPlotId: Array.isArray(cards.pending) ? null : ((cards.pending as { plotId?: string | null } | null)?.plotId ?? null),
    pendingBases: cards.pending_bases,
    runCards: cards.cards ?? [],
    base: { templateId: base.base_template_id, layout: base.layout_type, floors: base.plots, plotCap: base.plot_cap },
    spent: Number(run.spent),
    lastExpandCost: Number(run.last_expand_cost),
    characters: chars.map((c) => ({
      id: c.id,
      templateId: c.template_id,
      legacy: c.legacy_portrait,
      race: c.race,
      job: c.class,
      rarity: c.rarity,
      firstName: c.first_name,
      lastName: c.last_name,
      nickname: c.nickname,
      bio: c.bio,
      quote: c.quote,
      traits: c.traits ?? [],
      level: c.level,
      xp: Number(c.xp),
      starRank: c.star_rank,
      portrait: c.portrait,
      thumb: c.thumb,
      reserve: c.in_reserve,
    })),
    offers: run.offers ?? [],
    active: run.active ?? [],
    company: run.company,
    motion: run.motion,
    pendingFreeRolls: run.pending_free,
    lastDaily: meta.last_daily,
    offline: run.offline,
    metaLevel: meta.meta ?? {},
  };
}

async function saveGame(db: Tx, userId: string, g: Game): Promise<void> {
  await db`
    INSERT INTO meta_state (user_id, legacy, stars, rebirths, meta, flags, tons_total, last_daily)
    VALUES (${userId}, ${g.legacy}, ${g.stars}, ${g.rebirths}, ${db.json(g.metaLevel)}, ${db.json(g.flags)}, ${g.tonsTotal}, ${g.lastDaily})
    ON CONFLICT (user_id) DO UPDATE SET
      legacy = EXCLUDED.legacy, stars = EXCLUDED.stars, rebirths = EXCLUDED.rebirths, meta = EXCLUDED.meta,
      flags = EXCLUDED.flags, tons_total = EXCLUDED.tons_total, last_daily = EXCLUDED.last_daily`;
  await db`
    INSERT INTO run_state (user_id, credits, tons_run, pity, expansions, card_dry, free_rerolls_used, offer_rerolls, base_rerolls, last_tick, spent, last_expand_cost, counters, pending_free, company, motion, offline, offers, active)
    VALUES (${userId}, ${g.credits}, ${g.tonsRun}, ${db.json(g.pity)}, ${g.expansions}, ${g.cardDry}, ${g.freeRerollsUsed}, ${g.offerRerolls}, ${g.baseRerolls}, ${new Date(g.lastTick)}, ${g.spent}, ${g.lastExpandCost}, ${db.json(g.counters)}, ${g.pendingFreeRolls}, ${g.company}, ${g.motion}, ${db.json(g.offline as never)}, ${db.json(g.offers as never)}, ${db.json(g.active as never)})
    ON CONFLICT (user_id) DO UPDATE SET
      credits = EXCLUDED.credits, tons_run = EXCLUDED.tons_run, pity = EXCLUDED.pity, expansions = EXCLUDED.expansions,
      card_dry = EXCLUDED.card_dry, free_rerolls_used = EXCLUDED.free_rerolls_used, offer_rerolls = EXCLUDED.offer_rerolls,
      base_rerolls = EXCLUDED.base_rerolls, last_tick = EXCLUDED.last_tick, spent = EXCLUDED.spent,
      last_expand_cost = EXCLUDED.last_expand_cost, counters = EXCLUDED.counters, pending_free = EXCLUDED.pending_free,
      company = EXCLUDED.company, motion = EXCLUDED.motion, offline = EXCLUDED.offline, offers = EXCLUDED.offers, active = EXCLUDED.active`;
  await db`
    INSERT INTO story_state (user_id, seen, queue, journal)
    VALUES (${userId}, ${db.json(g.seen)}, ${db.json(g.queue)}, ${db.json(g.journal)})
    ON CONFLICT (user_id) DO UPDATE SET seen = EXCLUDED.seen, queue = EXCLUDED.queue, journal = EXCLUDED.journal`;
  await db`
    INSERT INTO run_cards (user_id, cards, pending, pending_bases)
    VALUES (${userId}, ${db.json(g.runCards)}, ${db.json({ ids: g.pendingCards, plotId: g.pendingPlotId } as never)}, ${db.json(g.pendingBases)})
    ON CONFLICT (user_id) DO UPDATE SET cards = EXCLUDED.cards, pending = EXCLUDED.pending, pending_bases = EXCLUDED.pending_bases`;
  await db`
    INSERT INTO player_base (user_id, base_template_id, layout_type, plots, plot_cap)
    VALUES (${userId}, ${g.base.templateId}, ${g.base.layout}, ${db.json(g.base.floors as never)}, ${g.base.plotCap})
    ON CONFLICT (user_id) DO UPDATE SET base_template_id = EXCLUDED.base_template_id, layout_type = EXCLUDED.layout_type, plots = EXCLUDED.plots, plot_cap = EXCLUDED.plot_cap`;
  await db`DELETE FROM characters WHERE user_id = ${userId}`;
  for (const c of g.characters) {
    await db`
      INSERT INTO characters (id, user_id, template_id, legacy_portrait, race, class, rarity, first_name, last_name, nickname, bio, quote, traits, level, xp, star_rank, portrait, thumb, in_reserve)
      VALUES (${c.id}, ${userId}, ${c.templateId}, ${c.legacy}, ${c.race}, ${c.job}, ${c.rarity}, ${c.firstName}, ${c.lastName}, ${c.nickname}, ${c.bio}, ${c.quote}, ${db.json(c.traits)}, ${c.level}, ${c.xp}, ${c.starRank}, ${c.portrait}, ${c.thumb}, ${c.reserve})`;
  }
}

async function live(db: Tx | Sql): Promise<boolean> {
  const [row] = await db<{ value: { live?: boolean } }[]>`SELECT value FROM app_flags WHERE key = 'v3'`;
  return row?.value?.live === true;
}

async function open(db: Tx, userId: string): Promise<{ game: Game; cat: ReturnType<typeof catalog> }> {
  await db`SELECT pg_advisory_xact_lock(hashtext(${'v3:' + userId}))`;
  const list = await templatesOf(db);
  const cat = catalog(list);
  let game = await readGame(db, userId);
  const now = Date.now();
  if (!game) {
    game = v3.newGame(now, cat);
    game = consume(game, cat);
  } else {
    game = v3.sync(game, now, cat);
    game = v3.act(game, { type: 'daily', day: moscowDay(now) }, cat);
    game = consume(game, cat);
  }
  return { game, cat };
}

function consume(game: Game, cat: ReturnType<typeof catalog>): Game {
  let g = game;
  for (let i = 0; i < 6 && g.pendingFreeRolls > 0; i++) {
    try {
      const next = v3.act(g, { type: 'roll', count: 1, rng, ids }, cat);
      if (next.characters.length === g.characters.length && next.pendingFreeRolls < g.pendingFreeRolls) return next;
      g = next;
    } catch (e) {
      if (e instanceof v3.V3Error && e.code === 'no_template') break;
      throw e;
    }
  }
  return g;
}

async function paint(userId: string, game: Game, cat: ReturnType<typeof catalog>, before: Set<string>, db: Tx): Promise<Game> {
  const fresh = game.characters.filter((c) => !before.has(c.id) && !c.legacy);
  if (fresh.length === 0 || !env.routerai.apiKey) return game;
  const model = process.env.V3_TEXT_MODEL || 'deepseek/deepseek-chat';
  for (const ch of fresh) {
    const used = new Set(game.characters.filter((c) => c.id !== ch.id).map((c) => c.nickname.toLowerCase()));
    const text = await askText(userId, model, ch, cat, used, db);
    if (!text) continue;
    ch.nickname = text.nickname;
    ch.bio = text.bio;
    ch.quote = text.quote;
  }
  return game;
}

async function paintOffers(userId: string, game: Game, db: Tx): Promise<Game> {
  const pending = game.offers.filter((o) => !o.titled && !o.starter);
  if (pending.length === 0) return game;
  if (!env.routerai.apiKey) {
    for (const o of pending) o.titled = true;
    return game;
  }
  const model = process.env.V3_TEXT_MODEL || 'deepseek/deepseek-chat';
  await Promise.all(pending.map(async (o) => {
    const title = await askOfferTitle(userId, model, o, db);
    if (title) o.name = title;
    o.titled = true;
  }));
  return game;
}

async function askOfferTitle(userId: string, model: string, offer: Game['offers'][number], db: Tx): Promise<string | null> {
  const kind = offer.kind === 'credits' ? 'только кредиты' : offer.kind === 'stars' ? 'только звёзды' : 'кредиты и звёзды';
  const prompt = `Название грузового заказа маленькой конторы на дальней планете. Вид: ${kind}. Редкость: ${offer.rarity}. Юмор 18+, без порнографии и без несовершеннолетних. Тема: ящики, таможня, курьеры, бар, корпорация. Верни только JSON {"title":"..."} длиной 40–80 символов, почти вся кириллица.`;
  const t0 = Date.now();
  try {
    const res = await fetch(`${env.routerai.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { authorization: `Bearer ${env.routerai.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], temperature: 0.9 }),
      signal: AbortSignal.timeout(8_000),
    });
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[]; usage?: { total_tokens?: number } };
    const content = json.choices?.[0]?.message?.content ?? '';
    const match = content.match(/\{[\s\S]*\}/);
    const title = v3.validOfferTitle(match ? JSON.parse(match[0]) : null);
    await db`INSERT INTO ai_log (user_id, model, tokens, ok, detail) VALUES (${userId}, ${model}, ${json.usage?.total_tokens ?? null}, ${!!title}, ${db.json({ ms: Date.now() - t0, kind: 'offer' })})`;
    return title;
  } catch (e) {
    await db`INSERT INTO ai_log (user_id, model, tokens, ok, detail) VALUES (${userId}, ${model}, ${null}, ${false}, ${db.json({ error: (e as Error).message, kind: 'offer' })})`;
    return null;
  }
}

async function askText(userId: string, model: string, ch: Game['characters'][number], cat: ReturnType<typeof catalog>, used: Set<string>, db: Tx) {
  const traits = ch.traits.map((id) => cat.traits.find((t) => t.id === id)?.name_ru ?? id).join(', ');
  const prompt = `Раса ${ch.race}, класс ${ch.job}, имя ${ch.firstName} ${ch.lastName}, черты: ${traits}, редкость ${ch.rarity}. Тон: чёрный юмор, 18+, без пошлости, SFW. Верни только JSON {"nickname","bio","quote"}. bio 280–450 символов кириллицей, nickname 3–14, quote до 90.`;
  let last = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    const t0 = Date.now();
    try {
      const res = await fetch(`${env.routerai.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { authorization: `Bearer ${env.routerai.apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], temperature: 0.7 }),
        signal: AbortSignal.timeout(15_000),
      });
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[]; usage?: { total_tokens?: number } };
      const content = json.choices?.[0]?.message?.content ?? '';
      const match = content.match(/\{[\s\S]*\}/);
      const parsed = match ? JSON.parse(match[0]) : null;
      const ok = v3.validAiText(parsed, used);
      await db`INSERT INTO ai_log (user_id, model, tokens, ok, detail) VALUES (${userId}, ${model}, ${json.usage?.total_tokens ?? null}, ${!!ok}, ${db.json({ ms: Date.now() - t0, attempt })})`;
      if (ok) return ok;
      last = 'validation';
    } catch (e) {
      last = (e as Error).message;
      await db`INSERT INTO ai_log (user_id, model, tokens, ok, detail) VALUES (${userId}, ${model}, ${null}, ${false}, ${db.json({ error: last, attempt })})`;
    }
  }
  return null;
}

function logoPrompt(name: string): string {
  return `Pixel-art text logo, wide horizontal banner for a small freight company on a remote planet. The only readable text is the company name, spelled exactly and centered in one line of large chunky pixel letters: "${name}". Dark blue warehouse sign, warm lamp, crates at the edges, no people, no watermark, no extra words and no letters besides that name. Crisp hard pixels, limited palette, no anti-aliasing.`;
}

function logoFile(userId: string, rev: number): { dir: string; base: string } {
  return { dir: resolve(env.portraitsDir, 'logos'), base: `${userId}-${rev}` };
}

function findLogo(userId: string, rev: number): string | null {
  if (rev <= 0) return null;
  const { dir, base } = logoFile(userId, rev);
  for (const ext of ['webp', 'png', 'jpg', 'svg']) {
    if (existsSync(resolve(dir, `${base}.${ext}`))) return `${env.portraitsPublicUrl}/logos/${base}.${ext}`;
  }
  return null;
}

function svgLogo(name: string): string {
  const text = name.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch] ?? ch);
  const size = name.length > 18 ? 36 : 48;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 200">
  <rect width="800" height="200" fill="#16344a"/>
  <rect x="18" y="18" width="764" height="164" fill="none" stroke="#e7c56a" stroke-width="8"/>
  <text x="400" y="116" text-anchor="middle" font-family="monospace" font-size="${size}" fill="#f6e2ad">${text}</text>
</svg>`;
}

function imageExt(buf: Buffer): 'png' | 'jpg' | 'webp' {
  if (buf[0] === 0x89 && buf[1] === 0x50) return 'png';
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'jpg';
  if (buf.toString('ascii', 0, 4) === 'RIFF') return 'webp';
  return 'png';
}

async function askLogo(userId: string, name: string, db: Sql): Promise<Buffer | null> {
  const model = (await getAiSettings()).settings.image.model;
  const prompt = logoPrompt(name);
  const t0 = Date.now();
  try {
    const res = await fetch(`${env.routerai.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { authorization: `Bearer ${env.routerai.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        modalities: ['image'],
        messages: [{ role: 'user', content: prompt }],
        image_config: { aspect_ratio: '16:9' },
      }),
      signal: AbortSignal.timeout(45_000),
    });
    const json = (await res.json()) as {
      choices?: { message?: { images?: { image_url?: { url?: string } }[] } }[];
      usage?: { total_tokens?: number };
      error?: { message?: string };
    };
    const url = json.choices?.[0]?.message?.images?.[0]?.image_url?.url ?? '';
    await db`INSERT INTO ai_log (user_id, model, tokens, ok, detail) VALUES (${userId}, ${model}, ${json.usage?.total_tokens ?? null}, ${!!url}, ${db.json({ ms: Date.now() - t0, kind: 'logo', name })})`;
    if (!url) return null;
    if (url.startsWith('data:')) return Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
    const file = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!file.ok) return null;
    return Buffer.from(await file.arrayBuffer());
  } catch (e) {
    await db`INSERT INTO ai_log (user_id, model, tokens, ok, detail) VALUES (${userId}, ${model}, ${null}, ${false}, ${db.json({ error: (e as Error).message, kind: 'logo' })})`;
    return null;
  }
}

async function ensureLogo(userId: string, company: string, rev: number, db: Sql): Promise<string | null> {
  const ready = findLogo(userId, rev);
  if (ready || rev <= 0) return ready;
  const { dir, base } = logoFile(userId, rev);
  mkdirSync(dir, { recursive: true });
  const name = company.replace(/[\r\n"]/g, ' ').trim();
  if (env.routerai.apiKey) {
    const buf = await askLogo(userId, name, db);
    if (buf && buf.length > 32) {
      const ext = imageExt(buf);
      writeFileSync(resolve(dir, `${base}.${ext}`), buf);
      return `${env.portraitsPublicUrl}/logos/${base}.${ext}`;
    }
  }
  writeFileSync(resolve(dir, `${base}.svg`), svgLogo(name));
  return `${env.portraitsPublicUrl}/logos/${base}.svg`;
}

async function play(db: Sql, userId: string, fn: (game: Game, cat: ReturnType<typeof catalog>) => Promise<Game> | Game) {
  try {
    const view = await db.begin(async (tx) => {
      const opened = await open(tx, userId);
      const before = new Set(opened.game.characters.map((c) => c.id));
      let game = await fn(opened.game, opened.cat);
      game = await paint(userId, game, opened.cat, before, tx);
      game = await paintOffers(userId, game, tx);
      await saveGame(tx, userId, game);
      const [user] = await tx<{ nickname: string; is_admin: boolean }[]>`SELECT nickname, is_admin FROM users WHERE id = ${userId}`;
      return { ...v3.view(game, opened.cat), hero: user?.nickname ?? opened.cat.story.hero_default, isAdmin: user?.is_admin ?? false };
    });
    const logoUrl = await ensureLogo(userId, view.company, view.logoRev ?? 0, db);
    return { ...view, logoUrl };
  } catch (e) {
    if (e instanceof v3.V3Error) throw new GameError(e.code, e.message);
    throw e;
  }
}

export async function v3Live(db: Sql): Promise<boolean> {
  return live(db);
}

export function registerV3(game: FastifyInstance, db: Sql): void {
  game.get('/v3/boot', async () => ({ live: await live(db) }));

  game.get('/v3/state', async (req) => play(db, req.userId, (g) => g));

  game.post('/v3/roll', async (req) => {
    const body = z.object({
      count: z.union([z.literal(1), z.literal(10)]),
      requestId: z.string().uuid(),
      focus: z.object({ kind: z.enum(['race', 'job']), id: z.string() }).optional(),
    }).parse(req.body);
    const [prev] = await db<{ result: unknown }[]>`SELECT result FROM v3_rolls WHERE user_id = ${req.userId} AND request_id = ${body.requestId}`;
    if (prev) return prev.result;
    const result = await play(db, req.userId, (g, cat) => v3.act(g, { type: 'roll', count: body.count, rng, ids, focus: body.focus }, cat));
    await db`INSERT INTO v3_rolls (user_id, request_id, result) VALUES (${req.userId}, ${body.requestId}, ${db.json(result as never)}) ON CONFLICT DO NOTHING`;
    return result;
  });

  game.post('/v3/base/expand', async (req) => {
    const body = z.object({ kind: z.enum(['up', 'down']) }).parse(req.body);
    return play(db, req.userId, (g, cat) => v3.act(g, { type: 'expand', kind: body.kind, rng }, cat));
  });
  game.post('/v3/cards/pick', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.body);
    return play(db, req.userId, (g, cat) => v3.act(g, { type: 'pick-card', id }, cat));
  });
  game.post('/v3/cards/reroll', async (req) => play(db, req.userId, (g, cat) => v3.act(g, { type: 'reroll-cards', rng }, cat)));
  game.post('/v3/cards/skip', async (req) => play(db, req.userId, (g, cat) => v3.act(g, { type: 'skip-cards' }, cat)));
  game.post('/v3/base/build', async (req) => {
    const body = z.object({ plotId: z.string(), typeId: z.string() }).parse(req.body);
    return play(db, req.userId, (g, cat) => v3.act(g, { type: 'build', plotId: body.plotId, typeId: body.typeId, rng }, cat));
  });
  game.post('/v3/roster', async (req) => {
    const body = z.object({ characterId: z.string(), reserve: z.boolean(), swapWith: z.string().optional() }).parse(req.body);
    return play(db, req.userId, (g, cat) => v3.act(g, { type: 'roster', characterId: body.characterId, reserve: body.reserve, swapWith: body.swapWith }, cat));
  });
  game.post('/v3/staff/assign', async (req) => {
    const body = z.object({ plotId: z.string(), characterId: z.string() }).parse(req.body);
    return play(db, req.userId, (g, cat) => v3.act(g, { type: 'assign', plotId: body.plotId, characterId: body.characterId }, cat));
  });
  game.post('/v3/staff/unassign', async (req) => {
    const body = z.object({ plotId: z.string(), characterId: z.string() }).parse(req.body);
    return play(db, req.userId, (g, cat) => v3.act(g, { type: 'unassign', plotId: body.plotId, characterId: body.characterId }, cat));
  });
  game.post('/v3/base/upgrade', async (req) => {
    const { plotId } = z.object({ plotId: z.string() }).parse(req.body);
    return play(db, req.userId, (g, cat) => v3.act(g, { type: 'upgrade', plotId }, cat));
  });
  game.post('/v3/rebirth/preview', async (req) => play(db, req.userId, (g, cat) => v3.act(g, { type: 'rebirth-preview', rng }, cat)));
  game.post('/v3/rebirth/confirm', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.body);
    return play(db, req.userId, (g, cat) => v3.act(g, { type: 'rebirth-confirm', id }, cat));
  });
  game.post('/v3/rebirth/reroll', async (req) => play(db, req.userId, (g, cat) => v3.act(g, { type: 'reroll-bases', rng }, cat)));
  game.post('/v3/gramota', async (req) => {
    const { slot } = z.object({ slot: z.union([z.literal(0), z.literal(1), z.literal(2)]) }).parse(req.body);
    return play(db, req.userId, (g, cat) => v3.act(g, { type: 'gramota', slot }, cat));
  });
  game.post('/v3/meta/:id', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    return play(db, req.userId, (g, cat) => v3.act(g, { type: 'meta', id }, cat));
  });
  game.post('/v3/story/ack', async (req) => {
    const { skip } = z.object({ skip: z.boolean().default(false) }).parse(req.body ?? {});
    return play(db, req.userId, (g, cat) => v3.act(g, { type: 'story-ack', skip }, cat));
  });
  game.post('/v3/contracts/start', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.body);
    return play(db, req.userId, (g, cat) => v3.act(g, { type: 'contract-start', id }, cat));
  });
  game.post('/v3/company', async (req) => {
    const { name } = z.object({ name: z.string() }).parse(req.body);
    return play(db, req.userId, (g, cat) => v3.act(g, { type: 'rename', company: name }, cat));
  });
  game.post('/v3/motion', async (req) => {
    const { on } = z.object({ on: z.boolean() }).parse(req.body);
    return play(db, req.userId, (g, cat) => v3.act(g, { type: 'motion', on }, cat));
  });
  game.post('/v3/offline/ack', async (req) => play(db, req.userId, (g, cat) => v3.act(g, { type: 'ack-offline' }, cat)));
  game.post('/v3/ending', async (req) => {
    const { id } = z.object({ id: z.enum(['sell', 'refuse', 'buy']) }).parse(req.body);
    return play(db, req.userId, (g, cat) => v3.act(g, { type: 'ending', id }, cat));
  });

  game.get('/v3/admin/templates', async (req) => {
    await assertAdmin(db, req.userId);
    const rows = await db`SELECT template_id, race, class, first_name, last_name, portrait, thumb, status FROM character_templates ORDER BY race, class, template_id`;
    return { items: rows };
  });
  game.post('/v3/admin/templates/:id', async (req) => {
    await assertAdmin(db, req.userId);
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const { status } = z.object({ status: z.enum(['approved', 'rejected', 'draft']) }).parse(req.body);
    await db`UPDATE character_templates SET status = ${status} WHERE template_id = ${id}`;
    return { ok: true };
  });
}

async function assertAdmin(db: Sql, userId: string): Promise<void> {
  const [u] = await db<{ is_admin: boolean }[]>`SELECT is_admin FROM users WHERE id = ${userId}`;
  if (!u?.is_admin) throw new GameError('forbidden', 'Только для автора', 403);
}

export async function migrateVeterans(db: Sql, userId?: string): Promise<number> {
  const users = userId
    ? await db<{ id: string; shards: number }[]>`SELECT u.id, p.shards FROM users u JOIN player_state p ON p.user_id = u.id WHERE u.id = ${userId}`
    : await db<{ id: string; shards: number }[]>`
        SELECT u.id, p.shards FROM users u JOIN player_state p ON p.user_id = u.id
        WHERE NOT EXISTS (SELECT 1 FROM meta_state m WHERE m.user_id = u.id AND m.migrated_at IS NOT NULL)`;
  let n = 0;
  for (const u of users) {
    await db.begin(async (tx) => {
      const [done] = await tx<{ migrated_at: Date | null }[]>`SELECT migrated_at FROM meta_state WHERE user_id = ${u.id}`;
      if (done?.migrated_at) return;
      const list = await templatesOf(tx);
      const full = catalog(list);
      const game = (await readGame(tx, u.id)) ?? v3.newGame(Date.now(), full);
      const rows = await tx<{
        id: string; archetype: string; rarity: string; name: string; bio: string; quote: string; portrait_url: string; thumb_url: string; stars: number;
      }[]>`
        SELECT i.id, i.archetype, i.rarity, p.name, p.bio, p.quote, p.portrait_url, p.thumb_url, i.stars
        FROM waifu_instances i JOIN waifu_pool p ON p.id = i.pool_id WHERE i.user_id = ${u.id}`;
      const have = new Set(game.characters.map((c) => c.id));
      for (const row of rows) {
        if (have.has(row.id)) continue;
        game.characters.push(v3.mapVeteran({
          id: row.id,
          archetype: row.archetype,
          rarity: row.rarity,
          name: row.name,
          bio: row.bio,
          quote: row.quote,
          portrait: row.portrait_url,
          thumb: row.thumb_url,
          stars: row.stars,
          traits: full.traits,
          eco: full.economy,
          migration: full.migration,
        }));
      }
      game.stars += Math.floor(u.shards * full.migration.shard_to_star);
      await saveGame(tx, u.id, game);
      await tx`UPDATE meta_state SET migrated_at = now() WHERE user_id = ${u.id}`;
      await tx`UPDATE player_state SET shards = 0 WHERE user_id = ${u.id}`;
      n += 1;
    });
  }
  return n;
}
