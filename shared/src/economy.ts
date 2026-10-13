import { D, Decimal, ZERO } from './bignum.js';
import { rarityConfig } from './config.js';
import type { BuildingConfig, EconomyConfig, Rarity, Stats, Talent } from './schemas.js';
import { STATS } from './schemas.js';

export interface WaifuView {
  id: string;
  archetype: string;
  rarity: Rarity;
  stats: Stats;
  level: number;
  stars: number;
  talents: Talent[];
}

export type BuildingLevels = Record<string, number>;

export interface Rates {
  power: number;
  cargoPerSec: Decimal;
  coinsPerSec: Decimal;
  proteinPerSec: Decimal;
  pricePerKg: number;
  critChance: number;
  offlineEfficiency: number;
  /** Разбивка множителей для UI */
  mult: { warehouse: number; talentsCargo: number; talentsCoins: number; crit: number; autopark: number; merch: number; prestigeCargo: number; prestigeCoins: number; clerk: number };
}

/** Постоянные множители от печатей и дерева престижа. */
export interface RateMods {
  cargoMult: number;
  coinsMult: number;
  proteinMult: number;
}

export interface Resources {
  cargo: Decimal;
  cargoTotal: Decimal;
  coins: Decimal;
  protein: Decimal;
}

// ---------- Мощность (ТЗ 5.3) ----------
export function waifuPower(w: Pick<WaifuView, 'rarity' | 'stats' | 'level' | 'stars'>, cfg: EconomyConfig): number {
  const k = cfg.power.weights;
  const base = STATS.reduce((s, st) => s + w.stats[st] * k[st], 0);
  const rm = rarityConfig(cfg, w.rarity).power_mult;
  return base * rm * (1 + cfg.power.level_bonus * w.level) * (1 + cfg.power.star_bonus * w.stars);
}

// ---------- Здания ----------
export function buildingConfig(cfg: EconomyConfig, id: string): BuildingConfig {
  const b = cfg.buildings.find((x) => x.id === id);
  if (!b) throw new Error(`Unknown building ${id}`);
  return b;
}

/** Число достигнутых вех ×2 (25/50/100, далее каждые 100). */
export function milestoneCount(level: number, cfg: EconomyConfig): number {
  const m = cfg.building_milestones;
  const explicit = m.levels.filter((l) => level >= l).length;
  const last = m.levels[m.levels.length - 1] ?? 0;
  const extra = level > last ? Math.floor((level - last) / m.every_after) : 0;
  return explicit + extra;
}

export function milestoneMult(level: number, cfg: EconomyConfig): number {
  return Math.pow(cfg.building_milestones.mult, milestoneCount(level, cfg));
}

/** Стоимость перехода с level на level+1: base × growth^level. */
export function buildingCost(b: BuildingConfig, level: number): Decimal {
  return D(b.cost_growth).pow(level).mul(b.base_cost);
}

/** Стоимость n уровней подряд (геометрическая прогрессия). */
export function buildingBulkCost(b: BuildingConfig, level: number, n: number): Decimal {
  if (n <= 0) return ZERO;
  const r = D(b.cost_growth);
  return buildingCost(b, level).mul(r.pow(n).sub(1)).div(r.sub(1));
}

/** Сколько уровней можно купить на coins (максимум). */
export function buildingMaxAffordable(b: BuildingConfig, level: number, coins: Decimal): number {
  const first = buildingCost(b, level);
  if (coins.lt(first)) return 0;
  // n = floor(log_r(coins*(r-1)/first + 1))
  const r = b.cost_growth;
  const x = coins.mul(r - 1).div(first).add(1);
  let n = Math.floor(x.log10() / Math.log10(r));
  while (n > 0 && buildingBulkCost(b, level, n).gt(coins)) n--;
  return Math.max(0, n);
}

export function warehouseSlots(level: number, cfg: EconomyConfig): number {
  const s = cfg.warehouse_slots;
  return Math.min(s.max, s.base + Math.floor(level / s.per_levels));
}

// ---------- Прокачка waifu (ТЗ 5.6) ----------
export function levelCap(stars: number, cfg: EconomyConfig): number {
  return cfg.waifu_level.cap_base + cfg.waifu_level.cap_per_star * stars;
}

export function waifuLevelCost(rarity: Rarity, level: number, cfg: EconomyConfig): { coins: Decimal; protein: Decimal } {
  const wl = cfg.waifu_level;
  const rm = rarityConfig(cfg, rarity).level_cost_mult;
  const coins = D(wl.growth).pow(level - 1).mul(wl.coin_base * rm);
  const protein =
    level >= wl.protein_from_level ? D(wl.growth).pow(level - wl.protein_from_level).mul(wl.protein_base * rm) : ZERO;
  return { coins: coins.floor(), protein: protein.floor() };
}

export function starCost(rarity: Rarity, stars: number, cfg: EconomyConfig): number | null {
  if (stars >= cfg.stars.max) return null;
  const base = cfg.stars.shard_cost[stars];
  if (base === undefined) return null;
  return Math.ceil(base * (cfg.stars.rarity_cost_mult[rarity] ?? 1));
}

// ---------- Таланты ----------
export function talentActive(t: Talent, brigade: Pick<WaifuView, 'archetype'>[]): boolean {
  const c = t.condition;
  if (!c) return true;
  if (c.type === 'brigade_has_archetype') return brigade.some((w) => w.archetype === c.archetype);
  if (c.type === 'brigade_size_gte') return brigade.length >= c.n;
  return false;
}

// ---------- Расчёт скоростей ----------
/** Кладовщик не в бригаде: 5% к грузу плюс харизма, потолок 12%. */
export function clerkCargoMult(cha: number | null): number {
  if (cha === null) return 1;
  return Math.min(1.12, 1.05 + cha / 800);
}

export function computeRates(
  brigade: WaifuView[],
  buildings: BuildingLevels,
  cfg: EconomyConfig,
  mods: RateMods = { cargoMult: 1, coinsMult: 1, proteinMult: 1 },
  clerkCha: number | null = null,
): Rates {
  const p = cfg.production;
  let globalCargo = 0;
  let globalCoins = 0;
  let proteinTalent = 0;
  let priceTalent = 0;
  let critTalent = 0;
  let offlineTalent = 0;
  const selfMult = new Map<string, number>();
  const archMult = new Map<string, number>();

  for (const w of brigade) {
    for (const t of w.talents) {
      if (!talentActive(t, brigade)) continue;
      const v = t.value;
      switch (t.effect_type) {
        case 'cargo_mult':
        case 'synergy':
          if (t.target === 'self') selfMult.set(w.id, (selfMult.get(w.id) ?? 0) + v);
          else if (t.target.startsWith('archetype:')) {
            const a = t.target.slice(10);
            archMult.set(a, (archMult.get(a) ?? 0) + v);
          } else if (t.target === 'building:canteen') proteinTalent += v;
          else if (t.target === 'building:autopark') priceTalent += v;
          else globalCargo += v;
          break;
        case 'coins_mult':
          if (t.target === 'building:canteen') proteinTalent += v;
          else globalCoins += v;
          break;
        case 'crit_chance':
          critTalent += v;
          break;
        case 'offline_bonus':
          offlineTalent += v;
          break;
        // contract_bonus, training_speed — в management.ts
        default:
          break;
      }
    }
  }

  let power = 0;
  let weighted = 0;
  let lck = 0;
  let cha = 0;
  let end = 0;
  for (const w of brigade) {
    const pw = waifuPower(w, cfg);
    power += pw;
    weighted += pw * (1 + (selfMult.get(w.id) ?? 0)) * (1 + (archMult.get(w.archetype) ?? 0));
    lck += w.stats.lck;
    cha += w.stats.cha;
    end += w.stats.end;
  }

  const wh = buildingConfig(cfg, 'warehouse');
  const whLevel = buildings.warehouse ?? wh.start_level;
  const warehouseMult = (1 + wh.per_level * Math.max(0, whLevel - 1)) * milestoneMult(whLevel, cfg);

  const critChance = Math.min(p.crit_cap, lck * p.lck_crit_chance + critTalent);
  const critExpect = 1 + critChance * (p.crit_mult - 1);

  const ap = buildingConfig(cfg, 'autopark');
  const apLevel = buildings.autopark ?? ap.start_level;
  const autoparkMult = (1 + ap.per_level * apLevel) * milestoneMult(apLevel, cfg);
  const pricePerKg = p.base_price_per_kg * autoparkMult * (1 + cha * p.cha_price_bonus) * (1 + priceTalent);

  const mc = cfg.buildings.find((x) => x.id === 'merch');
  const mcLevel = mc ? (buildings.merch ?? mc.start_level) : 0;
  const merchMult = mc ? (1 + mc.per_level * mcLevel) * (mcLevel > 0 ? milestoneMult(mcLevel, cfg) : 1) : 1;

  const clerk = clerkCargoMult(clerkCha);
  const cargoPerSec = D(weighted * p.cargo_per_power * warehouseMult * (1 + globalCargo) * critExpect * mods.cargoMult * clerk);
  const coinsPerSec = cargoPerSec.mul(pricePerKg * (1 + globalCoins) * merchMult * mods.coinsMult);

  const cn = buildingConfig(cfg, 'canteen');
  const cnLevel = buildings.canteen ?? cn.start_level;
  const proteinPerSec = D(cn.per_level * cnLevel * milestoneMult(cnLevel, cfg) * (1 + proteinTalent) * mods.proteinMult);

  const o = cfg.offline;
  const avgEnd = brigade.length ? end / brigade.length : 0;
  const offlineEfficiency = Math.min(o.max_efficiency, o.base_efficiency + avgEnd * o.end_efficiency + offlineTalent);

  return {
    power,
    cargoPerSec,
    coinsPerSec,
    proteinPerSec,
    pricePerKg,
    critChance,
    offlineEfficiency,
    mult: {
      warehouse: warehouseMult,
      talentsCargo: 1 + globalCargo,
      talentsCoins: 1 + globalCoins,
      crit: critExpect,
      autopark: autoparkMult,
      merch: merchMult,
      prestigeCargo: mods.cargoMult,
      prestigeCoins: mods.coinsMult,
      clerk,
    },
  };
}

// ---------- Тики и офлайн (ТЗ 11) ----------
export interface Settlement {
  elapsedSec: number;
  onlineSec: number;
  offlineSec: number;
  /** Офлайн-время, срезанное капом */
  lostSec: number;
  /** Эффективные секунды производства */
  effectiveSec: number;
}

export function settle(lastTickMs: number, nowMs: number, rates: Pick<Rates, 'offlineEfficiency'>, cfg: EconomyConfig, extraCapHours = 0): Settlement {
  const elapsedSec = Math.max(0, (nowMs - lastTickMs) / 1000);
  const grace = cfg.offline.online_grace_sec;
  if (elapsedSec <= grace) {
    return { elapsedSec, onlineSec: elapsedSec, offlineSec: 0, lostSec: 0, effectiveSec: elapsedSec };
  }
  const capSec = (cfg.offline.cap_hours + extraCapHours) * 3600;
  const rawOffline = elapsedSec - grace;
  const offlineSec = Math.min(rawOffline, capSec);
  return {
    elapsedSec,
    onlineSec: grace,
    offlineSec,
    lostSec: rawOffline - offlineSec,
    effectiveSec: grace + offlineSec * rates.offlineEfficiency,
  };
}

/**
 * Эффективные секунды куска [fromMs, toMs) внутри окна [windowStartMs, …).
 * Сумма кусков равна settle(windowStart, end).effectiveSec.
 */
export function effectiveSecondsBetween(
  windowStartMs: number,
  fromMs: number,
  toMs: number,
  rates: Pick<Rates, 'offlineEfficiency'>,
  cfg: EconomyConfig,
  extraCapHours = 0,
): number {
  if (toMs <= fromMs || toMs <= windowStartMs) return 0;
  const from = Math.max(fromMs, windowStartMs);
  const graceEnd = windowStartMs + cfg.offline.online_grace_sec * 1000;
  const capEnd = graceEnd + (cfg.offline.cap_hours + extraCapHours) * 3600 * 1000;
  const span = (a: number, b: number) => Math.max(0, Math.min(toMs, b) - Math.max(from, a)) / 1000;
  return span(windowStartMs, graceEnd) + span(graceEnd, capEnd) * rates.offlineEfficiency;
}

export function produce(res: Resources, rates: Rates, effectiveSec: number): Resources {
  const cargo = rates.cargoPerSec.mul(effectiveSec);
  return {
    cargo: res.cargo.add(cargo),
    cargoTotal: res.cargoTotal.add(cargo),
    coins: res.coins.add(rates.coinsPerSec.mul(effectiveSec)),
    protein: res.protein.add(rates.proteinPerSec.mul(effectiveSec)),
  };
}

/** Награды за вехи суммарного груза. Возвращает новые достигнутые индексы и билеты. */
export function cargoMilestoneRewards(cargoTotal: Decimal, reachedIdx: number, cfg: EconomyConfig): { newIdx: number; tickets: number } {
  let idx = reachedIdx;
  let tickets = 0;
  while (idx < cfg.cargo_milestones.length) {
    const m = cfg.cargo_milestones[idx];
    if (!m || cargoTotal.lt(m.kg)) break;
    tickets += m.tickets;
    idx++;
  }
  return { newIdx: idx, tickets };
}
