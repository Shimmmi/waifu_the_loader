import { pairBond } from '../terminal.js';
import {
  STAT_KEYS,
  V3_RARITIES,
  type BaseCardSchema,
  type BuildingSchema,
  type CardSchema,
  type ClassSchema,
  type ContractSchema,
  type EconomyV3Schema,
  type Effect,
  type GachaV3Schema,
  type MetaNodeSchema,
  type MilestoneSchema,
  type RaceSchema,
  type TraitSchema,
  type Trigger,
  type V3Rarity,
  type StatKey,
} from './schema.js';
import type { z } from 'zod';

export type Race = z.infer<typeof RaceSchema>;
export type Job = z.infer<typeof ClassSchema>;
export type Trait = z.infer<typeof TraitSchema>;
export type BuildingDef = z.infer<typeof BuildingSchema>;
export type CardDef = z.infer<typeof CardSchema>;
export type BaseDef = z.infer<typeof BaseCardSchema>;
export type Milestone = z.infer<typeof MilestoneSchema>;
export type Economy = z.infer<typeof EconomyV3Schema>;
export type GachaDef = z.infer<typeof GachaV3Schema>;
export type MetaNode = z.infer<typeof MetaNodeSchema>;
export type ContractDef = z.infer<typeof ContractSchema>;

export interface Template {
  templateId: string;
  race: string;
  job: string;
  firstName: string;
  lastName: string;
  portrait: string;
  thumb: string;
}

export interface Catalog {
  races: Race[];
  classes: Job[];
  traits: Trait[];
  buildings: BuildingDef[];
  cards: CardDef[];
  bases: BaseDef[];
  milestones: Milestone[];
  economy: Economy;
  gacha: GachaDef;
  meta: MetaNode[];
  contracts: ContractDef[];
  bios: { class_id: string; tags: string[]; text: string }[];
  nicknames: string[];
  locale: Record<string, string>;
  story: {
    hero_default: string;
    hero_age: number;
    corp: string;
    planet: string;
    company_default: string;
    rival: string;
    rival_boss: string;
  };
  migration: { shard_to_star: number; rarity: Record<string, V3Rarity>; archetype_class: Record<string, string>; default_race: string };
  ui: { tabs: { id: string; name_ru: string }[] };
  templates: Template[];
}

export class V3Error extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export interface Cell {
  plotId: string;
  state: 'empty' | 'built';
  typeId?: string;
  level?: number;
  /** Карточка, выбранная при постройке этой комнаты. */
  bonusId?: string;
  /** Наёмницы, усиливающие бонус этой комнаты. Одна девушка — одно здание. */
  staff?: string[];
}
export interface Floor {
  z: number;
  cells: Cell[];
}
export interface Character {
  id: string;
  templateId: string | null;
  legacy: boolean;
  race: string;
  job: string;
  rarity: V3Rarity;
  firstName: string;
  lastName: string;
  nickname: string;
  bio: string;
  quote: string;
  traits: string[];
  level: number;
  xp: number;
  starRank: number;
  portrait: string;
  thumb: string;
  reserve: boolean;
}
export type ContractKind = 'credits' | 'stars' | 'hybrid';
export interface Offer {
  id: string;
  name: string;
  seconds: number;
  credits: number;
  stars: number;
  starter: boolean;
  kind: ContractKind;
  rarity: V3Rarity;
  /** Запасное имя уже заменено или оставляется как есть. Повторный заход его не трогает. */
  titled: boolean;
}
export interface ActiveContract {
  uid: string;
  id: string;
  name: string;
  endsAt: number;
  credits: number;
  stars: number;
  seconds?: number;
  kind?: ContractKind;
  rarity?: V3Rarity;
}
export interface Game {
  credits: number;
  stars: number;
  legacy: number;
  tonsTotal: number;
  tonsRun: number;
  pity: { rare: number; epic: number; legend: number };
  rebirths: number;
  expansions: number;
  cardDry: number;
  freeRerollsUsed: number;
  offerRerolls: number;
  baseRerolls: number;
  lastTick: number;
  flags: Record<string, number>;
  counters: Record<string, number>;
  seen: string[];
  queue: { speaker: string; text: string; milestoneId: string }[];
  journal: { id: string; title: string; lines: string[] }[];
  pendingCards: string[] | null;
  pendingPlotId: string | null;
  pendingBases: string[] | null;
  runCards: { id: string; stacks: number }[];
  base: { templateId: string; layout: 'shaft' | 'panorama'; floors: Floor[]; plotCap: number | null };
  spent: number;
  lastExpandCost: number;
  characters: Character[];
  offers: Offer[];
  active: ActiveContract[];
  company: string;
  motion: boolean;
  pendingFreeRolls: number;
  lastDaily: string;
  offline: { seconds: number; credits: number; tons: number } | null;
  metaLevel: Record<string, number>;
}

export type Action =
  | { type: 'roll'; count: 1 | 10; rng: () => number; ids: () => string; focus?: { kind: 'race' | 'job'; id: string } }
  | { type: 'expand'; kind: 'up' | 'down'; rng: () => number }
  | { type: 'pick-card'; id: string }
  | { type: 'reroll-cards'; rng: () => number }
  | { type: 'skip-cards' }
  | { type: 'build'; plotId: string; typeId: string; rng: () => number }
  | { type: 'upgrade'; plotId: string }
  | { type: 'assign'; plotId: string; characterId: string }
  | { type: 'unassign'; plotId: string; characterId: string }
  | { type: 'roster'; characterId: string; reserve: boolean; swapWith?: string }
  | { type: 'rebirth-preview'; rng: () => number }
  | { type: 'rebirth-confirm'; id: string }
  | { type: 'reroll-bases'; rng: () => number }
  | { type: 'meta'; id: string }
  | { type: 'story-ack'; skip: boolean }
  | { type: 'contract-start'; id: string }
  | { type: 'rename'; company: string }
  | { type: 'gramota'; slot: 0 | 1 | 2 }
  | { type: 'motion'; on: boolean }
  | { type: 'ending'; id: 'sell' | 'refuse' | 'buy' }
  | { type: 'ack-offline' }
  | { type: 'daily'; day: string };

const RANK: Record<V3Rarity, number> = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };
const BANNED = ['лоли', 'школьниц', 'ребёнок', 'ребенок', 'little girl', 'loli', 'child'];

export function rarityRank(r: V3Rarity): number {
  return RANK[r];
}

export function weightedIndex(rng: () => number, weights: number[]): number {
  let sum = 0;
  for (const w of weights) sum += Math.max(0, w);
  if (sum <= 0) return 0;
  let x = rng() * sum;
  for (let i = 0; i < weights.length; i++) {
    x -= Math.max(0, weights[i] ?? 0);
    if (x < 0) return i;
  }
  return Math.max(0, weights.length - 1);
}

export function traitR(traits: { sign: '+' | '-'; tier: number }[]): number {
  let r = 0;
  for (const t of traits) r += t.sign === '+' ? t.tier : -0.75 * t.tier;
  return r;
}

export function inWindow(r: number, w: { min?: number; max?: number }): boolean {
  if (w.min != null && r < w.min - 1e-9) return false;
  if (w.max != null && r > w.max + 1e-9) return false;
  return true;
}

function canAdd(have: Trait[], t: Trait, n: number): boolean {
  if (have.some((h) => h.id === t.id)) return false;
  if (have.some((h) => h.conflicts.includes(t.id) || t.conflicts.includes(h.id))) return false;
  if (t.sign === '-') {
    const neg = have.filter((h) => h.sign === '-').length + 1;
    if (neg > 2 || neg > Math.floor(n / 2)) return false;
  }
  return true;
}

function forceTraits(pool: Trait[], slots: { min: number; max: number }, window: { min?: number; max?: number }): Trait[] | null {
  const pos = pool.filter((t) => t.sign === '+');
  const strong = [...pos].sort((a, b) => b.tier - a.tier || a.id.localeCompare(b.id));
  const weak = [...pos].sort((a, b) => a.tier - b.tier || a.id.localeCompare(b.id));
  for (let n = slots.max; n >= slots.min; n--) {
    if (strong.length < n) continue;
    let acc = strong.slice(0, n);
    if (inWindow(traitR(acc), window)) return acc;
    for (let guard = 0; guard < n * weak.length && !inWindow(traitR(acc), window); guard++) {
      if (window.max != null && traitR(acc) > window.max) {
        let changed = false;
        for (let i = n - 1; i >= 0 && !changed; i--) {
          for (const w of weak) {
            if (acc.some((t) => t.id === w.id)) continue;
            const next = acc.slice();
            next[i] = w;
            if (traitR(next) < traitR(acc) - 1e-9) {
              acc = next;
              changed = true;
              break;
            }
          }
        }
        if (!changed) break;
      } else if (window.min != null && traitR(acc) < window.min) {
        let changed = false;
        for (let i = 0; i < n && !changed; i++) {
          for (const s of strong) {
            if (acc.some((t) => t.id === s.id)) continue;
            const next = acc.slice();
            next[i] = s;
            if (traitR(next) > traitR(acc) + 1e-9) {
              acc = next;
              changed = true;
              break;
            }
          }
        }
        if (!changed) break;
      } else break;
    }
    if (inWindow(traitR(acc), window)) return acc;
  }
  return null;
}

export function buildTraits(rng: () => number, rarity: V3Rarity, traits: Trait[], eco: Economy): Trait[] {
  const slots = eco.trait_slots[rarity] ?? { min: 1, max: 1 };
  const window = eco.r_window[rarity] ?? {};
  const pool = traits.filter((t) => rarityRank(t.min_rarity) <= rarityRank(rarity));
  for (let i = 0; i < 200; i++) {
    const n = slots.min + Math.floor(rng() * (slots.max - slots.min + 1));
    const acc: Trait[] = [];
    let stuck = false;
    while (acc.length < n) {
      const options = pool.filter((t) => canAdd(acc, t, n));
      if (options.length === 0) {
        stuck = true;
        break;
      }
      acc.push(options[weightedIndex(rng, options.map((t) => t.weight))]!);
    }
    if (!stuck && inWindow(traitR(acc), window)) return acc;
  }
  const forced = forceTraits(pool, slots, window);
  if (!forced) throw new V3Error('traits', 'Набор трейтов не попал в окно редкости');
  return forced;
}

export function rollRarityIndex(rng: () => number, pity: Game['pity'], gacha: GachaDef, rareEvery: number): { index: number; pity: Game['pity'] } {
  const w = V3_RARITIES.map((r) => gacha.weights[r] ?? 0);
  let min = 0;
  if (pity.legend + 1 >= gacha.pity.legendary) min = 4;
  else if (pity.epic + 1 >= gacha.pity.epic) min = 3;
  else if (pity.rare + 1 >= rareEvery) min = 2;
  const masked = w.map((x, i) => (i >= min ? x : 0));
  const index = weightedIndex(rng, masked);
  return {
    index,
    pity: {
      rare: index >= 2 ? 0 : pity.rare + 1,
      epic: index >= 3 ? 0 : pity.epic + 1,
      legend: index >= 4 ? 0 : pity.legend + 1,
    },
  };
}

function emptyFloor(z: number, n = 3): Floor {
  return { z, cells: Array.from({ length: n }, (_, ci) => ({ plotId: `${z}-${ci}`, state: 'empty' as const })) };
}

export function gridCaps(rebirths: number): { width: number; maxUp: number; maxDown: number } {
  const p = Math.max(0, rebirths);
  return { width: 3 + p, maxUp: 1 + p, maxDown: 1 + p };
}

export function tierLevelCap(tier: number, rebirths: number): number {
  const p = Math.max(0, rebirths);
  if (tier <= 1) return Math.min(30, 5 + 2 * p);
  if (tier === 2) return 3 + 2 * p;
  if (tier === 3) return 1 + 2 * p;
  return p <= 0 ? 0 : 1 + 2 * (p - 1);
}

export function tierCopyCap(tier: number, rebirths: number): number {
  const p = Math.max(0, rebirths);
  if (tier <= 1) return Math.min(4, 1 + Math.floor(p / 2));
  if (tier === 2) return p >= 2 ? 2 : 1;
  return 1;
}

export function zoneOk(zone: string, z: number): boolean {
  if (zone === 'underground') return z < 0;
  if (zone === 'above') return z > 0;
  if (zone === 'surface') return z === 0;
  return true;
}

export function shellFor(z: number): 'buried' | 'basement' | 'surface' | 'sky' {
  if (z <= -2) return 'buried';
  if (z === -1) return 'basement';
  if (z === 0) return 'surface';
  return 'sky';
}

export function normalizeBase(base: Game['base']): Game['base'] {
  const floors = base.floors.map((f, i) => ({
    z: typeof f.z === 'number' ? f.z : i,
    cells: f.cells.map((c) => ({ ...c })),
  }));
  const surface = floors.find((f) => f.z === 0);
  if (surface && surface.cells.length >= 3) {
    const mid = Math.floor((surface.cells.length - 1) / 2);
    const dockAt = surface.cells.findIndex((c) => c.typeId === 'dock');
    const midCell = surface.cells[mid];
    if (dockAt >= 0 && dockAt !== mid && midCell?.state === 'empty') {
      const dock = surface.cells[dockAt]!;
      surface.cells[dockAt] = { plotId: dock.plotId, state: 'empty' };
      surface.cells[mid] = { ...dock, plotId: midCell.plotId };
    }
  }
  return { ...base, floors };
}

function widenFloors(g: Game): void {
  const width = gridCaps(g.rebirths).width;
  for (const floor of g.base.floors) {
    let extra = 0;
    while (floor.cells.length < width) {
      const deficit = width - floor.cells.length;
      const addLeft = deficit > 1;
      extra += 1;
      if (addLeft) floor.cells.unshift({ plotId: `${floor.z}-w${extra}`, state: 'empty' });
      else floor.cells.push({ plotId: `${floor.z}-e${extra}`, state: 'empty' });
    }
  }
}

function prepareBase(g: Game): void {
  g.base = normalizeBase(g.base);
  widenFloors(g);
}

export function starterBase(): Game['base'] {
  const floor = emptyFloor(0);
  const dock = floor.cells[1];
  if (dock) {
    dock.state = 'built';
    dock.typeId = 'dock';
    dock.level = 1;
  }
  return { templateId: 'start', layout: 'shaft', floors: [floor], plotCap: null };
}

export function newGame(now: number, cat: Catalog): Game {
  const g: Game = {
    credits: cat.economy.start_credits,
    stars: 0,
    legacy: 0,
    tonsTotal: 0,
    tonsRun: 0,
    pity: { rare: 0, epic: 0, legend: 0 },
    rebirths: 0,
    expansions: 0,
    cardDry: 0,
    freeRerollsUsed: 0,
    offerRerolls: 0,
    baseRerolls: 0,
    lastTick: now,
    flags: { act: 1 },
    counters: {},
    seen: [],
    queue: [],
    journal: [],
    pendingCards: null,
    pendingPlotId: null,
    pendingBases: null,
    runCards: [],
    base: starterBase(),
    spent: 0,
    lastExpandCost: 0,
    characters: [],
    offers: [],
    active: [],
    company: cat.story.company_default,
    motion: true,
    pendingFreeRolls: 0,
    lastDaily: '',
    offline: null,
    metaLevel: {},
  };
  evaluate(g, cat);
  return g;
}

function jobOf(cat: Catalog, id: string): Job {
  const j = cat.classes.find((c) => c.id === id);
  if (!j) throw new V3Error('class', `Нет класса ${id}`);
  return j;
}
function raceOf(cat: Catalog, id: string): Race {
  const r = cat.races.find((c) => c.id === id);
  if (!r) throw new V3Error('race', `Нет расы ${id}`);
  return r;
}

function hourOf(now: number): number {
  const h = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Moscow', hour: 'numeric', hourCycle: 'h23' }).format(now);
  return Number(h);
}

function condOk(cond: string | undefined, crew: number, hour: number): boolean {
  if (!cond || cond === 'stamina_gt_50' || cond === 'shift_start') return true;
  if (cond === 'night') return hour >= 22 || hour < 6;
  if (cond === 'morning') return hour >= 6 && hour < 12;
  if (cond === 'crew_gte_3') return crew >= 3;
  return false;
}

export function computeStats(ch: Character, cat: Catalog, crew: number, hour: number): Record<StatKey, number> {
  const race = raceOf(cat, ch.race);
  const job = jobOf(cat, ch.job);
  const rm = cat.economy.rarity_mult[ch.rarity];
  const out = {} as Record<StatKey, number>;
  for (const k of STAT_KEYS) {
    let v = job.base[k] * race.mult[k] * (rm ?? 1) + ch.level * job.growth[k];
    for (const id of ch.traits) {
      const t = cat.traits.find((x) => x.id === id);
      if (!t) continue;
      for (const e of t.effects) {
        if (!condOk(e.cond, crew, hour)) continue;
        if ((e.type === 'mult' || e.type === 'stat_mult') && e.stat === k && e.value) v *= e.type === 'mult' ? e.value : 1 + e.value;
      }
    }
    v *= 1 + cat.economy.star_stat * ch.starRank;
    out[k] = Math.max(1, Math.round(v));
  }
  return out;
}

interface Built {
  cell: Cell;
  z: number;
  ci: number;
  copy: number;
  def: BuildingDef;
}

function builtCells(g: Game, cat: Catalog): Built[] {
  const seen: Record<string, number> = {};
  const out: Built[] = [];
  for (const f of g.base.floors) {
    f.cells.forEach((cell, ci) => {
      if (cell.state !== 'built' || !cell.typeId) return;
      const def = cat.buildings.find((b) => b.id === cell.typeId);
      if (!def) return;
      seen[def.id] = (seen[def.id] ?? 0) + 1;
      out.push({ cell, z: f.z, ci, copy: seen[def.id] ?? 1, def });
    });
  }
  return out;
}

function milestoneMult(level: number, eco: Economy): number {
  let m = 1;
  for (const lv of eco.milestone_levels) if (level >= lv) m *= 2;
  return m;
}

function scaleOf(level: number, copy: number, eco: Economy): number {
  return (copy >= 2 ? eco.second_copy : 1) * milestoneMult(level, eco);
}

function staffSlotCount(def: BuildingDef, level: number): number {
  let n = def.staff_slots.base;
  for (const mark of def.staff_slots.extra_at) if (level >= mark) n += 1;
  return n;
}

function slotRaw(stat: number, baseline: number, classMatch: boolean, raceMatch: boolean): number {
  const raw = 0.08 + 0.45 * (1 - baseline / Math.max(stat, baseline)) + (classMatch ? 0.12 : 0) + (raceMatch ? 0.06 : 0);
  return Math.min(0.75, raw);
}

const LIVE_BUILDING = new Set(['tonnage_mult', 'global_mult', 'crew_mult']);

function buildingLive(def: BuildingDef): boolean {
  return Boolean(def.passive_credits) || def.effects.some((e) => LIVE_BUILDING.has(e.type));
}

interface StaffRow {
  ch: Character;
  stat: number;
  classMatch: boolean;
  raceMatch: boolean;
  raw: number;
}

function staffRows(g: Game, cat: Catalog, cell: Cell, def: BuildingDef): StaffRow[] {
  const hour = hourOf(g.lastTick);
  const crewN = onShift(g, cat).length;
  const ids = (cell.staff ?? []).filter((id) => g.characters.some((c) => c.id === id));
  return ids
    .map((id) => {
      const ch = g.characters.find((c) => c.id === id)!;
      const stats = computeStats(ch, cat, crewN, hour);
      const classMatch = def.class_affinity.includes(ch.job);
      const raceMatch = def.race_affinity.includes(ch.race);
      const stat = stats[def.key_stat];
      return { ch, stat, classMatch, raceMatch, raw: slotRaw(stat, def.baseline, classMatch, raceMatch) };
    })
    .sort((a, b) => b.raw - a.raw);
}

function staffK(rows: { raw: number }[]): number {
  return rows.reduce((k, row, i) => k + row.raw * 0.65 ** i, 1);
}

export function rebirthPrice(rebirths: number, eco: Economy): number {
  return eco.rebirth_base * eco.rebirth_growth ** Math.max(0, rebirths);
}

export function rebirthDue(spent: number, rebirths: number, eco: Economy): number {
  return Math.max(0, rebirthPrice(rebirths, eco) - spent);
}

function neighbors(g: Game, z: number, ci: number): Cell[] {
  const out: Cell[] = [];
  const row = g.base.floors.find((f) => f.z === z)?.cells ?? [];
  if (ci > 0 && row[ci - 1]) out.push(row[ci - 1]!);
  if (row[ci + 1]) out.push(row[ci + 1]!);
  const above = g.base.floors.find((f) => f.z === z + 1)?.cells[ci];
  const below = g.base.floors.find((f) => f.z === z - 1)?.cells[ci];
  if (above) out.push(above);
  if (below) out.push(below);
  return out;
}

function metaLv(g: Game, id: string): number {
  return g.metaLevel[id] ?? 0;
}

export function crewCap(g: Game, cat: Catalog): number {
  const dorm = builtCells(g, cat).find((b) => b.def.id === 'dorm');
  let n = 1;
  if (dorm) {
    const lv = dorm.cell.level ?? 1;
    n = 4;
    for (const mark of dorm.def.crew_slots?.extra_at ?? [3, 6, 9]) if (lv >= mark) n += 1;
  }
  n += metaLv(g, 'meta_crew_slots') * (cat.meta.find((m) => m.id === 'meta_crew_slots')?.per_level ?? 1);
  const base = cat.bases.find((b) => b.id === g.base.templateId);
  for (const e of base?.debuffs ?? []) if (e.type === 'slot_add' && e.key === 'crew' && e.value) n += e.value;
  for (const e of base?.buffs ?? []) if (e.type === 'slot_add' && e.key === 'crew' && e.value) n += e.value;
  return Math.max(1, Math.floor(n));
}

export function shiftSlots(g: Game, cat: Catalog): number {
  let n = 0;
  let any = false;
  for (const b of builtCells(g, cat)) {
    if (!b.def.shift_slots) continue;
    any = true;
    const lv = b.cell.level ?? 1;
    const add = b.def.shift_slots.base + Math.floor(Math.max(0, lv - 1) / Math.max(1, b.def.shift_slots.per_levels));
    n += add * (b.copy >= 2 ? cat.economy.second_copy : 1);
  }
  return any ? Math.max(1, Math.round(n)) : 1;
}

export function contractSlots(g: Game, cat: Catalog): number {
  let n = 0;
  for (const b of builtCells(g, cat)) {
    if (!b.def.contract_slots) continue;
    const lv = b.cell.level ?? 1;
    let add = b.def.contract_slots.base;
    for (const mark of b.def.contract_slots.extra_at) if (lv >= mark) add += 1;
    n += add * (b.copy >= 2 ? cat.economy.second_copy : 1);
  }
  return Math.max(0, Math.round(n));
}

/** Что сказать игроку, когда все слоты контрактов заняты. */
export function contractSlotHint(g: Game, cat: Catalog): string {
  const running = g.active.map((a) => `«${a.name}»`).join(', ');
  const now = running ? `Сейчас идёт ${running}. ` : 'Слот уже занят. ';
  const lv = buildingLevel(g, 'dispatch');
  const def = cat.buildings.find((b) => b.id === 'dispatch');
  const next = def?.contract_slots?.extra_at.find((mark) => lv < mark);
  if (lv <= 0) return `${now}Второй заказ одновременно открывает Диспетчерская с 3 уровня: построй её над землёй и прокачай.`;
  if (next) return `${now}Ещё один слот откроется, когда Диспетчерская дойдёт до ${next} уровня. Сейчас у неё ${lv}.`;
  return `${now}Все слоты Диспетчерской заняты. Дождись, пока заказ закончится.`;
}

function buildingLevel(g: Game, id: string): number {
  let m = 0;
  for (const f of g.base.floors) for (const c of f.cells) if (c.state === 'built' && c.typeId === id) m = Math.max(m, c.level ?? 0);
  return m;
}

function onShift(g: Game, _cat: Catalog): Character[] {
  return g.characters.filter((c) => !c.reserve);
}

export function production(g: Game, cat: Catalog): { tonsPerSec: number; creditsPerSec: number } {
  const hour = hourOf(g.lastTick);
  const crew = onShift(g, cat);
  const eco = cat.economy;
  let tonnage = 0;
  let global = 0;
  let xp = 0;
  let roll = 0;
  let contract = 0;
  let adjExtra = 0;
  let outputAdd = 0;
  for (const card of g.runCards) {
    const def = cat.cards.find((c) => c.id === card.id);
    if (!def) continue;
    const list = [...def.effects, ...(def.curse ?? [])];
    for (let s = 0; s < card.stacks; s++) {
      for (const e of list) applyBag(e);
    }
  }
  const tagIds: Record<string, Set<string>> = {};
  for (const card of g.runCards) {
    const def = cat.cards.find((c) => c.id === card.id);
    if (!def) continue;
    for (const tag of def.tags) {
      if (tag === 'any' || tag === 'meta') continue;
      (tagIds[tag] ??= new Set()).add(def.id);
    }
  }
  for (const [tag, ids] of Object.entries(tagIds)) {
    if (ids.size < 3) continue;
    for (const e of eco.tag_sets[tag] ?? []) applyBag(e);
  }
  outputAdd += g.counters.crew_bonus ?? 0;
  const baseDef = cat.bases.find((b) => b.id === g.base.templateId);
  for (const e of [...(baseDef?.buffs ?? []), ...(baseDef?.debuffs ?? [])]) applyBag(e);
  function applyBag(e: Effect): void {
    const v = e.value ?? 0;
    if (e.type === 'tonnage_mult' || (e.type === 'tag_mult' && e.tag === 'logistics')) tonnage += v;
    if (e.type === 'global_mult') global += v;
    if (e.type === 'output_add') outputAdd += v;
    if (e.type === 'xp_mult') xp += v;
    if (e.type === 'roll_cost_mult' || e.type === 'gacha_mod') roll += v;
    if (e.type === 'contract_mult') contract += v;
    if (e.type === 'adjacency_bonus') adjExtra += v;
  }
  let passive = 0;
  for (const b of builtCells(g, cat)) {
    const lv = b.cell.level ?? 1;
    const copy = b.copy >= 2 ? eco.second_copy : 1;
    const m = milestoneMult(lv, eco);
    const k = staffK(staffRows(g, cat, b.cell, b.def));
    const scale = copy * (m + k - 1);
    if (buildingLive(b.def)) {
      for (const e of b.def.effects) {
        const v = (e.value ?? 0) * lv * scale;
        if (e.type === 'tonnage_mult') tonnage += v;
        if (e.type === 'global_mult') global += v;
        if (e.type === 'crew_mult') outputAdd += v;
      }
      if (b.def.passive_credits) passive += b.def.passive_credits * lv * scale;
    } else {
      outputAdd += Math.min(0.05, 0.04 * (k - 1));
    }
  }
  let adjSum = 0;
  const cells = builtCells(g, cat);
  for (const b of cells) {
    const tag = b.def.tag;
    let n = 0;
    for (const nb of neighbors(g, b.z, b.ci)) {
      if (nb.state !== 'built' || !nb.typeId) continue;
      const nd = cat.buildings.find((x) => x.id === nb.typeId);
      if (nd?.tag === tag) n += 1;
    }
    adjSum += n * (eco.adjacency + adjExtra);
  }
  const adj = cells.length ? adjSum / cells.length : 0;
  let tons = 0;
  const ids = crew.map((c) => c.id);
  let bond = 0;
  let pairs = 0;
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      bond += pairBond(ids[i]!, ids[j]!);
      pairs += 1;
    }
  }
  const bondAvg = pairs ? bond / pairs : 0;
  for (const ch of crew) {
    const stats = computeStats(ch, cat, crew.length, hour);
    const job = jobOf(cat, ch.job);
    const race = raceOf(cat, ch.race);
    let synergy = bondAvg;
    if (cells.some((b) => b.def.id === job.synergy_building)) synergy += 0.05;
    let raw = (stats.str * 0.5 + stats.spd * 0.3 + stats.acc * 0.2) * job.class_mult * (1 + synergy);
    for (const id of ch.traits) {
      const t = cat.traits.find((x) => x.id === id);
      if (!t) continue;
      for (const e of t.effects) {
        if (!condOk(e.cond, crew.length, hour)) continue;
        if (e.type === 'mult' && (e.stat === 'output' || e.stat == null) && e.value) raw *= e.value;
        if (e.type === 'output_add' && e.value) raw *= 1 + e.value;
      }
    }
    for (const e of race.effects) if (e.type === 'output_add' && e.value) raw *= 1 + e.value;
    raw *= eco.output_scale;
    raw *= 1 + tonnage + global + outputAdd + adj;
    tons += Math.max(0, raw);
  }
  const credits = tons * eco.credits_per_ton * (1 + contract) + passive / 3600;
  void xp;
  void roll;
  return { tonsPerSec: tons, creditsPerSec: Math.max(0, credits) };
}

function bump(g: Game, key: string, by = 1): void {
  g.counters[key] = (g.counters[key] ?? 0) + by;
}

function counterValue(g: Game, key: string): number {
  if (key === 'tons_total') return g.tonsTotal;
  if (key === 'expansions_total') return g.expansions;
  if (key === 'rebirths_total') return g.rebirths;
  return g.counters[key] ?? 0;
}

function triggerOn(g: Game, cat: Catalog, t: Trigger): boolean {
  if (t.type === 'all') return t.of.every((x) => triggerOn(g, cat, x));
  if (t.type === 'counter') return counterValue(g, t.key) >= t.gte;
  if (t.type === 'flag') return (g.flags[t.key] ?? 0) >= 1;
  if (t.type === 'building_level') return buildingLevel(g, t.id) >= t.gte;
  if (t.type === 'crew_size') return g.characters.filter((c) => !c.reserve).length >= t.gte;
  if (t.type === 'rarity_obtained') return g.characters.some((c) => rarityRank(c.rarity) >= rarityRank(t.rarity));
  if (t.type === 'rebirth_count') return g.rebirths >= t.gte;
  if (t.type === 'chain_step') return (g.flags[`chain_${t.id}`] ?? 0) >= 1;
  return false;
}

function applyReward(g: Game, e: Effect): void {
  const v = e.amount ?? e.value ?? 0;
  if (e.type === 'grant' && e.key === 'credits') g.credits += v;
  if (e.type === 'grant' && e.key === 'stars') g.stars += v;
  if (e.type === 'grant' && e.key === 'free_roll') g.pendingFreeRolls += v || 1;
  if (e.type === 'flag' && e.key) g.flags[e.key] = e.value ?? 1;
  if (e.type === 'crew_mult' && e.value) g.counters.crew_bonus = (g.counters.crew_bonus ?? 0) + e.value;
  if (e.type === 'card_pick') g.flags.pending_card_reward = 1;
}

function line(cat: Catalog, key: string): string {
  return cat.locale[key] ?? key;
}

function evaluate(g: Game, cat: Catalog): void {
  if (g.tonsTotal >= 1_000_000 && (g.flags.act ?? 0) >= 3) g.flags.act4 = 1;
  const races = new Set(g.characters.filter((c) => !c.reserve).map((c) => c.race));
  g.counters.races_distinct = races.size;
  g.counters.crew = g.characters.filter((c) => !c.reserve).length;
  for (let guard = 0; guard < 24; guard++) {
    let fired = false;
    for (const m of cat.milestones) {
      if (!m.once) continue;
      if (g.seen.includes(m.id)) continue;
      if (!triggerOn(g, cat, m.trigger)) continue;
      g.seen.push(m.id);
      const lines = m.messages.map((msg) => line(cat, msg.key));
      for (let i = 0; i < m.messages.length; i++) {
        const msg = m.messages[i];
        if (!msg) continue;
        g.queue.push({ speaker: msg.speaker, text: lines[i] ?? msg.key, milestoneId: m.id });
      }
      g.journal.push({ id: m.id, title: m.title_ru, lines });
      for (const r of m.rewards) applyReward(g, r);
      if (m.id === 'm10_act2') g.flags.act2 = 1;
      if (m.id === 'm14_act3') g.flags.act = Math.max(g.flags.act ?? 1, 3);
      fired = true;
    }
    if (!fired) break;
  }
  placeReserve(g, cat);
  refillOffers(g, cat);
}

function placeReserve(g: Game, cat: Catalog): void {
  const cap = crewCap(g, cat);
  const seen = g.flags.crewCapSeen ?? cap;
  const byLevel = (a: Character, b: Character) => a.level - b.level || a.xp - b.xp;
  let active = g.characters.filter((c) => !c.reserve);
  if (active.length > cap) {
    const drop = [...active].sort(byLevel);
    for (const c of drop.slice(0, active.length - cap)) c.reserve = true;
    active = g.characters.filter((c) => !c.reserve);
  }
  if (cap > seen && active.length < cap) {
    const bench = g.characters.filter((c) => c.reserve).sort((a, b) => b.level - a.level || b.xp - a.xp);
    for (const c of bench.slice(0, cap - active.length)) c.reserve = false;
  }
  g.flags.crewCapSeen = cap;
}

function offerReady(o: Offer): boolean {
  return (o.kind === 'credits' || o.kind === 'stars' || o.kind === 'hybrid') && Boolean(o.rarity) && o.seconds > 0 && typeof o.name === 'string';
}

function nextOfferRng(g: Game): () => number {
  if (!g.flags.offerSeed) g.flags.offerSeed = (hash(String(g.lastTick || 1)) % 1_000_000_000) + 1;
  const n = g.counters.offers_rolled ?? 0;
  g.counters.offers_rolled = n + 1;
  return mulberry32(hash(`offer:${g.flags.offerSeed}:${n}`) || 1);
}

function rollOffer(g: Game, cat: Catalog): Offer {
  const cfg = cat.economy.contracts_offer;
  const rng = nextOfferRng(g);
  const kind = (['credits', 'stars', 'hybrid'] as const)[weightedIndex(rng, [cfg.kind_weights.credits, cfg.kind_weights.stars, cfg.kind_weights.hybrid])] ?? 'credits';
  const rarity = V3_RARITIES[weightedIndex(rng, V3_RARITIES.map((r) => cfg.rarity_weights[r] ?? 0))] ?? 'common';
  const seconds = cfg.seconds[rarity] ?? 1800;
  const hours = seconds / 3600;
  const mult = cfg.rarity_mult[rarity] ?? 1;
  const fullCredits = cfg.credits_per_hour * mult * hours;
  const fullStars = cfg.stars_per_hour * mult * hours;
  let credits = 0;
  let stars = 0;
  if (kind === 'credits') credits = Math.round(fullCredits);
  else if (kind === 'stars') stars = Math.round(fullStars);
  else {
    const splits = cfg.hybrid_splits.length ? cfg.hybrid_splits : [0.5];
    const split = splits[Math.floor(rng() * splits.length)] ?? 0.5;
    credits = Math.round(fullCredits * split);
    stars = Math.round(fullStars * (1 - split));
  }
  const bag = cfg.titles[kind];
  const name = bag[Math.floor(rng() * bag.length)] ?? 'Заказ сектора';
  return { id: `offer-${g.counters.offers_rolled}`, name, seconds, credits, stars, starter: false, kind, rarity, titled: false };
}

function refillOffers(g: Game, cat: Catalog): void {
  g.offers = g.offers.filter(offerReady);
  const open = g.seen.includes('m04_first_contract') || (g.counters.contracts_done ?? 0) > 0;
  const want = open ? 3 : g.offers.length === 0 && g.characters.length > 0 ? 1 : g.offers.length;
  if ((g.counters.contracts_done ?? 0) === 0 && !g.offers.some((o) => o.starter) && !g.active.some((a) => a.id === 'first_client')) {
    const st = cat.contracts.find((c) => c.starter);
    if (st && g.characters.length > 0) {
      g.offers.push({ id: st.id, name: st.name_ru, seconds: st.seconds, credits: st.credits, stars: st.stars, starter: true, kind: 'hybrid', rarity: 'common', titled: true });
    }
  }
  if (!open) return;
  while (g.offers.length < want) g.offers.push(rollOffer(g, cat));
}

function xpNeed(level: number, eco: Economy): number {
  return Math.round(eco.xp_base * eco.xp_growth ** (level - 1));
}

export function sync(game: Game, now: number, cat: Catalog): Game {
  const g = structuredClone(game);
  prepareBase(g);
  const dt = Math.max(0, (now - g.lastTick) / 1000);
  const grace = cat.economy.online_grace_sec;
  const cap = cat.economy.offline_hours * 3600;
  const offlineRate = Math.min(1, cat.economy.offline_rate + metaLv(g, 'meta_offline') * (cat.meta.find((m) => m.id === 'meta_offline')?.per_level ?? 0.05));
  const rated = Math.min(dt, cap);
  const full = Math.min(rated, grace);
  const slow = Math.max(0, rated - grace);
  const { tonsPerSec, creditsPerSec } = production(g, cat);
  const tons = tonsPerSec * (full + slow * offlineRate);
  const credits = creditsPerSec * (full + slow * offlineRate);
  g.tonsTotal += tons;
  g.tonsRun += tons;
  g.credits += credits;
  g.counters.shift_tons = Math.max(g.counters.shift_tons ?? 0, tonsPerSec * 300);
  const crew = onShift(g, cat);
  for (const ch of crew) {
    const capLv = cat.economy.level_cap;
    ch.xp += tons * (1 + metaLv(g, 'meta_xp') * (cat.meta.find((m) => m.id === 'meta_xp')?.per_level ?? 0.04));
    while (ch.level < capLv && ch.xp >= xpNeed(ch.level, cat.economy)) {
      ch.xp -= xpNeed(ch.level, cat.economy);
      ch.level += 1;
    }
  }
  const done: ActiveContract[] = [];
  const keep: ActiveContract[] = [];
  for (const a of g.active) (a.endsAt <= now ? done : keep).push(a);
  g.active = keep;
  for (const a of done) {
    g.credits += a.credits;
    g.stars += a.stars;
    bump(g, 'contracts_done');
  }
  if (dt > grace) g.offline = { seconds: Math.round(rated), credits: Math.round(credits), tons: Math.round(tons * 10) / 10 };
  g.lastTick = now;
  evaluate(g, cat);
  return g;
}

function cyrillicShare(s: string): number {
  const letters = [...s].filter((ch) => /\p{L}/u.test(ch));
  if (letters.length === 0) return 0;
  const cyr = letters.filter((ch) => /[а-яё]/i.test(ch)).length;
  return cyr / letters.length;
}

export function validOfferTitle(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const title = typeof (raw as { title?: unknown }).title === 'string' ? (raw as { title: string }).title.trim().replace(/\s+/g, ' ') : '';
  const letters = [...title].filter((ch) => /\p{L}/u.test(ch));
  const cyr = letters.filter((ch) => /[а-яё]/i.test(ch)).length;
  if (title.length < 40 || title.length > 80) return null;
  if (letters.length === 0 || cyr / letters.length < 0.8) return null;
  if (BANNED.some((w) => title.toLowerCase().includes(w))) return null;
  return title;
}

export function validAiText(raw: unknown, used: Set<string>): { nickname: string; bio: string; quote: string } | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const nickname = typeof o.nickname === 'string' ? o.nickname.trim() : '';
  const bio = typeof o.bio === 'string' ? o.bio.trim() : '';
  const quote = typeof o.quote === 'string' ? o.quote.trim() : '';
  if (nickname.length < 3 || nickname.length > 14) return null;
  if (used.has(nickname.toLowerCase())) return null;
  if (bio.length < 280 || bio.length > 450) return null;
  if (quote.length < 1 || quote.length > 90) return null;
  if (cyrillicShare(bio) < 0.8) return null;
  const blob = `${nickname} ${bio} ${quote}`.toLowerCase();
  if (BANNED.some((w) => blob.includes(w))) return null;
  return { nickname, bio, quote };
}

function fallbackText(cat: Catalog, ch: Character, used: Set<string>): { nickname: string; bio: string; quote: string } {
  const nick = cat.nicknames.find((n) => !used.has(n.toLowerCase())) ?? `Номер${ch.id.slice(0, 4)}`;
  const bioRow = cat.bios.find((b) => b.class_id === ch.job) ?? cat.bios[0];
  const bio = (bioRow?.text ?? '{first_name} работает на терминале.').replaceAll('{first_name}', ch.firstName).replaceAll('{nickname}', nick);
  return { nickname: nick, bio, quote: 'Груз сам себя не унесёт.' };
}

function pullOne(g: Game, cat: Catalog, rng: () => number, ids: () => string, focus?: { kind: 'race' | 'job'; id: string }): void {
  const rareEvery = Math.max(2, cat.gacha.pity.rare - metaLv(g, 'meta_pity'));
  let picked: Template | null = null;
  let rarity: V3Rarity = 'common';
  let pity = g.pity;
  for (let attempt = 0; attempt < 24 && !picked; attempt++) {
    const rolled = rollRarityIndex(rng, pity, cat.gacha, rareEvery);
    pity = rolled.pity;
    rarity = V3_RARITIES[rolled.index] ?? 'common';
    const raceW = cat.races.map((r) => (focus?.kind === 'race' && focus.id === r.id ? cat.gacha.focus_mult : 1));
    const jobW = cat.classes.map((c) => {
      const base = c.weight;
      return focus?.kind === 'job' && focus.id === c.id ? base * cat.gacha.focus_mult : base;
    });
    const race = cat.races[weightedIndex(rng, raceW)];
    const job = cat.classes[weightedIndex(rng, jobW)];
    if (!race || !job) break;
    const pool = cat.templates.filter((t) => t.race === race.id && t.job === job.id);
    if (pool.length === 0) continue;
    const owned = new Set(g.characters.map((c) => c.templateId).filter((x): x is string => !!x));
    const tpl = pool[weightedIndex(rng, pool.map((t) => (owned.has(t.templateId) ? 1 : cat.gacha.new_template_weight)))]!;
    picked = tpl;
  }
  g.pity = pity;
  if (!picked) throw new V3Error('no_template', 'Нет утверждённых шаблонов для ролла');
  const owned = g.characters.find((c) => c.templateId === picked!.templateId);
  if (owned) {
    if (owned.starRank >= cat.economy.star_cap) g.stars += cat.economy.duplicate_stars[rarity] ?? 0;
    else owned.starRank += 1;
    bump(g, 'pulls');
    return;
  }
  const traits = buildTraits(rng, rarity, cat.traits, cat.economy);
  const used = new Set(g.characters.map((c) => c.nickname.toLowerCase()));
  const draft: Character = {
    id: ids(),
    templateId: picked.templateId,
    legacy: false,
    race: picked.race,
    job: picked.job,
    rarity,
    firstName: picked.firstName,
    lastName: picked.lastName,
    nickname: '',
    bio: '',
    quote: '',
    traits: traits.map((t) => t.id),
    level: 1,
    xp: 0,
    starRank: 0,
    portrait: picked.portrait,
    thumb: picked.thumb,
    reserve: g.characters.filter((c) => !c.reserve).length >= crewCap(g, cat),
  };
  const text = fallbackText(cat, draft, used);
  draft.nickname = text.nickname;
  draft.bio = text.bio;
  draft.quote = text.quote;
  g.characters.push(draft);
  bump(g, 'pulls');
  bump(g, 'hires');
}

function rollCost(g: Game, cat: Catalog, count: 1 | 10, focus: boolean): number {
  const cost = count === 10 ? cat.gacha.cost10 : cat.gacha.cost;
  let mult = 1;
  const hr = builtCells(g, cat).find((b) => b.def.id === 'hr_office');
  if (hr) mult -= 0.02 * (hr.cell.level ?? 1) * scaleOf(hr.cell.level ?? 1, hr.copy, cat.economy);
  for (const card of g.runCards) {
    const def = cat.cards.find((c) => c.id === card.id);
    for (const e of def?.effects ?? []) if ((e.type === 'gacha_mod' || e.type === 'roll_cost_mult') && e.value) mult += e.value * card.stacks;
  }
  if (focus) mult *= cat.gacha.focus_cost;
  return Math.max(0, Math.round(cost * Math.max(0.2, mult)));
}

function choicesCount(g: Game): number {
  let n = 3;
  if (g.runCards.some((c) => c.id === 'omnicon_leak')) n = 5;
  return n;
}

export function offerCards(rng: () => number, g: Pick<Game, 'expansions' | 'runCards' | 'cardDry'>, cat: Catalog, buildingId?: string | null): { ids: string[]; dry: number } {
  const n = Math.max(1, g.expansions);
  const row = cat.gacha.card_weights.find((w) => w.until == null || n <= w.until) ?? cat.gacha.card_weights[0];
  if (!row) return { ids: [], dry: g.cardDry };
  const weights: Record<string, number> = { common: row.common, rare: row.rare, epic: row.epic, legendary: row.legendary };
  const count = choicesCount(g as Game);
  const have = new Map(g.runCards.map((c) => [c.id, c.stacks]));
  const fits = (c: CardDef) => {
    const stacks = have.get(c.id) ?? 0;
    const cap = Math.min(c.max_stacks, cat.gacha.card_stacks[c.rarity] ?? c.max_stacks);
    return stacks < cap && c.min_expansion_index <= n && c.requires.every((r) => g.runCards.some((x) => x.id === r));
  };
  let pool = cat.cards.filter((c) => fits(c) && (!buildingId || c.buildings.length === 0 || c.buildings.includes(buildingId)));
  if (pool.length < 3) pool = cat.cards.filter(fits);
  const ids: string[] = [];
  const forceRare = g.cardDry >= cat.gacha.card_guarantee_dry;
  for (let i = 0; i < count; i++) {
    const left = pool.filter((c) => !ids.includes(c.id));
    if (left.length === 0) break;
    let bag = left;
    if (forceRare && i === 0) {
      const high = left.filter((c) => c.rarity !== 'common');
      if (high.length) bag = high;
    }
    const pick = bag[weightedIndex(rng, bag.map((c) => weights[c.rarity] ?? 0 * c.weight + c.weight))]!;
    ids.push(pick.id);
  }
  const dry = ids.some((id) => cat.cards.find((c) => c.id === id)?.rarity !== 'common') ? 0 : g.cardDry + 1;
  return { ids, dry };
}

function baseWeights(cat: Catalog, k: number): Record<string, number> {
  const row = cat.gacha.base_weights.find((w) => w.until == null || k <= w.until) ?? cat.gacha.base_weights[0];
  return { common: row?.common ?? 1, rare: row?.rare ?? 1, epic: row?.epic ?? 0, legendary: row?.legendary ?? 0 };
}

export function offerBases(rng: () => number, g: Game, cat: Catalog): string[] {
  const k = g.rebirths + 1;
  const w = baseWeights(cat, k);
  w.epic = (w.epic ?? 0) * (1 + metaLv(g, 'meta_base_choice') * (cat.meta.find((m) => m.id === 'meta_base_choice')?.per_level ?? 0.05));
  const recent = String(g.flags.last_base ?? '');
  const pool = cat.bases.filter((b) => b.min_rebirth <= k && b.id !== recent);
  const ids: string[] = [];
  const low = pool.filter((b) => b.risk === 'low');
  if (low.length) ids.push(low[weightedIndex(rng, low.map((b) => w[b.rarity] ?? 1))]!.id);
  while (ids.length < 3) {
    const left = pool.filter((b) => !ids.includes(b.id));
    if (left.length === 0) break;
    ids.push(left[weightedIndex(rng, left.map((b) => (w[b.rarity] ?? 1) * b.weight))]!.id);
  }
  return ids;
}

function pay(g: Game, cost: number): void {
  if (g.credits < cost) throw new V3Error('credits', 'Не хватает кредитов');
  g.credits -= cost;
  g.spent += cost;
}

function upgradeCost(def: BuildingDef, level: number, eco: Economy): number {
  return Math.round(def.base_cost * eco.level_cost_growth ** (level - 1));
}

function expandCost(g: Game, cat: Catalog): number {
  const eco = cat.economy;
  let mult = 1 - metaLv(g, 'meta_cheaper_expand') * (cat.meta.find((m) => m.id === 'meta_cheaper_expand')?.per_level ?? 0.03);
  for (const card of g.runCards) {
    const def = cat.cards.find((c) => c.id === card.id);
    for (const e of def?.effects ?? []) if (e.type === 'cost_mult' && e.target === 'expand' && e.value) mult += e.value * card.stacks;
  }
  return Math.max(1, Math.round(eco.expand_base * eco.expand_growth ** g.expansions * Math.max(0.2, mult)));
}

function totalCells(g: Game): number {
  return g.base.floors.reduce((s, f) => s + f.cells.length, 0);
}

function applyBase(g: Game, cat: Catalog, id: string): void {
  const card = cat.bases.find((b) => b.id === id);
  if (!card) throw new V3Error('base', 'Нет такой базы');
  const floorsN = card.floors ?? 1;
  const floors: Floor[] = [];
  for (let i = 0; i < floorsN; i++) floors.push(emptyFloor(i));
  const cells = floors.flatMap((f) => f.cells);
  let cursor = 0;
  let spent = 0;
  for (const b of card.start_buildings) {
    const cell = cells[cursor];
    cursor += 1;
    if (!cell) break;
    cell.state = 'built';
    cell.typeId = b.type;
    cell.level = b.level;
    const def = cat.buildings.find((x) => x.id === b.type);
    if (def) spent += upgradeCost(def, 1, cat.economy) * b.level;
  }
  if (!cells.some((c) => c.typeId === 'dock')) {
    const empty = cells.find((c) => c.state === 'empty') ?? cells[0];
    if (empty) {
      empty.state = 'built';
      empty.typeId = 'dock';
      empty.level = 1;
    }
  }
  g.base = { templateId: card.id, layout: card.layout_type, floors, plotCap: card.cell_cap ?? null };
  g.spent = spent;
  g.flags.last_base = 0;
  g.counters.last_base_id = 0;
  g.flags[`base_${card.id}`] = (g.flags[`base_${card.id}`] ?? 0) + 1;
}

function offerGramoty(g: Game, cat: Catalog): void {
  const pool = cat.meta.map((m, i) => ({ m, i })).filter(({ m }) => (g.metaLevel[m.id] ?? 0) < m.max_level);
  const order = [...pool].sort((a, b) => hash(`${g.rebirths}:${a.m.id}`) - hash(`${g.rebirths}:${b.m.id}`));
  for (let n = 0; n < 3; n++) g.flags[`gramota${n}`] = (order[n]?.i ?? -1) + 1;
}

export function act(game: Game, action: Action, cat: Catalog): Game {
  const g = structuredClone(game);
  prepareBase(g);
  if (action.type === 'ack-offline') {
    g.offline = null;
    return g;
  }
  if (action.type === 'motion') {
    g.motion = action.on;
    return g;
  }
  if (action.type === 'gramota') {
    const idx = (g.flags[`gramota${action.slot}`] ?? 0) - 1;
    const meta = cat.meta[idx];
    if (!meta) throw new V3Error('gramota', 'Этой грамоты нет в выборе');
    g.metaLevel[meta.id] = Math.min(meta.max_level, (g.metaLevel[meta.id] ?? 0) + 1);
    g.flags.gramota0 = 0;
    g.flags.gramota1 = 0;
    g.flags.gramota2 = 0;
    return g;
  }
  if (action.type === 'rename') {
    const name = action.company.trim();
    if (name.length < 2 || name.length > 32) throw new V3Error('name', 'Название компании: 2–32 символа');
    g.company = name;
    g.flags.logoRev = (g.flags.logoRev ?? 0) + 1;
    return g;
  }
  if (action.type === 'story-ack') {
    if (action.skip) g.queue = [];
    else g.queue.shift();
    return g;
  }
  if (action.type === 'daily') {
    if (g.lastDaily !== action.day) {
      g.stars += cat.economy.daily_stars;
      g.lastDaily = action.day;
      bump(g, 'logins');
    }
    evaluate(g, cat);
    return g;
  }
  if (action.type === 'roll') {
    if (action.focus && !cat.gacha.banners_enabled) throw new V3Error('focus', 'Фокус выключен');
    let left = action.count;
    while (left > 0 && g.pendingFreeRolls > 0) {
      g.pendingFreeRolls -= 1;
      pullOne(g, cat, action.rng, action.ids, action.focus);
      left -= 1;
    }
    if (left > 0) {
      const cost = left === action.count && action.count === 10 ? rollCost(g, cat, 10, !!action.focus) : rollCost(g, cat, 1, !!action.focus) * left;
      if (g.stars < cost) throw new V3Error('stars', 'Не хватает звёзд');
      g.stars -= cost;
      for (let i = 0; i < left; i++) pullOne(g, cat, action.rng, action.ids, action.focus);
    }
    evaluate(g, cat);
    return g;
  }
  if (action.type === 'expand') {
    if (g.pendingCards) throw new V3Error('cards', 'Сначала выберите карточку');
    const caps = gridCaps(g.rebirths);
    const zs = g.base.floors.map((f) => f.z);
    const cost = expandCost(g, cat);
    if (action.kind === 'up') {
      const ups = zs.filter((z) => z > 0).length;
      if (ups >= caps.maxUp) throw new V3Error('cap', 'Выше уже некуда до следующего перерождения');
      const z = Math.max(...zs, 0) + 1;
      g.base.floors.push(emptyFloor(z, caps.width));
    } else {
      const downs = zs.filter((z) => z < 0).length;
      if (downs >= caps.maxDown) throw new V3Error('cap', 'Ниже уже некуда до следующего перерождения');
      const z = Math.min(...zs, 0) - 1;
      g.base.floors.push(emptyFloor(z, caps.width));
    }
    pay(g, cost);
    g.lastExpandCost = cost;
    g.expansions += 1;
    bump(g, 'expansions_total');
    evaluate(g, cat);
    return g;
  }
  if (action.type === 'pick-card') {
    if (!g.pendingCards?.includes(action.id)) throw new V3Error('cards', 'Этой карточки нет в наборе');
    const row = g.runCards.find((c) => c.id === action.id);
    if (row) row.stacks += 1;
    else g.runCards.push({ id: action.id, stacks: 1 });
    if (g.pendingPlotId) {
      for (const floor of g.base.floors) {
        const cell = floor.cells.find((c) => c.plotId === g.pendingPlotId);
        if (cell) cell.bonusId = action.id;
      }
    }
    g.pendingCards = null;
    g.pendingPlotId = null;
    evaluate(g, cat);
    return g;
  }
  if (action.type === 'reroll-cards') {
    if (!g.pendingCards) throw new V3Error('cards', 'Нечего перебрасывать');
    const earned = Math.floor(g.expansions / 5) + metaLv(g, 'meta_card_reroll');
    if (g.freeRerollsUsed < earned) g.freeRerollsUsed += 1;
    else {
      const cost = Math.round(cat.economy.reroll_base * cat.economy.reroll_growth ** g.offerRerolls);
      if (g.credits < cost) throw new V3Error('credits', 'Не хватает кредитов на реролл');
      g.credits -= cost;
    }
    g.offerRerolls += 1;
    const builtId = g.base.floors.flatMap((f) => f.cells).find((c) => c.plotId === g.pendingPlotId)?.typeId ?? null;
    const offer = offerCards(action.rng, g, cat, builtId);
    g.pendingCards = offer.ids;
    g.cardDry = offer.dry;
    return g;
  }
  if (action.type === 'skip-cards') {
    if (!g.pendingCards) throw new V3Error('cards', 'Нет выбора');
    g.credits += Math.round(g.lastExpandCost * cat.economy.skip_refund);
    g.pendingCards = null;
    g.pendingPlotId = null;
    return g;
  }
  if (action.type === 'build') {
    if (g.pendingCards) throw new V3Error('cards', 'Сначала выберите карточку');
    const def = cat.buildings.find((b) => b.id === action.typeId);
    if (!def) throw new V3Error('building', 'Нет такой постройки');
    const count = builtCells(g, cat).filter((b) => b.def.id === def.id).length;
    const copies = tierCopyCap(def.tier, g.rebirths);
    if (tierLevelCap(def.tier, g.rebirths) <= 0) throw new V3Error('tier', 'Это строение откроется после перерождения');
    if (count >= copies) throw new V3Error('building', 'Больше таких комнат пока нельзя');
    const floor = g.base.floors.find((f) => f.cells.some((c) => c.plotId === action.plotId));
    const cell = floor?.cells.find((c) => c.plotId === action.plotId);
    if (!floor || !cell || cell.state !== 'empty') throw new V3Error('plot', 'Ячейка занята');
    if (!zoneOk(def.zone, floor.z)) throw new V3Error('zone', 'Здесь это строение не встанет');
    const cost = upgradeCost(def, 1, cat.economy);
    pay(g, cost);
    g.lastExpandCost = cost;
    cell.state = 'built';
    cell.typeId = def.id;
    cell.level = 1;
    const offer = offerCards(action.rng, g, cat, def.id);
    g.pendingCards = offer.ids;
    g.pendingPlotId = cell.plotId;
    g.cardDry = offer.dry;
    g.offerRerolls = 0;
    evaluate(g, cat);
    return g;
  }
  if (action.type === 'upgrade') {
    const cell = g.base.floors.flatMap((f) => f.cells).find((c) => c.plotId === action.plotId);
    if (!cell || cell.state !== 'built' || !cell.typeId) throw new V3Error('plot', 'Тут нечего улучшать');
    const def = cat.buildings.find((b) => b.id === cell.typeId);
    if (!def) throw new V3Error('building', 'Нет постройки');
    const lv = cell.level ?? 1;
    const capLv = Math.min(cat.economy.level_cap_building, tierLevelCap(def.tier, g.rebirths));
    if (lv >= capLv) throw new V3Error('level', 'Потолок уровня на этом прогрессе');
    const cost = upgradeCost(def, lv + 1, cat.economy);
    pay(g, cost);
    cell.level = lv + 1;
    evaluate(g, cat);
    return g;
  }
  if (action.type === 'contract-start') {
    const slots = contractSlots(g, cat);
    const starter = action.id === 'first_client' && (g.counters.contracts_done ?? 0) === 0;
    if (!starter && !g.seen.includes('m04_first_contract') && slots === 0 && !g.seen.includes('m04_first_contract')) {
      /* первый контракт доступен с терминала */
    }
    if (!starter && g.active.length >= Math.max(1, slots)) throw new V3Error('slots', contractSlotHint(g, cat));
    const offer = g.offers.find((o) => o.id === action.id);
    if (!offer) throw new V3Error('contract', 'Контракта нет на доске');
    g.offers = g.offers.filter((o) => o.id !== offer.id);
    g.active.push({
      uid: `${offer.id}:${g.lastTick}`,
      id: offer.id,
      name: offer.name,
      endsAt: g.lastTick + offer.seconds * 1000,
      credits: offer.credits,
      stars: offer.stars,
      seconds: offer.seconds,
      kind: offer.kind,
      rarity: offer.rarity,
    });
    evaluate(g, cat);
    return g;
  }
  if (action.type === 'assign' || action.type === 'unassign') {
    const cell = g.base.floors.flatMap((f) => f.cells).find((c) => c.plotId === action.plotId);
    if (!cell || cell.state !== 'built' || !cell.typeId) throw new V3Error('plot', 'Здесь некуда поставить');
    const def = cat.buildings.find((b) => b.id === cell.typeId);
    if (!def) throw new V3Error('plot', 'Нет такого строения');
    const ch = g.characters.find((c) => c.id === action.characterId);
    if (!ch) throw new V3Error('crew', 'Нет такой наёмницы');
    for (const floor of g.base.floors) {
      for (const spot of floor.cells) {
        if (!spot.staff) continue;
        spot.staff = spot.staff.filter((id) => id !== ch.id && g.characters.some((x) => x.id === id));
      }
    }
    if (action.type === 'assign') {
      const slots = staffSlotCount(def, cell.level ?? 1);
      const mine = cell.staff ?? [];
      if (mine.length >= slots) throw new V3Error('slots', 'В этом здании нет свободного места');
      cell.staff = [...mine, ch.id];
    }
    evaluate(g, cat);
    return g;
  }
  if (action.type === 'roster') {
    const ch = g.characters.find((c) => c.id === action.characterId);
    if (!ch) throw new V3Error('crew', 'Нет такой наёмницы');
    if (action.swapWith) {
      const other = g.characters.find((c) => c.id === action.swapWith);
      if (!other || other.id === ch.id) return g;
      const was = ch.reserve;
      ch.reserve = other.reserve;
      other.reserve = was;
    } else {
      if (!action.reserve && ch.reserve && g.characters.filter((c) => !c.reserve).length >= crewCap(g, cat)) {
        throw new V3Error('slots', 'В составе нет места. Построй или прокачай общежитие.');
      }
      ch.reserve = action.reserve;
    }
    g.flags.crewCapSeen = crewCap(g, cat);
    evaluate(g, cat);
    return g;
  }
  if (action.type === 'rebirth-preview') {
    const due = rebirthDue(g.spent, g.rebirths, cat.economy);
    if (g.credits < due) throw new V3Error('rebirth', 'Не хватает кредитов на переезд');
    if (!g.pendingBases) g.pendingBases = offerBases(action.rng, g, cat);
    return g;
  }
  if (action.type === 'reroll-bases') {
    if (!g.pendingBases) throw new V3Error('rebirth', 'Нет набора баз');
    const cost = cat.economy.base_reroll_stars * 2 ** g.baseRerolls;
    if (g.stars < cost) throw new V3Error('stars', 'Не хватает звёзд');
    g.stars -= cost;
    g.baseRerolls += 1;
    g.pendingBases = offerBases(action.rng, g, cat);
    return g;
  }
  if (action.type === 'rebirth-confirm') {
    if (!g.pendingBases?.includes(action.id)) throw new V3Error('rebirth', 'Этой базы нет в выборе');
    const tons = g.tonsRun;
    let gain = Math.floor(Math.sqrt(tons / cat.economy.legacy_tons));
    if (g.runCards.some((c) => c.id === 'pension_fund')) gain = Math.floor(gain * 1.25);
    g.legacy += gain;
    const due = rebirthDue(g.spent, g.rebirths, cat.economy);
    if (g.credits < due) throw new V3Error('rebirth', 'Не хватает кредитов на переезд');
    const startBonus = metaLv(g, 'meta_start_credits') * (cat.meta.find((m) => m.id === 'meta_start_credits')?.per_level ?? 1000);
    g.credits = Math.max(cat.economy.rebirth_floor, g.credits - due + startBonus);
    g.runCards = g.runCards.filter((c) => cat.cards.find((d) => d.id === c.id)?.persist);
    g.pendingCards = null;
    g.pendingPlotId = null;
    g.offers = [];
    g.active = [];
    g.expansions = 0;
    g.cardDry = 0;
    g.freeRerollsUsed = 0;
    g.offerRerolls = 0;
    g.baseRerolls = 0;
    g.tonsRun = 0;
    g.rebirths += 1;
    if (g.rebirths === 1) g.pendingFreeRolls += metaLv(g, 'meta_extra_roll');
    applyBase(g, cat, action.id);
    g.pendingBases = null;
    offerGramoty(g, cat);
    evaluate(g, cat);
    return g;
  }
  if (action.type === 'meta') {
    const node = cat.meta.find((m) => m.id === action.id);
    if (!node) throw new V3Error('meta', 'Нет узла');
    const lv = metaLv(g, node.id);
    if (lv >= node.max_level) throw new V3Error('meta', 'Узел на максимуме');
    const cost = node.costs[lv] ?? node.costs[node.costs.length - 1] ?? 1;
    if (g.legacy < cost) throw new V3Error('legacy', 'Не хватает наследия');
    g.legacy -= cost;
    g.metaLevel[node.id] = lv + 1;
    if (node.id === 'meta_story') g.flags.meta_story = 1;
    evaluate(g, cat);
    return g;
  }
  if (action.type === 'ending') {
    if (!g.seen.includes('m18_buyout')) throw new V3Error('ending', 'Финал ещё не открыт');
    g.flags[`chain_${action.id}`] = 1;
    evaluate(g, cat);
    return g;
  }
  return g;
}

export function portraitOf(ch: Character): string {
  return ch.portrait;
}

export interface V3View {
  credits: number;
  stars: number;
  legacy: number;
  tonsPerSec: number;
  creditsPerSec: number;
  tonsTotal: number;
  tonsRun: number;
  rebirths: number;
  expansions: number;
  crewCap: number;
  shiftSlots: number;
  contractSlots: number;
  hireOpen: boolean;
  contractsOpen: boolean;
  characters: {
    id: string;
    name: string;
    race: string;
    raceName: string;
    job: string;
    jobName: string;
    rarity: V3Rarity;
    traits: { id: string; name: string; sign: string; hint: string }[];
    raceHint: string;
    jobHint: string;
    level: number;
    starRank: number;
    portrait: string;
    thumb: string;
    bio: string;
    quote: string;
    reserve: boolean;
    legacy: boolean;
    stats: Record<StatKey, number>;
    power: number;
  }[];
  floors: Floor[];
  catalogBuildings: { id: string; name: string; tag: string; zone: string; tier: number; cost: number; count: number; maxLevel: number; maxCopies: number; effect: string }[];
  pendingCards: { id: string; name: string; rarity: string; tags: string[]; text: string; curse: string }[] | null;
  pendingBases: { id: string; name: string; rarity: string; risk: string; flavor: string; buff: string; debuff: string; start: string }[] | null;
  runCards: { id: string; name: string; stacks: number; rarity: string; text: string }[];
  queue: { speaker: string; text: string }[];
  journal: { id: string; title: string; lines: string[] }[];
  meta: { id: string; name: string; effect: string; level: number; max: number; nextCost: number | null }[];
  offers: Offer[];
  active: (ActiveContract & { seconds: number })[];
  canRebirth: boolean;
  rebirthPrice: number;
  rebirthDue: number;
  /** Совпадает с ценой переезда. Оставлено, чтобы старый клиент не терял поле. */
  rebirthThreshold: number;
  baseValue: number;
  posts: {
    plotId: string;
    slots: number;
    keyStat: StatKey;
    keyName: string;
    baseline: number;
    k: number;
    classNames: string[];
    raceNames: string[];
    crew: { id: string; name: string; stat: number; classMatch: boolean; raceMatch: boolean }[];
  }[];
  offline: Game['offline'];
  company: string;
  logoRev: number;
  pendingGramoty: { id: string; name: string; effect: string }[];
  tabs: { id: string; name: string }[];
  rollCost: number;
  roll10: number;
  focusEnabled: boolean;
  freeRerolls: number;
  rerollCost: number;
  baseRerollCost: number;
  motion: boolean;
  races: { id: string; name: string }[];
  classes: { id: string; name: string }[];
  act: number;
  endingOpen: boolean;
  expandCost: number;
  levelCostGrowth: number;
  freeRolls: number;
}

const STAT_RU: Record<string, string> = { str: 'сила', spd: 'скорость', acc: 'точность', end: 'выносливость', cha: 'харизма', lck: 'удача' };
const TAG_RU: Record<string, string> = { logistics: 'логистика', production: 'производство', comfort: 'уют', office: 'офис', security: 'охрана', social: 'бригада', gacha: 'найм' };

export function humanEffect(e: Effect): string {
  const raw = e.value ?? e.amount ?? 0;
  const pct = Math.abs(raw) <= 3 && Math.abs(raw) > 0 && Math.abs(raw) < 2 ? Math.round(Math.abs(raw) * 100) : Math.round(Math.abs(raw));
  const sign = raw < 0 ? '−' : '+';
  if (e.type === 'tonnage_mult') return `тоннаж ${sign}${pct}%`;
  if (e.type === 'tag_mult') return `${TAG_RU[e.tag ?? ''] ?? e.tag ?? 'эффект'} ${sign}${pct}%`;
  if (e.type === 'global_mult' || e.type === 'output_add' || e.type === 'crew_mult') return `выработка ${sign}${pct}%`;
  if (e.type === 'stat_mult' || (e.type === 'mult' && e.stat && e.stat !== 'output')) return `${STAT_RU[e.stat ?? ''] ?? e.stat} ${sign}${pct}%`;
  if (e.type === 'mult' && (e.stat === 'output' || !e.stat)) return `выработка ×${e.value ?? 1}`;
  if (e.type === 'morale') return `мораль ${sign}${Math.abs(raw)}`;
  if (e.type === 'stamina_regen') return `восстановление ${sign}${pct}%`;
  if (e.type === 'contract_mult') return `контракты ${sign}${pct}%`;
  if (e.type === 'xp_mult') return `опыт ${sign}${pct}%`;
  if (e.type === 'loss_mult') return `потери ${sign}${pct}%`;
  if (e.type === 'theft_mult') return `кражи ${sign}${pct}%`;
  if (e.type === 'cost_mult') return `цены ${sign}${pct}%`;
  if (e.type === 'roll_cost_mult' || e.type === 'gacha_mod') return `найм ${sign}${pct}%`;
  if (e.type === 'adjacency_bonus') return 'соседство сильнее';
  if (e.type === 'grant' && e.key === 'credits') return `кредиты +${raw}`;
  if (e.type === 'grant' && e.key === 'stars') return `звёзды +${raw}`;
  if (e.type === 'grant' && e.key === 'free_roll') return 'бесплатный ролл';
  if (e.type === 'slot_add' && e.key === 'crew') return `мест в бригаде ${sign}${Math.abs(raw)}`;
  if (e.type === 'event_mod') return raw < 0 ? `события реже на ${pct}%` : `события чаще на ${pct}%`;
  if (e.type === 'timed_burst') return `выработка скачет, вспышки ${sign}${pct}%`;
  if (e.type === 'passive_credits') return `пассив ${sign}${Math.abs(raw)} кредитов в час`;
  if (e.type === 'flag' && e.key === 'no_medbay') return 'медблок на этой базе закрыт';
  return '';
}

function effectText(list: Effect[], phrase?: string | null): string {
  if (phrase) return phrase;
  return list.map(humanEffect).filter(Boolean).join(', ');
}

export function view(g: Game, cat: Catalog): V3View {
  const rate = production(g, cat);
  const hour = hourOf(g.lastTick);
  const crewN = g.characters.filter((c) => !c.reserve).length;
  const price = rebirthPrice(g.rebirths, cat.economy);
  const due = rebirthDue(g.spent, g.rebirths, cat.economy);
  const earned = Math.floor(g.expansions / 5) + metaLv(g, 'meta_card_reroll');
  return {
    credits: Math.round(g.credits),
    stars: g.stars,
    legacy: g.legacy,
    tonsPerSec: Math.round(rate.tonsPerSec * 1000) / 1000,
    creditsPerSec: Math.round(rate.creditsPerSec * 100) / 100,
    tonsTotal: Math.round(g.tonsTotal * 10) / 10,
    tonsRun: Math.round(g.tonsRun * 10) / 10,
    rebirths: g.rebirths,
    expansions: g.expansions,
    crewCap: crewCap(g, cat),
    shiftSlots: shiftSlots(g, cat),
    contractSlots: contractSlots(g, cat),
    hireOpen: g.seen.includes('m02_first_cargo') || g.pendingFreeRolls > 0,
    contractsOpen: g.seen.includes('m04_first_contract'),
    characters: g.characters.map((ch) => {
      const stats = computeStats(ch, cat, crewN, hour);
      return {
        id: ch.id,
        name: `${ch.firstName} «${ch.nickname}» ${ch.lastName}`.replace('«» ', ''),
        race: ch.race,
        raceName: cat.races.find((r) => r.id === ch.race)?.name_ru ?? ch.race,
        raceHint: (() => {
          const race = cat.races.find((r) => r.id === ch.race);
          return race ? `${race.passive}. ${race.weakness}.` : '';
        })(),
        job: ch.job,
        jobName: cat.classes.find((c) => c.id === ch.job)?.name_ru ?? ch.job,
        jobHint: (() => {
          const job = cat.classes.find((c) => c.id === ch.job);
          return job ? `${job.role}. Ключевой параметр: ${STAT_RU[job.key_stat] ?? job.key_stat}.` : '';
        })(),
        rarity: ch.rarity,
        traits: ch.traits.map((id) => {
          const t = cat.traits.find((x) => x.id === id);
          const hint = t ? effectText(t.effects) : '';
          return { id, name: t?.name_ru ?? id, sign: t?.sign ?? '+', hint: hint || 'Особый навык.' };
        }),
        level: ch.level,
        starRank: ch.starRank,
        portrait: ch.portrait,
        thumb: ch.thumb,
        bio: ch.bio,
        quote: ch.quote,
        reserve: ch.reserve,
        legacy: ch.legacy,
        stats,
        power: Math.round(stats.str * 0.5 + stats.spd * 0.3 + stats.acc * 0.2),
      };
    }),
    floors: [...g.base.floors].sort((a, b) => b.z - a.z),
    catalogBuildings: cat.buildings.map((b) => ({
      id: b.id,
      name: b.name_ru,
      tag: b.tag,
      zone: b.zone,
      tier: b.tier,
      cost: upgradeCost(b, 1, cat.economy),
      count: builtCells(g, cat).filter((x) => x.def.id === b.id).length,
      maxLevel: tierLevelCap(b.tier, g.rebirths),
      maxCopies: tierCopyCap(b.tier, g.rebirths),
      effect: b.effects.map(humanEffect).filter(Boolean).join(', '),
    })),
    pendingCards: g.pendingCards
      ? g.pendingCards.map((id) => {
          const c = cat.cards.find((x) => x.id === id);
          return { id, name: c?.name_ru ?? id, rarity: c?.rarity ?? 'common', tags: c?.tags ?? [], text: effectText(c?.effects ?? [], c?.text_ru), curse: effectText(c?.curse ?? [], c?.curse_ru) };
        })
      : null,
    pendingBases: g.pendingBases
      ? g.pendingBases.map((id) => {
          const b = cat.bases.find((x) => x.id === id);
          const start = (b?.start_buildings ?? []).map((s) => `${cat.buildings.find((x) => x.id === s.type)?.name_ru ?? s.type} ${s.level} ур.`).join(', ');
          return { id, name: b?.name_ru ?? id, rarity: b?.rarity ?? 'common', risk: b?.risk ?? 'low', flavor: b?.flavor_ru ?? '', buff: effectText(b?.buffs ?? []), debuff: effectText(b?.debuffs ?? []), start };
        })
      : null,
    runCards: g.runCards.map((c) => {
      const def = cat.cards.find((x) => x.id === c.id);
      return { id: c.id, name: def?.name_ru ?? c.id, stacks: c.stacks, rarity: def?.rarity ?? 'common', text: def?.text_ru || '' };
    }),
    queue: g.queue.map((q) => ({ speaker: q.speaker, text: q.text })),
    journal: g.journal,
    meta: cat.meta.map((m) => {
      const lv = metaLv(g, m.id);
      return { id: m.id, name: m.name_ru, effect: m.effect_ru, level: lv, max: m.max_level, nextCost: lv >= m.max_level ? null : (m.costs[lv] ?? null) };
    }),
    offers: g.offers,
    active: g.active.map((a) => ({ ...a, seconds: a.seconds ?? cat.contracts.find((c) => c.id === a.id)?.seconds ?? 0 })),
    canRebirth: g.credits >= due,
    rebirthPrice: price,
    rebirthDue: due,
    rebirthThreshold: price,
    baseValue: Math.round(g.spent),
    posts: builtCells(g, cat).map((b) => {
      const rows = staffRows(g, cat, b.cell, b.def);
      return {
        plotId: b.cell.plotId,
        slots: staffSlotCount(b.def, b.cell.level ?? 1),
        keyStat: b.def.key_stat,
        keyName: STAT_RU[b.def.key_stat] ?? b.def.key_stat,
        baseline: b.def.baseline,
        k: Math.round(staffK(rows) * 100) / 100,
        classNames: b.def.class_affinity.map((id) => cat.classes.find((c) => c.id === id)?.name_ru ?? id),
        raceNames: b.def.race_affinity.map((id) => cat.races.find((r) => r.id === id)?.name_ru ?? id),
        crew: rows.map((row) => ({
          id: row.ch.id,
          name: row.ch.nickname || row.ch.firstName,
          stat: row.stat,
          classMatch: row.classMatch,
          raceMatch: row.raceMatch,
        })),
      };
    }),
    offline: g.offline,
    company: g.company,
    logoRev: g.flags.logoRev ?? 0,
    pendingGramoty: [0, 1, 2].flatMap((n) => {
      const meta = cat.meta[(g.flags[`gramota${n}`] ?? 0) - 1];
      return meta ? [{ id: meta.id, name: meta.name_ru, effect: meta.effect_ru }] : [];
    }),
    tabs: cat.ui.tabs.map((t) => ({ id: t.id, name: t.name_ru })),
    rollCost: rollCost(g, cat, 1, false),
    roll10: rollCost(g, cat, 10, false),
    focusEnabled: cat.gacha.banners_enabled,
    freeRerolls: Math.max(0, earned - g.freeRerollsUsed),
    rerollCost: Math.round(cat.economy.reroll_base * cat.economy.reroll_growth ** g.offerRerolls),
    baseRerollCost: cat.economy.base_reroll_stars * 2 ** g.baseRerolls,
    motion: g.motion,
    races: cat.races.map((r) => ({ id: r.id, name: r.name_ru })),
    classes: cat.classes.map((c) => ({ id: c.id, name: c.name_ru })),
    act: g.flags.act4 ? 4 : g.flags.act2 ? Math.max(g.flags.act ?? 1, 2) : (g.flags.act ?? 1),
    endingOpen: g.seen.includes('m18_buyout') && !g.flags.chain_sell && !g.flags.chain_refuse && !g.flags.chain_buy,
    expandCost: g.pendingCards ? 0 : expandCost(g, cat),
    levelCostGrowth: cat.economy.level_cost_growth,
    freeRolls: g.pendingFreeRolls,
  };
}

export function mapVeteran(input: {
  id: string;
  archetype: string;
  rarity: string;
  name: string;
  bio: string;
  quote: string;
  portrait: string;
  thumb: string;
  stars: number;
  traits: Trait[];
  eco: Economy;
  migration: Catalog['migration'];
}): Character {
  const rarity = input.migration.rarity[input.rarity] ?? 'common';
  const job = input.migration.archetype_class[input.archetype] ?? 'loader';
  const built = buildTraits(mulberry32(hash(input.id)), rarity, input.traits, input.eco);
  const parts = input.name.split(' ');
  const first = parts[0] ?? 'Ветеран';
  const last = parts.length > 1 ? parts[parts.length - 1]! : 'Дока';
  const nick = input.name.match(/«([^»]+)»/)?.[1] ?? 'Ветеран';
  return {
    id: input.id,
    templateId: null,
    legacy: true,
    race: input.migration.default_race,
    job,
    rarity,
    firstName: first,
    lastName: last ?? 'Дока',
    nickname: nick,
    bio: input.bio,
    quote: input.quote,
    traits: built.map((t) => t.id),
    level: 1,
    xp: 0,
    starRank: Math.max(0, Math.min(5, input.stars)),
    portrait: input.portrait,
    thumb: input.thumb,
    reserve: false,
  };
}

export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function upgradePrice(def: BuildingDef, nextLevel: number, eco: Economy): number {
  return upgradeCost(def, nextLevel, eco);
}
