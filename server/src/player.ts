import {
  addStats,
  boardSize,
  cargoForSeals,
  contractSlots,
  gymSlots,
  offlineExtraHours,
  prestigeMods,
  sealsFor,
  D,
  DEFAULT_SETTINGS,
  cargoMilestoneRewards,
  computeRates,
  dstr,
  loadEconomy,
  loadGacha,
  produce,
  settle,
  warehouseSlots,
  type BannerDTO,
  type Decimal,
  type NoticeDTO,
  type OfflineReportDTO,
  type PrestigeMods,
  type Rates,
  type RatesDTO,
  type Resources,
  type StateDTO,
  type UserSettings,
  type WaifuView,
} from '@wl/shared';
import { sql, type Sql, type Tx } from './db.js';
import { ensureBoard, loadPrestige, runAutomation } from './management.js';
import { metaSnapshot } from './meta.js';
import { INSTANCE_SELECT, toWaifuDTO, type InstanceRow } from './pool.js';

const PLAYER_COLS = `user_id, cargo, cargo_total, coins, protein, seals, tickets, tokens, shards, cargo_milestone,
  last_tick_at, last_daily_on::text AS last_daily_on, total_pulls`;

export interface PlayerRow {
  user_id: string;
  cargo: string;
  cargo_total: string;
  coins: string;
  protein: string;
  seals: string;
  tickets: number;
  tokens: number;
  shards: number;
  cargo_milestone: number;
  last_tick_at: Date;
  last_daily_on: string | null;
  total_pulls: number;
}

export interface Player {
  row: PlayerRow;
  res: Resources;
  buildings: Record<string, number>;
  brigade: WaifuView[];
  rates: Rates;
  mods: PrestigeMods;
}

export function ratesDTO(r: Rates): RatesDTO {
  return {
    power: r.power,
    cargoPerSec: dstr(r.cargoPerSec),
    coinsPerSec: dstr(r.coinsPerSec),
    proteinPerSec: dstr(r.proteinPerSec),
    pricePerKg: r.pricePerKg,
    critChance: r.critChance,
    offlineEfficiency: r.offlineEfficiency,
    mult: r.mult,
  };
}

async function loadBuildings(tx: Sql | Tx, userId: string): Promise<Record<string, number>> {
  const cfg = loadEconomy();
  const rows = await tx<{ building_id: string; level: number }[]>`SELECT building_id, level FROM buildings_state WHERE user_id = ${userId}`;
  const out: Record<string, number> = {};
  for (const b of cfg.buildings) out[b.id] = b.start_level;
  for (const r of rows) out[r.building_id] = r.level;
  return out;
}

async function loadBrigade(tx: Sql | Tx, userId: string): Promise<WaifuView[]> {
  const rows = await tx.unsafe<InstanceRow[]>(
    `SELECT ${INSTANCE_SELECT} FROM waifu_instances i JOIN waifu_pool p ON p.id = i.pool_id
     WHERE i.user_id = $1 AND i.zone = 'warehouse' ORDER BY i.obtained_at`,
    [userId],
  );
  return rows.map((r) => ({ id: r.instance_id, archetype: r.archetype, rarity: r.rarity, stats: addStats(r.stats, r.stat_bonus), level: r.level, stars: r.stars, talents: r.talents }));
}

export interface AdvanceResult {
  player: Player;
  offlineReport?: OfflineReportDTO;
  milestoneTickets?: number;
  notices?: NoticeDTO[];
}

/**
 * Серверный тик (ТЗ 11): блокирует строку игрока, начисляет прогресс с last_tick_at до now
 * (онлайн-окно + офлайн с капом и эффективностью), выдаёт награды за вехи груза.
 * Любое действие игрока выполняется после advance в той же транзакции.
 */
export async function advance(tx: Tx, userId: string, now = new Date()): Promise<AdvanceResult> {
  const cfg = loadEconomy();
  const [row] = await tx.unsafe<PlayerRow[]>(`SELECT ${PLAYER_COLS} FROM player_state WHERE user_id = $1 FOR UPDATE`, [userId]);
  if (!row) throw new Error('player not found');
  const buildings = await loadBuildings(tx, userId);
  const brigade = await loadBrigade(tx, userId);
  const prestige = await loadPrestige(tx, userId);
  const mods = prestigeMods(prestige.upgrades, prestige.seals_earned, cfg);
  const rates = computeRates(brigade, buildings, cfg, mods);

  const before: Resources = { cargo: D(row.cargo), cargoTotal: D(row.cargo_total), coins: D(row.coins), protein: D(row.protein) };
  const s = settle(row.last_tick_at.getTime(), now.getTime(), rates, cfg, offlineExtraHours(buildings, cfg, mods));
  const res = produce(before, rates, s.effectiveSec);
  const ms = cargoMilestoneRewards(res.cargoTotal, row.cargo_milestone, cfg);

  const tickTo = now.getTime() > row.last_tick_at.getTime() ? now : row.last_tick_at;
  await tx`
    UPDATE player_state SET cargo = ${dstr(res.cargo)}, cargo_total = ${dstr(res.cargoTotal)}, coins = ${dstr(res.coins)},
      protein = ${dstr(res.protein)}, tickets = tickets + ${ms.tickets}, cargo_milestone = ${ms.newIdx}, last_tick_at = ${tickTo}
    WHERE user_id = ${userId}`;
  if (ms.tickets > 0) {
    await tx`INSERT INTO currency_ledger (user_id, currency, delta, reason, ref) VALUES (${userId}, 'tickets', ${String(ms.tickets)}, 'cargo_milestone', ${String(ms.newIdx)})`;
  }

  const newRow: PlayerRow = { ...row, cargo: dstr(res.cargo), cargo_total: dstr(res.cargoTotal), coins: dstr(res.coins), protein: dstr(res.protein), tickets: row.tickets + ms.tickets, cargo_milestone: ms.newIdx, last_tick_at: tickTo };
  const out: AdvanceResult = { player: { row: newRow, res, buildings, brigade, rates, mods } };
  if (ms.tickets > 0) out.milestoneTickets = ms.tickets;
  const notices = await runAutomation(tx, out.player, prestige.auto);
  const { settleMeta } = await import('./meta.js');
  const metaNotices = await settleMeta(tx, userId, res.cargoTotal.sub(before.cargoTotal), now);
  const all = [...notices, ...metaNotices];
  if (all.length) out.notices = all;
  await ensureBoard(tx, out.player);
  if (s.offlineSec >= cfg.offline.report_min_sec) {
    out.offlineReport = {
      offlineSec: s.offlineSec,
      lostSec: s.lostSec,
      efficiency: rates.offlineEfficiency,
      cargo: dstr(res.cargoTotal.sub(before.cargoTotal)),
      coins: dstr(res.coins.sub(before.coins)),
      protein: dstr(res.protein.sub(before.protein)),
    };
  }
  return out;
}

/** Списать монеты/протеин после advance. Бросает 'not_enough', если не хватает. */
export async function spend(tx: Tx, p: Player, cost: { coins?: Decimal; protein?: Decimal }, reason: string, ref: string): Promise<void> {
  const coins = cost.coins ?? D(0);
  const protein = cost.protein ?? D(0);
  if (p.res.coins.lt(coins) || p.res.protein.lt(protein)) throw new GameError('not_enough', 'Не хватает ресурсов');
  p.res.coins = p.res.coins.sub(coins);
  p.res.protein = p.res.protein.sub(protein);
  await tx`UPDATE player_state SET coins = ${dstr(p.res.coins)}, protein = ${dstr(p.res.protein)} WHERE user_id = ${p.row.user_id}`;
  if (coins.gt(0)) await tx`INSERT INTO currency_ledger (user_id, currency, delta, reason, ref) VALUES (${p.row.user_id}, 'coins', ${dstr(coins.neg())}, ${reason}, ${ref})`;
  if (protein.gt(0)) await tx`INSERT INTO currency_ledger (user_id, currency, delta, reason, ref) VALUES (${p.row.user_id}, 'protein', ${dstr(protein.neg())}, ${reason}, ${ref})`;
}

export class GameError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
  }
}

export function todayIn(tz: string, now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function bannerActive(b: { starts_at: string | null; ends_at: string | null }, now = new Date()): boolean {
  if (b.starts_at && now < new Date(b.starts_at)) return false;
  if (b.ends_at && now > new Date(b.ends_at)) return false;
  return true;
}

/** Полный снимок состояния для клиента; вызывается после коммита, всё пересчитывает из БД. */
export async function snapshot(
  userId: string,
  extras: Pick<AdvanceResult, 'offlineReport' | 'milestoneTickets' | 'notices'>,
  configVersion: string,
): Promise<StateDTO> {
  const cfg = loadEconomy();
  const g = loadGacha();
  const [user] = await sql<{ id: string; nickname: string; is_admin: boolean; settings: Partial<UserSettings> }[]>`
    SELECT id, nickname, is_admin, settings FROM users WHERE id = ${userId}`;
  if (!user) throw new GameError('no_user', 'Пользователь не найден', 401);
  const [ps] = await sql.unsafe<PlayerRow[]>(`SELECT ${PLAYER_COLS} FROM player_state WHERE user_id = $1`, [userId]);
  if (!ps) throw new GameError('no_user', 'Нет состояния', 401);
  const buildings = await loadBuildings(sql, userId);
  const prestige = await loadPrestige(sql, userId);
  const mods = prestigeMods(prestige.upgrades, prestige.seals_earned, cfg);
  const rates = computeRates(await loadBrigade(sql, userId), buildings, cfg, mods);
  const trainings = await sql<{ id: string; instance_id: string; type: string; duration_min: number; started_at: Date; ends_at: Date }[]>`
    SELECT id, instance_id, type, duration_min, started_at, ends_at FROM training_jobs WHERE user_id = ${userId} AND status = 'active' ORDER BY ends_at`;
  const contracts = await sql<
    {
      id: string; client_id: string; cargo_id: string; tag: string; stat: string; duration_min: number; required_power: number;
      reward_coins: string; reward_protein: string; ticket_chance: number; status: 'offer' | 'active'; expires_at: Date;
      team: string[]; success_chance: number | null; started_at: Date | null; ends_at: Date | null;
    }[]
  >`
    SELECT id, client_id, cargo_id, tag, stat, duration_min, required_power, reward_coins, reward_protein, ticket_chance, status,
      expires_at, team, success_chance, started_at, ends_at
    FROM contracts WHERE user_id = ${userId} AND (status = 'active' OR (status = 'offer' AND expires_at > now()))
    ORDER BY status, created_at`;
  const nowMs = Date.now();
  const waifu = await sql.unsafe<InstanceRow[]>(
    `SELECT ${INSTANCE_SELECT} FROM waifu_instances i JOIN waifu_pool p ON p.id = i.pool_id WHERE i.user_id = $1 ORDER BY i.obtained_at`,
    [userId],
  );
  const pity = await sql<{ banner_id: string; since_ssr: number; since_sr: number; pulls: number; uses: number }[]>`
    SELECT banner_id, since_ssr, since_sr, pulls, uses FROM gacha_pity WHERE user_id = ${userId}`;
  const pityBy = new Map(pity.map((p) => [p.banner_id, p]));
  const banners: BannerDTO[] = g.banners.map((b) => {
    const p = pityBy.get(b.id);
    const exhausted = b.max_uses !== null && (p?.uses ?? 0) >= b.max_uses;
    return {
      ...b,
      active: bannerActive(b) && !exhausted,
      pity: { sinceSsr: p?.since_ssr ?? 0, sinceSr: p?.since_sr ?? 0, pulls: p?.pulls ?? 0, uses: p?.uses ?? 0 },
    };
  });

  const dto: StateDTO = {
    serverTime: new Date(ps.last_tick_at).getTime(),
    configVersion,
    user: { id: user.id, nickname: user.nickname, isAdmin: user.is_admin, settings: { ...DEFAULT_SETTINGS, ...user.settings } },
    resources: {
      cargo: ps.cargo,
      cargoTotal: ps.cargo_total,
      coins: ps.coins,
      protein: ps.protein,
      seals: ps.seals,
      tickets: ps.tickets,
      tokens: ps.tokens,
      shards: ps.shards,
    },
    rates: ratesDTO(rates),
    buildings,
    slots: warehouseSlots(buildings.warehouse ?? 1, cfg),
    waifu: waifu.map((w) => toWaifuDTO(w, { buildings, nowMs })),
    banners,
    dailyAvailable: ps.last_daily_on !== todayIn(cfg.daily.timezone),
    cargoMilestone: ps.cargo_milestone,
    limits: {
      gymSlots: gymSlots(buildings, cfg, mods),
      contractSlots: contractSlots(buildings, cfg, mods),
      boardSize: boardSize(buildings, cfg),
      offlineCapHours: cfg.offline.cap_hours + offlineExtraHours(buildings, cfg, mods),
    },
    trainings: trainings.map((t) => ({
      id: t.id,
      instanceId: t.instance_id,
      type: t.type,
      durationMin: t.duration_min,
      startedAt: t.started_at.toISOString(),
      endsAt: t.ends_at.toISOString(),
    })),
    contracts: contracts.map((c) => ({
      id: c.id,
      clientId: c.client_id,
      cargoId: c.cargo_id,
      tag: c.tag,
      stat: c.stat,
      durationMin: c.duration_min,
      requiredPower: c.required_power,
      rewardCoins: c.reward_coins,
      rewardProtein: c.reward_protein,
      ticketChance: c.ticket_chance,
      status: c.status,
      expiresAt: c.expires_at.toISOString(),
      team: c.team,
      successChance: c.success_chance,
      startedAt: c.started_at?.toISOString() ?? null,
      endsAt: c.ends_at?.toISOString() ?? null,
    })),
    prestige: {
      count: prestige.prestiges,
      sealsEarned: prestige.seals_earned,
      sealsOnReset: sealsFor(D(ps.cargo), cfg),
      nextSealCargo: dstr(cargoForSeals(sealsFor(D(ps.cargo), cfg) + 1, cfg)),
      upgrades: prestige.upgrades,
      auto: { buildings: !!prestige.auto.buildings },
      unlocked: { autoClaim: mods.autoClaim, autoBuildings: mods.autoBuildings },
    },
    meta: await metaSnapshot(userId),
  };
  if (extras.notices?.length) dto.notices = extras.notices;
  if (extras.offlineReport) dto.offlineReport = extras.offlineReport;
  if (extras.milestoneTickets) dto.milestoneTickets = extras.milestoneTickets;
  return dto;
}
