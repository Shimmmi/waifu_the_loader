import { D, type Decimal } from './bignum.js';
import { rarityConfig } from './config.js';
import { buildingConfig, milestoneMult, type BuildingLevels, type WaifuView } from './economy.js';
import type { ContractTag, EconomyConfig, PrestigeEffect, PrestigeNode, Rarity, StatKey, Stats, TrainingType } from './schemas.js';
import { STATS } from './schemas.js';

const lvl = (b: BuildingLevels, id: string, cfg: EconomyConfig) => b[id] ?? buildingConfig(cfg, id).start_level;
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

// ---------- Престиж: модификаторы ----------
export interface PrestigeMods {
  cargoMult: number;
  coinsMult: number;
  proteinMult: number;
  xpMult: number;
  offlineHours: number;
  trainingSlots: number;
  contractSlots: number;
  startCoins: number;
  prestigeTickets: number;
  autoClaim: boolean;
  autoBuildings: boolean;
}

export const NO_MODS: PrestigeMods = {
  cargoMult: 1,
  coinsMult: 1,
  proteinMult: 1,
  xpMult: 1,
  offlineHours: 0,
  trainingSlots: 0,
  contractSlots: 0,
  startCoins: 0,
  prestigeTickets: 0,
  autoClaim: false,
  autoBuildings: false,
};

export function prestigeMods(upgrades: Record<string, number>, sealsEarned: number, cfg: EconomyConfig): PrestigeMods {
  const sum: Partial<Record<PrestigeEffect, number>> = {};
  for (const n of cfg.prestige.tree) {
    const l = Math.min(upgrades[n.id] ?? 0, n.costs.length);
    if (l > 0) sum[n.effect] = (sum[n.effect] ?? 0) + n.value * l;
  }
  const seal = 1 + cfg.prestige.seal_bonus * sealsEarned;
  return {
    cargoMult: seal * (1 + (sum.cargo_mult ?? 0)),
    coinsMult: seal * (1 + (sum.coins_mult ?? 0)),
    proteinMult: 1 + (sum.protein_mult ?? 0),
    xpMult: 1 + (sum.xp_mult ?? 0),
    offlineHours: sum.offline_hours ?? 0,
    trainingSlots: sum.training_slots ?? 0,
    contractSlots: sum.contract_slots ?? 0,
    startCoins: sum.start_coins ?? 0,
    prestigeTickets: sum.prestige_tickets ?? 0,
    autoClaim: (sum.auto_claim ?? 0) > 0,
    autoBuildings: (sum.auto_buildings ?? 0) > 0,
  };
}

/** Печати за текущий забег: floor((груз/делитель)^степень). */
export function sealsFor(runCargo: Decimal, cfg: EconomyConfig): number {
  const p = cfg.prestige;
  if (runCargo.lt(p.seals_divisor)) return 0;
  return Math.floor(runCargo.div(p.seals_divisor).pow(p.seals_exponent).toNumber());
}

/** Груз, нужный для заданного числа печатей. */
export function cargoForSeals(seals: number, cfg: EconomyConfig): Decimal {
  const p = cfg.prestige;
  return D(seals).pow(1 / p.seals_exponent).mul(p.seals_divisor);
}

export function nodeCost(node: PrestigeNode, level: number): number | null {
  return node.costs[level] ?? null;
}

// ---------- Здания M4 ----------
export function merchMult(b: BuildingLevels, cfg: EconomyConfig): number {
  const l = lvl(b, 'merch', cfg);
  return (1 + buildingConfig(cfg, 'merch').per_level * l) * (l > 0 ? milestoneMult(l, cfg) : 1);
}

export function dispatchMult(b: BuildingLevels, cfg: EconomyConfig): number {
  const l = lvl(b, 'dispatch', cfg);
  return (1 + buildingConfig(cfg, 'dispatch').per_level * l) * (l > 0 ? milestoneMult(l, cfg) : 1);
}

export function gymSpeed(b: BuildingLevels, cfg: EconomyConfig): number {
  return buildingConfig(cfg, 'gym').per_level * lvl(b, 'gym', cfg);
}

export function offlineExtraHours(b: BuildingLevels, cfg: EconomyConfig, mods: PrestigeMods = NO_MODS): number {
  const dorm = Math.min(cfg.dormitory.max_extra_hours, buildingConfig(cfg, 'dormitory').per_level * lvl(b, 'dormitory', cfg));
  return dorm + mods.offlineHours;
}

export function gymSlots(b: BuildingLevels, cfg: EconomyConfig, mods: PrestigeMods = NO_MODS): number {
  const l = lvl(b, 'gym', cfg);
  if (l < 1) return 0;
  const g = cfg.gym;
  return Math.min(g.slots_max, g.slots_base + Math.floor(l / g.slots_per_levels)) + mods.trainingSlots;
}

export function contractSlots(b: BuildingLevels, cfg: EconomyConfig, mods: PrestigeMods = NO_MODS): number {
  const l = lvl(b, 'dispatch', cfg);
  if (l < 1) return 0;
  const d = cfg.dispatch;
  return Math.min(d.active_max, d.active_base + Math.floor(l / d.active_per_levels)) + mods.contractSlots;
}

export function boardSize(b: BuildingLevels, cfg: EconomyConfig): number {
  const l = lvl(b, 'dispatch', cfg);
  if (l < 1) return 0;
  const d = cfg.dispatch;
  return Math.min(d.board_max, d.board_base + Math.floor(l / d.board_per_levels));
}

// ---------- Усталость ----------
export function fatigueRecoveryPerHour(b: BuildingLevels, cfg: EconomyConfig): number {
  return cfg.fatigue.recovery_per_hour + buildingConfig(cfg, 'bath').per_level * lvl(b, 'bath', cfg);
}

/** Текущая усталость: восстановление начинается с fatigueAt (момент окончания последней работы). */
export function fatigueNow(value: number, fatigueAtMs: number, nowMs: number, b: BuildingLevels, cfg: EconomyConfig): number {
  const h = Math.max(0, nowMs - fatigueAtMs) / 3_600_000;
  return Math.max(0, value - fatigueRecoveryPerHour(b, cfg) * h);
}

export function fatigueGain(kind: 'training' | 'contracts', durationMin: number, b: BuildingLevels, cfg: EconomyConfig): number {
  const k = cfg[kind];
  const f = cfg.fatigue;
  const reduce = Math.min(f.canteen_reduction_max, f.canteen_reduction_per_level * lvl(b, 'canteen', cfg));
  return (k.fatigue_min + (k.fatigue_per_hour * durationMin) / 60) * (1 - reduce);
}

export function fatiguePenalty(fatigue: number, cfg: EconomyConfig): number {
  return cfg.fatigue.penalty_at_max * clamp(fatigue / cfg.fatigue.max, 0, 1);
}

// ---------- Опыт ----------
export function xpNeed(level: number, cfg: EconomyConfig): number {
  const t = cfg.training;
  return Math.floor(t.xp_level_base * Math.pow(t.xp_level_growth, level - 1));
}

/** Применить опыт: уровни растут до cap, остаток копится. */
export function applyXp(level: number, xp: number, gain: number, cap: number, cfg: EconomyConfig): { level: number; xp: number; levels: number } {
  let l = level;
  let x = xp + gain;
  while (l < cap && x >= xpNeed(l, cfg)) {
    x -= xpNeed(l, cfg);
    l++;
  }
  if (l >= cap) x = Math.min(x, xpNeed(l, cfg));
  return { level: l, xp: Math.floor(x), levels: l - level };
}

// ---------- Бонусы статов ----------
export type StatBonus = Partial<Record<StatKey, number>>;

export function addStats(base: Stats, bonus: StatBonus | null | undefined): Stats {
  const out = { ...base };
  if (bonus) for (const s of STATS) out[s] += bonus[s] ?? 0;
  return out;
}

export function statBonusCap(rarity: Rarity, cfg: EconomyConfig): number {
  return Math.floor(rarityConfig(cfg, rarity).stat_budget * cfg.training.stat_bonus_cap_ratio);
}

export const statBonusTotal = (b: StatBonus | null | undefined) => STATS.reduce((s, k) => s + (b?.[k] ?? 0), 0);

// ---------- Тренировки ----------
export function trainingType(cfg: EconomyConfig, id: string): TrainingType | undefined {
  return cfg.training.types.find((t) => t.id === id);
}

/**
 * Ускорение тренировки: Спортзал + свои таланты training_speed (target self)
 * + таланты бригады склада для архетипа ученицы или для всех (building:canteen).
 */
export function trainingSpeed(trainee: Pick<WaifuView, 'archetype' | 'talents'>, brigade: Pick<WaifuView, 'talents'>[], b: BuildingLevels, cfg: EconomyConfig): number {
  let v = gymSpeed(b, cfg);
  for (const t of trainee.talents) if (t.effect_type === 'training_speed' && t.target === 'self') v += t.value;
  for (const w of brigade) {
    for (const t of w.talents) {
      if (t.effect_type !== 'training_speed') continue;
      if (t.target === `archetype:${trainee.archetype}` || t.target === 'building:canteen') v += t.value;
    }
  }
  return v;
}

export function trainingSeconds(durationMin: number, speed: number): number {
  return Math.max(30, Math.round((durationMin * 60) / (1 + speed)));
}

export type TrainingOutcome = 'fail' | 'success' | 'great';

export interface TrainingResult {
  outcome: TrainingOutcome;
  xp: number;
  stat: StatKey | null;
  amount: number;
  /** Рост стата упёрся в потолок бонуса */
  capped: boolean;
}

export function rollTraining(
  rnd: () => number,
  input: { type: TrainingType; durationMin: number; fatigue: number; rarity: Rarity; bonus: StatBonus | null | undefined; xpMult: number },
  cfg: EconomyConfig,
): TrainingResult {
  const t = cfg.training;
  const h = input.durationMin / 60;
  const pen = fatiguePenalty(input.fatigue, cfg);
  const baseXp = t.xp_per_min * input.durationMin * input.type.xp_mult * input.xpMult;
  if (rnd() < t.fail_chance + pen * 0.3) return { outcome: 'fail', xp: Math.floor(baseXp * 0.5), stat: null, amount: 0, capped: false };
  const great = rnd() < t.great_chance;
  const chance = Math.min(t.stat_chance_max, t.stat_chance_base + t.stat_chance_per_hour * h) * (input.type.stat_chance_mult ?? 1) * (1 - pen);
  const xp = Math.floor(baseXp * (great ? 2 : 1));
  if (!great && rnd() >= chance) return { outcome: 'success', xp, stat: null, amount: 0, capped: false };
  const stat = input.type.stats[Math.floor(rnd() * input.type.stats.length)] ?? input.type.stats[0]!;
  const want = Math.max(1, Math.round(t.stat_gain_per_hour * h)) * (great ? 2 : 1);
  const left = Math.max(0, statBonusCap(input.rarity, cfg) - statBonusTotal(input.bonus));
  const amount = Math.min(want, left);
  return { outcome: great ? 'great' : 'success', xp, stat: amount > 0 ? stat : null, amount, capped: amount < want };
}

// ---------- Контракты ----------

export interface ContractOffer {
  clientId: string;
  cargoId: string;
  tag: ContractTag;
  stat: StatKey;
  durationMin: number;
  requiredPower: number;
  rewardCoins: Decimal;
  rewardProtein: Decimal;
  ticketChance: number;
}

export function makeOffer(
  rnd: () => number,
  input: {
    clients: { id: string }[];
    cargo: { id: string; tag: ContractTag; stat: StatKey }[];
    refCoinsPerSec: Decimal;
    refProteinPerSec: Decimal;
    refPower: number;
    buildings: BuildingLevels;
  },
  cfg: EconomyConfig,
): ContractOffer {
  const c = cfg.contracts;
  const pick = <T>(a: T[]): T => a[Math.floor(rnd() * a.length)] ?? a[0]!;
  const client = pick(input.clients);
  const cargo = pick(input.cargo);
  const durationMin = pick(c.durations_min);
  const [lo, hi] = c.required_power_range;
  const requiredPower = Math.max(10, Math.round(input.refPower * (lo + (hi - lo) * rnd())));
  const sec = durationMin * 60;
  const dm = dispatchMult(input.buildings, cfg);
  // Сложный заказ платит больше
  const hard = 0.8 + 0.4 * ((requiredPower / Math.max(1, input.refPower) - lo) / Math.max(0.01, hi - lo));
  const coinsRef = input.refCoinsPerSec.lt(1) ? D(1) : input.refCoinsPerSec;
  return {
    clientId: client.id,
    cargoId: cargo.id,
    tag: cargo.tag,
    stat: cargo.stat,
    durationMin,
    requiredPower,
    rewardCoins: coinsRef.mul(sec * c.reward_coin_seconds_mult * dm * hard).add(100).floor(),
    rewardProtein: input.refProteinPerSec.mul(sec * c.reward_protein_seconds_mult * dm).floor(),
    ticketChance: Math.min(c.ticket_chance_max, (c.ticket_chance_per_hour * durationMin) / 60),
  };
}

export interface ContractTeamMember extends Pick<WaifuView, 'rarity' | 'stats' | 'level' | 'stars' | 'talents'> {
  power: number;
  fatigue: number;
}

/** Бонус талантов contract_bonus для тега заказа (contract:<tag> или без цели). */
export function contractTalentBonus(team: Pick<WaifuView, 'talents'>[], tag: string): number {
  let v = 0;
  for (const w of team) {
    for (const t of w.talents) {
      if (t.effect_type !== 'contract_bonus') continue;
      if (t.target === `contract:${tag}` || t.target === 'self' || t.target === 'global') v += t.value;
    }
  }
  return v;
}

export function contractChance(team: ContractTeamMember[], offer: Pick<ContractOffer, 'requiredPower' | 'stat' | 'tag'>, cfg: EconomyConfig): number {
  const c = cfg.contracts;
  if (!team.length) return 0;
  const power = team.reduce((s, w) => s + w.power, 0);
  const ratio = Math.min(c.ratio_cap, power / Math.max(1, offer.requiredPower));
  const statAvg = team.reduce((s, w) => s + w.stats[offer.stat], 0) / team.length;
  const statBonus = Math.min(c.stat_bonus_max, statAvg / 300);
  const lck = team.reduce((s, w) => s + w.stats.lck, 0);
  const fatigue = team.reduce((s, w) => s + w.fatigue, 0) / team.length;
  const talent = contractTalentBonus(team, offer.tag) / 2;
  const raw = c.chance_base + c.chance_per_ratio * ratio + statBonus + lck * c.lck_bonus + talent - fatiguePenalty(fatigue, cfg);
  return clamp(raw, c.chance_min, c.chance_max);
}
