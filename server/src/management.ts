import {
  addStats,
  applyXp,
  boardSize,
  buildingBulkCost,
  buildingCost,
  computeRates,
  contractChance,
  contractSlots,
  contractTalentBonus,
  D,
  dstr,
  fatigueGain,
  fatigueNow,
  gymSlots,
  levelCap,
  loadContent,
  loadEconomy,
  makeOffer,
  nodeCost,
  rollTraining,
  sealsFor,
  statBonusCap,
  statBonusTotal,
  trainingSeconds,
  trainingSpeed,
  trainingType,
  waifuPower,
  warehouseSlots,
  type ContractTag,
  type NoticeDTO,
  type StatBonus,
  type StatKey,
  type TrainingResult,
  type WaifuView,
} from '@wl/shared';
import { sql, type Tx } from './db.js';
import { INSTANCE_SELECT, type InstanceRow } from './pool.js';
import { advance, GameError, spend, type AdvanceResult, type Player } from './player.js';
import { cryptoRandom } from './rng.js';

export interface PrestigeRow {
  prestiges: number;
  seals_earned: number;
  upgrades: Record<string, number>;
  auto: { buildings?: boolean };
}

export const EMPTY_PRESTIGE: PrestigeRow = { prestiges: 0, seals_earned: 0, upgrades: {}, auto: {} };

export async function loadPrestige(db: Tx | typeof sql, userId: string): Promise<PrestigeRow> {
  const [r] = await db<PrestigeRow[]>`SELECT prestiges, seals_earned, upgrades, auto FROM prestige_state WHERE user_id = ${userId}`;
  return r ?? EMPTY_PRESTIGE;
}

type Extras = Pick<AdvanceResult, 'offlineReport' | 'milestoneTickets' | 'notices'>;
const extras = (a: AdvanceResult): Extras => ({ offlineReport: a.offlineReport, milestoneTickets: a.milestoneTickets, notices: a.notices });

const UUID = /^[0-9a-f-]{36}$/;

async function lockInstances(tx: Tx, userId: string, ids: string[]): Promise<InstanceRow[]> {
  if (!ids.length || ids.some((id) => !UUID.test(id))) throw new GameError('no_waifu', 'Нет такой waifu', 404);
  await tx`SELECT id FROM waifu_instances WHERE id = ANY(${ids}::uuid[]) AND user_id = ${userId} ORDER BY id FOR UPDATE`;
  const rows = await tx.unsafe<InstanceRow[]>(
    `SELECT ${INSTANCE_SELECT} FROM waifu_instances i JOIN waifu_pool p ON p.id = i.pool_id WHERE i.user_id = $1 AND i.id = ANY($2::uuid[])`,
    [userId, ids],
  );
  if (rows.length !== new Set(ids).size) throw new GameError('no_waifu', 'Нет такой waifu', 404);
  return rows;
}

const view = (r: InstanceRow): WaifuView => ({
  id: r.instance_id,
  archetype: r.archetype,
  rarity: r.rarity,
  stats: addStats(r.stats, r.stat_bonus),
  level: r.level,
  stars: r.stars,
  talents: r.talents,
});

const STAT_RU: Record<StatKey, string> = { str: 'Сила', end: 'Выносливость', spd: 'Скорость', cha: 'Обаяние', lck: 'Удача' };
const displayName = (r: Pick<InstanceRow, 'custom_name' | 'name'>) => r.custom_name ?? r.name;

/** Вернуть waifu с работы: на склад, если была там и есть место, иначе на скамейку. */
async function returnToZone(tx: Tx, p: Player, id: string, prevZone: string | null): Promise<void> {
  let zone: string | null = null;
  if (prevZone === 'warehouse') {
    const [{ n } = { n: 0 }] = await tx<{ n: number }[]>`
      SELECT count(*)::int AS n FROM waifu_instances WHERE user_id = ${p.row.user_id} AND zone = 'warehouse'`;
    if (n < warehouseSlots(p.buildings.warehouse ?? 1, loadEconomy())) zone = 'warehouse';
  }
  await tx`UPDATE waifu_instances SET zone = ${zone} WHERE id = ${id} AND zone IN ('gym', 'contract')`;
}

// ---------- Тренировки ----------
interface TrainingJobRow {
  id: string;
  instance_id: string;
  type: string;
  duration_min: number;
  ends_at: Date;
  result: { roll: TrainingResult; prevZone: string | null };
}

export async function startTraining(userId: string, waifuId: string, typeId: string, durationMin: number): Promise<Extras> {
  const cfg = loadEconomy();
  const type = trainingType(cfg, typeId);
  if (!type) throw new GameError('bad_training', 'Нет такой тренировки', 404);
  if (!cfg.training.durations_min.includes(durationMin)) throw new GameError('bad_duration', 'Нет такой длительности');
  return sql.begin(async (tx) => {
    const adv = await advance(tx, userId);
    const p = adv.player;
    const [w] = await lockInstances(tx, userId, [waifuId]);
    if (!w) throw new GameError('no_waifu', 'Нет такой waifu', 404);
    if (w.zone === 'gym' || w.zone === 'contract') throw new GameError('busy', 'Она уже занята');
    const slots = gymSlots(p.buildings, cfg, p.mods);
    if (slots < 1) throw new GameError('no_gym', 'Сначала постройте Спортзал');
    const [{ n } = { n: 0 }] = await tx<{ n: number }[]>`SELECT count(*)::int AS n FROM training_jobs WHERE user_id = ${userId} AND status = 'active'`;
    if (n >= slots) throw new GameError('no_slots', `В Спортзале ${slots} мест. Улучшайте здание`);

    const now = Date.now();
    const fatigue = fatigueNow(w.fatigue, w.fatigue_at.getTime(), now, p.buildings, cfg);
    const roll = rollTraining(cryptoRandom, { type, durationMin, fatigue, rarity: w.rarity, bonus: w.stat_bonus, xpMult: p.mods.xpMult }, cfg);
    const sec = trainingSeconds(durationMin, trainingSpeed(w, p.brigade, p.buildings, cfg));
    const endsAt = new Date(now + sec * 1000);
    await tx`
      INSERT INTO training_jobs (user_id, instance_id, type, duration_min, started_at, ends_at, result)
      VALUES (${userId}, ${waifuId}, ${typeId}, ${durationMin}, ${new Date(now)}, ${endsAt}, ${tx.json({ roll, prevZone: w.zone } as never)})`;
    const nextFatigue = Math.min(cfg.fatigue.max, fatigue + fatigueGain('training', durationMin, p.buildings, cfg));
    await tx`UPDATE waifu_instances SET zone = 'gym', fatigue = ${nextFatigue}, fatigue_at = ${endsAt} WHERE id = ${waifuId}`;
    return extras(adv);
  });
}

async function finishTraining(tx: Tx, p: Player, job: TrainingJobRow): Promise<NoticeDTO | null> {
  const cfg = loadEconomy();
  const [done] = await tx<{ id: string }[]>`
    UPDATE training_jobs SET status = 'done', claimed_at = now() WHERE id = ${job.id} AND status = 'active' RETURNING id`;
  if (!done) return null;
  const [w] = await lockInstances(tx, p.row.user_id, [job.instance_id]);
  if (!w) return null;
  const roll = job.result.roll;
  const lv = applyXp(w.level, w.xp, roll.xp, levelCap(w.stars, cfg), cfg);
  const bonus: StatBonus = { ...(w.stat_bonus ?? {}) };
  let amount = 0;
  if (roll.stat && roll.amount > 0) {
    amount = Math.min(roll.amount, Math.max(0, statBonusCap(w.rarity, cfg) - statBonusTotal(bonus)));
    if (amount > 0) bonus[roll.stat] = (bonus[roll.stat] ?? 0) + amount;
  }
  await tx`UPDATE waifu_instances SET level = ${lv.level}, xp = ${lv.xp}, stat_bonus = ${tx.json(bonus as never)} WHERE id = ${w.instance_id}`;
  await returnToZone(tx, p, w.instance_id, job.result.prevZone);
  const { bumpDaily } = await import('./meta.js');
  await bumpDaily(tx, p.row.user_id, 'trainings');
  const type = trainingType(cfg, job.type);
  return {
    kind: 'training',
    outcome: roll.outcome,
    waifuIds: [w.instance_id],
    text:
      `${displayName(w)} · ${type?.name ?? job.type}: +${roll.xp} опыта` +
      (lv.levels ? `, +${lv.levels} ур.` : '') +
      (amount && roll.stat ? `, +${amount} ${STAT_RU[roll.stat]}` : roll.stat ? ', потолок бонуса статов' : ''),
    vars: { name: displayName(w), training: type?.name ?? job.type, stat: roll.stat ? STAT_RU[roll.stat] : '', amount: String(amount) },
  };
}

export async function claimTraining(userId: string, jobId: string): Promise<Extras & { notice: NoticeDTO }> {
  if (!UUID.test(jobId)) throw new GameError('no_job', 'Нет такой тренировки', 404);
  return sql.begin(async (tx) => {
    const adv = await advance(tx, userId);
    const [job] = await tx<TrainingJobRow[]>`
      SELECT id, instance_id, type, duration_min, ends_at, result FROM training_jobs
      WHERE id = ${jobId} AND user_id = ${userId} AND status = 'active' FOR UPDATE`;
    if (!job) throw new GameError('no_job', 'Тренировка уже забрана', 404);
    if (job.ends_at.getTime() > Date.now()) throw new GameError('not_ready', 'Ещё тренируется');
    const notice = await finishTraining(tx, adv.player, job);
    if (!notice) throw new GameError('no_job', 'Тренировка уже забрана', 404);
    return { ...extras(adv), notice };
  });
}

// ---------- Контракты ----------
interface ContractRow {
  id: string;
  client_id: string;
  cargo_id: string;
  tag: string;
  stat: StatKey;
  duration_min: number;
  required_power: number;
  reward_coins: string;
  reward_protein: string;
  ticket_chance: number;
  status: string;
  team: string[];
  ends_at: Date | null;
  expires_at: Date;
  result: { success: boolean; coins: string; protein: string; tickets: number; xp: number; prevZones: Record<string, string | null> } | null;
}

/** Опорные показатели для заказов: лучшая возможная бригада игрока. */
async function reference(tx: Tx, p: Player): Promise<{ coins: ReturnType<typeof D>; protein: ReturnType<typeof D>; power: number }> {
  const cfg = loadEconomy();
  const rows = await tx.unsafe<InstanceRow[]>(
    `SELECT ${INSTANCE_SELECT} FROM waifu_instances i JOIN waifu_pool p ON p.id = i.pool_id WHERE i.user_id = $1`,
    [p.row.user_id],
  );
  const all = rows.map(view).sort((a, b) => waifuPower(b, cfg) - waifuPower(a, cfg));
  const best = all.slice(0, warehouseSlots(p.buildings.warehouse ?? 1, cfg));
  const rates = computeRates(best, p.buildings, cfg, p.mods);
  const team = all.slice(0, cfg.contracts.team_max).reduce((s, w) => s + waifuPower(w, cfg), 0);
  return { coins: rates.coinsPerSec, protein: rates.proteinPerSec, power: team };
}

/** Доска заказов: убрать просроченные, добрать до размера доски. */
export async function ensureBoard(tx: Tx, p: Player): Promise<void> {
  const cfg = loadEconomy();
  const userId = p.row.user_id;
  await tx`UPDATE contracts SET status = 'expired' WHERE user_id = ${userId} AND status = 'offer' AND expires_at <= now()`;
  const size = boardSize(p.buildings, cfg);
  const [{ n } = { n: 0 }] = await tx<{ n: number }[]>`SELECT count(*)::int AS n FROM contracts WHERE user_id = ${userId} AND status = 'offer'`;
  if (n >= size) return;
  const content = loadContent().contracts;
  const ref = await reference(tx, p);
  const now = Date.now();
  for (let i = n; i < size; i++) {
    const o = makeOffer(
      cryptoRandom,
      { clients: content.clients, cargo: content.cargo, refCoinsPerSec: ref.coins, refProteinPerSec: ref.protein, refPower: ref.power, buildings: p.buildings },
      cfg,
    );
    // Разносим сроки, чтобы заказы не сгорали пачкой
    const ttl = cfg.contracts.offer_ttl_min * 60_000 * (0.75 + 0.5 * cryptoRandom());
    await tx`
      INSERT INTO contracts (user_id, client_id, cargo_id, tag, stat, duration_min, required_power, reward_coins, reward_protein, ticket_chance, expires_at)
      VALUES (${userId}, ${o.clientId}, ${o.cargoId}, ${o.tag}, ${o.stat}, ${o.durationMin}, ${o.requiredPower},
              ${dstr(o.rewardCoins)}, ${dstr(o.rewardProtein)}, ${o.ticketChance}, ${new Date(now + ttl)})`;
  }
}

export async function startContract(userId: string, contractId: string, team: string[]): Promise<Extras> {
  const cfg = loadEconomy();
  if (!UUID.test(contractId)) throw new GameError('no_contract', 'Нет такого заказа', 404);
  const ids = [...new Set(team)];
  if (!ids.length || ids.length > cfg.contracts.team_max) throw new GameError('bad_team', `В команде от 1 до ${cfg.contracts.team_max} waifu`);
  return sql.begin(async (tx) => {
    const adv = await advance(tx, userId);
    const p = adv.player;
    const [c] = await tx<ContractRow[]>`SELECT * FROM contracts WHERE id = ${contractId} AND user_id = ${userId} FOR UPDATE`;
    if (!c || c.status !== 'offer' || c.expires_at.getTime() <= Date.now()) throw new GameError('no_contract', 'Заказ уже недоступен', 404);
    const slots = contractSlots(p.buildings, cfg, p.mods);
    const [{ n } = { n: 0 }] = await tx<{ n: number }[]>`SELECT count(*)::int AS n FROM contracts WHERE user_id = ${userId} AND status = 'active'`;
    if (n >= slots) throw new GameError('no_slots', `Одновременно не больше ${slots} заказов. Улучшайте Диспетчерскую`);
    const rows = await lockInstances(tx, userId, ids);
    if (rows.some((r) => r.zone === 'gym' || r.zone === 'contract')) throw new GameError('busy', 'Кто-то из команды уже занят');

    const now = Date.now();
    const members = rows.map((r) => {
      const v = view(r);
      return { ...v, power: waifuPower(v, cfg), fatigue: fatigueNow(r.fatigue, r.fatigue_at.getTime(), now, p.buildings, cfg) };
    });
    const chance = contractChance(members, { requiredPower: c.required_power, stat: c.stat, tag: c.tag as ContractTag }, cfg);
    const success = cryptoRandom() < chance;
    const talent = 1 + contractTalentBonus(members, c.tag);
    const k = success ? talent : cfg.contracts.partial_reward;
    const tickets = success && cryptoRandom() < c.ticket_chance ? 1 : 0;
    const xp = Math.floor(cfg.contracts.xp_per_min * c.duration_min * p.mods.xpMult * (success ? 1 : 0.5));
    const endsAt = new Date(now + c.duration_min * 60_000);
    const result = {
      success,
      coins: dstr(D(c.reward_coins).mul(k).floor()),
      protein: dstr(D(c.reward_protein).mul(k).floor()),
      tickets,
      xp,
      prevZones: Object.fromEntries(rows.map((r) => [r.instance_id, r.zone])),
    };
    await tx`
      UPDATE contracts SET status = 'active', team = ${ids}::uuid[], success_chance = ${chance}, started_at = ${new Date(now)},
        ends_at = ${endsAt}, result = ${tx.json(result as never)}
      WHERE id = ${contractId}`;
    const gain = fatigueGain('contracts', c.duration_min, p.buildings, cfg);
    for (const m of members) {
      await tx`UPDATE waifu_instances SET zone = 'contract', fatigue = ${Math.min(cfg.fatigue.max, m.fatigue + gain)}, fatigue_at = ${endsAt} WHERE id = ${m.id}`;
    }
    await ensureBoard(tx, p);
    return extras(adv);
  });
}

async function finishContract(tx: Tx, p: Player, c: ContractRow): Promise<NoticeDTO | null> {
  const cfg = loadEconomy();
  const r = c.result;
  if (!r) return null;
  const [done] = await tx<{ id: string }[]>`UPDATE contracts SET status = 'done' WHERE id = ${c.id} AND status = 'active' RETURNING id`;
  if (!done) return null;
  const userId = p.row.user_id;
  p.res.coins = p.res.coins.add(r.coins);
  p.res.protein = p.res.protein.add(r.protein);
  await tx`UPDATE player_state SET coins = ${dstr(p.res.coins)}, protein = ${dstr(p.res.protein)}, tickets = tickets + ${r.tickets} WHERE user_id = ${userId}`;
  await tx`INSERT INTO currency_ledger (user_id, currency, delta, reason, ref) VALUES (${userId}, 'coins', ${r.coins}, 'contract', ${c.id})`;
  if (D(r.protein).gt(0)) await tx`INSERT INTO currency_ledger (user_id, currency, delta, reason, ref) VALUES (${userId}, 'protein', ${r.protein}, 'contract', ${c.id})`;
  if (r.tickets) await tx`INSERT INTO currency_ledger (user_id, currency, delta, reason, ref) VALUES (${userId}, 'tickets', ${String(r.tickets)}, 'contract', ${c.id})`;

  const rows = c.team.length ? await lockInstances(tx, userId, c.team).catch(() => []) : [];
  for (const w of rows) {
    const lv = applyXp(w.level, w.xp, r.xp, levelCap(w.stars, cfg), cfg);
    await tx`UPDATE waifu_instances SET level = ${lv.level}, xp = ${lv.xp} WHERE id = ${w.instance_id}`;
    await returnToZone(tx, p, w.instance_id, r.prevZones[w.instance_id] ?? null);
  }
  const { bumpDaily } = await import('./meta.js');
  await bumpDaily(tx, userId, 'contracts');
  const content = loadContent().contracts;
  const client = content.clients.find((x) => x.id === c.client_id)?.name ?? c.client_id;
  const cargo = content.cargo.find((x) => x.id === c.cargo_id)?.name ?? c.cargo_id;
  const names = rows.map(displayName).join(', ');
  return {
    kind: 'contract',
    outcome: r.success ? 'contract_success' : 'contract_partial',
    waifuIds: c.team,
    text: `${client} · ${cargo}: ${r.success ? 'успех' : 'частично'}` + (r.tickets ? ', +1 Билет' : '') + (names ? ` (${names})` : ''),
    vars: { name: rows[0] ? displayName(rows[0]) : '', client, cargo, coins: r.coins },
  };
}

export async function claimContract(userId: string, contractId: string): Promise<Extras & { notice: NoticeDTO }> {
  if (!UUID.test(contractId)) throw new GameError('no_contract', 'Нет такого заказа', 404);
  return sql.begin(async (tx) => {
    const adv = await advance(tx, userId);
    const [c] = await tx<ContractRow[]>`SELECT * FROM contracts WHERE id = ${contractId} AND user_id = ${userId} AND status = 'active' FOR UPDATE`;
    if (!c) throw new GameError('no_contract', 'Заказ уже закрыт', 404);
    if (!c.ends_at || c.ends_at.getTime() > Date.now()) throw new GameError('not_ready', 'Ещё везут');
    const notice = await finishContract(tx, adv.player, c);
    if (!notice) throw new GameError('no_contract', 'Заказ уже закрыт', 404);
    return { ...extras(adv), notice };
  });
}

/** Отказаться от предложения на доске (взамен придёт новое). */
export async function dismissContract(userId: string, contractId: string): Promise<Extras> {
  if (!UUID.test(contractId)) throw new GameError('no_contract', 'Нет такого заказа', 404);
  return sql.begin(async (tx) => {
    const adv = await advance(tx, userId);
    const [c] = await tx<{ id: string }[]>`
      UPDATE contracts SET status = 'expired' WHERE id = ${contractId} AND user_id = ${userId} AND status = 'offer' RETURNING id`;
    if (!c) throw new GameError('no_contract', 'Заказ уже недоступен', 404);
    return extras(adv);
  });
}

// ---------- Автоматика (вызывается из advance) ----------
export async function runAutomation(tx: Tx, p: Player, auto: PrestigeRow['auto']): Promise<NoticeDTO[]> {
  const cfg = loadEconomy();
  const notices: NoticeDTO[] = [];
  if (p.mods.autoClaim) {
    const jobs = await tx<TrainingJobRow[]>`
      SELECT id, instance_id, type, duration_min, ends_at, result FROM training_jobs
      WHERE user_id = ${p.row.user_id} AND status = 'active' AND ends_at <= now() ORDER BY ends_at FOR UPDATE SKIP LOCKED`;
    for (const j of jobs) {
      const n = await finishTraining(tx, p, j);
      if (n) notices.push(n);
    }
    const cs = await tx<ContractRow[]>`
      SELECT * FROM contracts WHERE user_id = ${p.row.user_id} AND status = 'active' AND ends_at <= now() ORDER BY ends_at FOR UPDATE SKIP LOCKED`;
    for (const c of cs) {
      const n = await finishContract(tx, p, c);
      if (n) notices.push(n);
    }
  }
  if (p.mods.autoBuildings && auto.buildings) {
    const budget = p.res.coins.mul(0.5);
    let spent = D(0);
    const bought: Record<string, number> = {};
    for (let i = 0; i < 200; i++) {
      let best: { id: string; cost: ReturnType<typeof D> } | null = null;
      for (const b of cfg.buildings) {
        const cost = buildingCost(b, p.buildings[b.id] ?? b.start_level);
        if (!best || cost.lt(best.cost)) best = { id: b.id, cost };
      }
      if (!best || spent.add(best.cost).gt(budget)) break;
      spent = spent.add(best.cost);
      p.buildings[best.id] = (p.buildings[best.id] ?? 0) + 1;
      bought[best.id] = (bought[best.id] ?? 0) + 1;
    }
    const ids = Object.keys(bought);
    if (ids.length) {
      for (const id of ids) {
        const b = cfg.buildings.find((x) => x.id === id)!;
        const to = p.buildings[id]!;
        const from = to - bought[id]!;
        await spend(tx, p, { coins: buildingBulkCost(b, from, bought[id]!) }, 'auto_building', `${id}:${from}->${to}`);
        await tx`
          INSERT INTO buildings_state (user_id, building_id, level) VALUES (${p.row.user_id}, ${id}, ${to})
          ON CONFLICT (user_id, building_id) DO UPDATE SET level = EXCLUDED.level`;
      }
      notices.push({
        kind: 'auto_buildings',
        outcome: 'info',
        waifuIds: [],
        text: 'Прораб улучшил: ' + ids.map((id) => `${cfg.buildings.find((x) => x.id === id)?.name ?? id} +${bought[id]}`).join(', '),
        vars: {},
      });
    }
  }
  return notices;
}

// ---------- Престиж «Конец смены» ----------
export async function endShift(userId: string): Promise<Extras & { seals: number; tickets: number }> {
  const cfg = loadEconomy();
  return sql.begin(async (tx) => {
    const adv = await advance(tx, userId);
    const p = adv.player;
    const seals = sealsFor(p.res.cargo, cfg);
    if (seals < 1) throw new GameError('no_seals', 'Слишком мало груза за смену: печатей не будет');
    const pr = await loadPrestige(tx, userId);

    await tx`UPDATE training_jobs SET status = 'cancelled' WHERE user_id = ${userId} AND status = 'active'`;
    await tx`UPDATE contracts SET status = 'cancelled' WHERE user_id = ${userId} AND status IN ('offer', 'active')`;
    await tx`DELETE FROM buildings_state WHERE user_id = ${userId}`;
    const startSlots = warehouseSlots(cfg.buildings.find((b) => b.id === 'warehouse')?.start_level ?? 1, cfg);
    await tx`
      UPDATE waifu_instances w SET level = 1, xp = 0, fatigue = 0, fatigue_at = now(),
        zone = CASE WHEN w.id IN (
          SELECT id FROM waifu_instances WHERE user_id = ${userId} AND zone IS NOT NULL
          ORDER BY (zone = 'warehouse') DESC, obtained_at LIMIT ${startSlots}
        ) THEN 'warehouse' ELSE NULL END
      WHERE w.user_id = ${userId}`;

    const upgrades = pr.upgrades;
    const earned = pr.seals_earned + seals;
    await tx`
      INSERT INTO prestige_state (user_id, prestiges, seals_earned, upgrades, auto, last_at)
      VALUES (${userId}, 1, ${earned}, ${tx.json(upgrades as never)}, ${tx.json(pr.auto as never)}, now())
      ON CONFLICT (user_id) DO UPDATE SET prestiges = prestige_state.prestiges + 1, seals_earned = ${earned}, last_at = now()`;
    const tickets = p.mods.prestigeTickets;
    const coins = D(cfg.start.coins + p.mods.startCoins);
    const spendable = D(p.row.seals).add(seals);
    await tx`
      UPDATE player_state SET cargo = '0', coins = ${dstr(coins)}, protein = '0', seals = ${dstr(spendable)}, tickets = tickets + ${tickets}
      WHERE user_id = ${userId}`;
    await tx`INSERT INTO currency_ledger (user_id, currency, delta, reason, ref) VALUES (${userId}, 'seals', ${String(seals)}, 'prestige', ${String(pr.prestiges + 1)})`;
    if (tickets) await tx`INSERT INTO currency_ledger (user_id, currency, delta, reason, ref) VALUES (${userId}, 'tickets', ${String(tickets)}, 'prestige', ${String(pr.prestiges + 1)})`;
    return { offlineReport: adv.offlineReport, milestoneTickets: adv.milestoneTickets, seals, tickets };
  });
}

export async function buyUpgrade(userId: string, nodeId: string): Promise<Extras> {
  const cfg = loadEconomy();
  const node = cfg.prestige.tree.find((n) => n.id === nodeId);
  if (!node) throw new GameError('no_node', 'Нет такого улучшения', 404);
  return sql.begin(async (tx) => {
    const adv = await advance(tx, userId);
    const pr = await loadPrestige(tx, userId);
    const level = pr.upgrades[nodeId] ?? 0;
    const cost = nodeCost(node, level);
    if (cost === null) throw new GameError('max_level', 'Уже максимум');
    const have = D(adv.player.row.seals);
    if (have.lt(cost)) throw new GameError('not_enough', 'Не хватает Печатей');
    const upgrades = { ...pr.upgrades, [nodeId]: level + 1 };
    await tx`UPDATE player_state SET seals = ${dstr(have.sub(cost))} WHERE user_id = ${userId}`;
    await tx`INSERT INTO currency_ledger (user_id, currency, delta, reason, ref) VALUES (${userId}, 'seals', ${String(-cost)}, 'prestige_upgrade', ${`${nodeId}:${level + 1}`})`;
    await tx`
      INSERT INTO prestige_state (user_id, upgrades) VALUES (${userId}, ${tx.json(upgrades as never)})
      ON CONFLICT (user_id) DO UPDATE SET upgrades = EXCLUDED.upgrades`;
    return extras(adv);
  });
}

export async function setAutomation(userId: string, patch: { buildings?: boolean }): Promise<Extras> {
  return sql.begin(async (tx) => {
    const adv = await advance(tx, userId);
    if (patch.buildings && !adv.player.mods.autoBuildings) throw new GameError('locked', 'Сначала откройте «Прораба» в дереве престижа');
    const pr = await loadPrestige(tx, userId);
    const auto = { ...pr.auto, ...patch };
    await tx`
      INSERT INTO prestige_state (user_id, auto) VALUES (${userId}, ${tx.json(auto as never)})
      ON CONFLICT (user_id) DO UPDATE SET auto = EXCLUDED.auto`;
    return extras(adv);
  });
}

