/**
 * Конвейер склада v2. Чистые функции, без UI и БД.
 * Формулы: info/ТЗ v2 «Склад» §3, §5–§8, §20–§23, §28
 * и механики Godot-ТЗ §6.3, §6.6–§6.7, §6.11, §8.3, §8.8, §13.5, §13.7.
 */
import type { StatKey } from './schemas.js';

export const JOB_CLASSES = ['loader', 'driver', 'crane', 'clerk', 'foreman', 'mechanic'] as const;
export type JobClass = (typeof JOB_CLASSES)[number];

export const ZONES = ['ramp', 'crane', 'fork', 'office', 'support'] as const;
export type ZoneId = (typeof ZONES)[number];

export const CARGO_TYPES = ['plain', 'fragile', 'heavy', 'oversize', 'perishable', 'hazard', 'rare'] as const;
export type CargoType = (typeof CARGO_TYPES)[number];

export type StatBlock = Record<StatKey, number>;

/** Веса v2 §3, интеллект разложен на cha и lck. */
export const CLASS_WEIGHTS: Record<JobClass, StatBlock> = {
  loader: { str: 0.5, end: 0.4, spd: 0.1, cha: 0, lck: 0 },
  driver: { str: 0, end: 0.2, spd: 0.5, cha: 0, lck: 0.3 },
  crane: { str: 0, end: 0.1, spd: 0.2, cha: 0.2, lck: 0.5 },
  clerk: { str: 0, end: 0, spd: 0, cha: 0.6, lck: 0.4 },
  foreman: { str: 0, end: 0.2, spd: 0, cha: 0.5, lck: 0.3 },
  mechanic: { str: 0.2, end: 0.1, spd: 0.1, cha: 0.35, lck: 0.25 },
};

export const K = { hand: 0.1, crane: 0.4, fork: 0.25, acc: 0.3 };

export interface Crew {
  id: string;
  job: JobClass;
  native: JobClass;
  /** Уже посчитанная мощность роли, как в эталоне §5.2. */
  power: number;
  zone: ZoneId;
  fatigue?: number;
  traits?: string[];
  morale?: number;
  shiftsWorked?: number;
  hidden?: 'lazy' | 'brawler' | 'clumsy' | 'thief' | null;
  hiddenSeen?: boolean;
}

export interface LineMods {
  mU?: number;
  mM?: number;
  mA?: number;
  mT?: number;
  heavyShare?: number;
  helpers?: number;
  forklifts?: number;
  mechanic?: boolean;
  night?: boolean;
  rush?: boolean;
  morale?: boolean;
  /** Эталон §5.2 передаёт уже готовый power, без повторного ×1.15. */
  applyNative?: boolean;
  applyTraits?: boolean;
}

export interface LineResult {
  hand: number;
  crane: number;
  unload: number;
  move: number;
  account: number;
  tonsPerHour: number;
  bottleneck: 'unload' | 'move' | 'account';
  kgPerHour: number;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function fatigueMult(fatigue = 0): number {
  if (fatigue >= 100) return 0;
  if (fatigue >= 70) return 0.8;
  return 1;
}

export function moraleMult(morale = 60): number {
  return 0.8 + 0.4 * (clamp(morale, 0, 100) / 100);
}

export function traitPowerMult(job: JobClass, traits: string[] = []): number {
  let m = 1;
  if (job === 'loader' && traits.includes('strong')) m *= 1.15;
  if (job === 'clerk' && traits.includes('precise')) m *= 1.1;
  if (job === 'driver' && traits.includes('rash')) m *= 1.15;
  if (job === 'crane' && traits.includes('calm')) m *= 1.1;
  if (traits.includes('workaholic')) m *= 1.1;
  if (traits.includes('slacker')) m *= 0.9;
  if (traits.includes('lazy')) m *= 0.9;
  return m;
}

export function synergyMult(traits: string[] = [], zoneTraits: string[][]): number {
  let m = 1;
  const others = zoneTraits.flat();
  if (traits.includes('host')) m *= 1; // aura applied to others
  if (traits.includes('chatter') && others.includes('grump')) m *= 0.9;
  if (traits.includes('grump') && others.includes('chatter')) m *= 0.9;
  if (traits.includes('perfect') && others.includes('slacker')) m *= 0.95;
  return clamp(m, 0.7, 1.5);
}

export function memberPower(c: Crew, zoneMates: string[][], mods: LineMods): number {
  let p = c.power * fatigueMult(c.fatigue) * traitPowerMult(c.job, c.traits);
  if (c.job === c.native) p *= 1.15;
  p *= synergyMult(c.traits, zoneMates);
  if (mods.night && !(c.traits ?? []).includes('owl')) p *= 0.9;
  if (mods.night && (c.traits ?? []).includes('owl')) p *= 1.15;
  if (mods.morale) p *= moraleMult(c.morale);
  if ((c.traits ?? []).includes('host')) {
    /* сам не получает свою ауру дважды */
  }
  const aura = zoneMates.some((t) => t.includes('host')) || c.zone === 'support';
  if (aura && c.job !== 'foreman' && zoneMates.some((t) => t.includes('host'))) p *= 1.05;
  return p;
}

function zoneTraits(crew: Crew[], zone: ZoneId): string[][] {
  return crew.filter((c) => c.zone === zone).map((c) => c.traits ?? []);
}

function rolePower(c: Crew, mods: LineMods): number {
  let p = c.power * fatigueMult(c.fatigue);
  if (mods.morale) p *= moraleMult(c.morale);
  if (c.job === c.native && c.native) p *= mods.applyNative ? 1.15 : 1;
  p *= mods.applyTraits ? traitPowerMult(c.job, c.traits) : 1;
  if (mods.night && !(c.traits ?? []).includes('owl')) p *= 0.9;
  return p;
}

/** Эталон §5.2. Пустая стадия не обнуляет линию: берётся не ниже разгрузки. */
export function simulate(crew: Crew[], mods: LineMods = {}): LineResult {
  const hShare = mods.heavyShare ?? 0;
  const handP = crew.filter((c) => c.zone === 'ramp' && c.job === 'loader').reduce((s, c) => s + rolePower(c, mods), 0);
  const craneP = crew.filter((c) => c.zone === 'crane' && c.job === 'crane').reduce((s, c) => s + rolePower(c, mods), 0);
  const help = crew.filter((c) => c.zone === 'crane' && c.job === 'loader').length;
  const driveP = crew.filter((c) => c.zone === 'fork' && c.job === 'driver').reduce((s, c) => s + rolePower(c, mods), 0);
  const clerkP = crew.filter((c) => c.zone === 'office' && c.job === 'clerk').reduce((s, c) => s + rolePower(c, mods), 0);
  const hand = handP * K.hand;
  const crane = craneP * K.crane * (1 + Math.min(0.2, help * 0.1));
  const unloadBase = crane <= 0 ? hand : 1 / ((1 - hShare) / Math.max(hand, 1e-9) + hShare / Math.max(crane, 1e-9));
  const forks = mods.forklifts ?? Math.max(driveP > 0 ? 1 : 0, crew.filter((c) => c.zone === 'fork' && c.job === 'driver').length);
  const moveBase = driveP > 0 ? Math.min(driveP * K.fork, forks * driveP * K.fork) : hand;
  const accountBase = clerkP > 0 ? clerkP * K.acc : hand;
  const mT = clamp((mods.mT ?? 1) * (mods.rush ? 1.5 : 1) * (mods.mechanic ? 1.05 : 1), 0.5, 1.5);
  const u = unloadBase * (mods.mU ?? 1);
  const m = (driveP > 0 ? driveP * K.fork : hand) * (mods.mM ?? 1);
  const a = accountBase * (mods.mA ?? 1);
  const stages = [
    { id: 'unload' as const, v: u },
    { id: 'move' as const, v: m },
    { id: 'account' as const, v: a },
  ];
  const bottleneck = stages.reduce((x, y) => (y.v < x.v ? y : x));
  const tonsPerHour = bottleneck.v * (mT > 1.5 ? 1.5 : mT);
  return { hand, crane, unload: u, move: m, account: a, tonsPerHour, bottleneck: bottleneck.id, kgPerHour: tonsPerHour * 1000 };
}

/** Час v2 на рампе не ниже часа v1: кг/ч = power × cargo_per_power × 3600. */
export function legacyFloorKgPerHour(power: number, cargoPerPower: number): number {
  return power * cargoPerPower * 3600;
}

export function classFromStats(stats: StatBlock): JobClass {
  const ranked: [JobClass, number][] = [
    ['loader', stats.str + stats.end],
    ['driver', stats.spd],
    ['crane', stats.lck],
    ['clerk', stats.cha],
  ];
  return ranked.sort((a, b) => b[1] - a[1])[0]![0];
}

/** Фильтр биржи: вес выбранного класса ×3, без гарантии. */
export function classPickWeight(job: JobClass, seek: JobClass | null): number {
  if (!seek) return 1;
  return job === seek ? 3 : 1;
}

export function courseCost(base: number, previousCourses: number): number {
  return base * 2 ** previousCourses;
}

export interface TonsContract {
  targetTons: number;
  deadlineHours: number;
  progressTons: number;
  heavyShare: number;
}

export function contractForecast(c: TonsContract, tonsPerHour: number): { etaHours: number; makeIt: boolean } {
  const left = Math.max(0, c.targetTons - c.progressTons);
  const eta = tonsPerHour <= 0 ? Infinity : left / tonsPerHour;
  return { etaHours: eta, makeIt: eta <= c.deadlineHours };
}

export function applyRush(baseTons: number): number {
  return baseTons * 1.5;
}

/** Потолок вклада рывка к среднему доходу за цикл кнопки. */
export function rushShare(boostSec = 10, cooldownSec = 45): number {
  const cycle = boostSec + cooldownSec;
  return (boostSec * 0.5) / cycle;
}

export const EXPANSIONS = [
  { id: 'second_crane', rarity: 'common', plus: 'crane_slot', minus: 'fatigue_recovery' },
  { id: 'used_fork', rarity: 'common', plus: 'forklift', minus: 'breakdown' },
  { id: 'second_ramp', rarity: 'common', plus: 'ramp_slots', minus: null },
  { id: 'e_account', rarity: 'common', plus: 'account', minus: null },
  { id: 'smoke_room', rarity: 'common', plus: 'rest', minus: 'throughput' },
  { id: 'crony', rarity: 'rare', plus: 'contract_slot', minus: 'deadline' },
  { id: 'electric_fork', rarity: 'epic', plus: 'fork_k', minus: 'license' },
  { id: 'fire_check', rarity: 'common', plus: 'reward', minus: 'fine' },
] as const;

export function rollExpansions(seed: number, level: number): string[] {
  let x = (seed + level * 997) >>> 0;
  const rnd = () => {
    x = (1664525 * x + 1013904223) >>> 0;
    return x / 2 ** 32;
  };
  const pool = [...EXPANSIONS];
  const out: string[] = [];
  while (out.length < 3 && pool.length) {
    const i = Math.floor(rnd() * pool.length);
    out.push(pool.splice(i, 1)[0]!.id);
  }
  return out;
}

export function tierK(stage: number): number {
  return 3 ** Math.max(0, stage - 1);
}

export const MEGAPORT = [
  { tier: 1, tons: 0 },
  { tier: 2, tons: 8600 },
  { tier: 3, tons: 60000 },
  { tier: 4, tons: 450000 },
  { tier: 5, tons: 2_800_000 },
  { tier: 6, tons: 17_000_000 },
  { tier: 7, tons: 84_000_000 },
  { tier: 8, tons: 400_000_000 },
];

export function megaportTier(tons: number): number {
  let t = 1;
  for (const s of MEGAPORT) if (tons >= s.tons) t = s.tier;
  return t;
}

export interface EventOption {
  id: string;
  mT?: number;
  hours?: number;
  def?: boolean;
}

export interface EventCard {
  id: string;
  options: EventOption[];
}

export const STARTER_EVENTS: EventCard[] = [
  { id: 'slippery', options: [{ id: 'sand', mT: 0.85, hours: 2, def: true }, { id: 'as_is' }] },
  { id: 'rain', options: [{ id: 'tarp' }, { id: 'soak', mT: 0.75, hours: 6, def: true }] },
  { id: 'frost', options: [{ id: 'tea' }, { id: 'endure', def: true }] },
  { id: 'heat', options: [{ id: 'water', mT: 0.9, hours: 1 }, { id: 'work', def: true }] },
  { id: 'fork_break', options: [{ id: 'repair', mT: 0.7, hours: 1 }, { id: 'wait', mT: 0.5, hours: 4, def: true }] },
  { id: 'crane_jam', options: [{ id: 'tech' }, { id: 'go', def: true }] },
  { id: 'lube', options: [{ id: 'buy', mT: 1.08, hours: 8 }, { id: 'no', def: true }] },
  { id: 'extra_drop', options: [{ id: 'take' }, { id: 'refuse', def: true }] },
  { id: 'oversize_gate', options: [{ id: 'accept', mT: 0.8, hours: 3 }, { id: 'refuse', def: true }] },
  { id: 'picky', options: [{ id: 'recheck' }, { id: 'sign', def: true }] },
  { id: 'fire_inspect', options: [{ id: 'prep', mT: 0.9, hours: 2, def: true }, { id: 'deal' }] },
  { id: 'safety', options: [{ id: 'brief', mT: 0.85, hours: 1, def: true }, { id: 'skip' }] },
  { id: 'quarrel', options: [{ id: 'split', mT: 0.95, hours: 2 }, { id: 'let', def: true }] },
  { id: 'friends', options: [{ id: 'break', mT: 0.97, hours: 1, def: true }, { id: 'work' }] },
  { id: 'birthday', options: [{ id: 'cake', mT: 0.9, hours: 1 }, { id: 'pass', def: true }] },
  { id: 'rookie', options: [{ id: 'mentor', mT: 0.93, hours: 4 }, { id: 'deep', mT: 1.03, hours: 4, def: true }] },
  { id: 'sign_day', options: [{ id: 'heed', mT: 1.03, hours: 12 }, { id: 'ignore', def: true }] },
  { id: 'wallet', options: [{ id: 'return', def: true }, { id: 'keep' }] },
  { id: 'party', options: [{ id: 'throw', mT: 0.8, hours: 2 }, { id: 'later', def: true }] },
  { id: 'cleanup', options: [{ id: 'org', mT: 0.9, hours: 2 }, { id: 'no', def: true }] },
  { id: 'blogger', options: [{ id: 'show', mT: 0.95, hours: 2 }, { id: 'no', def: true }] },
  { id: 'books', options: [{ id: 'reboot', mT: 0.5, hours: 1 }, { id: 'manual', mT: 0.8, hours: 4, def: true }] },
  { id: 'poach', options: [{ id: 'raise' }, { id: 'no', def: true }] },
];

export function stackMods(mods: number[]): number {
  const raw = mods.slice(0, 4).reduce((a, b) => a * b, 1);
  return clamp(raw, 0.5, 1.5);
}

export function defaultOption(card: EventCard): EventOption {
  return card.options.find((o) => o.def) ?? card.options[0]!;
}

const ELEMENTS = ['fire', 'earth', 'air', 'water'] as const;
export type Element = (typeof ELEMENTS)[number];
const TEMPERS = ['choleric', 'sanguine', 'phlegmatic', 'melancholic'] as const;
export type Temper = (typeof TEMPERS)[number];

export function signOf(id: string): { sign: number; element: Element } {
  let h = 0;
  for (const ch of id) h = (h * 33 + ch.charCodeAt(0)) >>> 0;
  const sign = h % 12;
  const element = (['fire', 'earth', 'air', 'water'] as const)[sign % 4]!;
  return { sign, element };
}

export function temperOf(id: string): Temper {
  let h = 7;
  for (const ch of id) h = (h * 17 + ch.charCodeAt(0)) >>> 0;
  return TEMPERS[h % 4]!;
}

export function pairScore(a: { element: Element; temper: Temper }, b: { element: Element; temper: Temper }): number {
  let s = 0;
  if (a.element === b.element) s += 1;
  else if ((a.element === 'fire' && b.element === 'air') || (a.element === 'air' && b.element === 'fire') || (a.element === 'earth' && b.element === 'water') || (a.element === 'water' && b.element === 'earth')) s += 0.5;
  else if ((a.element === 'fire' && b.element === 'earth') || (a.element === 'earth' && b.element === 'fire') || (a.element === 'air' && b.element === 'water') || (a.element === 'water' && b.element === 'air')) s -= 0.5;
  else s -= 1;
  const key = [a.temper, b.temper].sort().join('+');
  const temper: Record<string, number> = {
    'phlegmatic+sanguine': 1,
    'melancholic+sanguine': 0.5,
    'choleric+phlegmatic': 0.5,
    'melancholic+phlegmatic': 0.5,
    'sanguine+sanguine': 0,
    'phlegmatic+phlegmatic': 0,
    'melancholic+melancholic': 0,
    'choleric+sanguine': 0,
    'choleric+melancholic': -0.5,
    'choleric+choleric': -1,
  };
  s += temper[key] ?? 0;
  return s;
}

export function pairMod(score: number): number {
  if (score >= 1.5) return 0.1;
  if (score >= 0.5) return 0.05;
  if (score <= -1.5) return -0.1;
  if (score <= -0.5) return -0.05;
  return 0;
}

export function chemistry(self: string, mates: string[]): number {
  if (!mates.length) return 0;
  const a = { element: signOf(self).element, temper: temperOf(self) };
  const avg = mates.reduce((s, id) => s + pairMod(pairScore(a, { element: signOf(id).element, temper: temperOf(id) })), 0) / mates.length;
  return clamp(avg, -0.1, 0.1);
}

export interface Fav {
  id: string;
  job: JobClass;
  order: number;
  fatigue: number;
  pinned?: boolean;
}

export function autofill(slots: { id: string; job: JobClass; waifuId: string | null; locked?: boolean }[], favs: Fav[], displace: boolean): typeof slots {
  const next = slots.map((s) => ({ ...s }));
  const used = new Set(next.map((s) => s.waifuId).filter(Boolean) as string[]);
  for (const f of [...favs].sort((a, b) => a.order - b.order)) {
    if (f.fatigue >= 70 || used.has(f.id)) continue;
    const empty = next.find((s) => s.job === f.job && !s.waifuId);
    if (empty) {
      empty.waifuId = f.id;
      used.add(f.id);
      continue;
    }
    if (!displace) continue;
    const victim = next
      .filter((s) => s.job === f.job && s.waifuId && !s.locked && !favs.some((x) => x.id === s.waifuId))
      .sort((a, b) => (a.waifuId! > b.waifuId! ? 1 : -1))[0];
    if (victim) {
      used.delete(victim.waifuId!);
      victim.waifuId = f.id;
      used.add(f.id);
    }
  }
  return next;
}

export const PHI: Record<CargoType, { unload: number; move: number; account: number; price: number }> = {
  plain: { unload: 1, move: 1, account: 1, price: 10 },
  fragile: { unload: 0.8, move: 0.8, account: 0.7, price: 22 },
  heavy: { unload: 0.3, move: 0.4, account: 0.8, price: 28 },
  oversize: { unload: 0.6, move: 0.3, account: 0.5, price: 60 },
  perishable: { unload: 1, move: 1, account: 1, price: 35 },
  hazard: { unload: 0.7, move: 0.7, account: 0.7, price: 80 },
  rare: { unload: 0.8, move: 0.8, account: 0.8, price: 120 },
};

export function harmonicPhi(mix: { type: CargoType; share: number }[], stage: 'unload' | 'move' | 'account'): number {
  const denom = mix.reduce((s, m) => s + m.share / PHI[m.type][stage], 0);
  return denom <= 0 ? 1 : 1 / denom;
}

export function defectShare(type: CargoType, attention: number, waitedSec = 0): number {
  if (type === 'fragile') return 0.04 * (1 - clamp(attention, 0, 200) / 200);
  if (type === 'perishable' && waitedSec > 120) return Math.min(0.5, ((waitedSec - 120) / 60) * 0.05);
  if (type === 'hazard') return 0.03;
  return type === 'plain' ? 0.005 : 0.01;
}

export function wage(job: JobClass, rarityMult: number, level: number): number {
  const base: Record<JobClass, number> = { loader: 10, driver: 16, crane: 24, clerk: 18, mechanic: 20, foreman: 30 };
  return base[job] * rarityMult * (1 + 0.04 * Math.max(0, level - 1));
}

export function payShift(coins: number, due: number): { coins: number; debtSteps: number; toReserve: boolean } {
  if (coins >= due) return { coins: coins - due, debtSteps: 0, toReserve: false };
  return { coins, debtSteps: 1, toReserve: false };
}

export function afterDebt(steps: number): { toReserve: boolean } {
  return { toReserve: steps >= 3 };
}

export function hiddenVisible(shiftsWorked: number): boolean {
  return shiftsWorked >= 3;
}

export const GEAR_BONUS = [4, 8, 13, 19, 26];

export function gearBonus(tier: number): number {
  return GEAR_BONUS[clamp(tier, 1, 5) - 1] ?? 0;
}

export function dailyScore(seed: string, assignment: string[], choices: number[]): number {
  let h = 0;
  const text = `${seed}|${assignment.join(',')}|${choices.join(',')}`;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 100000;
}

export function unionReward(progress: number, goal: number, personalShare: number): number {
  if (personalShare < 0.01 || goal <= 0) return 0;
  const r = progress / goal;
  if (r >= 1.5) return 120;
  if (r >= 1) return 70;
  if (r >= 0.75) return 40;
  if (r >= 0.5) return 20;
  if (r >= 0.25) return 10;
  return 0;
}

export interface Fighter {
  id: string;
  power: number;
  job: JobClass;
}

export function disciplineScore(team: Fighter[], weights: StatBlock, profile: JobClass | null, chem: number, chemWeight: number, noise: number): number {
  const raw = team.reduce((s, f) => s + f.power * (1 + chem * chemWeight), 0);
  const fit = profile && team.some((f) => f.job === profile) ? 1.3 : profile ? 0.85 : 1;
  return raw * fit * noise * (weights.str + weights.end + weights.spd + weights.cha + weights.lck || 1);
}

export function matchWinner(aWins: number, bWins: number): 'a' | 'b' | 'draw' {
  if (aWins === bWins) return 'draw';
  return aWins > bWins ? 'a' : 'b';
}

export function bestOfThree(rounds: boolean[]): 'a' | 'b' {
  const a = rounds.filter(Boolean).length;
  return a >= 2 ? 'a' : 'b';
}
