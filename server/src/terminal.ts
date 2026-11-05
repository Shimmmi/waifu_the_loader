/**
 * Действия терминала. Доход линии подменяет старый груз только если app_flags.terminal.live.
 * Флаг ставит одноразовый скрипт вайпа, не старт сервера.
 */
import {
  addStats,
  D,
  dstr,
  expansionNeed,
  expansionOffer,
  expandCost,
  jobFromStats,
  lineSynergy,
  moraleDelta,
  neighborBonus,
  rerollCost,
  SECTORS,
  SECTOR_NAME,
  simulateLine,
  slotPreview,
  STARTER_SECTORS,
  STATION_NAME,
  supportOpen,
  TERMINAL_CONFIG,
  TERMINAL_JOBS,
  upgradeCost,
  upgradeSeconds,
  cancelBuildRefund,
  demolishRefund,
  rushAllowed,
  shiftGrade,
  moveSlots,
  storeSlots,
  unloadSlots,
  type LineWorker,
  type NoticeDTO,
  type Rates,
  type SectorType,
  type ShiftMode,
  type Station,
  type StatBlock,
  type TerminalJob,
  type TerminalDTO,
} from '@wl/shared';
import { sql, type Sql, type Tx } from './db.js';

type Db = Sql | Tx;
import { advance, GameError, spend, type AdvanceResult, type Player } from './player.js';
import { cryptoRandom } from './rng.js';

export const TERMINAL_INTRO =
  'Смена правил: терминал считает груз по линии из трёх станций. Прогресс склада сброшен, карточки на месте.';

const JOKES = [
  '{name} говорит, что узкое место — это не она.',
  '{name} пересчитала коробки дважды и один раз от души.',
  '{name} нашла лишнюю палету и сделала вид, что так и было.',
];

const STATION_SET = new Set<string>(['unload', 'move', 'store', 'support']);

export interface TermRow {
  user_id: string;
  expand_n: number;
  rerolls: number;
  offer: SectorType[];
  mode: ShiftMode;
  shift_started_at: Date | null;
  shift_ends_at: Date | null;
  trial_done: boolean;
  rush_until: Date | null;
  rush_ready_at: Date | null;
  shift_kg: string;
  shift_coins: string;
  expected_kg: string;
  report: TerminalReport | null;
  seen_intro: boolean;
  pairs: Record<string, number>;
  courses: Record<string, number>;
  morale: number;
  building_until: Date | null;
  building_sector: string | null;
  building_spent: number;
  auto_shift: boolean;
}

export interface TerminalReport {
  grade: string;
  tons: number;
  coins: string;
  defect: number;
  best: string;
  joke: string;
  conflict: boolean;
}

export interface TermClock {
  shiftEnd: number | null;
  buildEnd: number | null;
  rushStart: number | null;
  rushEnd: number | null;
}

interface CrewRow {
  id: string;
  name: string;
  current_class: string | null;
  station: string | null;
  zone: string | null;
  fatigue: number;
  stats: StatBlock;
  stat_bonus: Partial<StatBlock>;
}

export async function terminalLive(db: Db): Promise<boolean> {
  const [row] = await db<{ value: { live?: boolean } }[]>`SELECT value FROM app_flags WHERE key = 'terminal'`;
  return row?.value?.live === true;
}

export async function ensureTerminal(tx: Db, userId: string): Promise<void> {
  await tx`INSERT INTO terminal_state (user_id) VALUES (${userId}) ON CONFLICT DO NOTHING`;
  for (const sector of STARTER_SECTORS) {
    await tx`INSERT INTO terminal_sectors (user_id, sector) VALUES (${userId}, ${sector}) ON CONFLICT DO NOTHING`;
  }
}

export async function loadTerm(tx: Db, userId: string): Promise<TermRow> {
  const [row] = await tx<TermRow[]>`SELECT * FROM terminal_state WHERE user_id = ${userId}`;
  if (!row) throw new GameError('no_terminal', 'Терминал ещё не включён');
  return row;
}

export function termClock(row: TermRow): TermClock {
  const rushEnd = row.rush_until?.getTime() ?? null;
  return {
    shiftEnd: row.shift_ends_at?.getTime() ?? null,
    buildEnd: row.building_until?.getTime() ?? null,
    rushStart: rushEnd === null ? null : rushEnd - TERMINAL_CONFIG.rushSec * 1000,
    rushEnd,
  };
}

export async function finishDueBuilds(tx: Tx, userId: string, at: Date): Promise<void> {
  const due = await tx<{ building_sector: string; building_spent: number }[]>`
    SELECT building_sector, building_spent FROM terminal_state
    WHERE user_id = ${userId} AND building_until IS NOT NULL AND building_until <= ${at} AND building_sector IS NOT NULL`;
  for (const row of due) {
    await tx`
      UPDATE terminal_sectors SET level = LEAST(level + 1, 20), spent = spent + ${row.building_spent}
      WHERE user_id = ${userId} AND sector = ${row.building_sector}`;
  }
  if (due.length) {
    await tx`
      UPDATE terminal_state SET building_until = NULL, building_sector = NULL, building_spent = 0
      WHERE user_id = ${userId}`;
  }
}

async function sectorsOf(tx: Db, userId: string): Promise<{ sector: SectorType; level: number; spent: number }[]> {
  return tx<{ sector: SectorType; level: number; spent: number }[]>`
    SELECT sector, level, spent FROM terminal_sectors WHERE user_id = ${userId}`;
}

async function crewRows(tx: Db, userId: string): Promise<CrewRow[]> {
  return tx<CrewRow[]>`
    SELECT i.id, p.name, i.current_class, i.station, i.zone, i.fatigue, p.stats, i.stat_bonus
    FROM waifu_instances i JOIN waifu_pool p ON p.id = i.pool_id
    WHERE i.user_id = ${userId} AND i.station IS NOT NULL`;
}

function asJob(value: string | null, stats: StatBlock): TerminalJob {
  if (value && (TERMINAL_JOBS as readonly string[]).includes(value)) return value as TerminalJob;
  return jobFromStats(stats);
}

function toWorker(row: CrewRow, station: LineWorker['station']): LineWorker {
  const stats = addStats(row.stats, row.stat_bonus ?? {}) as StatBlock;
  return { id: row.id, job: asJob(row.current_class, stats), stats, station, fatigue: row.fatigue };
}

async function lineContext(tx: Db, userId: string, rush: boolean): Promise<{ workers: LineWorker[]; kgPerSec: number; line: ReturnType<typeof simulateLine> }> {
  const term = await loadTerm(tx, userId);
  const builtRows = await sectorsOf(tx, userId);
  const built = builtRows.map((s) => s.sector);
  const neighbors = neighborBonus(built);
  const rows = await crewRows(tx, userId);
  const workers = rows
    .filter((r) => r.zone !== 'gym' && r.zone !== 'contract')
    .map((r) => toWorker(r, (r.station === 'support' ? 'support' : r.station) as LineWorker['station']));
  const synergy = lineSynergy(workers, term.pairs ?? {});
  const mods = { rush, mode: term.mode, synergy, neighbors };
  const line = simulateLine(workers, mods, TERMINAL_CONFIG.kgPerTon);
  return { workers, kgPerSec: line.kgPerSec, line };
}

export function applyLineCargo(rates: Rates, kgPerSec: number): Rates {
  const cargo = D(kgPerSec);
  const coins = rates.cargoPerSec.gt(0) ? rates.coinsPerSec.mul(cargo.div(rates.cargoPerSec)) : cargo.mul(rates.pricePerKg);
  return { ...rates, cargoPerSec: cargo, coinsPerSec: coins };
}

export function stopCargo(rates: Rates): Rates {
  return { ...rates, cargoPerSec: D(0), coinsPerSec: D(0) };
}

export async function ratesForLine(tx: Db, userId: string, rates: Rates, rush: boolean): Promise<Rates> {
  const { kgPerSec } = await lineContext(tx, userId, rush);
  return applyLineCargo(rates, kgPerSec);
}

/** Ставка, которую клиент рисует между тиками. Совпадает с тем, что advance записывает в базу. */
export async function presentRates(db: Db, userId: string, rates: Rates, now = new Date()): Promise<Rates> {
  if (!(await terminalLive(db))) return rates;
  await ensureTerminal(db, userId);
  const clock = termClock(await loadTerm(db, userId));
  const nowMs = now.getTime();
  const shiftOn = clock.shiftEnd !== null && clock.shiftEnd > nowMs;
  if (!shiftOn) return { ...stopCargo(rates), power: 0 };
  const rush = clock.rushStart !== null && clock.rushEnd !== null && nowMs >= clock.rushStart && nowMs < clock.rushEnd;
  const line = await ratesForLine(db, userId, rates, rush);
  return { ...line, power: 0 };
}

export async function addShiftTotals(tx: Tx, userId: string, kg: ReturnType<typeof D>, coins: ReturnType<typeof D>): Promise<void> {
  const term = await loadTerm(tx, userId);
  const nextKg = D(term.shift_kg).add(kg);
  const nextCoins = D(term.shift_coins).add(coins);
  await tx`UPDATE terminal_state SET shift_kg = ${dstr(nextKg)}, shift_coins = ${dstr(nextCoins)} WHERE user_id = ${userId}`;
}

export async function startShiftIfIdle(tx: Tx, userId: string, now: Date): Promise<void> {
  const term = await loadTerm(tx, userId);
  if (term.shift_ends_at && term.shift_ends_at.getTime() > now.getTime()) return;
  const sec = term.trial_done ? TERMINAL_CONFIG.shiftSec : TERMINAL_CONFIG.trialShiftSec;
  const { kgPerSec } = await lineContext(tx, userId, false);
  const ends = new Date(now.getTime() + sec * 1000);
  await tx`
    UPDATE terminal_state SET shift_started_at = ${now}, shift_ends_at = ${ends}, shift_kg = '0', shift_coins = '0',
      expected_kg = ${String(kgPerSec * sec)}
    WHERE user_id = ${userId}`;
}

export async function closeShift(tx: Tx, userId: string): Promise<NoticeDTO | null> {
  const term = await loadTerm(tx, userId);
  if (!term.shift_ends_at && D(term.shift_kg).lte(0)) return null;
  const rows = await crewRows(tx, userId);
  const onLine = rows.filter((r) => r.zone !== 'gym' && r.zone !== 'contract');
  const built = (await sectorsOf(tx, userId)).map((s) => s.sector);
  const neighbors = neighborBonus(built);
  const workers = onLine.map((r) => toWorker(r, 'unload'));
  let best = onLine[0];
  let bestSi = -1;
  for (const row of onLine) {
    const w = toWorker(row, 'unload');
    const si = w.stats.str + w.stats.spd + w.stats.end;
    if (si > bestSi) {
      bestSi = si;
      best = row;
    }
  }
  const actual = D(term.shift_kg).toNumber();
  const expected = Number(term.expected_kg) || 0;
  const grade = shiftGrade(actual, expected);
  const name = best?.name ?? 'Смена';
  const joke = (JOKES[Math.floor(cryptoRandom() * JOKES.length)] ?? JOKES[0]!).replace('{name}', name);
  const delta = moraleDelta(lineSynergy(workers, term.pairs ?? {}), neighbors.includes('morale'));
  let morale = term.morale + delta;
  let conflict = false;
  if (morale <= -15 && onLine.length && cryptoRandom() < 0.35) {
    conflict = true;
    const victim = onLine[Math.floor(cryptoRandom() * onLine.length)]!;
    await tx`UPDATE waifu_instances SET station = NULL WHERE id = ${victim.id}`;
  }
  const pairs = { ...(term.pairs ?? {}) };
  for (let i = 0; i < onLine.length; i++) {
    for (let j = i + 1; j < onLine.length; j++) {
      const key = [onLine[i]!.id, onLine[j]!.id].sort().join('|');
      pairs[key] = Math.min(5, (pairs[key] ?? 0) + 1);
    }
  }
  const dorm = built.includes('dorm');
  for (const row of onLine) {
    const fatigue = Math.min(100, row.fatigue + (dorm ? 6 : 12));
    if (fatigue >= 100) {
      await tx`UPDATE waifu_instances SET fatigue = 100, fatigue_at = now(), station = NULL WHERE id = ${row.id}`;
    } else {
      await tx`UPDATE waifu_instances SET fatigue = ${fatigue}, fatigue_at = now() WHERE id = ${row.id}`;
    }
  }
  const report: TerminalReport = {
    grade,
    tons: actual / TERMINAL_CONFIG.kgPerTon,
    coins: term.shift_coins,
    defect: 0,
    best: name,
    joke,
    conflict,
  };
  await tx`
    UPDATE terminal_state SET shift_started_at = NULL, shift_ends_at = NULL, trial_done = true, shift_kg = '0', shift_coins = '0',
      expected_kg = '0', report = ${tx.json(report as never)}, pairs = ${tx.json(pairs as never)}, morale = ${morale}
    WHERE user_id = ${userId}`;
  const text = `Смена ${grade}: ${report.tons.toFixed(2)} т, ${report.coins} монет, брак 0. Лучшая — ${name}. ${joke}${conflict ? ' На линии конфликт, кого-то сняли со слота.' : ''}`;
  return { kind: 'achievement', outcome: 'info', waifuIds: best ? [best.id] : [], text, vars: {} };
}

function sectorOrThrow(id: string): SectorType {
  if (!(SECTORS as readonly string[]).includes(id)) throw new GameError('bad_sector', 'Нет такого сектора');
  return id as SectorType;
}

async function builtList(tx: Tx, userId: string): Promise<SectorType[]> {
  return (await sectorsOf(tx, userId)).map((s) => s.sector);
}

async function requireLive(tx: Tx): Promise<void> {
  if (!(await terminalLive(tx))) throw new GameError('terminal_off', 'Терминал включится в день смены правил');
}

export async function rollOffer(tx: Tx, userId: string): Promise<void> {
  await requireLive(tx);
  const term = await loadTerm(tx, userId);
  if (term.offer?.length) return;
  const built = await builtList(tx, userId);
  const offer = expansionOffer(userId, term.expand_n, term.rerolls, built, expansionNeed(built));
  await tx`UPDATE terminal_state SET offer = ${tx.json(offer)} WHERE user_id = ${userId}`;
}

export async function rerollOffer(tx: Tx, player: Player): Promise<void> {
  await requireLive(tx);
  const term = await loadTerm(tx, player.row.user_id);
  if (term.rerolls >= 3) throw new GameError('no_reroll', 'Переброс кончился');
  const cost = rerollCost(term.expand_n, term.rerolls);
  await spend(tx, player, { coins: D(cost) }, 'terminal_reroll', String(term.rerolls));
  const built = await builtList(tx, player.row.user_id);
  const next = term.rerolls + 1;
  const offer = expansionOffer(player.row.user_id, term.expand_n, next, built, expansionNeed(built));
  await tx`UPDATE terminal_state SET rerolls = ${next}, offer = ${tx.json(offer)} WHERE user_id = ${player.row.user_id}`;
}

export async function pickOffer(tx: Tx, player: Player, sectorId: string): Promise<void> {
  await requireLive(tx);
  const sector = sectorOrThrow(sectorId);
  const term = await loadTerm(tx, player.row.user_id);
  if (!term.offer?.includes(sector)) throw new GameError('bad_offer', 'Этой карточки нет в выборе');
  const cost = expandCost(term.expand_n);
  await spend(tx, player, { coins: D(cost) }, 'terminal_expand', sector);
  await tx`
    INSERT INTO terminal_sectors (user_id, sector, level, spent) VALUES (${player.row.user_id}, ${sector}, 1, ${cost})`;
  const auto = sector === 'dispatch';
  await tx`
    UPDATE terminal_state SET expand_n = expand_n + 1, rerolls = 0, offer = '[]'::jsonb,
      auto_shift = CASE WHEN ${auto} THEN true ELSE auto_shift END
    WHERE user_id = ${player.row.user_id}`;
}

export async function demolishSector(tx: Tx, player: Player, sectorId: string): Promise<void> {
  await requireLive(tx);
  const sector = sectorOrThrow(sectorId);
  if (sector === 'pier') throw new GameError('no_demolish', 'Причал не сносится');
  const term = await loadTerm(tx, player.row.user_id);
  if (term.building_sector === sector) throw new GameError('busy', 'Сектор ещё строится');
  const [row] = await tx<{ spent: number }[]>`
    SELECT spent FROM terminal_sectors WHERE user_id = ${player.row.user_id} AND sector = ${sector}`;
  if (!row) throw new GameError('no_sector', 'Сектор не построен');
  const refund = demolishRefund(row.spent);
  await tx`DELETE FROM terminal_sectors WHERE user_id = ${player.row.user_id} AND sector = ${sector}`;
  if (sector === 'garage') await tx`UPDATE waifu_instances SET station = NULL WHERE user_id = ${player.row.user_id} AND station = 'move'`;
  if (refund > 0) {
    const coins = player.res.coins.add(refund);
    player.res.coins = coins;
    await tx`UPDATE player_state SET coins = ${dstr(coins)} WHERE user_id = ${player.row.user_id}`;
    await tx`INSERT INTO currency_ledger (user_id, currency, delta, reason, ref) VALUES (${player.row.user_id}, 'coins', ${String(refund)}, 'terminal_demolish', ${sector})`;
  }
}

export async function upgradeSector(tx: Tx, player: Player, sectorId: string, now: Date): Promise<void> {
  await requireLive(tx);
  const sector = sectorOrThrow(sectorId);
  const term = await loadTerm(tx, player.row.user_id);
  if (term.building_until) throw new GameError('busy', 'Уже идёт стройка');
  const [row] = await tx<{ level: number }[]>`
    SELECT level FROM terminal_sectors WHERE user_id = ${player.row.user_id} AND sector = ${sector}`;
  if (!row) throw new GameError('no_sector', 'Сектор не построен');
  if (row.level >= 20) throw new GameError('cap', 'Сектор на потолке');
  const cost = upgradeCost(row.level);
  await spend(tx, player, { coins: D(cost) }, 'terminal_upgrade', sector);
  const sec = upgradeSeconds(row.level);
  if (sec <= 0) {
    await tx`UPDATE terminal_sectors SET level = level + 1, spent = spent + ${cost} WHERE user_id = ${player.row.user_id} AND sector = ${sector}`;
    return;
  }
  const until = new Date(now.getTime() + sec * 1000);
  await tx`
    UPDATE terminal_state SET building_until = ${until}, building_sector = ${sector}, building_spent = ${cost}
    WHERE user_id = ${player.row.user_id}`;
}

export async function cancelUpgrade(tx: Tx, player: Player): Promise<void> {
  await requireLive(tx);
  const term = await loadTerm(tx, player.row.user_id);
  if (!term.building_until) throw new GameError('no_build', 'Стройки нет');
  const refund = cancelBuildRefund(term.building_spent);
  await tx`UPDATE terminal_state SET building_until = NULL, building_sector = NULL, building_spent = 0 WHERE user_id = ${player.row.user_id}`;
  if (refund > 0) {
    const coins = player.res.coins.add(refund);
    player.res.coins = coins;
    await tx`UPDATE player_state SET coins = ${dstr(coins)} WHERE user_id = ${player.row.user_id}`;
    await tx`INSERT INTO currency_ledger (user_id, currency, delta, reason, ref) VALUES (${player.row.user_id}, 'coins', ${String(refund)}, 'terminal_cancel', ${term.building_sector ?? ''})`;
  }
}

async function slotCap(tx: Tx, userId: string, station: string): Promise<number> {
  const built = await sectorsOf(tx, userId);
  const pier = built.find((s) => s.sector === 'pier')?.level ?? 1;
  const warehouse = built.find((s) => s.sector === 'warehouse')?.level ?? 1;
  const types = built.map((s) => s.sector);
  if (station === 'unload') return unloadSlots(pier);
  if (station === 'move') return moveSlots(pier, types.includes('garage'));
  if (station === 'store') return storeSlots(warehouse);
  const term = await loadTerm(tx, userId);
  const open = supportOpen(types, term.expand_n);
  return (open.foreman ? 1 : 0) + (open.mechanic ? 1 : 0);
}

export async function assignStation(tx: Tx, userId: string, waifuId: string, station: string | null): Promise<void> {
  await requireLive(tx);
  if (station !== null && !STATION_SET.has(station)) throw new GameError('bad_station', 'Нет такой станции');
  const [w] = await tx<{ id: string; zone: string | null; station: string | null }[]>`
    SELECT id, zone, station FROM waifu_instances WHERE id = ${waifuId} AND user_id = ${userId}`;
  if (!w) throw new GameError('no_waifu', 'Нет такой грузчицы', 404);
  if (w.zone === 'gym' || w.zone === 'contract') throw new GameError('busy', 'Она занята и вернётся на своё место сама');
  if (station === null) {
    await tx`UPDATE waifu_instances SET station = NULL WHERE id = ${waifuId}`;
    return;
  }
  const cap = await slotCap(tx, userId, station);
  const [count] = await tx<{ n: number }[]>`
    SELECT count(*)::int AS n FROM waifu_instances WHERE user_id = ${userId} AND station = ${station} AND id <> ${waifuId}`;
  if ((count?.n ?? 0) >= cap) throw new GameError('no_slot', 'На станции нет места');
  await tx`UPDATE waifu_instances SET station = ${station}, zone = 'warehouse' WHERE id = ${waifuId}`;
}

export async function previewAssign(tx: Tx, userId: string, waifuId: string, station: string): Promise<'up' | 'same' | 'down'> {
  await requireLive(tx);
  if (!STATION_SET.has(station)) throw new GameError('bad_station', 'Нет такой станции');
  const rows = await crewRows(tx, userId);
  const [one] = await tx<CrewRow[]>`
    SELECT i.id, p.name, i.current_class, i.station, i.zone, i.fatigue, p.stats, i.stat_bonus
    FROM waifu_instances i JOIN waifu_pool p ON p.id = i.pool_id
    WHERE i.id = ${waifuId} AND i.user_id = ${userId}`;
  if (!one) throw new GameError('no_waifu', 'Нет такой грузчицы', 404);
  const current = rows.filter((r) => r.id !== waifuId && r.zone !== 'gym' && r.zone !== 'contract').map((r) => toWorker(r, r.station as LineWorker['station']));
  const next = toWorker(one, station as Station | 'support');
  return slotPreview(current, next);
}

export async function setMode(tx: Tx, userId: string, mode: ShiftMode): Promise<void> {
  await requireLive(tx);
  await tx`UPDATE terminal_state SET mode = ${mode} WHERE user_id = ${userId}`;
}

export async function setAuto(tx: Tx, userId: string, on: boolean): Promise<void> {
  await requireLive(tx);
  const built = await builtList(tx, userId);
  if (on && !built.includes('dispatch')) throw new GameError('no_dispatch', 'Автосмена открывается с диспетчерской');
  await tx`UPDATE terminal_state SET auto_shift = ${on} WHERE user_id = ${userId}`;
}

export async function triggerRush(tx: Tx, userId: string, now: Date): Promise<void> {
  await requireLive(tx);
  const term = await loadTerm(tx, userId);
  const ready = term.rush_ready_at?.getTime() ?? 0;
  if (!rushAllowed(now.getTime(), ready, false)) throw new GameError('rush_cd', 'Рывок ещё заряжается');
  const until = new Date(now.getTime() + TERMINAL_CONFIG.rushSec * 1000);
  const next = new Date(now.getTime() + TERMINAL_CONFIG.rushCooldownSec * 1000);
  await tx`UPDATE terminal_state SET rush_until = ${until}, rush_ready_at = ${next} WHERE user_id = ${userId}`;
}

export async function learnClass(tx: Tx, player: Player, waifuId: string, job: string): Promise<void> {
  await requireLive(tx);
  if (!(TERMINAL_JOBS as readonly string[]).includes(job)) throw new GameError('bad_job', 'Нет такого класса');
  const [w] = await tx<{ id: string }[]>`SELECT id FROM waifu_instances WHERE id = ${waifuId} AND user_id = ${player.row.user_id}`;
  if (!w) throw new GameError('no_waifu', 'Нет такой грузчицы', 404);
  const term = await loadTerm(tx, player.row.user_id);
  const n = term.courses?.[waifuId] ?? 0;
  const cost = 100 * 2 ** n;
  await spend(tx, player, { coins: D(cost) }, 'terminal_course', job);
  const courses = { ...(term.courses ?? {}), [waifuId]: n + 1 };
  await tx`UPDATE waifu_instances SET current_class = ${job} WHERE id = ${waifuId}`;
  await tx`UPDATE terminal_state SET courses = ${tx.json(courses)} WHERE user_id = ${player.row.user_id}`;
}

export async function ackTerminal(tx: Tx, userId: string, what: 'intro' | 'report'): Promise<void> {
  await requireLive(tx);
  if (what === 'intro') await tx`UPDATE terminal_state SET seen_intro = true WHERE user_id = ${userId}`;
  else await tx`UPDATE terminal_state SET report = NULL WHERE user_id = ${userId}`;
}

export async function terminalView(tx: Db, userId: string): Promise<TerminalDTO> {
  if (!(await terminalLive(tx))) return { live: false };
  await ensureTerminal(tx, userId);
  const term = await loadTerm(tx, userId);
  const builtRows = await sectorsOf(tx, userId);
  const built = builtRows.map((s) => s.sector);
  const neighbors = neighborBonus(built);
  const rows = await crewRows(tx, userId);
  const active = rows.filter((r) => r.zone !== 'gym' && r.zone !== 'contract');
  const workers = active.map((r) => toWorker(r, r.station as LineWorker['station']));
  const line = simulateLine(workers, { mode: term.mode, synergy: lineSynergy(workers, term.pairs ?? {}), neighbors }, TERMINAL_CONFIG.kgPerTon);
  const pier = builtRows.find((s) => s.sector === 'pier')?.level ?? 1;
  const warehouse = builtRows.find((s) => s.sector === 'warehouse')?.level ?? 1;
  const open = supportOpen(built, term.expand_n);
  const crew = (station: string) => rows.filter((r) => r.station === station).map((r) => r.id);
  return {
    live: true,
    intro: term.seen_intro ? undefined : TERMINAL_INTRO,
    sectors: builtRows.map((s) => ({ id: s.sector, name: SECTOR_NAME[s.sector], level: s.level })),
    neighbors,
    offer: (term.offer ?? []).map((id) => ({ id, name: SECTOR_NAME[id] })),
    rerolls: term.rerolls,
    rerollCost: rerollCost(term.expand_n, term.rerolls),
    expandCost: expandCost(term.expand_n),
    building: term.building_until && term.building_sector ? { sector: term.building_sector, name: SECTOR_NAME[term.building_sector as SectorType], until: term.building_until.toISOString() } : null,
    stations: {
      unload: { name: STATION_NAME.unload, rate: line.unload, slots: unloadSlots(pier), crew: crew('unload') },
      move: { name: STATION_NAME.move, rate: line.move, slots: moveSlots(pier, built.includes('garage')), crew: crew('move') },
      store: { name: STATION_NAME.store, rate: line.store, slots: storeSlots(warehouse), crew: crew('store') },
      support: { name: STATION_NAME.support, open: open.foreman || open.mechanic, slots: (open.foreman ? 1 : 0) + (open.mechanic ? 1 : 0), crew: crew('support') },
    },
    bottleneck: line.bottleneck,
    tonsPerMin: line.tonsPerMin,
    shift: { active: !!term.shift_ends_at, endsAt: term.shift_ends_at?.toISOString() ?? null, mode: term.mode, trial: !term.trial_done },
    rush: { until: term.rush_until?.toISOString() ?? null, readyAt: term.rush_ready_at?.toISOString() ?? null },
    report: term.report,
    morale: term.morale,
    autoShift: term.auto_shift,
    dispatch: built.includes('dispatch'),
  };
}

export async function terminalAct(
  userId: string,
  fn: (tx: Tx, player: Player) => Promise<void>,
): Promise<Pick<AdvanceResult, 'offlineReport' | 'milestoneTickets' | 'notices'>> {
  return sql.begin(async (tx) => {
    const adv = await advance(tx, userId);
    await fn(tx, adv.player);
    return { offlineReport: adv.offlineReport, milestoneTickets: adv.milestoneTickets, notices: adv.notices };
  });
}

export async function beginOnlineShift(tx: Tx, userId: string, now: Date): Promise<void> {
  const term = await loadTerm(tx, userId);
  if (term.shift_ends_at && term.shift_ends_at.getTime() > now.getTime()) return;
  if (!term.trial_done || term.auto_shift) await startShiftIfIdle(tx, userId, now);
}

export async function beginShift(tx: Tx, userId: string, now: Date): Promise<void> {
  await requireLive(tx);
  await startShiftIfIdle(tx, userId, now);
}
