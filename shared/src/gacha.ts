import { RARITIES, type EconomyConfig, type GachaConfig, type Rarity } from './schemas.js';

export interface PityState {
  /** Призывов подряд без SSR+ */
  sinceSsr: number;
  /** Призывов подряд без SR+ */
  sinceSr: number;
}

export type PityKind = 'none' | 'soft' | 'hard' | 'sr_guarantee';

export interface RollResult {
  rarity: Rarity;
  pity: PityKind;
  state: PityState;
}

export const isSsrPlus = (r: Rarity): boolean => r === 'SSR' || r === 'UR';
export const isSrPlus = (r: Rarity): boolean => r === 'SR' || isSsrPlus(r);

export function baseRates(econ: EconomyConfig): Record<Rarity, number> {
  const total = econ.rarities.reduce((s, r) => s + r.weight, 0);
  const out = {} as Record<Rarity, number>;
  for (const r of econ.rarities) out[r.id] = r.weight / total;
  return out;
}

/** Шанс SSR+ на k-м призыве с последнего SSR+ (k начинается с 1). */
export function ssrPlusChance(k: number, base: Record<Rarity, number>, g: GachaConfig): number {
  if (k >= g.hard_pity) return 1;
  const b = base.SSR + base.UR;
  if (k < g.soft_pity_start) return b;
  return Math.min(1, b + g.soft_pity_step * (k - g.soft_pity_start + 1));
}

/**
 * Один призыв. rng() ∈ [0,1) — на сервере криптографический.
 * Мягкий pity: с soft_pity_start шанс SSR+ растёт на step за шаг; жёсткий: hard_pity — гарантия SSR+.
 * Гарантия SR+ каждые sr_guarantee_every призывов.
 */
export function rollOnce(state: PityState, base: Record<Rarity, number>, g: GachaConfig, rng: () => number): RollResult {
  const k = state.sinceSsr + 1;
  const pSsr = ssrPlusChance(k, base, g);
  const r = rng();
  let rarity: Rarity;
  let pity: PityKind = 'none';

  if (r < pSsr) {
    const urShare = base.UR / (base.SSR + base.UR);
    rarity = r < pSsr * urShare ? 'UR' : 'SSR';
    if (k >= g.hard_pity) pity = 'hard';
    else if (k >= g.soft_pity_start) pity = 'soft';
  } else {
    const rest = base.N + base.R + base.SR;
    const x = ((r - pSsr) / (1 - pSsr)) * rest;
    rarity = x < base.N ? 'N' : x < base.N + base.R ? 'R' : 'SR';
    if (!isSrPlus(rarity) && state.sinceSr + 1 >= g.sr_guarantee_every) {
      rarity = 'SR';
      pity = 'sr_guarantee';
    }
  }

  return {
    rarity,
    pity,
    state: {
      sinceSsr: isSsrPlus(rarity) ? 0 : state.sinceSsr + 1,
      sinceSr: isSrPlus(rarity) ? 0 : state.sinceSr + 1,
    },
  };
}

/**
 * Итоговые («консолидированные») шансы с учётом pity — стационарное распределение
 * марковской цепи по состояниям (sinceSsr, sinceSr). Показывается в UI рядом с базовыми.
 */
export function effectiveRates(base: Record<Rarity, number>, g: GachaConfig): Record<Rarity, number> {
  const A = g.hard_pity;
  const B = g.sr_guarantee_every;
  const idx = (a: number, b: number) => a * B + b;
  let dist = new Float64Array(A * B);
  dist[0] = 1;
  const out = { N: 0, R: 0, SR: 0, SSR: 0, UR: 0 } as Record<Rarity, number>;
  const rest = base.N + base.R + base.SR;

  for (let iter = 0; iter < 4000; iter++) {
    const next = new Float64Array(A * B);
    const acc = { N: 0, R: 0, SR: 0, SSR: 0, UR: 0 } as Record<Rarity, number>;
    for (let a = 0; a < A; a++) {
      for (let b = 0; b < B; b++) {
        const p = dist[idx(a, b)] ?? 0;
        if (p === 0) continue;
        const pSsr = ssrPlusChance(a + 1, base, g);
        const urShare = base.UR / (base.SSR + base.UR);
        acc.UR += p * pSsr * urShare;
        acc.SSR += p * pSsr * (1 - urShare);
        next[idx(0, 0)]! += p * pSsr;
        const q = p * (1 - pSsr);
        const na = Math.min(a + 1, A - 1);
        if (b + 1 >= B) {
          acc.SR += q;
          next[idx(na, 0)]! += q;
        } else {
          acc.N += (q * base.N) / rest;
          acc.R += (q * base.R) / rest;
          acc.SR += (q * base.SR) / rest;
          next[idx(na, b + 1)]! += (q * (base.N + base.R)) / rest;
          next[idx(na, 0)]! += (q * base.SR) / rest;
        }
      }
    }
    dist = next;
    if (iter >= 3000) for (const r of RARITIES) out[r] += acc[r] / 1000;
  }
  return out;
}
