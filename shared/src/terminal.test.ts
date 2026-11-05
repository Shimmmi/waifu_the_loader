import { describe, expect, it } from 'vitest';
import {
  CLASS_FIT,
  expansionOffer,
  jobFromStats,
  lineSynergy,
  neighborBonus,
  passiveShare,
  rushAllowed,
  shiftGrade,
  moraleDelta,
  simulateLine,
  skillIndex,
  slotPreview,
  unloadSlots,
  type LineWorker,
} from './terminal.js';

const stats = { str: 25, spd: 25, lck: 25, end: 25, cha: 25 };

describe('линия §8.3', () => {
  it('пустые станции держатся на автоставке, узкое место — разгрузка', () => {
    const r = simulateLine([]);
    expect(r.unload).toBe(3);
    expect(r.move).toBe(4);
    expect(r.store).toBe(4);
    expect(r.bottleneck).toBe('unload');
    expect(r.tonsPerMin).toBe(3);
  });

  it('грузчик на разгрузке поднимает её выше автоставки, узкое место уезжает на перемещение', () => {
    const si = skillIndex('loader', stats);
    expect(si).toBeCloseTo(25);
    const worker: LineWorker = { id: 'a', job: 'loader', stats, station: 'unload' };
    const r = simulateLine([worker]);
    expect(r.unload).toBeCloseTo(3 + 12 * 1 * CLASS_FIT.unload.loader);
    expect(r.bottleneck).toBe('move');
  });

  it('чужой класс на станции не даёт ноль', () => {
    expect(CLASS_FIT.unload.clerk).toBeGreaterThan(0);
    const r = simulateLine([{ id: 'c', job: 'clerk', stats, station: 'unload' }]);
    expect(r.unload).toBeGreaterThan(3);
  });

  it('пассив без рывка не меньше 60% активного', () => {
    const w: LineWorker = { id: 'a', job: 'loader', stats, station: 'unload' };
    const active = simulateLine([w], { rush: true }).kgPerSec;
    const passive = simulateLine([w]).kgPerSec;
    expect(passiveShare(active, passive)).toBeGreaterThanOrEqual(0.6);
  });

  it('слоты разгрузки растут от причала и не больше 6', () => {
    expect(unloadSlots(1)).toBe(1);
    expect(unloadSlots(30)).toBe(6);
  });
});

describe('сектора и синергия', () => {
  it('предложение из 3 детерминировано и закрывает дыру', () => {
    const a = expansionOffer('u', 0, 0, ['pier', 'office', 'dorm'], 'warehouse');
    expect(a).toEqual(expansionOffer('u', 0, 0, ['pier', 'office', 'dorm'], 'warehouse'));
    expect(a[0]).toBe('warehouse');
    expect(new Set(a).size).toBe(3);
  });

  it('соседство столовой и общежития включается, когда оба построены', () => {
    expect(neighborBonus(['canteen'])).not.toContain('rest');
    expect(neighborBonus(['canteen', 'dorm'])).toContain('rest');
  });

  it('предпросмотр слота отличает рост от просадки', () => {
    expect(slotPreview([], { id: 'b', job: 'loader', stats, station: 'unload' })).toBe('up');
  });

  it('синергия линии — число', () => {
    const s = lineSynergy([
      { id: 'a', job: 'crane', stats, station: 'unload' },
      { id: 'b', job: 'foreman', stats, station: 'support' },
    ]);
    expect(Number.isFinite(s)).toBe(true);
  });
});

describe('смена и рывок', () => {
  it('оценка смены по отношению факта к ожиданию', () => {
    expect(shiftGrade(125, 100)).toBe('S');
    expect(shiftGrade(50, 100)).toBe('D');
  });

  it('рывок недоступен в офлайне и на перезарядке', () => {
    expect(rushAllowed(1_000, 0, true)).toBe(false);
    expect(rushAllowed(1_000, 5_000, false)).toBe(false);
    expect(rushAllowed(6_000, 5_000, false)).toBe(true);
  });

  it('класс по статам стабилен', () => {
    expect(jobFromStats(stats)).toBe(jobFromStats(stats));
  });

  it('сдвиг морали за смену не больше трёх', () => {
    expect(moraleDelta(100)).toBe(3);
    expect(moraleDelta(-100)).toBe(-3);
  });
});
