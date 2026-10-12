import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { loadEconomy, loadGacha } from './config.js';
import { baseRates, effectiveRates, isSrPlus, isSsrPlus, rollOnce, ssrPlusChance, type PityState } from './gacha.js';
import { RARITIES, type Rarity } from './schemas.js';

const econ = loadEconomy();
const g = loadGacha();
const base = baseRates(econ);

/** Быстрый криптографический rng: буфер случайных байт. */
function cryptoRng(): () => number {
  let buf = randomBytes(8 * 65536);
  let off = 0;
  return () => {
    if (off >= buf.length) {
      buf = randomBytes(8 * 65536);
      off = 0;
    }
    const hi = buf.readUInt32BE(off) >>> 5;
    const lo = buf.readUInt32BE(off + 4) >>> 6;
    off += 8;
    return (hi * 67108864 + lo) / 9007199254740992;
  };
}

describe('pity', () => {
  it('базовые шансы из ТЗ 5.2', () => {
    expect(base).toEqual({ N: 0.6, R: 0.28, SR: 0.09, SSR: 0.025, UR: 0.005 });
  });

  it('мягкий pity с 60-го: +5% за шаг; жёсткий на 80-м', () => {
    expect(ssrPlusChance(59, base, g)).toBeCloseTo(0.03);
    expect(ssrPlusChance(60, base, g)).toBeCloseTo(0.08);
    expect(ssrPlusChance(70, base, g)).toBeCloseTo(0.58);
    expect(ssrPlusChance(80, base, g)).toBe(1);
  });

  it('жёсткий pity гарантирует SSR+ на 80-м призыве даже при худшем rng', () => {
    let s: PityState = { sinceSsr: 0, sinceSr: 0 };
    const worst = () => 0.999999;
    let got = -1;
    for (let i = 1; i <= 80; i++) {
      const r = rollOnce(s, base, g, worst);
      s = r.state;
      if (isSsrPlus(r.rarity)) {
        got = i;
        expect(r.pity).not.toBe('none');
        break;
      }
    }
    expect(got).toBeLessThanOrEqual(80);
  });

  it('SR+ не реже чем каждые 10 призывов', () => {
    const rng = cryptoRng();
    let s: PityState = { sinceSsr: 0, sinceSr: 0 };
    let streak = 0;
    let maxStreak = 0;
    for (let i = 0; i < 200_000; i++) {
      const r = rollOnce(s, base, g, rng);
      s = r.state;
      streak = isSrPlus(r.rarity) ? 0 : streak + 1;
      maxStreak = Math.max(maxStreak, streak);
    }
    expect(maxStreak).toBe(9);
  });
});

describe('симуляция 1 млн призывов (приёмка M2, ±0.2%)', () => {
  const N = 1_000_000;

  it('сырые броски без pity совпадают с базовыми шансами', () => {
    const rng = cryptoRng();
    const counts: Record<Rarity, number> = { N: 0, R: 0, SR: 0, SSR: 0, UR: 0 };
    // sinceSsr = 0, sinceSr = 0 на каждом броске — pity не вмешивается
    for (let i = 0; i < N; i++) counts[rollOnce({ sinceSsr: 0, sinceSr: 0 }, base, g, rng).rarity]++;
    for (const r of RARITIES) expect(Math.abs(counts[r] / N - base[r])).toBeLessThan(0.002);
  });

  it('с pity совпадает с аналитическими итоговыми шансами', () => {
    const rng = cryptoRng();
    const eff = effectiveRates(base, g);
    const counts: Record<Rarity, number> = { N: 0, R: 0, SR: 0, SSR: 0, UR: 0 };
    let s: PityState = { sinceSsr: 0, sinceSr: 0 };
    for (let i = 0; i < N; i++) {
      const r = rollOnce(s, base, g, rng);
      s = r.state;
      counts[r.rarity]++;
    }
    const sum = RARITIES.reduce((a, r) => a + eff[r], 0);
    expect(sum).toBeCloseTo(1, 6);
    for (const r of RARITIES) expect(Math.abs(counts[r] / N - eff[r])).toBeLessThan(0.002);
  });
});
