import {
  buildingBulkCost,
  buildingConfig,
  buildingMaxAffordable,
  D,
  DEFAULT_SETTINGS,
  dstr,
  findForbidden,
  levelCap,
  loadEconomy,
  starCost,
  waifuLevelCost,
  warehouseSlots,
  type Rarity,
  type UserSettings,
} from '@wl/shared';
import { sql, type Tx } from './db.js';
import { advance, GameError, spend, todayIn, type AdvanceResult } from './player.js';

type Extras = Pick<AdvanceResult, 'offlineReport' | 'milestoneTickets' | 'notices'>;
const extras = (a: AdvanceResult): Extras => ({ offlineReport: a.offlineReport, milestoneTickets: a.milestoneTickets, notices: a.notices });

export async function tick(userId: string): Promise<Extras> {
  return sql.begin(async (tx) => extras(await advance(tx, userId)));
}

export async function upgradeBuilding(userId: string, buildingId: string, count: number | 'max'): Promise<Extras> {
  const cfg = loadEconomy();
  const b = (() => {
    try {
      return buildingConfig(cfg, buildingId);
    } catch {
      throw new GameError('no_building', 'Нет такого здания', 404);
    }
  })();
  return sql.begin(async (tx) => {
    const adv = await advance(tx, userId);
    const level = adv.player.buildings[buildingId] ?? b.start_level;
    const n = count === 'max' ? buildingMaxAffordable(b, level, adv.player.res.coins) : count;
    if (n < 1) throw new GameError('not_enough', 'Не хватает Монет');
    await spend(tx, adv.player, { coins: buildingBulkCost(b, level, n) }, 'building', `${buildingId}:${level}->${level + n}`);
    await tx`
      INSERT INTO buildings_state (user_id, building_id, level) VALUES (${userId}, ${buildingId}, ${level + n})
      ON CONFLICT (user_id, building_id) DO UPDATE SET level = EXCLUDED.level`;
    adv.player.buildings[buildingId] = level + n;
    if (buildingId === 'dispatch') {
      const { ensureBoard } = await import('./management.js');
      await ensureBoard(tx, adv.player);
    }
    return extras(adv);
  });
}

interface InstRow {
  id: string;
  rarity: Rarity;
  level: number;
  stars: number;
  zone: string | null;
}

async function lockInstance(tx: Tx, userId: string, id: string): Promise<InstRow> {
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new GameError('no_waifu', 'Нет такой waifu', 404);
  const [w] = await tx<InstRow[]>`SELECT id, rarity, level, stars, zone FROM waifu_instances WHERE id = ${id} AND user_id = ${userId} FOR UPDATE`;
  if (!w) throw new GameError('no_waifu', 'Нет такой waifu', 404);
  return w;
}

export async function levelUp(userId: string, waifuId: string, count: number): Promise<Extras> {
  const cfg = loadEconomy();
  return sql.begin(async (tx) => {
    const adv = await advance(tx, userId);
    const w = await lockInstance(tx, userId, waifuId);
    const cap = levelCap(w.stars, cfg);
    let coins = D(0);
    let protein = D(0);
    let n = 0;
    while (n < count && w.level + n < cap) {
      const c = waifuLevelCost(w.rarity, w.level + n, cfg);
      if (adv.player.res.coins.lt(coins.add(c.coins)) || adv.player.res.protein.lt(protein.add(c.protein))) break;
      coins = coins.add(c.coins);
      protein = protein.add(c.protein);
      n++;
    }
    if (w.level >= cap) throw new GameError('level_cap', 'Потолок уровня. Нужны звёзды');
    if (n === 0) throw new GameError('not_enough', 'Не хватает Монет или Протеина');
    await spend(tx, adv.player, { coins, protein }, 'waifu_level', `${waifuId}:${w.level}->${w.level + n}`);
    await tx`UPDATE waifu_instances SET level = level + ${n} WHERE id = ${waifuId}`;
    return extras(adv);
  });
}

export async function starUp(userId: string, waifuId: string): Promise<Extras> {
  const cfg = loadEconomy();
  return sql.begin(async (tx) => {
    const adv = await advance(tx, userId);
    const w = await lockInstance(tx, userId, waifuId);
    const cost = starCost(w.rarity, w.stars, cfg);
    if (cost === null) throw new GameError('max_stars', 'Уже максимум звёзд');
    if (adv.player.row.shards < cost) throw new GameError('not_enough', 'Не хватает Осколков душ');
    await tx`UPDATE player_state SET shards = shards - ${cost} WHERE user_id = ${userId}`;
    await tx`UPDATE waifu_instances SET stars = stars + 1 WHERE id = ${waifuId}`;
    await tx`INSERT INTO currency_ledger (user_id, currency, delta, reason, ref) VALUES (${userId}, 'shards', ${String(-cost)}, 'star_up', ${waifuId})`;
    return extras(adv);
  });
}

export async function assign(userId: string, waifuId: string, zone: 'warehouse' | null): Promise<Extras> {
  const cfg = loadEconomy();
  return sql.begin(async (tx) => {
    const adv = await advance(tx, userId);
    const w = await lockInstance(tx, userId, waifuId);
    if (w.zone === 'gym' || w.zone === 'contract') throw new GameError('busy', w.zone === 'gym' ? 'Она в Спортзале' : 'Она на заказе');
    if (zone === 'warehouse' && w.zone !== 'warehouse') {
      const [{ n } = { n: 0 }] = await tx<{ n: number }[]>`
        SELECT count(*)::int AS n FROM waifu_instances WHERE user_id = ${userId} AND zone = 'warehouse'`;
      const slots = warehouseSlots(adv.player.buildings.warehouse ?? 1, cfg);
      if (n >= slots) throw new GameError('no_slots', `В бригаде максимум ${slots} мест. Улучшай Склад`);
    }
    await tx`UPDATE waifu_instances SET zone = ${zone} WHERE id = ${waifuId}`;
    return extras(adv);
  });
}

export async function rename(userId: string, waifuId: string, name: string | null): Promise<void> {
  const clean = name?.trim().replace(/\s+/g, ' ') || null;
  if (clean && (clean.length < 2 || clean.length > 40)) throw new GameError('bad_name', 'Имя: от 2 до 40 символов');
  // Мат разрешён; фильтр — дискриминация, сексуальный контент, личные данные
  if (clean) {
    const bad = findForbidden(clean);
    if (bad) throw new GameError('bad_name', `Так нельзя: «${bad}»`);
    if (/@|https?:|\+?\d[\d\s()-]{8,}/.test(clean)) throw new GameError('bad_name', 'Без контактов и ссылок');
  }
  await sql.begin(async (tx) => {
    await lockInstance(tx, userId, waifuId);
    await tx`UPDATE waifu_instances SET custom_name = ${clean} WHERE id = ${waifuId}`;
  });
}

export async function claimDaily(userId: string): Promise<Extras & { tickets: number; coins: string }> {
  const cfg = loadEconomy();
  return sql.begin(async (tx) => {
    const adv = await advance(tx, userId);
    const today = todayIn(cfg.daily.timezone);
    if (adv.player.row.last_daily_on === today) throw new GameError('daily_done', 'Сегодня уже забирали. Завтра приходи');
    const coins = adv.player.rates.coinsPerSec.mul(cfg.daily.coins_seconds).add(50).floor();
    await tx`
      UPDATE player_state SET tickets = tickets + ${cfg.daily.tickets}, coins = ${dstr(adv.player.res.coins.add(coins))}, last_daily_on = ${today}
      WHERE user_id = ${userId}`;
    await tx`INSERT INTO currency_ledger (user_id, currency, delta, reason, ref) VALUES (${userId}, 'tickets', ${String(cfg.daily.tickets)}, 'daily', ${today})`;
    await tx`INSERT INTO currency_ledger (user_id, currency, delta, reason, ref) VALUES (${userId}, 'coins', ${dstr(coins)}, 'daily', ${today})`;
    return { ...extras(adv), tickets: cfg.daily.tickets, coins: dstr(coins) };
  });
}

export async function updateSettings(userId: string, patch: Partial<UserSettings>): Promise<UserSettings> {
  const [u] = await sql<{ settings: Partial<UserSettings> }[]>`SELECT settings FROM users WHERE id = ${userId}`;
  const next = { ...DEFAULT_SETTINGS, ...(u?.settings ?? {}), ...patch };
  await sql`UPDATE users SET settings = ${sql.json(next as never)} WHERE id = ${userId}`;
  return next;
}

export async function setNickname(userId: string, nickname: string): Promise<void> {
  const { validateNickname } = await import('./auth.js');
  await sql`UPDATE users SET nickname = ${validateNickname(nickname)} WHERE id = ${userId}`;
}
