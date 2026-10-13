import {
  activeEvent,
  D,
  dstr,
  dueMilestones,
  dueTiers,
  loadEconomy,
  loadMeta,
  inShop,
  questClaimable,
  streakNext,
  weekStart,
  type Metrics,
  type NoticeDTO,
} from '@wl/shared';
import { sql, type Tx } from './db.js';
import { GameError, todayIn } from './player.js';
import { cryptoRandom } from './rng.js';

const today = () => todayIn(loadEconomy().daily.timezone);

async function loadMetrics(tx: Tx | typeof sql, userId: string): Promise<Metrics> {
  const [ps] = await tx<{ cargo_total: string; total_pulls: number; hit_hard_pity: boolean; login_streak: number }[]>`
    SELECT cargo_total, total_pulls, hit_hard_pity, login_streak FROM player_state WHERE user_id = ${userId}`;
  const [col] = await tx<{ n: number }[]>`SELECT count(*)::int AS n FROM waifu_instances WHERE user_id = ${userId}`;
  const [full] = await tx<{ n: number }[]>`
    SELECT count(*)::int AS n FROM (
      SELECT archetype FROM waifu_instances WHERE user_id = ${userId} GROUP BY archetype HAVING count(DISTINCT rarity) = 5
    ) t`;
  const rares = await tx<{ rarity: string; n: number }[]>`
    SELECT rarity, count(*)::int AS n FROM waifu_instances WHERE user_id = ${userId} AND rarity IN ('SSR', 'UR') GROUP BY rarity`;
  const [b] = await tx<{ n: number }[]>`SELECT coalesce(max(level), 0)::int AS n FROM buildings_state WHERE user_id = ${userId}`;
  const [tr] = await tx<{ n: number }[]>`SELECT count(*)::int AS n FROM training_jobs WHERE user_id = ${userId} AND status = 'done'`;
  const [ct] = await tx<{ n: number }[]>`SELECT count(*)::int AS n FROM contracts WHERE user_id = ${userId} AND status = 'done'`;
  const [piano] = await tx<{ n: number }[]>`
    SELECT count(*)::int AS n FROM contracts
    WHERE user_id = ${userId} AND status = 'done' AND tag = 'piano' AND (result->>'success') = 'true'`;
  const [pr] = await tx<{ n: number }[]>`SELECT coalesce(prestiges, 0)::int AS n FROM prestige_state WHERE user_id = ${userId}`;
  const [mini] = await tx<{ n: number }[]>`SELECT count(*)::int AS n FROM mini_events WHERE user_id = ${userId} AND resolved_at IS NOT NULL`;
  const byR = new Map(rares.map((r) => [r.rarity, r.n]));
  return {
    cargoTotal: D(ps?.cargo_total ?? 0),
    collection: col?.n ?? 0,
    fullArchetypes: full?.n ?? 0,
    ssr: (byR.get('SSR') ?? 0) + (byR.get('UR') ?? 0),
    ur: byR.get('UR') ?? 0,
    pulls: ps?.total_pulls ?? 0,
    hardPity: !!ps?.hit_hard_pity,
    building: b?.n ?? 0,
    trainings: tr?.n ?? 0,
    contracts: ct?.n ?? 0,
    piano: piano?.n ?? 0,
    prestiges: pr?.n ?? 0,
    streak: ps?.login_streak ?? 0,
    minis: mini?.n ?? 0,
  };
}

async function give(tx: Tx, userId: string, tokens: number, tickets: number, reason: string, ref: string): Promise<void> {
  if (tokens <= 0 && tickets <= 0) return;
  await tx`UPDATE player_state SET tokens = tokens + ${tokens}, tickets = tickets + ${tickets} WHERE user_id = ${userId}`;
  if (tokens) await tx`INSERT INTO currency_ledger (user_id, currency, delta, reason, ref) VALUES (${userId}, 'tokens', ${String(tokens)}, ${reason}, ${ref})`;
  if (tickets) await tx`INSERT INTO currency_ledger (user_id, currency, delta, reason, ref) VALUES (${userId}, 'tickets', ${String(tickets)}, ${reason}, ${ref})`;
}

async function grantCosmetic(tx: Tx, userId: string, id: string | null | undefined, source: string): Promise<void> {
  if (!id) return;
  await tx`
    INSERT INTO user_cosmetics (user_id, cosmetic_id, source) VALUES (${userId}, ${id}, ${source})
    ON CONFLICT DO NOTHING`;
}

/** Серия заходов, недельный груз, мини-событие и достижения. Награды идемпотентны. */
export async function settleMeta(tx: Tx, userId: string, cargoDelta: ReturnType<typeof D>, now = new Date()): Promise<NoticeDTO[]> {
  const meta = loadMeta();
  const day = todayIn(loadEconomy().daily.timezone, now);
  const [seen] = await tx<{ login_streak: number; last_seen_on: string | null }[]>`
    SELECT login_streak, last_seen_on::text AS last_seen_on FROM player_state WHERE user_id = ${userId}`;
  const streak = streakNext(seen?.login_streak ?? 0, seen?.last_seen_on ?? null, day);
  await tx`UPDATE player_state SET login_streak = ${streak}, last_seen_on = ${day} WHERE user_id = ${userId}`;

  if (cargoDelta.gt(0)) {
    const week = weekStart(now);
    const [w] = await tx<{ cargo: string }[]>`SELECT cargo FROM weekly_cargo WHERE user_id = ${userId} AND week = ${week}`;
    const next = dstr(D(w?.cargo ?? 0).add(cargoDelta));
    await tx`
      INSERT INTO weekly_cargo (user_id, week, cargo) VALUES (${userId}, ${week}, ${next})
      ON CONFLICT (user_id, week) DO UPDATE SET cargo = EXCLUDED.cargo`;
  }

  const [open] = await tx<{ id: string }[]>`SELECT id FROM mini_events WHERE user_id = ${userId} AND resolved_at IS NULL`;
  if (!open && cryptoRandom() < meta.miniChance) {
    const [last] = await tx<{ created_at: Date }[]>`
      SELECT created_at FROM mini_events WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 1`;
    const gap = meta.miniGapMin * 60_000;
    if (!last || now.getTime() - last.created_at.getTime() >= gap) {
      const template = meta.minis[Math.floor(cryptoRandom() * meta.minis.length)]!;
      await tx`INSERT INTO mini_events (user_id, template_id) VALUES (${userId}, ${template.id})`;
    }
  }

  const metrics = await loadMetrics(tx, userId);
  metrics.streak = streak;
  const claimedRows = await tx<{ achievement_id: string; tier: string }[]>`
    SELECT achievement_id, tier FROM user_achievements WHERE user_id = ${userId}`;
  const claimed = new Set(claimedRows.map((r) => `${r.achievement_id}:${r.tier}`));
  const notices: NoticeDTO[] = [];
  for (const due of dueTiers(meta.achievements, metrics, claimed)) {
    const [row] = await tx<{ achievement_id: string }[]>`
      INSERT INTO user_achievements (user_id, achievement_id, tier) VALUES (${userId}, ${due.achievement.id}, ${due.tier.id})
      ON CONFLICT DO NOTHING RETURNING achievement_id`;
    if (!row) continue;
    const ref = `${due.achievement.id}:${due.tier.id}`;
    await give(tx, userId, due.tier.tokens, due.tier.tickets, 'achievement', ref);
    await grantCosmetic(tx, userId, due.tier.cosmetic, ref);
    const prize = [due.tier.tokens ? `+${due.tier.tokens} жетонов` : '', due.tier.tickets ? `+${due.tier.tickets} билетов` : ''].filter(Boolean).join(', ');
    notices.push({
      kind: 'achievement',
      outcome: 'info',
      waifuIds: [],
      text: `Достижение: ${due.achievement.name} (${due.tier.id})${prize ? ` · ${prize}` : ''}`,
      vars: {},
    });
    if (notices.length === 1) {
      const [first] = await tx<{ n: number }[]>`SELECT count(*)::int AS n FROM user_achievements WHERE user_id = ${userId}`;
      if (first?.n === 1) await tx`INSERT INTO analytics_events (user_id, name) VALUES (${userId}, 'first_achievement')`;
    }
  }
  return notices;
}

export async function bumpDaily(tx: Tx, userId: string, field: 'trainings' | 'contracts' | 'pulls', n = 1): Promise<void> {
  const day = today();
  await tx`INSERT INTO daily_progress (user_id, day) VALUES (${userId}, ${day}) ON CONFLICT DO NOTHING`;
  if (field === 'trainings') await tx`UPDATE daily_progress SET trainings = trainings + ${n} WHERE user_id = ${userId} AND day = ${day}`;
  if (field === 'contracts') await tx`UPDATE daily_progress SET contracts = contracts + ${n} WHERE user_id = ${userId} AND day = ${day}`;
  if (field === 'pulls') await tx`UPDATE daily_progress SET pulls = pulls + ${n} WHERE user_id = ${userId} AND day = ${day}`;
}

export async function claimQuest(userId: string, questId: string): Promise<void> {
  const q = loadMeta().quests.find((x) => x.id === questId);
  if (!q) throw new GameError('no_quest', 'Нет такого задания', 404);
  const day = today();
  await sql.begin(async (tx) => {
    const { advance } = await import('./player.js');
    await advance(tx, userId);
    const [p] = await tx<{ trainings: number; contracts: number; pulls: number; claimed: string[] }[]>`
      SELECT trainings, contracts, pulls, claimed FROM daily_progress WHERE user_id = ${userId} AND day = ${day} FOR UPDATE`;
    const progress = p?.[q.metric] ?? 0;
    if (!questClaimable(q, progress, (p?.claimed ?? []).includes(q.id))) throw new GameError('not_ready', 'Задание ещё не выполнено или уже забрано');
    const [row] = await tx<{ user_id: string }[]>`
      UPDATE daily_progress SET claimed = claimed || ${[q.id]}::text[]
      WHERE user_id = ${userId} AND day = ${day} AND NOT (claimed @> ${[q.id]}::text[]) RETURNING user_id`;
    if (!row) throw new GameError('not_ready', 'Уже забрано');
    await give(tx, userId, q.tokens, 0, 'daily_quest', `${day}:${q.id}`);
  });
}

export async function claimEvent(userId: string, index: number): Promise<void> {
  const ev = activeEvent(loadMeta().events);
  if (!ev) throw new GameError('no_event', 'Событие не идёт', 404);
  const ms = ev.milestones[index];
  if (!ms) throw new GameError('no_milestone', 'Нет такой награды', 404);
  await sql.begin(async (tx) => {
    const { advance } = await import('./player.js');
    await advance(tx, userId);
    const score = await pianoScore(tx, userId, ev.starts_at, ev.ends_at);
    const have = await tx<{ milestone: number }[]>`
      SELECT milestone FROM event_claims WHERE user_id = ${userId} AND event_id = ${ev.id}`;
    if (!dueMilestones(ev, score, new Set(have.map((h) => h.milestone))).includes(index)) {
      throw new GameError('not_ready', 'Награда недоступна или уже получена');
    }
    const [row] = await tx<{ milestone: number }[]>`
      INSERT INTO event_claims (user_id, event_id, milestone) VALUES (${userId}, ${ev.id}, ${index})
      ON CONFLICT DO NOTHING RETURNING milestone`;
    if (!row) throw new GameError('not_ready', 'Уже получено');
    await give(tx, userId, ms.tokens, ms.tickets, 'event', `${ev.id}:${index}`);
    await grantCosmetic(tx, userId, ms.cosmetic, `${ev.id}:${index}`);
  });
}

async function pianoScore(tx: Tx | typeof sql, userId: string, from: string, to: string): Promise<number> {
  const [r] = await tx<{ n: number }[]>`
    SELECT count(*)::int AS n FROM contracts
    WHERE user_id = ${userId} AND status = 'done' AND tag = 'piano' AND (result->>'success') = 'true'
      AND coalesce(ends_at, created_at) >= ${from}::timestamptz AND coalesce(ends_at, created_at) <= ${to}::timestamptz`;
  return r?.n ?? 0;
}

export async function resolveMini(userId: string, id: string, choice: number): Promise<void> {
  await sql.begin(async (tx) => {
    const { advance } = await import('./player.js');
    await advance(tx, userId);
    const [row] = await tx<{ template_id: string }[]>`
      SELECT template_id FROM mini_events WHERE id = ${id} AND user_id = ${userId} AND resolved_at IS NULL FOR UPDATE`;
    if (!row) throw new GameError('no_event', 'Происшествие уже закрыто', 404);
    const tpl = loadMeta().minis.find((m) => m.id === row.template_id);
    const opt = tpl?.choices[choice];
    if (!opt) throw new GameError('bad_choice', 'Нет такого варианта');
    const [done] = await tx<{ id: string }[]>`
      UPDATE mini_events SET choice = ${choice}, resolved_at = now()
      WHERE id = ${id} AND resolved_at IS NULL RETURNING id`;
    if (!done) throw new GameError('no_event', 'Происшествие уже закрыто', 404);
    await give(tx, userId, opt.tokens, opt.tickets, 'mini_event', id);
  });
}

export async function buyCosmetic(userId: string, id: string): Promise<void> {
  const item = loadMeta().cosmetics.find((c) => c.id === id);
  if (!item || item.unlock !== 'shop') throw new GameError('no_item', 'Этого нет в магазине', 404);
  if (!inShop(item)) throw new GameError('rotated', 'Сейчас этого нет на витрине');
  await sql.begin(async (tx) => {
    const { advance } = await import('./player.js');
    await advance(tx, userId);
    const [owned] = await tx<{ cosmetic_id: string }[]>`
      SELECT cosmetic_id FROM user_cosmetics WHERE user_id = ${userId} AND cosmetic_id = ${id}`;
    if (owned) throw new GameError('owned', 'Уже куплено');
    const [ps] = await tx<{ tokens: number }[]>`SELECT tokens FROM player_state WHERE user_id = ${userId} FOR UPDATE`;
    if ((ps?.tokens ?? 0) < item.price) throw new GameError('not_enough', 'Не хватает Жетонов');
    const [row] = await tx<{ cosmetic_id: string }[]>`
      INSERT INTO user_cosmetics (user_id, cosmetic_id, source) VALUES (${userId}, ${id}, 'shop')
      ON CONFLICT DO NOTHING RETURNING cosmetic_id`;
    if (!row) throw new GameError('owned', 'Уже куплено');
    await tx`UPDATE player_state SET tokens = tokens - ${item.price} WHERE user_id = ${userId}`;
    await tx`INSERT INTO currency_ledger (user_id, currency, delta, reason, ref) VALUES (${userId}, 'tokens', ${String(-item.price)}, 'cosmetic', ${id})`;
  });
}

export async function equipCosmetic(userId: string, kind: 'frame' | 'title' | 'warehouse' | 'card' | 'summon', id: string | null): Promise<void> {
  if (id) {
    const item = loadMeta().cosmetics.find((c) => c.id === id);
    if (!item || item.kind !== kind) throw new GameError('no_item', 'Не тот тип косметики', 404);
    const [owned] = await sql<{ cosmetic_id: string }[]>`SELECT cosmetic_id FROM user_cosmetics WHERE user_id = ${userId} AND cosmetic_id = ${id}`;
    if (!owned) throw new GameError('locked', 'Сначала получите предмет');
  }
  await sql`INSERT INTO user_loadout (user_id) VALUES (${userId}) ON CONFLICT DO NOTHING`;
  if (kind === 'frame') await sql`UPDATE user_loadout SET frame = ${id} WHERE user_id = ${userId}`;
  if (kind === 'title') await sql`UPDATE user_loadout SET title = ${id} WHERE user_id = ${userId}`;
  if (kind === 'warehouse') await sql`UPDATE user_loadout SET warehouse = ${id} WHERE user_id = ${userId}`;
  if (kind === 'card') await sql`UPDATE user_loadout SET card = ${id} WHERE user_id = ${userId}`;
  if (kind === 'summon') await sql`UPDATE user_loadout SET summon = ${id} WHERE user_id = ${userId}`;
}

export async function requestRegen(userId: string, waifuId: string): Promise<void> {
  const cost = loadMeta().regenTokens;
  await sql.begin(async (tx) => {
    const { advance } = await import('./player.js');
    await advance(tx, userId);
    const [w] = await tx<{ id: string }[]>`SELECT id FROM waifu_instances WHERE id = ${waifuId} AND user_id = ${userId} FOR UPDATE`;
    if (!w) throw new GameError('no_waifu', 'Нет такой waifu', 404);
    const [ps] = await tx<{ tokens: number }[]>`SELECT tokens FROM player_state WHERE user_id = ${userId} FOR UPDATE`;
    if ((ps?.tokens ?? 0) < cost) throw new GameError('not_enough', 'Не хватает Жетонов');
    const [row] = await tx<{ instance_id: string }[]>`
      INSERT INTO portrait_regens (instance_id, user_id, status, tokens) VALUES (${waifuId}, ${userId}, 'pending', ${cost})
      ON CONFLICT (instance_id) DO UPDATE SET status = 'pending', tokens = EXCLUDED.tokens, created_at = now()
      WHERE portrait_regens.status = 'failed'
      RETURNING instance_id`;
    if (!row) throw new GameError('once', 'Портрет уже перегенерировали');
    await tx`UPDATE player_state SET tokens = tokens - ${cost} WHERE user_id = ${userId}`;
    await tx`INSERT INTO currency_ledger (user_id, currency, delta, reason, ref) VALUES (${userId}, 'tokens', ${String(-cost)}, 'portrait_regen', ${waifuId})`;
  });
}

export async function metaSnapshot(userId: string): Promise<{
  claimed: string[];
  owned: string[];
  loadout: { frame: string | null; title: string | null; warehouse: string | null; card: string | null; summon: string | null };
  event: { id: string; score: number; claimed: number[] } | null;
  quests: { id: string; progress: number; claimed: boolean }[];
  mini: { id: string; templateId: string } | null;
  board: { nickname: string; cargo: string; rank: number }[];
  myRank: number | null;
  myCargo: string;
  regen: Record<string, string>;
  metrics: MetaMetrics;
}> {
  const meta = loadMeta();
  const day = today();
  const week = weekStart();
  const claimed = await sql<{ achievement_id: string; tier: string }[]>`
    SELECT achievement_id, tier FROM user_achievements WHERE user_id = ${userId}`;
  const owned = await sql<{ cosmetic_id: string }[]>`SELECT cosmetic_id FROM user_cosmetics WHERE user_id = ${userId}`;
  const [loadout] = await sql<{ frame: string | null; title: string | null; warehouse: string | null; card: string | null; summon: string | null }[]>`
    SELECT frame, title, warehouse, card, summon FROM user_loadout WHERE user_id = ${userId}`;
  const ev = activeEvent(meta.events);
  let event: { id: string; score: number; claimed: number[] } | null = null;
  if (ev) {
    const score = await pianoScore(sql, userId, ev.starts_at, ev.ends_at);
    const rows = await sql<{ milestone: number }[]>`SELECT milestone FROM event_claims WHERE user_id = ${userId} AND event_id = ${ev.id}`;
    event = { id: ev.id, score, claimed: rows.map((r) => r.milestone) };
  }
  const [prog] = await sql<{ trainings: number; contracts: number; pulls: number; claimed: string[] }[]>`
    SELECT trainings, contracts, pulls, claimed FROM daily_progress WHERE user_id = ${userId} AND day = ${day}`;
  const [mini] = await sql<{ id: string; template_id: string }[]>`
    SELECT id, template_id FROM mini_events WHERE user_id = ${userId} AND resolved_at IS NULL`;
  const board = await sql<{ user_id: string; nickname: string; cargo: string }[]>`
    SELECT w.user_id, u.nickname, w.cargo FROM weekly_cargo w JOIN users u ON u.id = w.user_id WHERE w.week = ${week}`;
  const regens = await sql<{ instance_id: string; status: string }[]>`
    SELECT instance_id, status FROM portrait_regens WHERE user_id = ${userId}`;
  return {
    claimed: claimed.map((c) => `${c.achievement_id}:${c.tier}`),
    owned: owned.map((o) => o.cosmetic_id),
    loadout: loadout ?? { frame: null, title: null, warehouse: null, card: null, summon: null },
    event,
    quests: meta.quests.map((q) => ({ id: q.id, progress: prog?.[q.metric] ?? 0, claimed: (prog?.claimed ?? []).includes(q.id) })),
    mini: mini ? { id: mini.id, templateId: mini.template_id } : null,
    ...rankBoard(board, userId),
    regen: Object.fromEntries(regens.map((r) => [r.instance_id, r.status])),
    metrics: toMetaMetrics(await loadMetrics(sql, userId)),
  };
}

export interface MetaMetrics {
  cargoTotal: string;
  collection: number;
  fullArchetypes: number;
  ssr: number;
  ur: number;
  pulls: number;
  hardPity: boolean;
  building: number;
  trainings: number;
  contracts: number;
  piano: number;
  prestiges: number;
  streak: number;
  minis: number;
}

function toMetaMetrics(m: Metrics): MetaMetrics {
  return { ...m, cargoTotal: dstr(m.cargoTotal) };
}

function rankBoard(rows: { user_id: string; nickname: string; cargo: string }[], userId: string) {
  const ranked = [...rows]
    .sort((a, b) => D(b.cargo).compare(D(a.cargo)))
    .map((b, i) => ({ nickname: b.nickname, cargo: b.cargo, rank: i + 1, user_id: b.user_id }));
  const me = ranked.find((b) => b.user_id === userId);
  return {
    board: ranked.slice(0, 20).map(({ nickname, cargo, rank }) => ({ nickname, cargo, rank })),
    myRank: me?.rank ?? null,
    myCargo: me?.cargo ?? '0',
  };
}

export async function refundRegen(instanceId: string): Promise<void> {
  await sql.begin(async (tx) => {
    const [row] = await tx<{ user_id: string; tokens: number }[]>`
      UPDATE portrait_regens SET status = 'failed' WHERE instance_id = ${instanceId} AND status = 'pending' RETURNING user_id, tokens`;
    if (!row) return;
    await tx`UPDATE player_state SET tokens = tokens + ${row.tokens} WHERE user_id = ${row.user_id}`;
    await tx`INSERT INTO currency_ledger (user_id, currency, delta, reason, ref) VALUES (${row.user_id}, 'tokens', ${String(row.tokens)}, 'portrait_regen_refund', ${instanceId})`;
  });
}
