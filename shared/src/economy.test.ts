import { describe, expect, it } from 'vitest';
import { D, formatNumber } from './bignum.js';
import { loadEconomy } from './config.js';
import {
  buildingBulkCost,
  buildingConfig,
  buildingCost,
  buildingMaxAffordable,
  cargoMilestoneRewards,
  clerkCargoMult,
  computeRates,
  levelCap,
  milestoneCount,
  produce,
  settle,
  starCost,
  waifuLevelCost,
  waifuPower,
  warehouseSlots,
  type WaifuView,
} from './economy.js';

const cfg = loadEconomy();

const waifu = (over: Partial<WaifuView> = {}): WaifuView => ({
  id: 'w1',
  archetype: 'fridge_quiet',
  rarity: 'N',
  stats: { str: 20, end: 10, spd: 10, cha: 5, lck: 5 },
  level: 1,
  stars: 0,
  talents: [],
  ...over,
});

describe('waifuPower', () => {
  it('совпадает с формулой ТЗ 5.3', () => {
    const w = waifu({ rarity: 'SR', level: 4, stars: 2 });
    const base = 20 * 1 + 10 * 0.7 + 10 * 0.5 + 5 * 0.3 + 5 * 0.3;
    expect(waifuPower(w, cfg)).toBeCloseTo(base * 3 * (1 + 0.05 * 4) * (1 + 0.25 * 2), 9);
  });
});

describe('здания', () => {
  const wh = buildingConfig(cfg, 'warehouse');
  it('cost(n) = base × growth^n', () => {
    expect(buildingCost(wh, 0).toNumber()).toBeCloseTo(wh.base_cost);
    expect(buildingCost(wh, 10).toNumber() / (wh.base_cost * wh.cost_growth ** 10)).toBeCloseTo(1, 9);
  });
  it('bulk = сумма отдельных', () => {
    let sum = D(0);
    for (let i = 0; i < 7; i++) sum = sum.add(buildingCost(wh, 3 + i));
    expect(buildingBulkCost(wh, 3, 7).toNumber()).toBeCloseTo(sum.toNumber(), 6);
  });
  it('maxAffordable не превышает деньги', () => {
    const coins = D(12345);
    const n = buildingMaxAffordable(wh, 5, coins);
    expect(buildingBulkCost(wh, 5, n).lte(coins)).toBe(true);
    expect(buildingBulkCost(wh, 5, n + 1).gt(coins)).toBe(true);
  });
  it('вехи ×2 на 25/50/100 и далее каждые 100', () => {
    expect(milestoneCount(24, cfg)).toBe(0);
    expect(milestoneCount(25, cfg)).toBe(1);
    expect(milestoneCount(99, cfg)).toBe(2);
    expect(milestoneCount(100, cfg)).toBe(3);
    expect(milestoneCount(250, cfg)).toBe(4);
  });
  it('слоты склада ограничены 5', () => {
    expect(warehouseSlots(1, cfg)).toBe(2);
    expect(warehouseSlots(10, cfg)).toBe(3);
    expect(warehouseSlots(1000, cfg)).toBe(5);
  });
});

describe('прокачка waifu', () => {
  it('стоимость уровня растёт ×1.15', () => {
    const a = waifuLevelCost('N', 3, cfg).coins.toNumber();
    const b = waifuLevelCost('N', 4, cfg).coins.toNumber();
    expect(b / a).toBeCloseTo(1.15, 1);
    expect(waifuLevelCost('N', 1, cfg).protein.toNumber()).toBe(0);
    expect(waifuLevelCost('N', 5, cfg).protein.toNumber()).toBeGreaterThan(0);
  });
  it('кап уровня зависит от звёзд', () => {
    expect(levelCap(0, cfg)).toBe(10);
    expect(levelCap(5, cfg)).toBe(60);
  });
  it('звёзды стоят Осколков, после максимума — null', () => {
    expect(starCost('N', 0, cfg)).toBe(5);
    expect(starCost('UR', 0, cfg)).toBe(20);
    expect(starCost('N', 5, cfg)).toBeNull();
  });
});

describe('computeRates', () => {
  it('кладовщик добавляет 5–12% к грузу и не трогает протеин', () => {
    expect(clerkCargoMult(null)).toBe(1);
    expect(clerkCargoMult(0)).toBeCloseTo(1.05);
    expect(clerkCargoMult(800)).toBeCloseTo(1.12);
    const base = computeRates([waifu()], { warehouse: 1, canteen: 2 }, cfg);
    const withClerk = computeRates([waifu()], { warehouse: 1, canteen: 2 }, cfg, undefined, 0);
    expect(withClerk.cargoPerSec.toNumber() / base.cargoPerSec.toNumber()).toBeCloseTo(1.05, 6);
    expect(withClerk.proteinPerSec.toNumber()).toBeCloseTo(base.proteinPerSec.toNumber(), 6);
    expect(withClerk.mult.clerk).toBeCloseTo(1.05);
  });
  it('пустая бригада — ноль груза', () => {
    const r = computeRates([], { warehouse: 1, canteen: 1, autopark: 0 }, cfg);
    expect(r.cargoPerSec.toNumber()).toBe(0);
    expect(r.proteinPerSec.toNumber()).toBeGreaterThan(0);
  });
  it('монеты = груз × цена за кг', () => {
    const r = computeRates([waifu()], { warehouse: 5, canteen: 1, autopark: 3 }, cfg);
    expect(r.coinsPerSec.toNumber()).toBeCloseTo(r.cargoPerSec.toNumber() * r.pricePerKg, 9);
  });
  it('талант cargo_mult global увеличивает груз', () => {
    const plain = computeRates([waifu()], { warehouse: 1 }, cfg).cargoPerSec.toNumber();
    const boosted = computeRates(
      [waifu({ talents: [{ id: 't', name: 'tt', description: 'ddddd', effect_type: 'cargo_mult', target: 'global', value: 0.5, condition: null }] })],
      { warehouse: 1 },
      cfg,
    ).cargoPerSec.toNumber();
    expect(boosted / plain).toBeCloseTo(1.5, 9);
  });
  it('синергия работает только при выполнении условия', () => {
    const syn = waifu({
      talents: [{ id: 's', name: 'ss', description: 'ddddd', effect_type: 'synergy', target: 'global', value: 1, condition: { type: 'brigade_has_archetype', archetype: 'goth_packer' } }],
    });
    const other = waifu({ id: 'w2', archetype: 'goth_packer' });
    const alone = computeRates([syn], { warehouse: 1 }, cfg).cargoPerSec.toNumber();
    const single = computeRates([syn], { warehouse: 1 }, cfg);
    expect(alone).toBeCloseTo(single.cargoPerSec.toNumber());
    const pair = computeRates([syn, other], { warehouse: 1 }, cfg).cargoPerSec.toNumber();
    const pairNoSyn = computeRates([waifu(), other], { warehouse: 1 }, cfg).cargoPerSec.toNumber();
    expect(pair / pairNoSyn).toBeCloseTo(2, 9);
  });
  it('офлайн-эффективность в пределах 50–100%', () => {
    const r = computeRates([waifu({ stats: { str: 1, end: 500, spd: 1, cha: 1, lck: 1 } })], {}, cfg);
    expect(r.offlineEfficiency).toBe(1);
    expect(computeRates([], {}, cfg).offlineEfficiency).toBe(0.5);
  });
});

describe('офлайн-прогресс', () => {
  const rates = computeRates([waifu()], { warehouse: 3, canteen: 2, autopark: 1 }, cfg);
  it('короткая пауза считается онлайн', () => {
    const s = settle(0, 60_000, rates, cfg);
    expect(s.offlineSec).toBe(0);
    expect(s.effectiveSec).toBe(60);
  });
  it('офлайн ограничен 12 часами и эффективностью', () => {
    const s = settle(0, 48 * 3600_000, rates, cfg);
    expect(s.offlineSec).toBe(12 * 3600);
    expect(s.lostSec).toBeCloseTo(48 * 3600 - 90 - 12 * 3600);
    expect(s.effectiveSec).toBeCloseTo(90 + 12 * 3600 * rates.offlineEfficiency);
  });
  it('время назад не даёт отрицательного прогресса', () => {
    expect(settle(10_000, 0, rates, cfg).effectiveSec).toBe(0);
  });
  it('разбиение на тики даёт тот же результат, что один большой тик (онлайн)', () => {
    const start = { cargo: D(0), cargoTotal: D(0), coins: D(0), protein: D(0) };
    let a = start;
    for (let i = 0; i < 100; i++) a = produce(a, rates, 0.6);
    const b = produce(start, rates, 60);
    expect(a.coins.toNumber()).toBeCloseTo(b.coins.toNumber(), 6);
    expect(a.cargoTotal.toNumber()).toBeCloseTo(b.cargoTotal.toNumber(), 6);
  });
});

describe('вехи груза', () => {
  it('выдаёт билеты один раз за веху', () => {
    const r1 = cargoMilestoneRewards(D(15_000), 0, cfg);
    const [m0, m1, m2] = cfg.cargo_milestones;
    expect(m1!.kg).toBeLessThanOrEqual(15_000);
    expect(m2!.kg).toBeGreaterThan(15_000);
    expect(r1).toEqual({ newIdx: 2, tickets: m0!.tickets + m1!.tickets });
    expect(cargoMilestoneRewards(D(15_000), r1.newIdx, cfg)).toEqual({ newIdx: 2, tickets: 0 });
  });
});

describe('formatNumber', () => {
  it('короткие суффиксы и буквы', () => {
    expect(formatNumber(999)).toBe('999');
    expect(formatNumber(1234)).toBe('1.23K');
    expect(formatNumber(4.5e6)).toBe('4.5M');
    expect(formatNumber(7.8e9)).toBe('7.8B');
    expect(formatNumber(1e12)).toBe('1T');
    expect(formatNumber(1e15)).toBe('1aa');
    expect(formatNumber(2e18)).toBe('2ab');
    expect(formatNumber(D('1e1000'))).toMatch(/^[\d.]+[a-z]{2}$/);
    expect(formatNumber(1.5e20, 'scientific')).toBe('1.5e20');
  });
  it('нули целой части не срезаются, округление переносится в следующий порядок', () => {
    expect(formatNumber(490e9)).toBe('490B');
    expect(formatNumber(100)).toBe('100');
    expect(formatNumber(200e3)).toBe('200K');
    expect(formatNumber(999.9e9)).toBe('1T');
    expect(formatNumber(999999)).toBe('1M');
    expect(formatNumber(9.999e5, 'scientific')).toBe('1e6');
  });
});
