/**
 * Симулятор призывов (ТЗ, приёмка M2): N призывов подряд с pity, сравнение с базовыми и аналитическими шансами.
 * Запуск: npm run sim:gacha -- [N=1000000] [seed]
 */
import { baseRates, effectiveRates, isSsrPlus, loadEconomy, loadGacha, mulberry32, RARITIES, rollOnce, type PityKind, type PityState, type Rarity } from '@wl/shared';

const n = Number(process.argv[2] ?? 1_000_000);
const seed = Number(process.argv[3] ?? Date.now() % 2 ** 31);
const tolerance = 0.002;

const econ = loadEconomy();
const g = loadGacha();
const base = baseRates(econ);
const eff = effectiveRates(base, g);
const rng = mulberry32(seed);

const counts = Object.fromEntries(RARITIES.map((r) => [r, 0])) as Record<Rarity, number>;
const pityHits: Record<PityKind, number> = { none: 0, soft: 0, hard: 0, sr_guarantee: 0 };
const gaps: number[] = [];
let state: PityState = { sinceSsr: 0, sinceSr: 0 };
let gap = 0;
let maxSrGap = 0;
let srGap = 0;

const t0 = performance.now();
for (let i = 0; i < n; i++) {
  const r = rollOnce(state, base, g, rng);
  state = r.state;
  counts[r.rarity]++;
  pityHits[r.pity]++;
  gap++;
  srGap++;
  if (isSsrPlus(r.rarity)) {
    gaps.push(gap);
    gap = 0;
  }
  if (r.rarity !== 'N' && r.rarity !== 'R') {
    maxSrGap = Math.max(maxSrGap, srGap);
    srGap = 0;
  }
}
const ms = performance.now() - t0;

gaps.sort((a, b) => a - b);
const pct = (p: number) => gaps[Math.min(gaps.length - 1, Math.floor(gaps.length * p))] ?? 0;
const avg = gaps.reduce((a, b) => a + b, 0) / Math.max(1, gaps.length);

console.log(`Призывов: ${n.toLocaleString('ru')} · seed ${seed} · ${ms.toFixed(0)} мс`);
console.log('');
console.log('Редкость   Базовый   Итоговый (аналит.)   Факт       Δ к итоговому');
let ok = true;
for (const r of [...RARITIES].reverse()) {
  const fact = counts[r] / n;
  const d = fact - eff[r];
  if (Math.abs(d) > tolerance) ok = false;
  console.log(
    `${r.padEnd(9)}  ${(base[r] * 100).toFixed(2).padStart(6)}%   ${(eff[r] * 100).toFixed(3).padStart(8)}%            ${(fact * 100).toFixed(3).padStart(7)}%   ${(d * 100 >= 0 ? '+' : '') + (d * 100).toFixed(3)}%`,
  );
}
console.log('');
console.log(`Срабатывания pity: мягкий ${pityHits.soft}, жёсткий ${pityHits.hard}, гарантия SR ${pityHits.sr_guarantee}`);
console.log(`Призывов до SSR+: среднее ${avg.toFixed(1)}, медиана ${pct(0.5)}, p90 ${pct(0.9)}, p99 ${pct(0.99)}, максимум ${gaps.at(-1) ?? 0} (жёсткий pity ${g.hard_pity})`);
console.log(`Самая длинная серия без SR+: ${maxSrGap} (гарантия каждые ${g.sr_guarantee_every})`);
console.log('');

const hardOk = (gaps.at(-1) ?? 0) <= g.hard_pity;
const srOk = maxSrGap <= g.sr_guarantee_every;
console.log(ok && hardOk && srOk ? `✅ Отклонение в пределах ±${tolerance * 100}%, гарантии соблюдены` : '❌ Есть расхождения');
process.exit(ok && hardOk && srOk ? 0 : 1);
