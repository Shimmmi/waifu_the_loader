/**
 * Линия терминала для браузера.
 * Правила: info/ТЗ «Терминал „Тупик-9“» §5, §6.3, §8, §10.
 * Пиксельная сетка не используется.
 */
import terminalJson from '../../config/terminal.json';
import type { StatKey } from './schemas.js';

export const TERMINAL_CONFIG = terminalJson;

export const TERMINAL_JOBS = ['loader', 'driver', 'crane', 'clerk', 'mechanic', 'foreman'] as const;
export type TerminalJob = (typeof TERMINAL_JOBS)[number];
export const STATIONS = ['unload', 'move', 'store'] as const;
export type Station = (typeof STATIONS)[number];
export type ElementName = 'fire' | 'earth' | 'air' | 'water';
export type Psychotype = 'work' | 'soul' | 'grump' | 'sly' | 'quiet' | 'rebel';

type StatBlock = Record<StatKey, number>;

/** Веса Godot §6.3: СИЛ ЛОВ ТОЧ ВЫН СМЕК → str spd lck end cha. */
export const JOB_WEIGHTS: Record<TerminalJob, StatBlock> = {
  loader: { str: 0.35, spd: 0.15, lck: 0.1, end: 0.3, cha: 0.1 },
  driver: { str: 0.1, spd: 0.3, lck: 0.3, end: 0.1, cha: 0.2 },
  crane: { str: 0.1, spd: 0.1, lck: 0.35, end: 0.15, cha: 0.3 },
  clerk: { str: 0.1, spd: 0.1, lck: 0.35, end: 0.1, cha: 0.35 },
  mechanic: { str: 0.2, spd: 0.1, lck: 0.25, end: 0.1, cha: 0.35 },
  foreman: { str: 0.2, spd: 0.1, lck: 0.15, end: 0.25, cha: 0.3 },
};

/** Соответствие класса станции, Godot §6.3. Чужой класс не ноль. */
export const CLASS_FIT: Record<Station, Record<TerminalJob, number>> = {
  unload: { loader: 1, driver: 0.4, crane: 0.7, clerk: 0.2, mechanic: 0.2, foreman: 0.2 },
  move: { loader: 0.5, driver: 1, crane: 0.2, clerk: 0.2, mechanic: 0.2, foreman: 0.2 },
  store: { loader: 0.5, driver: 0.4, crane: 0.2, clerk: 1, mechanic: 0.2, foreman: 0.2 },
};

export const LINE_AUTO = { unload: 3, move: 4, store: 4 };
export const LINE_BASE = { unload: 12, move: 18, store: 15 };

export interface LineWorker {
  id: string;
  job: TerminalJob;
  stats: StatBlock;
  station: Station | 'support' | null;
  fatigue?: number;
  element?: ElementName;
  psycho?: Psychotype;
}

export interface TerminalMods {
  rush?: boolean;
  mode?: 'easy' | 'normal' | 'hard';
  synergy?: number;
  neighbors?: string[];
}

export interface LineRates {
  unload: number;
  move: number;
  store: number;
  tonsPerMin: number;
  bottleneck: Station;
  kgPerSec: number;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function skillIndex(job: TerminalJob, stats: StatBlock): number {
  const w = JOB_WEIGHTS[job];
  return (Object.keys(w) as StatKey[]).reduce((s, k) => s + w[k] * stats[k], 0);
}

export function fatigueMul(fatigue = 0): number {
  if (fatigue >= 100) return 0;
  if (fatigue >= 80) return 0.75;
  if (fatigue <= 50) return 1;
  return 1 - ((fatigue - 50) / 30) * 0.25;
}

export function stationRate(station: Station, workers: LineWorker[], mods: TerminalMods = {}): number {
  const sum = workers
    .filter((w) => w.station === station && fatigueMul(w.fatigue) > 0)
    .reduce((s, w) => s + (skillIndex(w.job, w.stats) / 25) * CLASS_FIT[station][w.job] * fatigueMul(w.fatigue), 0);
  let rate = LINE_AUTO[station] + LINE_BASE[station] * sum;
  const mode = mods.mode ?? 'normal';
  if (mode === 'easy') rate *= 0.8;
  if (mode === 'hard') rate *= 1.3;
  if (mods.rush) rate *= 1.5;
  const support = workers.filter((w) => w.station === 'support');
  if (support.some((w) => w.job === 'foreman')) rate *= 1.05;
  if (support.some((w) => w.job === 'mechanic') && station === 'move') rate *= 1.05;
  if (mods.synergy) rate *= 1 + (mods.synergy / 100) * 0.5;
  if (mods.neighbors?.length) rate *= neighborMul(station, mods.neighbors);
  return rate;
}

export function neighborMul(station: Station, bonuses: string[]): number {
  let m = 1;
  if (bonuses.includes('flow')) m *= 1.05;
  if (bonuses.includes('heavy') && station === 'unload') m *= 1.08;
  if (bonuses.includes('move') && station === 'move') m *= 1.05;
  if (bonuses.includes('repair') && station === 'move') m *= 1.03;
  if (bonuses.includes('spoil') && station === 'store') m *= 1.04;
  if (bonuses.includes('parts')) m *= 1.02;
  return m;
}

export function simulateLine(workers: LineWorker[], mods: TerminalMods = {}, kgPerTon = 1000): LineRates {
  const unload = stationRate('unload', workers, mods);
  const move = stationRate('move', workers, mods);
  const store = stationRate('store', workers, mods);
  const stages: [Station, number][] = [
    ['unload', unload],
    ['move', move],
    ['store', store],
  ];
  const [bottleneck, tonsPerMin] = stages.reduce((a, b) => (b[1] < a[1] ? b : a));
  return { unload, move, store, tonsPerMin, bottleneck, kgPerSec: (tonsPerMin * kgPerTon) / 60 };
}

export function unloadSlots(pierLevel: number): number {
  return Math.min(6, 1 + Math.floor(pierLevel / 4));
}
export function moveSlots(pierLevel: number, hasGarage: boolean): number {
  if (!hasGarage) return 0;
  return Math.max(1, Math.min(4, Math.floor(pierLevel / 3)));
}
export function storeSlots(warehouseLevel: number): number {
  return Math.min(4, 1 + Math.floor(warehouseLevel / 5));
}

export const SECTORS = [
  'pier',
  'warehouse',
  'office',
  'dorm',
  'canteen',
  'rest',
  'garage',
  'school',
  'crane',
  'dispatch',
  'fridge',
  'workshop',
  'bunker',
  'garden',
  'observatory',
] as const;
export type SectorType = (typeof SECTORS)[number];

export const STARTER_SECTORS: SectorType[] = ['pier', 'warehouse', 'office', 'dorm'];

const ADJACENT: [SectorType, SectorType, string][] = [
  ['canteen', 'dorm', 'rest'],
  ['canteen', 'pier', 'morale'],
  ['warehouse', 'pier', 'flow'],
  ['garage', 'pier', 'move'],
  ['garage', 'workshop', 'repair'],
  ['crane', 'pier', 'heavy'],
  ['school', 'rest', 'xp'],
  ['dispatch', 'office', 'contract'],
  ['workshop', 'warehouse', 'parts'],
  ['fridge', 'warehouse', 'spoil'],
];

export function neighborBonus(built: SectorType[]): string[] {
  const has = new Set(built);
  return ADJACENT.filter(([a, b]) => has.has(a) && has.has(b)).map(([, , name]) => name);
}

function hash(text: string): number {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

const OFFER_POOL: SectorType[] = ['warehouse', 'office', 'dorm', 'canteen', 'rest', 'garage', 'school', 'crane', 'dispatch', 'fridge', 'workshop'];

export function expansionOffer(userId: string, n: number, reroll: number, built: SectorType[], need: SectorType | null): SectorType[] {
  const rnd = mulberry(hash(`${userId}:expand:${n}:${reroll}`));
  const pool = OFFER_POOL.filter((s) => !built.includes(s));
  const out: SectorType[] = [];
  if (need && pool.includes(need)) out.push(need);
  while (out.length < 3 && pool.length) {
    const i = Math.floor(rnd() * pool.length);
    const pick = pool.splice(i, 1)[0]!;
    if (!out.includes(pick)) out.push(pick);
  }
  const secrets: SectorType[] = ['bunker', 'garden', 'observatory'];
  if (reroll === 0 && out.length > 1 && hash(`${userId}:find:${n}`) % 40 === 0) {
    const secret = secrets.find((s) => !built.includes(s) && !out.includes(s));
    if (secret) out[out.length - 1] = secret;
  }
  return out.slice(0, 3);
}

export function expansionNeed(built: SectorType[]): SectorType | null {
  if (!built.includes('warehouse')) return 'warehouse';
  if (!built.includes('garage')) return 'garage';
  if (!built.includes('canteen')) return 'canteen';
  return null;
}

export function supportOpen(built: SectorType[], expansions: number): { foreman: boolean; mechanic: boolean } {
  return {
    foreman: expansions >= 1 && built.includes('office'),
    mechanic: built.includes('garage') || built.includes('workshop'),
  };
}

export function upgradeCost(level: number): number {
  return expandCost(level);
}

export function upgradeSeconds(level: number): number {
  return level < 5 ? 0 : 120 * level;
}

function mulberry(seed: number): () => number {
  let a = seed || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function expandCost(n: number): number {
  return Math.round(400 * 2.1 ** n);
}
export function rerollCost(n: number, r: number): number {
  return Math.round(expandCost(n) * 0.15 * 2 ** r);
}
export function demolishRefund(spent: number): number {
  return Math.floor(spent * 0.4);
}
export function cancelBuildRefund(spent: number): number {
  return Math.floor(spent * 0.8);
}

const ELEMENTS: ElementName[] = ['fire', 'earth', 'air', 'water'];
const PSYCHOS: Psychotype[] = ['work', 'soul', 'grump', 'sly', 'quiet', 'rebel'];

export function elementOf(id: string): ElementName {
  return ELEMENTS[hash(id + ':el') % 4]!;
}
export function psychoOf(id: string): Psychotype {
  return PSYCHOS[hash(id + ':ps') % 6]!;
}

const STAR: Record<ElementName, Record<ElementName, number>> = {
  fire: { fire: 5, earth: -5, air: 15, water: -15 },
  earth: { fire: -5, earth: 5, air: -10, water: 15 },
  air: { fire: 15, earth: -10, air: 5, water: -5 },
  water: { fire: -15, earth: 15, air: -5, water: 5 },
};
const PSY: Record<Psychotype, Record<Psychotype, number>> = {
  work: { work: 5, soul: 5, grump: -5, sly: -5, quiet: 10, rebel: -10 },
  soul: { work: 5, soul: 10, grump: -10, sly: 5, quiet: 10, rebel: 5 },
  grump: { work: -5, soul: -10, grump: 5, sly: 0, quiet: 10, rebel: -5 },
  sly: { work: -5, soul: 5, grump: 0, sly: 5, quiet: 0, rebel: 10 },
  quiet: { work: 10, soul: 10, grump: 10, sly: 0, quiet: 5, rebel: 0 },
  rebel: { work: -10, soul: 5, grump: -5, sly: 10, quiet: 0, rebel: 5 },
};

export function classChem(a: TerminalJob, b: TerminalJob): number {
  const key = [a, b].sort().join('+');
  const table: Record<string, number> = {
    'crane+foreman': 6,
    'clerk+driver': 6,
    'driver+mechanic': 5,
    'clerk+foreman': 5,
    'crane+loader': 4,
  };
  return table[key] ?? 0;
}

function termPairScore(a: LineWorker, b: LineWorker, friendship = 0): number {
  const elA = a.element ?? elementOf(a.id);
  const elB = b.element ?? elementOf(b.id);
  const psA = a.psycho ?? psychoOf(a.id);
  const psB = b.psycho ?? psychoOf(b.id);
  const star = elA === elB && a.id !== b.id ? STAR[elA][elB] : STAR[elA][elB];
  const sameSign = hash(a.id + ':el') % 12 === hash(b.id + ':el') % 12;
  return clamp((sameSign ? 8 : star) + PSY[psA][psB] + friendship * 2 + classChem(a.job, b.job), -25, 30);
}

export function lineSynergy(workers: LineWorker[], friends: Record<string, number> = {}): number {
  const on = workers.filter((w) => w.station);
  if (on.length < 2) return 0;
  let sum = 0;
  let n = 0;
  for (let i = 0; i < on.length; i++) {
    for (let j = i + 1; j < on.length; j++) {
      const a = on[i]!;
      const b = on[j]!;
      const key = [a.id, b.id].sort().join('|');
      sum += termPairScore(a, b, friends[key] ?? 0);
      n++;
    }
  }
  return n ? sum / n : 0;
}

export function moraleDelta(synergy: number, neighborMorale = false): number {
  return clamp(Math.round(synergy / 10) + (neighborMorale ? 1 : 0), -3, 3);
}

export function slotPreview(workers: LineWorker[], next: LineWorker): 'up' | 'same' | 'down' {
  const before = simulateLine(workers, { synergy: lineSynergy(workers) }).tonsPerMin;
  const after = simulateLine([...workers, next], { synergy: lineSynergy([...workers, next]) }).tonsPerMin;
  if (after > before * 1.01) return 'up';
  if (after < before * 0.99) return 'down';
  return 'same';
}

export type ShiftMode = 'easy' | 'normal' | 'hard';

export function shiftGrade(actual: number, expected: number): 'S' | 'A' | 'B' | 'C' | 'D' {
  const ratio = expected <= 0 ? 0 : actual / expected;
  if (ratio >= 1.25) return 'S';
  if (ratio >= 1.05) return 'A';
  if (ratio >= 0.85) return 'B';
  if (ratio >= 0.6) return 'C';
  return 'D';
}

export function rushAllowed(nowMs: number, readyAt: number, offline: boolean): boolean {
  return !offline && nowMs >= readyAt;
}

export function passiveShare(activeKg: number, passiveKg: number): number {
  return activeKg <= 0 ? 1 : passiveKg / activeKg;
}

export const JOB_NAME: Record<TerminalJob, string> = {
  loader: 'Грузчик',
  driver: 'Водитель',
  crane: 'Крановщик',
  clerk: 'Кладовщик',
  mechanic: 'Механик',
  foreman: 'Бригадир',
};

export const SECTOR_NAME: Record<SectorType, string> = {
  pier: 'Причал',
  warehouse: 'Склад',
  office: 'Офис',
  dorm: 'Общежитие',
  canteen: 'Столовая',
  rest: 'Комната отдыха',
  garage: 'Гараж',
  school: 'Учебка',
  crane: 'Кран-ангар',
  dispatch: 'Диспетчерская',
  fridge: 'Рефрижератор',
  workshop: 'Мастерская',
  bunker: 'Бункер',
  garden: 'Оранжерея',
  observatory: 'Обсерватория',
};

export const STATION_NAME: Record<Station | 'support', string> = {
  unload: 'Разгрузка',
  move: 'Перемещение',
  store: 'Размещение',
  support: 'Поддержка',
};

export function jobFromStats(stats: StatBlock): TerminalJob {
  const ranked = TERMINAL_JOBS.filter((j) => j !== 'foreman' && j !== 'mechanic').map((job) => ({ job, si: skillIndex(job, stats) }));
  return ranked.sort((a, b) => b.si - a.si)[0]!.job;
}
