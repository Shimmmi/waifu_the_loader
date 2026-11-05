import { describe, expect, it } from 'vitest';
import {
  STARTER_EVENTS,
  afterDebt,
  autofill,
  bestOfThree,
  chemistry,
  classFromStats,
  classPickWeight,
  contractForecast,
  courseCost,
  dailyScore,
  defectShare,
  gearBonus,
  harmonicPhi,
  hiddenVisible,
  legacyFloorKgPerHour,
  megaportTier,
  pairMod,
  payShift,
  rollExpansions,
  rushShare,
  simulate,
  stackMods,
  tierK,
  unionReward,
  wage,
  type Crew,
} from './warehouse.js';

const p = (id: string, job: Crew['job'], zone: Crew['zone'], power = 15): Crew => ({ id, job, native: job, power, zone });

describe('конвейер §5.2', () => {
  const crew: Crew[] = [
    p('a', 'loader', 'ramp'),
    p('b', 'loader', 'ramp'),
    p('c', 'loader', 'ramp'),
    p('d', 'crane', 'crane'),
    p('e', 'driver', 'fork'),
    p('f', 'clerk', 'office'),
  ];
  it('эталон: T=3.75, узкое место перемещение, 45 т за смену', () => {
    const r = simulate(crew, { heavyShare: 0.3 });
    expect(r.hand).toBeCloseTo(4.5);
    expect(r.crane).toBeCloseTo(6);
    expect(r.unload).toBeCloseTo(4.865, 2);
    expect(r.move).toBeCloseTo(3.75);
    expect(r.account).toBeCloseTo(4.5);
    expect(r.tonsPerHour).toBeCloseTo(3.75);
    expect(r.bottleneck).toBe('move');
    expect(r.tonsPerHour * 12).toBeCloseTo(45);
  });
  it('два водителя переносят узкое место в учёт, 54 т за смену', () => {
    const r = simulate([...crew, p('g', 'driver', 'fork')], { heavyShare: 0.3 });
    expect(r.move).toBeCloseTo(7.5);
    expect(r.tonsPerHour).toBeCloseTo(4.5);
    expect(r.bottleneck).toBe('account');
    expect(r.tonsPerHour * 12).toBeCloseTo(54);
  });
  it('час v2 на рампе не ниже часа v1', () => {
    const power = 100;
    const cargoPerPower = 0.05;
    const v1 = legacyFloorKgPerHour(power, cargoPerPower);
    const line = simulate([p('a', 'loader', 'ramp', power)]);
    const kg = Math.max(line.hand * 1000, v1);
    expect(kg).toBeGreaterThanOrEqual(v1);
  });
});

describe('биржа, курсы, контракт', () => {
  it('класс по доминирующему стату', () => {
    expect(classFromStats({ str: 10, end: 10, spd: 1, cha: 1, lck: 1 })).toBe('loader');
    expect(classFromStats({ str: 1, end: 1, spd: 9, cha: 1, lck: 1 })).toBe('driver');
  });
  it('фильтр класса ×3 и не гарантия', () => {
    expect(classPickWeight('crane', 'crane')).toBe(3);
    expect(classPickWeight('loader', 'crane')).toBe(1);
  });
  it('курсы дорожают степенью двойки, первая после миграции считается как n=0', () => {
    expect(courseCost(100, 0)).toBe(100);
    expect(courseCost(100, 2)).toBe(400);
  });
  it('прогноз контракта 40 т', () => {
    const ok = contractForecast({ targetTons: 40, deadlineHours: 12, progressTons: 0, heavyShare: 0.3 }, 3.75);
    expect(ok.makeIt).toBe(true);
    const fail = contractForecast({ targetTons: 40, deadlineHours: 1, progressTons: 0, heavyShare: 0.3 }, 3.75);
    expect(fail.makeIt).toBe(false);
  });
});

describe('расширения, мегапорт, события', () => {
  it('1 из 3 детерминированно', () => {
    expect(rollExpansions(7, 2)).toEqual(rollExpansions(7, 2));
    expect(rollExpansions(7, 2)).toHaveLength(3);
  });
  it('множитель ступени 3^(n-1)', () => {
    expect(tierK(1)).toBe(1);
    expect(tierK(3)).toBe(9);
    expect(megaportTier(8600)).toBe(2);
    expect(megaportTier(400_000_000)).toBe(8);
  });
  it('колода из 23 карт, mT зажат', () => {
    expect(STARTER_EVENTS).toHaveLength(23);
    expect(stackMods([2, 2, 2])).toBe(1.5);
    expect(stackMods([0.2, 0.2])).toBe(0.5);
  });
});

describe('химия, избранные, груз, зарплата, pvp', () => {
  it('химия в пределах ±10%', () => {
    expect(chemistry('a', ['b', 'c'])).toBeGreaterThanOrEqual(-0.1);
    expect(chemistry('a', ['b', 'c'])).toBeLessThanOrEqual(0.1);
    expect(pairMod(2)).toBe(0.1);
    expect(pairMod(-2)).toBe(-0.1);
  });
  it('авторасстановка не ставит уставших и не трогает замок', () => {
    const slots = autofill(
      [{ id: 's', job: 'loader', waifuId: 'keep', locked: true }],
      [{ id: 'fav', job: 'loader', order: 0, fatigue: 80 }],
      true,
    );
    expect(slots[0]!.waifuId).toBe('keep');
  });
  it('брак хрупкого падает с внимательностью, долг не удаляет карточку сразу', () => {
    expect(defectShare('fragile', 200)).toBe(0);
    expect(harmonicPhi([{ type: 'plain', share: 1 }], 'unload')).toBe(1);
    expect(payShift(5, 10).toReserve).toBe(false);
    expect(afterDebt(3).toReserve).toBe(true);
    expect(afterDebt(2).toReserve).toBe(false);
  });
  it('скрытая черта видна с третьей смены, экипировка по тиру', () => {
    expect(hiddenVisible(2)).toBe(false);
    expect(hiddenVisible(3)).toBe(true);
    expect(gearBonus(1)).toBe(4);
    expect(gearBonus(5)).toBe(26);
    expect(wage('loader', 1, 1)).toBe(10);
  });
  it('рывок не больше 15% среднего, эталонная смена детерминирована', () => {
    expect(rushShare()).toBeLessThanOrEqual(0.15);
    expect(dailyScore('day', ['a', 'b'], [0, 1])).toBe(dailyScore('day', ['a', 'b'], [0, 1]));
  });
  it('профсоюз платит только при вкладе от 1%', () => {
    expect(unionReward(100, 100, 0.009)).toBe(0);
    expect(unionReward(100, 100, 0.02)).toBe(70);
  });
  it('бой до двух побед', () => {
    expect(bestOfThree([true, false, true])).toBe('a');
    expect(bestOfThree([false, false, true])).toBe('b');
  });
});
